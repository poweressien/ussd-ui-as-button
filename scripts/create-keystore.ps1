# One-time: creates your Play "upload key" and android\keystore.properties.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File scripts\create-keystore.ps1
# BACK UP android\ussdui-upload.jks AND the passwords somewhere safe (not git). If you lose it you must ask Google to reset the upload key.
$ErrorActionPreference = 'Stop'
$keytool = "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = 'keytool' }
$jks = Join-Path (Resolve-Path 'android') 'ussdui-upload.jks'
if (Test-Path $jks) { Write-Host "Keystore already exists: $jks"; exit 1 }
$pw = Read-Host 'Choose a keystore password (min 6 chars)'
& $keytool -genkeypair -v -storetype JKS -keystore $jks -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storepass $pw -keypass $pw -dname 'CN=iWEKOBONGstudios, O=iWEKOBONGstudios, C=NG'
@"
storeFile=ussdui-upload.jks
storePassword=$pw
keyAlias=upload
keyPassword=$pw
"@ | Set-Content -Encoding ascii android\keystore.properties
Write-Host "Done. Created $jks and android\keystore.properties"
