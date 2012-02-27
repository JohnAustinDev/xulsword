/*

    Implementation of POSIX directory browsing functions and types for Win32.

    Kevlin Henney (mailto:kevlin@acm.org), March 1997.

    Copyright Kevlin Henney, 1997. All rights reserved.

    Permission to use, copy, modify, and distribute this software and its
    documentation for any purpose is hereby granted without fee, provided
    that this copyright and permissions notice appear in all copies and
    derivatives, and that no charge may be made for the software and its
    documentation except to cover cost of distribution.
    
    This software is supplied "as is" without express or implied warranty.

    But that said, if there are any problems please get in touch.

*/

#include <windows.h>
#include <fileops.h>
#include <utilstr.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <io.h> // for _wopen
#include <wchar.h> // for _wmkdir
#include <share.h> // for _SH_DENYNO

#define CL_MAX_PATH 260

using namespace sword;

int wn_open(const char *path, int mode, int perms)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, path, -1, utf16, CL_MAX_PATH);
  return _wopen(utf16, mode, perms);
}

int wn_access(const char *path, int mode)
{

  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, path, -1, utf16, CL_MAX_PATH);
  return _waccess(utf16, mode);
}

long wn_findfirst(const char *name, struct _wfinddata_t *fileinfo)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, name, -1, utf16, CL_MAX_PATH);
  return _wfindfirst(utf16, fileinfo);
}

int wn_mkdir(char *dirname )
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, dirname, -1, utf16, CL_MAX_PATH);
  return _wmkdir(utf16);
}

FILE *wn_fopen(const char *file, const char *mode)
{
  wchar_t utf16f[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, file, -1, utf16f, CL_MAX_PATH);
  wchar_t utf16m[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, mode, -1, utf16m, CL_MAX_PATH);
  return _wfsopen(utf16f, utf16m, _SH_DENYNO);
}

int wn_rename(const char *from, const char *to)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, from, -1, utf16, CL_MAX_PATH);
  wchar_t utf16t[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, to, -1, utf16t, CL_MAX_PATH);
  return _wrename(utf16, utf16t);
}

char *wn_fullpath(char *absPath, const char *relPath, size_t maxlen)
{
  SWBuf utf8 = relPath;
  SWBuf utf16 = utf8ToWChar(utf8.c_str());
  wchar_t * buff16 = NULL;
  SWBuf absPath16 = (char *)_wfullpath(buff16, (wchar_t *)utf16.c_str(), maxlen);
  utf8 = wcharToUTF8((wchar_t *)absPath16.c_str());
  delete buff16;
  strcpy(absPath, utf8.c_str());
  return absPath;
}

int wn_stat64(const char *file, struct __stat64 *fileinfo)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, file, -1, utf16, CL_MAX_PATH);
  return _wstat64(utf16, fileinfo);
}

int wn_unlink(const char * file)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, file, -1, utf16, CL_MAX_PATH);
  return _wunlink(utf16);
}

const char *wn_getenv(const char *varname)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, varname, -1, utf16, CL_MAX_PATH);
  char utf8[CL_MAX_PATH];
  WideCharToMultiByte(CP_UTF8, 0, _wgetenv(utf16), -1, utf8, CL_MAX_PATH, NULL, NULL);
  const char *retval = utf8;
  return retval;
}

