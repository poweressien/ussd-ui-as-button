# Get an APK without a PC (GitHub builds it)
1. Create a new private repo on github.com (e.g. `ussdui`).
2. Upload this whole project folder to it (on a phone: GitHub app / web "Add file → Upload files"; unzip first).
   Do NOT upload `node_modules`, `*.jks` or `keystore.properties`.
3. Open the repo → **Actions** → **Build APK**. It starts by itself (about 8-12 minutes).
4. When it shows a green tick, open the run → **Artifacts** → `ussd-ui-apk` → download, unzip, install the APK.
   (Allow "Install unknown apps" for your browser/Files app when Android asks.)
This is a debug-signed APK for testing. The Play Store upload still uses the signed `.aab` from Android Studio.
