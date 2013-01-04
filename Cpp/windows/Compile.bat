@ECHO USAGE: Compile.bat [NOSECURITY]

@echo off
cd "%MK%\Cpp\windows"
call "%MK%\Cpp\windows\Versions.bat"

:: Make sure our compiler environment is configured
if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

if exist ".\Release" rmdir /S /Q ".\Release"
mkdir ".\Release"

::set cdbg=d /Zi /DEBUG
::set ldbg=/ASSEMBLYDEBUG /DEBUG
set cdbg= /O2
set ldbg=
set cFlags=
set lFlags=

Set arg1=%1
if not defined arg1 Set arg1=undefined

Set NOSECURITY=
Set SECURITYCPP="%MK%\Cpp\src\security.cpp"
Set SECURITYOBJ=".\Release\security.obj"
if %arg1%==NOSECURITY Set NOSECURITY=/D "NOSECURITY"& Set SECURITYCPP=& Set SECURITYOBJ=

Set cFlags=/nologo /LD%cdbg% /EHsc /W0^
 /I "%MK%\Cpp\src\include"^
 /I "%MK%\Cpp\src\windows"^
 /I "%clucene%\src"^
 /I "%sword%\include"^
 /I "%sword%\include\internal\regex"^
 /FI "fileops.h"^
 /FI "windefs_sword.h"^
 %NOSECURITY% /D WIN32 /D _WINDOWS /D USELUCENE /D _CL_HAVE_DIRENT_H /D REGEX_MALLOC /D WIN32_LEAN_AND_MEAN /D UNICODE /D _UNICODE /D _WINDLL /D _USRDLL /D _CRT_SECURE_NO_DEPRECATE /Fp"Release/xulsword.pch" /Fo".\Release\\" /c
 
Set cFiles=%SECURITYCPP%^
 "%MK%\Cpp\src\xulsword.cpp"^
 "%MK%\Cpp\src\libxulsword.cpp"^
 "%MK%\Cpp\src\windows\dirent.cpp"^
 "%MK%\Cpp\src\windows\fileops.cpp"^
 "%MK%\Cpp\swordMK\swmodule.cpp"^
 "%MK%\Cpp\swordMK\filemgr.cpp"
 
Set lFlags=libsword.lib libclucene.lib /nologo /dll /incremental:no /manifest /manifestfile:"Release\xulsword.dll.manifest" /implib:"Release\xulsword.lib" /pdb:"Release/xulsword.pdb" /out:".\Release\xulsword.dll" /libpath:"..\swordMK\windows\lib\Release" /libpath:"..\cluceneMK\windows\lib\Release"
Set lFiles=%ldbg% %SECURITYOBJ%^
 ".\Release\xulsword.obj"^
 ".\Release\libxulsword.obj"^
 ".\Release\dirent.obj"^
 ".\Release\fileops.obj"^
 ".\Release\swmodule.obj"^
 ".\Release\filemgr.obj"

echo on
cl.exe %cFlags% %cFiles%
link.exe %lFiles% %lFlags%
mt.exe -manifest ".\Release\xulsword.dll.manifest" -outputresource:".\Release\xulsword.dll";2
@echo off

echo.
if exist ".\Release\xulsword.dll" (echo ----------- xulsword.dll SUCCESS!) else (echo ----------- xulsword.dll COMPILE FAILED...)
echo.

:FINISH
