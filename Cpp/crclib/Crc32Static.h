#ifndef _CRC32STATIC_H_
#define _CRC32STATIC_H_

#include "Common.h"

class CCrc32Static
{
public:
	CCrc32Static();
	virtual ~CCrc32Static();
	
	static DWORD FileCrc32Assembly(wchar_t *szFilename, DWORD &dwCrc32);

protected:
	//static bool GetFileSizeQW(const HANDLE hFile, QWORD &qwSize);
	//static inline void CalcCrc32(const BYTE byte, DWORD &dwCrc32);

	static DWORD s_arrdwCrc32Table[256];
};

#endif
