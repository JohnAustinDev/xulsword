:: Must first create application.ini
if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"

cd %MK%\build
call "autogen\setRegistry.reg"
