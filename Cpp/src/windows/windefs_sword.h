/* Window's file operation routines do not understand utf8, so any non-ascii
*  chars in path names will not resolve correctly. The fileops.h routines
*  replace the native windows versions. They convert utf8 to utf16 so that
*  non-ascii path names resolve. All native file operations must be defined (or
*  re-defined as the case may be) as their fileops.h counterpart (see below).
*/

// Following are all the Microsoft library headers effected by re-defines.
// Including them all before the #defines below insures proper redefinition
// of file functions.

#include <windows.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <io.h>
#include <direct.h>
#include <fcntl.h>
#include <errno.h>
#include <stdlib.h>
#include <stdio.h>

// FILE *wn_fopen(const char *file, const char *mode);
#define F_OPEN(name, mode) wn_fopen(name, mode)
#define fopen(name, mode) wn_fopen(name, mode)

// FILE *wn_fdopen(int fd, const char *mode);
#define fdopen(fd,mode) wn_fdopen(fd,mode)

// int   wn_access(const char *path, int mode);
#define access(path,mode) wn_access(path,mode)
#define _access(path,mode) wn_access(path,mode) // for untgz.c

// int   wn_mkdir(char *dirname );
#define mkdir(dirname) wn_mkdir(dirname)
#define _mkdir(dirname) wn_mkdir(dirname) // for untgz.c

// int   wn_unlink(const char * file);
#define unlink(name) wn_unlink(name)
#define _unlink(name) wn_unlink(name) // for untgz.c

// const char *wn_getenv(const char *varname);
#define getenv(par) wn_getenv(par)

// int   wn_stat(const char *file, struct __stat * fileinfo);
#define stat(path,stats) wn_stat64(path,stats)

// int   wn_open(const char *path, int mode, int perms);
/* the identifier "open" is used for other functions and so cannot be
   re-defined. See filemgr.cpp for manual redefinitions.
#define open wn_open
*/

// these are not utilized in SWORD 1.6.2, but are used in CLucene.
// long  wn_findfirst(const char *name, struct _wfinddata_t *fileinfo);
// int   wn_rename(const char *from, const char *to);
// char *wn_fullpath(char *absPath, const char *relPath, size_t maxlen);
// int   wn_stat64(const char *file, struct __stat64 * fileinfo);
