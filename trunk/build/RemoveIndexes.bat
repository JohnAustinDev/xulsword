cd "%MK%\xulrunner\modules\texts\ztext"
FOR /F "usebackq delims==" %%i IN (`dir /B`) DO CD %%i&RMDIR /S /Q lucene&CD ..

cd "%MK%\xulrunner\modules\lexdict\rawld"
FOR /F "usebackq delims==" %%i IN (`dir /B`) DO CD %%i&RMDIR /S /Q lucene&CD ..
cd "%MK%\xulrunner\modules\lexdict\rawld\devotionals"
FOR /F "usebackq delims==" %%i IN (`dir /B`) DO CD %%i&RMDIR /S /Q lucene&CD ..

cd "%MK%\xulrunner\modules\genbook\rawgenbook"
FOR /F "usebackq delims==" %%i IN (`dir /B`) DO CD %%i&RMDIR /S /Q lucene&CD ..

cd "%MK%\xulrunner\modules\comments\zcom"
FOR /F "usebackq delims==" %%i IN (`dir /B`) DO CD %%i&RMDIR /S /Q lucene&CD ..

