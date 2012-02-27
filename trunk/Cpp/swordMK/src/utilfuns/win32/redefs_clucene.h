/* Window's file operation routines do not understand utf8, so any non-ascii
*  chars in path names will not resolve correctly. The fileops.h routines
*  replace the native windows versions. They convert utf8 to utf16 so that
*  non-ascii path names resolve. All native file operations must be defined (or
** re-defined as the case may be) as their fileops.h counterpart (see below).
*/

#include <stdlib.h> // allows proper definition of getenv

// Some of these are being redefined which is intentional. Any related warnings may be ignored.
#define _open wn_open
#define _mkdir wn_mkdir
#define  fopen wn_fopen
#define _rename wn_rename
#define _realpath wn_fullpath
#define fileStat(dir,sptr) wn_stat64(dir,sptr)
#define fileStat __stat64
#define _unlink wn_unlink
#define getenv wn_getenv