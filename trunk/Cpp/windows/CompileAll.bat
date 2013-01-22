REM USAGE: CompileAll.bat [NOSECURITY]

call "%MK%\Cpp\cluceneMK\windows\lib\Compile.bat"

call "%MK%\Cpp\swordMK\windows\lib\Compile.bat"

call "%MK%\Cpp\windows\Compile.bat" %1

call "%MK%\Cpp\windows\startup\Compile.bat"

call "%MK%\Cpp\windows\cdrun\Compile.bat"

cd "%MK%\Cpp\windows"