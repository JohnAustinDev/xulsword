// runMK.cpp
//

#include "stdafx.h"
#include "..\Release\appInfo.h"

#define BUFSIZE 1024
#define KEYNAME "RunDir"

int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
  wchar_t wlpCmdLine[1024];
  mbstowcs (wlpCmdLine, lpCmdLine, sizeof(wchar_t)*1024);
  //std::wcout << L"Incoming command line:" << wlpCmdLine << '\n';
  
	// Start the program...
	static STARTUPINFO  si;
	static PROCESS_INFORMATION  pi;
	
	// Get run directory from Windows registry
	HKEY hkey;
	TCHAR keyvalue[BUFSIZE];
	DWORD length=BUFSIZE*sizeof(TCHAR);
	LONG lret=0;
	if (!RegOpenKeyEx(HKEY_LOCAL_MACHINE, TEXT(KEYADDRESS), 0, KEY_QUERY_VALUE, &hkey))
	{
	 lret = RegQueryValueEx(hkey,TEXT(KEYNAME),NULL,NULL,(LPBYTE)keyvalue,&length);
	 keyvalue[BUFSIZE] = NULL; // insure null termination
	 RegCloseKey(hkey);
	 //std::wcout << L"keyvalue:" << keyvalue << '\n';
	}
	
	// assign command line and run directory
  wchar_t commandLine[1024];
  wchar_t rundir[1024];
  if (lret==0) {
    StringCbPrintf(commandLine, sizeof(wchar_t)*1024, L"\"%s\\%s\" application.ini %s", keyvalue, TEXT(PROC_NAME), wlpCmdLine);
    StringCbPrintf(rundir,      sizeof(wchar_t)*1024, L"%s", keyvalue);
  }
  // if no registry value is found, look for xulrunner.exe etc in caller's directory
  else {StringCbPrintf(commandLine, sizeof(wchar_t)*1024, L"\"%s\" application.ini %s", TEXT(PROC_NAME), wlpCmdLine);}
  //std::wcout << L"commandLine:" << commandLine << L", rundir:" << rundir << '\n';  
    
	// Parameter 2 MUST be modifiable for CreateProcessW
	int res = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, (lret==0 ? rundir:NULL), &si, &pi);
	return 0;
}