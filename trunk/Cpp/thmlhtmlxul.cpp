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
#include <thmlhtmlxul.h>
#include <swmodule.h>
#include <utilxml.h>
#include <utilstr.h>
#include <versekey.h>
#include <url.h>

SWORD_NAMESPACE_START
 

ThMLHTMLXUL::MyUserData::MyUserData(const SWModule *module, const SWKey *key) : BasicFilterUserData(module, key) {
	if (module) {
		version = module->Name();
		BiblicalText = (!strcmp(module->Type(), "Biblical Texts"));
		SecHead = false;
	}	
}


ThMLHTMLXUL::ThMLHTMLXUL() {
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
}


bool ThMLHTMLXUL::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	if (!substituteToken(buf, token)) { // manually process if it wasn't a simple substitution
		MyUserData *u = (MyUserData *)userData;		

		XMLTag tag(token);
		if ((!tag.isEndTag()) && (!tag.isEmpty()))
			u->startTag = tag;

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
          sprintf(opentag, ".%s:%s", mytype, tag.getAttribute("value"));
          if (!error) {buf.insert(insertIndex, opentag);}
        }
        else {
          sprintf(opentag, "<span class='sn' title='%s:%s'>", mytype, tag.getAttribute("value"));
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
					buf.appendFormatted("<small><em>(<a href=\"passagestudy.jsp?action=showMorph&type=Greek&value=%s\">*s</a>) </em></small>", 
						URL::encode(value.c_str()).c_str(),
						value.c_str());
			}
			else if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "Strongs")) {
				if(*value == 'H') {
					value<<1;
					buf.appendFormatted("<small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=Hebrew&value=%s\">",
						URL::encode(value.c_str()).c_str());
				}
				else if(*value == 'G') {
					value<<1;
					buf.appendFormatted("<small><em>&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=Greek&value=%s\">",
						URL::encode(value.c_str()).c_str());
				}
				buf += (value.length()) ? value.c_str() : "";
				buf += "</a>&gt; </em></small>";
			}
			else if (tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "Dict")) {
				if (!tag.isEndTag())
					buf += "<b>";
				else	buf += "</b>";
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
								buf.appendFormatted("<sup class=\"cr\" title=\"%s.%s\"></sup>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef());
					   }
					   else {
								buf.appendFormatted("<sup class=\"fn\" title=\"%s.%s\"></sup>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef());
					   }
					   u->suspendTextPassThru = true;
					}
					else {
					   if ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref"))))) {
								buf.append("<sup class=\"cr\"></sup><span class=\"genbknote\">[");
					   }
					   else {
								buf.append("<sup class=\"fn\"></sup><span class=\"genbknote\">[");
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
			if (!tag.isEndTag()) buf += "<i>";
			if (tag.isEndTag()) buf += "</i>";
		}
		// <sync> tag
		else if (!strcmp(tag.getName(), "sync")) {
		  SWBuf classtxt = "";
		  SWBuf title = "unavailable";
		  if (!tag.isEndTag()) {
		    if (tag.getAttribute("type") && !strcmp("x-glossary", tag.getAttribute("type"))) {classtxt = "dtlink";} 
        if (tag.getAttribute("value")) {title = tag.getAttribute("value");}
		    buf.appendFormatted("<a class=\"%s\" title=\"%s\">", classtxt.c_str(), title.c_str());
		  }
		  else {
		    buf.append("</a>");
		  }
		}
		// <scripRef> tag
		else if (!strcmp(tag.getName(), "scripRef")) {
			if (!tag.isEndTag()) {
				if (!tag.isEmpty()) {
					if (tag.getAttribute("passage")) {
            buf.appendFormatted("<a class=\"sr\" title=\"%s\">", tag.getAttribute("passage"));
					}
					else {
            buf.append("<a class=\"sr\" title=\"unavailable\">");
          }
				}
			}
			if (tag.isEndTag()) {	//	</scripRef>
			 buf.append("</a>");
				/*if (!u->BiblicalText) {
					SWBuf refList = u->startTag.getAttribute("passage");
					if (!refList.length())
						refList = u->lastTextNode;
					SWBuf version = tag.getAttribute("version");
					
					buf.appendFormatted("&nbsp;<a href=\"passagestudy.jsp?action=showRef&type=scripRef&value=%s&module=%s\">",
						(refList.length()) ? URL::encode(refList.c_str()).c_str() : "", 
						(version.length()) ? URL::encode(version.c_str()).c_str() : "");
					buf += u->lastTextNode.c_str();
					buf += "</a>&nbsp;";
				}
				else {
					SWBuf footnoteNumber = u->startTag.getAttribute("swordFootnote");
					VerseKey *vkey = NULL;
					// see if we have a VerseKey * or descendant
					SWTRY {
						vkey = SWDYNAMIC_CAST(VerseKey, u->key);
					}
					SWCATCH ( ... ) {}
					if (vkey) {
						// leave this special osis type in for crossReference notes types?  Might thml use this some day? Doesn't hurt.
						//buf.appendFormatted("<a href=\"noteID=%s.x.%s\"><small><sup>*x</sup></small></a> ", vkey->getText(), footnoteNumber.c_str());
						buf.appendFormatted("<a href=\"passagestudy.jsp?action=showNote&type=x&value=%s&module=%s&passage=%s\"><small><sup>*x</sup></small></a> ",  
							URL::encode(footnoteNumber.c_str()).c_str(), 
							URL::encode(u->version.c_str()).c_str(),
							URL::encode(vkey->getText()).c_str());
					
					}
				}

				// let's let text resume to output again
				u->suspendTextPassThru = false;*/
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

			buf += '<';
			for (const char *c = token; *c; c++) {
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
			buf += '>';
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
