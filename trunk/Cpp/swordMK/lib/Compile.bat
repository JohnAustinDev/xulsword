@ECHO USAGE: Compile.bat [fileName] [exe/dll] (NOTE: fileName is not used; exe or dll selects the type of library to create; dll is default)
@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=dll
if exist .\Release del /S /Q .\Release
mkdir .\Release

set CPPD=Cpp
set cFlags=
set lFlags=
set cFiles1=
set cFiles2=
set lFiles1=
set lFiles2=

call "..\..\versions.bat"

Set cFlags=/nologo /W0 /EHsc /O2^
 /I "%clucene%\src"^
 /I "..\..\swordMK\src\utilfuns\win32"^
 /I "%sword%\include"^
 /I "%sword%\include\internal\regex"^
 /FI "fileops.h"^
 /FI "redefs_sword.h"^
 /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_LIB" /D "XULSWORD_EXPORTS" /D "_AFXDLL" /D "REGEX_MALLOC" /Zm200 /c
 
Set cFlags=/MT /Fo"Release\libsword/" %cFlags%
Set lFlags=/nologo /out:"Release\libsword.lib"
Set objDIR=Release\libsword

mkdir "%objDIR%"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

Set cFiles1=^
 "%sword%\src\utilfuns\zlib\adler32.c"^
 "%sword%\src\modules\filters\cipherfil.cpp"^
 "%sword%\src\utilfuns\zlib\compress.c"^
 "%sword%\src\utilfuns\zlib\crc32.c"^
 "%sword%\src\utilfuns\zlib\deflate.c"^
 "%sword%\src\modules\tests\echomod.cpp"^
 "%sword%\src\mgr\encfiltmgr.cpp"^
 "%sword%\src\modules\common\entriesblk.cpp"^
 "%sword%\src\utilfuns\ftpparse.c"^
 "%sword%\src\mgr\ftptrans.cpp"^
 "%sword%\src\modules\filters\gbffootnotes.cpp"^
 "%sword%\src\modules\filters\gbfheadings.cpp"^
 "%sword%\src\modules\filters\gbfhtml.cpp"^
 "%sword%\src\modules\filters\gbfhtmlhref.cpp"^
 "%sword%\src\modules\filters\gbfmorph.cpp"^
 "%sword%\src\modules\filters\gbfosis.cpp"^
 "%sword%\src\modules\filters\gbfplain.cpp"^
 "%sword%\src\modules\filters\gbfredletterwords.cpp"^
 "%sword%\src\modules\filters\gbfrtf.cpp"^
 "%sword%\src\modules\filters\gbfstrongs.cpp"^
 "%sword%\src\modules\filters\gbfthml.cpp"^
 "%sword%\src\modules\filters\gbfwebif.cpp"^
 "%sword%\src\modules\filters\gbfwordjs.cpp"^
 "%sword%\src\modules\filters\greeklexattribs.cpp"^
 "%sword%\src\utilfuns\zlib\gzio.c"^
 "%sword%\src\modules\comments\hrefcom\hrefcom.cpp"^
 "%sword%\src\utilfuns\zlib\infblock.c"^
 "%sword%\src\utilfuns\zlib\infcodes.c"^
 "%sword%\src\utilfuns\zlib\inffast.c"^
 "%sword%\src\utilfuns\zlib\inflate.c"^
 "%sword%\src\utilfuns\zlib\inftrees.c"^
 "%sword%\src\utilfuns\zlib\infutil.c"^
 "%sword%\src\modules\filters\latin1utf16.cpp"^
 "%sword%\src\modules\filters\latin1utf8.cpp"^
 "%sword%\src\keys\listkey.cpp"^
 "%sword%\src\modules\common\lzsscomprs.cpp"^
 "%sword%\src\mgr\markupfiltmgr.cpp"^
 "%sword%\src\modules\filters\osisheadings.cpp"^
 "%sword%\src\modules\filters\osisfootnotes.cpp"^
 "%sword%\src\modules\filters\osishtmlhref.cpp"^
 "%sword%\src\modules\filters\osislemma.cpp"^
 "%sword%\src\modules\filters\osismorph.cpp"^
 "%sword%\src\modules\filters\osismorphsegmentation.cpp"^
 "%sword%\src\modules\filters\osisosis.cpp"^
 "%sword%\src\modules\filters\osisplain.cpp"^
 "%sword%\src\modules\filters\osisredletterwords.cpp"^
 "%sword%\src\modules\filters\osisrtf.cpp"^
 "%sword%\src\modules\filters\osisruby.cpp"^
 "%sword%\src\modules\filters\osisscripref.cpp"^
 "%sword%\src\modules\filters\osisstrongs.cpp"^
 "%sword%\src\modules\filters\osisvariants.cpp"^
 "%sword%\src\modules\filters\osiswebif.cpp"^
 "%sword%\src\modules\filters\osiswordjs.cpp"^
 "%sword%\src\modules\filters\papyriplain.cpp"^
 "%sword%\src\modules\filters\plainfootnotes.cpp"^
 "%sword%\src\modules\filters\plainhtml.cpp"^
 "%sword%\src\modules\comments\rawcom\rawcom.cpp"^
 "%sword%\src\modules\comments\rawcom4\rawcom4.cpp"^
 "%sword%\src\modules\comments\rawfiles\rawfiles.cpp"^
 "%sword%\src\modules\genbook\rawgenbook\rawgenbook.cpp"^
 "%sword%\src\modules\lexdict\rawld\rawld.cpp"^
 "%sword%\src\modules\lexdict\rawld4\rawld4.cpp"^
 "%sword%\src\modules\common\rawstr.cpp"^
 "%sword%\src\modules\common\rawstr4.cpp"^
 "%sword%\src\modules\texts\rawtext\rawtext.cpp"^
 "%sword%\src\modules\texts\rawtext4\rawtext4.cpp"^
 "%sword%\src\modules\common\rawverse.cpp"^
 "%sword%\src\modules\common\rawverse4.cpp"^
 "%sword%\src\utilfuns\regex.c"^
 "%sword%\src\utilfuns\roman.cpp"^
 "%sword%\src\modules\filters\rtfhtml.cpp"
 
