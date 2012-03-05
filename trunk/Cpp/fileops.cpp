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
#include "fileops.h"
#include <sys/types.h>
#include <sys/stat.h>
#include <io.h> // for _wopen
#include <wchar.h> // for _wmkdir
#include <share.h> // for _SH_DENYNO

#define CL_MAX_PATH 260

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

FILE *wn_fdopen(int fd, const char *mode)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, mode, -1, utf16, CL_MAX_PATH);
  return _wfdopen(fd, utf16);
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
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, relPath, -1, utf16, CL_MAX_PATH);
  wchar_t * buff16 = NULL;
  _wfullpath(buff16, utf16, maxlen);
  char buff8[CL_MAX_PATH];
  WideCharToMultiByte(CP_UTF8, 0, buff16, -1, buff8, CL_MAX_PATH, NULL, NULL);
  delete buff16;
  strcpy(absPath, buff8);
  return absPath;
}

int wn_stat64(const char *file, struct _stat64 *fileinfo)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, file, -1, utf16, CL_MAX_PATH);
  return _wstat64(utf16, fileinfo);
}

int wn_stati64(const char *path, struct _stati64 *buffer)
{
  wchar_t utf16[CL_MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, path, -1, utf16, CL_MAX_PATH);
  return _wstati64(utf16, buffer);
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
  wchar_t *result = _wgetenv(utf16);
  if (!result) return NULL;
  WideCharToMultiByte(CP_UTF8, 0, result, -1, utf8, CL_MAX_PATH, NULL, NULL);
  const char *retval = utf8;
  return retval;
}


