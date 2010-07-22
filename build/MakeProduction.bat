echo off
cd "%MK%\build"

Set skipPause=%1
if not defined skipPause Set skipPause=false

if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"
cd "%MK%\build"

ECHO --- COPY XULRUNNER FILES
if exist "%MK%\xulrunner\xulrunner-stub.exe" (echo xsCommandLineHandler.js>> "%MK%\xulrunner\components\components.list")
if exist "%MK%\xulrunner\xulrunner-stub.exe" (echo xulsword.dll>> "%MK%\xulrunner\components\components.list")
if exist "%MK%\xulrunner\xulrunner-stub.exe" (move /Y "%MK%\xulrunner\xulrunner-stub.exe" "%MK%\xul\xulrunnerDevAndProd\")
copy "%MK%\xul\xulrunnerDevAndProd\xulrunner-stub.exe" "%MK%\xulrunner\%executable%"
xcopy "%MK%\xul\xulrunnerDevAndProd\xulrunner" "%MK%\xulrunner" /S /Y
del "%MK%\xulrunner\chrome\en-US.nomenu.manifest"

ECHO --- COPY XUL PRODUCTION ONLY FILES
del /Q "%MKS%\localeDev\locales\*"
copy /Y "%MK%\xul\xulrunnerProduction\chrome\*" "%MK%\xulrunner\chrome"
copy /Y "%MK%\xul\xulrunnerProduction\venkmanOverlay.xul" "%MK%\xul\xulsword"
call "%MK%\build\scriptNoRun\UpdateJars.pl" "%MK%" "%MKS%" "%MKO%" true %UIversion% %MinProgversionForUI% %IncludeLocales% %AllLocales%

ECHO --- DELETING UNNECESSARY FILES
del "%MK%\xulrunner\components\venkman-service.js"
del "%MK%\xulrunner\chrome\venkman.jar"
del "%MK%\xulrunner\chrome\venkman.manifest"
del "%MK%\xulrunner\defaults\pref\debug.js"
del "%MK%\xulrunner\crashreporter.exe"
del "%MK%\xulrunner\js.exe"
del "%MK%\xulrunner\redit.exe"
del "%MK%\xulrunner\updater.exe"
del "%MK%\xulrunner\xpcshell.exe"
del "%MK%\xulrunner\xpidl.exe"
del "%MK%\xulrunner\xpt_dump.exe"
del "%MK%\xulrunner\xpt_link.exe"
echo.> "%MK%\xulrunner\consoleLog.txt"
del "%MK%\xulrunner\dictionaries\en-US.dic"
del "%MK%\xulrunner\dictionaries\en-US.aff"
rmdir /S /Q "%MK%\xulrunner\fonts"
rmdir /S /Q "%MK%\xulrunner\audio"
rmdir /S /Q "%MK%\xulrunner\bookmarks"

call "%MK%\build\scriptNoRun\Update.bat"

if %skipPause%==true goto EOF
ECHO --- MAKE COMPLETE ---
pause

:EOF
