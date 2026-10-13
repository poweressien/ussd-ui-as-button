# Accessibility Transport

## Why this exists

The direct API (`TelephonyManager.sendUssdRequest()`, see
`docs/ANDROID-USSD-LIMITATIONS.md`) is not usable on every device. On at
least one real, tested Xiaomi/MIUI device, real USSD codes that work fine
through the stock Phone app were consistently rejected by the network layer
when dialled through the direct API from a third-party app — while the
exact same code, dialled by hand, worked. That's not a bug in this
codebase: it's confirmed to be part of a broader pattern. Google itself
shipped a real, dated platform change (Android 17 QPR2, mid-2026)
specifically restricting third-party apps' use of `sendUssdRequest()` for
call-forwarding-style codes, citing fraud prevention — the stated reasoning
is countering scams that trick people into forwarding their calls to an
attacker, who then intercepts bank OTP calls. That change doesn't target
plain balance/account-check codes directly, but it's a clear, official
signal of the direction every Android vendor is moving in for this exact
API, and OEMs like Xiaomi (whose core markets have seen heavy USSD/premium
fraud) are documented to go further than stock Android on exactly this kind
of restriction.

This transport exists for exactly that situation: a device where the
direct API is blocked for third-party apps, full stop, regardless of
permissions granted.

## How it works

Instead of calling `sendUssdRequest()`, `UssdAccessibilityModule` fires
`Intent.ACTION_CALL` with the USSD code as a `tel:` URI. Android's telephony
framework recognises the MMI-shaped string and routes it through its own
privileged MMI-handling path — the same one that runs when a person types a
code into the stock dialer by hand — which brings up the **system's own**
USSD dialog. `UssdAccessibilityService` (an `AccessibilityService`) watches
for that dialog appearing, reads its text and whether it has a reply field,
and — only when the JS layer asks it to — types into that field or taps a
button, exactly as a person would.

```
User taps Start
      │
Intent.ACTION_CALL (tel: URI)
      │
Android's own MMI/USSD handling (privileged, not this app's code)
      │
System's own USSD dialog appears
      │
UssdAccessibilityService reads it
      │
Same UssdParser → same UI as every other transport
      │
User taps a button in THIS app's UI
      │
UssdAccessibilityService types the reply into the SYSTEM dialog's
own field and taps its own Send button
```

Everything downstream of "raw text" — the parser, the screen mapping, every
component — is completely unchanged. This transport only replaces how the
raw text is obtained.

## What's structurally different from the direct API

The system's USSD dialog represents a multi-option menu as **one text body
plus one reply field** — Android does not render "1. Transfer / 2. Airtime"
as two separate buttons the way this app's own UI does. So when the user
taps "Transfer" in this app, what actually happens on the system dialog
side is: type `1` into its one field, tap its Send-equivalent button. This
is why `AccessibilityUssdTransport.sendInput()` doesn't try to find a button
matching the tapped option — there usually isn't one to find.

## Real limitations — read these before relying on this

- **No fixed resource IDs.** Every OEM (sometimes every carrier, on the
  same OEM) skins this dialog differently. Detection in
  `UssdAccessibilityService.findUssdDialog()` is a heuristic — a
  telephony-shaped package showing a text body and at least one button —
  not a guarantee. If it doesn't detect the dialog on a specific device,
  the fix is tuning `isTelephonyPackage()` and the node-matching logic in
  `collect()` against that device's actual accessibility tree, which
  requires a real device to inspect (e.g. with `uiautomatorviewer` or
  Android Studio's Layout Inspector) — this could not be done in the
  environment this was built in.
- **The user must manually enable the accessibility service.** No app can
  turn this on for itself — Android requires an explicit trip through
  system Settings, which is why `SettingsScreen` links there rather than
  trying to request it like a normal permission.
- **This is not compiled or tested against a real device or emulator in
  this project's build environment**, for the same reason as everything
  else native in this repo (see the top of `README.md`) — no Android
  SDK/toolchain was available here. This is the least-tested part of the
  entire codebase; treat it as a first draft to debug on a real device, not
  a finished feature.
- **Play Store implications are real.** `BIND_ACCESSIBILITY_SERVICE` is one
  of the most heavily scrutinised permissions on the platform. Read
  Google's accessibility-service policy before attempting to publish an app
  using this — a clear, honest in-app disclosure (which
  `accessibility_service_description` in `strings.xml` is written to
  satisfy) is necessary but may not be sufficient on its own.
- **Still fundamentally a single-shot-feeling interaction**, just routed
  differently — the underlying network/session behaviour documented in
  `docs/ANDROID-USSD-LIMITATIONS.md` (session timing, carrier-side
  reliability) applies here exactly as much as to the direct API. This
  transport changes *which door* the request goes through, not how USSD
  itself behaves once it's through that door.

## Setup

1. Settings → **Real USSD — Accessibility Mode**.
2. Tap **Open Accessibility Settings**, find USSD-UI in the list, turn it
   on. Android will show its own warning about what accessibility services
   can do in general — this is standard OS copy, not specific to this app.
3. Back in the app, tap **Check again** to confirm it registered.
4. Dial a code as normal.

If nothing happens after dialling, the most likely cause is the dialog
detection heuristic not matching this specific device's dialog layout — see
"Real limitations" above.
