@ECHO USAGE: Compile.bat

@echo off
cd %~dp0
call ..\..\..\windows\Versions.bat

:: Make sure our compiler environment is configured
if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

if exist .\Release rmdir /S /Q .\Release
mkdir .\Release

::set cdbg=d /Zi /DEBUG
set cdbg= /O2
set cFlags=
set lFlags=

Set cFlags=/nologo /EHsc^
 /I "%MK%\Cpp\src\windows"^
 /I "%clucene%\src"^
 /FI "%clucene%\src\CLucene\StdHeader.cpp"^
 /FI "fileops.h"^
 /FI "windefs_clucene.h"^
 /D _CL_HAVE_DIRENT_H /D WIN32_LEAN_AND_MEAN /D UNICODE /D _UNICODE /D _LIB /D _CRT_SECURE_NO_DEPRECATE /GF /c

Set cFlags=/MT%cdbg% /Fo".\Release\libclucene/" %cFlags%
Set lFlags=/nologo /out:".\Release\libclucene.lib"

Set objDIR=Release\libclucene
mkdir "%objDIR%"

Set cFiles1="%MK%\Cpp\cluceneMK\CLMonolithic.cpp"
 
cl.exe %cFlags% %cFiles1%
 
Set lFiles1="%objDIR%\CLMonolithic.obj"

link.exe -lib %lFlags% %lFiles1%

echo.
if exist ".\Release\libclucene.lib" (echo ----------- libclucene.lib SUCCESS! ) else (echo ----------- libclucene.lib COMPILE FAILED...)
echo.