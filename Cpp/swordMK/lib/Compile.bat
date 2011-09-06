@ECHO USAGE: Compile.bat [fileName] [exe/dll] (NOTE: fileName is not used; exe or dll selects the type of library to create; dll is default)
@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=dll
if not exist Release mkdir Release

set CPPD=Cpp
set cFlags=
set lFlags=
set cFiles1=
set cFiles2=
set lFiles1=
set lFiles2=

cd "%MK%\%CPPD%\swordMK\lib"
call "%MK%\%CPPD%\versions.bat"

Set cFlags=/nologo /W0 /EHsc /O2 /Zc:wchar_t-^
 /I "%MK%\%CPPD%"^
 /I "%MK%\%CPPD%\%clucene%\src"^
 /I "%MK%\%CPPD%\swordMK\include"^
 /I "%MK%\%CPPD%\swordMK\src\utilfuns\win32"^
 /I "%MK%\%CPPD%\%sword%\include"^
 /I "%MK%\%CPPD%\%sword%\include\internal\regex"^
 /I "%MK%\%CPPD%\%xulrunnerSDK%\xulrunner-sdk\include"^
 /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_LIB" /D "XULSWORD_EXPORTS" /D "_AFXDLL" /D "REGEX_MALLOC" /Zm200 /c
 
Set cFlags=/MT /Fo"Release\libsword/" %cFlags% ^
 &Set lFlags=xpcom.lib xpcomglue_s.lib /nologo /out:"Release\libsword.lib" /libpath:"%MK%/%CPPD%/%xulrunnerSDK%/xulrunner-sdk/sdk/lib" ^
 &Set objDIR=Release\libsword

mkdir "%objDIR%"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Include
set LIB=%LIB%;%ProgramFiles%\Microsoft SDKs\Windows\v6.1\Lib

Set cFiles1=^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\adler32.c"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\cipherfil.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\compress.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\crc32.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\deflate.c"^
 "%MK%\%CPPD%\%sword%\src\modules\tests\echomod.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\encfiltmgr.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\entriesblk.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\ftpparse.c"^
 "%MK%\%CPPD%\%sword%\src\mgr\ftptrans.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbffootnotes.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfheadings.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfhtml.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfhtmlhref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfmorph.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfosis.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfplain.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfredletterwords.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfrtf.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfstrongs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfthml.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfwebif.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\gbfwordjs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\greeklexattribs.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\gzio.c"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\hrefcom\hrefcom.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\infblock.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\infcodes.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\inffast.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\inflate.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\inftrees.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\infutil.c"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\latin1utf16.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\latin1utf8.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\listkey.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\lzsscomprs.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\markupfiltmgr.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisheadings.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisfootnotes.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osishtmlhref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osislemma.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osismorph.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osismorphsegmentation.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisosis.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisplain.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisredletterwords.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisrtf.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisruby.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisscripref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisstrongs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osisvariants.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osiswebif.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\osiswordjs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\papyriplain.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\plainfootnotes.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\plainhtml.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\rawcom\rawcom.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\rawcom4\rawcom4.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\rawfiles\rawfiles.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\genbook\rawgenbook\rawgenbook.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\lexdict\rawld\rawld.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\lexdict\rawld4\rawld4.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\rawstr.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\rawstr4.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\texts\rawtext\rawtext.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\texts\rawtext4\rawtext4.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\rawverse.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\rawverse4.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\regex.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\roman.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\rtfhtml.cpp"
 
cl.exe %cFlags% %cFiles1%

Set cFiles1=^
 "%MK%\%CPPD%\%sword%\src\modules\common\sapphire.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\stringmgr.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\strkey.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\swbasicfilter.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\swbuf.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\swcacher.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\swcipher.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\swcom.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\swcomprs.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\swconfig.cpp"^
 "%MK%\%CPPD%\%sword%\src\frontend\swdisp.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\swfiltermgr.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\genbook\swgenbook.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\swkey.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\lexdict\swld.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\swlocale.cpp"^
 "%MK%\%CPPD%\%sword%\src\frontend\swlog.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\swobject.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\swoptfilter.cpp"^
 "%MK%\%CPPD%\%sword%\src\mgr\swsearchable.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\texts\swtext.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\swunicod.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\swversion.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\teihtmlhref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\teiplain.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\teirtf.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlfootnotes.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlgbf.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlheadings.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlhtml.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlhtmlhref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmllemma.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlmorph.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlosis.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlplain.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlrtf.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlscripref.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlstrongs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlvariants.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlwebif.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\thmlwordjs.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\treekey.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\treekeyidx.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\trees.c"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\uncompr.c"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\unicodertf.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\url.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf16utf8.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8arabicpoints.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8arshaping.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8bidireorder.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8cantillation.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8greekaccents.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8hebrewpoints.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8html.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8latin1.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8nfc.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8nfkd.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8transliterator.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\filters\utf8utf16.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\utilstr.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\utilxml.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\versekey.cpp"^
 "%MK%\%CPPD%\%sword%\src\keys\versetreekey.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\comments\zcom\zcom.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\zipcomprs.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\lexdict\zld\zld.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\common\zstr.cpp"^
 "%MK%\%CPPD%\%sword%\src\modules\texts\ztext\ztext.cpp"^
 "%MK%\%CPPD%\%sword%\src\utilfuns\zlib\zutil.c"^
 "%MK%\%CPPD%\%sword%\src\modules\common\zverse.cpp"

cl.exe %cFlags% %cFiles1%

Set cFiles1=^
 "%MK%\%CPPD%\swordMK\src\mgr\filemgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\mgr\installmgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\mgr\localemgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\mgr\markupfiltmgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\mgr\swmgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\mgr\versemgr.cpp"^
 "%MK%\%CPPD%\swordMK\src\modules\swmodule.cpp"^
 "%MK%\%CPPD%\swordMK\src\utilfuns\zlib\untgz.c"
 
cl.exe %cFlags% %cFiles1%
 
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
 ".\%objDIR%\zverse.obj"

link.exe -lib %lFlags% %lFiles1% %lFiles2%

rem rmdir /S /Q "%objDIR%"
