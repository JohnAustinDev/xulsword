REM The next line creates the UI-listing files in %MKS%\localeDev\es-MK
::UI-listing.pl "%MK%" "%MKS%" fa 2.15 en-US true listing_log_fa.txt

REM When the UI-listing file is translated, then run the following
UI-code.pl "%MK%" "%MKS%" fa true code_log_fa.txt
