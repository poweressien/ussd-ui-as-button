// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * UssdAccessibilityService (v3)
 * ------------------------------
 * Reads and drives the SYSTEM's own USSD dialog, and (optionally) covers it
 * with UssdOverlay so the person sees and taps real buttons instead.
 *
 * v3 CHANGES, from real-device screenshots (HyperOS/MIUI-style dialog):
 *  - Detection is by PROPERTIES, not class names. The old code looked for
 *    class names containing "EditText"/"Button"/"TextView"; OEM dialogs use
 *    their own widget classes, so dialogs with a reply box were missed
 *    (the plain "OK" dialog happened to match). Now: editable -> reply
 *    field, clickable + short text -> button, other text -> message.
 *  - Reply typing retries, falls back to a click-then-set and to clipboard
 *    paste, and Send is pressed by label with retries.
 *  - A privacy-safe TRACE (classes, flags, text LENGTHS only, never
 *    content) and a structure dump are available from the Developer screen
 *    so an unrecognised phone can be fixed from data, not guesses.
 *  - The overlay can cover the dialog as soon as it is detected.
 *
 * Still ARMED-ONLY: nothing is read unless the app armed the service by
 * dialling, and the arm window expires.
 */
class UssdAccessibilityService : AccessibilityService() {

    companion object {
        var instance: UssdAccessibilityService? = null
            private set

        /** "Catch codes dialled from the Phone app". Mirrored in SharedPreferences so it survives without the JS side. */
        @Volatile var passiveCapture: Boolean = false
        const val PREFS = "ussdui_prefs"
        const val PREF_PASSIVE = "passive_capture"
        private const val PASSIVE_SUPPRESS_MS = 30_000L
        private const val OPEN_PROMPT_DELAY_MS = 3_500L

        private const val ARM_DEFAULT_MS = 45_000L
        private const val DEDUPE_WINDOW_MS = 900L
        private const val SUBMIT_DELAY_MS = 180L
        private const val SUBMIT_RETRY_MS = 350L
        private const val TRACE_MAX = 80
        private const val STALE_GUARD_MS = 6_000L
        private const val DUPLICATE_SUBMIT_MS = 1_000L
        private const val FIND_DIALOG_WAIT_MS = 2_500L
        private const val FIND_DIALOG_STEP_MS = 150L

        /** Titles OEM dialogs put above the carrier's text. Never part of the message. */
        private val DIALOG_TITLES = setOf(
            "carrier info", "ussd message", "ussd response", "network message",
            "mobile network", "service message", "ussd code running", "ussd code running..."
        )

        private val POSITIVE_LABELS = setOf(
            "send", "ok", "okay", "reply", "submit", "yes", "continue", "next", "done",
            "accept", "respond", "envoyer", "enviar"
        )
        private val NEGATIVE_LABELS = setOf(
            "cancel", "dismiss", "no", "close", "exit", "back", "annuler", "cancelar"
        )
        private val PHONE_PACKAGE_PARTS = listOf(
            "phone", "telecom", "dialer", "incallui", "telephony", "ussd", "mmi", "stk"
        )
        private const val SCAN_MIN_GAP_MS = 250L
        private val IGNORED_PACKAGE_PARTS = listOf(
            "systemui", "launcher", "inputmethod", "keyboard", "latinime", "swiftkey", "gboard"
        )
    }

    private var listener: UssdAccessibilityListener? = null
    private var overlayActionListener: ((String, String) -> Unit)? = null
    private var overlay: UssdOverlay? = null
    var overlayEnabled: Boolean = true

