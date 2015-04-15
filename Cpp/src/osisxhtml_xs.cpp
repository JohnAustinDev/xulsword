/******************************************************************************
 *
 *  osisxhtml.cpp -	Render filter for classed XHTML of an OSIS module
 *
 * $Id: osisxhtml.cpp 3120 2014-03-13 08:43:37Z chrislit $
 *
 * Copyright 2011-2014 CrossWire Bible Society (http://www.crosswire.org)
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
#include <ctype.h>
#include <osisxhtmlxs.h>
#include <utilxml.h>
#include <utilstr.h>
#include <versekey.h>
#include <swmodule.h>
#include <url.h>
#include <stringmgr.h>
#include <stack>

SWORD_NAMESPACE_START

static inline void outText(const char *t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }
static inline void outText(char t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }

/* The following are not used by xulsword...
void processLemma(bool suspendTextPassThru, XMLTag &tag, SWBuf &buf) {
	const char *attrib;
	const char *val;
	if ((attrib = tag.getAttribute("lemma"))) {
		int count = tag.getAttributePartCount("lemma", ' ');
		int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
		do {
			attrib = tag.getAttribute("lemma", i, ' ');
			if (i < 0) i = 0;	// to handle our -1 condition
			val = strchr(attrib, ':');
			val = (val) ? (val + 1) : attrib;
			SWBuf gh;
			if(*val == 'G')
				gh = "Greek";
			if(*val == 'H')
				gh = "Hebrew";
			const char *val2 = val;
			if ((strchr("GH", *val)) && (isdigit(val[1])))
				val2++;
			//if ((!strcmp(val2, "3588")) && (lastText.length() < 1))
			//	show = false;
			//else {
				if (!suspendTextPassThru) {
					buf.appendFormatted("<small><em class=\"strongs\">&lt;<a href=\"passagestudy.jsp?action=showStrongs&type=%s&value=%s\" class=\"strongs\">%s</a>&gt;</em></small>",
							(gh.length()) ? gh.c_str() : "", 
							URL::encode(val2).c_str(),
							val2);
				}
			//}
			
		} while (++i < count);
	}
}



void processMorph(bool suspendTextPassThru, XMLTag &tag, SWBuf &buf) {
	const char * attrib;
	const char *val;
	if ((attrib = tag.getAttribute("morph"))) { // && (show)) {
		SWBuf savelemma = tag.getAttribute("savlm");
		//if ((strstr(savelemma.c_str(), "3588")) && (lastText.length() < 1))
		//	show = false;
		//if (show) {
			int count = tag.getAttributePartCount("morph", ' ');
			int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
			do {
				attrib = tag.getAttribute("morph", i, ' ');
				if (i < 0) i = 0;	// to handle our -1 condition
				val = strchr(attrib, ':');
				val = (val) ? (val + 1) : attrib;
				const char *val2 = val;
				if ((*val == 'T') && (strchr("GH", val[1])) && (isdigit(val[2])))
					val2+=2;
				if (!suspendTextPassThru) {
					buf.appendFormatted("<small><em class=\"morph\">(<a href=\"passagestudy.jsp?action=showMorph&type=%s&value=%s\" class=\"morph\">%s</a>)</em></small>",
							URL::encode(tag.getAttribute("morph")).c_str(),
							URL::encode(val).c_str(), 
							val2);
				}
			} while (++i < count);
		//}
	}
}


}	// end anonymous namespace
*/

BasicFilterUserData *OSISXHTMLXS::createUserData(const SWModule *module, const SWKey *key) {
	return new MyUserDataXS(module, key);
}


OSISXHTMLXS::OSISXHTMLXS() {
	setTokenStart("<");
	setTokenEnd(">");

	setEscapeStart("&");
	setEscapeEnd(";");

	setEscapeStringCaseSensitive(true);
	setPassThruNumericEscapeString(true);

	addAllowedEscapeString("quot");
	addAllowedEscapeString("apos");
	addAllowedEscapeString("amp");
	addAllowedEscapeString("lt");
	addAllowedEscapeString("gt");

	setTokenCaseSensitive(true);
	
	//	addTokenSubstitute("lg",  "<br />");
	//	addTokenSubstitute("/lg", "<br />");

	// unique to OSISXHTMLXS
	addAllowedEscapeString("nbsp");
}

class OSISXHTMLXS::TagStack : public std::stack<SWBuf> {
};

