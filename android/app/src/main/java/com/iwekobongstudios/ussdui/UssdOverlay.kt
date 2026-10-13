// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.text.method.PasswordTransformationMethod
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject

/**
 * UssdOverlay (v5)
 * -----------------
 * A full-screen window drawn by the accessibility service ABOVE the phone's
 * own USSD dialog. The dialog is a modal system window that swallows touches,
 * so buttons drawn by the app underneath could never be tapped. This overlay
 * hides the dialog and shows real, tappable buttons for each menu option.
 * Taps are sent back to JS (onAction), which types the choice into the
 * hidden dialog.
 *
 * v5:
 *  - Number entry uses an on-screen keypad (no dependence on the phone's
 *    keyboard, which an overlay window often cannot raise). The overlay stays
 *    non-focusable, so the system dialog underneath keeps input focus.
 *  - A window the system silently dropped is detected and re-added; add
 *    failures are written to the trace instead of being swallowed.
 *  - "Loading/Sending" can never hang: after 25 s it turns into a "No reply"
 *    screen with a Close button.
 *  - A 90 s watchdog still removes the overlay as a last resort.
 */
class UssdOverlay(
    private val service: AccessibilityService,
    private val onAction: (kind: String, value: String) -> Unit,
    private val trace: (String) -> Unit = {},
    private val onNative: (String) -> Unit = {}
) {
    private val wm: WindowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main: Handler = Handler(Looper.getMainLooper())
    private var root: FrameLayout? = null
    private var focusable: Boolean = false
    private val watchdog: Runnable = Runnable { hide() }
    private val loadingTimeout: Runnable = Runnable { showTimeout() }
    private var loadingShown: Boolean = false

    val isShowing: Boolean get() = root != null

    private val bg: Int = Color.parseColor("#0F1115")
    private val surface: Int = Color.parseColor("#20242C")
    private val border: Int = Color.parseColor("#2A2F3A")
    private val textPrimary: Int = Color.parseColor("#F4F5F7")
    private val textSecondary: Int = Color.parseColor("#9AA1AE")
    private val accent: Int = Color.parseColor("#2FA36B")
    private val danger: Int = Color.parseColor("#E0524A")
    private val onAccent: Int = Color.parseColor("#06120C")
    private val accentMuted: Int = Color.parseColor("#1E7A4E")

    private fun dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), service.resources.displayMetrics).toInt()

    private fun ui(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------

    fun showLoading(message: String = "Waiting for the network…"): Unit = ui {
        // Already showing the cover: do nothing (re-rendering it re-fires accessibility events and restarts the timeout).
        if (loadingShown && root != null) return@ui
        val col: LinearLayout = column()
        col.addView(text("USSD-UI", 22, textPrimary, bold = true, center = true))
        col.addView(text(message, 15, textSecondary, center = true).apply { setPadding(0, dp(8), 0, dp(24)) })
        col.addView(secondaryButton("Cancel") { tap("cancel", ""); onAction("cancel", "") })
        render(scroll(col), false)
        // Never hang on a spinner: turn into an error screen if nothing replaces this.
        main.postDelayed(loadingTimeout, 20_000)
        loadingShown = true
    }

    /** True while only the "Loading" cover is up (no real screen has replaced it yet). */
    val isLoadingCover: Boolean get() = loadingShown && root != null

    /**
     * Shown when a code was dialled from the Phone app and the app's own UI could not start in time.
     * Handled entirely natively, so it works even when the app is not running.
     */
    fun showOpenPrompt(): Unit = ui {
        val col: LinearLayout = column()
        col.addView(text("USSD-UI", 22, textPrimary, bold = true, center = true))
        col.addView(
            text("Your USSD menu is ready. Open USSD-UI to see it as buttons.", 15, textSecondary, center = true)
                .apply { setPadding(0, dp(8), 0, dp(24)) }
        )
        col.addView(primaryButton("Open USSD-UI") { tap("openApp", ""); onNative("openApp") })
        col.addView(secondaryButton("Show phone's own screen") { tap("showPhone", ""); onNative("showPhone") })
        render(scroll(col), false)
    }

    private fun showTimeout() {
        val col: LinearLayout = column()
        col.addView(text("No reply", 22, danger, bold = true, center = true))
        col.addView(
            text("The network did not answer in time. Close this and try the code again.", 15, textSecondary, center = true)
                .apply { setPadding(0, dp(8), 0, dp(24)) }
        )
        col.addView(primaryButton("Close") { tap("cancel", "timeout"); onAction("cancel", ""); hide() })
        render(scroll(col), false)
    }

    fun showScreen(json: String): Unit = ui {
        val obj: JSONObject? = try { JSONObject(json) } catch (e: Exception) { null }
        if (obj == null) {
            showLoading()
        } else {
            buildScreen(obj)
        }
    }

    private fun buildScreen(obj: JSONObject) {
        val col: LinearLayout = column()
        val title: String = obj.optString("title")
        val message: String = obj.optString("text")
        val terminal: Boolean = obj.optBoolean("terminal", false)
        val isError: Boolean = obj.optBoolean("error", false)
        var needsKeyboard = false

        if (title.isNotEmpty()) col.addView(text(title, 22, if (isError) danger else textPrimary, bold = true, center = true))
        if (message.isNotEmpty()) {
            col.addView(text(message, 15, textSecondary, center = true).apply { setPadding(0, dp(6), 0, dp(18)) })
        }

        val comps = obj.optJSONArray("components")
        if (comps != null) {
            for (i in 0 until comps.length()) {
                val c: JSONObject = comps.getJSONObject(i)
                when (c.optString("type")) {
                    "button" -> col.addView(optionButton(c.optString("label"), false) { send(c.optString("input")) })
                    "confirm" -> {
                        col.addView(optionButton(c.optString("confirmLabel"), true) { send(c.optString("confirmInput")) })
                        col.addView(optionButton(c.optString("cancelLabel"), false) { send(c.optString("cancelInput")) })
                    }
                    "input" -> {
                        val sensitive: Boolean = c.optBoolean("sensitive")
                        val numeric: Boolean = c.optBoolean("numeric")
                        // Only free-text prompts need the phone keyboard; digits use the on-screen keypad.
                        if (!sensitive && !numeric) needsKeyboard = true
                        col.addView(inputRow(c.optString("title"), sensitive, numeric))
                    }
                }
            }
        }

        if (terminal) {
            col.addView(primaryButton("Done") { tap("done", ""); onAction("done", ""); hide() })
        } else {
            col.addView(secondaryButton("Cancel") { tap("cancel", ""); onAction("cancel", "") })
        }
        render(scroll(col), needsKeyboard)
    }

    fun hide(): Unit = ui {
        loadingShown = false
        main.removeCallbacks(watchdog)
        main.removeCallbacks(loadingTimeout)
        root?.let { v ->
            try { wm.removeView(v) } catch (e: Exception) { /* already gone */ }
        }
        root = null
    }

    // -----------------------------------------------------------------
    // Window management
    // -----------------------------------------------------------------

    private fun tap(kind: String, value: String) {
        // Length only: a reply may be a PIN, so its value is never traced.
        trace("overlay tap kind=$kind len=${value.length}")
    }

    private fun send(value: String) {
        tap("input", value)
        showLoading("Sending…")
        onAction("input", value)
    }

    private fun params(focus: Boolean): WindowManager.LayoutParams {
        // NO_LIMITS + cutout/inset overrides: cover the status bar strip too, so the app's
        // own header can't show through and nothing underneath can be tapped.
        var flags: Int = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        if (!focus) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT
        )
        p.gravity = Gravity.TOP
        p.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        if (Build.VERSION.SDK_INT >= 30) {
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        } else if (Build.VERSION.SDK_INT >= 28) {
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        if (Build.VERSION.SDK_INT >= 30) {
            p.setFitInsetsTypes(0)
        }
        return p
    }

    private fun attach(needsKeyboard: Boolean): FrameLayout? {
        val f = FrameLayout(service)
        f.setBackgroundColor(bg)
        return try {
            wm.addView(f, params(needsKeyboard))
            root = f
            focusable = needsKeyboard
            f
        } catch (e: Exception) {
            root = null
            trace("overlay add failed: ${e.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    private fun render(content: View, needsKeyboard: Boolean) {
        loadingShown = false
        main.removeCallbacks(watchdog)
        main.removeCallbacks(loadingTimeout)
        main.postDelayed(watchdog, 90_000)

        var container: FrameLayout? = root
        if (container != null) {
            // If the system dropped our window, updating it throws: start fresh.
            try {
                wm.updateViewLayout(container, params(needsKeyboard))
                focusable = needsKeyboard
            } catch (e: Exception) {
                trace("overlay was dropped by the system, re-adding")
                try { wm.removeView(container) } catch (e2: Exception) { /* ignore */ }
                root = null
                container = null
            }
        }
        if (container == null) container = attach(needsKeyboard)
        if (container == null) return

        container.removeAllViews()
        container.addView(content, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    // -----------------------------------------------------------------
    // View helpers (no XML: keeps the overlay self-contained)
    // -----------------------------------------------------------------

    private fun scroll(inner: View): ScrollView {
        val s = ScrollView(service)
        s.isFillViewport = true
        // WRAP_CONTENT child + fillViewport: the column grows to the full screen height when its
        // content is short (so CENTER_VERTICAL centres it) and scrolls when it is long.
        s.addView(inner, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        return s
    }

    private fun column(): LinearLayout {
        val c = LinearLayout(service)
        c.orientation = LinearLayout.VERTICAL
        c.gravity = Gravity.CENTER_VERTICAL
        c.setPadding(dp(20), dp(48), dp(20), dp(48))
        return c
    }

    private fun spacer(h: Int): View {
        val v = View(service)
        v.minimumHeight = h
        return v
    }

    private fun text(t: String, sp: Int, color: Int, bold: Boolean = false, center: Boolean = false): TextView {
        val tv = TextView(service)
        tv.text = t
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp.toFloat())
        tv.setTextColor(color)
        if (bold) tv.setTypeface(tv.typeface, Typeface.BOLD)
        if (center) tv.gravity = Gravity.CENTER_HORIZONTAL
        return tv
    }

    private fun pill(fill: Int, stroke: Int?, strokeDp: Int = 1): GradientDrawable {
        val g = GradientDrawable()
        g.cornerRadius = dp(14).toFloat()
        g.setColor(fill)
        if (stroke != null) g.setStroke(dp(strokeDp), stroke)
        return g
    }

    /** Normal look, plus a green "pressed" look while the finger is down. */
    private fun pressable(fill: Int, stroke: Int?): StateListDrawable {
        val sl = StateListDrawable()
        sl.addState(intArrayOf(android.R.attr.state_pressed), pill(accentMuted, accent, 2))
        sl.addState(intArrayOf(), pill(fill, stroke))
        return sl
    }

    /**
     * Makes a tap obvious: vibrates lightly, holds the green "pressed" look for a moment, and only then
     * runs the action (which usually swaps the whole screen). Locks the button so a double tap sends once.
     */
    private fun tapFeedback(b: View, action: () -> Unit) {
        b.setOnClickListener { v ->
            try { v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) } catch (e: Exception) { /* optional */ }
            v.background = pill(accentMuted, accent, 2)
            v.isEnabled = false
            main.postDelayed({ action() }, 160)
        }
    }

    private fun styledButton(label: String, fill: Int, stroke: Int?, textColor: Int, onClick: () -> Unit): Button {
        val b = Button(service)
        b.text = label
        b.isAllCaps = false
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        b.setTextColor(textColor)
        b.background = pressable(fill, stroke)
        b.gravity = Gravity.CENTER
        b.setPadding(dp(18), 0, dp(18), 0)
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56))
        lp.setMargins(0, dp(5), 0, dp(5))
        b.layoutParams = lp
        tapFeedback(b, onClick)
        return b
    }

    private fun optionButton(label: String, primary: Boolean, onClick: () -> Unit): Button =
        styledButton(label, if (primary) accent else surface, border, if (primary) onAccent else textPrimary, onClick)

    private fun primaryButton(label: String, onClick: () -> Unit): Button {
        val b = styledButton(label, accent, null, onAccent, onClick)
        b.gravity = Gravity.CENTER
        return b
    }

    private fun secondaryButton(label: String, onClick: () -> Unit): Button {
        val b = styledButton(label, Color.TRANSPARENT, border, textSecondary, onClick)
        b.gravity = Gravity.CENTER
        return b
    }

    private fun keyButton(label: String, weight: Float, onClick: () -> Unit): Button {
        val b = Button(service)
        b.text = label
        b.isAllCaps = false
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        b.setTextColor(textPrimary)
        b.background = pressable(surface, border)
        b.gravity = Gravity.CENTER
        val lp = LinearLayout.LayoutParams(0, dp(52), weight)
        lp.setMargins(dp(4), dp(4), dp(4), dp(4))
        b.layoutParams = lp
        b.setOnClickListener { v ->
            try { v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) } catch (e: Exception) { /* optional */ }
            onClick()
        }
        return b
    }

    private fun inputRow(hint: String, sensitive: Boolean, numeric: Boolean): LinearLayout {
        val row = LinearLayout(service)
        row.orientation = LinearLayout.VERTICAL
        if (hint.isNotEmpty()) {
            row.addView(text(hint, 15, textSecondary, center = true).apply { setPadding(0, 0, 0, dp(10)) })
        }

        val digitsOnly: Boolean = sensitive || numeric
        val field = EditText(service)
        field.setTextColor(textPrimary)
        field.setHintTextColor(textSecondary)
        field.background = pill(surface, border)
        field.setPadding(dp(16), dp(14), dp(16), dp(14))
        field.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        field.setSingleLine()
        if (digitsOnly) {
            // Filled by the keypad below; the phone keyboard is never needed.
            field.inputType = InputType.TYPE_CLASS_NUMBER
            field.setShowSoftInputOnFocus(false)
            field.isFocusable = false
            field.isCursorVisible = false
            if (sensitive) field.transformationMethod = PasswordTransformationMethod.getInstance()
        } else {
            field.inputType = InputType.TYPE_CLASS_TEXT
        }
        row.addView(field, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val keys: List<List<String>> = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("*", "0", "#")
        )
        for (keyRow in keys) {
            val line = LinearLayout(service)
            line.orientation = LinearLayout.HORIZONTAL
            for (k in keyRow) {
                line.addView(keyButton(k, 1f) { field.append(k) })
            }
            row.addView(line, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }

        val last = LinearLayout(service)
        last.orientation = LinearLayout.HORIZONTAL
        last.addView(keyButton("⌫", 1f) {
            val cur: String = field.text.toString()
            if (cur.isNotEmpty()) field.setText(cur.substring(0, cur.length - 1))
            field.setSelection(field.text.length)
        })
        last.addView(keyButton("Send", 2f) {
            val v: String = field.text.toString().trim()
            if (v.isNotEmpty()) send(v)
        })
        row.addView(last, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        return row
    }
}
