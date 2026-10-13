# USSD-UI

© 2026 iWEKOBONGstudios. All rights reserved. · [License](LICENSE) · [Copyright](COPYRIGHT.md) · [Ownership](OWNERSHIP.md) · [Privacy Policy](PRIVACY-POLICY.md) · [Terms of Use](TERMS-OF-USE.md) · [Third-party notices](NOTICE.md)

A visual button/form UI layer over carrier USSD services on Android — a
"Truecaller for USSD." You dial a code like `*894#` and instead of reading
raw numbered text and typing digits back, you get real buttons, real input
fields, and a real confirm screen — generated live from whatever the network
actually sends back, never hand-authored per menu.

This is **not** a dialer replacement, **not** a new USSD protocol, and does
**not** require any carrier-side changes. It uses Android's own public
`TelephonyManager.sendUssdRequest()` API to talk to real USSD services where
the device/carrier/API allows it, and a full offline demo mode for
everything else (development, screenshots, testing without a SIM).

**Read `docs/ANDROID-USSD-LIMITATIONS.md` before you build on this.** The
short version: dialing a code and showing the first response works
reliably. Replying to continue a multi-step session does not work reliably
through any public Android API on most devices — this app is honest about
that in the UI itself rather than faking it.

## How it works

```
User enters *894#
        │
React Native UI  ──calls──▶  Kotlin native bridge (UssdModule.kt)
                                      │
                            TelephonyManager.sendUssdRequest()
                                      │
                               Mobile network / USSD service
                                      │
                            UssdResponseCallback (raw text)
                                      │
React Native  ◀──event──  UssdModule.kt
        │
UssdParser (GenericParser + carrier/service overrides)
        │
Structured ScreenMessage
        │
UssdScreen + UssdButton/UssdInput/UssdConfirm/...
```

Full breakdown of every layer: `docs/ARCHITECTURE.md`. Parser internals:
`docs/PARSER-DESIGN.md`. Everything Android-API-specific:
`docs/ANDROID-USSD-LIMITATIONS.md`.

## Three transport modes

Chosen in Settings. All three run through the exact same
`UssdSessionManager` → `UssdParser` → UI pipeline — only the transport
underneath changes (`src/transport/UssdTransport.ts`):

- **Demo Mode** (`MockUssdTransport`) — fully scripted, offline, no SIM or
  network involved. Dialing `*894#` walks the full flow: menu → Transfer →
  enter account number → enter amount → confirm → success. Any other code
  gets a small generic fallback menu. This is what `tests/flow/` exercises.
- **Real USSD — Direct API** (`NativeUssdTransport`) — talks to the actual
  Kotlin bridge and a real modem via `TelephonyManager.sendUssdRequest()`.
  Requires Android 8.0+, the `CALL_PHONE` permission, and a working SIM.
  Starting a session is fully supported; replying to continue one is not,
  by default (see `docs/ANDROID-USSD-LIMITATIONS.md`, and the "Experimental
  re-dial" toggle in Settings if you want to test the best-effort fallback
  yourself). **Some devices/OEM builds block this outright for third-party
  apps regardless of permissions** — confirmed on at least one real Xiaomi
  device — which is exactly what the third mode exists for.
- **Real USSD — Accessibility Mode** (`AccessibilityUssdTransport`) — drives
  the phone's own USSD dialog instead of calling the direct API at all, for
  devices where that API is blocked. Needs the same `CALL_PHONE` permission
  plus a separately, manually granted Accessibility permission. This is the
  newest, least-tested part of the whole project — **read
  `docs/ACCESSIBILITY-TRANSPORT.md` in full before relying on it**; it was
  never compiled or run against a real device in this build's environment.

## Android API requirements

- **minSdkVersion 24**, but USSD itself needs **API 26 (Android 8.0)** —
  `startUssdSession` checks this at runtime and reports a clear error on
  older devices rather than crashing.
- Permissions: `android.permission.CALL_PHONE` (required — this is what
  `sendUssdRequest` needs), `android.permission.READ_PHONE_STATE` (optional
  — only needed to show real SIM/carrier names in the SIM selector; the app
  works without it).
- A physical device or emulator with a working SIM/USSD service for real
  mode. Emulators generally don't have real USSD service — use demo mode on
  an emulator, real mode on a physical phone.