cl.exe %cFlags% %cFiles1%

Set cFiles1=^
 "%sword%\src\modules\common\sapphire.cpp"^
 "%sword%\src\keys\strkey.cpp"^
 "%sword%\src\modules\filters\swbasicfilter.cpp"^
 "%sword%\src\utilfuns\swbuf.cpp"^
 "%sword%\src\mgr\swcacher.cpp"^
 "%sword%\src\modules\common\swcipher.cpp"^
 "%sword%\src\modules\comments\swcom.cpp"^
 "%sword%\src\modules\common\swcomprs.cpp"^
 "%sword%\src\mgr\swconfig.cpp"^
 "%sword%\src\frontend\swdisp.cpp"^
 "%sword%\src\mgr\swfiltermgr.cpp"^
 "%sword%\src\modules\genbook\swgenbook.cpp"^
 "%sword%\src\keys\swkey.cpp"^
 "%sword%\src\modules\lexdict\swld.cpp"^
 "%sword%\src\mgr\swlocale.cpp"^
 "%sword%\src\frontend\swlog.cpp"^
 "%sword%\src\utilfuns\swobject.cpp"^
 "%sword%\src\modules\filters\swoptfilter.cpp"^
 "%sword%\src\mgr\swsearchable.cpp"^
 "%sword%\src\modules\texts\swtext.cpp"^
 "%sword%\src\utilfuns\swunicod.cpp"^
 "%sword%\src\utilfuns\swversion.cpp"^
 "%sword%\src\modules\filters\teihtmlhref.cpp"^
 "%sword%\src\modules\filters\teiplain.cpp"^
 "%sword%\src\modules\filters\teirtf.cpp"^
 "%sword%\src\modules\filters\thmlfootnotes.cpp"^
 "%sword%\src\modules\filters\thmlgbf.cpp"^
 "%sword%\src\modules\filters\thmlheadings.cpp"^
 "%sword%\src\modules\filters\thmlhtml.cpp"^
 "%sword%\src\modules\filters\thmlhtmlhref.cpp"^
 "%sword%\src\modules\filters\thmllemma.cpp"^
 "%sword%\src\modules\filters\thmlmorph.cpp"^
 "%sword%\src\modules\filters\thmlosis.cpp"^
 "%sword%\src\modules\filters\thmlplain.cpp"^
 "%sword%\src\modules\filters\thmlrtf.cpp"^
 "%sword%\src\modules\filters\thmlscripref.cpp"^
 "%sword%\src\modules\filters\thmlstrongs.cpp"^
 "%sword%\src\modules\filters\thmlvariants.cpp"^
 "%sword%\src\modules\filters\thmlwebif.cpp"^
 "%sword%\src\modules\filters\thmlwordjs.cpp"^
 "%sword%\src\keys\treekey.cpp"^
 "%sword%\src\keys\treekeyidx.cpp"^
 "%sword%\src\utilfuns\zlib\trees.c"^
 "%sword%\src\utilfuns\zlib\uncompr.c"^
 "%sword%\src\modules\filters\unicodertf.cpp"^
 "%sword%\src\utilfuns\url.cpp"^
 "%sword%\src\modules\filters\utf16utf8.cpp"^
 "%sword%\src\modules\filters\utf8arabicpoints.cpp"^
 "%sword%\src\modules\filters\utf8arshaping.cpp"^
 "%sword%\src\modules\filters\utf8bidireorder.cpp"^
 "%sword%\src\modules\filters\utf8cantillation.cpp"^
 "%sword%\src\modules\filters\utf8greekaccents.cpp"^
 "%sword%\src\modules\filters\utf8hebrewpoints.cpp"^
 "%sword%\src\modules\filters\utf8html.cpp"^
 "%sword%\src\modules\filters\utf8latin1.cpp"^
 "%sword%\src\modules\filters\utf8nfc.cpp"^
 "%sword%\src\modules\filters\utf8nfkd.cpp"^
 "%sword%\src\modules\filters\utf8transliterator.cpp"^
 "%sword%\src\modules\filters\utf8utf16.cpp"^
 "%sword%\src\utilfuns\utilstr.cpp"^
 "%sword%\src\utilfuns\utilxml.cpp"^
 "%sword%\src\keys\versekey.cpp"^
 "%sword%\src\keys\versetreekey.cpp"^
 "%sword%\src\modules\comments\zcom\zcom.cpp"^
 "%sword%\src\modules\common\zipcomprs.cpp"^
 "%sword%\src\modules\lexdict\zld\zld.cpp"^
 "%sword%\src\modules\common\zstr.cpp"^
 "%sword%\src\modules\texts\ztext\ztext.cpp"^
 "%sword%\src\utilfuns\zlib\zutil.c"^
 "%sword%\src\modules\common\zverse.cpp"^
 "%sword%\src\modules\filters\osisxhtml.cpp"^
 "%sword%\src\modules\filters\gbfxhtml.cpp"^
 "%sword%\src\modules\filters\thmlxhtml.cpp"

