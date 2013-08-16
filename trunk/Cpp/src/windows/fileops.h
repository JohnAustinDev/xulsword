/*

    Declaration of POSIX directory browsing functions and types for Win32.

    Kevlin Henney (mailto:kevlin@acm.org), March 1997.

    Copyright Kevlin Henney, 1997. All rights reserved.

    Permission to use, copy, modify, and distribute this software and its
    documentation for any purpose is hereby granted without fee, provided
    that this copyright and permissions notice appear in all copies and
    derivatives, and that no charge may be made for the software and its
    documentation except to cover cost of distribution.
    
*/
#ifndef FILEOPS_INCLUDED
#define FILEOPS_INCLUDED

#include <windows.h>
#include <stdio.h>
#include "dirent.h"

/*
    WINDOWS: these other low level functions must be replaced by functions
    which take UTF-8 file name inputs, convert them to wide-char UTF16 strings,
    and then call the native wide-char functions. Windows API does NOT
    understand UTF-8!
*/

int   wn_open(const char *path, int mode, int perms);
int   wn_access(const char *path, int mode);
long  wn_findfirst(const char *name, struct _wfinddata_t *fileinfo);
int   wn_mkdir(char *dirname );
FILE *wn_fdopen(int fd, const char *mode);
FILE *wn_fopen(const char *file, const char *mode);
int   wn_rename(const char *from, const char *to);
char *wn_fullpath(char *absPath, const char *relPath, size_t maxlen);
int   wn_stat64(const char *file, struct _stat64 * fileinfo);
int   wn_stati64(const char *path, struct _stati64 *buffer);
int   wn_unlink(const char * file);
HANDLE wn_CreateFile(const char *file, DWORD dwDesiredAccess, DWORD dwShareMode, LPSECURITY_ATTRIBUTES lpSecurityAttributes, DWORD dwCreationDisposition, DWORD dwFlagsAndAttributes, HANDLE hTemplateFile);
const char *wn_getenv(const char *varname);

#endif

