# Ownership and authorship – USSD-UI

This file states who owns USSD-UI and lists the evidence that backs the claim.

## Owner
| | |
|---|---|
| Project | USSD-UI |
| Owner / publisher | iWEKOBONGstudios |
| Owner's full legal name | [FILL IN: your full name as on your ID] |
| Country | Nigeria |
| Contact | essiengodspower447@gmail.com |
| GitHub account | https://github.com/poweressien |
| Android package ID | `com.iwekobongstudios.ussdui` |
| Copyright | © 2026 iWEKOBONGstudios. All rights reserved. |
| Licence | Proprietary, see `LICENSE` |

## Statement of authorship
USSD-UI was conceived, specified, directed, tested and published by the Owner. The product idea (showing carrier USSD menus as tappable buttons and forms), its requirements, UI decisions, naming, branding and release were the Owner's. The code was written with AI coding assistance (Claude, by Anthropic) under the Owner's direction. The Owner selected, reviewed, tested and integrated the result, and made the product decisions.

The Owner claims copyright in the project as a whole: the selection, arrangement, design and the human-authored parts, to the full extent the law allows. Third-party open-source components are listed in `NOTICE.md` and stay under their own licences.

## Evidence of ownership
Keep these. Together they make a hard-to-dispute record.

1. **Git history.** Commit author, email and timestamps on GitHub (`poweressien`). Push early and keep the history; don't squash it away.
2. **Signed release tag.** Create a signed, dated tag for each release: `git tag -s v1.0.0 -m "USSD-UI 1.0.0"` then `git push origin v1.0.0`. GitHub shows a "Verified" badge when your signing key is added to your account.
3. **Source manifest.** `docs/SOURCE-MANIFEST.sha256` lists the SHA-256 hash of every source file as of the date inside it. Anyone can check that a copy matches the original (see below). Email the manifest to yourself too; the email timestamp is independent proof of the date.
4. **Google Play Console.** The developer account that owns the package `com.iwekobongstudios.ussdui`, its upload key and its listing history.
5. **Signing key.** The release keystore (`ussdui-upload.jks`) is held only by the Owner. Only the key holder can publish updates under this package. Keep a private backup. Never commit it.
6. **Design files and chats.** Keep the original icon files (`store-assets/`), screenshots and the dated working conversations as development records.
7. **Optional, stronger.** (a) Timestamp the manifest with OpenTimestamps (free, Bitcoin-anchored). (b) Notify or register the work with the Nigerian Copyright Commission (it runs a voluntary notification scheme; check its current process). (c) Register the "USSD-UI" mark if you plan to build a business on the name.

## How to verify a copy matches the original
Linux / macOS / Git Bash, from the project root:
```
sha256sum -c docs/SOURCE-MANIFEST.sha256
```
Windows PowerShell, for one file:
```
Get-FileHash android\app\src\main\java\com\iwekobongstudios\ussdui\UssdOverlay.kt -Algorithm SHA256
```
Compare with the line for that file in the manifest. Files edited later will differ; the manifest proves what the original contained on its date.

Manifest date: see the first line of `docs/SOURCE-MANIFEST.sha256`.

## What to do if someone copies it
See "Reporting copying" in `COPYRIGHT.md`. Send the link, your evidence (the manifest, Git history, Play Console ownership), and a DMCA or platform takedown notice to GitHub, Google Play or the host.

## Notes
- This file is a record, not a court judgment or legal advice. For a registration or a dispute, speak to an intellectual-property lawyer in Nigeria.
- Fill in the legal-name row above before you publish the repo.
