@ECHO USAGE: Compile.bat

@echo off
cd "%MK%\Cpp\windows\runPortable"
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

Set cFiles="%MK%\Cpp\windows\runPortable\runPortable.cpp"

Set lFlags=/OUT:"Release\runPortable.exe" /INCREMENTAL:NO /NOLOGO^
 /MANIFEST /MANIFESTFILE:"Release\runPortable.exe.intermediate.manifest"^
 /SUBSYSTEM:WINDOWS User32.lib

Set lFiles=".\Release\runPortable.obj" ".\Release\runPortable.res"

echo on
rc.exe /l 0x409 /fo".\Release\runPortable.res" ".\runPortable.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest ".\Release\runPortable.exe.intermediate.manifest" -outputresource:".\Release\runPortable.exe";1
@echo off

echo.
if exist ".\Release\runPortable.exe" (echo ----------- runPortable.exe SUCCESS!) else (echo ----------- runPortable.exe COMPILE FAILED...)
echo.