## SIM requirements

Multi-SIM devices are supported via `TelephonyManager.createForSubscriptionId()`
(`SimUtils.kt` / `UssdModule.getSimSlots()`). No SIM is hardcoded anywhere —
slot selection happens in the SIM Selector screen and is passed through to
every session start.

## Known limitations

Summarized here; full detail in `docs/ANDROID-USSD-LIMITATIONS.md`:

- Multi-step interactive sessions are not reliably supported by the public
  API on most devices — single dial/response is.
- Behavior varies by OEM and carrier; nothing here was verified against a
  real device in the environment this was built in (no Android
  SDK/emulator/device was available — see "What we deliberately did not
  verify" in the limitations doc).
- The Kotlin has not been compiled — it's written to match the documented
  APIs and a real, current RN 0.87 Android scaffold (see below), but you
  need Android Studio to actually confirm it builds.
- Carrier profiles (`src/profiles/`) ship with placeholder codes and no
  parsing rules — they're real, registered `CarrierProfileParser`s, just
  with nothing carrier-specific in them yet. See `docs/PARSER-DESIGN.md`.

## Project structure

```
src/
  components/     UssdScreen, UssdButton, UssdInput, UssdSelect, UssdConfirm,
                  UssdLoading, UssdError, UssdSuccess, UssdNavigation,
                  RawResponsePanel
  screens/        HomeScreen, UssdSessionScreen, SimSelectorScreen,
                  SettingsScreen, DeveloperScreen
  navigation/     RootNavigator.tsx (lightweight Context-based stack)
  engine/         UssdSessionManager.ts, FlowEngine.ts, UssdParser.ts,
                  GenericParser.ts, ParserPlugin.ts, ScreenMapper.ts
  transport/      UssdTransport.ts, MockUssdTransport.ts, NativeUssdTransport.ts
  state/          ussdStore.ts, settingsStore.ts, deviceStore.ts (Zustand)
  profiles/       ProfileManager.ts, mtn-ng.ts, airtel-ng.ts, glo-ng.ts,
                  nine-mobile-ng.ts
  types/          ussd.ts
  utils/          secureLogger.ts, redact.ts
  theme.ts

android/app/src/main/java/com/iwekobongstudios/ussdui/
  UssdModule.kt           React Native bridge — the methods JS calls
  UssdPackage.kt          Registers UssdModule with React Native
  UssdResponseHandler.kt  Wraps TelephonyManager.UssdResponseCallback
  UssdSessionManager.kt   Native-side "is a request in flight" guard
  SimUtils.kt             Multi-SIM subscription lookups
  MainApplication.kt      Standard RN app host + UssdPackage registration
  MainActivity.kt         Standard RN activity

tests/
  parser/    genericParser, malformed, carrierProfileParser
  session/   sessionState (FlowEngine), timeout (UssdSessionManager)
  flow/      mockFlow.integration (full start→response→button→input→
             response→next-screen walkthrough)

docs/
  ARCHITECTURE.md
  ANDROID-USSD-LIMITATIONS.md
  PARSER-DESIGN.md
```

## Setup

```bash
npm install
npm test          # 49 tests — parser, session state, timeout, full mock flow
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (matches @react-native/eslint-config)
```

All of the above run without Android Studio or a device — they exercise the
TypeScript engine layer only (see "How the tests run without a device"
below).

## Android build instructions

You'll need Android Studio (or the Android SDK + a JDK) installed — this
project was built in an environment with neither, so the steps below have
not been run end-to-end. The `android/` directory here was seeded from a
real, current `@react-native-community/cli@20.2.0` / React Native 0.87.0
scaffold (gradle wrapper, `build.gradle` files, resources, `MainApplication.kt`
/ `MainActivity.kt` all copied from an actually-generated project, not
written from memory) with the USSD-specific Kotlin files and permissions
added on top. If anything doesn't match what your installed toolchain
expects, regenerate a fresh scaffold (`npx @react-native-community/cli init`)
and diff against it — the only intentional additions on top of a stock
template are:

- `CALL_PHONE` / `READ_PHONE_STATE` in `AndroidManifest.xml`
- `UssdModule.kt`, `UssdPackage.kt`, `UssdResponseHandler.kt`,
  `UssdSessionManager.kt`, `SimUtils.kt`
- One line in `MainApplication.kt`: `add(UssdPackage())`

To build:

```bash
cd android
./gradlew assembleDebug
# APK lands in android/app/build/outputs/apk/debug/app-debug.apk
```

Or open `android/` in Android Studio and hit Run.

## Physical-device testing instructions

1. Enable Developer Options + USB debugging on the phone, connect it, confirm
   `adb devices` sees it.
2. `npm run android` (or install the APK from the step above manually).
3. In the app: **Settings → Real USSD**, pick your SIM in **SIM Selector**.
4. Grant the `CALL_PHONE` permission when prompted.
5. On Home, dial a real code for your carrier (start with something known
   to work, e.g. a balance-check code). This is the spec's "first real
   test" milestone: raw response should appear (Developer Mode →
   raw-response panel), and it should render as tappable buttons.
