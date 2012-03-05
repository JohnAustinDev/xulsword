@ECHO USAGE: Compile.bat

@echo off
set CPPD=Cpp

call ..\versions.bat
if exist .\Release del /S /Q .\Release
mkdir .\Release

Set cFlags=/MT /O2 /W1 /EHsc /nologo /Wp64 /c /D "NDEBUG" /D "_UNICODE" /D "UNICODE" /D "_CRT_SECURE_NO_DEPRECATE" /Fo"Release\\" /TP 
Set cFiles="runMK.cpp"
Set lFlags=/OUT:"Release\runMK.exe" /INCREMENTAL:NO /NOLOGO /MANIFEST /MANIFESTFILE:"Release\runMK.exe.intermediate.manifest" /SUBSYSTEM:WINDOWS Advapi32.lib User32.lib
Set lFiles="Release\runMK.obj" "Release\runMK.res"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
rc.exe /l 0x409 /fo".\Release\runMK.res" ".\runMK.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest "Release\runMK.exe.intermediate.manifest" -outputresource:"Release\runMK.exe";1
