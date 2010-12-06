REM usage: UI-listing.pl MK MKS locale version alternateLocale sourcingFromFirefox3(true|false)
REM The next line creates the UI-listing files in %MKS%\localeDev\es-MX
::UI-listing.pl "%MK%" "%MKS%" fa 2.16 en-US false

REM usage: UI-code.pl MK MKS locale noShortcutKeys(true|false)
REM When the UI-listing file is translated, then run the following
UI-code.pl "%MK%" "%MKS%" ct true
