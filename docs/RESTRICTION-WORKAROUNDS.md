# Getting USSD through when Android/OEMs restrict third-party apps

Every route an ordinary (non-system, non-carrier) app has, in the order
`AutoUssdTransport` tries them. Nothing here is a hack around Android's
security model: each channel is a public API or a user-granted permission.

| # | Channel | How | Needs | Works when | Fails when |
|---|---------|-----|-------|-----------|-----------|
| 1 | **DIRECT** | `TelephonyManager.sendUssdRequest()` | CALL_PHONE (+READ_PHONE_STATE for SIM 2) | Stock Android, many OEMs; single-shot codes (`*310#`) | OEM/carrier blocks the API (failureCode -1 / no callback); free-text replies mid-menu |
| 2 | **ACCESSIBILITY** | `ACTION_CALL` to the system, service reads/types into the system's own dialog | User turns the service on once in Settings | The direct API is blocked; real multi-step menus | OEM dialog layout not recognised; user declines the permission |
| 3 | **ASSISTED** | `ACTION_DIAL` with the code pre-filled; user presses call | Nothing | Every phone | Not integrated: the reply shows in the system dialog, not in the app (unless #2 is on) |

## What Auto mode does

- **Failover at start.** If DIRECT is rejected before any response, ACCESSIBILITY is tried; if that is off, the dialer is opened (ASSISTED) with an explanation and a button to enable Accessibility.
- **Replay on continuation failure.** The direct API can usually carry a 1-digit reply but often not free text (phone numbers, amounts, PINs). When a reply is rejected and Accessibility is on, the app re-dials through Accessibility, silently replays the earlier inputs, then sends the rejected one. The UI only sees the final screen.
- **Remembers what worked** for a week (`lastWorkingChannel`), so a phone that blocks DIRECT skips it next time.

## Bugs fixed in this revision (they blocked multi-step flows entirely)

1. `UssdSessionManager.kt` ended the session on every response and nulled the telephony handle, so every reply failed with "no active session". A response now leaves the session `OPEN`.
2. A request whose callback never arrives (some OEMs drop it) wedged the module with `SESSION_ALREADY_ACTIVE` forever; in-flight requests now expire after 35 s.
3. SIM 1 was dialled via the default telephony manager, which is wrong whenever the default voice SIM is SIM 2. Every SIM now resolves through its subscription id.
4. The Accessibility dial ignored the chosen SIM; it now passes a `PhoneAccountHandle`.
5. `READ_PHONE_STATE` was never requested, so the SIM picker was permanently empty; it is requested with CALL_PHONE.
6. The accessibility service only accepted a few package names and only looked at the "active" window. It now scans all interactive windows and accepts any non-keyboard/launcher/SystemUI package **while armed**.

## Privacy / Play policy posture of the accessibility service

The service is **armed only by a dial the user started** (45 s window, extended while the conversation continues) and ignores every event otherwise. It never reads our own UI, keyboard, launcher or SystemUI. Inputs replayed by Auto mode (which can include PINs) live in JS memory only, and are wiped on cancel/new session. Do not set `isAccessibilityTool="true"`: this app is not an accessibility tool and Play may reject the claim. Read Google's accessibility policy before publishing; a clear in-app disclosure is required.

## Other means, not implemented (and why)

- **Default-dialer role (`RoleManager.ROLE_DIALER`)**: gives Telecom privileges and an `InCallService`, but makes the app the user's phone app. Contradicts "not a dialer replacement".
- **Carrier-privileged / system app / signed with platform key**: not available to ordinary apps. A carrier partnership (MTN/Airtel/Glo/9mobile) that whitelists the app is the only clean route to a *guaranteed* channel.
- **ADB / Shizuku grants**: can lift some OEM restrictions on a developer's own phone, not on user devices. Useful for debugging a blocked model.
- **Overlay to hide the system dialog** (`TYPE_ACCESSIBILITY_OVERLAY`): cosmetic polish for channel 2, a good next step once real-device dialogs are mapped.
- **Composed one-shot dial strings** (`*894*1*0803…*5000#`) over DIRECT: works on any phone where DIRECT works, for paths you have verified. Encode them as service profiles.
- **Carrier HTTP/SMS/app APIs** for the same services: the most robust long-term path for specific services (banking, airtime), outside USSD.

## What must be tested on real phones (nothing here was compiled)

No Android SDK was available when this was written: the Kotlin has not been compiled, and the AOSP behaviour above (1-digit replies, dialog structure) is from reading the platform's design, not from running it. Build, then on each target phone/SIM: run `*310#` (single-shot) in DIRECT, then a 2-step menu in Auto. Developer → Diagnostics shows the info to report if a model misbehaves (OEM, API level, permissions, accessibility state). The most likely first fix on a new OEM is `isCandidatePackage()` / `collect()` in `UssdAccessibilityService.kt`.

## v3: why the app showed a menu as plain text and no buttons (from real-device screenshots)

1. **Class-name detection missed OEM dialogs.** Dialogs with a reply box use the OEM's own widget classes, so the reader never saw them (the plain "OK" dialog matched by luck). Detection is now property-based: editable = reply field, clickable short text = button, other text = message.
2. **The phone's USSD dialog is a modal system window.** It sits above every app and swallows touches, so buttons drawn by the app underneath can never be tapped. `UssdOverlay.kt` draws a full-screen accessibility overlay above it with real buttons from the parsed screen; a tap types the choice into the hidden dialog and presses Send. Cancel is always present and a 90 s watchdog removes the overlay.
3. **Direct attempts that hang.** Some OEM builds show the system dialog even for a direct request and never call back. The accessibility reader is now armed before the direct attempt, and its responses are adopted even while "direct" is still active.
4. **Reply typing** retries, falls back to click-then-set and clipboard paste, and presses Send by label with retries.
5. **Diagnostics.** Developer → Trace / Dump screen shows what the reader saw (structure and text lengths only, never message content).

Toggle: Settings → Display → "Buttons over the phone's USSD pop-up".

## v4 — from the 11 on-device screenshots (HyperOS, Android 16)

**Why some codes work and some don't.** `sendUssdRequest()` only returns one-shot answers. An interactive menu leaves the network dialogue open, and Android reports that as `failureCode=-1` (the text is discarded). So `*123#` style menus fail on the direct API on every phone; only reading the phone's own dialog (Accessibility) can carry them. Auto does that automatically.

**Bugs fixed**
- Every dial created a new transport and the old ones kept their native listeners, so one tap was sent N times. The 2nd..Nth found the dialog gone: "Could not find that control". Old transports are now disposed; stale taps are ignored.
- The parser dropped the body of prompts, leaving a blank "Carrier info" box. Body text is always shown; the dialog's own title line is stripped; options like `1.Balance`, `(2) Data`, `1.A 2.B` parse.
- A previous session's buttons stayed on screen. Arming a session and every new dialog now clears the overlay.
- The answered dialog (and the "USSD code running…" interstitial) were re-reported as new replies. A stale-dialog guard ignores them until the dialog changes or disappears.
- typeAndSubmit waits up to 2.5 s for the dialog, never presses Send on a newer dialog, and dumps the tree structure into the Trace when it fails.
- The overlay now covers the status-bar strip too.

## v5
- Auto goes straight to Accessibility when it is on (the direct API can't return menus; trying it first only delayed the buttons). Direct is the fallback.
- The overlay uses an on-screen keypad for number entry (no dependence on the phone keyboard), re-adds itself if the system drops the window, logs add failures, and turns a hung "Sending…" into a "No reply" screen after 25 s.
- Parser reads sentence-style menus ("Press 1 for X, 2 for Y").
- Developer → Share report sends the trace, dialog structure and the last few menu texts, so unknown phone layouts can be fixed from data.

## v7 - "switched on" is not "running"

Android keeps the Accessibility switch ON after an app update/reinstall (and MIUI/HyperOS after the app is killed) while the service itself is not running. Then nothing can be read or drawn. v7 asks the service itself (OFF / STALE / CONNECTED), refuses to dial when STALE and tells the person to switch USSD-UI off and on. Developer screen shows the status and a build stamp.

## v8 - the freeze

A floating widget (screen recorder timer) was read as a "USSD dialog" ~10x/second, re-rendering the cover screen in a loop and freezing the phone. The reader now only accepts the phone/telecom/dialer packages, scans at most ~4x/second, and an already-showing cover is never re-rendered. Parser: bare-number lines ("4 10GB @N3000"), "* Next", and closing messages ("Sorry...", "Thank you") no longer become an empty reply box.

## v9 - home screen

Real dial pad, SIM chooser sheet on every dial when 2+ SIMs are active, quick codes by category plus user-saved codes ("Mine", hold to remove), and a bordered strip behind the status bar.

## v10 - "malfunctioning" after closing the app

Closing/swiping the app on MIUI/HyperOS kills its process; Android then flags the Accessibility service as malfunctioning until the switch is toggled. The app now toggles it itself on launch and on return to the front IF granted WRITE_SECURE_SETTINGS once:

    adb shell pm grant com.iwekobongstudios.ussdui android.permission.WRITE_SECURE_SETTINGS

(on Xiaomi also enable Developer options -> "USB debugging (Security settings)"). Without it, a banner on Home explains the manual off/on. Codes are never refused: if the service is down they dial through the direct API, then ACTION_CALL on the chosen SIM (phone's own screen, no buttons).
Also on Xiaomi: App info -> Autostart ON, Battery saver -> No restrictions, lock the app in Recents.
