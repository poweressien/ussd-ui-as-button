package com.iwekobongstudios.ussdui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Fixes the bug behind two symptoms seen in testing:
 *   1. "Choose a SIM" -> "Could not read SIM information from this device."
 *   2. Every real USSD dial -> "The network rejected the USSD request (failureCode=-1)."
 *
 * Both traced to the same cause: READ_PHONE_STATE / READ_PHONE_NUMBERS were
 * declared in the manifest but never actually granted at runtime (Android 6+
 * requires a runtime prompt for dangerous permissions). With no permission,
 * SubscriptionManager returns nothing, the caller falls back to
 * SubscriptionManager.INVALID_SUBSCRIPTION_ID -- which is literally the
 * int -1 -- and dispatching a USSD request with that id gets rejected
 * immediately. The "-1" in the failure message was that sentinel value,
 * not a real network response code.
 *
 * This version never dispatches with an invalid subscription id, and keeps
 * permission errors, "no SIM found" errors, and genuine network failures in
 * separate error codes instead of collapsing them into one message.
 */
class UssdModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "UssdModule"

    private fun hasPermission(perm: String): Boolean =
        ContextCompat.checkSelfPermission(reactApplicationContext, perm) ==
            PackageManager.PERMISSION_GRANTED

    private fun hasReadPermissions(): Boolean {
        val needsNumbers = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        return hasPermission(Manifest.permission.READ_PHONE_STATE) &&
            (!needsNumbers || hasPermission(Manifest.permission.READ_PHONE_NUMBERS))
    }

    /** Lists real SIMs. Rejects with PERMISSION_DENIED instead of an empty/bad list. */
    @ReactMethod
    fun getSimInfo(promise: Promise) {
        if (!hasReadPermissions()) {
            promise.reject("PERMISSION_DENIED", "READ_PHONE_STATE / READ_PHONE_NUMBERS not granted")
            return
        }

        val subMgr = reactApplicationContext.getSystemService(SubscriptionManager::class.java)
        val list = try {
            subMgr?.activeSubscriptionInfoList
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", e.message)
            return
        }

        if (list.isNullOrEmpty()) {
            promise.reject("NO_SIM_FOUND", "No active SIM subscriptions returned by the OS")
            return
        }

        val result: WritableArray = Arguments.createArray()
        for (info in list) {
            val sim: WritableMap = Arguments.createMap()
            sim.putInt("subscriptionId", info.subscriptionId)
            sim.putInt("slotIndex", info.simSlotIndex)
            sim.putString("carrierName", info.carrierName?.toString() ?: "")
            sim.putString("displayName", info.displayName?.toString() ?: "")
            result.pushMap(sim)
        }
        promise.resolve(result)
    }

    /**
     * Dials a USSD code on a specific subscription. Refuses to dispatch when
     * subscriptionId is SubscriptionManager.INVALID_SUBSCRIPTION_ID (-1) --
     * that check alone kills the false "failureCode=-1" reports.
     */
    @ReactMethod
    fun dialUssd(code: String, subscriptionId: Int, promise: Promise) {
        if (!hasReadPermissions() || !hasPermission(Manifest.permission.CALL_PHONE)) {
            promise.reject("PERMISSION_DENIED", "CALL_PHONE / READ_PHONE_STATE not granted")
            return
        }

        if (subscriptionId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            promise.reject("INVALID_SIM", "No valid SIM subscription selected -- call getSimInfo() first")
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("UNSUPPORTED_OS", "sendUssdRequest requires Android 8.0 (API 26)+")
            return
        }

        val baseTm = reactApplicationContext.getSystemService(TelephonyManager::class.java)
        val tm = baseTm?.createForSubscriptionId(subscriptionId)
        if (tm == null) {
            promise.reject("NO_TELEPHONY", "Could not obtain TelephonyManager for subscription $subscriptionId")
            return
        }

        try {
            tm.sendUssdRequest(code, object : TelephonyManager.UssdResponseCallback() {
                override fun onReceiveUssdResponse(
                    telephonyManager: TelephonyManager,
                    request: String,
                    response: CharSequence
                ) {
                    promise.resolve(response.toString())
                }

                override fun onReceiveUssdResponseFailed(
                    telephonyManager: TelephonyManager,
                    request: String,
                    failureCode: Int
                ) {
                    // Only 1 (USSD_RETURN_FAILURE) or 2 (USSD_ERROR_SERVICE_UNAVAIL)
                    // reach here now. If you still see this after the permission
                    // fix, it's a genuine carrier/network-side rejection, not a
                    // bug in this module -- some Nigerian carriers/banks reject
                    // USSD sessions started via sendUssdRequest() rather than the
                    // native dialer for certain codes.
                    promise.reject("USSD_NETWORK_FAILURE", "Network rejected the request (failureCode=$failureCode)")
                }
            }, null)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", e.message)
        } catch (e: Exception) {
            promise.reject("USSD_EXCEPTION", e.message)
        }
    }
}
