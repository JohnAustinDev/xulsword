// Crc32Dlg.cpp : implementation file
//

#include "stdafx.h"
#include "Crc32.h"
#include "Crc32Dlg.h"
#include "Crc32Dynamic.h"
#include "Crc32Static.h"
#include "HiResTimer.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CCrc32Dlg dialog

CCrc32Dlg::CCrc32Dlg(CWnd *pParent)
	: CDialog(CCrc32Dlg::IDD, pParent)
{
	//{{AFX_DATA_INIT(CCrc32Dlg)
	m_nCrc32Method = 0;
	m_strFilename = _T("");
	//}}AFX_DATA_INIT

	m_hIcon = AfxGetApp()->LoadIcon(IDR_MAINFRAME);
}

CCrc32Dlg::~CCrc32Dlg()
{
}

void CCrc32Dlg::DoDataExchange(CDataExchange *pDX)
{
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CCrc32Dlg)
	DDX_CBIndex(pDX, IDC_COMBO_CRC32_METHOD, m_nCrc32Method);
	DDX_Text(pDX, IDC_EDIT_FILENAME, m_strFilename);
	DDV_MaxChars(pDX, m_strFilename, 256);
	//}}AFX_DATA_MAP
}

BEGIN_MESSAGE_MAP(CCrc32Dlg, CDialog)
	//{{AFX_MSG_MAP(CCrc32Dlg)
	ON_WM_PAINT()
	ON_WM_QUERYDRAGICON()
	ON_BN_CLICKED(IDC_BROWSE, OnBrowse)
	ON_BN_CLICKED(IDC_CRC32, OnCrc32)
	ON_EN_CHANGE(IDC_EDIT_FILENAME, OnChangeFilename)
	ON_BN_CLICKED(IDC_CLEAR, OnClear)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CCrc32Dlg message handlers

BOOL CCrc32Dlg::OnInitDialog()
{
	CDialog::OnInitDialog();

	SetIcon(m_hIcon, TRUE);			// Set big icon
	SetIcon(m_hIcon, FALSE);		// Set small icon

	OnChangeFilename();
	
	return TRUE;  // return TRUE  unless you set the focus to a control
}

// If you add a minimize button to your dialog, you will need the code below
//  to draw the icon.  For MFC applications using the document/view model,
//  this is automatically done for you by the framework.

void CCrc32Dlg::OnPaint()
{
	if(IsIconic())
	{
		CPaintDC dc(this); // device context for painting

		SendMessage(WM_ICONERASEBKGND, (WPARAM) dc.GetSafeHdc(), 0);

		// Center icon in client rectangle
		int cxIcon = GetSystemMetrics(SM_CXICON);
		int cyIcon = GetSystemMetrics(SM_CYICON);
		CRect rect;
		GetClientRect(&rect);
		int x = (rect.Width() - cxIcon + 1) / 2;
		int y = (rect.Height() - cyIcon + 1) / 2;

		// Draw the icon
		dc.DrawIcon(x, y, m_hIcon);
	}
	else
	{
		CDialog::OnPaint();
	}
}

HCURSOR CCrc32Dlg::OnQueryDragIcon()
{
	return (HCURSOR)m_hIcon;
}

//***********************************************
void CCrc32Dlg::OnBrowse()
{
	CFileDialog dlg(TRUE, NULL, NULL, OFN_FILEMUSTEXIST, NULL, this);

	if(dlg.DoModal() == IDOK)
		SetDlgItemText(IDC_EDIT_FILENAME, dlg.GetPathName());
}

//***********************************************
void CCrc32Dlg::OnCrc32()
{
	UpdateData();
	CWaitCursor wait;

	DWORD dwCrc32, dwErrorCode = NO_ERROR;
	CCrc32Dynamic *pobCrc32Dynamic = NULL;
	CHiResTimer obTimer; obTimer.Start();

	switch(m_nCrc32Method)
	{
	case 0:		// Dynamic C++ Streams
		pobCrc32Dynamic = new CCrc32Dynamic;

		pobCrc32Dynamic->Init();
		dwErrorCode = pobCrc32Dynamic->FileCrc32Streams(m_strFilename, dwCrc32);
		pobCrc32Dynamic->Free();

		delete pobCrc32Dynamic;
		break;

	case 1:		// Dynamic Win32 I/O
		pobCrc32Dynamic = new CCrc32Dynamic;

		pobCrc32Dynamic->Init();
		dwErrorCode = pobCrc32Dynamic->FileCrc32Win32(m_strFilename, dwCrc32);
		pobCrc32Dynamic->Free();

		delete pobCrc32Dynamic;
		break;

	case 2:		// Dynamic Filemaps
		pobCrc32Dynamic = new CCrc32Dynamic;

		pobCrc32Dynamic->Init();
		dwErrorCode = pobCrc32Dynamic->FileCrc32Filemap(m_strFilename, dwCrc32);
		pobCrc32Dynamic->Free();

		delete pobCrc32Dynamic;
		break;

	case 3:		// Dynamic Assembly
		pobCrc32Dynamic = new CCrc32Dynamic;

		pobCrc32Dynamic->Init();
		dwErrorCode = pobCrc32Dynamic->FileCrc32Assembly(m_strFilename, dwCrc32);
		pobCrc32Dynamic->Free();

		delete pobCrc32Dynamic;
		break;

	case 4:		// Static C++ Streams
		dwErrorCode = CCrc32Static::FileCrc32Streams(m_strFilename, dwCrc32);
		break;

	case 5:		// Static Win32 I/O
		dwErrorCode = CCrc32Static::FileCrc32Win32(m_strFilename, dwCrc32);
		break;

	case 6:		// Static Filemaps
		dwErrorCode = CCrc32Static::FileCrc32Filemap(m_strFilename, dwCrc32);
		break;

	case 7:		// Static Assembly
		dwErrorCode = CCrc32Static::FileCrc32Assembly(m_strFilename, dwCrc32);
		break;
	}

	obTimer.Stop();

	CString strResult;
	if(dwErrorCode == NO_ERROR)
		strResult.Format(_T("0x%08x"), dwCrc32);
	else
		strResult.Format(_T("Error: [0x%08x]"), dwErrorCode);
	SetDlgItemText(IDC_EDIT_CRC32, strResult);

	strResult.Format(_T("%f"), obTimer.GetTime());
	SetDlgItemText(IDC_EDIT_TIME, strResult);
}

//***********************************************
void CCrc32Dlg::OnChangeFilename()
{
	UpdateData();

	GetDlgItem(IDC_CRC32)->EnableWindow(!m_strFilename.IsEmpty());

	// Clear the results
	OnClear();
}

//***********************************************
void CCrc32Dlg::OnClear()
{
	SetDlgItemText(IDC_EDIT_CRC32, _T(""));
	SetDlgItemText(IDC_EDIT_TIME, _T(""));
}
