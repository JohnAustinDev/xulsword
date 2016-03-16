@ECHO USAGE: Compile.bat utilityName

@echo off
cd %~dp0
call ..\..\..\windows\Versions.bat

Set utilityName=%1
if not defined utilityName goto FINISH

if exist .\Release rmdir /S /Q .\Release
mkdir .\Release

Set cFlags=/nologo /W0 /EHsc /O2^
 /I "%MK%\Cpp\src\include"^
 /I "%MK%\Cpp\src\windows"^
 /I "%clucene%\src"^
 /I "%sword%\include"^
 /I "%sword%\include\internal\regex"^
 /FI "fileops.h"^
 /FI "windefs_sword.h"^
 /D WIN32 /D "_WINDOWS" /D "USELUCENE" /D REGEX_MALLOC /D "WIN32_LEAN_AND_MEAN" /D "UNICODE" /D "_UNICODE" /D "_CRT_SECURE_NO_DEPRECATE" /D "XP_WIN" /D "_LIB" /D "_AFXDLL" /Zm200 /Fo".\Release\\" /c

if exist "%MK%\Cpp\swordMK\windows\utilities\%utilityName%.cpp" (Set cFiles="%MK%\Cpp\swordMK\windows\utilities\%utilityName%.cpp") else Set cFiles="%sword%\utilities\%utilityName%.cpp"
Set cFiles=%cFiles%^
 "%MK%\Cpp\src\windows\dirent.cpp"^
 "%MK%\Cpp\src\windows\fileops.cpp"^
 "%MK%\Cpp\swordMK\swmodule.cpp"^
 "%MK%\Cpp\swordMK\filemgr.cpp"

Set lFlags=libsword.lib libclucene.lib /libpath:"%MK%\Cpp\swordMK\windows\lib\Release" /libpath:"%MK%\Cpp\cluceneMK\windows\lib\Release" /nologo /SUBSYSTEM:CONSOLE /MACHINE:X86 /out:".\bin\%utilityName%.exe"
Set lFiles=^
 ".\Release\%utilityName%.obj"^
 ".\Release\dirent.obj"^
 ".\Release\fileops.obj"^
 ".\Release\swmodule.obj"^
 ".\Release\filemgr.obj"

if exist ".\bin\%utilityName%.exe" del ".\bin\%utilityName%.exe"

echo on
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
@echo off

echo.
if exist ".\bin\%utilityName%.exe" (echo ----------- %utilityName%.exe SUCCESS!) else (echo ----------- %utilityName%.exe COMPILE FAILED...)
echo.

:FINISH