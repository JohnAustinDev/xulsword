@ECHO USAGE: Compile.bat

@echo off
set CPPD=Cpp

cd "%MK%\%CPPD%\runMK"
rmdir /s /Q Release
mkdir Release

Set cFlags=/O2 /W1 /D "USE_STL" /D "NDEBUG" /D "_UNICODE" /D "UNICODE" /D "_CRT_SECURE_NO_DEPRECATE" /EHsc /MT /Fo"Release\\" /Fd"Release\vc80.pdb" /FR"Release\\" /nologo /c /Wp64 /TP
Set cFiles="w32process.cpp" "runMK.cpp"
Set lFlags=/OUT:"Release\runMK.exe" /INCREMENTAL:NO /NOLOGO /MANIFEST /MANIFESTFILE:"Release\runMK.exe.intermediate.manifest" /PDB:"Release\runMK.pdb" /SUBSYSTEM:WINDOWS /OPT:REF kernel32.lib Advapi32.lib
Set lFiles="Release\w32process.obj" "Release\runMK.obj" "Release\CDRunApp.res"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Include
set LIB=%LIB%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Lib

echo on
rc.exe /l 0x409 /fo".\Release\CDRunApp.res" /d "NDEBUG" /d "_AFXDLL" ".\CDRunApp.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest "Release\runMK.exe.intermediate.manifest" -outputresource:"Release\runMK.exe";1

