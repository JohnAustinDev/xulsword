
#include <io.h> // including here allows proper redefinition of access
#include <stdlib.h> // allows proper definition of getenv

#define F_OPEN(name, mode) wn_fopen(name, mode)
#define fopen(name, mode) wn_fopen(name, mode)
#define _access(path,mode) wn_access(path,mode)
#define access wn_access
#define _findfirst wn_findfirst
#define _mkdir wn_mkdir
#define mkdir wn_mkdir
#define _unlink wn_unlink
#define getenv wn_getenv
/* the identifier "open" is used for other functions and so cannot be
   re-defined. See filemgr.cpp for redefinitions.
#define open wn_open
*/