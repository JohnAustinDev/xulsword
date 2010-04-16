if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"
cd "%MK%\build"

if exist "%MK%\xulrunner\defaults\pref\debug.js" start "" /D"%MK%\xulrunner" /B "%MK%\xulrunner\%executable%" -jsconsole -console
if not exist "%MK%\xulrunner\defaults\pref\debug.js" start "" /D"%MK%\xulrunner" /B "%MK%\xulrunner\%executable%"
