echo off
ECHO --- FIRST RUN PREPARATION
echo initialized>> "%MK%\xulrunner\init.txt"
del /Q "%MK%\xul\xulrunnerDevAndProd\xulrunner\*.exe"
move /Y "%MK%\xulrunner\*.exe" "%MK%\xul\xulrunnerDevAndProd\xulrunner\"

mkdir "%MK%\xulrunner\defaults\pref"

mkdir "%MK%\xul\xulrunnerDevAndProd\unused"
del /S /Q "%MK%\xul\xulrunnerDevAndProd\unused\*"
::xcopy /E /I /R /Y "%MK%\xulrunner\dictionaries" "%MK%\xul\xulrunnerDevAndProd\unused\dictionaries"
::rmdir /S /Q "%MK%\xulrunner\dictionaries"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\crashreporter.exe" "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\js.exe"            "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\redit.exe"         "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\updater.exe"       "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\xpcshell.exe"      "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\xpidl.exe"         "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\xpt_dump.exe"      "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\xpt_link.exe"      "%MK%\xul\xulrunnerDevAndProd\unused"
::move "%MK%\xul\xulrunnerDevAndProd\xulrunner\xulrunner-stub.exe" "%MK%\xul\xulrunnerDevAndProd\unused"
