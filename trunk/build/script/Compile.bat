echo off
cd "%MK%\Cpp"

ECHO Killing any existing xulrunner...
pskill -t %executable%

cd "%MK%\Cpp"

Set SecurityOption=
if not defined useSecurityModule Set useSecurityModule=false
if not %useSecurityModule%==true (Set SecurityOption=NOSECURITY)

ECHO --- COMPILING SWORD PROJECT C++ INTO XULSWORD.DLL
:: Turning splash security off so program can always start
del "%MK%\xulrunner\defaults\pref\prefs.save"
rename "%MK%\xulrunner\defaults\pref\prefs.js" "prefs.save"
ECHO pref("toolkit.defaultChromeURI", "chrome://xulsword/content/");> "%MK%\xulrunner\defaults\pref\prefs.js"

ECHO SecurityOption=%SecurityOption%
if %useSecurityModule%==false goto COMPILE

ECHO Regenerating chromeCode.h from current chrome directory...
:: When "useSecurityModule" is "true", this new "chromeCode.h" 
:: file will allow the xulsword.dll to do a CRC check of the 
:: program's files at runtime before returning any information.

ECHO Compiling with DUMPCODES...
call Compile.bat DUMPCODES

ECHO Dumping all codes...
del "Release\chromeCode.h"
cd "%MK%\xulrunner"
del /Q ".\chrome\*.txt"
start "" "%executable%"
cd "%MK%\Cpp"

:WAIT4CODE1
ECHO Waiting for chromeCode.h...
REM ping is only used to generate a 1 second delay and that's all
ping 127.0.0.1 >NUL
if exist "Release\chromeCode.h" goto KILLPROG1
goto WAIT4CODE1

:KILLPROG1
ECHO Creating locale.txt crc code files
pskill -t %executable%
cd "%MK%\Cpp"
call localeCodes.pl "%MK%" "%MKS%" "%MKO%"
call localeCodes2.7.pl "%MK%" "%MKS%" "%MKO%"
ECHO Dumping all codes excluding CRCs contained in new .txt files...
del "Release\chromeCode.h"
cd "%MK%\xulrunner"
start "" "%executable%"
cd "%MK%\Cpp"

:WAIT4CODE2
ECHO Waiting for chromeCode.h...
REM ping is only used to generate a 1 second delay and that's all
ping 127.0.0.1 >NUL
if exist "Release\chromeCode.h" goto KILLPROG2
goto WAIT4CODE2

:KILLPROG2
pskill -t %executable%

:COMPILE
ECHO Compiling...
call Compile.bat %SecurityOption%
cd "%MK%\Cpp"
echo off
if not exist "Release\xulsword.dll" echo Compile was not successful!& pause& goto FINISH

:FINISH
:: Restore splash security...
del "%MK%\xulrunner\defaults\pref\prefs.js"
rename "%MK%\xulrunner\defaults\pref\prefs.save" "prefs.js"


:OEF
