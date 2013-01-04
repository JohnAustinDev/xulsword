@ECHO USAGE: Compile.bat

@echo off
cd "%MK%\Cpp\windows\runMK"
call "%MK%\Cpp\windows\Versions.bat"

:: Make sure our compiler environment is configured
if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

if exist .\Release rmdir /S /Q .\Release
mkdir .\Release

Set cFlags=/nologo /MT /EHsc /W0 /Wp64^
 /I "%MK%\Cpp\src\include"^
 /D NDEBUG /D _UNICODE /D UNICODE /D _CRT_SECURE_NO_DEPRECATE /Fo".\Release\\" /c
 
Set cFiles="%MK%\Cpp\windows\runMK\runMK.cpp"

Set lFlags=/OUT:".\Release\runMK.exe" /INCREMENTAL:NO /NOLOGO^
 /MANIFEST /MANIFESTFILE:".\Release\runMK.exe.intermediate.manifest"^
 /SUBSYSTEM:WINDOWS Advapi32.lib User32.lib
 
Set lFiles=".\Release\runMK.obj" ".\Release\runMK.res"

echo on
rc.exe /l 0x409 /fo".\Release\runMK.res" ".\runMK.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest ".\Release\runMK.exe.intermediate.manifest" -outputresource:".\Release\runMK.exe";1
@echo off

echo.
if exist ".\Release\runMK.exe" (echo ----------- runMK.exe SUCCESS!) else (echo ----------- runMK.exe COMPILE FAILED...)
echo.