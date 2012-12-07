/***************************************************************************
                     thmlhtmlhref.cpp  -  ThML to HTML filter with hrefs  
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
#include <utilstr.h>
#include <versekey.h>
#include <url.h>

SWORD_NAMESPACE_START

class ThMLXHTMLXS : public ThMLXHTML {
  protected:
  	bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);
  	
  public:
  	ThMLXHTMLXS();
};

ThMLXHTMLXS::ThMLXHTMLXS() : ThMLXHTML() {}

bool ThMLXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	if (!substituteToken(buf, token)) { // manually process if it wasn't a simple substitution
		MyUserData *u = (MyUserData *)userData;		

		XMLTag tag(token);
		if ((!tag.isEndTag()) && (!tag.isEmpty()))
			u->startTag = tag;

// The TR (Textus Recepticus) module is Thml with Strong's numbers
		if (tag.getName() && !strcmp(tag.getName(), "sync")) {
		  VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
        char stopChar;
		    int error = 0;
		    unsigned long insertIndex = buf.length();
        char insertAfterChar = buf.charAt(insertIndex-1);
        if (insertAfterChar == '>') {
          if (!buf.endsWith("</span>")) {error=1;}
          stopChar = '>';
          insertAfterChar--;
       }
        else {stopChar = ' ';}
		    while ((insertIndex > 0) && (insertAfterChar != stopChar)) {
		      if (--insertIndex > 0) {
		        insertAfterChar = buf.charAt(insertIndex-1);
		      }
        };
        char opentag[128];
        char s[2]="S";
        char rm[3]="RM";
        char *mytype;
        if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "Strongs")) {mytype = s;}
        else if (tag.getAttribute("class") && !strcmp(tag.getAttribute("class"), "Robinson")) {mytype = rm;}
        else {error=2;}
		    if (stopChar == '>') {
          insertIndex -= 2;
          sprintf(opentag, " %s_%s", mytype, tag.getAttribute("value"));
          if (!error) {buf.insert(insertIndex, opentag);}
        }
        else {
          sprintf(opentag, "<span class='sn %s_%s'>", mytype, tag.getAttribute("value"));
          if (!error) {
            buf.insert(insertIndex, opentag);
            buf.append("</span>");
          }
        }
        //else {printf("ERROR:%i\n", error);}
      }
      else {
  	    SWBuf value = tag.getAttribute("value");
  			if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "morph")) { //&gt;
  				if(value.length())
  					buf.appendFormatted("<small><em>(<a href=\"passagestudy.jsp?action=showMorph&type=Greek&value=%s\">%s</a>)</em></small>",
  						URL::encode(value.c_str()).c_str(),
  						value.c_str());
  			}
  			else if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "lemma")) { //&gt;
  				if(value.length())
  					// empty "type=" is deliberate.
  					buf.appendFormatted("<small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=&value=%s\">%s</a>&gt;</em></small>",
  						URL::encode(value.c_str()).c_str(),
  						value.c_str());
  			}
  			else if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "Strongs")) {
  				char ch = *value;
  				value<<1;
  				buf.appendFormatted("<small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=%s&value=%s\">",
  						    ((ch == 'H') ? "Hebrew" : "Greek"),
  						    URL::encode(value.c_str()).c_str());

  				buf += (value.length()) ? value.c_str() : "";
  				buf += "</a>&gt;</em></small>";
  			}
  			else if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "Dict")) {
  				buf += (tag.isEndTag() ? "</b>" : "<b>");


			 }
			 
			}
		}
		// <note> tag
		else if (!strcmp(tag.getName(), "note")) {
			if (!tag.isEndTag()) {
				if (!tag.isEmpty()) {
					SWBuf type = tag.getAttribute("type");
					SWBuf footnoteNumber = tag.getAttribute("swordFootnote");
					VerseKey *vkey = NULL;
					// see if we have a VerseKey * or descendant
					SWTRY {
						vkey = SWDYNAMIC_CAST(VerseKey, u->key);
					}
					SWCATCH ( ... ) {	}
					if (vkey) {
					   if ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref"))))) {
								buf.appendFormatted("<span class=\"cr\" title=\"%s.%s.%s\"></span>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
                userData->module->Name());
					   }
					   else {
								buf.appendFormatted("<span class=\"fn\" title=\"%s.%s.%s\"></span>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
                userData->module->Name());
					   }
					   u->suspendTextPassThru = true;
					}
					else {
					   if ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref"))))) {
								buf.appendFormatted("<span class=\"cr\" title=\"%s.unavailable.%s\"></span><span class=\"genbknote\">[",
								footnoteNumber.c_str(), 
                userData->module->Name());
					   }
					   else {
								buf.appendFormatted("<span class=\"fn\" title=\"%s.unavailable.%s\"></span><span class=\"genbknote\">[",
								footnoteNumber.c_str(), 
                userData->module->Name());
					   }
					   u->suspendTextPassThru = false;
					}
				}
			}
			if (tag.isEndTag()) {
			   if (u->suspendTextPassThru == false) {
			     buf.append("]</span>");
			   }
			   else {u->suspendTextPassThru = false;}
			}
		}
		else if (!strcmp(tag.getName(), "scripture")) {
			buf += (tag.isEndTag() ? "</i>" : "<i>");
		}
		// <scripRef> tag
		else if (!strcmp(tag.getName(), "scripRef")) {
      // all types of modules work the same with xulsword...
			if (!tag.isEndTag()) {
				if (!tag.isEmpty()) {
					if (tag.getAttribute("passage")) {
            buf.appendFormatted("<a class=\"sr\" title=\"%s.%s\">", tag.getAttribute("passage"), userData->module->Name());
					}
					else {
            buf.appendFormatted("<a class=\"sr\" title=\"unavailable.%s\">", userData->module->Name());
          }
				}
			}
			if (tag.isEndTag()) {	//	</scripRef>
			 buf.append("</a>");
			}
		}
		else if (tag.getName() && !strcmp(tag.getName(), "div")) {
			if (tag.isEndTag() && u->SecHead) {
				buf += "</i></b><br />";
				u->SecHead = false;
			}
			else if (tag.getAttribute("class")) {
				if (!stricmp(tag.getAttribute("class"), "sechead")) {
					u->SecHead = true;
					buf += "<br /><b><i>";
				}
				else if (!stricmp(tag.getAttribute("class"), "title")) {
					u->SecHead = true;
					buf += "<br /><b><i>";
				}
				else {
					buf += tag;
				}
			}
			else {
				buf += tag;
			}
		}
		else if (tag.getName() && (!strcmp(tag.getName(), "img") || !strcmp(tag.getName(), "image"))) {
			const char *src = strstr(token, "src");
			if (!src)		// assert we have a src attribute
				return false;

			const char *c, *d;
			if (((c = strchr(src+3, '"')) == NULL) ||
			    ((d = strchr( ++c , '"')) == NULL))	// identify endpoints.
				return false;			// abandon hope.

			SWBuf imagename = "file:";
			if (*c == '/')				// as below, inside for loop.
				imagename += userData->module->getConfigEntry("AbsoluteDataPath");
			while (c != d)				// move bits into the name.
			    imagename += *(c++);

			// images become clickable, if the UI supports showImage.
			buf.appendFormatted("<a href=\"passagestudy.jsp?action=showImage&value=%s&module=%s\"><",
					    URL::encode(imagename.c_str()).c_str(),
					    URL::encode(u->version.c_str()).c_str());

			for (c = token; *c; c++) {
				if ((*c == '/') && (*(c+1) == '\0'))
					continue;
				if (c == src) {
					for (;((*c) && (*c != '"')); c++)
						buf += *c;

					if (!*c) { c--; continue; }

					buf += '"';
					if (*(c+1) == '/') {
						buf += "file:";
						buf += userData->module->getConfigEntry("AbsoluteDataPath");
						if (buf[buf.length()-2] == '/')
							c++;		// skip '/'
					}
					continue;
				}
				buf += *c;
			}
               buf += " border=0 /></a>";
		}
		else {
			buf += '<';
			/*for (const char *tok = token; *tok; tok++)
				buf += *tok;*/
			buf += token;
			buf += '>';
			//return false;  // we still didn't handle token
		}
	}
	return true;
}

SWORD_NAMESPACE_END