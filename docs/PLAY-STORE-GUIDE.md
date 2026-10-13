# Publishing USSD-UI on Google Play

## 0. What is in this build
* Release build has **no INTERNET and no WRITE_SECURE_SETTINGS** permission (those are debug-only, `android/app/src/debug`).
* Permissions: CALL_PHONE, READ_PHONE_STATE, and the Accessibility service (user-enabled).
* First launch shows the **prominent disclosure + "I agree"** screen Google requires. Nothing asks for Accessibility before it.
* applicationId `com.iwekobongstudios.ussdui` · versionName 1.0.0 · versionCode 1 (raise `versionCode` in `android/app/build.gradle` for every upload).
* Custom icon in all densities; store art in `store-assets/`.

* Phone-app capture: the Accessibility service also reacts to the phone's own USSD pop-up when you dial from the Phone app (switchable). Show this in the Accessibility declaration video: dial a code from the regular Phone app and the buttons appear.

## 1. Build the .aab (Windows PowerShell, project root)
```
powershell -ExecutionPolicy Bypass -File scripts\create-keystore.ps1   # once
powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
```
Output: `android\app\build\outputs\bundle\release\app-release.aab`.
**Back up `android\ussdui-upload.jks` and its password.** Enrol in *Play App Signing* when creating the app (default) — this key is then only your upload key.
Test the release first: `cd android; .\gradlew.bat installRelease` (needs keystore.properties) or install the .aab via bundletool.

## 2. Play Console steps
1. Create app → Tools, Free, English.
2. **App content**
   * Privacy policy: host `docs/PRIVACY-POLICY.md` publicly, paste the URL.
   * **Accessibility declaration** (the important one): purpose = *app functionality*; data accessed = text of the system USSD dialog, not collected/shared; upload a **short screen recording** that shows: (a) first launch consent screen, (b) tapping "No thanks" (app still dials) and "I agree", (c) dialling a code and the menu appearing as buttons, tapping one.
   * Data safety: collects **no** data, shares **no** data, no encryption-in-transit question applies (no network). Say data is not collected.
   * Content rating questionnaire (utility, no violence etc.) → Everyone.
   * Target audience: 18+ (financial codes) is simplest.
   * Ads: none. Government/financial features: it is not a financial service; it only dials codes. Declare "no" to loans/crypto etc.
3. **Store listing**: paste from `docs/STORE-LISTING.md`; upload `store-assets/play-icon-512.png`, `feature-graphic-1024x500.png` and your phone screenshots.
4. **Testing**: if your developer account is a *personal* account created recently, Google requires a **closed test with about 12 testers for 14 days** before production. Check the "Production access" page of your console for your exact requirement.
5. Upload the .aab to Internal testing first, install from the Play link on your Xiaomi, then promote.

## 3. Review risk checklist
* Disclosure screen must appear **before** the permission is requested (it does, on first launch).
* Do not mention bank/network logos or imply affiliation (the app uses plain text labels + a "not affiliated" notice).
* The accessibility service description (`strings.xml`) is accurate to what the app does. If you change behaviour, re-submit the declaration.
* Xiaomi/Tecno/Infinix kill background apps: users may need to re-toggle the service (Home banner explains it). Mention in the listing's "what's new" or FAQ.
