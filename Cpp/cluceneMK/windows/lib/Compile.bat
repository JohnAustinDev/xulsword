@ECHO USAGE: Compile.bat [fileName] [exe/dll] (NOTE: fileName is not used; exe or dll selects the type of library to create; dll is default)
@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=dll
if exist .\Release rmdir /S /Q .\Release
mkdir .\Release

::set cdbg=d /Zi /DEBUG
set cdbg= /O2
set CPPD=Cpp
set cFlags=
set lFlags=

call "..\..\versions.bat"

Set cFlags=/nologo /EHsc^
 /I "..\..\\"^
 /I "%clucene%\src"^
 /FI "%clucene%\src\CLucene\StdHeader.cpp"^
 /FI "fileops.h"^
 /FI "windefs_clucene.h"^
 /D "_CL_HAVE_DIRENT_H" /D "WIN32_LEAN_AND_MEAN" /D "UNICODE" /D "_UNICODE" /D "_LIB" /D "_CRT_SECURE_NO_DEPRECATE" /GF /c

rem /FI "../StdHeader.cpp"
rem /FI "fileops.h"^
rem /FI "redefs_clucene.h"^

Set cFlags=/MT%cdbg% /Fo"Release\libclucene/" %cFlags%
Set lFlags=/nologo /out:"Release\libclucene.lib"
Set objDIR=Release\libclucene

mkdir "%objDIR%"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

Set cFiles1="%clucene%\src\Clucene\CLMonolithic.cpp"
 
cl.exe %cFlags% %cFiles1%
 
Set lFiles1=".\%objDIR%\CLMonolithic.obj"

link.exe -lib %lFlags% %lFiles1%

