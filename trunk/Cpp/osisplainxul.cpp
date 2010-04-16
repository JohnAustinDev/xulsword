/***************************************************************************
                     osisplain.cpp  -  OSIS to Plaintext filter
                             -------------------
    begin                : 2003-02-15
    copyright            : 2003 by CrossWire Bible Society
    
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
#include <osisplainxul.h>
#include <ctype.h>
#include <versekey.h>

SWORD_NAMESPACE_START

OSISPlainXUL::OSISPlainXUL() {
	setTokenStart("<");
	setTokenEnd(">");

	setEscapeStart("&");
	setEscapeEnd(";");

	setEscapeStringCaseSensitive(true);

	addEscapeStringSubstitute("amp", "&");
	addEscapeStringSubstitute("apos", "'");
	addEscapeStringSubstitute("lt", "<");
	addEscapeStringSubstitute("gt", ">");
	addEscapeStringSubstitute("quot", "\"");

	   setTokenCaseSensitive(true);
	   addTokenSubstitute("title", "\n");
	   addTokenSubstitute("/title", "\n");
	   addTokenSubstitute("/l", "\n");
	   addTokenSubstitute("lg", "\n");
	   addTokenSubstitute("/lg", "\n");
}


bool OSISPlainXUL::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	   // manually process if it wasn't a simple substitution
	if (!substituteToken(buf, token)) {
		XMLTag tag(token);
		MyUserData *u = (MyUserData *)userData;
		VerseKey *vk = SWDYNAMIC_CAST(VerseKey, u->key);
		char testament = (vk) ? vk ->Testament() : 2;	// default to NT
		if (((*token == 'w') && (token[1] == ' ')) ||
		    ((*token == '/') && (token[1] == 'w') && (!token[2]))) {
				 u->tag = token;
			
			bool start = false;
			if (*token == 'w') {
				if (token[strlen(token)-1] != '/') {
					u->w = token;
					return true;
				}
				start = true;
			}
			u->tag = (start) ? token : u->w.c_str();
			bool show = true;	// to handle unplaced article in kjv2003-- temporary till combined

			SWBuf lastText = (start) ? "stuff" : u->lastTextNode.c_str();

			const char *attrib;
			const char *val;
			if ((attrib = u->tag.getAttribute("xlit"))) {
				val = strchr(attrib, ':');
				val = (val) ? (val + 1) : attrib;
				buf.append(" <");
				buf.append(val);
				buf.append('>');
			}
			if ((attrib = u->tag.getAttribute("gloss"))) {
				val = strchr(attrib, ':');
				val = (val) ? (val + 1) : attrib;
				buf.append(" <");
				buf.append(val);
				buf.append('>');
			}
			if ((attrib = u->tag.getAttribute("lemma"))) {
				int count = u->tag.getAttributePartCount("lemma", ' ');
				int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
				do {
					char gh;
					attrib = u->tag.getAttribute("lemma", i, ' ');
					if (i < 0) i = 0;	// to handle our -1 condition
					val = strchr(attrib, ':');
					val = (val) ? (val + 1) : attrib;
					if ((strchr("GH", *val)) && (isdigit(val[1]))) {
						gh = *val;
						val++;
					}
					else {
						gh = (testament>1) ? 'G' : 'H';
					}
					if ((!strcmp(val, "3588")) && (lastText.length() < 1))
						show = false;
					else	{
						buf.append(" <");
						buf.append(gh);
						buf.append(val);
						buf.append(">");
					}
				} while (++i < count);
			}
			if ((attrib = u->tag.getAttribute("morph")) && (show)) {
				int count = u->tag.getAttributePartCount("morph", ' ');
				int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
				do {
					attrib = u->tag.getAttribute("morph", i, ' ');
					if (i < 0) i = 0;	// to handle our -1 condition
					val = strchr(attrib, ':');
					val = (val) ? (val + 1) : attrib;
					if ((*val == 'T') && (strchr("GH", val[1])) && (isdigit(val[2])))
						val+=2;
					buf.append(" (");
					buf.append(val);
					buf.append(')');
				} while (++i < count);
			}
			if ((attrib = u->tag.getAttribute("POS"))) {
				val = strchr(attrib, ':');
				val = (val) ? (val + 1) : attrib;
				
				buf.append(" <");
				buf.append(val);
				buf.append('>');
			}
		}

		// <note> tag
		else if (!strncmp(token, "note", 4)) {
		// EDITED TO REMOVE UNWANTED () FROM STRIPPED TEXT
				/*
				if (!strstr(token, "strongsMarkup")) {	// leave strong's markup notes out, in the future we'll probably have different option filters to turn different note types on or off
					buf.append(" (");
				}
				else	u->suspendTextPassThru = true;
				*/
				u->suspendTextPassThru = true;
			}
		else if (!strncmp(token, "/note", 5)) {
			/*
			if (!u->suspendTextPassThru)
				buf.append(')');
			else	u->suspendTextPassThru = false;
			*/
			//buf.append(" ");
			u->suspendTextPassThru = false;
		}

		// <lb> tag
		else if (!strcmp(tag.getName(), "lb")) {
			buf.append(" ");
			userData->supressAdjacentWhitespace = true;
		}

		// <l> tag
		else if (!strcmp(tag.getName(), "l")) {
			buf.append(" ");
			userData->supressAdjacentWhitespace = true;
		}

		// <p> tag
		else if (!strcmp(tag.getName(), "p") && tag.isEndTag()) {
			buf.append(" ");
			userData->supressAdjacentWhitespace = true;
		}

		// <q> tag
		else if (!strcmp(tag.getName(), "q")) {
			const char *tmp = tag.getAttribute("level");
			int level       = (tmp) ? atoi(tmp) : 1;
			tmp = tag.getAttribute("marker");
			bool hasMark    = tmp;
			SWBuf mark      = tmp;
			if (hasMark)
				buf.append(mark);
			//else
				//buf.append("\"");
			userData->supressAdjacentWhitespace = false;
		}

        // <milestone type="line"/>
        else if (!strncmp(token, "milestone", 9)) {
			const char* type = strstr(token+10, "type=\"");
			if (type && strncmp(type+6, "line", 4)) { //we check for type != line
				//userData->supressAdjacentWhitespace = true;
        		buf.append(" ");
				//EDIT!! buf.append('\n');
			}
                }

		else {
			return false;  // we still didn't handle token
		}
	}
	return true;
}


SWORD_NAMESPACE_END
