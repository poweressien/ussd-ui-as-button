# Dialling from the regular Phone app (v12)

Android's "default dialer" role would replace the whole Phone app and Google restricts it, so USSD-UI does not use it.
Instead the Accessibility service (already user-enabled) watches for the phone's own USSD pop-up:

1. A new pop-up appears from the telephony package (`com.android.phone` family; never a dialer / in-call screen) built from the standard AlertDialog parts, while the setting "Catch codes dialled from the Phone app" is on.
2. The service arms itself and puts the loading cover over the pop-up straight away.
3. If the app UI is running it receives the dialog and shows buttons. If not, the service launches the app, which takes over the pop-up on start (`consumePendingAdopt`). If the app is too slow (3.5 s) the cover turns into a native "Open USSD-UI / Show phone's own screen" prompt.
4. Replies go through the same path as app-dialled sessions.

Caveats: Android 10+ limits starting activities from the background; the native prompt (one tap) is the fallback. Xiaomi may need "Display pop-up windows while running in the background" for USSD-UI. Dialling from another app does not carry a code, so a Phone-app session shows no code in its header.
