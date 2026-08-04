# Staff Android APK

The staff app is a **Capacitor shell** that opens the live site:

**https://uma-service.vercel.app**

No app store needed — share the APK file directly with reception/technician phones.

## Build the APK (once, on your dev PC)

### Requirements

1. **Node.js 20+**
2. **Android Studio** (includes JDK + Android SDK)  
   https://developer.android.com/studio

After installing Android Studio, open it once and accept SDK licenses.

### Build

Double-click:

```
scripts/android/BUILD-APK.bat
```

Or manually:

```bash
npm install
npx cap sync android
cd android && gradlew.bat assembleDebug
```

**Output APK:**

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Share `app-debug.apk` with staff (WhatsApp, USB, etc.).

## Install on staff phones

1. Copy `app-debug.apk` to the phone
2. Open the file → **Install**
3. Allow **Install unknown apps** if Android asks
4. Open **Uma Traders** → log in with **mobile number + password** (admin creates accounts)

## Device approval

1. Staff installs APK and logs in
2. They see **Waiting for device approval** until admin approves
3. Admin opens **Admin → Devices** on their phone and taps **Approve**
4. Staff app unlocks automatically (checks every 15 seconds)

## Notes

- The APK loads the **cloud app** — phone needs **internet** (Wi‑Fi or mobile data)
- Updates to the web app appear automatically — **no need to rebuild APK** for normal feature changes
- **Rebuild the APK** when changing native features (camera, app name, icon, or server URL)
- Photo capture uses the native **Camera** plugin — after updating camera code, run `BUILD-APK.bat` and reinstall
- **Print bridge** stays on the shop PC — phones use the app only

## Photos / Supabase Storage

Product photos upload through the cloud app to Supabase Storage. On Vercel, set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default `product-photos`)

In Supabase → **Storage**, create a **public** bucket named `product-photos` (or match your env var).
Without these, Add photo fails with a storage configuration error.

## Custom URL (optional)

To point at a different server when building:

```bash
set CAPACITOR_SERVER_URL=https://your-url.vercel.app
npx cap sync android
```

## Release APK (optional, for Play Store)

For signed release builds, use Android Studio:  
**Build → Generate Signed Bundle / APK**

Debug APK is enough for internal staff sharing.
