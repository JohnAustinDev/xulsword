REM USAGE: CompileAll.bat [NOSECURITY]

set CPPD=Cpp

set cdrun=true;
set crclib=true;
set lucene=true;
set libsword=true;
set xulsword=true;
set runPortable=true;
set runMK=true;

cd "%MK%\%CPPD%"
call versions.bat

@if not %cdrun%==true goto NO_CDRUN
@cd ".\cdrun"
@call Compile.bat
@cd "..\"
:NO_CDRUN

@if not %crclib%==true goto NO_CRCLIB
@cd "crclib"
@call Compile.bat
@cd ".."
:NO_CRCLIB

@if not %libsword%==true goto NO_LIBSWORD
@cd ".\swordMK\lib"
@call Compile.bat
@cd "..\.."
:NO_LIBSWORD

@if not %lucene%==true goto NO_CLUCENE
@cd ".\cluceneMK\lib"
@call Compile.bat
@cd "..\.."
:NO_CLUCENE

@if not %runPortable%==true goto NO_RUNPORT
@cd ".\runPortable"
@call Compile.bat
@cd "..\"
:NO_RUNPORT

@if not %runMK%==true goto NO_RUNMK
@cd ".\runMK"
@call Compile.bat
@cd "..\"
:NO_RUNMK

@if not %xulsword%==true goto NO_XULSWORD
@call Compile.bat %1
:NO_XULSWORD
