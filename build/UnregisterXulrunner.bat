if not defined MKAppinfo Set MKAppinfo=%MK%\build
call "%MKAppinfo%\Appinfo.bat"

call "autogen\RemoveAllProfiles.bat"

pushd %MK%\xulrunner
call xulrunner.exe --unregister-global

popd
call "autogen\unsetRegistry.reg"
