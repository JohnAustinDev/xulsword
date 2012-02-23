set CPPD=Cpp

cd "%MK%\%CPPD%"
call versions.bat

.\%xulrunnerSDK%\xulrunner-sdk\sdk\bin\header.py --cachedir=.\tmp-xpidl -I .\%xulrunnerSDK%\xulrunner-sdk\idl -o ixulsword.h ixulsword.idl
.\%xulrunnerSDK%\xulrunner-sdk\sdk\bin\typelib.py --cachedir=.\tmp-xpidl -I .\%xulrunnerSDK%\xulrunner-sdk\idl -o ixulsword.h ixulsword.idl

mkdir Release
move ixulsword.xpt Release

pause
