// Crc32.h : main header file for the CRC32 application
//

#if !defined(AFX_CRC32_H__0AD97DB3_9410_11D5_8ABC_000000000000__INCLUDED_)
#define AFX_CRC32_H__0AD97DB3_9410_11D5_8ABC_000000000000__INCLUDED_

#if _MSC_VER >= 1000
#pragma once
#endif // _MSC_VER >= 1000

#ifndef __AFXWIN_H__
	#error include 'stdafx.h' before including this file for PCH
#endif

#include "resource.h"		// main symbols

/////////////////////////////////////////////////////////////////////////////
// CCrc32App:
// See Crc32.cpp for the implementation of this class
//

class CCrc32App : public CWinApp
{
public:
	CCrc32App();

// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CCrc32App)
	public:
	virtual BOOL InitInstance();
	//}}AFX_VIRTUAL

// Implementation

	//{{AFX_MSG(CCrc32App)
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

/////////////////////////////////////////////////////////////////////////////

//{{AFX_INSERT_LOCATION}}
// Microsoft Developer Studio will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_CRC32_H__0AD97DB3_9410_11D5_8ABC_000000000000__INCLUDED_)