OSISXHTMLXS::MyUserDataXS::MyUserDataXS(const SWModule *module, const SWKey *key) : BasicFilterUserData(module, key), quoteStack(new TagStack()), hiStack(new TagStack()), titleStack(new TagStack()), lineStack(new TagStack()), htmlTagStack(new TagStack()), pStack(new TagStack()) {
	inXRefNote    = false;
	suspendLevel = 0;
	wordsOfChristStart = "<span class=\"wordsOfJesus\"> ";
	wordsOfChristEnd   = "</span> ";
	wordsOfChrist = false;
	if (module) {
		osisQToTick = ((!module->getConfigEntry("OSISqToTick")) || (strcmp(module->getConfigEntry("OSISqToTick"), "false")));
		version = module->getName();
		BiblicalText = (!strcmp(module->getType(), "Biblical Texts"));
	}
	else {
		osisQToTick = true;	// default
		version = "";
	}
	consecutiveNewlines = 0;
	
	// variables unique to OSISXHTMLXS
	referenceTag = "";
}

OSISXHTMLXS::MyUserDataXS::~MyUserDataXS() {
	delete quoteStack;
	delete hiStack;
	delete titleStack;
	delete lineStack;
	
	// variables unique to OSISXHTMLXS
	delete htmlTagStack;
	delete pStack;
}

// This is used to output HTML tags and to update the HTML tag list so 
// that rendered text will not be returned with open tags. For this 
// function to work as intended, only a single opening or closing tag 
// can be included anywhere in t. Partial (unfinished) start tags are 
// allowed.
void OSISXHTMLXS::outHtmlTag(const char * t, SWBuf &o, MyUserDataXS *u) {

	if (u->suspendTextPassThru) {
		u->lastSuspendSegment += t;
		return;
	}
	
	SWBuf tag;
	char *tcopy = new char [ strlen(t) + 1 ];
	strcpy(tcopy, t);
	char *tagStart = strchr(tcopy, '<');
	if (tagStart) {tag = strtok(tagStart, "</ >");}
	
	bool singleton = (
		!strcmp(tag.c_str(), "br") || 
		!strcmp(tag.c_str(), "hr") || 
		!strcmp(tag.c_str(), "img")
	);
	
	bool keepTag = true;
	
	if (!singleton) {
		if (tagStart && *(tagStart+1) == '/') {
			keepTag = (!u->htmlTagStack->empty() && !strcmp(u->htmlTagStack->top().c_str(), tag.c_str()));
			if (keepTag) u->htmlTagStack->pop();
		}
		else if (tagStart) {
			// add this tag to stack
			u->htmlTagStack->push(SWBuf(tag.c_str()));
		}
	}
	
	if (keepTag) {o += t;}
	
	delete(tcopy);
}

char OSISXHTMLXS::processText(SWBuf &text, const SWKey *key, const SWModule *module) {
	char *from;
	char token[4096];
	int tokpos = 0;
	bool intoken = false;
	bool inEsc = false;
	SWBuf lastTextNode;
	MyUserDataXS *userData = (MyUserDataXS *)createUserData(module, key);
	

	SWBuf orig = text;
	from = orig.getRawData();
	text = "";

	for (;*from; from++) {

		if (*from == '<') {
			intoken = true;
			tokpos = 0;
			token[0] = 0;
			token[1] = 0;
			token[2] = 0;
			inEsc = false;
			continue;
		}

		if (*from == '&') {
			intoken = true;
			tokpos = 0;
			token[0] = 0;
			token[1] = 0;
			token[2] = 0;
			inEsc = true;
			continue;
		}

		if (inEsc) {
			if (*from == ';') {
				intoken = inEsc = false;
				userData->lastTextNode = lastTextNode;
				
				if (!userData->suspendTextPassThru)  { //if text through is disabled no tokens should pass, too
					handleEscapeString(text, token, userData);
				}
				lastTextNode = "";
				continue;
			}
		}

		if (!inEsc) {
			if (*from == '>') {
				intoken = false;
				userData->lastTextNode = lastTextNode;
				handleToken(text, token, userData);
				lastTextNode = "";
				continue;
			}
		}

		if (intoken) {
			if (tokpos < 4090) {
				token[tokpos++] = *from;
				token[tokpos+2] = 0;
			}
		}
		else {
 			if ((!userData->supressAdjacentWhitespace) || (*from != ' ')) {
				if (!userData->suspendTextPassThru) {
					text.append(*from);
					userData->lastSuspendSegment.size(0);
				}
				else	userData->lastSuspendSegment.append(*from);
				lastTextNode.append(*from);
 			}
			userData->supressAdjacentWhitespace = false;
		}

	}
	
	// THE MAIN PURPOSE OF THIS OVERRIDE FUNCTION: is to insure all opened HTML tags are closed
	while (!userData->htmlTagStack->empty()) {
		text.append((SWBuf)"</" + userData->htmlTagStack->top().c_str() + ">");
		userData->htmlTagStack->pop();
	}

	delete userData;
	return 0;
}


