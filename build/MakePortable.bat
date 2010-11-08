echo off
cd "%MK%\build"
if exist "%MK%\xulrunner\chrome\venkman.manifest" exit
if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat" true
cd "%MK%\build"

set FirefoxPortableDir=%MK%\portable\FirefoxPortable
set PortableDir=%MK%\portable\%name% Portable
rmdir /S /Q "%PortableDir%"
mkdir "%PortableDir%"

set RunDir=%PortableDir%\%name%
set ResDir=%PortableDir%\resources
set ProfDir=%PortableDir%\profile
mkdir "%RunDir%"
mkdir "%ResDir%"
mkdir "%ProfDir%"
echo. > "%ProfDir%\store.bat"
echo NewLocales;en-US >"%ResDir%\newInstalls.txt"
::attrib +H "%RunDir%"
::attrib +H "%ResDir%"
::attrib +H "%ProfDir%"

ECHO --- COPY FIREFOX PORTABLE FILES
xcopy "%FirefoxPortableDir%\App\Firefox\*" "%RunDir%\" /S /Y

ECHO ---DELETE UNNEEDED OR CONFLICTING FIREFOX FILES
rmdir /S /Q "%RunDir%\defaults"
rmdir /S /Q "%RunDir%\dictionaries"
rmdir /S /Q "%RunDir%\uninstall"
rmdir /S /Q "%RunDir%\searchPlugins"
del "%RunDir%\blocklist.xml"
del "%RunDir%\browserconfig.properties"

ECHO --- COPY DEFAULTS
xcopy "%MK%\xulrunner\defaults" "%RunDir%\defaults" /I /S /Y

ECHO --- COPY PLUGINS
copy /Y "%MK%\xul\xulrunnerDevAndProd\xulrunner\plugins\*" "%RunDir%\plugins\"
mkdir "%RunDir%\components"
copy /Y "%MK%\xul\xulrunnerDevAndProd\xulrunner\components\*" "%RunDir%\components\"

ECHO --- COPY CHROME DIRECTORY
rmdir /S /Q "%RunDir%\chrome"
mkdir "%RunDir%\chrome"
xcopy "%MK%\xulrunner\chrome\*" "%RunDir%\chrome\" /I /S /Y

ECHO --- COMPILE PORTABLE STUB
cd %MK%\Cpp\runPortable"
del "Release\runPortable.exe"
call Compile.bat

ECHO -- COPY COMPONENTS ETC
copy /Y "%MK%\Cpp\runPortable\Release\runPortable.exe" "%PortableDir%\%name%.exe"
rename "%PortableDir%\%name%\firefox.exe" "%name%Local.exe"
copy /Y "%MK%\xulrunner\components\xulsword.dll" "%RunDir%\components\"
copy /Y "%MK%\xulrunner\components\ixulsword.xpt" "%RunDir%\components\"
copy /Y "%MK%\xulrunner\components\xsCommandLineHelper.js" "%RunDir%\components\"
echo xsCommandLineHandler.js>> "%RunDir%\components\components.list"
echo xulsword.dll>> "%RunDir%\components\components.list"
copy /Y "%MK%\xulrunner\application.ini" "%RunDir%\application.ini"
copy /Y "%MK%\xulrunner\License.txt" "%RunDir%\"

ECHO --- COPY MODULES
rmdir /S /Q  "%ResDir%\mods.d"
rmdir /S /Q  "%ResDir%\modules"
mkdir "%ResDir%\mods.d"
mkdir "%ResDir%\modules"
copy  "%APPDATA%\%vendor%\%name%\Profiles\resources\mods.d\*" "%ResDir%\mods.d"
xcopy "%APPDATA%\%vendor%\%name%\Profiles\resources\modules\*"  "%ResDir%\modules" /I /S /Y

ECHO --- COPYING TO MKO
rmdir /S /Q  "%MKO%\versions\portableVersion%version%"
mkdir "%MKO%\versions\portableVersion%version%"
call 7za a -tzip "%MKO%\versions\portableVersion%version%\%name% Portable-%version%.zip" -r "%PortableDir%\*"

Set arg1=%1
if not defined arg1 pause