6. Tapping a button/submitting a field will surface
   `UNSUPPORTED_CONTINUATION` unless you've turned on the experimental
   re-dial toggle — this is expected, not a bug. See
   `docs/ANDROID-USSD-LIMITATIONS.md`.

## How the tests run without a device

`tests/` only exercises the TypeScript engine (`GenericParser`, `FlowEngine`,
`UssdSessionManager`, `MockUssdTransport`) — none of it needs a real device,
emulator, or even React Native's runtime. `NativeUssdTransport` and
`UssdSessionManager` import from `react-native` and
`@react-native-async-storage/async-storage`; those are given minimal manual
Jest mocks (`__mocks__/react-native.js`,
`__mocks__/@react-native-async-storage/async-storage.js`) that mirror what a
real device without the native module linked looks like, so tests exercise
real fallback paths, not fictional ones. `jest.config.js` runs this suite
under plain `ts-jest` + node. If you add component-rendering tests later,
use `@react-native/jest-preset` (already a devDependency) with
`@testing-library/react-native` instead of this config.

## Security

- **Never logged, by `secureLogger`'s design**: PINs, OTPs, passwords,
  account numbers, amounts (`src/utils/redact.ts` redacts these patterns
  before anything reaches `console.*`).
- **Never sent to autofill**: PIN/OTP fields (`UssdInput.tsx`) set
  `autoComplete="off"` and `importantForAutofill="no"`.
- **Never logged natively**: `UssdResponseHandler.kt` passes response text
  straight from the callback into the event emitted to JS — it never calls
  `Log.*` with it.
- **Raw responses are not persisted** across sessions unless you explicitly
  turn on "Persist raw responses" in Settings (off by default) — the
  raw-response debug panel only shows the *current* session's screens.
- USSD input values themselves (what you actually type — a PIN, an account
  number) are only ever sent to the transport; they are not stored in
  `ussdStore`'s history, only the parsed `ScreenMessage`s are.

## Every native Android component, briefly

- **`UssdModule.kt`** — the React Native bridge. Exposes
  `startUssdSession`, `sendUssdInput`, `cancelUssdSession`,
  `getSessionState`, `getSimSlots` to JS; requests `CALL_PHONE` at runtime;
  calls `TelephonyManager.sendUssdRequest()`; emits `UssdUI:onResponse` /
  `UssdUI:onError` / `UssdUI:onSessionEnded` events.
- **`UssdPackage.kt`** — the `ReactPackage` that registers `UssdModule` —
  wired into `MainApplication.kt`.
- **`UssdResponseHandler.kt`** — wraps
  `TelephonyManager.UssdResponseCallback`, mapping Android's failure codes
  (`USSD_RETURN_FAILURE`, `USSD_ERROR_SERVICE_UNAVAIL`) to this app's error
  taxonomy. Never logs raw response text.
- **`UssdSessionManager.kt`** — native-side guard ensuring only one
  `sendUssdRequest()` is ever in flight at once (Android allows exactly
  one, device-wide).
- **`SimUtils.kt`** — `SubscriptionManager` helpers for listing active SIMs
  and resolving a slot index to a subscription ID, used for multi-SIM
  support.
- **`MainApplication.kt`** / **`MainActivity.kt`** — standard React Native
  application/activity shells (unmodified from the current RN template
  except for the one `UssdPackage()` registration line).
# ussd-ui-as-button