cl.exe %cFlags% %cFiles1%

Set cFiles1=^
 "%sword%\src\mgr\filemgr.cpp"^
 "%sword%\src\mgr\installmgr.cpp"^
 "%sword%\src\mgr\localemgr.cpp"^
 "%sword%\src\mgr\markupfiltmgr.cpp"^
 "%sword%\src\mgr\swmgr.cpp"^
 "%sword%\src\mgr\versemgr.cpp"^
 "%sword%\src\utilfuns\zlib\untgz.c"^
 "%sword%\src\mgr\stringmgr.cpp"
 
cl.exe %cFlags% %cFiles1%

cl.exe %cFlags% /FI "demo\stdafx.h"  "%sword%\src\modules\swmodule.cpp"

Set lFiles1=^
 ".\%objDIR%\adler32.obj"^
 ".\%objDIR%\cipherfil.obj"^
 ".\%objDIR%\compress.obj"^
 ".\%objDIR%\crc32.obj"^
 ".\%objDIR%\deflate.obj"^
 ".\%objDIR%\echomod.obj"^
 ".\%objDIR%\encfiltmgr.obj"^
 ".\%objDIR%\entriesblk.obj"^
 ".\%objDIR%\filemgr.obj"^
 ".\%objDIR%\ftpparse.obj"^
 ".\%objDIR%\ftptrans.obj"^
 ".\%objDIR%\gbffootnotes.obj"^
 ".\%objDIR%\gbfheadings.obj"^
 ".\%objDIR%\gbfhtml.obj"^
 ".\%objDIR%\gbfhtmlhref.obj"^
 ".\%objDIR%\gbfmorph.obj"^
 ".\%objDIR%\gbfosis.obj"^
 ".\%objDIR%\gbfplain.obj"^
 ".\%objDIR%\gbfredletterwords.obj"^
 ".\%objDIR%\gbfrtf.obj"^
 ".\%objDIR%\gbfstrongs.obj"^
 ".\%objDIR%\gbfthml.obj"^
 ".\%objDIR%\gbfwebif.obj"^
 ".\%objDIR%\gbfwordjs.obj"^
 ".\%objDIR%\greeklexattribs.obj"^
 ".\%objDIR%\gzio.obj"^
 ".\%objDIR%\hrefcom.obj"^
 ".\%objDIR%\infblock.obj"^
 ".\%objDIR%\infcodes.obj"^
 ".\%objDIR%\inffast.obj"^
 ".\%objDIR%\inflate.obj"^
 ".\%objDIR%\inftrees.obj"^
 ".\%objDIR%\infutil.obj"^
 ".\%objDIR%\installmgr.obj"^
 ".\%objDIR%\latin1utf16.obj"^
 ".\%objDIR%\latin1utf8.obj"^
 ".\%objDIR%\listkey.obj"^
 ".\%objDIR%\localemgr.obj"^
 ".\%objDIR%\lzsscomprs.obj"^
 ".\%objDIR%\markupfiltmgr.obj"^
 ".\%objDIR%\osisfootnotes.obj"^
 ".\%objDIR%\osisheadings.obj"^
 ".\%objDIR%\osishtmlhref.obj"^
 ".\%objDIR%\osislemma.obj"^
 ".\%objDIR%\osismorph.obj"^
 ".\%objDIR%\osismorphsegmentation.obj"^
 ".\%objDIR%\osisosis.obj"^
 ".\%objDIR%\osisplain.obj"^
 ".\%objDIR%\osisredletterwords.obj"^
 ".\%objDIR%\osisrtf.obj"^
 ".\%objDIR%\osisruby.obj"^
 ".\%objDIR%\osisscripref.obj"^
 ".\%objDIR%\osisstrongs.obj"^
 ".\%objDIR%\osisvariants.obj"^
 ".\%objDIR%\osiswebif.obj"^
 ".\%objDIR%\osiswordjs.obj"^
 ".\%objDIR%\papyriplain.obj"^
 ".\%objDIR%\plainfootnotes.obj"^
 ".\%objDIR%\plainhtml.obj"^
 ".\%objDIR%\rawcom.obj"^
 ".\%objDIR%\rawcom4.obj"^
 ".\%objDIR%\rawfiles.obj"^
 ".\%objDIR%\rawgenbook.obj"^
 ".\%objDIR%\rawld.obj"^
 ".\%objDIR%\rawld4.obj"^
 ".\%objDIR%\rawstr.obj"^
 ".\%objDIR%\rawstr4.obj"^
 ".\%objDIR%\rawtext.obj"^
 ".\%objDIR%\rawtext4.obj"^
 ".\%objDIR%\rawverse.obj"^
 ".\%objDIR%\rawverse4.obj"^
 ".\%objDIR%\regex.obj"^
 ".\%objDIR%\roman.obj"^
 ".\%objDIR%\rtfhtml.obj"

