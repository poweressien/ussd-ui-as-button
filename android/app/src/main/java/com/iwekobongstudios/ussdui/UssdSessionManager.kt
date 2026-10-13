// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.telephony.TelephonyManager

enum class NativeUssdSessionState {
    /** Nothing has happened yet. */
    IDLE,

    /** A request is in flight: sent to the modem, no response/failure yet. */
    ACTIVE,

    /**
     * A response came back and the dialog MAY still be open on the network
     * side (a menu waiting for a reply). The telephony handle is kept so a
     * follow-up reply can go through the same SIM. A new start() is still
     * allowed from here — it simply replaces the open session.
     */
    OPEN,

    /** Finished: failed, cancelled, or explicitly ended. */
    ENDED
}

/**
 * Minimal native-side session bookkeeping.
 *
 * All the interesting flow state (screen, step index, history) lives in
 * TypeScript — src/engine/UssdSessionManager.ts. This class answers one
 * native-side question: "is a request already in flight?" Android allows one
 * USSD request at a time per device, and firing a second while one is
 * outstanding is a guaranteed failure.
 *
 * BUG FIXED (v2): recordResponse() used to call endSession(), which nulled
 * activeTelephonyManager. Every reply to a menu then failed with "no active
 * session" before it ever reached the modem, so multi-step flows could never
 * get past the first screen. A response now moves the session to OPEN (handle
 * kept); only failures, cancel, and explicit end clear it.
 */
class UssdSessionManager {
    var state: NativeUssdSessionState = NativeUssdSessionState.IDLE
        private set

    var activeTelephonyManager: TelephonyManager? = null
        private set

    private var sequenceNumber: Int = 0
    private var activeCode: String? = null
    private var activeSince: Long = 0L

    /**
     * A request that never got a callback (some OEM builds drop the callback
     * silently when they block the API) must not wedge the module forever
     * with SESSION_ALREADY_ACTIVE. Past this age an in-flight request is
     * treated as dead.
     */
    private val STALE_AFTER_MS = 35_000L

    /** Returns false (and does nothing) if a request is currently in flight. */
    @Synchronized
    fun beginSession(code: String): Boolean {
        if (state == NativeUssdSessionState.ACTIVE &&
            System.currentTimeMillis() - activeSince < STALE_AFTER_MS
        ) return false
        state = NativeUssdSessionState.ACTIVE
        activeSince = System.currentTimeMillis()
        activeCode = code
        activeTelephonyManager = null
        sequenceNumber = 0
        return true
    }

    /** Mark a follow-up reply as in flight. False if one already is, or no session is open. */
    @Synchronized
    fun beginInput(): Boolean {
        if (state != NativeUssdSessionState.OPEN || activeTelephonyManager == null) return false
        state = NativeUssdSessionState.ACTIVE
        activeSince = System.currentTimeMillis()
        return true
    }

    @Synchronized
    fun bindTelephonyManager(telephonyManager: TelephonyManager) {
        activeTelephonyManager = telephonyManager
    }

    @Synchronized
    fun recordResponse() {
        sequenceNumber += 1
        // Keep the handle: the network may be waiting for a reply.
        state = NativeUssdSessionState.OPEN
    }

    @Synchronized
    fun recordFailure() {
        endSession()
    }

    @Synchronized
    fun endSession() {
        state = NativeUssdSessionState.ENDED
        activeTelephonyManager = null
        activeCode = null
    }

    fun currentSequenceNumber(): Int = sequenceNumber
}
