set CPPD=Cpp

cd "%MK%\%CPPD%"
call versions.bat

.\%xulrunnerSDK%\xulrunner-sdk\bin\xpidl -m header -I .\%xulrunnerSDK%\xulrunner-sdk\idl .\ixulsword.idl
.\%xulrunnerSDK%\xulrunner-sdk\bin\xpidl -m typelib -I .\%xulrunnerSDK%\xulrunner-sdk\idl .\ixulsword.idl

mkdir Release
move ixulsword.xpt Release

pause
