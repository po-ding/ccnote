@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ========================================================
echo Java 17 설정 완료: %JAVA_HOME%
echo ========================================================

call npm install
call npm run build
if not exist "android" (
  call npx cap add android
)
call npx cap sync android
cd android
call gradlew.bat assembleDebug
cd ..
explorer /select,"android\app\build\outputs\apk\debug\app-debug.apk"
pause
