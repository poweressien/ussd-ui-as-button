# Third-party notices

USSD-UI's own code is proprietary (see `LICENSE`). It is built on these open-source components, which stay under their own licences.

| Component | Licence | Use |
|---|---|---|
| React (`react`) | MIT | UI library |
| React Native (`react-native`) | MIT | Mobile framework |
| Zustand (`zustand`) | MIT | App state |
| `@react-native-async-storage/async-storage` | MIT | Saving settings on the phone |
| Kotlin standard library | Apache-2.0 | Native Android code |
| AndroidX / Android SDK libraries | Apache-2.0 | Android platform support |
| Gradle, Android Gradle Plugin | Apache-2.0 | Build tooling |
| Development only (not shipped): TypeScript (Apache-2.0), Jest (MIT), ESLint (MIT), Prettier (MIT), Testing Library (MIT) | | Testing and checks |

The MIT and Apache-2.0 licence texts are published by each project. The exact versions are in `package.json` and `package-lock.json`. Each package's licence file is inside its folder in `node_modules` and is included by the build where required.

Fonts: the app uses the phone's system fonts. Icons and graphics were created for this project.
