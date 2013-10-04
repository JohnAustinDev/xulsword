REM USAGE: CompileAll.bat [NOSECURITY]

@echo off
cd %~dp0
call Versions.bat

call "%MK%\Cpp\cluceneMK\windows\lib\Compile.bat"

call "%MK%\Cpp\swordMK\windows\lib\Compile.bat"

call "%MK%\Cpp\windows\Compile.bat" %1

call "%MK%\Cpp\windows\startup\Compile.bat"

call "%MK%\Cpp\windows\cdrun\Compile.bat"

cd "%MK%\Cpp\windows"