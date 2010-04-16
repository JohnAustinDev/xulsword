#pragma once
#include <tlhelp32.h>
#pragma comment(lib, "kernel32.lib")

#include <psapi.h>
#pragma comment(lib, "psapi.lib")

//
// structure that holds most information about the process
//

typedef struct _PROCESS_INFORMATION_EX
{
	_PROCESS_INFORMATION_EX()
	{
		ZeroMemory((LPVOID)&pe32, sizeof(PROCESSENTRY32)); 
		pSid = NULL;
		ZeroMemory((LPVOID)&szModule[0], MAX_MODULE_NAME32+1);	
	}

	_PROCESS_INFORMATION_EX(const _PROCESS_INFORMATION_EX& r)
	{
		operator=(r);
	}

	_PROCESS_INFORMATION_EX& operator=(const _PROCESS_INFORMATION_EX& r)
	{
		CopyMemory((LPVOID)&pe32, (LPVOID)&r.pe32, sizeof(PROCESSENTRY32)); 
		pSid = NULL;
		if(r.pSid)
		{
			DWORD dwSidLen = ::GetLengthSid(r.pSid);
			if(dwSidLen) 
			{ 
				pSid = (PSID)malloc(dwSidLen); 
				::CopySid(dwSidLen, pSid, r.pSid); 
			}
		}
		CopyMemory((LPVOID)&szModule[0], (LPVOID)&r.szModule[0], MAX_MODULE_NAME32+1);

		return *this;
	}


	~_PROCESS_INFORMATION_EX()
	{
		if(pSid)
			free(pSid), pSid = NULL;
	}

	PROCESSENTRY32	pe32;												// see tlhelp32.h
	PSID			pSid;												// contains the owning user SID
	TCHAR			szModule[MAX_MODULE_NAME32 + 1];					// translated path+modulename
} PROCESS_INFORMATION_EX;

typedef PROCESS_INFORMATION_EX *PPROCESS_INFORMATION_EX;
typedef PROCESS_INFORMATION_EX *LPPROCESS_INFORMATION_EX;


//
// structure that holds most information about a thread
//
typedef struct _THREAD_INFORMATION_EX
{
	_THREAD_INFORMATION_EX()
	{ 
		ZeroMemory((LPVOID)&te32, sizeof(THREADENTRY32)); 
		ZeroMemory((LPVOID)&ctx, sizeof(CONTEXT)); 
	}

	THREADENTRY32	te32;
	CONTEXT			ctx;
} THREAD_INFORMATION_EX;

typedef THREAD_INFORMATION_EX *PTHREAD_INFORMATION_EX;
typedef THREAD_INFORMATION_EX *LPTHREAD_INFORMATION_EX;

//
// define USE_STL to derive CProcessList from std::vector
// or dont define it to derive from CArray
//

#if defined(USE_STL)
	
// MFC CArray support
#define DECLARE_MFC_SUPPORT			int GetSize() const { return size(); } \
									void RemoveAll() { clear(); }




	#include <vector>
	using std::vector;

	typedef vector<PROCESS_INFORMATION_EX>	PIEXVECTOR;

	//
	// process enumeration class
	//
	class CProcessList: public PIEXVECTOR
	{
	public:
		CProcessList(BOOL bExcludeNoAccess=FALSE) : PIEXVECTOR() 	{ Update(bExcludeNoAccess); };
		virtual ~CProcessList(void);

		PROCESS_INFORMATION_EX*	find(const DWORD pid);					// find by ProcessID
		PROCESS_INFORMATION_EX*	find(const LPTSTR pstrExe);				// find by Modulename (part of)

		DECLARE_MFC_SUPPORT;

	private:
		BOOL Update(BOOL bExcludeNoAccess);
	};

	typedef vector<MODULEENTRY32>	MEVECTOR;

	//
	// Module enumeration class
	//
	class CModuleList: public MEVECTOR
	{
	public:
		CModuleList(DWORD dwProcessID = NULL) : MEVECTOR() 	{ Update(dwProcessID); };
		virtual ~CModuleList(void);

		DECLARE_MFC_SUPPORT;

	private:
		BOOL Update(DWORD dwProcessID);
	};

	typedef vector<THREAD_INFORMATION_EX>	TIEXVECTOR;

	//
	// Thread enumeration class
	//
	class CThreadList: public TIEXVECTOR
	{
	public:
		CThreadList(DWORD dwProcessID = NULL, BOOL bGetContext=FALSE) : TIEXVECTOR() 	{ m_bHasContext = bGetContext; Update(dwProcessID, bGetContext); };
		virtual ~CThreadList(void);

		BOOL HasContext() const { return m_bHasContext; }

		DECLARE_MFC_SUPPORT;

	private:
		BOOL Update(DWORD dwProcessID, BOOL bGetContext);
		BOOL m_bHasContext;
	};

#else
	#include <afxtempl.h>

	typedef CArray<PROCESS_INFORMATION_EX, PROCESS_INFORMATION_EX>	PIEXARRAY;

	//
	// process enumeration class
	//
	class CProcessList: public PIEXARRAY
	{
	public:
		CProcessList(BOOL bExcludeNoAccess=FALSE) : PIEXARRAY() 	{ Update(bExcludeNoAccess); };
		virtual ~CProcessList(void);

		PROCESS_INFORMATION_EX*	Find(const LPTSTR pstrExe);				// find by Modulename (part of)
		PROCESS_INFORMATION_EX*	Find(const DWORD pid);					// find by ProcessID

	private:
		BOOL Update(BOOL bExcludeNoAccess);
	};

	typedef CArray<MODULEENTRY32, MODULEENTRY32>	MEARRAY;

	//
	// Module enumeration class
	//
	class CModuleList: public MEARRAY
	{
	public:
		CModuleList(DWORD dwProcessID = NULL) : MEARRAY() 	{ Update(dwProcessID); };
		virtual ~CModuleList(void);

	private:
		BOOL Update(DWORD dwProcessID);
	};

	typedef CArray<THREAD_INFORMATION_EX, THREAD_INFORMATION_EX>	TIEXARRAY;

	//
	// Thread enumeration class
	//
	class CThreadList: public TIEXARRAY
	{
	public:
		CThreadList(DWORD dwProcessID = NULL, BOOL bGetContext=FALSE) : TIEXARRAY() 	{ m_bHasContext = bGetContext; Update(dwProcessID, bGetContext); };
		virtual ~CThreadList(void);

		BOOL HasContext() const { return m_bHasContext; }

	private:
		BOOL Update(DWORD dwProcessID, BOOL bGetContext);
		BOOL m_bHasContext;
	};

#endif
