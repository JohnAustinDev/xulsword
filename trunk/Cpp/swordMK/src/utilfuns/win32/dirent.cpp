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
#include <direct.h>
#include <dirent.h>
#include <errno.h>
#include <io.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "nsEmbedString.h"

struct DIR
{
    long                handle; /* -1 for failed rewind */
    struct _wfinddata_t info;
    struct dirent       result; /* d_name null iff first time */
    char                *name;  /* NTBS */
};

int sw_access(const char *path, int mode)
{
  nsEmbedCString utf8;
  nsEmbedString utf16;
  utf8.Assign(path);
  utf16.Assign(NS_ConvertUTF8toUTF16(utf8));
  return _waccess(utf16.get(), mode);
}

long findfirst(const char *name, struct _wfinddata_t *fileinfo)
{
  nsEmbedCString utf8;
  nsEmbedString utf16;
  utf8.Assign(name);
  utf16.Assign(NS_ConvertUTF8toUTF16(utf8));
  return _wfindfirst(utf16.get(), fileinfo);
}

int mkdir(char *dirname )
{
  nsEmbedCString utf8;
  nsEmbedString utf16;
  utf8.Assign(dirname);
  utf16.Assign(NS_ConvertUTF8toUTF16(utf8));
  return _wmkdir(utf16.get());
}

char *getenv(const char *varname, char * buff)
{
  nsEmbedCString utf8;
  nsEmbedString utf16;
  utf8.Assign(varname);
  utf16.Assign(NS_ConvertUTF8toUTF16(utf8));
  nsEmbedString value;
  
  value.Assign(_wgetenv(utf16.get()));
  utf8.Assign(NS_ConvertUTF16toUTF8(value));
  sprintf(buff, "%s", utf8.get());
  return buff;
}

DIR *opendir(const char *name)
{
    DIR *dir = 0;

    if(name && name[0])
    {
        size_t base_length = strlen(name);
        const char *all = /* the root directory is a special case... */
            strchr("/\\", name[base_length - 1]) ? "*" : "/*";

        if((dir = (DIR *) malloc(sizeof *dir)) != 0 &&
           (dir->name = (char *) malloc(base_length + strlen(all) + 1)) != 0)
        {
            strcat(strcpy(dir->name, name), all);

            if((dir->handle = findfirst(dir->name, &dir->info)) != -1)
            {
                dir->result.d_name = 0;
            }
            else /* rollback */
            {
                free(dir->name);
                free(dir);
                dir = 0;
            }
        }
        else /* rollback */
        {
            free(dir);
            dir   = 0;
            errno = ENOMEM;
        }
    }
    else
    {
        errno = EINVAL;
    }
    return dir;
}

int closedir(DIR *dir)
{
    int result = -1;

    if(dir)
    {
        if (dir->result.d_name) {
          free(dir->result.d_name);
          dir->result.d_name = 0;
        }
        if(dir->handle != -1)
        {
            result = _findclose(dir->handle);
        }

        free(dir->name);
        free(dir);
    }

    if(result == -1) /* map all errors to EBADF */
    {
        errno = EBADF;
    }
    return result;
}

struct dirent *readdir(DIR *dir)
{
    struct dirent *result = 0;

    if(dir && dir->handle != -1)
    {
        if(!dir->result.d_name || _wfindnext(dir->handle, &dir->info) != -1)
        {
            result = &dir->result;
            nsEmbedCString utf8;
            nsEmbedString utf16;
            utf16.Assign(dir->info.name);
            utf8.Assign(NS_ConvertUTF16toUTF8(utf16));
            if (result->d_name) {
              free(result->d_name);
              result->d_name = 0;
            }
            if (result->d_name = (char *) malloc(utf8.Length() + 1)) {
              strcpy(result->d_name, utf8.get());
            }
            else {errno = ENOMEM;}
        }
    }
    else
    {
        errno = EBADF;
    }
    return result;
}

void rewinddir(DIR *dir)
{
    if(dir && dir->handle != -1)
    {
        _findclose(dir->handle);
        dir->handle = findfirst(dir->name, &dir->info);
        if (dir->result.d_name) {
          free(dir->result.d_name);
          dir->result.d_name = 0;
        }
    }
    else
    {
        errno = EBADF;
    }
}
