# MY PLAN Android Implementation Notes — 25 August 2026

MY PLAN’s packaged Android client will use verified HTTPS App Links for return routing. Android App Links require both an `android:autoVerify` intent filter and a hosted `.well-known/assetlinks.json` statement containing the final signing certificate SHA-256 fingerprint; the same HTTPS URL continues to fall back to the website when the app is not installed.[1]

Native Android push registration requires Firebase Cloud Messaging and an app-level `google-services.json`; Android 13 and later require an explicit permission check/request. The client must create a matching notification channel for the configured default channel, and FCM token registration alone does not authorize any delivery.[2] [3]

The native session may not be stored in browser local storage. Capacitor’s own storage guidance characterizes browser storage as transient, while the selected Capacitor 8 secure-storage dependency states that Android values are encrypted with AES-GCM using a key created in Android Keystore.[4] [5] MY PLAN will therefore use a one-time server handoff code plus an encrypted native session store, never a raw bearer token in an app-link URL.

The recovered implementation binds each app-link handoff code to a verifier held only in native secure storage, stores only SHA-256 hashes server-side, expires the code after five minutes, and consumes it atomically before minting a regular 30-day revocable application session. Browser cookie writes retain their existing same-origin guard; a packaged client will be permitted only through the `capacitor://localhost` origin together with a bearer authorization header.

## References

[1] [Capacitor, *Deep Links*](https://capacitorjs.com/docs/guides/deep-links)

[2] [Capacitor, *Push Notifications API*](https://capacitorjs.com/docs/apis/push-notifications)

[3] [Capacitor, *Using Push Notifications with Firebase*](https://capacitorjs.com/docs/guides/push-notifications-firebase)

[4] [Capacitor, *Data Storage in Capacitor*](https://capacitorjs.com/docs/guides/storage)

[5] [Aparajita, *Capacitor Secure Storage*](https://www.npmjs.com/package/@aparajita/capacitor-secure-storage)
