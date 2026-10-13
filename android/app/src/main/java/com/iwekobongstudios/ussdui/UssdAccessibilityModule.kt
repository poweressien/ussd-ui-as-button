// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule

private const val EVENT_DIALOG_TEXT = "UssdA11y:onDialogText"
private const val EVENT_OVERLAY_ACTION = "UssdA11y:onOverlayAction"

/**
 * UssdAccessibilityModule
 * ------------------------
 * Bridge between JS and UssdAccessibilityService. This module never reads
 * the screen itself — it only (a) starts a dial via Intent.ACTION_CALL,
 * which hands the code to Android's own MMI/USSD handling and brings up
 * the system's own dialog, and (b) relays simulated taps/text entry into
 * whatever UssdAccessibilityService detects in that dialog. See
 * docs/ACCESSIBILITY-TRANSPORT.md for what this mechanism can and can't
 * do, and why it exists at all.
 *
 * Requires android.permission.CALL_PHONE (same as the direct-API path) —
 * ACTION_CALL needs it too — plus the user manually enabling the
 * accessibility service in system Settings, which no app can do for
 * itself.
 */
class UssdAccessibilityModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    UssdAccessibilityListener {

    override fun getName(): String = "UssdAccessibilityModule"

    init {
        bindService()
    }

