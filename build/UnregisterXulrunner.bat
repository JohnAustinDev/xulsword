if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"

call "%MK%\build\autogen\RemoveAllProfiles.bat"

cd "%MK%\xulrunner"
call xulrunner.exe --unregister-global

cd "%MK%\build"
call "%MK%\build\autogen\unsetRegistry.reg"
