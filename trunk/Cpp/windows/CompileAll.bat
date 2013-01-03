REM USAGE: CompileAll.bat [NOSECURITY]

set cdrun=true;
set lucene=true;
set libsword=true;
set xulsword=true;
set runPortable=true;
set runMK=true;

cd "%MK%\Cpp\windows"
call Versions.bat

@if not %cdrun%==true goto NO_CDRUN
@cd "..\src\windows\startup\cdrun"
@call Compile.bat
@cd "%MK%\Cpp\windows"
:NO_CDRUN

@if not %libsword%==true goto NO_LIBSWORD
@cd "..\swordMK\windows\lib"
@call Compile.bat
@cd "%MK%\Cpp\windows"
:NO_LIBSWORD

@if not %lucene%==true goto NO_CLUCENE
@cd "..\cluceneMK\windows\lib"
@call Compile.bat
@cd "%MK%\Cpp\windows"
:NO_CLUCENE

@if not %runPortable%==true goto NO_RUNPORT
@cd "..\windows\runPortable"
@call Compile.bat
@cd "%MK%\Cpp\windows"
:NO_RUNPORT

@if not %runMK%==true goto NO_RUNMK
@cd "..\windows\runMK"
@call Compile.bat
@cd "%MK%\Cpp\windows"
:NO_RUNMK

@if not %xulsword%==true goto NO_XULSWORD
@cd "..\windows"
@call Compile.bat %1
@cd "%MK%\Cpp\windows"
:NO_XULSWORD