bool OSISXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	MyUserDataXS *u = (MyUserDataXS *)userData;
	SWBuf scratch;
	bool sub = (u->suspendTextPassThru) ? substituteToken(scratch, token) : substituteToken(buf, token);
	if (!sub) {
  // manually process if it wasn't a simple substitution
		XMLTag tag(token);
		
		// <w> tag
    if (!strcmp(tag.getName(), "w")) {
		  VerseKey *vkey;
			// see if we have a VerseKey * or descendant
			SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) {	}
      if (vkey) {
			 // start <w> tag
        if (!tag.isEndTag()) {
          u->w = "skip";
          SWBuf snumbers;
          const char *attrib;
          const char *val;
          bool sep = false;
          if (attrib = tag.getAttribute("lemma")) {
            int count = tag.getAttributePartCount("lemma", ' ');
            int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
            do {
              attrib = tag.getAttribute("lemma", i, ' ');
              if (i < 0) i = 0;	// to handle our -1 condition
              val = strchr(attrib, ':');
              val = (val) ? (val + 1) : attrib;
              if (sep) {snumbers += ".";}
              snumbers += "S";
              snumbers += "_";
							if (!strncmp(attrib, "DSS", 3)) {
								snumbers += "DSS_";
							}
							else if (!strncmp(attrib, "MT", 2)) {
								snumbers += "MT_";
							}
						  snumbers += val;
						  sep = true;
            } while (++i < count);
          }
          if (attrib = tag.getAttribute("morph")) {
            int count = tag.getAttributePartCount("morph", ' ');
            int i = (count > 1) ? 0 : -1;		// -1 for whole value cuz it's faster, but does the same thing as 0
            do {
              attrib = tag.getAttribute("morph", i, ' ');
              if (i < 0) i = 0;	// to handle our -1 condition
              val = strchr(attrib, ':');
              val = (val) ? (val + 1) : attrib;
              if (*val > 0 && *val < 127) { // some mods (like SP) have Hebrew Unicode chars as morph attribute- so skip them
								if (sep) {snumbers += ".";}
								if (!strncmp(attrib, "robinson", 8)) {snumbers += "RM";}
								else {snumbers += "SM";}
								snumbers += "_";
								snumbers += val;
								sep = true;
							}
            } while (++i < count);
          }
          snumbers.replaceBytes(".", ' '); // Changed in xulsword 3+
          if (!tag.isEmpty() && (tag.getAttribute("lemma") || tag.getAttribute("morph"))) {
						SWBuf tmp;
						tmp.appendFormatted("<span class=\"sn %s\">", snumbers.c_str());
            outHtmlTag(tmp, buf, u);
						u->w = "keep";
					}
        }
        // end <w> tag
        else if (u->w == "keep") {outHtmlTag("</span>", buf, u);}
      }
    }


		// <note> tag
		else if (!strcmp(tag.getName(), "note")) {
			if (!tag.isEndTag()) {
				SWBuf type = tag.getAttribute("type");
				bool strongsMarkup = (type == "x-strongsMarkup" || type == "strongsMarkup");	// the latter is deprecated
				if (strongsMarkup) {
					tag.setEmpty(false);	// handle bug in KJV2003 module where some note open tags were <note ... />
				}

				if (!tag.isEmpty()) {

					if (!strongsMarkup) {	// leave strong's markup notes out, in the future we'll probably have different option filters to turn different note types on or off
						SWBuf footnoteNumber = tag.getAttribute("swordFootnote");
						while (footnoteNumber.length() > 1 && footnoteNumber.startsWith("0")) {footnoteNumber << 1;}
						VerseKey *vkey = NULL;
						char ch = ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref")))) ? 'x':'n');

						u->inXRefNote = true; // Why this change? Ben Morgan: Any note can have references in, so we need to set this to true for all notes
//						u->inXRefNote = (ch == 'x');

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
							u->inXRefNote = false;
							if (!strcmp(mclass.c_str(), "cr")) {
								u->inXRefNote = true;
								if (tag.getAttribute("subType")) {
									mclass.append(" ");
									mclass.append(tag.getAttribute("subType"));
								}
							}
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
				}
				u->suspendTextPassThru = (++u->suspendLevel);
			}
			if (tag.isEndTag()) {
				u->suspendTextPassThru = (--u->suspendLevel);
				u->inXRefNote = false;
				u->lastSuspendSegment = ""; // fix/work-around for nasb devineName in note bug
			}
		}

		// <p> paragraph, <lg> linegroup tags and <list>
		// NOTE: Milestone p is illegal OSIS, but is handled anyway. Non-milestone 
		// versions of these three tags should not be found in versified Bibles, 
		// so it is not necessary to open/close u->wordsOfChrist (OSIS container 
		// tags here remain to container-type HTML elements, which could
		// break wordsOfChrist presentation).
		else if (!strcmp(tag.getName(), "p") || !strcmp(tag.getName(), "lg") || !strcmp(tag.getName(), "list")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {	// non-milestone start tag
				SWBuf htag = "<";
				htag.append(!strcmp(tag.getName(), "p") ? "p":"div");
				htag.append(" class=\"x-");
				htag.append(tag.getName());
				if (tag.getAttribute("type")) {htag.append(" "); htag.append(tag.getAttribute("type"));}
				if (tag.getAttribute("subType")) {htag.append(" "); htag.append(tag.getAttribute("subType"));}
				htag.append("\">");
				outHtmlTag(htag.c_str(), buf, u);
				u->pStack->push(tag.toString());
			}
			else if (tag.isEndTag()) {	// non-milestone end tag
				if (!u->pStack->empty()) {
					XMLTag stag(u->pStack->top());
					u->pStack->pop();
					SWBuf htag = "</";
					htag.append(!strcmp(stag.getName(), "p") ? "p":"div");
					htag.append(">");
					outHtmlTag(htag.c_str(), buf, u);
				}
			}
			else if (tag.getAttribute("eID")) { // milestone end tag
				outText("<div class=\"", buf, u);
				outText(tag.getName(), buf, u);
				outText("-end", buf, u);
				if (tag.getAttribute("type")) {outText(" ", buf, u); outText(tag.getAttribute("type"), buf, u);}
				if (tag.getAttribute("subType")) {outText(" ", buf, u); outText(tag.getAttribute("subType"), buf, u);}
				outText("\"></div>", buf, u);
			}
			else {	// milestone start tag
				outText("<div class=\"", buf, u);
				outText(tag.getName(), buf, u);
				outText("-start", buf, u);
				if (tag.getAttribute("type")) {outText(" ", buf, u); outText(tag.getAttribute("type"), buf, u);}
				if (tag.getAttribute("subType")) {outText(" ", buf, u); outText(tag.getAttribute("subType"), buf, u);}
				outText("\"></div>", buf, u);
			}
		}

		// Milestoned paragraphs, created by osis2mod
		// <div type="paragraph" sID.../>
		// <div type="paragraph" eID.../>
		else if (tag.isEmpty() && !strcmp(tag.getName(), "div") && tag.getAttribute("type") && (!strcmp(tag.getAttribute("type"), "x-p") || !strcmp(tag.getAttribute("type"), "paragraph"))) {
			SWBuf cls = (tag.getAttribute("eID") ? "end":"start");
			outText("<div class=\"p-", buf, u);
			outText(cls, buf, u);
			if (tag.getAttribute("subType")) {
				outText(" ", buf, u);
				outText(tag.getAttribute("subType"), buf, u);
			}
			outText(" osis2mod\"></div>", buf, u);
		}

		// <reference> tag
		else if (!strcmp(tag.getName(), "reference")) {
      if (!u->inXRefNote) {	// only show these if we're not in an xref note				
				if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				  SWBuf referenceClass;
				  SWBuf referenceInfo;
				  if (tag.getAttribute("type") && !strcmp("x-glossary", tag.getAttribute("type"))) {
				    u->referenceTag = "span";
				    referenceClass = "dt";
				    referenceInfo = (tag.getAttribute("osisRef")) ? tag.getAttribute("osisRef"):"";
				  }
				  else if (tag.getAttribute("type") && !strcmp("x-glosslink", tag.getAttribute("type"))) {
				    u->referenceTag = "span";
				    referenceClass = "dtl";
				    referenceInfo = (tag.getAttribute("osisRef")) ? tag.getAttribute("osisRef"):"";				  
				  }
				  else {
				    u->referenceTag = "span";
				    referenceClass = "sr";
				    if (tag.getAttribute("osisRef")) {
				      referenceInfo = tag.getAttribute("osisRef");
				    }
				    else if ((tag.getAttribute("passage"))) {
				      referenceInfo = tag.getAttribute("passage");
				    }
				    else {referenceInfo = "";}
				    // Do we need to append this to the last <span class="sr"... tag??
				    if (buf.endsWith("</span>")) {
				      int stag = -1;
				      int etag = -1;
				      int insertpoint = -1;
				      char match[17]="<span class=\"sr\"";
				      int mi = 15;
				      for (int i=buf.length()-8; i>=0 && stag==-1; i--) {
				        char mychar = buf.charAt(i);
				        if      (etag==-1 && mychar=='>') {etag=i;}
				        else if (etag!=-1 && insertpoint==-1 && mychar=='"') {insertpoint=i;}
				        else if (etag!=-1 && insertpoint!=-1 && mychar==match[mi]) {mi--;} 
				        else {mi = 15;}
				        if (mychar=='<') {stag=i;}
				      }
				      if (mi==-1) {
				        // Append current data to last tag
				        buf.setSize(buf.length()-7); // Strip off last <\span> tag
				        u->htmlTagStack->push(SWBuf("span")); // previous span has become re-opened
                insertpoint = insertpoint - 1 - strlen(userData->module->getName()); // .module name was appended to ref
				        buf.insert(insertpoint, "; ");
				        buf.insert(insertpoint+2, referenceInfo.c_str());
				        return true;
				      }
				    }
				  }
				  SWBuf tmpbuf;
				  tmpbuf.appendFormatted("<%s class=\"%s\" title=\"%s.%s\">", u->referenceTag.c_str(), referenceClass.c_str(), referenceInfo.c_str(), userData->module->getName());
				  outHtmlTag(tmpbuf, buf, u);
        }
				if (tag.isEndTag()) {
					SWBuf tmpbuf;
					tmpbuf.appendFormatted("</%s>", u->referenceTag.c_str());
					outHtmlTag(tmpbuf, buf, u);
				}
			}
		}

		// <l> poetry, <item> list-item
		// NOTE: <l> and <item> should not be nested according to my reading of OSIS 
		// schema, but nesting is handled anyway. Also <l> allows the "level" attribute,
		// while <item> does not, however both attributes are always handled anyway.
		else if (!strcmp(tag.getName(), "l") || !strcmp(tag.getName(), "item")) {
			if (tag.getAttribute("sID") || (!tag.isEndTag() && !tag.isEmpty())) {
				if (u->wordsOfChrist) {outHtmlTag(u->wordsOfChristEnd, buf, u);}
				// nested lines plus if the line itself has an x-indent or x-indent-n type attribute value or level attribute
				SWBuf htag = "<div class=\"";
				htag.append((!strcmp(tag.getName(), "l") ? "line":"item"));
				htag.append(" indent");
				int ind = u->lineStack->size();
				const char *type = tag.getAttribute("type");
				if (type) {
					if (!strcmp(type, "x-indent")) ind++;
					else if (!strncmp(type, "x-indent-", 9)) {ind += atoi(type+9);}
				}
				if (ind == u->lineStack->size()) {
					const char *level = tag.getAttribute("level");
					if (level) {
						int lv = atoi(level);
						ind += (lv > 0 ? lv:0);
					}
				}
				htag.appendFormatted("%d", ind);
				if (tag.getAttribute("subType")) {htag.append(" "); htag.append(tag.getAttribute("subType"));}
				htag.append("\">");
				outHtmlTag(htag.c_str(), buf, u);
				u->lineStack->push(tag.toString());
				if (u->wordsOfChrist) {outHtmlTag(u->wordsOfChristStart, buf, u);}
			}
			// end line marker
			else if (tag.getAttribute("eID") || tag.isEndTag()) {
				if (u->wordsOfChrist) {outHtmlTag(u->wordsOfChristEnd, buf, u);}
				outHtmlTag("</div>", buf, u);
				if (u->lineStack->size()) u->lineStack->pop();
				if (u->wordsOfChrist) {outHtmlTag(u->wordsOfChristStart, buf, u);}
			}
			// <l/> without eID or sID
			// Note: this is improper osis. This should be <lb/>
			else if (tag.isEmpty() && !tag.getAttribute("sID")) {
				outText("<div class=\"lb\"></div>", buf, u);
			}
		}

		// <lb.../>
		else if (!strcmp(tag.getName(), "lb") && (!tag.getAttribute("type") || strcmp(tag.getAttribute("type"), "x-optional"))) {
			outText("<div class=\"lb", buf, u);
			if (tag.getAttribute("subType")) {outText(" ", buf, u); outText(tag.getAttribute("subType"), buf, u);}
			outText("\"></div>", buf, u);
		}
		// <milestone type="line"/>
		// <milestone type="x-p"/>
		// <milestone type="cQuote" marker="x"/>
		else if ((!strcmp(tag.getName(), "milestone")) && (tag.getAttribute("type"))) {
			SWBuf subType = tag.getAttribute("subType");
			if (subType.length()) {subType.insert(0, " ");}
			if (!strcmp(tag.getAttribute("type"), "line")) {
				outText("<div class=\"lb", buf, u);
				outText(subType.c_str(), buf, u);
				outText("\"></div>", buf, u);
			}
			else if (!strcmp(tag.getAttribute("type"),"x-p"))  {
				outText("<div class=\"p-milestone", buf, u);
				outText(subType.c_str(), buf, u);
				outText("\"></div>", buf, u);
			}
			else if (!strcmp(tag.getAttribute("type"), "cQuote")) {
				const char *tmp = tag.getAttribute("marker");
				bool hasMark    = tmp;
				SWBuf mark      = tmp;
				tmp             = tag.getAttribute("level");
				int level       = (tmp) ? atoi(tmp) : 1;

				// first check to see if we've been given an explicit mark
				if (hasMark)
					outText(mark, buf, u);
				// finally, alternate " and ', if config says we should supply a mark
				else if (u->osisQToTick)
					outText((level % 2) ? '\"' : '\'', buf, u);
			}
			// old xulsword modules use x-p-indent (pre SWORD 1.7)
			else {
				outText("<div class=\"", buf, u); 
				outText(tag.getAttribute("type"), buf, u); 
				outText(subType.c_str(), buf, u);
				outText("\"></div>", buf, u);
			}
		}

		// <title>
		else if (!strcmp(tag.getName(), "title")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				SWBuf mclass;
				if (tag.getAttribute("level") && !strcmp(tag.getAttribute("level"), "2")) {
					mclass.set("head2");
				}
				else {mclass.set("head1");}
				if (tag.getAttribute("canonical") && !strcmp(tag.getAttribute("canonical"), "true")) {
					mclass.append(" canonical");
				}
				if (tag.getAttribute("type")) {mclass.append(" "); mclass.append(tag.getAttribute("type"));}
				if (tag.getAttribute("subType")) {mclass.append(" "); mclass.append(tag.getAttribute("subType"));}
				VerseKey *vkey = SWDYNAMIC_CAST(VerseKey, u->key);
				if (vkey && !vkey->getVerse()) {
					if (!vkey->getChapter()) {
						if (!vkey->getBook()) {
							if (!vkey->getTestament()) {
								outHtmlTag("<h1 class=\"moduleHeader", buf, u);
								tag.setAttribute("pushed", "h1");
							}
							else {
								outHtmlTag("<h1 class=\"testamentHeader", buf, u);
								tag.setAttribute("pushed", "h1");
							}
						}
						else {
							outHtmlTag("<h1 class=\"bookHeader", buf, u);
							tag.setAttribute("pushed", "h1");
						}
					}
					else {
						outHtmlTag("<h2 class=\"chapterHeader", buf, u);
						tag.setAttribute("pushed", "h2");
					}
					outText(" ", buf, u);
					outText(mclass, buf, u);
					outText("\">", buf, u);
				}
				else {
					outHtmlTag("<h3", buf, u);
					if (mclass.length()) {
						outText(" class=\"", buf, u);
						outText(mclass, buf, u);
						outText("\"", buf, u);
					}
					outText(">", buf, u);
					tag.setAttribute("pushed", "h3");
				}
				u->titleStack->push(tag.toString());
			}
			else if (tag.isEndTag()) {
				if (!u->titleStack->empty()) {
					XMLTag tag(u->titleStack->top());
					if (u->titleStack->size()) u->titleStack->pop();
					SWBuf pushed = tag.getAttribute("pushed");
					if (pushed.size()) {
						outHtmlTag((SWBuf)"</" + pushed + ">", buf, u);
					}
					else {
						outHtmlTag("</h3>", buf, u);
					}
				}
			}
		}
