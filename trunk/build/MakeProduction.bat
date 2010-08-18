echo off
cd "%MK%\build"

Set skipPause=%1
if not defined skipPause Set skipPause=false

if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"
cd "%MK%\build"

if exist "%MK%\xulrunner\xulrunner-stub.exe" call "%MK%\build\scriptNoRun\FirstRun.bat"

ECHO --- COPY XULRUNNER FILES
del /Q "%MK%\xulrunner\*.exe"
xcopy "%MK%\xul\xulrunnerDevAndProd\xulrunner" "%MK%\xulrunner" /S /Y
rename "%MK%\xulrunner\xulrunner-stub.exe" "%executable%"

ECHO --- COPY XUL PRODUCTION ONLY FILES
del /Q "%MKS%\localeDev\locales\*"
copy /Y "%MK%\xul\xulrunnerProduction\chrome\*" "%MK%\xulrunner\chrome"
del "%MK%\xulrunner\chrome\en-US.nomenu.manifest"
copy /Y "%MK%\xul\xulrunnerProduction\venkmanOverlay.xul" "%MK%\xul\xulsword"
call "%MK%\build\scriptNoRun\UpdateJars.pl" "%MK%" "%MKS%" "%MKO%" true %UIversion% %MinProgversionForUI% %IncludeLocales% %AllLocales%

ECHO --- DELETING UNNECESSARY FILES
if exist "%MK%\xulrunner\components\venkman-service.js" del "%MK%\xulrunner\components\venkman-service.js"
if exist "%MK%\xulrunner\chrome\venkman.jar" del "%MK%\xulrunner\chrome\venkman.jar"
if exist "%MK%\xulrunner\chrome\venkman.manifest" del "%MK%\xulrunner\chrome\venkman.manifest"
if exist "%MK%\xulrunner\defaults\pref\debug.js" del "%MK%\xulrunner\defaults\pref\debug.js"
if exist "%MK%\xulrunner\fonts" rmdir /S /Q "%MK%\xulrunner\fonts"
if exist "%MK%\xulrunner\audio" rmdir /S /Q "%MK%\xulrunner\audio"
if exist "%MK%\xulrunner\bookmarks" rmdir /S /Q "%MK%\xulrunner\bookmarks"

call "%MK%\build\scriptNoRun\Update.bat"

if %skipPause%==true goto EOF
ECHO --- MAKE COMPLETE ---
pause

:EOF
