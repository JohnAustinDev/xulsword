REM The next line creates the UI-listing files in %MKS%\localeDev\es-MK
UI-listing.pl "%MK%" "%MKS%" es-MX 2.15 en-US true listing_log_en-MX.txt

REM When the UI-listing file is translated, then run the following
::UI-code.pl "%MK%" "%MKS%" es-MX true code_log_en-MX.txt
