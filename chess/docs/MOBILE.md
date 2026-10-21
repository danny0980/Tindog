# The iOS and Android apps

The apps are the same game, wrapped by **Capacitor 8**:
- `android/` is an Android Studio project (Gradle; minSdk 24, target 36);
- `ios/` is an Xcode project (Swift Package Manager, no CocoaPods).

The game's pages are bundled inside each app, so everything offline works with no connection. Online play (ranked, Card Chess, Battle Royale, Vanishing Chess, the league and community, cloud saves) talks to your game server.

## 1. Point the apps at your server

Set the server's address **at build time**:

```bash
VITE_SERVER_URL=https://chess.example.com npm run cap:sync
```

- Without it the apps still build and play offline, and the Online screen says online play is off in this build.
- The server needs nothing extra: it already allows Capacitor's origins (`APP_ORIGINS` in `server/.env.example`).
- In CI, set the repository variable `CHESS_SERVER_URL` (see section 4).

## 2. Signing in from the app

The apps can't use the website's cookie (their pages come from `capacitor://localhost` / `https://localhost`, not your domain), and Google's sign-in button doesn't run inside an app. So:

- **Email code.** The player enters their email; the email carries a link *and* a 6-digit code, and they type the code into the app. The code expires with the link (15 minutes) and works once.
- **A token instead of the cookie.** The server returns a session token to the app, which keeps it in the system's own storage (`@capacitor/preferences`) and sends it as `Authorization: Bearer …`, and to the socket as the subprotocol `chronos.token.…`.
- **Same accounts.** It's the same account as on the website: same rating, cloud save, clan and history.
- **The Google button** is hidden in the apps. (Native Google sign-in needs a separate OAuth client per platform; email covers everyone.)

## 3. Building

### Android (any computer with JDK 21 and the Android SDK)

```bash
npm run android:debug          # → android/app/build/outputs/apk/debug/app-debug.apk
npm run cap:android            # or open the project in Android Studio
```

- **The SDK.** Android Studio installs it. On a machine without Studio, install the command-line tools and run `sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"`. Then point `android/local.properties` at it: `sdk.dir=/path/to/sdk`.
- **Release signing.** Create a key once:

  ```bash
  keytool -genkeypair -v -keystore android/release.jks -alias chess -keyalg RSA -keysize 2048 -validity 10000
  ```

  Then write `android/keystore.properties`:

  ```properties
  storeFile=release.jks
  storePassword=…
  keyAlias=chess
  keyPassword=…
  ```

  Both files are git-ignored. **Keep a backup of the key**: Google Play needs every update signed with it (or with Play App Signing's upload key).
- **Building the release.** `npm run android:release` builds the signed APK and the Play bundle (`.aab`).
- **The version** follows `package.json`: 6.18.0 becomes versionName `6.18.0` and versionCode `61800`.

### iOS (a Mac with the current Xcode)

```bash
npm run cap:ios                # builds, syncs, and opens Xcode
```

In Xcode:
1. Signing & Capabilities: choose your team. This needs an Apple Developer account, $99 a year.
2. Run ▶ on a simulator or a connected iPhone.
3. Product → Archive, then upload to App Store Connect / TestFlight.

## 4. CI: GitHub Actions

`.github/workflows/chess-apps.yml` runs on every push that touches `chess/`:

| Job | Runner | What it produces |
| --- | --- | --- |
| `check` | Ubuntu | `npm run check` and the full build |
| `android` | Ubuntu | the debug APK; with the signing secrets, also the signed APK and `.aab` (artifact `chess-android`) |
| `ios` | macOS | an unsigned simulator build (artifact `chess-ios-simulator`), which proves the iOS project compiles |

Settings (repository → Settings → Secrets and variables → Actions):
- Variable `CHESS_SERVER_URL`: the game server's address.
- Optional secrets for a signed Android release:
  - `ANDROID_KEYSTORE_BASE64`: the output of `base64 -w0 android/release.jks`;
  - `ANDROID_KEYSTORE_PASSWORD`;
  - `ANDROID_KEY_ALIAS`;
  - `ANDROID_KEY_PASSWORD`.

Signed iOS builds for TestFlight need your Apple certificates and provisioning profile. Do them from Xcode on a Mac, or add them to CI later (for example with fastlane `match`).

## 5. What the app adds around the game

`src/native/` holds the app-only parts. All of it does nothing on the website.

| File | What it does |
| --- | --- |
| `platform.ts` | Is this the app; the server's address; the socket's address |
| `appToken.ts` | The sign-in token, in Preferences |
| `shell.ts` | Dark status bar; hides the launch screen once the first frame is drawn; Android's back button (closes a dialog → goes back to the board → leaves the app) |

- **Icons and launch screens** are drawn from the emblem in `public/favicon.svg`, on the app's dark background. After changing the emblem, run `npm run native:assets`.
- **App identity.** `capacitor.config.ts` sets `appId: 'com.chessarena.app'` and the name *Chess Arena*. Change the id **before** the first store upload; it can't change afterwards.

## 6. Publishing checklist

- [ ] A Google Play developer account ($25, one time) and an Apple Developer account ($99 a year).
- [ ] The final `appId` and app name.
- [ ] `VITE_SERVER_URL` set to the live server, over https.
- [ ] Android: a release key, backed up; the `.aab` uploaded to Play Console.
- [ ] iOS: signing team set, archived and uploaded to App Store Connect.
- [ ] Store listing: screenshots, description, and a privacy policy URL. Both stores require one, because accounts store an email.
- [ ] Account deletion in the app: already there (Online → account → Delete account), which both stores require.
- [ ] **Licensing:** Stockfish is GPL-3.0. Shipping it inside an app means meeting the GPL's terms, including offering the corresponding source.
