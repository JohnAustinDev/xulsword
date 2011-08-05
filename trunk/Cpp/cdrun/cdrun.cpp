// cdrun.cpp
//

#include "stdafx.h"
#include "..\Release\appInfo.h"

#define BUFSIZE 1024
#define KEYNAME "RunDir"
#define SET_SWORD_PATH_ENVIRONMENT_VAR "SWORD_PATH=%s"
#define PATH_TO_SETUP ".\\Install\\setup\\setup.exe"

int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
	CProcessList pl(true);
	PROCESS_INFORMATION_EX  *aproc;

	aproc = pl.find(TEXT(PROC_NAME));
	if (aproc) {return 0;} // Process is already running- do nothing.

	// Look for run directory KEYNAME in Windows registry
	HKEY hkey;
	TCHAR keyvalue[BUFSIZE];
	DWORD length=BUFSIZE*sizeof(TCHAR);
	LONG lret;
	RegOpenKeyEx(HKEY_LOCAL_MACHINE, TEXT(KEYADDRESS), 0, KEY_QUERY_VALUE, &hkey);
	lret = RegQueryValueEx(hkey,TEXT(KEYNAME),NULL,NULL,(LPBYTE)keyvalue,&length);
	RegCloseKey(hkey);

	//printf("The key is:%s. Query return value is:%d.\n",keyvalue,lret);

	static STARTUPINFO  si;
	static PROCESS_INFORMATION  pi;
	int res;
	char buffer[BUFSIZE]=PATH_TO_SETUP;
	TCHAR bufferW[BUFSIZE];
	int buflength = MultiByteToWideChar(CP_ACP,MB_PRECOMPOSED,buffer,-1,bufferW,BUFSIZE);
	if (buflength == 0) return 1; //Problem getting path to setup.exe file

/* Below is bad because it sets the SWORD_PATH variable! Also may need upgrade to Unicode
	//If RunDir key is found then run program, otherwise install
	if (lret == 0) {
		StringCbPrintf(const_cast<TCHAR *>(&bufferW[0]),BUFSIZE,TEXT(SET_SWORD_PATH_ENVIRONMENT_VAR),keyvalue);
		int nret = _wputenv(const_cast<TCHAR *>(&bufferW[0])); // Set SWORD_PATH environment var.
		StringCbPrintf(const_cast<TCHAR *>(&bufferW[0]),BUFSIZE,TEXT(PATH_TO_PROGRAM),keyvalue);
		res = CreateProcess(bufferW,NULL,NULL,NULL,false,CREATE_NEW_PROCESS_GROUP,NULL,NULL,&si,&pi);
		//printf("Buffer is:%s\n",bufferW);
	}
	else {res = CreateProcess(bufferW,NULL,NULL,NULL,false,CREATE_NEW_PROCESS_GROUP,NULL,NULL,&si,&pi);}
*/

  if (lret != 0) {res = CreateProcess(bufferW,NULL,NULL,NULL,false,CREATE_NEW_PROCESS_GROUP,NULL,NULL,&si,&pi);}
	return 0;
}
