# Android USSD Limitations

> **v2 note:** the limits below describe the *direct API*. They are no longer dead ends: Auto mode routes around them via the Accessibility channel and a dialer handoff, and replays inputs when a reply is rejected. See `docs/RESTRICTION-WORKAROUNDS.md`.

This document exists because section 14 of the original spec for this project
was explicit: **do not claim something works if it doesn't, and mark
anything the public Android API can't do as `NOT SUPPORTED BY PUBLIC API`
rather than faking it.** This is that documentation, written from Android's
own API surface and current Play Store policy — not from optimism.

If you read nothing else in this repo, read this file before you build on
top of `NativeUssdTransport` / `UssdModule.kt`.

## The one thing that matters most: sessions don't really continue

`TelephonyManager.sendUssdRequest(ussdRequest, callback, handler)` — the only
public, non-Accessibility API a third-party Android app has for sending a
USSD code and getting a response — is a **single dial, single response**
call. You send one MMI string (e.g. `*894#`), and you get back one
`onReceiveUssdResponse` or one `onReceiveUssdResponseFailed` callback. There
is no public method to *reply into that same open dialog* the way the stock
dialer UI does when you type "1" and hit send on a menu the network sent
back.

This matches what Android's own API shape implies (it's a request/response
callback pair, not a duplex session object), and it's consistent with
real-world reports from other developers building USSD tooling: interactive,
multi-step USSD sessions are widely documented as not working through
`TelephonyManager` alone on stock Android. Third-party USSD libraries that
*do* support multi-step interactive menus do it by driving the **system
dialer UI itself through `AccessibilityService`** — reading what's on screen
and simulating taps — not through `TelephonyManager`. This project's spec
explicitly ruled that out as the primary implementation (accessibility
services can read and act on anything on screen, which is exactly why Google
Play scrutinizes them heavily — see below), so `NativeUssdTransport` doesn't
use it.

**What this means in practice for this app:**

- `startUssdSession(code)` → real, reliable, single request/response. This
  is the "first real test" milestone in the spec (section 18), and it's
  fully implemented: dial `*894#`, get back whatever the network sends, see
  it parsed into buttons.
- `sendUssdInput(input)` — replying to continue that session — is, by
  default, **not attempted**. `NativeUssdTransport.sendInput()` immediately
  reports `UNSUPPORTED_CONTINUATION` rather than silently failing or
  pretending to work. The UI surfaces this with its own distinct copy (see
  `UssdError.tsx`) so it's never confused with an actual network rejection.
- An **experimental, off-by-default** "re-dial" mode exists (toggle in
  Settings) that calls `sendUssdRequest()` a second time with just the raw
  input as a fresh MMI string. This is a best-effort guess, not a real
  continuation — it does not know the carrier's actual menu-path syntax
  (e.g. that "reply 1" might really need to be dialed as `*894*1#` from
  scratch), and most carriers will reject it outright. It exists so you can
  experiment against a specific carrier's real behavior on your own device,
  not because it's a supported mechanism.
- **Demo mode has none of this limitation** — `MockUssdTransport` isn't
  talking to a modem, so the full scripted multi-screen flow (menu → account
  number → amount → confirm → success) works end to end, which is what the
  mock-integration test in `tests/flow/` actually proves.

