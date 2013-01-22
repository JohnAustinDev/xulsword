/***************************************************************************
                          gbfhtmlhref.cpp  -   GBF to HTML filter with hrefs 
			        for strongs and morph tags
                             -------------------
    begin                    : 2001-09-03
    copyright            : 2001 by CrossWire Bible Society
    
    modified:  2009 by John Austin
 ***************************************************************************/

/***************************************************************************
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 2 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 ***************************************************************************/

#include <stdlib.h>
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
		
		// NOTE RusVZh does not use WH, WT, WTH, or WTG tags and so they are not implemented below
		if (!strncmp(token, "WG", 2)) { // strong's numbers
    VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
      	char stag[35]="<span class='sn S_G%s'>";
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool append;
        int si = 22; // the "=" in title=
        
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
              append = false;
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I != stag[si]) {si = 22;}
            if (I == '<') {
              append = (si == 0);
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}
        char opentag[64];
		    if (append) {
          sprintf(opentag, " S_G%s", token+2);
          p1 = p1-2;
        }
        else {sprintf(opentag, stag, token+2);}
        buf.insert(p1, opentag);
        if (!append) {
          p2 = p2 + strlen(opentag); //36
          buf.insert(p2, "</span>");
        }
      }
      else {     
        //buf += " <small><em>&lt;<a href=\"type=Strongs value=";
        buf += " <small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=Greek&value=";
        for (tok = token+2; *tok; tok++)
          //if(token[i] != '\"')
          buf += *tok;
        buf += "\">";
        for (tok = token + 2; *tok; tok++)
          //if(token[i] != '\"')
          buf += *tok;
        buf += "</a>&gt;</em></small>";
			}
		}
		else if (!strncmp(token, "WH", 2)) { // strong's numbers
			VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
      	char stag[35]="<span class='sn S_H%s'>";
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool append;
        int si = 22; // the "=" in title=
        
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
              append = false;
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I != stag[si]) {si = 22;}
            if (I == '<') {
              append = (si == 0);
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}
        char opentag[64];
		    if (append) {
          sprintf(opentag, " S_H%s", token+2);
          p1 = p1-2;
        }
        else {sprintf(opentag, stag, token+2);}
        buf.insert(p1, opentag);
        if (!append) {
          p2 = p2 + strlen(opentag); //36
          buf.insert(p2, "</span>");
        }
      }
      else {
			//buf += " <small><em>&lt;<a href=\"type=Strongs value=";
			buf += " <small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=Hebrew&value=";
			for (tok = token+2; *tok; tok++)
				//if(token[i] != '\"')
					buf += *tok;
			buf += "\">";
			for (tok = token + 2; *tok; tok++)
				//if(token[i] != '\"')
					buf += *tok;
			buf += "</a>&gt;</em></small>";
			}
		}
		else if (!strncmp(token, "WTG", 3)) { // strong's numbers tense
			VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
      	char stag[36]="<span class='sn WT_G%s'>";
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool append;
        int si = 22; // the "=" in title=
        
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
              append = false;
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I != stag[si]) {si = 22;}
            if (I == '<') {
              append = (si == 0);
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}
        char opentag[64];
		    if (append) {
          sprintf(opentag, " WT_G%s", token+3);
          p1 = p1-2;
        }
        else {sprintf(opentag, stag, token+3);}
        buf.insert(p1, opentag);
        if (!append) {
          p2 = p2 + strlen(opentag); //36
          buf.insert(p2, "</span>");
        }
      }
      else {
			//buf += " <small><em>(<a href=\"type=Strongs value=";
			buf += " <small><em>(<a href=\"passagestudy.jsp?action=showStrongs&type=Greek&value=";
			for (tok = token + 3; *tok; tok++)
				if(*tok != '\"')
					buf += *tok;
			buf += "\">";
			for (tok = token + 3; *tok; tok++)
				if(*tok != '\"')
					buf += *tok;
			buf += "</a>)</em></small>";
			}
		}
		else if (!strncmp(token, "WTH", 3)) { // strong's numbers tense
			VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
      	char stag[36]="<span class='sn WT_H%s'>";
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool append;
        int si = 22; // the "=" in title=
        
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
              append = false;
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I != stag[si]) {si = 22;}
            if (I == '<') {
              append = (si == 0);
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}
        char opentag[64];
		    if (append) {
          sprintf(opentag, " WT_H%s", token+3);
          p1 = p1-2;
        }
        else {sprintf(opentag, stag, token+3);}
        buf.insert(p1, opentag);
        if (!append) {
          p2 = p2 + strlen(opentag); //36
          buf.insert(p2, "</span>");
        }
      }
      else {
			//buf += " <small><em>(<a href=\"type=Strongs value=";
			buf += " <small><em>(<a href=\"passagestudy.jsp?action=showStrongs&type=Hebrew&value=";
			for (tok = token + 3; *tok; tok++)
				if(*tok != '\"')
					buf += *tok;
			buf += "\">";
			for (tok = token + 3; *tok; tok++)
				if(*tok != '\"')
					buf += *tok;
			buf += "</a>)</em></small>";
		}
    }
		else if (!strncmp(token, "WT", 2) && strncmp(token, "WTH", 3) && strncmp(token, "WTG", 3)) { // morph tags
			//buf += " <small><em>(<a href=\"type=morph class=none value=";
			buf += " <small><em>(<a href=\"passagestudy.jsp?action=showMorph&type=Greek&value=";
			
			for (tok = token + 2; *tok; tok++)
				if(*tok != '\"')
					buf += *tok;
			buf += "\">";
			for (tok = token + 2; *tok; tok++)				
				if(*tok != '\"') 			
					buf += *tok;		
			buf += "</a>)</em></small>";
		}

		else if (!strcmp(tag.getName(), "RX")) {
			buf += "<a href=\"";
			for (tok = token + 3; *tok; tok++) {
			  if(*tok != '<' && *tok+1 != 'R' && *tok+2 != 'x') {
			    buf += *tok;
			  }
			  else {
			    break;
			  }
			}
			buf += "\">";
		}
		else if (!strcmp(tag.getName(), "RF")) {
			SWBuf type = tag.getAttribute("type");
			SWBuf footnoteNumber = tag.getAttribute("swordFootnote");
			VerseKey *vkey = NULL;
			// see if we have a VerseKey * or descendant
			SWTRY {
				vkey = SWDYNAMIC_CAST(VerseKey, u->key);
			}
			SWCATCH ( ... ) {	}
			if (vkey) {
				// leave this special osis type in for crossReference notes types?  Might thml use this some day? Doesn't hurt.
				//char ch = ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref")))) ? 'x':'n');
				buf.appendFormatted("<span class=\"fn\" title=\"%s.%s.%s\"></span>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
                userData->module->Name());
			}
			u->suspendTextPassThru = true;
		}
		else if (!strcmp(tag.getName(), "Rf")) {
			u->suspendTextPassThru = false;
		}
/*
		else if (!strncmp(token, "RB", 2)) {
			buf += "<i> ";
			u->hasFootnotePreTag = true;
		}

		else if (!strncmp(token, "Rf", 2)) {
			buf += "&nbsp<a href=\"note=";
			buf += u->lastTextNode.c_str();
			buf += "\">";
			buf += "<small><sup>*n</sup></small></a>&nbsp";
			// let's let text resume to output again
			u->suspendTextPassThru = false;
		}
		
		else if (!strncmp(token, "RF", 2)) {
			if (u->hasFootnotePreTag) {
				u->hasFootnotePreTag = false;
				buf += "</i> ";
			}
			u->suspendTextPassThru = true;
		}
*/
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
