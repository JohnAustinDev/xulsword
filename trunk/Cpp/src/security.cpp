/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

    xulSword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    xulSword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with xulSword.  If not, see <http://www.gnu.org/licenses/>.
*/

#ifdef _WIN32
  #include "windows.h"
#endif

#include <stdio.h>
#include "security.h"

#define KEYLEN 16
#define NOTFOUND "Not Found"

#include "keygen.h"
#include "swlog.h"

using namespace sword;

bool security::PassedIntegrityCheck = true;

/* This routine combines the passed cipher key with a hidden cipher key.
   The resulting cipher key should then be the key which the text was actually
   encrypted with.
*/
void security::ModCipherKey(char * outkey, const char * inkey, const char * modVersion, const char * modName) {
  if (PassedIntegrityCheck) {
    char compKey[KEYLEN+1];
    getcodes(compKey, modVersion, modName);
//SWLog::getSystemLog()->logDebug("ModCipherKey: key:%s, version:%s, mod:%s\n", compKey, modVersion, modName);
    // Source Code
    //sprintf(outkey,"%s%s", compKey, inkey);
  	sprintf(outkey, "%s%s", inkey, compKey);
  	return;
	}
	else {sprintf(outkey,"%s","0");}
}
