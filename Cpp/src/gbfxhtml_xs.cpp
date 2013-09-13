/******************************************************************************
 *
 *  gbfxhtml.cpp -	GBF to classed XHTML
 *
 * $Id: gbfxhtml.cpp 2833 2013-06-29 06:40:28Z chrislit $
 *
 * Copyright 2011-2013 CrossWire Bible Society (http://www.crosswire.org)
 *	CrossWire Bible Society
 *	P. O. Box 2528
 *	Tempe, AZ  85280-2528
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation version 2.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 */

 
#include <stdlib.h>
#include <gbfxhtml.h>
#include <swmodule.h>
#include <utilxml.h>
#include <versekey.h>
#include <ctype.h>
#include <url.h>

SWORD_NAMESPACE_START

class GBFXHTMLXS : public GBFXHTML {
  protected:
  	bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);
  	
  public:
  	GBFXHTMLXS();
};

GBFXHTMLXS::GBFXHTMLXS() : GBFXHTML() {}

bool GBFXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	const char *tok;
	MyUserData *u = (MyUserData *)userData;

	if (!substituteToken(buf, token)) {
		XMLTag tag(token);
		
		if (!strncmp(token, "WG", 2) || !strncmp(token, "WH", 2) || !strncmp(token, "WTG", 3) || !strncmp(token, "WTH", 3)) { // strong's numbers
		
		SWBuf styp;
		int tl = 2;
		if (!strncmp(token, "WG", 2))  {styp = "S_G";}
		if (!strncmp(token, "WH", 2))  {styp = "S_H";}
		if (!strncmp(token, "WTG", 3)) {styp = "SM_G"; tl = 3;}
		if (!strncmp(token, "WTH", 3)) {styp = "SM_H"; tl = 3;}
		
    VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
				buf.trimEnd();
      	char stag[45]="<span class='sn %s%s' id=\"\">"; // weird id is only to make stag uniquely identifiable for steps below
      	int stlen = 27; // length of stag string
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool append = false;
        int si = stlen;
        
        for (int i = buf.length()-1; i>=0; i--) {
          char I = buf.charAt(i);
          if (!p2fixed && (I=='<')) {
            p2 = i;
            p2fixed = true;
          }
          else if (!p1fixed && p2fixed && ((I=='>') || (I==' '))) {
            p1 = i+1;
            p1fixed = true;
            if (I==' ') {
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I == stag[si]) {
							if (I=='\'') {
								append = true;
								p1 -= (stlen-si+1);
								break;
							}
						}
						else {si = stlen;}
            if (I == '<') {
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}
        char opentag[128];
		    if (append) {
          sprintf(opentag, " %s%s", styp.c_str(), token+tl);
        }
        else {sprintf(opentag, stag, styp.c_str(), token+tl);}
        buf.insert(p1, opentag);
        if (!append) {
          p2 = p2 + strlen(opentag);
          buf.insert(p2, "</span>");
        }
      }
      else {     
        buf.append("<");
        buf.append(token);
        buf.append(">");
			}
		}

		else if (!strncmp(token, "FN", 2)) {
			buf += "<font face=\"";
			for (tok = token + 2; *tok; tok++)				
				if(*tok != '\"') 			
					buf += *tok;
			buf += "\">";
		}

		else if (!strncmp(token, "CA", 2)) {	// ASCII value
			buf += (char)atoi(&token[2]);
		}
		
		else {
			return false;
		}
	}
	return true;
}

SWORD_NAMESPACE_END
