// Crc32.cpp : Defines the class behaviors for the application.
//

#include "stdafx.h"
#include "Crc32.h"
#include "Crc32Dlg.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CCrc32App

BEGIN_MESSAGE_MAP(CCrc32App, CWinApp)
	//{{AFX_MSG_MAP(CCrc32App)
	//}}AFX_MSG
	ON_COMMAND(ID_HELP, CWinApp::OnHelp)
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CCrc32App construction

CCrc32App::CCrc32App()
{
}

/////////////////////////////////////////////////////////////////////////////
// The one and only CCrc32App object

CCrc32App theApp;

/////////////////////////////////////////////////////////////////////////////
// CCrc32App initialization

BOOL CCrc32App::InitInstance()
{
	// Standard initialization

#ifdef _AFXDLL
	Enable3dControls();			// Call this when using MFC in a shared DLL
#else
	Enable3dControlsStatic();	// Call this when linking to MFC statically
#endif

	CCrc32Dlg dlg;
	m_pMainWnd = &dlg;
	dlg.DoModal();

	// Since the dialog has been closed, return FALSE so that we exit the
	//  application, rather than start the application's message pump.
	return FALSE;
}
