// cdrun.cpp
//

#include "stdafx.h"
#include "appInfo.h"

#define BUFSIZE 1024
#define KEYNAME L"RunDir"
#define PATH_TO_SETUP L".\\Install\\setup\\setup.exe"
int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
  WCHAR wlpCmdLine[BUFSIZE];
  mbstowcs(wlpCmdLine, lpCmdLine, sizeof(WCHAR)*(BUFSIZE-1));
  wlpCmdLine[BUFSIZE-1] = NULL; // insure null termination
  //std::wcout << L"Incoming command line:" << wlpCmdLine << '\n';
  
	CProcessList pl(true);
	PROCESS_INFORMATION_EX  *aproc;

	aproc = pl.find(PROC_NAME);
	if (aproc) {return 0;} // Process is already running- do nothing.

	// Start either the program or setup...
	static STARTUPINFO  si;
	static PROCESS_INFORMATION  pi;

	// Check for run directory from Windows registry
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

  WCHAR commandLine[3*BUFSIZE];
  WCHAR rundir[BUFSIZE];
  
  // If registry value was found, start the program.
  int success = 0;
  if (lret == ERROR_SUCCESS)
  {
    wsprintf(commandLine, L"\"%s\\%s\" application.ini %s", keyvalue, PROC_NAME, wlpCmdLine);
    wsprintf(rundir, L"%s", keyvalue);
    success = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, rundir, &si, &pi);
  }

   // If no registry value, or program didn't start (regsitry value is wrong), then start the installer
  if (lret != ERROR_SUCCESS || !success)
  {
    wsprintf(commandLine, L"\"%s\" %s", PATH_TO_SETUP, wlpCmdLine);
    success = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, NULL, &si, &pi);
  }
  
  return 0;
}
