REM The next line creates the UI-listing files in %MKS%\localeDev\es-MX
UI-listing.pl "%MK%" "%MKS%" zh-CN 2.16 en-US true

REM When the UI-listing file is translated, then run the following
::UI-code.pl "%MK%" "%MKS%" en-US false code_log_en-US.txt
