// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat

/**
 * Small helpers around SubscriptionManager for multi-SIM lookups (spec
 * section 3). Reading subscription info requires READ_PHONE_STATE — every
 * function here fails closed (returns null / empty) rather than throwing
 * when that permission is missing, so a caller that forgot to check
 * permission first degrades gracefully instead of crashing.
 */
object SimUtils {

    fun hasReadPhoneStatePermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED

    /** All currently active SIM subscriptions, or null if we can't read them (permission/OEM restriction). */
    fun listActiveSubscriptions(context: Context): List<SubscriptionInfo>? {
        if (!hasReadPhoneStatePermission(context)) return null
        val subscriptionManager = context.getSystemService(SubscriptionManager::class.java) ?: return null
        return try {
            subscriptionManager.activeSubscriptionInfoList
        } catch (e: Exception) {
            // Deliberately broad, not just SecurityException: OEM skins (MIUI
            // in particular) are known to throw other exception types from
            // this exact call when they impose their own restrictions beyond
            // the standard Android permission model. Whatever the cause,
            // failing closed to null (→ an empty SIM list upstream) is always
            // the right behavior here — never let this crash or propagate an
            // opaque rejection the UI can't explain.
            null
        }
    }

    /** The subscription id bound to a given physical slot index (0, 1, ...), if resolvable. */
    fun subscriptionIdForSlot(context: Context, simSlot: Int): Int? =
        listActiveSubscriptions(context)?.firstOrNull { it.simSlotIndex == simSlot }?.subscriptionId
}
