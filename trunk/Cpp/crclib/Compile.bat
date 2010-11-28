@ECHO USAGE: Compile.bat

@echo off

mkdir Release

Set cFlags=/nologo /W2 /MT /EHsc /O2 /Zc:wchar_t- /Fo"Release\Crc32Static.obj" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_USRDLL" /D "XULSWORD_EXPORTS" /D "_WINDLL" /D "_AFXDLL" /D "_CRT_SECURE_NO_DEPRECATE" /c
Set cFiles="Crc32Static.cpp"
Set lFlags=/nologo /out:".\Release\crclib.lib"
Set lFiles=".\Release\Crc32Static.obj"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Include
set LIB=%LIB%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Lib

echo on
cl.exe %cFlags% %cFiles%
link.exe -lib %lFlags% %lFiles%
