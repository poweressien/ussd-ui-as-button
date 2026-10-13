# Builds the Play Store bundle (.aab). Run from the project root:
#   powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'android\keystore.properties')) { throw 'android\keystore.properties missing. Run scripts\create-keystore.ps1 first.' }
if (-not (Test-Path 'node_modules')) { npm install }
Push-Location android
.\gradlew.bat clean bundleRelease
Pop-Location
$aab = 'android\app\build\outputs\bundle\release\app-release.aab'
if (Test-Path $aab) { Write-Host "READY TO UPLOAD: $((Resolve-Path $aab).Path)" } else { throw 'Build finished but the .aab was not found.' }
