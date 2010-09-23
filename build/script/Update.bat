echo off
cd "%MK%\build"

call "%MK%\build\script\Compile.bat"
cd "%MK%\build"

ECHO --- CHECKING IF BIBLE TEXTS NEED TO BE RE-ENCRYPTED
if not defined bibleTextEncryptionKey goto UPDATE

ECHO --- ENCRYPTING BIBLE TEXTS; VISIBLE KEY=%bibleTextEncryptionKey%
set secMod=false
if %useSecurityModule%==true set secMod=true
call "%MK%\build\script\EncryptTexts.pl" "%MK%" "%MKS%" "%MKO%" %secMod% %XSMversion% %bibleTextEncryptionKey% "%MKS%\moduleDev\swordmk-mods\keys.txt" "%MK%\Cpp\Release\chromeCode.h" %encryptedTexts%

:UPDATE
call "%MK%\build\script\UpdateModulesLocales.pl" "%MK%" "%MKS%" "%MKO%" "%APPDATA%\%vendor%\%name%\Profiles\resources" %AllLocales% %IncludeLocales% %includeIndexes% %XSMversion% %MinProgversionForXSM% %includeBibles% %includeCommentaries% %includeGenBooks% %includeDevotionals% %includeLexDict%
