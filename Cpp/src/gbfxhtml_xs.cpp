/******************************************************************************
 *
 *  gbfxhtml.cpp -  GBF to classed XHTML
 *
 * $Id: gbfxhtml.cpp 2833 2013-06-29 06:40:28Z chrislit $
 *
 * Copyright 2011-2013 CrossWire Bible Society (http://www.crosswire.org)
 *  CrossWire Bible Society
 *  P. O. Box 2528
 *  Tempe, AZ  85280-2528
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
#include <gbfxhtmlxs.h>
#include <swmodule.h>
#include <utilxml.h>
#include <versekey.h>
#include <ctype.h>
#include <url.h>

SWORD_NAMESPACE_START

const char *GBFXHTMLXS::getHeader() const {
  return "\
    .wordsOfJesus {\
      color: red;\
    }\
  ";
}

GBFXHTMLXS::MyUserData::MyUserData(const SWModule *module, const SWKey *key) : BasicFilterUserData(module, key) {
  if (module) {
    version = module->getName();
  }
}

GBFXHTMLXS::GBFXHTMLXS() {
  setTokenStart("<");
  setTokenEnd(">");

  setTokenCaseSensitive(true);

  //addTokenSubstitute("Rf", ")</small></font>");
  addTokenSubstitute("FA", "<font color=\"#800000\">"); // for ASV footnotes to mark text
  addTokenSubstitute("Rx", "</span>");
  addTokenSubstitute("FI", "<i>"); // italics begin
  addTokenSubstitute("Fi", "</i>");
  addTokenSubstitute("FB", "<b>"); // bold begin
  addTokenSubstitute("Fb", "</b>");
  addTokenSubstitute("FR", "<span class=\"wordsOfJesus\">"); // words of Jesus begin
  addTokenSubstitute("Fr", "</span>");
  addTokenSubstitute("FU", "<u>"); // underline begin
  addTokenSubstitute("Fu", "</u>");
  addTokenSubstitute("FO", "<cite>"); //  Old Testament quote begin
  addTokenSubstitute("Fo", "</cite>");
  addTokenSubstitute("FS", "<sup>"); // Superscript begin// Subscript begin
  addTokenSubstitute("Fs", "</sup>");
  addTokenSubstitute("FV", "<sub>"); // Subscript begin
  addTokenSubstitute("Fv", "</sub>");
  addTokenSubstitute("TT", "<big>"); // Book title begin
  addTokenSubstitute("Tt", "</big>");
  addTokenSubstitute("PP", "<cite>"); //  poetry  begin
  addTokenSubstitute("Pp", "</cite>");
  addTokenSubstitute("Fn", "</font>"); //  font  end
  addTokenSubstitute("CL", "<br />"); //  new line
  addTokenSubstitute("CM", "<br /><br />"); //  paragraph <!P> is a non showing comment that can be changed in the front end to <P> if desired
  addTokenSubstitute("CG", ""); //  ???
  addTokenSubstitute("CT", ""); // ???
  addTokenSubstitute("JR", ""); // right align begin (was <div align=\"right\">)
  addTokenSubstitute("JC", ""); // center align begin (was <div align=\"center\">)
  addTokenSubstitute("JL", ""); // align end (</div>)

  renderNoteNumbers = false;
}


bool GBFXHTMLXS::handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData) {
  const char *tok;
  MyUserData *u = (MyUserData *)userData;

  if (!substituteToken(buf, token)) {
    XMLTag tag(token);

  if (!strncmp(token, "WG", 2) || !strncmp(token, "WH", 2) || !strncmp(token, "WTG", 3) || !strncmp(token, "WTH", 3)) { // strong's numbers

    SWBuf styp;
    int tl = 2;
    if (!strncmp(token, "WG", 2))  {styp = "S_G";}
    if (!strncmp(token, "WH", 2))  {styp = "S_H";}
    if (!strncmp(token, "WTG", 3)) {styp = "SM_G"; tl = 3;}
    if (!strncmp(token, "WTH", 3)) {styp = "SM_H"; tl = 3;}

    VerseKey *vkey;
      // see if we have a VerseKey * or descendant
      SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) { }
      if (vkey) {
        buf.trimEnd();
        char stag[61]="<span class=\"sn %s%s\" data-title=\"%s.%s%s\" >";
        int stlen = 43; // length of stag string
        int p2 = buf.length();
        int p1 = p2;
        bool p2fixed = true;
        bool p1fixed = false;
        bool addToPrevious = false;
        int si = stlen;

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
              break;
            }
          }
          if (p1fixed && p2fixed) {
            if ((p2-p1)<1) {
              p1fixed = false;
              p2fixed = false;
              continue;
            }
            if (I == stag[si]) {
              if (I=='"') {
                addToPrevious = true;
                p1 -= (stlen-si+1);
                break;
              }
            }
            else {si = stlen;}
            if (I == '<') {
              break;
            }
            si--;
          }
        }
        if (!p1fixed) {p1 = 0;}
        if (!p2fixed) {p2 = 0;}

        if (addToPrevious) {
          char appendTitle[128];
          sprintf(appendTitle, ".%s%s", styp.c_str(), token+tl);
          buf.insert(p1, appendTitle);
          char appendClass[128];
          sprintf(appendClass, " %s%s", styp.c_str(), token+tl);
          while (buf.charAt(p1) != '"') {p1--;}
          buf.insert(p1-13, appendClass);
        }
        else {
          char opentag[128];
          sprintf(opentag, stag, styp.c_str(), token+tl, userData->module->getName(), styp.c_str(), token+tl);
          buf.insert(p1, opentag);
          p2 = p2 + strlen(opentag);
          buf.insert(p2, "</span>");
        }
      }
      else {
        buf.append("<");
        buf.append(token);
        buf.append(">");
      }
    }

    else if (!strncmp(token, "WT", 2) && strncmp(token, "WTH", 3) && strncmp(token, "WTG", 3)) { // morph tags
      // WT[^HG] is never used in RWebster or RusVZh
    }

    else if (!strcmp(tag.getName(), "RX")) {
      buf += "<span href=\"";
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
      SWBuf classExtras = "";
      if (type.size()) {
        classExtras.append(" ").append(type);
      }
      VerseKey *vkey = NULL;
      // see if we have a VerseKey * or descendant
      SWTRY {
        vkey = SWDYNAMIC_CAST(VerseKey, u->key);
      }
      SWCATCH ( ... ) { }
      if (vkey) {
        buf.appendFormatted("<span class=\"fn%s\" data-title=\"%s.%s.%s\"></span>",
              classExtras.c_str(),
              footnoteNumber.c_str(),
              vkey->getOSISRef(),
              userData->module->getName());
      }
      else {
        buf.appendFormatted("<span class=\"gfn%s\" data-title=\"%s.fn.%s\"></span>",
              classExtras.c_str(),
              footnoteNumber.c_str(),
              userData->module->getName());
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

    else if (!strncmp(token, "CA", 2)) {  // ASCII value
      buf += (char)atoi(&token[2]);
    }

    else {
      return false;
    }
  }
  return true;
}

SWORD_NAMESPACE_END
