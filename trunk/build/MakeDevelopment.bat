echo off
cd "%MK%\build"

if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"
cd "%MK%\build"

ECHO --- COPY XULRUNNER FILES
if exist "%MK%\xulrunner\xulrunner-stub.exe" move /Y "%MK%\xulrunner\xulrunner-stub.exe" "%MK%\xul\xulrunnerDevAndProd\"
copy "%MK%\xul\xulrunnerDevAndProd\xulrunner-stub.exe" "%MK%\xulrunner\%executable%"
xcopy "%MK%\xul\xulrunnerDevAndProd\xulrunner" "%MK%\xulrunner" /S /Y
del "%MK%\xulrunner\chrome\en-US.nomenu.manifest"

ECHO --- COPY XUL DEVELOPMENT ONLY FILES
copy /Y "%MK%\xul\xulrunnerDevelopment\chrome\*" "%MK%\xulrunner\chrome"
call "%MK%\build\scriptNoRun\UpdateJars.pl" "%MK%" "%MKS%" "%MKO%" false %UIversion% %MinProgversionForUI% %IncludeLocales% %AllLocales%

copy /Y "%MK%\xul\xulrunnerDevelopment\debug\venkmanOverlay.xul" "%MK%\xul\xulsword"
copy /Y "%MK%\xul\xulrunnerDevelopment\debug\venkman-service.js" "%MK%\xulrunner\components\"
copy /Y "%MK%\xul\xulrunnerDevelopment\debug\venkman.jar" "%MK%\xulrunner\chrome\"
copy /Y "%MK%\xul\xulrunnerDevelopment\debug\venkman.manifest" "%MK%\xulrunner\chrome\"
copy /Y "%MK%\xul\xulrunnerDevelopment\debug\debug.js" "%MK%\xulrunner\defaults\pref\"

call "%MK%\build\scriptNoRun\Update.bat"

pause

