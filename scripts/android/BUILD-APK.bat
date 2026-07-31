@echo off
setlocal EnableDelayedExpansion
title Build Uma Traders Staff APK
cd /d "%~dp0..\.."

echo.
echo  Building debug APK for staff - loads uma-service.vercel.app
echo.

REM --- Auto-detect Java (Android Studio bundles JDK but rarely adds it to PATH) ---
if not defined JAVA_HOME (
  if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
  ) else if exist "%LOCALAPPDATA%\Programs\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"
  ) else if exist "%ProgramFiles(x86)%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles(x86)%\Android\Android Studio\jbr"
  )
)

if defined JAVA_HOME (
  set "PATH=%JAVA_HOME%\bin;%PATH%"
  echo Using Java: %JAVA_HOME%
) else (
  where java >nul 2>&1
  if errorlevel 1 (
    echo Java JDK not found in PATH and Android Studio JBR not found.
    echo.
    echo If Android Studio is installed, open it once, then retry.
    echo Or set JAVA_HOME manually to your JDK folder.
    echo Example: set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
    pause
    exit /b 1
  )
)

REM --- Auto-detect Android SDK ---
if not defined ANDROID_HOME (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
  ) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
  )
)

if defined ANDROID_HOME (
  echo Using Android SDK: %ANDROID_HOME%
  if not exist "android\local.properties" (
    echo sdk.dir=%ANDROID_HOME:\=\\%> android\local.properties
  )
) else (
  echo Warning: ANDROID_HOME not found. Gradle may fail if SDK is missing.
)

echo.

call npm install
if errorlevel 1 exit /b 1

call npx cap sync android
if errorlevel 1 exit /b 1

cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  echo.
  echo Build failed. Open the project in Android Studio once:
  echo   npx cap open android
  echo Then: Build - Build Bundle(s) / APK(s) - Build APK(s)
  pause
  exit /b 1
)

echo.
echo  SUCCESS
echo  APK: android\app\build\outputs\apk\debug\app-debug.apk
echo  Share this file with staff via WhatsApp or USB.
echo.
pause
