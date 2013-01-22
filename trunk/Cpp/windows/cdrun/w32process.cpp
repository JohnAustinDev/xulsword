#include "stdafx.h"
#include "w32process.h"

bool GetProcessModule (DWORD           dwPID,
					   LPCTSTR			pstrModule,
					   LPMODULEENTRY32 lpMe32,
					   DWORD           cbMe32);


CProcessList::~CProcessList(void)
{
#if !defined(USE_STL)
	while(GetSize() > 0)
	{
		GetAt(0).~_PROCESS_INFORMATION_EX();
		RemoveAt(0);
	}
#else
	clear();
#endif
}

BOOL CProcessList::Update(BOOL bExcludeNoAccess)
{
    HANDLE         hProcessSnap = NULL; 
    bool           bRet			= false; 
	PROCESS_INFORMATION_EX	pie;

    //  Take a snapshot of all processes in the system. 

    hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0); 

    if (hProcessSnap == INVALID_HANDLE_VALUE) 
        return (false); 
 
#if defined(USE_STL)
	clear();
#else
	RemoveAll();
#endif

	//  Fill in the size of the structure before using it. 

    pie.pe32.dwSize = sizeof(PROCESSENTRY32); 
 
    //  Walk the snapshot of the processes, and for each process, 
    //  display information. 

    if (Process32First(hProcessSnap, &pie.pe32)) 
    { 
        do 
        { 
#ifdef _VERBOSE_DEBUG
			TRACE("\nProcess: %s\n", pie.pe32.szExeFile);
#endif
			MODULEENTRY32	me32 = {0}; 
			HANDLE			hProcess; 
			BOOL			bNoAccess = FALSE;

			hProcess = ::OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pie.pe32.th32ProcessID); 
			if(hProcess == INVALID_HANDLE_VALUE)
			{
				if(GetLastError() == ERROR_ACCESS_DENIED)
					bNoAccess = TRUE;
			}

			//
			// either if we ignore no access (!bExcludeNoAccess) or we have access (!bNoAccess)
			//
			if((!bExcludeNoAccess) || (bExcludeNoAccess && !bNoAccess))
			{
				//
				// resolve the executable name
				//
				if(GetProcessModule(pie.pe32.th32ProcessID, pie.pe32.szExeFile, &me32, sizeof(MODULEENTRY32)))
				{
					_tcsncpy(&pie.szModule[0], &me32.szExePath[0], min(MAX_MODULE_NAME32, MAX_PATH));
				}
				else
				{
					if(hProcess != INVALID_HANDLE_VALUE)
					{
						::GetProcessImageFileName(hProcess, &pie.szModule[0], MAX_MODULE_NAME32);
					}
				}

				//
				// get owner information
				//
				BOOL bHaveSID = FALSE;
				HANDLE hToken;
				if(::OpenProcessToken(hProcess, TOKEN_QUERY_SOURCE|TOKEN_QUERY, &hToken))
				{
					DWORD dwLen = NULL;
					::GetTokenInformation(hToken, TokenUser, NULL, 0, &dwLen);
					if(::GetLastError() != ERROR_INSUFFICIENT_BUFFER)
						;
					else
					{
						TOKEN_USER* pWork = static_cast<TOKEN_USER*>(_alloca(dwLen));
						if(::GetTokenInformation(hToken, TokenUser, pWork, dwLen, &dwLen))
						{

							DWORD dwSidLen = ::GetLengthSid(pWork->User.Sid);
							pie.pSid = (PSID)malloc(dwSidLen);
							bHaveSID = ::CopySid(dwSidLen, pie.pSid, pWork->User.Sid);

							bHaveSID = TRUE;
						}
					}
					::CloseHandle(hToken);
				}

#ifdef _VERBOSE_DEBUG
				// Print the process's information. 
				TRACE( "PID\t\t\t%d\n", pie.pe32.th32ProcessID);
				TRACE( "Thread Count\t\t%d\n", pie.pe32.cntThreads);
				TRACE( "Executable\t\t%s\n", pie.szModule);

				if(bHaveSID)
				{
					SID_NAME_USE	use;
					DWORD			dwName = 256;
					DWORD			dwDomain = 256;
					DWORD			dwErr = NULL;
					TCHAR			uname[256];
					TCHAR			udomain[256];
					LPTSTR			pSid = NULL;

					::ConvertSidToStringSid(pie.pSid, &pSid);

					if(pSid)
					{
						TRACE("SID\t\t\t%s\n", pSid);
						LocalFree(pSid);
					}

					if(LookupAccountSid(NULL, pie.pSid, &uname[0], &dwName, &udomain[0], &dwDomain, &use))
					{
						TRACE("User\t\t%s\\%s\n", &udomain[0], &uname[0]);
					}
					else
					{
						dwErr = GetLastError();
					}
				}
#endif

#if defined(USE_STL)
				push_back(pie);
#else
				Add(pie);
#endif
			}

			if(hProcess != INVALID_HANDLE_VALUE)
			{
				::CloseHandle (hProcess); 
			}
			ZeroMemory(&pie, sizeof(PROCESS_INFORMATION_EX));
			pie.pe32.dwSize = sizeof(PROCESSENTRY32);
        } 
        while (Process32Next(hProcessSnap, &pie.pe32)); 
        bRet = true; 
    } 
    else 
        bRet = false;    // could not walk the list of processes 
 
    // clean up the snapshot object. 

    CloseHandle (hProcessSnap); 
    return (bRet); 
} 

