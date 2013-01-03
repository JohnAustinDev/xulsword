@ECHO USAGE: Compile.bat utilityName

Set CPPD=Cpp

@echo off
Set utilityName=%1
Set objDIR=tmp
if not defined utilityName Set goto EOF

cd "%MK%\%CPPD%\swordMK\utilities"
call "%MK%\%CPPD%\versions.bat"

mkdir %objDIR%

Set cFlags=/nologo /W0 /EHsc /O2^
 /I "%MK%\%CPPD%\%clucene%\src"^
 /I "%MK%\%CPPD%\swordMK\src\utilfuns\win32"^
 /I "%MK%\%CPPD%\%sword%\include"^
 /I "%MK%\%CPPD%\%sword%\include\internal\regex"^
 /FI "fileops.h"^
 /FI "redefs_sword.h"^
 /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_LIB" /D "XULSWORD_EXPORTS" /D "_AFXDLL" /D "REGEX_MALLOC" /Zm200 /Fo"%objDIR%/" /c

if exist "%MK%\%CPPD%\swordMK\utilities\%utilityName%.cpp" (Set cFiles="%MK%\%CPPD%\swordMK\utilities\%utilityName%.cpp") else Set cFiles="%MK%\%CPPD%\%sword%\utilities\%utilityName%.cpp"
Set cFiles=%cFiles%^
 "%MK%\%CPPD%\swordMK\src\utilfuns\win32\dirent.cpp"^
 "%MK%\%CPPD%\swordMK\src\utilfuns\win32\fileops.cpp"

Set lFlags=libsword.lib libclucene.lib /libpath:"%MK%\%CPPD%\swordMK\lib\Release" /libpath:"%MK%\%CPPD%\cluceneMK\lib\Release" /nologo /SUBSYSTEM:CONSOLE /MACHINE:X86 /out:"bin\%utilityName%.exe"
Set lFiles=%objDIR%\%utilityName%.obj^
 "%objDIR%\dirent.obj"^
 "%objDIR%\fileops.obj"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%

rmdir /S /Q %objDIR%

:EOF
exit