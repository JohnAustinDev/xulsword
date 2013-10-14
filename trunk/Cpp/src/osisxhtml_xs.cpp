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

SWORD_NAMESPACE_START

class OSISXHTMLXS : public OSISXHTML {
  private:
    int footnoteNum;
		SWBuf referenceTag;

  protected:
  	BasicFilterUserData *createUserData(const SWModule *module, const SWKey *key) {
      footnoteNum = 1;
      referenceTag = "";
  		return new MyUserData(module, key);
  	}
  	bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);
  public:
  	OSISXHTMLXS();
};

class OSISXHTML::TagStack : public std::stack<SWBuf> {};
static inline void outText(const char *t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }
static inline void outText(char t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }

OSISXHTMLXS::OSISXHTMLXS() : OSISXHTML() {}

bool OSISXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	MyUserData *u = (MyUserData *)userData;
	SWBuf scratch;
  if (!u->supressAdjacentWhitespace) u->consecutiveNewlines = 0; // seems to be a SWORD bug?
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
            buf.appendFormatted("<span class=\"sn %s\">", snumbers.c_str());
						u->w = "keep";
					}
        }
        // end <w> tag
        else if (u->w == "keep") {outText("</span>", buf, u);}
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
						if (vkey) {
							if ((tag.getAttribute("type") && ((!strcmp(tag.getAttribute("type"), "crossReference")) || (!strcmp(tag.getAttribute("type"), "x-cross-ref"))))) {
								u->inXRefNote = true;
								SWBuf mclass = "cr";
								if (tag.getAttribute("subType")) {
									mclass.append(" ");
									mclass.append(tag.getAttribute("subType"));
								}
								buf.appendFormatted("<span class=\"%s\" title=\"%s.%s.%s\"></span>",
								mclass.c_str(),
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
								userData->module->getName());
							}
							else {
                				u->inXRefNote = false;
								buf.appendFormatted("<span class=\"fn\" title=\"%s.%s.%s\"></span>",
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
								userData->module->getName());
							}
						}
						else {
							buf.appendFormatted("<sup>%i</sup>", footnoteNum++);
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
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {	// non-empty start tag
				u->outputNewline(buf);
			}
			else if (tag.isEndTag()) {	// end tag
				u->outputNewline(buf);
			}
			else {					// empty paragraph break marker
				u->outputNewline(buf);
			}
		}

		// Milestoned paragraphs, created by osis2mod
		// <div type="paragraph" sID.../>
		// <div type="paragraph" eID.../>
		else if (tag.isEmpty() && !strcmp(tag.getName(), "div") && tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "paragraph")) {
			// <div type="paragraph"  sID... />
			if (tag.getAttribute("sID")) {	// non-empty start tag
				u->outputNewline(buf);
			}
			// <div type="paragraph"  eID... />
			else if (tag.getAttribute("eID")) {
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
                insertpoint = insertpoint - 1 - strlen(userData->module->getName()); // .module name was appended to ref
				        buf.insert(insertpoint, "; ");
				        buf.insert(insertpoint+2, referenceInfo.c_str());
				        return true;
				      }
				    }
				  }
				  buf.appendFormatted("<%s class=\"%s\" title=\"%s.%s\">", referenceTag.c_str(), referenceClass.c_str(), referenceInfo.c_str(), userData->module->getName());
        }
				if (tag.isEndTag()) {buf.appendFormatted("</%s>", referenceTag.c_str());}
			}
		}

		// <l> poetry, etc
		else if (!strcmp(tag.getName(), "l")) {
			// start line marker
			if (tag.getAttribute("sID") || (!tag.isEndTag() && !tag.isEmpty())) {
				// nested lines plus if the line itself has an x-indent type attribute value
				outText(SWBuf("<span class=\"line indent").appendFormatted("%d\">", u->lineStack->size() + (SWBuf("x-indent") == tag.getAttribute("type")?1:0)).c_str(), buf, u);
				u->lineStack->push(tag.toString());
			}
			// end line marker
			else if (tag.getAttribute("eID") || tag.isEndTag()) {
				outText("</span>", buf, u);
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
		else if (!strcmp(tag.getName(), "lb")) {
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
								buf += "<h1 class=\"moduleHeader";
								tag.setAttribute("pushed", "h1");
							}
							else {
								buf += "<h1 class=\"testamentHeader";
								tag.setAttribute("pushed", "h1");
							}
						}
						else {
							buf += "<h1 class=\"bookHeader";
							tag.setAttribute("pushed", "h1");
						}
					}
					else {
						buf += "<h2 class=\"chapterHeader";
						tag.setAttribute("pushed", "h2");
					}
          buf += " ";
          buf += mclass;
          buf += "\">";
				}
				else {
					buf += "<h3";
					if (mclass.length()) {
						buf += " class=\"";
						buf += mclass;
						buf += "\"";
					}
					buf += ">";
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
						buf += (SWBuf)"</" + pushed + ">";
					}
					else {
						buf += "</h3>";
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
					outText("<ul class=\"", buf, u);
					outText(tag.getAttribute("type"), buf, u);
					outText("\">", buf, u);
				}
				else outText("<ul>", buf, u);
			}
			else if (tag.isEndTag()) {
				outText("</ul>", buf, u);
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
		}

		// <item>
		else if (!strcmp(tag.getName(), "item")) {
			if((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (tag.getAttribute("type")) {
					outText("<li class=\"", buf, u);
					outText(tag.getAttribute("type"), buf, u);
					outText("\">", buf, u);
				}
				else outText("\t<li>", buf, u);
			}
			else if (tag.isEndTag()) {
				outText("</li>", buf, u);
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
		}
		// <catchWord> & <rdg> tags (italicize)
		else if (!strcmp(tag.getName(), "rdg") || !strcmp(tag.getName(), "catchWord")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				outText("<i>", buf, u);
			}
			else if (tag.isEndTag()) {
				outText("</i>", buf, u);
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
			// handle tei rend attribute
			if (!type.length()) type = tag.getAttribute("rend");
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (type == "bold" || type == "b" || type == "x-b") {
					outText("<b>", buf, u);
				}
				else if (type == "ol") {
					outText("<span style=\"text-decoration:overline\">", buf, u);
				}
				else if (type == "super") {
					outText("<span class=\"sup\">", buf, u);
				}
				else if (type == "sub") {
					outText("<span class=\"sub\">", buf, u);
				}
				else {	// all other types
					outText("<i>", buf, u);
				}
				u->hiStack->push(tag.toString());
			}
			else if (tag.isEndTag()) {
				SWBuf type = "";
				if (!u->hiStack->empty()) {
					XMLTag tag(u->hiStack->top());
					if (u->hiStack->size()) u->hiStack->pop();
					type = tag.getAttribute("type");
					if (!type.length()) type = tag.getAttribute("rend");
				}
				if (type == "bold" || type == "b" || type == "x-b") {
					outText("</b>", buf, u);
				}
				else if (  	   type == "ol"
						|| type == "super"
						|| type == "sub") {
					outText("</span>", buf, u);
				}
				else outText("</i>", buf, u);
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
					outText(u->wordsOfChristStart, buf, u);

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
					outText(u->wordsOfChristEnd, buf, u);
			}
		}

		// <transChange>
		else if (!strcmp(tag.getName(), "transChange")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				SWBuf type = tag.getAttribute("type");
				u->lastTransChange = type;

				// just do all transChange tags this way for now
				if ((type == "added") || (type == "supplied"))
					outText("<span class=\"transChangeSupplied\">", buf, u);
				else if (type == "tenseChange")
					buf += "*";
			}
			else if (tag.isEndTag()) {
				SWBuf type = u->lastTransChange;
				if ((type == "added") || (type == "supplied"))
					outText("</span>", buf, u);
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
      
      			outText("<div class=\"dict-image-container\">", buf, u);
					outText("<img src=\"File://", buf, u);
					outText(filepath, buf, u);
					outText("\">", buf, u);
					outText("</div>", buf, u);
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
			else {
				buf += tag;
			}
		}
		else if (!strcmp(tag.getName(), "span")) {
			buf += tag;
		}
		else if (!strcmp(tag.getName(), "br")) {
			buf += tag;
		}
		else if (!strcmp(tag.getName(), "table")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				buf += "<table><tbody>";
			}
			else if (tag.isEndTag()) {
				buf += "</tbody></table>";
				++u->consecutiveNewlines;
				u->supressAdjacentWhitespace = true;
			}
			
		}
		else if (!strcmp(tag.getName(), "row")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				buf += "\t<tr>";
			}
			else if (tag.isEndTag()) {
				buf += "</tr>";
			}
			
		}
		else if (!strcmp(tag.getName(), "cell")) {
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				buf += "<td>";
			}
			else if (tag.isEndTag()) {
				buf += "</td>";
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
