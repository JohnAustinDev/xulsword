// runPortable.cpp
//

#include "stdafx.h"
#include "appInfo.h"

#define BUFSIZE 1024

int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
  // convert command line to Unicode
  WCHAR wlpCmdLine[BUFSIZE];
  mbstowcs(wlpCmdLine, lpCmdLine, sizeof(WCHAR)*(BUFSIZE-1));
  wlpCmdLine[BUFSIZE-1] = NULL; // insure null termination
  //std::wcout << L"Incoming command line:" << wlpCmdLine << '\n';
  
	// Start the program...
  static STARTUPINFO  si;
  static PROCESS_INFORMATION  pi;
  
  // Parameter 2 MUST be modifiable for CreateProcessW
  WCHAR commandLine[2*BUFSIZE];
  WCHAR rundir[BUFSIZE]; 
  wsprintf(commandLine, COMMAND_LINE, wlpCmdLine);
  wsprintf(rundir, L"%s", RUN_DIR);
  int success = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, rundir, &si, &pi);
  //std::wcout << L"success=" << success << L", commandLine:" << commandLine << L", rundir:" << rundir << '\n'; 
  
  return 0;
}
