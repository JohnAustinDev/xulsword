/******************************************************************************
 *
 *  thmlxhtml.cpp -	ThML to classed XHTML
 *
 * $Id: thmlxhtml.cpp 3192 2014-04-19 17:26:34Z scribe $
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
#include <thmlxhtmlxs.h>
#include <swmodule.h>
#include <utilxml.h>
#include <utilstr.h>
#include <versekey.h>
#include <url.h>

SWORD_NAMESPACE_START
 

const char *ThMLXHTMLXS::getHeader() const {
	return "\
	";
}


ThMLXHTMLXS::MyUserData::MyUserData(const SWModule *module, const SWKey *key) : BasicFilterUserData(module, key) {
	isBiblicalText = false;
	secHeadLevel = 0;
	if (module) {
		version = module->getName();
		isBiblicalText = (!strcmp(module->getType(), "Biblical Texts"));
	}	
}


ThMLXHTMLXS::ThMLXHTMLXS() {
	setTokenStart("<");
	setTokenEnd(">");

	setEscapeStart("&");
	setEscapeEnd(";");

	setEscapeStringCaseSensitive(true);
	setPassThruNumericEscapeString(true);

	addAllowedEscapeString("quot");
	addAllowedEscapeString("amp");
	addAllowedEscapeString("lt");
	addAllowedEscapeString("gt");

	addAllowedEscapeString("nbsp");
	addAllowedEscapeString("brvbar"); // "Š"
	addAllowedEscapeString("sect");   // "§"
	addAllowedEscapeString("copy");   // "©"
	addAllowedEscapeString("laquo");  // "«"
	addAllowedEscapeString("reg");    // "®"
	addAllowedEscapeString("acute");  // "Ž"
	addAllowedEscapeString("para");   // "¶"
	addAllowedEscapeString("raquo");  // "»"

	addAllowedEscapeString("Aacute"); // "Á"
	addAllowedEscapeString("Agrave"); // "À"
	addAllowedEscapeString("Acirc");  // "Â"
	addAllowedEscapeString("Auml");   // "Ä"
	addAllowedEscapeString("Atilde"); // "Ã"
	addAllowedEscapeString("Aring");  // "Å"
	addAllowedEscapeString("aacute"); // "á"
	addAllowedEscapeString("agrave"); // "à"
	addAllowedEscapeString("acirc");  // "â"
	addAllowedEscapeString("auml");   // "ä"
	addAllowedEscapeString("atilde"); // "ã"
	addAllowedEscapeString("aring");  // "å"
	addAllowedEscapeString("Eacute"); // "É"
	addAllowedEscapeString("Egrave"); // "È"
	addAllowedEscapeString("Ecirc");  // "Ê"
	addAllowedEscapeString("Euml");   // "Ë"
	addAllowedEscapeString("eacute"); // "é"
	addAllowedEscapeString("egrave"); // "è"
	addAllowedEscapeString("ecirc");  // "ê"
	addAllowedEscapeString("euml");   // "ë"
	addAllowedEscapeString("Iacute"); // "Í"
	addAllowedEscapeString("Igrave"); // "Ì"
	addAllowedEscapeString("Icirc");  // "Î"
	addAllowedEscapeString("Iuml");   // "Ï"
	addAllowedEscapeString("iacute"); // "í"
	addAllowedEscapeString("igrave"); // "ì"
	addAllowedEscapeString("icirc");  // "î"
	addAllowedEscapeString("iuml");   // "ï"
	addAllowedEscapeString("Oacute"); // "Ó"
	addAllowedEscapeString("Ograve"); // "Ò"
	addAllowedEscapeString("Ocirc");  // "Ô"
	addAllowedEscapeString("Ouml");   // "Ö"
	addAllowedEscapeString("Otilde"); // "Õ"
	addAllowedEscapeString("oacute"); // "ó"
	addAllowedEscapeString("ograve"); // "ò"
	addAllowedEscapeString("ocirc");  // "ô"
	addAllowedEscapeString("ouml");   // "ö"
	addAllowedEscapeString("otilde"); // "õ"
	addAllowedEscapeString("Uacute"); // "Ú"
	addAllowedEscapeString("Ugrave"); // "Ù"
	addAllowedEscapeString("Ucirc");  // "Û"
	addAllowedEscapeString("Uuml");   // "Ü"
	addAllowedEscapeString("uacute"); // "ú"
	addAllowedEscapeString("ugrave"); // "ù"
	addAllowedEscapeString("ucirc");  // "û"
	addAllowedEscapeString("uuml");   // "ü"
	addAllowedEscapeString("Yacute"); // "Ý"
	addAllowedEscapeString("yacute"); // "ý"
	addAllowedEscapeString("yuml");   // "ÿ"

	addAllowedEscapeString("deg");    // "°"
	addAllowedEscapeString("plusmn"); // "±"
	addAllowedEscapeString("sup2");   // "²"
	addAllowedEscapeString("sup3");   // "³"
	addAllowedEscapeString("sup1");   // "¹"
	addAllowedEscapeString("nbsp");   // "º"
	addAllowedEscapeString("pound");  // "£"
	addAllowedEscapeString("cent");   // "¢"
	addAllowedEscapeString("frac14"); // "Œ"
	addAllowedEscapeString("frac12"); // "œ"
	addAllowedEscapeString("frac34"); // "Ÿ"
	addAllowedEscapeString("iquest"); // "¿"
	addAllowedEscapeString("iexcl");  // "¡"
	addAllowedEscapeString("ETH");    // "Ð"
	addAllowedEscapeString("eth");    // "ð"
	addAllowedEscapeString("THORN");  // "Þ"
	addAllowedEscapeString("thorn");  // "þ"
	addAllowedEscapeString("AElig");  // "Æ"
	addAllowedEscapeString("aelig");  // "æ"
	addAllowedEscapeString("Oslash"); // "Ø"
	addAllowedEscapeString("curren"); // "€"
	addAllowedEscapeString("Ccedil"); // "Ç"
	addAllowedEscapeString("ccedil"); // "ç"
	addAllowedEscapeString("szlig");  // "ß"
	addAllowedEscapeString("Ntilde"); // "Ñ"
	addAllowedEscapeString("ntilde"); // "ñ"
	addAllowedEscapeString("yen");    // "¥"
	addAllowedEscapeString("not");    // "¬"
	addAllowedEscapeString("ordf");   // "ª"
	addAllowedEscapeString("uml");    // "š"
	addAllowedEscapeString("shy");    // "­"
	addAllowedEscapeString("macr");   // "¯"

	addAllowedEscapeString("micro");  // "µ"
	addAllowedEscapeString("middot"); // "·"
	addAllowedEscapeString("cedil");  // "ž"
	addAllowedEscapeString("ordm");   // "º"
	addAllowedEscapeString("times");  // "×"
	addAllowedEscapeString("divide"); // "÷"
	addAllowedEscapeString("oslash"); // "ø"

	setTokenCaseSensitive(true);
//	addTokenSubstitute("scripture", "<i> ");
	addTokenSubstitute("/scripture", "</i> ");

	renderNoteNumbers = false;
}


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
					SWBuf mclass = "fn";
					if ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref"))))) {
						mclass = "cr";
					}
					if (vkey) {
						buf.appendFormatted("<span class=\"%s\" title=\"%s.%s.%s\"></span>",
							mclass.c_str(),
							footnoteNumber.c_str(), 
							vkey->getOSISRef(),
							userData->module->getName());
					}
					else {
						buf.appendFormatted("<span class=\"gfn\" title=\"%s.%s.%s\">%s</span>",
							footnoteNumber.c_str(),
							mclass.c_str(),
							userData->module->getName(),
							footnoteNumber.c_str());
					}
				}
				u->suspendTextPassThru = true;
			}
			if (tag.isEndTag()) {
			   u->suspendTextPassThru = false;
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
            buf.appendFormatted("<a class=\"sr\" title=\"%s.%s\">", tag.getAttribute("passage"), userData->module->getName());
					}
					else {
            buf.appendFormatted("<a class=\"sr\" title=\"unavailable.%s\">", userData->module->getName());
          }
				}
			}
			if (tag.isEndTag()) {	//	</scripRef>
			 buf.append("</a>");
			}
		}
		else if (tag.getName() && !strcmp(tag.getName(), "div")) {
			if (tag.isEndTag() && u->secHeadLevel) {
				buf += "</h";
				buf += u->secHeadLevel;
				buf += ">";
				u->secHeadLevel = 0;
			}
			else if (tag.getAttribute("class")) {
				if (!stricmp(tag.getAttribute("class"), "sechead")) {
					u->secHeadLevel = '3';
					buf += "<h3>";
				}
				else if (!stricmp(tag.getAttribute("class"), "title")) {
					u->secHeadLevel = '2';
					buf += "<h2>";
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

			SWBuf imagename;
			if (*c == '/')				// as below, inside for loop.
				imagename += userData->module->getConfigEntry("AbsoluteDataPath");
			while (c != d)				// move bits into the name.
			    imagename += *(c++);
			    
			imagename.replaceBytes("\\", '/');

			buf.append("<div class=\"image-container\">");
			buf.append("<img src=\"File://");
			buf.append(imagename.c_str());
			buf.append("\"></div>");
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