    /** (Re)attach to whichever service instance the OS is running right now. */
    private fun bindService(): UssdAccessibilityService? {
        val service = UssdAccessibilityService.instance
        service?.setListener(this)
        service?.setOverlayActionListener { kind, value ->
            if (reactContext.hasActiveCatalystInstance()) {
                val map = Arguments.createMap()
                map.putString("kind", kind)
                map.putString("value", value)
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_OVERLAY_ACTION, map)
            }
        }
        return service
    }

    override fun isReady(): Boolean = reactContext.hasActiveCatalystInstance()

    override fun onDialogText(message: String, hasInputField: Boolean, buttonLabels: List<String>) {
        if (!reactContext.hasActiveCatalystInstance()) return
        val map = Arguments.createMap()
        map.putString("message", message)
        map.putBoolean("hasInputField", hasInputField)
        val labels: WritableArray = Arguments.createArray()
        buttonLabels.forEach { labels.pushString(it) }
        map.putArray("buttonLabels", labels)
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_DIALOG_TEXT, map)
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        val expectedComponent = "${reactContext.packageName}/${UssdAccessibilityService::class.java.name}"
        val enabledServices = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty()
        val enabled = enabledServices.split(':').any { it.equals(expectedComponent, ignoreCase = true) }
        promise.resolve(enabled)
    }

    /**
     * The truth about the service, not just the Settings switch:
     *  OFF       - not enabled in system Settings
     *  STALE     - enabled in Settings but Android is not running it (common right after
     *              an app update/reinstall and on MIUI/HyperOS after the app is killed);
     *              nothing can be read or drawn until it is switched off and on again
     *  CONNECTED - running; arming, reading and the button overlay will work
     */
    @ReactMethod
    fun getAccessibilityStatus(promise: Promise) {
        val expectedComponent = "${reactContext.packageName}/${UssdAccessibilityService::class.java.name}"
        val enabledServices = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty()
        val enabled = enabledServices.split(':').any { it.equals(expectedComponent, ignoreCase = true) }
        if (!enabled) {
            promise.resolve("OFF")
            return
        }
        Thread {
            // Give a service that is just (re)starting a moment to connect.
            var waited = 0
            while (UssdAccessibilityService.instance == null && waited < 1500) {
                try { Thread.sleep(100) } catch (_: InterruptedException) { break }
                waited += 100
            }
            val connected = UssdAccessibilityService.instance != null
            if (connected) bindService()
            promise.resolve(if (connected) "CONNECTED" else "STALE")
        }.start()
    }

    /**
     * Self-repair for "This service is malfunctioning": Android marks the service dead when the
     * app's process is killed and only a switch off/on revives it. With WRITE_SECURE_SETTINGS
     * (one-time `adb shell pm grant`) the app does that off/on itself.
     * Resolves CONNECTED, STALE (tried, still not running) or NO_PERMISSION.
     */
    @ReactMethod
    fun repairService(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(reactContext, "android.permission.WRITE_SECURE_SETTINGS") ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.resolve("NO_PERMISSION")
            return
        }
        Thread {
            try {
                val cr = reactContext.contentResolver
                val comp = "${reactContext.packageName}/${UssdAccessibilityService::class.java.name}"
                val current = Settings.Secure.getString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
                val others = current.split(':').filter { it.isNotBlank() && !it.equals(comp, ignoreCase = true) }
                Settings.Secure.putString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, others.joinToString(":"))
                Thread.sleep(800)
                Settings.Secure.putString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, (others + comp).joinToString(":"))
                Settings.Secure.putInt(cr, Settings.Secure.ACCESSIBILITY_ENABLED, 1)
                var waited = 0
                while (UssdAccessibilityService.instance == null && waited < 5000) {
                    Thread.sleep(150)
                    waited += 150
                }
                val ok = UssdAccessibilityService.instance != null
                if (ok) bindService()
                promise.resolve(if (ok) "CONNECTED" else "STALE")
            } catch (e: Exception) {
                promise.resolve("STALE")
            }
        }.start()
    }

    /** "Catch codes dialled from the Phone app". Saved natively so the service keeps honouring it with the app closed. */
    @ReactMethod
    fun setPassiveCapture(enabled: Boolean, promise: Promise) {
        reactContext.getSharedPreferences(UssdAccessibilityService.PREFS, android.content.Context.MODE_PRIVATE)
            .edit().putBoolean(UssdAccessibilityService.PREF_PASSIVE, enabled).apply()
        UssdAccessibilityService.passiveCapture = enabled
        bindService()
        promise.resolve(null)
    }

    /** True once if the service caught a dialog dialled elsewhere and needed this app to take it over. */
    @ReactMethod
    fun consumePendingAdopt(promise: Promise) {
        bindService()
        promise.resolve(UssdAccessibilityService.instance?.consumePendingAdopt() ?: false)
    }

    @ReactMethod
    fun getBuildInfo(promise: Promise) {
        promise.resolve("v15 · tap feedback, legal docs")
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("UNKNOWN", "Could not open Accessibility settings: ${e.message}")
        }
    }

    /**
     * Dials through the system's own MMI handling and arms the service so it
     * reads the resulting dialog. Targets the chosen SIM via a
     * PhoneAccountHandle (the old version ignored the SIM choice entirely).
     * Falls back to ACTION_DIAL (user presses call) if CALL_PHONE is missing.
     */
    @ReactMethod
    fun startUssdViaDialer(code: String, simSlot: Int, promise: Promise) {
        val service = bindService()
        service?.arm()
        try {
            val canCall = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CALL_PHONE) ==
                PackageManager.PERMISSION_GRANTED
            val intent = Intent(
                if (canCall) Intent.ACTION_CALL else Intent.ACTION_DIAL,
                Uri.parse("tel:" + Uri.encode(code))
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            phoneAccountForSlot(simSlot)?.let { intent.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("UNKNOWN", "Could not start the dial: ${e.message}")
        }
    }

    /**
     * Last-resort "assisted" channel: opens the stock dialer with the code
     * pre-filled; the person presses the green call button. Needs no
     * permission and works on every Android phone. The response shows in the
     * system dialog (and is captured if the accessibility service is on).
     */
    @ReactMethod
    fun openDialerWithCode(code: String, promise: Promise) {
        bindService()?.arm()
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(code)))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("UNKNOWN", "Could not open the dialer: ${e.message}")
        }
    }

    /** Poll for the current dialog — covers OEMs that never fire the events we listen for. */
    @ReactMethod
    fun peekDialog(promise: Promise) {
        val d = UssdAccessibilityService.instance?.peekDialog()
        if (d == null) {
            promise.resolve(null)
            return
        }
        val map = Arguments.createMap()
        map.putString("message", d.message)
        map.putBoolean("hasInputField", d.hasInputField)
        val labels: WritableArray = Arguments.createArray()
        d.buttonLabels.forEach { labels.pushString(it) }
        map.putArray("buttonLabels", labels)
        promise.resolve(map)
    }

    private fun phoneAccountForSlot(slot: Int): PhoneAccountHandle? {
        if (!SimUtils.hasReadPhoneStatePermission(reactContext)) return null
        return try {
            val telecom = reactContext.getSystemService(TelecomManager::class.java) ?: return null
            val handles = telecom.callCapablePhoneAccounts
            val subId = SimUtils.subscriptionIdForSlot(reactContext, slot)
            if (subId != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val tm = reactContext.getSystemService(TelephonyManager::class.java)
                handles.firstOrNull { tm?.getSubscriptionId(it) == subId }?.let { return it }
            }
            if (subId != null) handles.firstOrNull { it.id == subId.toString() }?.let { return it }
            handles.getOrNull(slot)
        } catch (e: Exception) {
            null // never let SIM targeting break the dial itself
        }
    }

    /**
     * Arms the service WITHOUT dialling. AutoUssdTransport calls this before a
     * direct attempt: some OEM builds show the system USSD dialog even for
     * sendUssdRequest(), and the service must be listening when it appears.
     */
    @ReactMethod
    fun armService(promise: Promise) {
        val service = bindService()
        service?.arm()
        promise.resolve(service != null)
    }

    @ReactMethod
    fun setOverlayEnabled(enabled: Boolean, promise: Promise) {
        bindService()?.overlayEnabled = enabled
        promise.resolve(null)
    }

    /** Show the native button screen over the system dialog. [json] comes from overlayPayload.ts. */
    @ReactMethod
    fun showOverlay(json: String, promise: Promise) {
        UssdAccessibilityService.instance?.showOverlayScreen(json)
        promise.resolve(null)
    }

    @ReactMethod
    fun hideOverlay(promise: Promise) {
        UssdAccessibilityService.instance?.hideOverlay()
        promise.resolve(null)
    }

    /** End of session: dismiss an info dialog, drop the overlay, disarm. */
    @ReactMethod
    fun finishSession(promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.finishSession() ?: false)
    }

    @ReactMethod
    fun getTrace(promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.traceDump() ?: "service not running")
    }

    @ReactMethod
    fun getReport(includeText: Boolean, promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.report(includeText) ?: "service not running")
    }

    @ReactMethod
    fun dumpTree(promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.treeDump() ?: "service not running")
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun typeAndSubmit(value: String, promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.typeAndSubmit(value) ?: false)
    }

    @ReactMethod
    fun tapPositiveButton(promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.tapPositiveButton() ?: false)
    }

    @ReactMethod
    fun cancelDialog(promise: Promise) {
        promise.resolve(UssdAccessibilityService.instance?.cancelDialog() ?: false)
    }
}
