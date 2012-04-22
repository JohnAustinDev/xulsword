/***************************************************************************
				 osisxul.cpp  -  OSIS to HTML with hrefs filter
					    -------------------
    begin                : 2003-06-24
    copyright            : 2003 by CrossWire Bible Society
    
    modified:  2009 by John Austin
 ***************************************************************************/

/***************************************************************************
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation version 2 of the License.                *
 *                                                                         *
 ***************************************************************************/

#include <stdlib.h>
#include <ctype.h>
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


typedef std::stack<SWBuf> TagStack;

// though this might be slightly slower, possibly causing an extra bool check, this is a renderFilter
// so speed isn't the absolute highest priority, and this is a very minor possible hit
static inline void outText(const char *t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }
static inline void outText(char t, SWBuf &o, BasicFilterUserData *u) { if (!u->suspendTextPassThru) o += t; else u->lastSuspendSegment += t; }

class OSISXHTML::TagStacks {
public:
	TagStack quoteStack;
	TagStack hiStack;
};

OSISXHTMLXS::OSISXHTMLXS() : OSISXHTML() {}

bool OSISXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
	MyUserData *u = (MyUserData *)userData;
	SWBuf scratch;
	bool sub = (u->suspendTextPassThru) ? substituteToken(scratch, token) : substituteToken(buf, token);
	static bool inheaddiv;
	if (!sub) {
  // manually process if it wasn't a simple substitution
		XMLTag tag(token);
		
//printf("Name:%s, isEndTag:%i, type:%s\n", tag.getName(), tag.isEndTag(), tag.getAttribute("type") ? tag.getAttribute("type"):"");
		
		// <w> tag NOTE: KJV has no POS, xlit, or gloss attributes, empty <w> tags, or GH lemma attributes
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
              snumbers += ":";
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
              if (sep) {snumbers += ".";}
              if (!strncmp(attrib, "robinson", 8)) {snumbers += "RM";}
              else {snumbers += "SM";}
              snumbers += ":";
						  snumbers += val;
						  sep = true;
            } while (++i < count);
          }
          if (tag.getAttribute("lemma") || tag.getAttribute("morph")) {
            buf.appendFormatted("<span class=\"sn\" title=\"%s\">", snumbers.c_str());
						u->w = "keep";
					}
        }
        // end <w> tag
        else if (u->w == "keep") {outText("</span>", buf, u);}
      }
    }


		// <note> tag
		//EDIT!!
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
                  mclass.append("-");
                  mclass.append(tag.getAttribute("subType"));
                }
								buf.appendFormatted("<span class=\"%s\" id=\"%s.cr.%s.%s\" title=\"%s.%s\"></span>",
								mclass.c_str(),
                userData->module->Name(),
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
								footnoteNumber.c_str(), 
								vkey->getOSISRef());
							}
							else {
                u->inXRefNote = false;
								buf.appendFormatted("<span class=\"fn\" id=\"%s.fn.%s.%s\" title=\"%s.%s\"></span>",
                userData->module->Name(),
								footnoteNumber.c_str(), 
								vkey->getOSISRef(),
								footnoteNumber.c_str(), 
								vkey->getOSISRef());
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
				outText("<!P><br />", buf, u);
			}
			else if (tag.isEndTag()) {	// end tag
				outText("<!/P><br />", buf, u);
				userData->supressAdjacentWhitespace = true;
			}
			else {					// empty paragraph break marker
				outText("<!P><br />", buf, u);
				userData->supressAdjacentWhitespace = true;
			}
		}

		// Milestoned paragraphs, created by osis2mod
		// <div type="paragraph" sID.../>
		// <div type="paragraph" eID.../>
		else if (!tag.isEmpty() && !strcmp(tag.getName(), "div") && tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "paragraph")) {
			// <div type="paragraph"  sID... />
			if (tag.getAttribute("sID")) {	// non-empty start tag
				outText("<!P><br />", buf, u);
			}
			// <div type="paragraph"  eID... />
			else if (tag.getAttribute("eID")) {
				outText("<!/P><br />", buf, u);
				userData->supressAdjacentWhitespace = true;
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
				    referenceTag = "a";
				    referenceClass = "dtl";
				    referenceInfo = (tag.getAttribute("osisRef")) ? tag.getAttribute("osisRef"):"";				  
				  }
				  else {
				    referenceTag = "a";
				    referenceClass = "sr";
				    if (tag.getAttribute("osisRef")) {
				      referenceInfo = tag.getAttribute("osisRef");
				    }
				    else if ((tag.getAttribute("passage"))) {
				      referenceInfo = tag.getAttribute("passage");
				    }
				    else {referenceInfo = "";}
				    // Do we need to append this to the last <a class="sr"... tag??
				    if (buf.endsWith("</a>")) {
				      int stag = -1;
				      int etag = -1;
				      int insertpoint = -1;
				      char match[14]="<a class=\"sr\"";
				      int mi = 12;
				      for (int i=buf.length()-5; i>=0 && stag==-1; i--) {
				        char mychar = buf.charAt(i);
				        if      (etag==-1 && mychar=='>') {etag=i;}
				        else if (etag!=-1 && insertpoint==-1 && mychar=='"') {insertpoint=i;}
				        else if (etag!=-1 && insertpoint!=-1 && mychar==match[mi]) {mi--;} 
				        else {mi = 12;}
				        if (mychar=='<') {stag=i;}
				      }
				      if (mi==-1) {
				        // Append current data to last tag
				        buf.setSize(buf.length()-4); // Strip off last <\a> tag
				        buf.insert(insertpoint, "; ");
				        buf.insert(insertpoint+2, referenceInfo.c_str());
				        return true;
				      }
				    }
				  }
				  buf.appendFormatted("<%s class=\"%s\" title=\"%s\">", referenceTag.c_str(), referenceClass.c_str(), referenceInfo.c_str());
        }
				if (tag.isEndTag()) {buf.appendFormatted("</%s>", referenceTag.c_str());}
			}
		}

		// <l> poetry, etc
		else if (!strcmp(tag.getName(), "l")) {
			// end line marker
			if (tag.getAttribute("eID")) {
				outText("<br />", buf, u);
			}
			// <l/> without eID or sID
			// Note: this is improper osis. This should be <lb/>
			else if (tag.isEmpty() && !tag.getAttribute("sID")) {
				outText("<br />", buf, u);
			}
			// end of the line
			else if (tag.isEndTag()) {
				outText("<br />", buf, u);
			}
		}

		// <lb.../>
		else if (!strcmp(tag.getName(), "lb")) {
			outText("<br />", buf, u);

			userData->supressAdjacentWhitespace = true;
		}
		// <milestone type="line"/>
		// <milestone type="x-p"/>
		// <milestone type="cQuote" marker="x"/>
		else if ((!strcmp(tag.getName(), "milestone")) && (tag.getAttribute("type"))) {
			if (!strcmp(tag.getAttribute("type"), "line")) {
				outText("<br />", buf, u);
				if (tag.getAttribute("subType") && !strcmp(tag.getAttribute("subType"), "x-PM")) {
					outText("<br />", buf, u);
				}
				userData->supressAdjacentWhitespace = true;
			}
			else if(!strcmp(tag.getAttribute("type"),"x-p"))  {
				if( tag.getAttribute("marker")) {
				  outText("<br /><br />", buf, u);
					//outText(tag.getAttribute("marker"), buf, u);
				}
				else outText("<!p>", buf, u);
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
			//EDIT!!
      else if (!strcmp(tag.getAttribute("type"),"x-p-indent")) {outText("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;", buf, u);}
		}


		// <title>
		else if (!strcmp(tag.getName(), "title")) {
		  if (!tag.isEndTag()) {
        outText("<div class=\"", buf, u);
        if (tag.getAttribute("level") && !strcmp(tag.getAttribute("level"), "2")) {outText("head2", buf, u);}
        else {outText("head1", buf, u);}
        if (tag.getAttribute("canonical") && !strcmp(tag.getAttribute("canonical"), "true")) {outText(" canonical", buf, u);}
        outText("\">", buf, u);
      }
			else if (tag.isEndTag()) {
				outText("</div>", buf, u);
			}
		}
		
		// <list>
		else if (!strcmp(tag.getName(), "list")) {
		  if (!tag.isEndTag()) {
        outText("<div", buf, u);
        if (tag.getAttribute("type")) {buf.appendFormatted(" class=\"%s\"", tag.getAttribute("type"));}
        outText(">", buf, u);
      }
		  else {outText("</div>", buf, u);}
		}

    // <item>
		else if (!strcmp(tag.getName(), "item")) {
			if (!tag.isEndTag()) {
        outText("<div", buf, u);
        if (tag.getAttribute("type")) {buf.appendFormatted(" class=\"%s\"", tag.getAttribute("type"));}
        outText(">", buf, u);
      }
		  else {outText("</div>", buf, u);}
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
					toupperstr(lastText);
					scratch.setFormatted("%c<font size=\"-1\">%s</font>", lastText[0], lastText.c_str()+1);

					const unsigned char *tmpBuf = (const unsigned char *)lastText.c_str();
					getUniCharFromUTF8(&tmpBuf);
					int char_length = (tmpBuf - (const unsigned char *)lastText.c_str());
					scratch.setFormatted("%.*s<font size=\"-1\">%s</font>", 
						char_length, 
						lastText.c_str(),
						lastText.c_str() + char_length
					);
					
					outText(scratch.c_str(), buf, u);
				}               
			} 
		}

		// <hi> text highlighting
		else if (!strcmp(tag.getName(), "hi")) {
			SWBuf type = tag.getAttribute("type");
			if ((!tag.isEndTag()) && (!tag.isEmpty())) {
				if (type == "bold" || type == "b" || type == "x-b") {
					outText("<b>", buf, u);
				}
				else {	// all other types
					outText("<i>", buf, u);
				}
				u->tagStacks->hiStack.push(tag.toString());
			}
			else if (tag.isEndTag()) {
				SWBuf type = "";
				if (!u->tagStacks->hiStack.empty()) {
					XMLTag tag(u->tagStacks->hiStack.top());
					u->tagStacks->hiStack.pop();
					type = tag.getAttribute("type");
				}
				if (type == "bold" || type == "b" || type == "x-b") {
					outText("</b>", buf, u);
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
					u->tagStacks->quoteStack.push(tag.toString());
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
				if (tag.isEndTag() && !u->tagStacks->quoteStack.empty()) {
					XMLTag qTag(u->tagStacks->quoteStack.top());
					u->tagStacks->quoteStack.pop();

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
					outText("<i>", buf, u);
				else if (type == "tenseChange")
					buf += "*";
			}
			else if (tag.isEndTag()) {
				SWBuf type = u->lastTransChange;
				if ((type == "added") || (type == "supplied"))
					outText("</i>", buf, u);
			}
			else {	// empty transChange marker?
			}
		}

		// image
		else if (!strcmp(tag.getName(), "figure")) {
			const char *src = tag.getAttribute("src");
			if (!src)		// assert we have a src attribute
				return false;

			SWBuf filepath;
			if (userData->module) {
				filepath = userData->module->getConfigEntry("AbsoluteDataPath");
				if ((filepath.size()) && (filepath[filepath.size()-1] != '/') && (src[0] != '/'))
					filepath += '/';
			}
			filepath += src;
      filepath.replaceBytes("\\", '/');
      
      outText("<div style=\"text-align:center;\">", buf, u);
			outText("<img src=\"File://", buf, u);
			outText(filepath, buf, u);
			outText("\" />", buf, u);
			outText("</div>", buf, u);
		}

		else {
		      return false;  // we still didn't handle token
		}
	}
	return true;
}

SWORD_NAMESPACE_END
