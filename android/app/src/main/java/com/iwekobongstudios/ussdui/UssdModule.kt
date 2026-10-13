// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

private const val EVENT_RESPONSE = "UssdUI:onResponse"
private const val EVENT_ERROR = "UssdUI:onError"
private const val EVENT_SESSION_ENDED = "UssdUI:onSessionEnded"
private const val PERMISSION_REQUEST_CODE = 4821

/**
 * UssdModule
 * ----------
 * The one native module the JS side talks to (see
 * src/transport/NativeUssdTransport.ts). Every method here does the
 * smallest possible amount of work and reports back through events, because
 * USSD is inherently asynchronous — a Promise resolving just means "the
 * native call was made," not "here is the network's answer."
 *
 * WHAT THIS DOES: dial a USSD code via TelephonyManager.sendUssdRequest(),
 * relay its single response/failure back to JS, list SIM slots, track that
 * only one session runs at a time.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: pretend to continue an open USSD
 * dialog. sendUssdInput() only re-touches the telephony API when the caller
 * has explicitly opted into the experimental path (see below and
 * docs/ANDROID-USSD-LIMITATIONS.md) — by default it reports
 * UNSUPPORTED_CONTINUATION and stops, because the public API has no
 * supported way to reply into an already-open session on most devices.
 */
class UssdModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    PermissionListener {

    private val sessionManager = UssdSessionManager()
    private var pendingAfterPermission: (() -> Unit)? = null

    override fun getName(): String = "UssdModule"

    // -------------------------------------------------------------------
    // Event emission
    // -------------------------------------------------------------------

    private fun emit(eventName: String, params: Any?) {
        if (!reactContext.hasActiveCatalystInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun emitError(code: String, message: String, raw: String? = null) {
        val map: WritableMap = Arguments.createMap()
        map.putString("code", code)
        map.putString("message", message)
        if (raw != null) map.putString("raw", raw)
        emit(EVENT_ERROR, map)
    }

    // -------------------------------------------------------------------
    // startUssdSession
    // -------------------------------------------------------------------

    @ReactMethod
    fun startUssdSession(code: String, simSlot: Int, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            emitError(
                "NO_TELEPHONY",
                "TelephonyManager.sendUssdRequest() requires Android 8.0 (API 26) or higher. " +
                    "This device is running an older version — see docs/ANDROID-USSD-LIMITATIONS.md."
            )
            promise.resolve(null)
            return
        }

        // CALL_PHONE is mandatory. READ_PHONE_STATE is requested in the same
        // prompt so SIM-slot -> subscription resolution works (without it a
        // non-default SIM silently falls back to the default one).
        val needed = listOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE)
            .filter { !has(it) }
        if (needed.isEmpty()) {
            beginSession(code, simSlot, promise)
            return
        }
        requestPermissions(needed.toTypedArray()) {
            if (has(Manifest.permission.CALL_PHONE)) {
                beginSession(code, simSlot, promise)
            } else {
                emitError("PERMISSION_DENIED", "CALL_PHONE permission was not granted; USSD requests cannot be sent.")
                promise.resolve(null)
            }
        }
    }

    private fun has(permission: String): Boolean =
        ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED

    private fun requestPermissions(perms: Array<String>, then: () -> Unit) {
        val activity = reactApplicationContext.currentActivity
        if (activity !is PermissionAwareActivity) {
            emitError(
                "PERMISSION_DENIED",
                "No foreground activity available to request permissions from. Bring the app to the foreground and retry."
            )
            return
        }
        pendingAfterPermission = then
        activity.requestPermissions(perms, PERMISSION_REQUEST_CODE, this)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): Boolean {
        if (requestCode != PERMISSION_REQUEST_CODE) return false
        val then = pendingAfterPermission
        pendingAfterPermission = null
        then?.invoke()
        return true
    }

    private fun beginSession(code: String, simSlot: Int, promise: Promise?) {
        val telephonyManager = telephonyManagerForSlot(simSlot)
        if (telephonyManager == null) {
            emitError("NO_TELEPHONY", "Could not resolve a telephony service for SIM slot $simSlot on this device.")
            promise?.resolve(null)
            return
        }

        if (!sessionManager.beginSession(code)) {
            emitError(
                "SESSION_ALREADY_ACTIVE",
                "A USSD session is already active. Only one session is allowed at a time — cancel it first."
            )
            promise?.resolve(null)
            return
        }
        sessionManager.bindTelephonyManager(telephonyManager)

        val handler = UssdResponseHandler(
            onResponse = { response ->
                sessionManager.recordResponse()
                emit(EVENT_RESPONSE, response)
            },
            onFailure = { errorCode, failureCode ->
                sessionManager.recordFailure()
                emitError(errorCode, "The network rejected the USSD request (failureCode=$failureCode).")
            }
        )

        try {
            telephonyManager.sendUssdRequest(code, handler, Handler(Looper.getMainLooper()))
            promise?.resolve(null)
        } catch (e: SecurityException) {
            sessionManager.endSession()
            emitError("PERMISSION_DENIED", "The system denied the USSD request: ${e.message}")
            promise?.resolve(null)
        } catch (e: Exception) {
            sessionManager.endSession()
            emitError("UNKNOWN", "Failed to start the USSD session: ${e.message}")
            promise?.resolve(null)
        }
    }

    // -------------------------------------------------------------------
    // sendUssdInput — see the class doc comment before changing this.
    // -------------------------------------------------------------------

