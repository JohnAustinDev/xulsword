::----------------------------------------------------------------
::----------------------------------------------------------------
::NOTES...
:: setupversion -           This should be "version" but in this case always in decimal form 
:: MinXSMversion -          The minimum XSMversion required for compatible MK modules' text modules.
:: MinUIversion -           The minimum UIversion required for compatible MK modules' UI modules.
::
:: encryptionKey -          Alpha-numeric characters only (no spaces). If  left 
::                          blank, setup.exe will not be encrypted.
:: bibleTextEncryptionKey - Alpha-numberic LATIN characters only (no spaces). If 
::                          left blank, text modules are not (re)encrypted. Actual
::                          key value is modified by Security Module if 
::                          useSecurityModule=true.
:: splashScreen -           "splash.xul" or "splashSec.xul". To require that the 
::                          CD be in the drive, use "splashSec.xul". If left 
::                          blank there will be no splash screen.
:: copySecurity -           "enabled" or "disabled". To check for the existence 
::                          of the store.bat hidden file, use "enabled".
:: storeSize -              "2147483647" or "-1" . IMPORTANT: if storeSize has 
::                          a different value than -1, then an ISO image must 
::                          be written and modified to make store.bat's file 
::                          size equal to the value of storeSize!
:: useSecurityModule -      Set to true to include the security module which
::                          does a CRC check of all program files to insure 
::                          none have been changed. It also modifies the text 
::                          encryption password.
:: HelpEmailAddress -       Set to en email address which will appear under "Help"
::                          menu, or leave blank and no email menu element will appear.

:: SPECIFY BUILD INFORMATION
Set version=2.21
Set setupversion=2.21
Set name=xulSword
Set vendor=CrossWire
Set executable=xulsword.exe
Set MinXSMversion=1.0
Set MinUIversion=2.7
Set HelpEmailAddress=gpl.programs.info@gmail.com

:: CHOOSE SECURITY SETTINGS
Set useSecurityModule=
Set encryptionKey=
Set bibleTextEncryptionKey=aKey
Set splashScreen=splash.xul
Set copySecurity=disabled
Set storeSize=-1

:: DEFAULT LOCALE (en-US, ru, etc.)
Set defaultLanguage=en-US

:: LIST ALL LOCALES (Example:"en-US,ru")
Set AllLocales="en-US"

:: LIST LOCALES TO INCLUDE DURING INSTALLATION (Must include at least one locale. Example:"en-US", or "ru,ar")
Set IncludeLocales="en-US"

:: DO YOU WANT THE HEBREW FONT IN THE INSTALLER (Example:true, or just leave blank)
Set HebrewFont=

:: LIST TEXTS WHICH ARE TO BE ENCRYPTED (Example:"ABC,DEF,GHI,JKL")
:: NOTE! Texts which are not listed will NOT appear in password list!
Set encryptedTexts=""

:: MODULES TO INCLUDE (enclose in quotes, delineated by commas)
:: Note StrongsGreek,StrongsHebrew,Robinson are used for original lang features
Set includeBibles="KJV,TR,HEB"
Set includeCommentaries=""
Set includeGenBooks=""
Set includeDevotionals=""
Set includeLexDict="StrongsGreek,StrongsHebrew,Robinson"

:: INCLUDE SEARCH INDEXES IN INSTALLER (Example:true, or false)
Set includeIndexes=false

:: OTHER OPTIONS (Example: true or false)
Set    ShowDictionaryTabsByDefault=false
Set      ShowAllBibleTabsByDefault=true
Set    ShowCommentaryTabsByDefault=false
Set HideUnavailableCrossReferences=false
Set           ShowOriginalTextTabs=false
Set           MinimizeSearchRadios=false
Set              HideDisabledBooks=false
Set           ShowIntrosBeforeText=false
Set        AlwaysHideHebrewOptions=false
Set      HideDisabledViewMenuItems=false
Set  HideDisabledCopyPrintIncludes=false
Set         DontReadReferenceBible=false
Set                     useUYGskin=false

:: List Bible texts (NOT books, commentaries, or anything else) whose tabs should be initially hidden (default is show tabs)
:: Must not include quotes, must be semicolon delineated, and must include a semicolon at the end. Example:ABC;DEF;GHI;JKL;
Set HiddenTexts1=
Set HiddenTexts2=
Set HiddenTexts3=

::----------------------------------------------------------------
::----------------------------------------------------------------

:: MODULE INSTALLER INFORMATION (IMPORTANT FOR CREATING MK MODULES)
:: Normally XSMversion=UIversion=MKMversion is necessary. But, see
:: newModule.js:readVersion for exceptions which allow backward compatibility to MK 2.7
:: If the security module is being used, and UIversion or MinProgversionForUI
:: is changed, then MakeProduction.bat must be rerun before running MakeModules.bat
:: (locale's manifest changes, requiring new security codes).
::
:: SWORD modules which are "Synodal" versified will automatically have
:: MinProgversionForXSM set to >=2.13
Set XSMversion=2.7
Set UIversion=2.9
Set MKMversion=2.9

:: MinProgversionForUI should be at least 2.9 for ALL new locales (MK 2.8 security module cannot handle newly made UIs!)
Set MinProgversionForUI=2.9
Set MinProgversionForXSM=2.7

::----------------------------------------------------------------
::----------------------------------------------------------------

cd %MKAppinfo%
cd..
if not defined MKO Set MKO=%CD%\build-out
if not exist %MKO% mkdir %MKO%
echo MK  directory=%MK%
echo MKS directory=%MKS%
echo MKO directory=%MKO%

cd "%MK%\build"
call "%MK%\build\script\PrepareBuild.bat" %1
