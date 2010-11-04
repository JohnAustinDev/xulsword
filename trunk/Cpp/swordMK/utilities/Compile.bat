@ECHO USAGE: Compile.bat utilityName

Set CPPD=Cpp

@echo off
Set utilityName=%1
Set binDIR=D:\home\cygwin\usr\local\bin
Set objDIR=intermediateFiles
if not defined utilityName Set goto EOF

cd "%MK%\%CPPD%\swordMK\utilities"
call "%MK%\%CPPD%\versions.bat"

mkdir %objDIR%

Set cFlags=/nologo /MT /W0 /EHsc /O2 /Zc:wchar_t-^
 /Fo"%objDIR%/"^
 /I "%MK%\%CPPD%"^
 /I "%MK%\%CPPD%\%xulrunnerSDK%\xulrunner-sdk\include"^
 /I "%MK%\%CPPD%\swordMK\src\utilfuns\win32"^
 /I "%MK%\%CPPD%\swordMK\include"^
 /I "%MK%\%CPPD%\%sword%\include"^
 /I "%MK%\%CPPD%\%xulrunnerSDK%\xulrunner-sdk\include"^
 /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D "_WINDOWS" /D "_LIB" /D "XULSWORD_EXPORTS" /D "_AFXDLL" /D "REGEX_MALLOC" /Zm200 /c 

if exist "%MK%\%CPPD%\swordMK\utilities\%utilityName%.cpp" (Set cFiles="%MK%\%CPPD%\swordMK\utilities\%utilityName%.cpp") else Set cFiles="%MK%\%CPPD%\%sword%\utilities\%utilityName%.cpp"
Set cFiles=%cFiles%^
 "%MK%\%CPPD%\thmlhtmlxul.cpp"^
 "%MK%\%CPPD%\gbfhtmlxul.cpp"^
 "%MK%\%CPPD%\osishtmlxul.cpp"^
 "%MK%\%CPPD%\osisdictionary.cpp"^
 "%MK%\%CPPD%\osisfootnotesxul.cpp"^
 "%MK%\%CPPD%\swordMK\src\utilfuns\win32\dirent.cpp"

Set lFlags=libsword.lib libclucene.lib xpcom.lib xpcomglue_s.lib nspr4.lib /libpath:"%MK%\%CPPD%\swordMK\lib\Release" /libpath:"%MK%\%CPPD%\cluceneMK\lib\Release" /libpath:"%MK%\%CPPD%\%xulrunnerSDK%\xulrunner-sdk\sdk\lib" /nologo /SUBSYSTEM:CONSOLE /MACHINE:X86 /out:"bin\%utilityName%.exe"
Set lFiles=%objDIR%\%utilityName%.obj^
 "%objDIR%\thmlhtmlxul.obj"^
 "%objDIR%\gbfhtmlxul.obj"^
 "%objDIR%\osishtmlxul.obj"^
 "%objDIR%\osisdictionary.obj"^
 "%objDIR%\osisfootnotesxul.obj"^
 "%objDIR%\dirent.obj"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Include
set LIB=%LIB%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Lib

echo on
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%

copy /Y "bin\%utilityName%.exe" "%binDIR%"
rmdir /S /Q %objDIR%

:EOF