    @ReactMethod
    fun sendUssdInput(input: String, promise: Promise) {
        val telephonyManager = sessionManager.activeTelephonyManager
        if (telephonyManager == null || !sessionManager.beginInput()) {
            emitError(
                "SESSION_ALREADY_ACTIVE",
                "There is no open USSD session to reply to (or a request is still in flight)."
            )
            promise.resolve(null)
            return
        }

        // A reply goes out through the same public API as the first dial.
        // Whether the carrier/modem treats it as a continuation of the open
        // dialog depends on the input shape and the device (1-2 digit
        // replies are routed as USSD "short codes" by the framework; longer
        // free-text replies such as phone numbers or amounts usually are
        // not). When it is rejected we report UNSUPPORTED_CONTINUATION and
        // the JS-side AutoUssdTransport falls back to the accessibility
        // channel by replaying the path. See docs/RESTRICTION-WORKAROUNDS.md.
        val handler = UssdResponseHandler(
            onResponse = { response ->
                sessionManager.recordResponse()
                emit(EVENT_RESPONSE, response)
            },
            onFailure = { _, failureCode ->
                sessionManager.recordFailure()
                emitError(
                    "UNSUPPORTED_CONTINUATION",
                    "The reply was rejected (failureCode=$failureCode). The direct API cannot continue this session here."
                )
            }
        )

        try {
            telephonyManager.sendUssdRequest(input, handler, Handler(Looper.getMainLooper()))
            promise.resolve(null)
        } catch (e: Exception) {
            sessionManager.endSession()
            emitError("UNKNOWN", "Failed to send follow-up input: ${e.message}")
            promise.resolve(null)
        }
    }

    // -------------------------------------------------------------------
    // cancelUssdSession / getSessionState
    // -------------------------------------------------------------------

    @ReactMethod
    fun cancelUssdSession(promise: Promise) {
        sessionManager.endSession()
        emit(EVENT_SESSION_ENDED, null)
        promise.resolve(null)
    }

    @ReactMethod
    fun getSessionState(promise: Promise) {
        promise.resolve(sessionManager.state.name)
    }

    // -------------------------------------------------------------------
    // Required by React Native's NativeEventEmitter for any module it wraps
    // (see src/transport/NativeUssdTransport.ts). These are intentionally
    // no-ops: we don't need to know when JS starts/stops listening, we just
    // need these to exist so the JS-side NativeEventEmitter doesn't warn.
    // -------------------------------------------------------------------

    @ReactMethod
    fun addListener(eventName: String) {
        // No-op — required by NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op — required by NativeEventEmitter.
    }

    // -------------------------------------------------------------------
    // getSimSlots
    // -------------------------------------------------------------------

    @ReactMethod
    fun getSimSlots(promise: Promise) {
        if (!SimUtils.hasReadPhoneStatePermission(reactContext)) {
            // Nothing else in the module requests this permission up front,
            // so ask here; otherwise the SIM picker is permanently empty.
            requestPermissions(arrayOf(Manifest.permission.READ_PHONE_STATE)) {
                if (SimUtils.hasReadPhoneStatePermission(reactContext)) {
                    resolveSimSlots(promise)
                } else {
                    promise.reject("PERMISSION_DENIED", "READ_PHONE_STATE permission is required to list SIM slots.")
                }
            }
            return
        }
        resolveSimSlots(promise)
    }

    private fun resolveSimSlots(promise: Promise) {
        val activeList = SimUtils.listActiveSubscriptions(reactContext)
        val result = Arguments.createArray()
        if (activeList == null) {
            promise.resolve(result)
            return
        }
        for (info in activeList) {
            val map: WritableMap = Arguments.createMap()
            map.putInt("slotIndex", info.simSlotIndex)
            map.putInt("subscriptionId", info.subscriptionId)
            map.putString("carrierName", info.carrierName?.toString() ?: "Unknown")
            map.putString("displayName", info.displayName?.toString() ?: "SIM ${info.simSlotIndex + 1}")
            // Phone number deliberately not read (extra permission, unreliable).
            result.pushMap(map)
        }
        promise.resolve(result)
    }

    // -------------------------------------------------------------------
    // getDeviceInfo — feeds the diagnostics panel so a failing device can be
    // reported precisely (OEM + Android version decide which channel works).
    // -------------------------------------------------------------------

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        val map: WritableMap = Arguments.createMap()
        map.putString("manufacturer", Build.MANUFACTURER ?: "")
        map.putString("brand", Build.BRAND ?: "")
        map.putString("model", Build.MODEL ?: "")
        map.putInt("sdkInt", Build.VERSION.SDK_INT)
        map.putString("release", Build.VERSION.RELEASE ?: "")
        map.putString(
            "securityPatch",
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Build.VERSION.SECURITY_PATCH ?: "" else ""
        )
        map.putBoolean("hasCallPhone", has(Manifest.permission.CALL_PHONE))
        map.putBoolean("hasReadPhoneState", has(Manifest.permission.READ_PHONE_STATE))
        map.putString("sessionState", sessionManager.state.name)
        promise.resolve(map)
    }

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    private fun telephonyManagerForSlot(simSlot: Int): TelephonyManager? {
        val baseManager = reactContext.getSystemService(TelephonyManager::class.java) ?: return null
        // Always resolve through the subscription id when we can. The old
        // shortcut "slot 0 -> default manager" was wrong whenever the
        // default voice SIM was in slot 1: picking SIM 1 dialed from SIM 2.
        val subscriptionId = SimUtils.subscriptionIdForSlot(reactContext, simSlot) ?: return baseManager
        return baseManager.createForSubscriptionId(subscriptionId)
    }
}
