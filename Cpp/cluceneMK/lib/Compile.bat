@ECHO USAGE: Compile.bat [fileName] [exe/dll] (NOTE: fileName is not used; exe or dll selects the type of library to create; dll is default)
@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=dll
if not exist Release mkdir Release

set CPPD=Cpp
set cFlags=
set lFlags=

cd "%MK%\%CPPD%\cluceneMK\lib"
call "%MK%\%CPPD%\versions.bat"

Set cFlags=/nologo /EHsc /O2 /Zc:wchar_t- /Ob2 /Oi /Ot^
 /I "%MK%\%CPPD%\cluceneMK\src"^
 /I "%MK%\%CPPD%\%clucene%\src"^
 /D "_CRT_SECURE_NO_DEPRECATE" /D "_VC80_UPGRADE=0x0710" /D "_UNICODE" /D "UNICODE" /GF /c

if %arg1%==dll Set cFlags=/MD /Fo"Release\clucenedll/" %cFlags% ^
 &Set lFlags=/nologo /out:"Release\clucenedll.lib" ^
 &Set objDIR=Release\clucenedll

if %arg1%==exe Set cFlags=/MT /Fo"Release\clucenexe/" %cFlags% ^
 &Set lFlags=/nologo /out:"Release\clucenexe.lib" ^
 &Set objDIR=Release\clucenexe

mkdir "%objDIR%"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Include
set LIB=%LIB%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Lib

Set cFiles1="%MK%\%CPPD%\%clucene%\src\CLucene\CLMonolithic.cpp"
cl.exe %cFlags% %cFiles1%
 
Set lFiles1=".\%objDIR%\CLMonolithic.obj"
link.exe -lib %lFlags% %lFiles1%

rem rmdir /S /Q "%objDIR%"