If your use case needs true interactive multi-step USSD (not just "dial one
known code and show the single response nicely"), the only paths are:

1. **Know the full path ahead of time** and dial it as one composed string
   (`*894*1*0803xxxxxxx*5000#`) — this only works for menus you've mapped out
   yourself, which is exactly what the carrier/service profile system in
   `src/profiles/` and `ServiceProfileParser` is *for*: encode a known path
   as a `ProfileRule` once you've verified it, rather than pretending the
   generic parser can discover it live.
2. **Become a carrier-privileged or system app.** Not available to ordinary
   third-party apps.
3. **Use AccessibilityService to drive the stock dialer UI.** Technically
   possible, explicitly out of scope for this project, and its own can of
   worms — see below.

## Runtime requirements

- **Android 8.0 (API 26) or higher.** `sendUssdRequest()` doesn't exist
  before this. `UssdModule.startUssdSession()` checks this and reports
  `NO_TELEPHONY` with a clear message on older devices instead of crashing.
- **`android.permission.CALL_PHONE`**, requested at runtime (it's in the
  dangerous "Phone" permission group). This is the same permission an app
  needs to place a call directly without going through the dialer — USSD
  codes ride the same permission because they're dialed the same way at the
  radio layer. It does **not** give the app the ability to read call logs,
  answer calls, or do anything with SMS.
- **A working SIM with USSD/MMI service from the carrier.** No SIM, airplane
  mode, no signal, or a carrier that has USSD gateway issues on their end
  all surface as `USSD_ERROR_SERVICE_UNAVAIL` or `USSD_RETURN_FAILURE` —
  both are Android's own failure codes, passed straight through by
  `UssdResponseHandler.kt`, not something this app invents.
- **Only one USSD session at a time**, device-wide. `UssdSessionManager.kt`
  (native side) enforces this and reports `SESSION_ALREADY_ACTIVE` rather
  than letting a second `sendUssdRequest()` collide with the first.
- **Multi-SIM**: `TelephonyManager.createForSubscriptionId()` is used to
  target a specific SIM slot, and reading *which* SIMs exist
  (`SubscriptionManager.activeSubscriptionInfoList`) needs
  `READ_PHONE_STATE`. Without that permission, SIM selection still works —
  it just falls back to bare slot indices with no carrier name to show.

## What we deliberately did not verify

Two things in this project could not be checked in the environment this was
built in (no Android SDK/emulator/physical device was available):

- **Whether the Kotlin actually compiles.** It's written to match the
  documented `TelephonyManager` / `UssdResponseCallback` / `SubscriptionManager`
  APIs and the current React Native Android bridge conventions (verified
  against a real, freshly-scaffolded RN 0.87 project — see the top of
  `README.md`), but "matches the documented API shape" isn't the same as "a
  compiler has confirmed it." Build it in Android Studio and fix whatever
  the compiler finds before assuming it's correct.
- **Exact per-OEM/per-carrier behavior.** Samsung, Xiaomi, and other OEM
  Android skins are known to layer their own restrictions on top of stock
  Android's telephony stack, and individual carriers' USSD gateways behave
  differently. The only way to know what `*894#` (or your own codes) does on
  a specific phone + carrier combination is to run this on that phone with
  that carrier.

## Google Play distribution

`CALL_PHONE` is a normal "dangerous" permission — it's what apps use for
ordinary click-to-call features, and by itself it does not require your app
to be the default dialer. It is **not** the same permission group as
`READ_CALL_LOG` / `READ_SMS` / `PROCESS_OUTGOING_CALLS`, which Google Play's
[SMS or Call Log permission
policy](https://support.google.com/googleplay/android-developer/answer/10208820)
restricts specifically to apps registered as the default SMS, Phone, or
Assistant handler.

That said, Google Play's restricted-permissions policy is broad, actively
enforced, and has been revised multiple times (most recently around
contacts and media permissions in 2026) — a fact pattern that changes over
time. Before publishing this app:

- Read the current [Permissions and APIs that Access Sensitive
  Information](https://support.google.com/googleplay/android-developer/answer/16558241)
  policy and the [default-handlers
  guidance](https://developer.android.com/guide/topics/permissions/default-handlers)
  yourself, since this is exactly the kind of policy detail that shifts
  and where a stale answer costs you a rejected submission.
- Be ready to justify `CALL_PHONE` and `READ_PHONE_STATE` in your Play
  Console data-safety form with the app's real, narrow use case (dialing a
  code the user typed, reading which SIM to dial from) — not a vague
  "telecom utility" description.
- Do not add `AccessibilityService` later without reading Google's
  accessibility-permission policy first; it's one of the most heavily
  scrutinized permissions on the platform for exactly the reason this spec
  ruled it out as a primary mechanism.

## Failure code reference

| App-level `code`             | Where it comes from                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `USSD_RETURN_FAILURE`         | `TelephonyManager.USSD_RETURN_FAILURE` — the network/modem rejected the request  |
| `USSD_ERROR_SERVICE_UNAVAIL`  | `TelephonyManager.USSD_ERROR_SERVICE_UNAVAIL` — no USSD service available right now |
| `SESSION_ALREADY_ACTIVE`      | This app's own guard — a session was already in flight                          |
| `PERMISSION_DENIED`           | `CALL_PHONE` not granted, or denied by the system                               |
| `NO_TELEPHONY`                | API < 26, no telephony service, or SIM slot couldn't be resolved                |
| `TIMEOUT`                     | This app's own 30s client-side timeout — see `UssdSessionManager.ts`            |
| `CANCELLED`                   | User-initiated cancel                                                           |
| `UNSUPPORTED_CONTINUATION`    | See "the one thing that matters most" above                                     |
| `MALFORMED_RESPONSE`          | Reserved for parser-side use; the parser currently degrades gracefully instead (see `docs/PARSER-DESIGN.md`) |
