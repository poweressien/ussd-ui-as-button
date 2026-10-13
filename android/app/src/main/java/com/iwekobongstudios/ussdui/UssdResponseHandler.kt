// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.telephony.TelephonyManager

/**
 * Wraps TelephonyManager.UssdResponseCallback so UssdModule doesn't need an
 * inline anonymous object at every call site, and so the mapping from
 * Android's failureCode to our error taxonomy lives in exactly one place.
 *
 * SECURITY: this class deliberately never calls android.util.Log (or any
 * other logging) with the raw response/request text. The only place USSD
 * text goes is straight into the onResponse callback supplied by the
 * caller, which UssdModule wires directly to the React Native event
 * emitter — the same "never log the raw payload" rule the TypeScript side
 * follows in src/utils/secureLogger.ts. See section 15 of the project spec.
 */
class UssdResponseHandler(
    private val onResponse: (response: String) -> Unit,
    private val onFailure: (errorCode: String, failureCode: Int) -> Unit
) : TelephonyManager.UssdResponseCallback() {

    override fun onReceiveUssdResponse(telephonyManager: TelephonyManager, request: String, response: CharSequence) {
        onResponse(response.toString())
    }

    override fun onReceiveUssdResponseFailed(telephonyManager: TelephonyManager, request: String, failureCode: Int) {
        val errorCode = when (failureCode) {
            TelephonyManager.USSD_RETURN_FAILURE -> "USSD_RETURN_FAILURE"
            TelephonyManager.USSD_ERROR_SERVICE_UNAVAIL -> "USSD_ERROR_SERVICE_UNAVAIL"
            else -> "UNKNOWN"
        }
        onFailure(errorCode, failureCode)
    }
}