#if defined(USE_STL)

//
// iterate through all processes and find by given ProcessID
//
PROCESS_INFORMATION_EX*	CProcessList::find(const DWORD pid)
{
	for(PIEXVECTOR::iterator it = this->begin(); it != this->end(); ++it)
	{
		if(it->pe32.th32ProcessID == pid)
		{
			return &(*it);
		}
	}
	return NULL;
}

//
// iterate through all processes and find by given module name.
// note: a process is found by substring comparism thus searching for "er.exe" may find 
// Manager.exe, Explorer.exe and er.exe
//
PROCESS_INFORMATION_EX*	CProcessList::find(const LPTSTR pstrExe)
{
	for(PIEXVECTOR::iterator it = this->begin(); it != this->end(); ++it)
	{
		if(_tcsstr(it->pe32.szExeFile, pstrExe) != NULL || _tcsstr(it->szModule, pstrExe) != NULL)
		{
			return &(*it);
		}
	}
	return NULL;
}
#else
//
// iterate through all processes and find by given ProcessID
//
PROCESS_INFORMATION_EX*	CProcessList::Find(const DWORD pid)
{
	for(int i = 0; i < GetSize(); ++i)
	{
		if(GetAt(i).pe32.th32ProcessID == pid)
		{
			return &(GetAt(i));
		}
	}
	return NULL;
}

//
// iterate through all processes and find by given module name.
// note: a process is found by substring comparism thus searching for "er.exe" may find 
// Manager.exe, Explorer.exe and er.exe
//
PROCESS_INFORMATION_EX*	CProcessList::Find(const LPTSTR pstrExe)
{
	for(int i = 0; i < GetSize(); ++i)
	{
		if(_tcsstr(GetAt(i).pe32.szExeFile, pstrExe) != NULL || _tcsstr(GetAt(i).szModule, pstrExe) != NULL)
		{
			return &(GetAt(i));
		}
	}
	return NULL;
}
#endif


bool GetProcessModule (DWORD           dwPID,
                       LPCTSTR         pstrModule,
                       LPMODULEENTRY32 lpMe32,
                       DWORD           cbMe32)
{
    BOOL			bRet;
    bool			bFound      = false;
    HANDLE			hModuleSnap = NULL;
    MODULEENTRY32	me32        = {0};
	size_t				nLen = _tcslen(pstrModule);

	if(!nLen)
	{
		return false;
	}
	
	//
	// for simplicity we do not adjust our security token 
	// which would allow access to all system processes.
	//

	hModuleSnap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, dwPID);
	if (hModuleSnap == INVALID_HANDLE_VALUE) 
	{
#ifdef _DEBUG
		DWORD dwRet = GetLastError();
#endif
		return (false);
	}

	me32.dwSize = sizeof(MODULEENTRY32);

	bRet = Module32First(hModuleSnap, &me32);
	while (bRet && !bFound) 
	{
		//
		// locate the given filename in the modulelist (usually its the first anyway)
		//
		
		if(_tcsnicmp(me32.szModule, pstrModule, nLen) == 0) 
		{
			CopyMemory(lpMe32, &me32, cbMe32);
			bFound = true;
		}
		bRet = Module32Next(hModuleSnap, &me32);
	}
	CloseHandle (hModuleSnap);

    return (bFound);
}

CModuleList::~CModuleList()
{
#if !defined(USE_STL)
	RemoveAll();
#else
	clear();
#endif
}

