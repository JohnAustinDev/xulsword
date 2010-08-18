echo off
cd "%MK%\Build"

:: isPortable is set the first time Appinfo is called during a thread, and then remains unchanged
if not defined isPortable Set isPortable=%1
if not defined isPortable Set isPortable=false

:: RETRIEVE CURRENT DATE INFORMATION
:: Use For COMPILING ON English Computers:
For /F "tokens=2-4 delims=/ " %%G in ('date /T')  do Set mm=%%G& Set dd=%%H& Set yy=%%I

:: Use For COMPILING ON Russian Computers:
:: For /F "tokens=1-3 delims=. " %%G in ('date /T')  do Set dd=%%G& Set mm=%%H& Set yy=%%I

ECHO --- WRITING THE XULRUNNER "PREFS.JS" STARTUP FILE
cd "%MK%\xulrunner\defaults\pref"
echo pref("toolkit.defaultChromeURI", "chrome://xulsword/content/%splashScreen%");> prefs.js

ECHO --- WRITING THE DEFAULT PREFS INSPREFS.JS
cd "%MK%\xulrunner\defaults\pref"
del buildprefs.js
if %ShowDictionaryTabsByDefault%==true echo pref("xulsword.ShowDictionaryTabsByDefault", true);>> buildprefs.js
if %ShowCommentaryTabsByDefault%==true echo pref("xulsword.ShowCommentaryTabsByDefault", true);>> buildprefs.js
if %ShowAllBibleTabsByDefault%==true echo pref("xulsword.ShowAllBibleTabsByDefault", true);>> buildprefs.js
if %HideUnavailableCrossReferences%==true echo pref("xulsword.HideUnavailableCrossReferences", true);>> buildprefs.js
if %ShowOriginalTextTabs%==true echo pref("xulsword.ShowOriginalTextTabs", true);>> buildprefs.js
if %MinimizeSearchRadios%==true echo pref("xulsword.MinimizeSearchRadios", true);>> buildprefs.js
if %HideDisabledBooks%==true echo pref("xulsword.HideDisabledBooks", true);>> buildprefs.js
if %ShowIntrosBeforeText%==true echo pref("xulsword.ShowIntrosBeforeText", true);>> buildprefs.js
if %HideDisabledViewMenuItems%==true echo pref("xulsword.HideDisabledViewMenuItems", true);>> buildprefs.js
if %HideDisabledCopyPrintIncludes%==true echo pref("xulsword.HideDisabledCopyPrintIncludes", true);>> buildprefs.js
if %AlwaysHideHebrewOptions%==true echo pref("xulsword.HideHebrewOptions", true);>> buildprefs.js
if %DontReadReferenceBible%==true echo pref("xulsword.DontReadReferenceBible", true);>> buildprefs.js
if defined HiddenTexts1 echo pref("xulsword.HiddenTexts1", "%HiddenTexts1%");>> buildprefs.js
if defined HiddenTexts2 echo pref("xulsword.HiddenTexts2", "%HiddenTexts2%");>> buildprefs.js
if defined HiddenTexts3 echo pref("xulsword.HiddenTexts3", "%HiddenTexts3%");>> buildprefs.js

ECHO --- WRITING TEXT ENCRYPTION KEY TO PREFS
cd "%MK%\xulrunner\defaults\pref"
if defined bibleTextEncryptionKey set btec=%bibleTextEncryptionKey%
if not defined bibleTextEncryptionKey set btec=empty
echo pref("xulsword.DefaultCK","%btec%");>> buildprefs.js

ECHO --- WRITING COMPATIBILITY INFO TO PREFS
cd "%MK%\xulrunner\defaults\pref"
echo pref("xulsword.MinXSMversion","%MinXSMversion%");>> buildprefs.js
echo pref("xulsword.MinUIversion","%MinUIversion%");>> buildprefs.js

ECHO --- WRITING HELP EMAIL ADDRESS TO PREFS
if not defined HelpEmailAddress goto SKIPHEA
cd "%MK%\xulrunner\defaults\pref"
echo pref("xulsword.HelpEmailAddress","%HelpEmailAddress%");>> buildprefs.js
:SKIPHEA

ECHO --- WRITING THE DEFAULT LANGUAGE PREF FILE
cd "%MK%\xulrunner\defaults\pref"
echo pref("general.useragent.locale","%defaultLanguage%");> language.js

