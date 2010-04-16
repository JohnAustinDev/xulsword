// runPortable.cpp
//

#include "stdafx.h"
#include "w32process.h"
#include "..\Release\appInfo.h"

int APIENTRY WinMain(HINSTANCE hInstance,
                     HINSTANCE hPrevInstance,
                     LPSTR     lpCmdLine,
                     int       nCmdShow)
{
	// Start the program...
	static STARTUPINFO  si;
	static PROCESS_INFORMATION  pi;
	
	// Parameter 2 MUST be modifiable for CreateProcessW
  wchar_t commandLine[32768];
  wcscpy(commandLine, PORTABLE_RUN);
	int res = CreateProcessW(NULL, commandLine, NULL, NULL, false, CREATE_NEW_PROCESS_GROUP, NULL, PORTABLE_DIR, &si, &pi);
	return 0;
}

/*
//For Debug...
#include <io.h>
#include <Fcntl.h>
  int hCrt;
  FILE *hf;
  
  AllocConsole();
  hCrt = _open_osfhandle((long) GetStdHandle(STD_OUTPUT_HANDLE), _O_TEXT);
  hf = _fdopen( hCrt, "w" );
  *stdout = *hf;
  setvbuf( stdout, NULL, _IONBF, 0 );
*/
