# MY PLAN Android APK Configuration

The repository now builds a **debug APK** for the Android package `com.zinbas.myplan`. The debug artifact is suitable for direct sideload testing, but it is signed with a generated debug certificate and must not be treated as the long-term shareable release artifact. The package targets Android API 36 and supports Android API 24 and newer.

| Capability | Included in source | Owner action still required | Secret handling |
|---|---|---|---|
| Mobile planner and connected account APIs | Yes | Install the APK and sign in through the verified app-link flow | Native session is stored through Android Keystore-backed storage |
| Android system-reminder permission and FCM token registration | Yes | Register `com.zinbas.myplan` in the owner’s Firebase project and place its downloaded `google-services.json` at `android/app/google-services.json` before a production build | The real file is ignored; only a non-secret example is committed |
| Server-to-device FCM delivery | Registration storage is ready | Add an owner-controlled Firebase service credential through project secrets, then enable the server sender | Never place a service-account JSON or private key in source or the APK |
| HTTPS App Links for secure return after sign-in | Manifest and listener are ready | Host the real `/.well-known/assetlinks.json` using the SHA-256 fingerprint of the **release** signing key | The committed template contains no fingerprint |
| Shareable release APK | Build scripts are ready | Generate and retain a private release keystore, configure a local ignored `keystore.properties`, then produce a signed release build | Do not commit keystores, passwords, or signing properties |

> The Android permission prompt is initiated only when a person chooses **Enable Android reminders** inside MY PLAN. No test notification is sent during APK setup or registration.

## Build commands

From the project root, use `pnpm cap:sync` to rebuild the web assets and synchronize Capacitor plugins. Use `pnpm android:debug` to create `android/app/build/outputs/apk/debug/app-debug.apk` after the Android SDK and Java toolchain are installed.

For production distribution, create a dedicated release keystore outside source control, set Android signing configuration in a locally ignored file, and build a release-signed APK or AAB. Publish the matching App Link association file only after the release certificate fingerprint is known. Android App Links require the hosted statement and the Android intent filter to agree on the package and SHA-256 fingerprint.[1]

Firebase Cloud Messaging requires a Firebase Android app whose package name exactly matches `com.zinbas.myplan`, plus the downloaded app-level `google-services.json` in the Android module.[2] Android 13 and newer also require an explicit notification permission request.[3]

## References

[1] [Capacitor, *Deep Links*](https://capacitorjs.com/docs/guides/deep-links)

[2] [Capacitor, *Using Push Notifications with Firebase*](https://capacitorjs.com/docs/guides/push-notifications-firebase)

[3] [Capacitor, *Push Notifications API*](https://capacitorjs.com/docs/apis/push-notifications)
