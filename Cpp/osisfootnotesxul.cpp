/******************************************************************************
 *
 * osisfootnotes -	SWFilter descendant to hide or show footnotes
 *			in an OSIS module.
 *			modified:  2009 by John Austin 
 */


#include <stdlib.h>
#include <stdio.h>
#include <osisfootnotesxul.h>
#include <swmodule.h>
#include <swbuf.h>
#include <versekey.h>
#include <utilxml.h>
#include <utilstr.h>

SWORD_NAMESPACE_START

const char oName[] = "Footnotes";
const char oTip[] = "Toggles Footnotes On and Off if they exist";

const SWBuf choices[3] = {"Off", "On", ""};
const StringList oValues(&choices[0], &choices[2]);


OSISFootnotesXUL::OSISFootnotesXUL() : SWOptionFilter(oName, oTip, &oValues) {
	setOptionValue("Off");
}


OSISFootnotesXUL::~OSISFootnotesXUL() {
}


char OSISFootnotesXUL::processText(SWBuf &text, const SWKey *key, const SWModule *module) {
	SWBuf token;
	bool intoken    = false;
	bool betweenReferenceTags = false;
	bool hide       = false;
	SWBuf tagText;
	XMLTag startTag;
	SWBuf refs = "";
	SWBuf fnrefs = "";
	SWBuf refListText = "";
	bool waitingForConsecutiveReference = false;
	bool noteIsStudyNote = false;
	int footnoteNum = 1;
	char buf[254];
	SWKey *p = (module) ? module->CreateKey() : (key) ? key->clone() : new VerseKey();
        VerseKey *parser = SWDYNAMIC_CAST(VerseKey, p);
        if (!parser) {
        	delete p;
                parser = new VerseKey();
        }
        *parser = key->getText();


	SWBuf orig = text;
	const char *from = orig.c_str();
	
	XMLTag tag;
	bool strongsMarkup = false;


	for (text = ""; *from; ++from) {

		// remove all newlines temporarily to fix kjv2003 module
		if ((*from == 10) || (*from == 13)) {
			if ((text.length()>1) && (text[text.length()-2] != ' ') && (*(from+1) != ' '))
				text.append(' ');
			continue;
		}

		
		if (*from == '<') {
			intoken = true;
			token = "";
			continue;
		}
		
		
		if (*from == '>') {	// process tokens
			intoken = false;	
      if (waitingForConsecutiveReference && noteIsStudyNote && strncmp(token, "reference", 9) && strncmp(token, "/reference", 10)) {
        tagText.append("<a class='sr' title='");
        tagText.append(fnrefs.c_str());
        tagText.append("'>");
        tagText.append(refListText.c_str());
        tagText.append("</a>");
        fnrefs = "";
        refListText = "";
        waitingForConsecutiveReference = false;
      }	
			if (!strncmp(token, "note", 4) || !strncmp(token.c_str(), "/note", 5)) {
				tag = token;
				
				if (!tag.isEndTag()) {
					if (tag.getAttribute("type") && (!strcmp("x-strongsMarkup", tag.getAttribute("type"))
											|| !strcmp("strongsMarkup", tag.getAttribute("type")))	// deprecated
							) {
						tag.setEmpty(false);  // handle bug in KJV2003 module where some note open tags were <note ... />
						strongsMarkup = true;
					}
					
					if (!tag.isEmpty()) {
//					if ((!tag.isEmpty()) || (SWBuf("strongsMarkup") == tag.getAttribute("type"))) {
						refs = "";
						fnrefs = "";
						startTag = tag;
						hide = true;
						tagText = "";
						noteIsStudyNote = (tag.getAttribute("type") && !strcmp("study", tag.getAttribute("type")));
						continue;
					}
				}
				if (hide && tag.isEndTag()) {
				  noteIsStudyNote = false;
					if (module->isProcessEntryAttributes() && !strongsMarkup) { //don`t parse strongsMarkup to EntryAttributes as Footnote
						sprintf(buf, "%04i", footnoteNum++);
						StringList attributes = startTag.getAttributeNames();
						for (StringList::const_iterator it = attributes.begin(); it != attributes.end(); it++) {
							module->getEntryAttributes()["Footnote"][buf][it->c_str()] = startTag.getAttribute(it->c_str());
						}
						module->getEntryAttributes()["Footnote"][buf]["body"] = tagText;
						startTag.setAttribute("swordFootnote", buf);
						if ((startTag.getAttribute("type")) && (!strcmp(startTag.getAttribute("type"), "crossReference"))) {
							if (!refs.length())
								refs = parser->ParseVerseList(tagText.c_str(), *parser, true).getRangeText();
							module->getEntryAttributes()["Footnote"][buf]["refList"] = refs.c_str();
						}
					}
					hide = false;
					if (option || (startTag.getAttribute("type") && !strcmp(startTag.getAttribute("type"), "crossReference"))) {	// we want the tag in the text; crossReferences are handled by another filter
						text.append(startTag);
//						text.append(tagText);	// we don't put the body back in because it is retrievable from EntryAttributes["Footnotes"][]["body"].
					}
					else	continue;
				}
				strongsMarkup = false;
			}

			// if not a heading token, keep token in text
			//if ((!strcmp(tag.getName(), "reference")) && (!tag.isEndTag())) {
			//	SWBuf osisRef = tag.getAttribute("osisRef");
			if (!strncmp(token, "reference", 9)) {
				if (refs.length()) {
					refs.append("; ");
				}
				if (fnrefs.length()) {
					fnrefs.append("; ");
				}
				
				const char* attr = strstr(token.c_str() + 9, "osisRef=\"");
				const char* end  = attr ? strchr(attr+9, '"') : 0;

				if (attr && end) {
					refs.append(attr+9, end-(attr+9));
					fnrefs.append(attr+9, end-(attr+9));
				}
				betweenReferenceTags = true;
				if (noteIsStudyNote) {continue;}
			}
			if (!strncmp(token, "/reference", 10)) {
        waitingForConsecutiveReference = true;
        betweenReferenceTags = false;
        if (noteIsStudyNote) {continue;}
			}
			if (!hide) {
				text.append('<');
				text.append(token);
				text.append('>');
			}
			else {
				tagText.append('<');
				tagText.append(token);
				tagText.append('>');
			}
			continue;
		}
		if (intoken) { //copy token
			token.append(*from);
		}
		else if (!hide) { //copy text which is not inside a token
			text.append(*from);
		}
		else if (noteIsStudyNote && betweenReferenceTags) {
		  refListText.append(*from);
		}
		else if (noteIsStudyNote && waitingForConsecutiveReference) {
      tagText.append("<a class='sr' title='");
      tagText.append(fnrefs.c_str());
      tagText.append("'>");
      tagText.append(refListText.c_str());
      tagText.append("</a>");
      fnrefs = "";
      refListText = "";
      waitingForConsecutiveReference = false;
      tagText.append(*from);
    }
    else {tagText.append(*from);}
	}
        delete parser;
	return 0;
}

SWORD_NAMESPACE_END

