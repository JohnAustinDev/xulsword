// Crc32Dlg.h : header file
//

#if !defined(AFX_CRC32DLG_H__0AD97DB5_9410_11D5_8ABC_000000000000__INCLUDED_)
#define AFX_CRC32DLG_H__0AD97DB5_9410_11D5_8ABC_000000000000__INCLUDED_

#if _MSC_VER >= 1000
#pragma once
#endif // _MSC_VER >= 1000

/////////////////////////////////////////////////////////////////////////////
// CCrc32Dlg dialog

class CCrc32Dlg : public CDialog
{
// Construction
public:
	CCrc32Dlg(CWnd *pParent = NULL);	// standard constructor
	virtual ~CCrc32Dlg();

// Dialog Data
	//{{AFX_DATA(CCrc32Dlg)
	enum { IDD = IDD_CRC32_DIALOG };
	int		m_nCrc32Method;
	CString	m_strFilename;
	//}}AFX_DATA

	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CCrc32Dlg)
	protected:
	virtual void DoDataExchange(CDataExchange *pDX);	// DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:
	HICON m_hIcon;

	// Generated message map functions
	//{{AFX_MSG(CCrc32Dlg)
	virtual BOOL OnInitDialog();
	afx_msg void OnPaint();
	afx_msg HCURSOR OnQueryDragIcon();
	afx_msg void OnBrowse();
	afx_msg void OnCrc32();
	afx_msg void OnChangeFilename();
	afx_msg void OnClear();
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Developer Studio will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_CRC32DLG_H__0AD97DB5_9410_11D5_8ABC_000000000000__INCLUDED_)
