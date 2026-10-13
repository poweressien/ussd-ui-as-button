// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
package com.iwekobongstudios.ussdui

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

/**
 * Matches the stock React Native 0.87 CLI template — verified by actually
 * scaffolding a throwaway project with `@react-native-community/cli@20.2.0`
 * in this environment rather than writing this from memory. The only
 * addition to the generated template is UssdPackage() below.
 */
class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(UssdPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
