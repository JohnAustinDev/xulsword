echo off
cd "%MK%\build"

Set skipPause=%1
if not defined skipPause Set skipPause=false
Set exitWhenDone=%2
if not defined exitWhenDone Set exitWhenDone=false

if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"
cd "%MK%\build"

find "xulsword.dll" "%MK%\xulrunner\components\components.list" > nul
if errorlevel 1 call "%MK%\build\script\FirstRun.bat"

ECHO --- COPY XULRUNNER FILES
del /Q "%MK%\xulrunner\*.exe"
xcopy "%MK%\xul\xulrunnerDevAndProd\xulrunner" "%MK%\xulrunner" /S /Y

ECHO --- COMPILE executable stub
cd %MK%\Cpp\runMK"
del "Release\runMK.exe"
call Compile.bat
copy "%MK%\Cpp\runMK\Release\runMK.exe" "%MK%\xulrunner\%executable%"
rename "%MK%\xulrunner\xulrunner.exe" %xsprocess%

ECHO --- COPY XUL PRODUCTION ONLY FILES
del /Q "%MKS%\localeDev\locales\*"
copy /Y "%MK%\xul\xulrunnerProduction\chrome\*" "%MK%\xulrunner\chrome"
del "%MK%\xulrunner\chrome\en-US.nomenu.manifest"
copy /Y "%MK%\xul\xulrunnerProduction\venkmanOverlay.xul" "%MK%\xul\xulsword"
call "%MK%\build\script\UpdateJars.pl" "%MK%" "%MKS%" "%MKO%" true %UIversion% %MinProgversionForUI% %IncludeLocales% %AllLocales%

ECHO --- DELETING UNNECESSARY FILES
if exist "%MK%\xulrunner\components\venkman-service.js" del "%MK%\xulrunner\components\venkman-service.js"
if exist "%MK%\xulrunner\chrome\venkman.jar" del "%MK%\xulrunner\chrome\venkman.jar"
if exist "%MK%\xulrunner\chrome\venkman.manifest" del "%MK%\xulrunner\chrome\venkman.manifest"
if exist "%MK%\xulrunner\defaults\pref\debug.js" del "%MK%\xulrunner\defaults\pref\debug.js"
if exist "%MK%\xulrunner\fonts" rmdir /S /Q "%MK%\xulrunner\fonts"
if exist "%MK%\xulrunner\audio" rmdir /S /Q "%MK%\xulrunner\audio"
if exist "%MK%\xulrunner\bookmarks" rmdir /S /Q "%MK%\xulrunner\bookmarks"

call "%MK%\build\script\Update.bat"

if %skipPause%==true goto EOF
ECHO --- MAKE COMPLETE ---
pause

:EOF
if not %exitWhenDone%==true goto EOF2
exit

:EOF2