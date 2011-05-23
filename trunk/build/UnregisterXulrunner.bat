if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"

call "%MK%\build\autogen\RemoveAllProfiles.bat"

cd "%MK%\build"
call "%MK%\build\autogen\unsetRegistry.reg"
