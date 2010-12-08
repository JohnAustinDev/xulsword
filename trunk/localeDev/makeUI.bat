REM usage: UI-listing.pl MK MKS locale version alternateLocale sourceFromFirefox3(true|false)
REM   Create the UI-listing text file(s)
REM   Output goes to: %MKS%\localeDev\<locale-code>
UI-listing.pl "%MK%" "%MKS%" ex 2.15 en-US true

REM usage: UI-code.pl MK MKS locale noShortcutKeys(true|false)
REM   Read the UI-listing text files and create a locale
REM   output goes to: %MKS%\localeDev\<locale-code>\locale
UI-code.pl "%MK%" "%MKS%" ex true

REM usage: UpdateJars.pl MK MKS MKO isProduction UIversion MinProgversionForUI IncludeLocales AllLocales
REM   Package the locale for xulsword
REM   output goes to: "%MKS%\localeDev\locales\
"%MK%\build\script\UpdateJars.pl" "%MK%" "%MKS%" "" true 2.9 2.9 ex ex

