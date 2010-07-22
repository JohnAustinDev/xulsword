echo off
cd "%MK%\build"
if exist "%MK%\xulrunner\chrome\venkman.manifest" exit
if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat" true
cd "%MK%\build"

set FirefoxPortableDir=%MK%\portable\FirefoxPortable\
set PortableDir=%MK%\portable\%name% Portable\
rmdir /S /Q "%PortableDir%"
mkdir "%PortableDir%"
set RunDir=%PortableDir%%name%\
mkdir "%RunDir%"
attrib +H "%PortableDir%%name%"

ECHO --- COPY FIREFOX PORTABLE FILES
xcopy "%FirefoxPortableDir%App\Firefox\*" "%RunDir%" /S /Y

ECHO ---DELETE UNNEEDED OR CONFLICTING FIREFOX FILES
rmdir /S /Q "%RunDir%defaults"
rmdir /S /Q "%RunDir%dictionaries"
rmdir /S /Q "%RunDir%uninstall"
rmdir /S /Q "%RunDir%searchPlugins"
del "%RunDir%blocklist.xml"
del "%RunDir%browserconfig.properties"

ECHO --- COPY DEFAULTS
xcopy "%MK%\xulrunner\defaults" "%RunDir%defaults" /I /S /Y

ECHO --- COPY PLUGINS
copy /Y "%MK%\xul\xulrunnerDevAndProd\xulrunner\plugins\*" "%RunDir%plugins\"
mkdir "%RunDir%components"
copy /Y "%MK%\xul\xulrunnerDevAndProd\xulrunner\components\*" "%RunDir%components\"

ECHO --- COPY CHROME DIRECTORY
rmdir /S /Q "%RunDir%chrome"
mkdir "%RunDir%chrome"
xcopy "%MK%\xulrunner\chrome\*" "%RunDir%chrome\" /I /S /Y

ECHO --- COMPILE PORTABLE STUB
cd %MK%\Cpp\runPortable"
del "Release\runPortable.exe"
call Compile.bat

ECHO -- COPY COMPONENTS ETC
copy /Y "%MK%\Cpp\runPortable\Release\runPortable.exe" "%PortableDir%%name%.exe"
rename "%PortableDir%%name%\firefox.exe" "%name%Local.exe"
copy /Y "%MK%\xulrunner\components\xulsword.dll" "%RunDir%components\"
copy /Y "%MK%\xulrunner\components\ixulsword.xpt" "%RunDir%components\"
copy /Y "%MK%\xulrunner\components\xsCommandLineHelper.js" "%RunDir%components\"
echo xsCommandLineHandler.js>> "%RunDir%components\components.list"
echo xulsword.dll>> "%RunDir%components\components.list"
copy /Y "%MK%\xulrunner\application.ini" "%RunDir%application.ini"
copy /Y "%MK%\xulrunner\License.txt" "%RunDir%"
echo.> "%RunDir%\consoleLog.txt"

ECHO --- COPY MODULES
rmdir /S /Q  "%RunDir%mods.d"
rmdir /S /Q  "%RunDir%modules\comments"
rmdir /S /Q  "%RunDir%modules\genbook"
rmdir /S /Q  "%RunDir%modules\lexdict"
rmdir /S /Q  "%RunDir%modules\texts"
mkdir "%RunDir%mods.d"
copy  "%MK%\xulrunner\mods.d\*" "%RunDir%mods.d"
xcopy "%MK%\xulrunner\modules\comments\*"  "%RunDir%modules\comments" /I /S /Y
xcopy "%MK%\xulrunner\modules\genbook\*"   "%RunDir%modules\genbook" /I /S /Y
xcopy "%MK%\xulrunner\modules\lexdict\*"   "%RunDir%modules\lexdict" /I /S /Y
xcopy "%MK%\xulrunner\modules\texts\*"     "%RunDir%modules\texts" /I /S /Y

ECHO --- CREATE NEW ELEMENT MANIFEST SO THAT LANGUAGE MENU WILL OPEN ON FIRST RUN
pushd "%RunDir%defaults\pref"
echo NewLocales;en-US >newInstalls.txt"
popd

ECHO --- CREATE PORTABLE PROFILE DIRECTORY
mkdir "%PortableDir%\profile"
echo. > "%PortableDir%\profile\store.bat"
attrib +H "%PortableDir%\profile"

ECHO --- COPYING TO MKO
rmdir /S /Q  "%MKO%\versions\portableVersion%version%"
mkdir "%MKO%\versions\portableVersion%version%"
call 7z a -tzip "%MKO%\versions\portableVersion%version%\%name% Portable-%version%.zip" -r "%PortableDir%*"

Set arg1=%1
if not defined arg1 pause
