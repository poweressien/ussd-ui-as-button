# Parser Design

## Why not one universal regex

USSD menus have no standard format. A "1. Transfer" line, a bare "Enter
amount" prompt, and a "Transaction successful" message all look nothing
alike, and different carriers punctuate menus differently ("1. Transfer" vs
"1) Transfer" vs "1 Transfer"). One regex trying to handle all of that
becomes unreadable and impossible to extend safely. Instead,
`GenericParser.parse()` (`src/engine/GenericParser.ts`) is an ordered chain
of independent, individually-testable rules — see
`tests/parser/genericParser.test.ts`, where every rule has its own
`describe` block.

## Detection order (first match wins)

1. **Numbered option lines** (`1. Transfer`, `2) Airtime`, `3 Balance`, `4:
   Data`) → button components. The regex requires the label to start with a
   letter specifically so a bare echoed number (an account number on its
   own line) is never mistaken for a menu option — see the "does not
   mistake a bare echoed number for a menu option" test.
   - **Special case within this rule**: if there are exactly two options and
     one label reads as "confirm" (or accept/proceed) and the other as
     "cancel" (or decline/reject), it's rendered as a `UssdConfirm`
     component instead of two plain buttons — but the `confirmInput` /
     `cancelInput` values are still read directly from the menu's own
     numbering, never assumed to be `1`/`0`. See "derives non-standard
     confirm/cancel digits from the menu instead of assuming 1/0" in the
     tests for why this matters: some services number their confirm/cancel
     options `9`/`8`, or in any other order.
2. **Prose confirm prompts** with no numbered list (`"Confirm transfer of
   NGN5,000 to 08012345678? Reply 1 to confirm or 2 to cancel"`) — the reply
   digits are extracted from the sentence itself where possible; falling
   back to the `1`/`0` convention only when no digits can be read out of the
   text at all.
3. **Terminal / success language** ("successful", "completed", "has been
   credited") → a terminal screen, session over.
4. **Failure language** ("invalid", "failed", "insufficient") → a terminal
   error screen.
5. **Everything else** → treated as an input prompt. The input *kind*
   (`numeric` / `text` / `pin`) is inferred from keywords — "pin"/"otp" →
   `pin` (rendered masked, flagged `sensitive: true`); "amount"/"account
   number"/"phone number" → `numeric`; anything else → free `text`. A
   response that matches nothing above (empty string, stray symbols, binary
   noise) still degrades to this fallback rather than throwing — see
   `tests/parser/malformed.test.ts`.

Rules 3 and 4 run *after* rule 1 deliberately: a menu screen can itself
contain failure language ("Transaction failed\n1. Retry\n2. Exit" is still a
button screen, just one flagged `isError: true`), so option detection has to
win first or that screen would never render its retry button.

## The override chain: carrier and service profiles

`UssdParser.parse(raw, context)` (`src/engine/UssdParser.ts`) is a registry,
not a function. It tries registered plugins in registration order, and
falls back to `GenericParser` if none of them claim the text:

```
ServiceProfileParser   (carrier + exact USSD code, e.g. "mtn-ng" + "*894#")
        │  falls through if canHandle() is false, or no rule matches
CarrierProfileParser   (carrier only, e.g. "mtn-ng" — any code)
        │  same fallthrough
GenericParser           (always available, no carrier knowledge)
```

`ParserPlugin.canHandle(raw, context)` decides *whether a plugin is even
in scope* (does the carrier/service match this session), and
`tryParse(raw, context)` decides whether it has an actual rule for *this
specific text* — returning `null` from `tryParse` falls through to the next
plugin rather than stopping the chain, so a carrier profile only needs rules
for the handful of screens it actually wants to customize; everything else
still gets `GenericParser`'s treatment automatically.

A `ProfileRule` (`src/engine/ParserPlugin.ts`) can optionally be scoped to
one step of the session (`atStep: 2`) — useful when the same raw text
pattern means different things at different points in a flow. See "scopes a
step-specific rule to only the step it was written for" in
`tests/parser/carrierProfileParser.test.ts`.

**This precedence is a registration-order concern, not something the parser
guesses at.** `ProfileManager.init()` currently only registers
`CarrierProfileParser`s (see `src/profiles/`); if you add
`ServiceProfileParser`s of your own, register them *before* the
carrier-level ones so the more specific rule wins — the test "lets a
ServiceProfileParser take precedence over a CarrierProfileParser" is there
specifically to pin that behavior down.

## Why the shipped carrier profiles have (almost) no rules

`src/profiles/mtn-ng.ts`, `airtel-ng.ts`, `glo-ng.ts`, and
`nine-mobile-ng.ts` register real `CarrierProfileParser`s with real branding
(`displayName`, `brandColor`), but an **empty `rules` array** and
placeholder `knownServices` codes (`*XXX#`). This isn't a stub left
unfinished — it's the honest state of a profile nobody has captured and
verified real menu text for yet. See spec section 10: "DO NOT pretend these
profiles are officially provided by the operators. Use sample/demo profiles
initially." Fill in `rules` (and replace the placeholder codes) once you've
captured actual menu text from that carrier and verified it — that's what
the `ProfileRule.match` / `.build` shape exists for. Until then, every
carrier gets identical treatment from `GenericParser`, which is the correct
default, not a missing feature.
