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

#ifndef DIRENT_INCLUDED
#define DIRENT_INCLUDED

#include <windows.h>
#include <stdio.h>
#include <swbuf.h>

#define MAX_DIR_NAME 10000
typedef struct DIR DIR;

struct dirent
{
    char *d_name;
};

/*
    WINDOWS PATCH: normal byte dirent functions must be replaced by these functions
    which take UTF-8 file name inputs, convert them to wide-char UTF16 strings,
    and then call the native wide-char file functions. Windows API does NOT
    understand UTF-8!
*/

DIR           *sw_opendir(const char *);
int           sw_closedir(DIR *);
struct dirent *sw_readdir(DIR *);
void          sw_rewinddir(DIR *);


/*
    WINDOWS PATCH: these other low level functions must be replaced by functions
    which take UTF-8 file name inputs, convert them to wide-char UTF16 strings,
    and then call the native wide-char functions. Windows API does NOT
    understand UTF-8!
*/

int sw_open(const char *path, int mode, int perms);
int sw_access(const char *path, int mode);
long sw_findfirst(const char *name, struct _wfinddata_t *fileinfo);
int sw_mkdir(char *dirname );
void sw_getenv(const char *varname, sword::SWBuf *buff);

#endif
