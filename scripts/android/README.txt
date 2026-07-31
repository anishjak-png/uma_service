## Find Java / SDK automatically

`BUILD-APK.bat` looks for:

- `%ProgramFiles%\Android\Android Studio\jbr` (bundled JDK)
- `%LOCALAPPDATA%\Android\Sdk` (Android SDK)

If the batch file still says Java not found, set manually before running:

```cmd
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
scripts\android\BUILD-APK.bat
```

## Build from Android Studio (alternative)

```bash
npx cap sync android
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
APK output: `android/app/build/outputs/apk/debug/`