Set lFiles2=^
 ".\%objDIR%\sapphire.obj"^
 ".\%objDIR%\stringmgr.obj"^
 ".\%objDIR%\strkey.obj"^
 ".\%objDIR%\swbasicfilter.obj"^
 ".\%objDIR%\swbuf.obj"^
 ".\%objDIR%\swcacher.obj"^
 ".\%objDIR%\swcipher.obj"^
 ".\%objDIR%\swcom.obj"^
 ".\%objDIR%\swcomprs.obj"^
 ".\%objDIR%\swconfig.obj"^
 ".\%objDIR%\swdisp.obj"^
 ".\%objDIR%\swfiltermgr.obj"^
 ".\%objDIR%\swgenbook.obj"^
 ".\%objDIR%\swkey.obj"^
 ".\%objDIR%\swld.obj"^
 ".\%objDIR%\swlocale.obj"^
 ".\%objDIR%\swlog.obj"^
 ".\%objDIR%\swmgr.obj"^
 ".\%objDIR%\swmodule.obj"^
 ".\%objDIR%\swobject.obj"^
 ".\%objDIR%\swoptfilter.obj"^
 ".\%objDIR%\swsearchable.obj"^
 ".\%objDIR%\swtext.obj"^
 ".\%objDIR%\swunicod.obj"^
 ".\%objDIR%\swversion.obj"^
 ".\%objDIR%\teihtmlhref.obj"^
 ".\%objDIR%\teiplain.obj"^
 ".\%objDIR%\teirtf.obj"^
 ".\%objDIR%\thmlfootnotes.obj"^
 ".\%objDIR%\thmlgbf.obj"^
 ".\%objDIR%\thmlheadings.obj"^
 ".\%objDIR%\thmlhtml.obj"^
 ".\%objDIR%\thmlhtmlhref.obj"^
 ".\%objDIR%\thmllemma.obj"^
 ".\%objDIR%\thmlmorph.obj"^
 ".\%objDIR%\thmlosis.obj"^
 ".\%objDIR%\thmlplain.obj"^
 ".\%objDIR%\thmlrtf.obj"^
 ".\%objDIR%\thmlscripref.obj"^
 ".\%objDIR%\thmlstrongs.obj"^
 ".\%objDIR%\thmlvariants.obj"^
 ".\%objDIR%\thmlwebif.obj"^
 ".\%objDIR%\thmlwordjs.obj"^
 ".\%objDIR%\treekey.obj"^
 ".\%objDIR%\treekeyidx.obj"^
 ".\%objDIR%\trees.obj"^
 ".\%objDIR%\uncompr.obj"^
 ".\%objDIR%\unicodertf.obj"^
 ".\%objDIR%\untgz.obj"^
 ".\%objDIR%\url.obj"^
 ".\%objDIR%\utf16utf8.obj"^
 ".\%objDIR%\utf8arabicpoints.obj"^
 ".\%objDIR%\utf8arshaping.obj"^
 ".\%objDIR%\utf8bidireorder.obj"^
 ".\%objDIR%\utf8cantillation.obj"^
 ".\%objDIR%\utf8greekaccents.obj"^
 ".\%objDIR%\utf8hebrewpoints.obj"^
 ".\%objDIR%\utf8html.obj"^
 ".\%objDIR%\utf8latin1.obj"^
 ".\%objDIR%\utf8nfc.obj"^
 ".\%objDIR%\utf8nfkd.obj"^
 ".\%objDIR%\utf8transliterator.obj"^
 ".\%objDIR%\utf8utf16.obj"^
 ".\%objDIR%\utilstr.obj"^
 ".\%objDIR%\utilxml.obj"^
 ".\%objDIR%\versekey.obj"^
 ".\%objDIR%\versemgr.obj"^
 ".\%objDIR%\versetreekey.obj"^
 ".\%objDIR%\zcom.obj"^
 ".\%objDIR%\zipcomprs.obj"^
 ".\%objDIR%\zld.obj"^
 ".\%objDIR%\zstr.obj"^
 ".\%objDIR%\ztext.obj"^
 ".\%objDIR%\zutil.obj"^
 ".\%objDIR%\zverse.obj"^
 ".\%objDIR%\osisxhtml.obj"^
 ".\%objDIR%\gbfxhtml.obj"^
 ".\%objDIR%\thmlxhtml.obj"

link.exe -lib %lFlags% %lFiles1% %lFiles2%

exit
