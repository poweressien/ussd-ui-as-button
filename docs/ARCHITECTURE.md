# Architecture

## Layers

```
components/ + screens/     React Native UI — renders whatever ScreenMapper hands it
        │
state/ (Zustand)           ussdStore (live session), settingsStore, deviceStore
        │
engine/                     UssdSessionManager → FlowEngine → UssdParser
        │                    (the only layer that knows what a "session" is)
        │
transport/                  UssdTransport interface
        ├── MockUssdTransport      (scripted, offline)
        └── NativeUssdTransport    (RN bridge → Kotlin)
                                          │
android/.../ussdui/                UssdModule.kt → TelephonyManager
```

Each arrow is a real interface boundary, not just a folder convention:

- **`UssdTransport`** (`src/transport/UssdTransport.ts`) is the only thing
  that differs between demo and real USSD. `UssdSessionManager` is
  constructed with one implementation of it and has no idea which one it
  has — this is the direct implementation of spec section 9's requirement
  that "the mock engine must use the SAME parser and UI engine as real
  USSD. Only the transport layer changes."

- **`FlowEngine`** (`src/engine/FlowEngine.ts`) is a pure reducer:
  `(FlowState, event) => FlowState`, no transport calls, no Zustand, no
  React. This is deliberate — it's what makes `tests/session/` and
  `tests/flow/mockFlow.integration.test.ts` possible without mocking half
  the app. `UssdSessionManager` is the only thing that calls it and is
  responsible for the side effects (talking to the transport, writing into
  `ussdStore`).

- **`UssdParser`** (`src/engine/UssdParser.ts`) is a registry, not a
  function. `GenericParser` is always present as the fallback; carrier and
  service profiles register themselves in front of it. See
  `docs/PARSER-DESIGN.md` for why.

- **The Kotlin side is intentionally thin.** `UssdModule.kt` does the
  smallest possible amount of work — call `sendUssdRequest`, relay its
  callback as an event — and pushes everything else (screen state, parsing,
  history, UI) up to TypeScript. `UssdSessionManager.kt` (native) only
  tracks "is a request currently in flight," which is genuinely
  native-only state (Android allows exactly one USSD session device-wide);
  it is not a native mirror of the richer session state TypeScript's
  `UssdSessionManager.ts` tracks — those are two different classes with the
  same name in two different languages, one thin (native) and one
  authoritative (TypeScript), on purpose.

## Why a custom navigator instead of React Navigation

Five screens (Home, Session, SimSelector, Settings, Developer), no
deep-linking, no nested stacks. `src/navigation/RootNavigator.tsx` is a
~40-line Context + array-based history stack. Pulling in
`@react-navigation/native` would also mean `react-native-screens`,
`react-native-safe-area-context`, and `react-native-gesture-handler` as
additional native-linked dependencies for navigation logic this simple.
Nothing in the app assumes this particular navigator — swap it for React
Navigation later if the app grows past what a Context stack comfortably
handles.

## Why Zustand, and what's in which store

The spec asked for Zustand explicitly (section 12). Three stores, split by
what changes together and how long it lives:

- **`ussdStore`** — the live session: current screen, history, session
  state, last error. Fully reset on every new session. Only
  `UssdSessionManager` writes to it (the `_reset`/`_pushScreen`/etc. actions
  are prefixed with `_` as a convention, not a language-level guarantee, to
  flag "internal, don't call this from a component").
- **`settingsStore`** — transport mode, selected SIM, developer mode, the
  experimental-continuation flag. Persisted to `AsyncStorage` so it survives
  an app restart; hydrated once in `App.tsx`.
- **`deviceStore`** — SIM slot list from the native module. Refreshed on
  demand (`SimSelectorScreen` calls it on mount), not persisted — SIM state
  can change between app launches (a card gets swapped) and there's no
  reason to trust a stale cache over asking the OS again.

## UI design direction

A dark, slightly warm neutral base (`src/theme.ts`) with one accent color
used consistently for anything actionable, rather than a default
Material/iOS look — see spec section 17's ask for "a serious production
Android utility," not a developer-demo aesthetic. The raw-response debug
panel (`RawResponsePanel.tsx`) is visually secondary (collapsed by default,
monospace, muted) so it reads as a real debug tool for people who opt into
Developer Mode, not as the app's main interface.

## What's deliberately not built yet

- **iOS.** The spec is Android-only (`TelephonyManager` has no iOS
  equivalent — Apple's CoreTelephony doesn't expose USSD at all). The RN
  project itself is Android-only; no `ios/` directory was generated.
- **Safe-area handling** (notches/status bars via
  `react-native-safe-area-context`). Not wired in — adding the dependency
  without actually integrating `useSafeAreaInsets`/`SafeAreaView` would just
  be dead weight. Worth adding if you take this past a prototype.
- **A real TurboModule/Codegen spec for `UssdModule`.** It's a classic
  `ReactContextBaseJavaModule` + `ReactPackage`, which keeps working under
  the New Architecture through RN's interop layer without needing a
  Codegen spec this project's environment couldn't verify by actually
  running codegen. Worth revisiting once you have a real device/CI to
  validate a TurboModule conversion against.
