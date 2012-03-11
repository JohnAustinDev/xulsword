@ECHO USAGE: Compile.bat [fileName] [NOSECURITY or DUMPCODES] (NOTE: fileName is not used)
if exist ".\Release" rmdir /S /Q ".\Release"
mkdir ".\Release"
set CPPD=Cpp

::set cdbg=d /Zi /DEBUG
::set ldbg=/ASSEMBLYDEBUG /DEBUG
set cdbg= /O2
set ldbg=
set cFlags=
set lFlags=

call versions.bat

@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=undefined

Set NOSECURITY=
Set SECURITYCPP=".\security.cpp"
Set SECURITYOBJ=".\Release\security.obj"
if %arg1%==NOSECURITY Set NOSECURITY=/D "NOSECURITY"& Set SECURITYCPP=& Set SECURITYOBJ=

Set cFlags=/nologo /LD%cdbg% /EHsc /W0^
 /I ".\\"^
 /I "%clucene%\src"^
 /I "%sword%\include"^
 /I "%sword%\include\internal\regex"^
 /FI "fileops.h"^
 /FI "windefs_sword.h"^
 %NOSECURITY% /D WIN32 /D "_WINDOWS" /D "USELUCENE" /D "_CL_HAVE_DIRENT_H" /D REGEX_MALLOC /D "WIN32_LEAN_AND_MEAN" /D "UNICODE" /D "_UNICODE" /D "_WINDLL" /D "_USRDLL" /D "_CRT_SECURE_NO_DEPRECATE" /Fp"Release/xulsword.pch" /Fo"Release/" /c
 
Set cFiles=%SECURITYCPP%^
 ".\xulsword.cpp"^
 ".\dirent.cpp"^
 ".\fileops.cpp"^
 ".\swordMK\swmodule.cpp"
 
Set lFlags=libsword.lib libclucene.lib /nologo /dll /incremental:no /manifest /manifestfile:"Release\xulsword.dll.manifest" /implib:"Release\xulsword.lib" /pdb:"Release/xulsword.pdb" /out:".\Release\xulsword.dll" /libpath:".\swordMK\lib\Release" /libpath:".\cluceneMK\lib\Release"
Set lFiles=%ldbg% %SECURITYOBJ%^
 ".\Release\xulsword.obj"^
 ".\Release\dirent.obj"^
 ".\Release\fileops.obj"^
 ".\Release\swmodule.obj"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
if exist ".\Release\xulsword.dll" del ".\Release\xulsword.dll"
cl.exe %cFlags% %cFiles%
link.exe %lFiles% %lFlags%
mt.exe -manifest "Release\xulsword.dll.manifest" -outputresource:"Release\xulsword.dll";2

echo off
if not exist Release\xulsword.dll echo COMPILE FAILED& goto FINISH

ECHO Moving new xulsword.dll to xulrunner dir...
if not exist "..\build-files\%Name%\development" mkdir "..\build-files\%Name%\development"
copy /Y ".\Release\xulsword.dll" ..\build-files\%Name%\development\

:FINISH