BOOL CModuleList::Update(DWORD dwProcessID)
{
	BOOL			bRet = FALSE;
	HANDLE			hModuleSnap = NULL;
	MODULEENTRY32	me32        = {0};

	//
	// for simplicity we do not adjust our security token 
	// which would allow access to all system processes.
	//

	hModuleSnap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, dwProcessID);
	if (hModuleSnap == INVALID_HANDLE_VALUE) 
	{
#ifdef _DEBUG
		DWORD dwRet = GetLastError();
#endif
		return FALSE;
	}

	me32.dwSize = sizeof(MODULEENTRY32);

	bRet = Module32First(hModuleSnap, &me32);
	while (bRet) 
	{
#ifdef _VERBOSE_DEBUG
		// Print the process's information. 
        TRACE( "\n\tGlobal Usage Count\t%i\n", me32.GlblcntUsage);
		TRACE( "\tProcess Usage Count\t\t%i\n", me32.ProccntUsage);
		TRACE( "\tModule\t\t%s\n", me32.szModule);
		TRACE( "\tExecutable\t\t%s\n", me32.szExePath);
#endif

#if defined(USE_STL)
		push_back(me32);
#else
		Add(me32);
#endif
		ZeroMemory(&me32, sizeof(MODULEENTRY32));
		me32.dwSize = sizeof(MODULEENTRY32);
		
		bRet = Module32Next(hModuleSnap, &me32);
	}
	CloseHandle (hModuleSnap);

	return TRUE;
}

CThreadList::~CThreadList()
{
#if !defined(USE_STL)
	RemoveAll();
#else
	clear();
#endif
}

BOOL CThreadList::Update(DWORD dwProcessID, BOOL bGetContext)
{
	HANDLE					hThreadSnap = NULL; 
    BOOL					bRet = FALSE; 
	THREAD_INFORMATION_EX	tie;
	DWORD					dwThisThread = ::GetCurrentThreadId();	// used for not killing ourself

    // Take a snapshot of all threads currently in the system. 

    hThreadSnap = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, dwProcessID); 
    if (hThreadSnap == INVALID_HANDLE_VALUE) 
        return FALSE; 
 
    // Fill in the size of the structure before using it. 

    tie.te32.dwSize = sizeof(THREADENTRY32); 
 
    // Walk the thread snapshot to find all threads of the process. 
    // If the thread belongs to the process, add its information 
    // to the display list.
 
    if (Thread32First(hThreadSnap, &tie.te32)) 
    { 
        do 
        { 
			//
			// if the thread belongs to the given process...
			//
            if (tie.te32.th32OwnerProcessID == dwProcessID) 
            { 
				if(bGetContext && (dwThisThread != tie.te32.th32ThreadID))
				{
					//
					// get some more information about this thread
					//
					HANDLE hThread = ::OpenThread(THREAD_GET_CONTEXT|THREAD_QUERY_INFORMATION, FALSE, tie.te32.th32ThreadID);
					if(hThread != INVALID_HANDLE_VALUE)
					{
						::SuspendThread(hThread);	// otherwise we dont get the context
						{
							tie.ctx.ContextFlags = CONTEXT_FULL;
							::GetThreadContext(hThread, &tie.ctx);
						}
						::ResumeThread(hThread);
						::CloseHandle(hThread);
					}
				}
#ifdef _VERBOSE_DEBUG
				TRACE( "\nTID\t\t%d (@%i)\n", tie.te32.th32ThreadID, tie.te32.th32OwnerProcessID);
				TRACE( "Base Priority\t%d\n", tie.te32.tpBasePri); 
				if(tie.ctx.ContextFlags)
				{
					TRACE("EIP\t\t0x%08x\n", tie.ctx.Eip);
					TRACE("ESP\t\t0x%08x\n", tie.ctx.Esp);
				}
#endif

#if defined(USE_STL)
				push_back(tie);
#else
				Add(tie);
#endif
				ZeroMemory(&tie, sizeof(THREAD_INFORMATION_EX));
				tie.te32.dwSize = sizeof(THREADENTRY32);
            } 
        } 
        while (Thread32Next(hThreadSnap, &tie.te32)); 
        bRet = TRUE; 
    } 
    else 
        bRet = FALSE;          // could not walk the list of threads 
 
    // Do not forget to clean up the snapshot object. 

    CloseHandle (hThreadSnap); 
 
    return bRet; 
}
