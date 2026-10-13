// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers UssdModule and UssdAccessibilityModule with React Native. Add
 * this package in MainApplication's getPackages() override — see README
 * "Android build instructions."
 */
class UssdPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(UssdModule(reactContext), UssdAccessibilityModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