/*		
		// <list>
		else if (!strcmp(tag.getName(), "list")) {
			if((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (tag.getAttribute("subType")) {
					outHtmlTag("<ul class=\"", buf, u);
					outText(tag.getAttribute("subType"), buf, u);
					outText("\">", buf, u);
				}
				else outHtmlTag("<ul>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</ul>", buf, u);
			}
		}

		// <item>
		else if (!strcmp(tag.getName(), "item")) {
			if((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (tag.getAttribute("subType")) {
					outHtmlTag("<li class=\"", buf, u);
					outText(tag.getAttribute("subType"), buf, u);
					outText("\">", buf, u);
				}
				else outHtmlTag("<li>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</li>", buf, u);
			}
		}*/
		// <catchWord> & <rdg> tags (italicize)
		else if (!strcmp(tag.getName(), "rdg") || !strcmp(tag.getName(), "catchWord")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<i>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</i>", buf, u);
			}
		}

		// divineName  
		else if (!strcmp(tag.getName(), "divineName")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				u->suspendTextPassThru = (++u->suspendLevel);
			}
			else if (tag.isEndTag()) {
				SWBuf lastText = u->lastSuspendSegment.c_str();
				u->suspendTextPassThru = (--u->suspendLevel);
				if (lastText.size()) {
					scratch.setFormatted("<span class=\"divineName\">%s</span>", lastText.c_str());
					outText(scratch.c_str(), buf, u);
				}               
			} 
		}

		// <hi> text highlighting
		else if (!strcmp(tag.getName(), "hi")) {
			SWBuf type = tag.getAttribute("type");

			// handle tei rend attribute if type doesn't exist
			if (!type.length()) type = tag.getAttribute("rend");

			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (type == "bold" || type == "b" || type == "x-b") {
					outHtmlTag("<b>", buf, u);
				}

				// there is no officially supported OSIS overline attribute,
				// thus either TEI overline or OSIS x-overline would be best,
				// but we have used "ol" in the past, as well.  Once a valid
				// OSIS overline attribute is made available, these should all
				// eventually be deprecated and never documented that they are supported.
				else if (type == "ol"  || type == "overline" || type == "x-overline") {
					outHtmlTag("<span class=\"overline\">", buf, u);
				}

				else if (type == "super") {
					outHtmlTag("<span class=\"sup\">", buf, u);
				}
				else if (type == "sub") {
					outHtmlTag("<span class=\"sub\">", buf, u);
				}
				else {	// all other types
					outHtmlTag("<i>", buf, u);
				}
				u->hiStack->push(tag.toString());
				
				// create separate span from any subType
				if (tag.getAttribute("subType")) {
					SWBuf htag = "<span class=\"";
					htag.append(tag.getAttribute("subType"));
					htag.append("\">");
					outHtmlTag(htag.c_str(), buf, u);
				}
			}
			else if (tag.isEndTag()) {
				SWBuf type = "";
				SWBuf subType = "";
				if (!u->hiStack->empty()) {
					XMLTag tag(u->hiStack->top());
					if (u->hiStack->size()) u->hiStack->pop();
					type = tag.getAttribute("type");
					if (!type.length()) type = tag.getAttribute("rend");
					subType = tag.getAttribute("subType");
				}
				if (subType.length()) {
					// close any subType span
					outHtmlTag("</span>", buf, u);
				}
				if (type == "bold" || type == "b" || type == "x-b") {
					outHtmlTag("</b>", buf, u);
				}
				else if (  	   type == "ol"
						|| type == "super"
						|| type == "sub") {
					outHtmlTag("</span>", buf, u);
				}
				else outHtmlTag("</i>", buf, u);
			}
		}

		// <q> quote
		// Rules for a quote element:
		// If the tag is empty with an sID or an eID then use whatever it specifies for quoting.
		//    Note: empty elements without sID or eID are ignored.
		// If the tag is <q> then use it's specifications and push it onto a stack for </q>
		// If the tag is </q> then use the pushed <q> for specification
		// If there is a marker attribute, possibly empty, this overrides osisQToTick.
		// If osisQToTick, then output the marker, using level to determine the type of mark.
		else if (!strcmp(tag.getName(), "q")) {
			SWBuf type      = tag.getAttribute("type");
			SWBuf who       = tag.getAttribute("who");
			const char *tmp = tag.getAttribute("level");
			int level       = (tmp) ? atoi(tmp) : 1;
			tmp             = tag.getAttribute("marker");
			bool hasMark    = tmp;
			SWBuf mark      = tmp;

			// open <q> or <q sID... />
			if ((!tag.isEmpty() && !tag.isEndTag()) || (tag.isEmpty() && tag.getAttribute("sID"))) {
				// if <q> then remember it for the </q>
				if (!tag.isEmpty()) {
					u->quoteStack->push(tag.toString());
				}

				// Do this first so quote marks are included as WoC
				if (who == "Jesus") {
					outHtmlTag(u->wordsOfChristStart, buf, u);
					u->wordsOfChrist = true;
				}

				// first check to see if we've been given an explicit mark
				if (hasMark)
					outText(mark, buf, u);
				//alternate " and '
				else if (u->osisQToTick)
					outText((level % 2) ? '\"' : '\'', buf, u);
			}
			// close </q> or <q eID... />
			else if ((tag.isEndTag()) || (tag.isEmpty() && tag.getAttribute("eID"))) {
				// if it is </q> then pop the stack for the attributes
				if (tag.isEndTag() && !u->quoteStack->empty()) {
					XMLTag qTag(u->quoteStack->top());
					if (u->quoteStack->size()) u->quoteStack->pop();

					type    = qTag.getAttribute("type");
					who     = qTag.getAttribute("who");
					tmp     = qTag.getAttribute("level");
					level   = (tmp) ? atoi(tmp) : 1;
					tmp     = qTag.getAttribute("marker");
					hasMark = tmp;
					mark    = tmp;
				}

				// first check to see if we've been given an explicit mark
				if (hasMark)
					outText(mark, buf, u);
				// finally, alternate " and ', if config says we should supply a mark
				else if (u->osisQToTick)
					outText((level % 2) ? '\"' : '\'', buf, u);

				// Do this last so quote marks are included as WoC
				if (who == "Jesus") {
					outHtmlTag(u->wordsOfChristEnd, buf, u);
					u->wordsOfChrist = false;
				}
			}
		}

		// <transChange>
		else if (!strcmp(tag.getName(), "transChange")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				SWBuf type = tag.getAttribute("type");
				u->lastTransChange = type;

				// just do all transChange tags this way for now
				if ((type == "added") || (type == "supplied"))
					outHtmlTag("<span class=\"transChangeSupplied\">", buf, u);
				else if (type == "tenseChange")
					buf += "*";
			}
			else if (tag.isEndTag()) {
				SWBuf type = u->lastTransChange;
				if ((type == "added") || (type == "supplied"))
					outHtmlTag("</span>", buf, u);
			}
			else {	// empty transChange marker?
			}
		}

		// image
		else if (!strcmp(tag.getName(), "figure")) {
			const char *src = tag.getAttribute("src");
			if (src) {		// assert we have a src attribute 
				SWBuf filepath;
				if (userData->module) {
					filepath = userData->module->getConfigEntry("AbsoluteDataPath");
					if ((filepath.size()) && (filepath[filepath.size()-1] != '/') && (src[0] != '/'))
						filepath += '/';
				}
				filepath += src;

      			filepath.replaceBytes("\\", '/');
      
      		outHtmlTag(SWBuf().appendFormatted("<div class=\"image-container %s %s\">", 
							(tag.getAttribute("type") ? tag.getAttribute("type"):""),
							(tag.getAttribute("subType") ? tag.getAttribute("subType"):"")
						).c_str(), buf, u);
					outHtmlTag("<img src=\"File://", buf, u);
					outText(filepath, buf, u);
					outText("\">", buf, u);
					outHtmlTag("</div>", buf, u);
			}
		}

		// ok to leave these in
		else if (!strcmp(tag.getName(), "div")) {
			SWBuf type = tag.getAttribute("type");
			if (type == "bookGroup") {
			}
			else if (type == "book") {
			}
			else if (type == "section") {
			}
			else if (type == "majorSection") {
			}
			else if (tag.isEmpty()) { // milestone divs are not valid HTML
			}
			else if (type.length()) {
				SWBuf mtag = "<";
				if (!tag.isEndTag()) {
					mtag.append(type);
					SWBuf subType = tag.getAttribute("subType");
					if (type.length() || subType.length()) {
						mtag.append(" class=\""); 
						mtag.append(type);
						mtag.append(" ");
						mtag.append(subType);
						mtag.append("\"");
					}
				}
				else {
					mtag.append("/");
					mtag.append(type);
				}
				mtag.append(">");
				outHtmlTag(mtag, buf, u);
			}
		}
		else if (!strcmp(tag.getName(), "span")) {
			outHtmlTag(tag, buf, u);
		}
		else if (!strcmp(tag.getName(), "br")) {
			buf += tag;
		}
		else if (!strcmp(tag.getName(), "table")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<table", buf, u);
				SWBuf type = tag.getAttribute("type");
				SWBuf subType = tag.getAttribute("subType");
				if (type.length() || subType.length()) {
					outText(" class=\"", buf, u); 
					outText(type, buf, u);
					outText(" ", buf, u);
					outText(subType, buf, u);
					outText("\"", buf, u);
				}
				outText(">", buf, u);
				outHtmlTag("<tbody>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</tbody>", buf, u);
				outHtmlTag("</table>", buf, u);
			}
		}
		else if (!strcmp(tag.getName(), "row")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<tr", buf, u);
				SWBuf type = tag.getAttribute("type");
				SWBuf subType = tag.getAttribute("subType");
				if (type.length() || subType.length()) {
					outText(" class=\"", buf, u); 
					outText(type, buf, u);
					outText(" ", buf, u);
					outText(subType, buf, u);
					outText("\"", buf, u);
				}
				outText(">", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</tr>", buf, u);
			}
		}
		else if (!strcmp(tag.getName(), "cell")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<td", buf, u);
				SWBuf type = tag.getAttribute("type");
				SWBuf subType = tag.getAttribute("subType");
				if (type.length() || subType.length()) {
					outText(" class=\"", buf, u); 
					outText(type, buf, u);
					outText(" ", buf, u);
					outText(subType, buf, u);
					outText("\"", buf, u);
				}
				outText(">", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</td>", buf, u);
			}
		}
		else {
			return false;  // we still didn't handle token
		}
	}
	return true;
}


SWORD_NAMESPACE_END
