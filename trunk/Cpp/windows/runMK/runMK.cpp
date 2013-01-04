// runMK.cpp
//

#include "stdafx.h"
#include "appInfo.h"

#define BUFSIZE 1024
#define KEYNAME L"RunDir"

int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
  WCHAR wlpCmdLine[BUFSIZE];
  mbstowcs(wlpCmdLine, lpCmdLine, sizeof(WCHAR)*(BUFSIZE-1));
  wlpCmdLine[BUFSIZE-1] = NULL; // insure null termination
  //std::wcout << L"Incoming command line:" << wlpCmdLine << '\n';
  
	// Start the program...
	static STARTUPINFO  si;
	static PROCESS_INFORMATION  pi;
	
	// Get run directory from Windows registry
	HKEY hkey;
	BYTE keyvalue[BUFSIZE*sizeof(WCHAR)];
	DWORD length=(BUFSIZE-1)*sizeof(WCHAR); // one char shorter than keyvalue so extra null can be added after read
	DWORD type;
	LONG lret = RegOpenKeyExW(HKEY_LOCAL_MACHINE, KEYADDRESS, NULL, KEY_QUERY_VALUE, &hkey);
	if (lret == ERROR_SUCCESS)
	{
    lret = RegQueryValueExW(hkey, KEYNAME, NULL, &type, keyvalue, &length);
    if (type!=REG_SZ) {lret=ERROR_INVALID_DATA;}
    if (lret==ERROR_SUCCESS) 
    {
      keyvalue[length] = NULL; // insure null termination
      keyvalue[length+1] = NULL;
    }
    RegCloseKey(hkey);
    //std::wcout << L"keyvalue:" << keyvalue << '\n';
	}
	
	// assign command line and run directory
  WCHAR commandLine[3*BUFSIZE];
  WCHAR rundir[BUFSIZE];
  if (lret==ERROR_SUCCESS) {
    wsprintf(commandLine, L"\"%s\\%s\" --app application.ini -no-remote %s", keyvalue, PROC_NAME, wlpCmdLine);
    wsprintf(rundir, L"%s", keyvalue);
  }
  // if no registry value is found, look for exe in caller's directory
  else {wsprintf(commandLine, L"\"%s\" --app application.ini -no-remote %s", PROC_NAME, wlpCmdLine);}
    
	// Parameter 2 MUST be modifiable for CreateProcessW
	int success = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, (lret==ERROR_SUCCESS ? rundir:NULL), &si, &pi);
  //std::wcout << L"success=" << success << L", commandLine:" << commandLine << L", rundir:" << rundir << '\n';  
  	
	// If registry key value was wrong, try current directory anyway
	if (lret==ERROR_SUCCESS && !success) {
    wsprintf(commandLine, L"\"%s\" --app application.ini -no-remote %s", PROC_NAME, wlpCmdLine);
    success = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, NULL, &si, &pi);
	}
	
	return 0;
}