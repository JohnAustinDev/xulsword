/* Window's file operation routines do not understand utf8, so any non-ascii
*  chars in path names will not resolve correctly. The fileops.h routines
*  replace the native windows versions. They convert utf8 to utf16 so that
*  non-ascii path names resolve. All native file operations must be defined (or
*  re-defined as the case may be) as their fileops.h counterpart (see below).
*/

// Following are all the Microsoft library headers effected by re-defines.
// Including them all before the #defines below insures proper redefinition
// of file functions.

#include <sys/types.h>
#include <sys/stat.h>
#include <io.h>
#include <direct.h>
#include <fcntl.h>
#include <errno.h>
#include <stdlib.h>
#include <stdio.h>

// FILE *wn_fopen(const char *file, const char *mode);
#define fopen(name, mode) wn_fopen(name, mode)

// int   wn_mkdir(char *dirname );
#define _mkdir(dirname) wn_mkdir(dirname)

// int   wn_unlink(const char * file);
#define _unlink(name) wn_unlink(name)

// const char *wn_getenv(const char *varname);
#define getenv(par) wn_getenv(par)

// int   wn_stat(const char *file, struct __stat * fileinfo);
//#define fileStat _stati64
//#define _stati64(file,info) wn_stati64(file,info)
#define _stat64(file,info) wn_stat64(file,info)

// int   wn_open(const char *path, int mode, int perms);
#define _open wn_open

// int   wn_rename(const char *from, const char *to);
#undef _rename
#define _rename wn_rename

// char *wn_fullpath(char *absPath, const char *relPath, size_t maxlen);
#undef _realpath
#define _realpath(rel,abs) wn_fullpath(abs,rel,CL_MAX_PATH)

// the following were not used in CLucene 0.9.21b
// FILE *wn_fdopen(int fd, const char *mode);
#define _fdopen wn_fdopen

// int   wn_access(const char *path, int mode);
#define _access wn_access

// long  wn_findfirst(const char *name, struct _wfinddata_t *fileinfo);
#undef _findfirst
#define _findfirst wn_findfirst
