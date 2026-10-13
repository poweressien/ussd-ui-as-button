v11 (1.0.0): first Play-ready build. Consent screen, no network permission, release signing, custom icon.

## v13
- Top bar on every screen: back arrow, title, and a three-dot menu (Settings, Choose a SIM, About). Phone Back button/gesture steps back through the app.
- Settings and Developer links removed from the bottom of Home. Developer tools are hidden from normal users; on your own phone, open About and tap the version line 7 times to unlock them (About → "Hide developer options" locks again).
- Quick codes rebuilt per network (MTN, Airtel, Glo, 9mobile/T2) using the NCC unified codes: *310# balance, *323# data balance, *312# data plans, *303# borrow, *321# share, plus each network's own menu code.
- Every response (menu buttons, errors, success, failures, loading) is centred on screen, both in the app and in the pop-up drawn over the phone's USSD dialog.

## v14
- Fixed: the app was reading the Phone app's own screens (contacts list, call log, keypad) as if they were the USSD reply, and showing them as buttons. The service now ignores dialer/in-call windows unless they are a real pop-up, and rejects anything that looks like a keypad or contacts list.
- A cancelled session now says "Session cancelled" instead of "unknown error".

## v15
- Every button, key and card now shows it was tapped: it lights up green and shrinks slightly while pressed, then flashes green for a moment after release. Same for the buttons drawn over the phone's USSD pop-up (plus a light vibration; no extra permission needed).
- Added LICENSE (all rights reserved), COPYRIGHT.md, OWNERSHIP.md, PRIVACY-POLICY.md, TERMS-OF-USE.md, NOTICE.md and docs/SOURCE-MANIFEST.sha256. Copyright line added to every source file.
