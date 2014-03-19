/******************************************************************************
 *
 *  osisxhtml.cpp -	Render filter for classed XHTML of an OSIS module
 *
 * $Id: osisxhtml.cpp 2833 2013-06-29 06:40:28Z chrislit $
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
#include <ctype.h>
#include <osisxhtml.h>
#include <utilxml.h>
#include <utilstr.h>
#include <versekey.h>
#include <swmodule.h>
#include <url.h>
#include <stringmgr.h>
#include <stack>
#include <swbasicfilter.h>
#include <swkey.h>
#include <list>

SWORD_NAMESPACE_START

class OSISXHTML::TagStack : public std::stack<SWBuf> {};
static inline void outText(const char *t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }
static inline void outText(char t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }

class OSISXHTMLXS : public OSISXHTML {
  private:
		// variables unique to OSISXHTMLXS
    int footnoteNum;
		SWBuf referenceTag;
		TagStack *htmlTagStack; // used to insure rendered HTML tags are all closed
		TagStack *pStack; // used for OSIS <p> with subType to render as HTML <p>
		int previousConsecutiveNewlines;

  protected:
		// redefinition of virtual function defined in OSISXHTML
  	BasicFilterUserData *createUserData(const SWModule *module, const SWKey *key) {
      footnoteNum = 1;
      referenceTag = "";
      if (htmlTagStack) {delete htmlTagStack;}
      htmlTagStack = new TagStack;
      if (pStack) {delete pStack;}
      pStack = new TagStack;
  		return new MyUserData(module, key);
  	}
  	
  	// redefinition of virtual function defined in OSISXHTML
  	bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);
  	
  public:
  	OSISXHTMLXS();
  	~OSISXHTMLXS();
  	
  	void outHtmlTag(const char * t, SWBuf &o, BasicFilterUserData *u);
  	
  	// redefinition of virtual function defined in SWBasicFilter
  	char processText(SWBuf &text, const SWKey *key = 0, const SWModule *module = 0);
};

OSISXHTMLXS::OSISXHTMLXS() : OSISXHTML(), htmlTagStack(NULL), pStack(NULL), previousConsecutiveNewlines(0) {
	addAllowedEscapeString("nbsp");
}

OSISXHTMLXS::~OSISXHTMLXS() {
	if (htmlTagStack) {delete htmlTagStack;}
	if (pStack) {delete pStack;}
}

// This is used to output HTML tags and to update the HTML tag list so 
// that rendered text will not be returned with open tags. For this 
// function to work as intended, only a single opening or closing tag 
// can be included anywhere in t.
void OSISXHTMLXS::outHtmlTag(const char * t, SWBuf &o, BasicFilterUserData *u) {

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
	
	if (tagStart && *(tagStart+1) == '/' && !singleton) {
		keepTag = (!htmlTagStack->empty() && !strcmp(htmlTagStack->top().c_str(), tag.c_str()));
		if (keepTag) htmlTagStack->pop();
	}
	else if (tagStart && !singleton) {
		// add this tag to stack
		htmlTagStack->push(SWBuf(tag.c_str()));
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
	BasicFilterUserData *userData = createUserData(module, key);
	
	// xulsword causes consecutiveNewlines to remain unchanged between  
	// processText calls because xulsword calls processText on sequential 
	// verses and concatenates each result. The only side effect of this 
	// is that newlines at the beginning of non-sequential calls may or 
	// may not be passed, and this is now indeterminate with xulsword.
	MyUserData *osisUserData = dynamic_cast<MyUserData *>(userData);
	if (osisUserData) {osisUserData->consecutiveNewlines = previousConsecutiveNewlines;}

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
			if (osisUserData && *from != ' ') {osisUserData->consecutiveNewlines = 0;}
		}

	}
	
	// THE MAIN PURPOSE OF THIS OVERRIDE FUNCTION: is to insure all opened HTML tags are closed
	while (!htmlTagStack->empty()) {
		text.append((SWBuf)"</" + htmlTagStack->top().c_str() + ">");
		htmlTagStack->pop();
	}
	
	if (osisUserData) {previousConsecutiveNewlines = osisUserData->consecutiveNewlines;}

	delete userData;
	return 0;
}


bool OSISXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	MyUserData *u = (MyUserData *)userData;
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

		// <p> paragraph and <lg> linegroup tags
		else if (!strcmp(tag.getName(), "p") || !strcmp(tag.getName(), "lg")) {
			if (tag.getAttribute("subType") && !tag.isEndTag()) {
				// special case of p with subType generates HTML <p class="[subType]">
				outHtmlTag(SWBuf().appendFormatted("<p class=\"%s\">", tag.getAttribute("subType")).c_str(), buf, u);
				pStack->push(tag.toString());
			}
			else {
				if ((!tag.isEndTag()) && (!tag.isEmpty())) {	// non-empty start tag
					u->outputNewline(buf);
					u->outputNewline(buf);
				}
				else if (tag.isEndTag()) {	// end tag
					if (!pStack->empty()) {
						pStack->pop();
						outHtmlTag("</p>", buf, u);
					}
					else {
						u->outputNewline(buf);
						u->outputNewline(buf);
					}
				}
				else {					// empty paragraph break marker
					u->outputNewline(buf);
					u->outputNewline(buf);
				}
			}
		}

		// Milestoned paragraphs, created by osis2mod
		// <div type="paragraph" sID.../>
		// <div type="paragraph" eID.../>
		else if (tag.isEmpty() && !strcmp(tag.getName(), "div") && tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "paragraph")) {
			// <div type="paragraph"  sID... />
			if (tag.getAttribute("sID")) {	// non-empty start tag
				u->outputNewline(buf);
				u->outputNewline(buf);
			}
			// <div type="paragraph"  eID... />
			else if (tag.getAttribute("eID")) {
				u->outputNewline(buf);
				u->outputNewline(buf);
			}
		}

		// <reference> tag
		else if (!strcmp(tag.getName(), "reference")) {
      if (!u->inXRefNote) {	// only show these if we're not in an xref note				
				if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				  SWBuf referenceClass;
				  SWBuf referenceInfo;
				  if (tag.getAttribute("type") && !strcmp("x-glossary", tag.getAttribute("type"))) {
				    referenceTag = "span";
				    referenceClass = "dt";
				    referenceInfo = (tag.getAttribute("osisRef")) ? tag.getAttribute("osisRef"):"";
				  }
				  else if (tag.getAttribute("type") && !strcmp("x-glosslink", tag.getAttribute("type"))) {
				    referenceTag = "span";
				    referenceClass = "dtl";
				    referenceInfo = (tag.getAttribute("osisRef")) ? tag.getAttribute("osisRef"):"";				  
				  }
				  else {
				    referenceTag = "span";
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
				        htmlTagStack->push(SWBuf("span")); // previous span has become re-opened
                insertpoint = insertpoint - 1 - strlen(userData->module->getName()); // .module name was appended to ref
				        buf.insert(insertpoint, "; ");
				        buf.insert(insertpoint+2, referenceInfo.c_str());
				        return true;
				      }
				    }
				  }
				  SWBuf tmpbuf;
				  tmpbuf.appendFormatted("<%s class=\"%s\" title=\"%s.%s\">", referenceTag.c_str(), referenceClass.c_str(), referenceInfo.c_str(), userData->module->getName());
				  outHtmlTag(tmpbuf, buf, u);
        }
				if (tag.isEndTag()) {
					SWBuf tmpbuf;
					tmpbuf.appendFormatted("</%s>", referenceTag.c_str());
					outHtmlTag(tmpbuf, buf, u);
				}
			}
		}

		// <l> poetry, etc
		else if (!strcmp(tag.getName(), "l")) {
			// start line marker
			if (tag.getAttribute("sID") || (!tag.isEndTag() && !tag.isEmpty())) {
				// nested lines plus if the line itself has an x-indent type attribute value
				outHtmlTag(SWBuf("<span class=\"line indent").appendFormatted("%d\">", u->lineStack->size() + (SWBuf("x-indent") == tag.getAttribute("type")?1:0)).c_str(), buf, u);
				u->lineStack->push(tag.toString());
			}
			// end line marker
			else if (tag.getAttribute("eID") || tag.isEndTag()) {
				outHtmlTag("</span>", buf, u);
				u->outputNewline(buf);
				if (u->lineStack->size()) u->lineStack->pop();
			}
			// <l/> without eID or sID
			// Note: this is improper osis. This should be <lb/>
			else if (tag.isEmpty() && !tag.getAttribute("sID")) {
				u->outputNewline(buf);
			}
		}

		// <lb.../>
		else if (!strcmp(tag.getName(), "lb") && (!tag.getAttribute("type") || strcmp(tag.getAttribute("type"), "x-optional"))) {
				u->outputNewline(buf);
		}
		// <milestone type="line"/>
		// <milestone type="x-p"/>
		// <milestone type="cQuote" marker="x"/>
		else if ((!strcmp(tag.getName(), "milestone")) && (tag.getAttribute("type"))) {
			if (!strcmp(tag.getAttribute("type"), "line")) {
				u->outputNewline(buf);
				if (tag.getAttribute("subType") && !strcmp(tag.getAttribute("subType"), "x-PM")) {
					u->outputNewline(buf);
				}
			}
			else if (!strcmp(tag.getAttribute("type"),"x-p"))  {
        u->outputNewline(buf);
        u->outputNewline(buf);
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
      		else if (!strcmp(tag.getAttribute("type"),"x-p-indent")) {outText("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;", buf, u);}
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
					++u->consecutiveNewlines;
					u->supressAdjacentWhitespace = true;
				}
			}
		}
		
		// <list>
		else if (!strcmp(tag.getName(), "list")) {
			if((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (tag.getAttribute("type")) {
					outHtmlTag("<ul class=\"", buf, u);
					outText(tag.getAttribute("type"), buf, u);
					outText("\">", buf, u);
				}
				else outHtmlTag("<ul>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</ul>", buf, u);
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
		}

		// <item>
		else if (!strcmp(tag.getName(), "item")) {
			if((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (tag.getAttribute("type")) {
					outHtmlTag("<li class=\"", buf, u);
					outText(tag.getAttribute("type"), buf, u);
					outText("\">", buf, u);
				}
				else outHtmlTag("<li>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</li>", buf, u);
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
		}
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
					outHtmlTag("<span style=\"text-decoration:overline\">", buf, u);
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
					outHtmlTag(SWBuf().appendFormatted("<span class=\"%s\">", tag.getAttribute("subType")).c_str(), buf, u);
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
				if (who == "Jesus")
					outHtmlTag(u->wordsOfChristStart, buf, u);

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
				if (who == "Jesus")
					outHtmlTag(u->wordsOfChristEnd, buf, u);
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
      
      		outHtmlTag(SWBuf().appendFormatted("<div class=\"image-container %s\">", (tag.getAttribute("subType") ? tag.getAttribute("subType"):"")).c_str(), buf, u);
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
			else {
				SWBuf mtag = "<";
				if ((!tag.isEndTag()) && (!tag.isEmpty())) {
					mtag.append(type);
					mtag.append(">");
					outHtmlTag(mtag, buf, u);
				}
				else if (tag.isEndTag()) {
					mtag.append("/");
					mtag.append(type);
					mtag.append(">");
					outHtmlTag(mtag, buf, u);
				}
			}
		}
		else if (!strcmp(tag.getName(), "span")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<span>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</span>", buf, u);
			}
		}
		else if (!strcmp(tag.getName(), "br")) {
			outHtmlTag("<br>", buf, u);
		}
		else if (!strcmp(tag.getName(), "table")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<table>", buf, u);
				outHtmlTag("<tbody>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</tbody>", buf, u);
				outHtmlTag("</table>", buf, u);
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
			
		}
		else if (!strcmp(tag.getName(), "row")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<tr>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</tr>", buf, u);
			}
			
		}
		else if (!strcmp(tag.getName(), "cell")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outHtmlTag("<td>", buf, u);
			}
			else if (tag.isEndTag()) {
				outHtmlTag("</td>", buf, u);
			}
		}
		else {
			if (!u->supressAdjacentWhitespace) u->consecutiveNewlines = 0;
			return false;  // we still didn't handle token
		}
	}
	if (!u->supressAdjacentWhitespace) u->consecutiveNewlines = 0;
	return true;
}


SWORD_NAMESPACE_END
