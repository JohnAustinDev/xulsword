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
 /I "..\..\swordMK\include"^
 /I "..\..\swordMK\src\utilfuns\win32"^
 /I "..\..\%sword%\include"^
 /I "%MK%\%CPPD%\cluceneMK\src"^
 /I "%MK%\%CPPD%\%clucene%\src"^
 /I "%MK%\%CPPD%\%xulrunnerSDK%\xulrunner-sdk\include"^
 /D "WIN32_LEAN_AND_MEAN" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_LIB" /D "XULSWORD_EXPORTS" /D "_AFXDLL" /D "REGEX_MALLOC" /D "_CRT_SECURE_NO_DEPRECATE" /D "_VC80_UPGRADE=0x0710" /D "_UNICODE" /D "UNICODE" /GF /c

Set cFlags=/MT /Fo"Release\libclucene/" %cFlags% ^
 &Set lFlags=libsword.lib /nologo /out:"Release\libclucene.lib" /libpath:"..\..\swordMK\lib\Release" ^
 &Set objDIR=Release\libclucene

mkdir "%objDIR%"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

Set cFiles1="%MK%\%CPPD%\cluceneMK\src\CLucene\CLMonolithic.cpp"^
 "%MK%\%CPPD%\swordMK\src\utilfuns\win32\dirent.cpp"
 
cl.exe %cFlags% %cFiles1%
 
Set lFiles1=".\%objDIR%\CLMonolithic.obj"^
 ".\%objDIR%\dirent.obj"
link.exe -lib %lFlags% %lFiles1%

rem rmdir /S /Q "%objDIR%"