    private var armedUntil: Long = 0L
    private var lastSignature: String? = null
    private var lastSignatureAt: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())
    private val trace = ArrayDeque<String>()

    // Stale-dialog guard: after we answer a dialog, the SAME dialog is still on
    // screen for a moment and fires more events. Without this it was reported
    // again as if it were the network's next reply.
    private var answeredSignature: String? = null
    private var answeredAt: Long = 0L
    private var goneSinceAnswer = false
    private var lastSubmitValue: String? = null
    private var lastSubmitAt: Long = 0L

    // In-memory only (never persisted): the last few dialog texts, for the Share-report button.
    private val recentTexts = ArrayDeque<String>()

    fun setListener(l: UssdAccessibilityListener?) { listener = l }
    fun setOverlayActionListener(l: ((String, String) -> Unit)?) { overlayActionListener = l }

    fun arm(durationMs: Long = ARM_DEFAULT_MS) {
        armedUntil = System.currentTimeMillis() + durationMs
        lastSignature = null
        answeredSignature = null
        goneSinceAnswer = false
        lastSubmitValue = null
        hideOverlay() // never leave the previous session's buttons covering a new session
        log("armed for ${durationMs}ms")
    }

    fun disarm() {
        armedUntil = 0L
        lastSignature = null
        answeredSignature = null
        hideOverlay()
    }

    /** The phone's own telephony package (where the USSD pop-up lives), never a dialer/in-call screen. */
    private fun isTelephonyPackage(pkg: String): Boolean =
        (pkg.contains("phone") || pkg.contains("telephony") || pkg.contains("ussd")) &&
            !pkg.contains("dialer") && !pkg.contains("incall")

    private var passiveSuppressUntil: Long = 0L
    private var pendingAdopt: Boolean = false

    /** Read-and-clear: true if the app was launched/needed to take over a dialog dialled elsewhere. */
    fun consumePendingAdopt(): Boolean {
        val v = pendingAdopt
        pendingAdopt = false
        return v
    }

    private fun launchApp() {
        try {
            val i = packageManager.getLaunchIntentForPackage(packageName) ?: return
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(i)
            log("launched app for passive session")
        } catch (e: Exception) {
            log("launchApp failed: ${e.javaClass.simpleName}")
        }
    }

    private fun nativeAction(kind: String) {
        when (kind) {
            "openApp" -> { pendingAdopt = true; launchApp() }
            "showPhone" -> {
                passiveSuppressUntil = System.currentTimeMillis() + PASSIVE_SUPPRESS_MS
                disarm()
            }
        }
    }

    private fun isArmed(): Boolean = System.currentTimeMillis() < armedUntil

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        passiveCapture = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(PREF_PASSIVE, false)
        overlay = UssdOverlay(
            this,
            { kind, value ->
                if (listener?.isReady() == true) {
                    overlayActionListener?.invoke(kind, value)
                } else if (kind == "cancel" || kind == "done") {
                    // The app UI is not running (dialog caught from the Phone app): handle it here.
                    cancelDialog()
                    disarm()
                }
            },
            { line -> log(line) },
            { kind -> nativeAction(kind) }
        )
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        hideOverlay()
        if (instance === this) instance = null
    }

    // -----------------------------------------------------------------
    // Overlay passthroughs (called from the bridge, any thread)
    // -----------------------------------------------------------------

    fun showOverlayLoading() { if (overlayEnabled) overlay?.showLoading() }
    fun showOverlayScreen(json: String) { if (overlayEnabled) overlay?.showScreen(json) }
    fun hideOverlay() { overlay?.hide() }

    // -----------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOWS_CHANGED
        ) return

        if (!isArmed()) {
            // Not dialled from this app. If the person turned on "catch codes from the Phone app",
            // a brand-new USSD pop-up from the phone's own telephony package counts as a session.
            if (!passiveCapture || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
            if (System.currentTimeMillis() < passiveSuppressUntil) return
            val evPkg = event.packageName?.toString()?.lowercase().orEmpty()
            if (!isTelephonyPackage(evPkg)) return
            val d = findUssdDialog() ?: return
            if (!d.alertShaped || isTransitional(d)) return
            log("passive: USSD dialog from $evPkg")
            arm()
        }

        // Rate limit: scan at most ~4x/second, with one trailing scan so the last change is never lost.
        val sinceScan = System.currentTimeMillis() - lastScanAt
        if (sinceScan < SCAN_MIN_GAP_MS) {
            if (!scanPending) {
                scanPending = true
                mainHandler.postDelayed({ scanPending = false; scanNow() }, SCAN_MIN_GAP_MS - sinceScan + 20)
            }
            return
        }
        scanNow()
    }

    private var lastScanAt: Long = 0L
    private var scanPending: Boolean = false

    private fun scanNow() {
        if (!isArmed()) return
        lastScanAt = System.currentTimeMillis()
        val dialog = freshDialog(record = true) ?: return

        val signature = dialog.message + "|" + dialog.hasInputField
        val now = System.currentTimeMillis()
        // Same dialog still on screen: never re-report it (lastSignature is reset whenever we answer).
        if (signature == lastSignature) return
        lastSignature = signature
        lastSignatureAt = now
        armedUntil = maxOf(armedUntil, now + ARM_DEFAULT_MS)

        // A new dialog: cover it and drop any previous screen's buttons so a tap
        // can never reach a dialog that has already moved on. JS then replaces
        // this loading cover with the real screen.
        if (overlayEnabled) overlay?.showLoading()

        synchronized(recentTexts) {
            recentTexts.addLast("[input=${dialog.hasInputField} buttons=${dialog.buttonLabels}]\n${dialog.message}")
            while (recentTexts.size > 6) recentTexts.removeFirst()
        }
        if (listener?.isReady() == true) {
            listener?.onDialogText(dialog.message, dialog.hasInputField, dialog.buttonLabels)
        } else {
            // App UI is not running: start it, and if it is too slow offer a native "Open" button.
            pendingAdopt = true
            launchApp()
            mainHandler.postDelayed({
                if (isArmed() && overlay?.isLoadingCover == true && listener?.isReady() != true) overlay?.showOpenPrompt()
            }, OPEN_PROMPT_DELAY_MS)
        }
    }

    // -----------------------------------------------------------------
    // Detection (property-based)
    // -----------------------------------------------------------------

    class DetectedDialog(
        val message: String,
        val hasInputField: Boolean,
        val buttonLabels: List<String>,
        val inputNode: AccessibilityNodeInfo?,
        val buttonNodes: List<AccessibilityNodeInfo>,
        /** Built from the standard AlertDialog pieces (message/title/button ids): a pop-up, not a settings screen. */
        val alertShaped: Boolean = false
    )

    private fun candidateRoots(): List<AccessibilityNodeInfo> {
        val roots = mutableListOf<AccessibilityNodeInfo>()
        try {
            windows?.forEach { w -> w.root?.let { roots.add(it) } }
        } catch (e: Exception) {
            // OEM refused window enumeration — fall through to the active window.
        }
        rootInActiveWindow?.let { active ->
            if (roots.none { it.packageName == active.packageName && it.windowId == active.windowId }) roots.add(active)
        }
        return roots
    }

    /**
     * Only the phone/telecom stack hosts the USSD dialog. Everything else (screen recorder
     * timers, floating widgets, data-usage bars, other apps) is ignored: on a phone with such
     * a widget, its ticking text was read as a "new dialog" 10x/second and kept the cover
     * screen re-rendering, which froze the phone.
     */
    private fun isCandidatePackage(pkg: String): Boolean {
        val lower = pkg.lowercase()
        if (lower == packageName) return false
        if (IGNORED_PACKAGE_PARTS.any { lower.contains(it) }) return false
        return PHONE_PACKAGE_PARTS.any { lower.contains(it) }
    }

    /** The Phone/Dialer app's own screens (contacts list, call log, keypad) are never a USSD reply. */
    private fun looksLikeDialerScreen(message: String): Boolean {
        val lines = message.split('\n').map { it.trim().uppercase() }.toSet()
        // The keypad letters ("ABC", "DEF", "GHI"...) or the dialer's tab names.
        val keypad = lines.containsAll(listOf("ABC", "DEF", "GHI"))
        val tabs = lines.contains("KEYPAD") && (lines.contains("HOME") || lines.contains("CONTACTS") || lines.contains("FAVORITES"))
        return keypad || tabs
    }

    private fun isDialerPackage(pkg: String): Boolean {
        val p = pkg.lowercase()
        return p.contains("dialer") || p.contains("incallui") || p.contains("contacts")
    }

    private fun findUssdDialog(record: Boolean = false): DetectedDialog? {
        // The USSD pop-up lives in the phone's telephony package. Dialer apps are only trusted when
        // what they show is a real pop-up (AlertDialog ids), never their ordinary screens.
        val roots = candidateRoots().sortedBy { r ->
            val p = r.packageName?.toString()?.lowercase().orEmpty()
            if (isDialerPackage(p)) 1 else 0
        }
        var found: DetectedDialog? = null
        for (root in roots) {
            val pkg = root.packageName?.toString() ?: continue
            if (!isCandidatePackage(pkg)) {
                continue
            }
            var d = parseDialog(root)
            if (d != null && (looksLikeDialerScreen(d.message) || (isDialerPackage(pkg) && !d.alertShaped))) {
                if (record) log("pkg=$pkg ignored: dialer screen, not a USSD pop-up")
                d = null
            }
            if (record) {
                log("pkg=$pkg parsed=${d != null}" +
                    (d?.let { " input=${it.hasInputField} buttons=${it.buttonLabels.size} msgLen=${it.message.length}" } ?: ""))
            }
            if (d != null && found == null) found = d
        }
        if (record && roots.isEmpty()) log("no windows visible to the service")
        return found
    }

    fun peekDialog(): DetectedDialog? = if (isArmed()) freshDialog() else null

    /**
     * The current dialog, minus things that are not a new network reply:
     *  - the dialog we just answered (until it changes or disappears),
     *  - transitional "USSD code running..." dialogs.
     */
    @Synchronized
    private fun freshDialog(record: Boolean = false): DetectedDialog? {
        val d = findUssdDialog(record)
        val now = System.currentTimeMillis()
        if (d == null) {
            if (answeredSignature != null) goneSinceAnswer = true
            return null
        }
        if (isTransitional(d)) {
            if (answeredSignature != null) goneSinceAnswer = true
            if (record) log("transitional dialog ignored")
            return null
        }
        val sig = d.message + "|" + d.hasInputField
        val answered = answeredSignature
        if (answered != null) {
            if (sig == answered && !goneSinceAnswer && now - answeredAt < STALE_GUARD_MS) {
                if (record) log("stale dialog ignored (already answered)")
                return null
            }
            answeredSignature = null
        }
        return d
    }

    private fun isTransitional(d: DetectedDialog): Boolean {
        if (d.hasInputField) return false
        val m = d.message.lowercase().trim()
        if (m.length > 80) return false
        return m.contains("code running") || m.contains("mmi code") && m.contains("running") ||
            m == "please wait" || m == "please wait..." || m == "loading..." || m == "sending..."
    }

    private fun parseDialog(root: AccessibilityNodeInfo): DetectedDialog? {
        val texts = mutableListOf<String>()
        val buttons = mutableListOf<AccessibilityNodeInfo>()
        var input: AccessibilityNodeInfo? = null
        var alertShaped = false
        walk(root, 0) { node ->
            val nid = node.viewIdResourceName.orEmpty().lowercase()
            if (nid.endsWith(":id/message") || nid.endsWith(":id/alerttitle") || nid.endsWith(":id/button1") ||
                nid.endsWith(":id/parentpanel") || nid.endsWith(":id/buttonpanel")) alertShaped = true
            val cls = node.className?.toString().orEmpty()
            val text = node.text?.toString()?.trim().orEmpty()
            val label = if (text.isNotEmpty()) text else node.contentDescription?.toString()?.trim().orEmpty()
            if (node.isEditable || cls.contains("EditText")) {
                if (input == null) input = node
                return@walk
            }
            if (label.isNotEmpty() && (node.isClickable || cls.contains("Button")) && label.length <= 24) {
                buttons.add(node)
                return@walk
            }
            if (text.isNotEmpty()) {
                val id = node.viewIdResourceName.orEmpty().lowercase()
                val isTitleNode = id.endsWith("alerttitle") || id.endsWith("/title") || id.endsWith("dialog_title")
                if (isTitleNode || (texts.isEmpty() && text.lowercase().trimEnd('.', '…') in DIALOG_TITLES)) return@walk
                texts.add(text)
            }
        }
        // A USSD dialog is: some message text + (a reply field or at least one button).
        if (texts.isEmpty() || (buttons.isEmpty() && input == null)) return null
        val message = texts.joinToString("\n").trim()
        if (message.isEmpty()) return null
        return DetectedDialog(
            message = message,
            hasInputField = input != null,
            buttonLabels = buttons.map { it.text?.toString() ?: it.contentDescription?.toString().orEmpty() },
            inputNode = input,
            buttonNodes = buttons,
            alertShaped = alertShaped
        )
    }

    private fun walk(node: AccessibilityNodeInfo, depth: Int, visit: (AccessibilityNodeInfo) -> Unit) {
        if (depth > 40) return
        visit(node)
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { walk(it, depth + 1, visit) }
        }
    }

    // -----------------------------------------------------------------
    // Driving the dialog
    // -----------------------------------------------------------------

    private fun label(node: AccessibilityNodeInfo): String =
        (node.text?.toString() ?: node.contentDescription?.toString()).orEmpty()
            .lowercase().trim().trim('.', '!', ':')

    private fun pickPositive(nodes: List<AccessibilityNodeInfo>): AccessibilityNodeInfo? =
        nodes.firstOrNull { label(it) in POSITIVE_LABELS }
            ?: nodes.lastOrNull { label(it) !in NEGATIVE_LABELS }
            ?: nodes.lastOrNull()

    /**
     * Types [value] into the dialog's reply field and presses Send. Returns
     * true once the text was entered; the Send press is retried a few times
     * in the background because some dialogs enable Send a moment after the
     * text lands.
     */
    fun typeAndSubmit(value: String): Boolean {
        val now = System.currentTimeMillis()
        // Idempotent: the same reply twice within a second is a double delivery, not a new answer.
        if (value == lastSubmitValue && now - lastSubmitAt < DUPLICATE_SUBMIT_MS) {
            log("typeAndSubmit: duplicate ignored")
            return true
        }

        // The dialog can be momentarily absent while the phone swaps screens; wait for it.
        var dialog: DetectedDialog? = null
        val deadline = now + FIND_DIALOG_WAIT_MS
        while (true) {
            val d = findUssdDialog()
            if (d != null && d.inputNode != null && !isTransitional(d)) { dialog = d; break }
            if (System.currentTimeMillis() >= deadline) { dialog = d; break }
            try { Thread.sleep(FIND_DIALOG_STEP_MS) } catch (e: InterruptedException) { break }
        }
        val dlg: DetectedDialog = dialog ?: run { failWithDump("typeAndSubmit: no dialog"); return false }
        val input = dlg.inputNode
        if (input == null) { failWithDump("typeAndSubmit: dialog has no reply field"); return false }

        var ok = setText(input, value)
        if (!ok) {
            input.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            input.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            ok = setText(input, value)
        }
        if (!ok) {
            ok = pasteText(input, value)
        }
        log("typeAndSubmit: text entered=$ok")
        if (!ok) { failWithDump("typeAndSubmit: could not enter text"); return false }

        synchronized(this) {
            answeredSignature = dlg.message + "|" + dlg.hasInputField
            answeredAt = System.currentTimeMillis()
            goneSinceAnswer = false
            lastSubmitValue = value
            lastSubmitAt = answeredAt
        }
        lastSignature = null
        armedUntil = maxOf(armedUntil, System.currentTimeMillis() + ARM_DEFAULT_MS)
        pressSendWithRetry(dlg.message + "|" + dlg.hasInputField, attemptsLeft = 5, delayMs = SUBMIT_DELAY_MS)
        return true
    }

    private fun failWithDump(reason: String) {
        log(reason)
        // Structure only (no message text): lets a failure on an unknown phone be diagnosed from data.
        log("FAILURE SNAPSHOT:\n" + treeDump().take(2500))
    }

    private fun setText(input: AccessibilityNodeInfo, value: String): Boolean {
        input.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        val args = Bundle()
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
        return input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun pasteText(input: AccessibilityNodeInfo, value: String): Boolean {
        return try {
            val cm = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(android.content.ClipData.newPlainText("ussd", value))
            input.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            val pasted = input.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            // Don't leave a (possibly sensitive) reply sitting on the clipboard.
            mainHandler.postDelayed({ try { cm.setPrimaryClip(android.content.ClipData.newPlainText("", "")) } catch (e: Exception) {} }, 1500)
            pasted
        } catch (e: Exception) {
            false
        }
    }

    /** Only ever presses Send on the very dialog we typed into, never on a newer one. */
    private fun pressSendWithRetry(expectedSig: String, attemptsLeft: Int, delayMs: Long) {
        mainHandler.postDelayed({
            val d = findUssdDialog()
            val same = d != null && (d.message + "|" + d.hasInputField) == expectedSig
            val clicked = same && clickPositiveNow(d)
            log("send click attempt (left=$attemptsLeft) same=$same -> $clicked")
            if (!clicked && same && attemptsLeft > 1) pressSendWithRetry(expectedSig, attemptsLeft - 1, SUBMIT_RETRY_MS)
        }, delayMs)
    }

    fun tapPositiveButton(): Boolean {
        var dialog: DetectedDialog? = null
        val deadline = System.currentTimeMillis() + 1_200L
        while (true) {
            val d = findUssdDialog()
            if (d != null && d.buttonNodes.isNotEmpty()) { dialog = d; break }
            if (System.currentTimeMillis() >= deadline) break
            try { Thread.sleep(FIND_DIALOG_STEP_MS) } catch (e: InterruptedException) { break }
        }
        return clickPositiveNow(dialog)
    }

    /** Non-blocking: safe on the main thread. */
    private fun clickPositiveNow(d: DetectedDialog?): Boolean {
        if (d == null) return false
        val target = pickPositive(d.buttonNodes) ?: return false
        lastSignature = null
        val clicked = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        if (clicked) synchronized(this) {
            answeredSignature = d.message + "|" + d.hasInputField
            answeredAt = System.currentTimeMillis()
            goneSinceAnswer = false
        }
        return clicked
    }

    /** End of a session: dismiss an info dialog if one is showing, drop the overlay, disarm. */
    fun finishSession(): Boolean {
        val dialog = findUssdDialog()
        val ok = if (dialog != null && !dialog.hasInputField) tapPositiveButton() else false
        disarm()
        return ok
    }

    fun cancelDialog(): Boolean {
        val dialog = findUssdDialog()
        val cancelButton = dialog?.buttonNodes?.firstOrNull { label(it) in NEGATIVE_LABELS }
        val ok = if (cancelButton != null) {
            cancelButton.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        } else {
            performGlobalAction(GLOBAL_ACTION_BACK)
        }
        disarm()
        return ok
    }

    // -----------------------------------------------------------------
    // Diagnostics (privacy-safe: structure and lengths, never text content)
    // -----------------------------------------------------------------

    private fun log(line: String) {
        synchronized(trace) {
            trace.addLast("${System.currentTimeMillis() % 100000} $line")
            while (trace.size > TRACE_MAX) trace.removeFirst()
        }
    }

    fun traceDump(): String = synchronized(trace) { trace.joinToString("\n") }

    /** Everything needed to diagnose a phone from one message. Dialog TEXT only when asked for. */
    fun report(includeText: Boolean): String {
        val sb = StringBuilder()
        sb.append("== TRACE\n").append(traceDump()).append("\n\n")
        sb.append("== SCREEN STRUCTURE NOW\n").append(treeDump()).append("\n")
        if (includeText) {
            sb.append("\n== LAST DIALOG TEXTS (oldest first)\n")
            synchronized(recentTexts) { recentTexts.forEachIndexed { i, t -> sb.append("--- #").append(i + 1).append('\n').append(t).append('\n') } }
        }
        return sb.toString()
    }

    fun treeDump(): String {
        val sb = StringBuilder()
        val roots = candidateRoots()
        sb.append("windows=${roots.size} armed=${isArmed()}\n")
        for (root in roots) {
            sb.append("== pkg=${root.packageName} candidate=${isCandidatePackage(root.packageName?.toString().orEmpty())}\n")
            walkDump(root, 0, sb)
        }
        return sb.toString()
    }

    private fun walkDump(node: AccessibilityNodeInfo, depth: Int, sb: StringBuilder) {
        if (depth > 25 || sb.length > 12_000) return
        val r = Rect()
        node.getBoundsInScreen(r)
        sb.append("  ".repeat(depth))
            .append(node.className?.toString()?.substringAfterLast('.'))
            .append(" id=").append(node.viewIdResourceName?.substringAfterLast('/') ?: "-")
            .append(" txtLen=").append(node.text?.length ?: 0)
            .append(" cdLen=").append(node.contentDescription?.length ?: 0)
            .append(if (node.isClickable) " click" else "")
            .append(if (node.isEditable) " edit" else "")
            .append(if (node.isVisibleToUser) "" else " hidden")
            .append(" [").append(r.width()).append('x').append(r.height()).append("]\n")
        for (i in 0 until node.childCount) node.getChild(i)?.let { walkDump(it, depth + 1, sb) }
    }
}

interface UssdAccessibilityListener {
    /** False when the React side is not running (so events would be dropped). */
    fun isReady(): Boolean = true
    fun onDialogText(message: String, hasInputField: Boolean, buttonLabels: List<String>)
}
