echo off
cd "%MK%\build"

call "%MK%\build\scriptNoRun\Compile.bat"
cd "%MK%\build"

ECHO --- CHECKING IF BIBLE TEXTS NEED TO BE RE-ENCRYPTED
if not defined bibleTextEncryptionKey goto UPDATE

ECHO --- ENCRYPTING BIBLE TEXTS with %bibleTextEncryptionKey%
set secMod=false
if %useSecurityModule%==true set secMod=true
call "%MK%\build\scriptNoRun\EncryptTexts.pl" "%MK%" "%MKS%" "%MKO%" %secMod% %XSMversion% %bibleTextEncryptionKey% "%MKS%\moduleDev\keys.txt" "%MK%\Cpp\Release\chromeCode.h" %encryptedTexts%

:UPDATE
call "%MK%\build\scriptNoRun\UpdateModulesLocales.pl" "%MK%" "%MKS%" "%MKO%" %AllLocales% %IncludeLocales% %includeIndexes% %XSMversion% %MinProgversionForXSM% %includeBibles% %includeCommentaries% %includeGenBooks% %includeDevotionals% %includeLexDict%