ECHO --- WRITING XULRUNNER APPLICATION.INI FILE
cd "%MK%\xulrunner"
echo [App]> application.ini
echo Vendor=%vendor%>> application.ini
echo Name=%name%>> application.ini
echo Version=%version%>> application.ini
if %isPortable%==true (echo BuildID=%yy%%mm%%dd%P>> application.ini) else echo BuildID=%yy%%mm%%dd%>> application.ini
echo.>> application.ini
echo [Gecko]>> application.ini
echo MinVersion=1.8>> application.ini
echo MaxVersion=1.10>> application.ini

ECHO --- WRITING PREDEFINED MACRO FILE FOR USE BY INSTALLER
cd "%MKS%\installer"
if not exist autogen mkdir autogen
cd autogen
echo #define MyAppName "%name%"> appinfo.iss
echo #define MyAppExeName "%executable%">> appinfo.iss
echo #define MyPublisher "%vendor%">> appinfo.iss
echo #define MyDecimalVersion "%setupversion%.0.0">> appinfo.iss
echo #define MyVersion "%version%">> appinfo.iss
echo.>> appinfo.iss
echo #define securitymod "%useSecurityModule%">> appinfo.iss
echo #define Encryption "%encryptionKey%">> appinfo.iss
echo #define CopySecurity "%copySecurity%">> appinfo.iss
echo #define StoreSize %StoreSize%>> appinfo.iss
echo #define HebrewFont "%HebrewFont%">>appinfo.iss
echo #define MK "%MK%">>appinfo.iss
echo #define MKS "%MKS%">>appinfo.iss
echo #define MKO "%MKO%">>appinfo.iss
echo #define APPDATA "%APPDATA%">>appinfo.iss

ECHO --- WRITING CDRUN DEFINES USED BY STARTUP EXEs
mkdir "%MK%\Cpp\Release"
cd "%MK%\Cpp\Release"
echo #define PATH_TO_PROGRAM "%%s\\%executable%"> appInfo.h
echo #define KEYADDRESS "Software\\%vendor%\\%name%">> appInfo.h
echo #define PROC_NAME "%executable%">> appInfo.h
::echo #define PORTABLE_RUN L"\".\\%name%\\%name%Local.exe\" -profile \"..\\profile\" -console -jsconsole">> appInfo.h
echo #define PORTABLE_RUN L"\".\\%name%\\%name%Local.exe\" -profile \"..\\profile\"">> appInfo.h
echo #define PORTABLE_DIR L".\\%name%">> appInfo.h

ECHO --- WRITING INFO FOR COMPILATION
cd "%MK%\Cpp\Release"
echo #define CHROMECODEDIR "%MK:\=\\%\\Cpp\\Release\\chromeCode.h" > compDump.h
echo #define XSMVERSION "%XSMversion%" >> compDump.h
echo #define ENCXSMODS "%encryptedTexts:"=%" >> compDump.h
echo #define MINUIVERSION "%MinUIversion%" > compInfo.h

ECHO --- WRITING REGISTRY SET/UNSET BAT FILES
mkdir "%MK%\build\autogen"
cd "%MK%\build\autogen"
echo Windows Registry Editor Version 5.00 > setRegistry.reg
echo [HKEY_LOCAL_MACHINE\SOFTWARE\%vendor%\%name%] >> setRegistry.reg
echo "InstallDrive"="%MKO:\=\\%\\toCDROM\\Install\\setup" >> setRegistry.reg
echo "RunDir"="%MK:\=\\%\\xulrunner" >> setRegistry.reg
echo "AudioDir"="%MKO:\=\\%\\audio" >> setRegistry.reg
echo Windows Registry Editor Version 5.00 > unsetRegistry.reg
echo [HKEY_LOCAL_MACHINE\SOFTWARE\%vendor%\%name%] >> unsetRegistry.reg
echo "AudioDir"=- >> unsetRegistry.reg
echo "InstallDrive"=- >> unsetRegistry.reg
echo "RunDir"=- >> unsetRegistry.reg

ECHO --- WRITING REMOVEALLPROFILES.BAT
cd "%MK%\build\autogen"
echo RMDIR /S /Q "%USERPROFILE%\Local Settings\Application Data\%vendor%" > RemoveAllProfiles.bat
echo RMDIR /S /Q "%USERPROFILE%\Application Data\%vendor%" >> RemoveAllProfiles.bat

cd "%MK%\build"
