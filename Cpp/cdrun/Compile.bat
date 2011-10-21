@ECHO USAGE: Compile.bat

@echo off
set CPPD=Cpp

cd "%MK%\%CPPD%\cdrun"
call ..\versions.bat
rmdir /s /Q Release
mkdir Release

Set cFlags=/MT /O2 /W1 /EHsc /nologo /Wp64 /c /D "NDEBUG" /D "_UNICODE" /D "UNICODE" /D "_CRT_SECURE_NO_DEPRECATE" /D "USE_STL" /Fo"Release\\" /TP
Set cFiles="w32process.cpp" "cdrun.cpp"
Set lFlags=/OUT:"Release\cdrun.exe" /INCREMENTAL:NO /NOLOGO /MANIFEST /MANIFESTFILE:"Release\cdrun.exe.intermediate.manifest" /SUBSYSTEM:WINDOWS Advapi32.lib User32.lib
Set lFiles="Release\w32process.obj" "Release\cdrun.obj" "Release\CDRunApp.res"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
rc.exe /l 0x409 /fo".\Release\CDRunApp.res" ".\CDRunApp.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest "Release\cdrun.exe.intermediate.manifest" -outputresource:"Release\cdrun.exe";1
