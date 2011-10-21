@ECHO USAGE: Compile.bat

@echo off
set CPPD=Cpp

cd "%MK%\%CPPD%\runPortable"
call ..\versions.bat
rmdir /s /Q Release
mkdir Release

Set cFlags=/MT /O2 /W1 /EHsc /nologo /Wp64 /c /D "NDEBUG" /D "_UNICODE" /D "UNICODE" /D "_CRT_SECURE_NO_DEPRECATE" /Fo"Release\\" /TP 
Set cFiles="runPortable.cpp"
Set lFlags=/OUT:"Release\runPortable.exe" /INCREMENTAL:NO /NOLOGO /MANIFEST /MANIFESTFILE:"Release\runPortable.exe.intermediate.manifest" /SUBSYSTEM:WINDOWS User32.lib
Set lFiles="Release\runPortable.obj" "Release\runPortable.res"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
rc.exe /l 0x409 /fo".\Release\runPortable.res" ".\runPortable.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest "Release\runPortable.exe.intermediate.manifest" -outputresource:"Release\runPortable.exe";1

