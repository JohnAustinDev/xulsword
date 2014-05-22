/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    xulSword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    xulSword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with xulSword.  If not, see <http://www.gnu.org/licenses/>.
*/

#ifdef _WIN32
  #include "windows.h"
#else
  #include "config.h"
#endif

#include <dirent.h>
#include <stdio.h>
#include <string>
#include <iostream>
#include <list>

#include "xulsword.h"
#include "strkey.h"
#include "swmodule.h"
#include "swlog.h"
#include "localemgr.h"
#include "gbfxhtml.h"
#include "thmlxhtml.h"
#include "filemgr.h"

#include "canon_synodal0.h"	// Russian Synodal sword-1.6.1 v11n system
#include "canon_east.h"
#include "canon_synodalprot.h"
#include "versemaps.h"

#include <CLucene.h>
using namespace lucene::index;
using namespace lucene::analysis;
using namespace lucene::util;
using namespace lucene::store;
using namespace lucene::document;
using namespace lucene::queryParser;
using namespace lucene::search;

#define MAXSTRING 1000
#define MAXDICTSIZE 20000 /*ISBE is 9350 entries*/
#define MODVERSION "xulswordVersion"
#define NOTFOUND "Not Found"
#define WESTERN "KJV"
#define EASTERN "EASTERN" // DEPRICATED verse system used by pre sword-1.6.1 built modules
#define SYNODAL "Synodal"  // can be used by strstr to match SynodalProt, SynodalP, Synodal0, and Synodal
#define VSERROR 99
#define MAXINSTANCE 10;

#ifdef WIN32
#define DLLEXPORT extern "C" __declspec(dllexport)
#else
#define DLLEXPORT extern "C"
#endif

#ifndef PHPSWORD
#define emalloc malloc
#else
extern "C" {
#include "php.h"
}
#endif


const char DefaultVersificationSystem[] = "KJV";
StringMgrXS *xulsword::MyStringMgrXS = NULL;
SWLogXS *xulsword::MySWLogXS = NULL;
  

void savePercentComplete(char percent, void *userData) {
  if (userData) {
    void (*funcptr)(int) = (void (*)(int))userData;
    funcptr((int)percent);
  }
}
  

/********************************************************************
Custom derivative classes
*********************************************************************/

#include "swmgr_xs.cpp"
#include "osisxhtml_xs.cpp"
#include "gbfxhtml_xs.cpp"
#include "thmlxhtml_xs.cpp"

using namespace sword;


/********************************************************************
xsThrow
*********************************************************************/
void xulsword::xsThrow(const char *msg, const char *param) {
  char *fmsg;
  fmsg = (char *)malloc(1024);

  if (param && (strlen(msg) + strlen(param)) < 1000) {
    sprintf(fmsg, msg, param);
  }
  else if (msg && strlen(msg) < 1000) {
    strcpy(fmsg, msg);
  }
  else strcpy(fmsg, "(xsThrow no message)");

  SWLog::getSystemLog()->logDebug("xsThrow: %s", fmsg);
  
  if (ThrowJS) {ThrowJS(fmsg);}
  else free(fmsg);
}


/********************************************************************
keyToVars
*********************************************************************/
// Assign a set of verse locations from a key
void xulsword::keyToVars(VerseKey *key, SWBuf *chapter, int *verse, int *lastverse) {
  chapter->setFormatted("%s %i", key->getBookAbbrev(), key->getChapter());
  *verse = key->getVerse();
  if (key->isBoundSet()) {*lastverse = key->getUpperBound().getVerse();}
  else {*lastverse = key->getVerse();}
}


/********************************************************************
getVerseSystemOfModule
*********************************************************************/
// Returns DefaultVersificationSystem if verse system cannot be determined.
const char *xulsword::getVerseSystemOfModule(const char * mod) {
  if (!mod || !strcmp(mod, "KJV")) return DefaultVersificationSystem;
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return DefaultVersificationSystem;}
  VerseKey *vkey;
  vkey = SWDYNAMIC_CAST(VerseKey, module->getKey());

  // Some dictionaries also have Versification specified (for verse references)
  if (!vkey) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&module->getConfig());
    ConfigEntMap::iterator it = infoConfig->find("Versification");
    if (it != infoConfig->end()) {return it->second.c_str();}
    else {return DefaultVersificationSystem;}
  }

  return vkey->getVersificationSystem();
}


/********************************************************************
locationToVerseKey
*********************************************************************/
/*  Reads a xulsword reference and sets the versekey text and upper bounds
    xulsword references never cross chapter boundaries and can have these forms:
      shortBook chapterNumber (in this case Verse=1 and LastVerse=maxverse)
      shortBook.chapterNumber (in this case Verse=1 and LastVerse=maxverse)
      shortBook chapterNumber:verseNumber
      shortBook chapterNumber:verseNumber - lastVerseNumber
      shortBook chapterNumber:verseNumber - shortBook chapterNumber:lastVerseNumber
      shortBook.chapterNumber.verseNumber.lastVerseNumber
      shortBook.chapterNumber.verseNumber
*/
int xulsword::locationToVerseKey(const char *locationText, VerseKey *vk) {
  int firstverse=0;
  int lastverse=0;
  vk->clearBounds(); // important to prevent errors after setText
  VerseKey ub;
  std::string keytext = locationText;
  int dash = keytext.find('-',0);
  if (dash != -1) {
    std::string upperbound;
    upperbound.assign(keytext, dash+1, keytext.length()-dash-1);
    keytext.assign(keytext, 0, dash);
    lastverse = atoi(upperbound.c_str());
    // test for anything other than just a last verse number
    if (lastverse < 1 || upperbound.length() > 3) {
      ub.setVersificationSystem(vk->getVersificationSystem());
      locationToVerseKey(upperbound.c_str(), &ub);
      lastverse = ub.getVerse();
    }
  }
  else {
    // If there is no dash, look for a "." delineated lastverse location (The "last verse"
    // position is unique to xulsword and so if it exists, it needs to be parsed here before handing to verse key.)
    lastverse = 0;
    int p=0;
    for (int i=0; i<3; i++) {
      p = keytext.find('.',p);
      if (p == -1) {break;}
      p++;
    }
    // less than three "."s
    if (p == -1) {
      // check if no verse, and if not, then first verse is 1 and lastverse is maxverse
      p = keytext.find_first_not_of(" ", 0); // allow for leading spaces
      for (int i=0; i<2; i++) {
        p = keytext.find_first_of(" :.", p);
        if (p == -1) {break;}
        p++;
      }
      // if less than two delimiters were found, or no number following second delimiter = no verse
      if (p == -1 || atoi(keytext.substr(p).c_str()) == 0) {
        firstverse = 1;
        lastverse = 200; //ends up as maxverse
      }
    }
    // three "."s
    else {
      lastverse = atoi(keytext.substr(p).c_str());
      keytext.assign(keytext, 0, p-1);
    }
  }

  vk->setText(keytext.c_str());
  if (vk->getChapter() < 1) {vk->setChapter(1);}
  if (vk->getVerse() < 1) {vk->setVerse(1);}
//printf("set=%s, actual=%s\n", keytext.c_str(), vk->getText());
  ub.copyFrom(vk);
  if (lastverse < ub.getVerse()) {lastverse = ub.getVerse();}
  else if (lastverse > ub.getVerseMax()) {lastverse = ub.getVerseMax();}
  ub.setVerse(lastverse);
  vk->setUpperBound(ub);
  return (vk->popError());
}


/********************************************************************
textToMaxChapter
*********************************************************************/
// Takes vkeytext and versification, and returns max chapter, plus inits vkey to vkeytext (with vmax).
int xulsword::textToMaxChapter(const char *vkeytext, VerseKey *vkey) {
  locationToVerseKey(vkeytext, vkey);
  return vkey->getChapterMax();
}


/********************************************************************
textToMaxVerse
*********************************************************************/
// Takes vkeytext and versification, and returns max verse of chapter, plus inits vkey to vkeytext (with vmax).
int xulsword::textToMaxVerse(const char *vkeytext, VerseKey *vkey) {
  locationToVerseKey(vkeytext, vkey);
  return vkey->getVerseMax();
}


/********************************************************************
getFolderContents
*********************************************************************/
#define ROOTRDF "http://www.xulsword.com/tableofcontents/ContentsRoot"
void xulsword::getFolderContents(TreeKey *key, const char *modname, SWBuf *retval) {
  retval->setFormatted("\t<RDF:Seq RDF:about=\"rdf:#/%s%s\">\n", modname, key->getText());

  SWBuf subfolders;
  SWBuf descriptions;

  bool ok;
  bool isChild=false;
  for (ok = key->firstChild(); ok; ok = key->nextSibling()) {
    isChild=true;
    retval->appendFormatted("\t\t<RDF:li RDF:resource=\"rdf:#/%s%s\" />\n", modname, key->getText());

    descriptions.appendFormatted("\
    \t<RDF:Description RDF:about=\"rdf:#/%s%s\" \
    \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s%s\" \
    \n\t\t\tTABLEOFCONTENTS:Type=\"%s\" \
    \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" \
    \n\t\t\tTABLEOFCONTENTS:Module=\"%s\" />\n",
          modname,
          key->getText(),
          modname,
          key->getText(),
          (key->hasChildren() ? "folder":"key"),
          key->getLocalName(),
          modname);

    if (key->hasChildren()) {
      SWBuf save = key->getLocalName();
      SWBuf subf;
      getFolderContents(key, modname, &subf);
      subfolders.append(subf);
      key->setLocalName(save);
    }
  }
  if (isChild) {key->parent();}

  retval->append("\t</RDF:Seq>\n\n");
  retval->append(descriptions.c_str());
  retval->append(subfolders.c_str());
}


/********************************************************************
updateGlobalOptions
*********************************************************************/
void xulsword::updateGlobalOptions(bool disableFootCrossRed) {
  MyManager->setGlobalOption("Headings",Headings ? "On":"Off");
  MyManager->setGlobalOption("Footnotes",Footnotes && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Cross-references",Crossrefs && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Reference Material Links",Dictionary ? "On":"Off");
  MyManager->setGlobalOption("Dictionary",Dictionary ? "On":"Off"); // for backward compatibility
  MyManager->setGlobalOption("Words of Christ in Red",Redwords && !disableFootCrossRed ? "On":"Off");
  MyManager->setGlobalOption("Hebrew Vowel Points",HebrewPoints ? "On":"Off");
  MyManager->setGlobalOption("Hebrew Cantillation",Cantillation ? "On":"Off");
  MyManager->setGlobalOption("Strong's Numbers",Strongs ? "On":"Off");
  MyManager->setGlobalOption("Morphological Tags",Morph ? "On":"Off");
  MyManager->setGlobalOption("Morpheme Segmentation",MorphSeg ? "On":"Off");
}


/********************************************************************
mapVersifications
*********************************************************************/
// Reads an input key and sets the output key to the same verse in opposing verse system.
// Conversion is always between WESTERN (KJV) and EASTERN (Synodal, Synodal0, SynodalP, SynodalProt etc).
// If upper bound is set on input key, then converted upper bound will be set on output key
void xulsword::mapVersifications(VerseKey *vkin, VerseKey *vkout) {
  const char *inVerseSystem = vkin->getVersificationSystem();
  const char *outVerseSystem = vkout->getVersificationSystem();

  // only change output key's verse system when it's necessary
  if (!strcmp(inVerseSystem,EASTERN) || strstr(inVerseSystem,SYNODAL)) vkout->setVersificationSystem(WESTERN);
  else if (!strcmp(inVerseSystem,WESTERN) && (strcmp(outVerseSystem,EASTERN) && !strstr(outVerseSystem,SYNODAL)))
    vkout->setVersificationSystem(EASTERN);

  vkout->clearBounds(); // important to prevent errors which changing key!

  // Prepare to map UpperBound
  SWBuf keyTextU;
  VerseKey bkey;
  if (vkin->isBoundSet()) {
    keyTextU.appendFormatted("%s %i:%i", vkin->getUpperBound().getBookAbbrev(), vkin->getUpperBound().getChapter(), vkin->getUpperBound().getVerse());
    bkey.setVersificationSystem(!strcmp(inVerseSystem, WESTERN) ? EASTERN:WESTERN);
    bkey.setText(keyTextU.c_str());
  }

  // Prepare to map key
  SWBuf keyText;
  keyText.appendFormatted("%s %i:%i", vkin->getBookAbbrev(), vkin->getChapter(), vkin->getVerse());
  vkout->setText(keyText.c_str());

  // Map key and bounds
  // Note: this loop needs to complete (no "break"ing) to insure conversion is done properly!
  for (int i=0; i < MAPLEN; i++) {
    const char * mf;
    const char * mt;
    if ((!strcmp(inVerseSystem, WESTERN))) {mf = West2EastMap[i].west; mt = West2EastMap[i].east;}
    else                                   {mf = West2EastMap[i].east; mt = West2EastMap[i].west;}
    if (vkin->isBoundSet() && !strcmp(keyTextU.c_str(), mf)) {bkey.setText(mt);}
    if (!strcmp(keyText.c_str(), mf)) {vkout->setText(mt);}
  }
  if (vkin->isBoundSet()) {vkout->setUpperBound(bkey);}
}


/********************************************************************
getBookName
*********************************************************************/
char *xulsword::getBookName(SWBuf *Chapter) {
  std::string chapter;
  std::string book;

  chapter.assign(Chapter->c_str());

  int space = chapter.find(' ',0);
  book.assign(chapter.substr(0,space));

  char *retval;
  retval = (char *)malloc(book.length() + 1);
  if (retval) {strcpy(retval, book.c_str());}

  return retval;
}


/********************************************************************
saveFootnotes
*********************************************************************/
void xulsword::saveFootnotes(SWModule *module, SWBuf *footnoteText, SWBuf *crossRefText, SWBuf *noteText, bool includeMarkerLinks) {
  SWKey *modkey = module->getKey();
  VerseKey *versekey = SWDYNAMIC_CAST(VerseKey, modkey);
  
  int fnV = 1;
  AttributeList::iterator AtIndex;
  for (AtIndex = module->getEntryAttributes()["Footnote"].begin(); AtIndex != module->getEntryAttributes()["Footnote"].end(); AtIndex++) {
		if (!strcmp(AtIndex->first.c_str(), "count")) {continue;} // thmlfootnotes.cpp adds "count"
		
		SWBuf mclass = "fn";
		if ((AtIndex->second["type"] == "crossReference")||(AtIndex->second["type"] == "x-cross-ref")) {
			mclass = "cr";
		}

		SWBuf div;
		div.appendFormatted("<div class=\"nlist\" title=\"%s.%d.%s.%s\">",
			mclass.c_str(),
			fnV,
			(versekey ? versekey->getOSISRef():"unavailable"), 
			module->getName());

		SWBuf link;
		if (includeMarkerLinks) {
			link.appendFormatted("<span class=\"gfn\" title=\"%s.%s.%s\">%s</span>", 
				AtIndex->first.c_str(),
				mclass.c_str(),
				module->getName(),
				AtIndex->first.c_str());
		}

		if (!strcmp(mclass.c_str(), "cr")) {
			SWBuf crNote;
			crNote.append(div);
			if (includeMarkerLinks) {crNote.append(link);}
			crNote.append(AtIndex->second["refList"]);
			crNote.append("</div>");
			
			if (crossRefText) {crossRefText->append(crNote);}
			if (noteText) {noteText->append(crNote);}
		}
		else {
			SWBuf fnNote;
			fnNote.append(div);
			fnNote.appendFormatted("<span class=\"cs-%s%s\">", module->getName(), (module->getDirection() != DIRECTION_LTR ? " RTL":""));
			if (includeMarkerLinks) {fnNote.append(link);}
			fnNote.append(module->renderText(AtIndex->second["body"]));
			fnNote.append("</span></div>");
			
			if (footnoteText) {footnoteText->append(fnNote);}
			if (noteText) {noteText->append(fnNote);}
		}
      
		fnV++;
  }
}


/********************************************************************
PUBLIC XULSWORD FUNCTIONS
*********************************************************************/

xulsword::xulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int), const char *localedir) {
#ifdef WIN32
	_CrtSetReportMode(_CRT_ASSERT, _CRTDBG_MODE_DEBUG); // turn off MSVC debug mode's horrid assertion prompts
	CreateMutexA(NULL, FALSE, "xulswordmutex"); // so Window's installer will bail we're already running
#endif

  if (!MySWLogXS) {
    MySWLogXS = new SWLogXS();
    SWLog::setSystemLog(MySWLogXS);
  }
  SWLog::getSystemLog()->setLogLevel(5); // set SWORD log reporting... 5 is all stuff
  SWLog::getSystemLog()->logDebug("XULSWORD CONSTRUCTOR");
  
  ToUpperCase = toUpperCase;
  ThrowJS = throwJS;
  ReportProgress = reportProgress;

  MarkupFilterMgrXS *muf = new MarkupFilterMgrXS();
      
  std::string aPath = path;
  int comma = aPath.find(", ", 0);
  if (comma == -1) {comma = aPath.length();}
  SWBuf path1;
  path1.set(aPath.substr(0, comma).c_str());
  MyManager = new SWMgrXS(path1.c_str(), false, (MarkupFilterMgr *)muf, false, true);   
  VersificationMgr *vsm = VersificationMgr::getSystemVersificationMgr();
  vsm->registerVersificationSystem("Synodal0", otbooks_synodal0, ntbooks_synodal0, vm_synodal0);
  vsm->registerVersificationSystem("EASTERN", otbooks_eastern, ntbooks_eastern, vm_eastern);
  vsm->registerVersificationSystem("SynodalProt", otbooks_synodalprot, ntbooks_synodalprot, vm_synodalprot);
  
  MyManager->Load();
  
  MyManager->augmentModules(path1.c_str(), false); // override any "home" modules
  while (comma != aPath.length()) {
    int beg = comma+2; // 2 is length of ", "
    comma = aPath.find(", ", beg);
    if (comma == -1) {comma = aPath.length();}
    MyManager->augmentModules(aPath.substr(beg, comma-beg).c_str(), false);
  }

  if (ToUpperCase) {
    if (!MyStringMgrXS) {
      MyStringMgrXS = new StringMgrXS(ToUpperCase);
      StringMgr::setSystemStringMgr(MyStringMgrXS); // this also resets localeMgr
    }
  }
  
  if (localedir && strlen(localedir) > 0) {
    LocaleMgr::getSystemLocaleMgr()->loadConfigDir(localedir);
  }
}


xulsword::~xulsword() {
  SWLog::getSystemLog()->logDebug("XULSWORD DESTRUCTOR");
  //delete(SWLogXS); deleted by _staticSystemLog
  //delete(StringMgrXS); deleted by _staticsystemStringMgr

  //deleting MyManager causes mozalloc to abort for some reason,
  //so xulsword objects are never deleted
  delete(MyManager); // will delete MarkupFilterMgrXS
}


/********************************************************************
GetChapterText
*********************************************************************/
char *xulsword::getChapterText(const char *vkeymod, const char *vkeytext) {
  SWBuf verseText;
  SWBuf footnoteText;
  SWBuf crossRefText;
  SWBuf noteText;
  SWBuf Chapter;
  int Verse;
  int LastVerse;
  
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetChapterText: module \"%s\" not found.", vkeymod);
    return NULL;
  }

  SWKey *testkey = module->createKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    xsThrow("GetChapterText: module \"%s\" was not Bible or Commentary.", vkeymod);
  }

  myVerseKey->setPersist(true);
  myVerseKey->setAutoNormalize(0); // Non-existant calls should return empty string
  module->setKey(myVerseKey);

  locationToVerseKey(vkeytext, myVerseKey);
  keyToVars(myVerseKey, &Chapter, &Verse, &LastVerse);

  updateGlobalOptions(false);
  module->setSkipConsecutiveLinks(true);

  //Initialize Key to chapter
  myVerseKey->setText(Chapter.c_str());

  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->setUpperBound(ub);

  //Is this a Commentary??
  bool isCommentary = !strcmp(module->getType(), "Commentaries");
  
  bool isRTL = (module->getDirection() != DIRECTION_LTR);

  //NOW READ ALL VERSES IN THE CHAPTER

  char *bkp = getBookName(&Chapter);
  SWBuf bk;
  bk.set(bkp);
  delete(bkp);

  int ch = myVerseKey->getChapter();

  bool haveText = false;
  std::string chapHTML; // std::string needed for rfind

  bool done = false;
  while (!done) {
    SWBuf verseHTML;
    int vNum = myVerseKey->getVerse();
    if (vNum>1 && vNum == Verse) {MyManager->setGlobalOption("Words of Christ in Red","Off");}
    else if (vNum == (LastVerse + 1)) {MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");}
    verseText = module->renderText();
    saveFootnotes(module, &footnoteText, &crossRefText, &noteText);

    haveText = haveText || *verseText.c_str();

    //FIRST PRINT OUT ANY HEADINGS IN THE VERSE
    AttributeValue::iterator Value;
    for (Value = module->getEntryAttributes()["Heading"]["Preverse"].begin(); Value != module->getEntryAttributes()["Heading"]["Preverse"].end(); Value++) {
      // if a line break is not found at or near the end of the previous verse,
      // add a line break to help insure titles have space above them.
      if (!verseHTML.length() && chapHTML.length() > 64) {
        int lbr = chapHTML.rfind("<br />");
        if (lbr != -1 && chapHTML.length()-1-lbr > 64) verseHTML.append("<br />");
      }
      verseHTML.append(module->renderText(Value->second));
    }
    
    // VERSE PER LINE BUTTON
    if (!isCommentary && vNum == 1) {verseHTML.append("<span class=\"versePerLineButton\"><div></div></span>");}

    //NOW PRINT OUT THE VERSE ITSELF
    //If this is selected verse then designate as so
    //Output verse html code
    verseHTML.appendFormatted("<span title=\"%s.%d.%d.%s\" class=\"vs cs-%s%s\">", bk.c_str(), ch, vNum, module->getName(), module->getName(), (isRTL ? " RTL":""));

    if (Verse > 1) {
      if (vNum == Verse) {verseHTML.append("<span class=\"hl\" id=\"sv\">");}
      if ((vNum > Verse)&&(vNum <= LastVerse)) {verseHTML.append("<span class=\"hl\">");}
    }
    
    //Find the appropriate place to insert the verse number (after white-space, empty divs, div start tags, and non-canonical headings)
    char *vs = (char *)verseText.c_str();
    char *vp = vs;
    bool inTitle = false;
    while (vp && *vp) {
			if (*vp == ' ' || *vp == '\n') {vp++;}
			if (*vp == '<') {
				char *ts = vp;
				vp = strchr(vp, '>'); 
				if (vp) {
					vp++;
					if (!strncmp(ts, "<h", 2)) {
						const char *canon = strstr(ts, "canonical");
						if (!canon || canon >= vp) {inTitle = true;}
					}
					else if (!strncmp(ts, "</h", 3)) {inTitle = false;}
					else if (strncmp(ts, "<div", 4) && strncmp(ts, "</div", 5)) {
						vp = ts;
						break;
					}
				}
			}
			else if (inTitle) {vp++;}
			else if (!strncmp(vp, "&nbsp;", 6)) {vp += 6;}
			else {break;}
		}
    
    module->increment(1); // increment now so we can find last-verse
    done = module->popError();
    
		SWBuf verseNumHTML = "<sup class=\"versenum\">";
    //If verse is non-empty and verse numbers are being displayed then print the verse number
    if (Versenumbers && (verseText.length() > 0)) {
      int vnx;
      if (!done) {
        vnx = myVerseKey->getVerse();
        vnx--;
      }
      else {vnx = myVerseKey->getVerseMax();}
      if (vNum == vnx) {verseNumHTML.appendFormatted("%d", vNum);}
      else {verseNumHTML.appendFormatted("%d-%d", vNum, vnx);}
    }
    verseNumHTML.append("</sup> ");
    verseText.insert((vp && *vp ? (vp-vs):0), verseNumHTML);
    
    verseHTML.append(verseText.c_str());

    if (isCommentary) {verseHTML.append("<br><br>");}

    if (Verse > 1) {
      if(vNum==Verse) {verseHTML.append("</span>");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {verseHTML.append("</span>");}
    }
    
    verseHTML.append("</span>");
    chapHTML.append(verseHTML.c_str());
    
  }
  module->setKey(EmptyKey);

  if (!haveText) {chapHTML.assign("");}
  MyFootnotes = footnoteText;
  MyCrossRefs = crossRefText;
  MyNotes = noteText;
  
  delete(testkey);
  
  SWBuf check = assureValidUTF8(chapHTML.c_str());
	check.replaceBytes("\n\r", ' ');
  
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
  return retval;
}


/********************************************************************
GetChapterTextMulti
*********************************************************************/
char *xulsword::getChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes)
{
  SWBuf footnoteText;
  SWBuf crossRefText;
  SWBuf noteText;
  SWBuf Chapter;
  int Verse;
  int LastVerse;

  std::string modstr;
  modstr.assign(vkeymodlist);
  int comma = modstr.find(',',0);
  std::string thismod;
  thismod.assign(modstr.substr(0,comma));
  if (comma == -1) {
    xsThrow("GetChapterTextMulti: module list \"%s\" does not have form 'mod1,mod2,...'.", vkeymodlist);
    return NULL;
  }

  SWModule *module = MyManager->getModule(thismod.c_str());
  if (!module) {
    xsThrow("GetChapterTextMulti: module \"%s\" not found.", thismod.c_str());
    return NULL;
  }

  SWKey *testkey1 =  module->createKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey1);
  if (!myVerseKey) {
    delete(testkey1);
    xsThrow("GetChapterTextMulti: module \"%s\" is not Bible or Commentary'.", thismod.c_str());
    return NULL;
  }

  myVerseKey->setPersist(true);
  myVerseKey->setAutoNormalize(0); // Non-existant calls should return empty string
  module->setKey(myVerseKey);
    
  locationToVerseKey(vkeytext, myVerseKey);
  keyToVars(myVerseKey, &Chapter, &Verse, &LastVerse);

  updateGlobalOptions(!keepnotes);
  if (!keepnotes) {
    MyManager->setGlobalOption("Words of Christ in Red","Off"); // Words of Christ in Red is off for multidisplay
  }

  //Initialize Key to chapter  
  myVerseKey->setText(Chapter.c_str());

  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->setUpperBound(ub);

/*
  <div class="interB>

    [<span class="hl">]
    <div class="interV1 cs-KJV">
      <sup class="versnum">1</sup>
      <span title="Gen.5.1.KJV" class="vs">Some verse text from module 1.</span>
    </div>

    <div class="interS"></div>

    <div class="interV2 cs-KYROH RTL">
      <sup class="versnum">2</sup>
      <span title="Gen.5.2.KYROH" class="vs">Some verse text from module 2.</span>
    </div>
    [</span>]

  </div>
*/

  //NOW READ ALL VERSES IN THE CHAPTER
  char *bkp = getBookName(&Chapter);
  SWBuf bk;
  bk.set(bkp);
  delete(bkp);

  SWBuf chapText;
  SWModule *versemod;
  bool haveText = false;
  while (!myVerseKey->popError()) {
    int vNum = myVerseKey->getVerse();
    if (keepnotes && vNum>1 && vNum == Verse) {MyManager->setGlobalOption("Words of Christ in Red","Off");}
    else if (keepnotes && vNum == (LastVerse + 1)) {MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");}

    // Each verse group has its own div with a class
    chapText.append("<div class=\"interB\">");

    //If this is the selected verse group then designate as so
    if (Verse > 1) {
      if (vNum == Verse) {chapText.append("<span class=\"hl\" id=\"sv\">");}
      if ((vNum > Verse)&&(vNum <= LastVerse)) {chapText.append("<span class=\"hl\">");}
    }
    
    int versionNum = 1;
    modstr.assign(vkeymodlist);
    do {
      comma = modstr.find(',',0);
      thismod.assign(modstr.substr(0,comma));
      if (comma != -1) {modstr.assign(modstr.substr(comma+1));}

      versemod = MyManager->getModule(thismod.c_str());
      if (!versemod) {break;}

      // each version is separated by a separator that has a class
      if (versionNum > 1) {chapText.append("<div class=\"interS\"></div>");}

      // each version has its own unique class ID
      chapText.appendFormatted("<div class=\"interV%d cs-%s%s\"><sup class=\"versenum\">", 
        versionNum, 
        versemod->getName(), 
        (versemod->getDirection() != DIRECTION_LTR ? " RTL":""));
        
      if (Versenumbers) {chapText.appendFormatted("%d",vNum);}
      chapText.appendFormatted("</sup><span title=\"%s.%d.%d.%s\" class=\"vs\">", bk.c_str(), myVerseKey->getChapter(), vNum, versemod->getName());
      versionNum++;
      
      SWKey *testkey2 = versemod->createKey();
      VerseKey *mainkey = SWDYNAMIC_CAST(VerseKey, testkey2);
      if (!mainkey) {
        delete(testkey2);
        break;
      }
      const char * toVS = mainkey->getVersificationSystem();
      delete(testkey2);

      VerseKey readKey;
      readKey.copyFrom(myVerseKey);
      readKey.setAutoNormalize(0); // Non-existant calls should return empty string!
      const char * frVS = readKey.getVersificationSystem();
      if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
          (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || strstr(frVS,SYNODAL)))) {
        VerseKey convertKey;
        convertKey.copyFrom(readKey);
        readKey.setVersificationSystem(toVS);
        mapVersifications(&convertKey, &readKey);
      }
      versemod->setKey(readKey);

      SWBuf tmp;
      if (!versemod->popError()) {
        tmp.set(versemod->renderText());
        saveFootnotes(versemod, &footnoteText, &crossRefText, &noteText);
      }
      chapText.append(tmp);
      haveText = haveText || tmp.c_str();

      chapText.append("</span></div>");
    
    } while (comma != -1);

    if (Verse > 1) {
      if (vNum==Verse) {chapText.append("</span>");}
      else if ((vNum > Verse)&&(vNum <= LastVerse)) {chapText.append("</span>");}
    }
    chapText.append("</div>");

    myVerseKey->increment(1);
  }

  if (!haveText) {chapText.set("");}
  MyFootnotes = footnoteText;
  MyCrossRefs = crossRefText;
  MyNotes = noteText;

  if (!keepnotes) {
    // Return Words of Christ in Red feature to original value
    MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");
  }

  delete(testkey1);
  
  SWBuf check = assureValidUTF8(chapText.c_str());
  
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetFootnotes
*********************************************************************/
char *xulsword::getFootnotes() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED
  SWBuf check = assureValidUTF8(MyFootnotes.c_str());
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetCrossRefs
*********************************************************************/
char *xulsword::getCrossRefs() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED
  SWBuf check = assureValidUTF8(MyCrossRefs.c_str());
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetNotes
*********************************************************************/
char *xulsword::getNotes() {
  //NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED
  SWBuf check = assureValidUTF8(MyNotes.c_str());
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetVerseText
*********************************************************************/
char *xulsword::getVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes) {
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetVerseText: module \"%s\" not found.", vkeymod);
    return NULL;
  }

  SWKey *testkey = module->createKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    xsThrow("GetVerseText: module \"%s\" is not a Bible or Commentary.", vkeymod);
    return NULL;
  }
  myVerseKey->setPersist(true);
  module->setKey(myVerseKey);

  if (keepnotes) {
    MyManager->setGlobalOption("Headings","Off");
    MyManager->setGlobalOption("Footnotes","On");
    MyManager->setGlobalOption("Cross-references","On"); 
    // Other global options remain as set by user  
  }
  else {
    MyManager->setGlobalOption("Headings","Off");
    MyManager->setGlobalOption("Footnotes","Off");
    MyManager->setGlobalOption("Cross-references","Off");
    MyManager->setGlobalOption("Reference Material Links","Off");
    MyManager->setGlobalOption("Dictionary","Off"); // for backward compatibility
    MyManager->setGlobalOption("Words of Christ in Red","Off");
    MyManager->setGlobalOption("Strong's Numbers","Off");
    MyManager->setGlobalOption("Morphological Tags","Off");
    MyManager->setGlobalOption("Morpheme Segmentation","Off");
  }

  SWBuf bText;

  locationToVerseKey(vkeytext, myVerseKey);
  int numverses = 176; // set to max verses of any chapter
  while (!myVerseKey->popError())
  {
    SWBuf vtext = (keepnotes ? module->renderText():module->renderText(0, -1, false));
    const char * vt = vtext.c_str();
    bool printChars = false;
    // trim() locks up if string is only white space! (sword 1.5.9)
    for (const char * vt = vtext.c_str(); *vt; vt++) {
      if (strchr("\t\r\n ", *vt)==NULL) {printChars=true; break;}
    }
    if (printChars) {
      vtext.trim();
      bText.append(vtext.c_str());
      bText.append(" ");
    }
    myVerseKey->increment(1);
    if (--numverses == 0) {break;}
  }
  module->setKey(EmptyKey);

  delete(testkey);
  
  if (bText.length() > 16) {
    SWBuf css;
    css.setFormatted("<span class=\"cs-%s%s\">", module->getName(), (module->getDirection() != DIRECTION_LTR ? " RTL":""));
    bText.insert(0, css);
    bText.append("</span>");
  }
  
  SWBuf check = assureValidUTF8(bText.c_str());
  
  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetMaxChapter
*********************************************************************/
int xulsword::getMaxChapter(const char *mod, const char *vkeytext) {
  VerseKey vkey;
  vkey.setVersificationSystem(getVerseSystemOfModule(mod));
  return textToMaxChapter(vkeytext, &vkey);
}


/********************************************************************
GetMaxVerse
*********************************************************************/
int xulsword::getMaxVerse(const char *mod, const char *vkeytext) {
  VerseKey vkey;
  vkey.setVersificationSystem(getVerseSystemOfModule(mod));
  return textToMaxVerse(vkeytext, &vkey);
}


/********************************************************************
GetVerseSystem
*********************************************************************/
char *xulsword::getVerseSystem(const char *mod) {
  SWBuf vsystem;
  vsystem.set(getVerseSystemOfModule(mod));
  char *retval;
  retval = (char *)emalloc(vsystem.length() + 1);
  if (retval) {strcpy(retval, vsystem.c_str());}
	return retval;
}


/********************************************************************
ConvertLocation
*********************************************************************/
char *xulsword::convertLocation(const char *frVS, const char *vkeytext, const char *toVS) {
  VerseKey fromKey;
  fromKey.setVersificationSystem(frVS);
  locationToVerseKey(vkeytext, &fromKey);
//printf("FROM- KT:%s, LB:%s, UB:%s\n", fromKey.getShortText(), fromKey.getLowerBound().getShortText(), fromKey.UpperBound().getShortText());

  SWBuf result;
  if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
      (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || strstr(frVS,SYNODAL)))) {
    VerseKey toKey;
    toKey.setVersificationSystem(EASTERN); // init value only, may be changed by mapVersifications
    mapVersifications(&fromKey, &toKey);
//printf("TO  - KT:%s, LB:%s, UB:%s\n", toKey.getShortText(), toKey.getLowerBound().getShortText(), toKey.getUpperBound().getShortText());
    result.appendFormatted("%s.%i", toKey.getOSISRef(), toKey.getUpperBound().getVerse());
  }
  else {
    result.appendFormatted("%s.%i", fromKey.getOSISRef(), fromKey.getUpperBound().getVerse());
  }

  char *retval;
  retval = (char *)emalloc(result.length() + 1);
  if (retval) {strcpy(retval, result.c_str());}
	return retval;
}


/********************************************************************
GetIntroductions
*********************************************************************/
char *xulsword::getIntroductions(const char *vkeymod, const char *vkeytext) {
  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {
    xsThrow("GetIntroductions: module \"%s\" not found.", vkeymod);
    return NULL;
  }

  SWKey *testkey = module->createKey();
  VerseKey *introkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!introkey) {
    delete(testkey);
    xsThrow("GetIntroductions: module \"%s\" is not a Bible or Commentary.", vkeymod);
    return NULL;
  }

  updateGlobalOptions(false);
  
  VerseKey wkey = introkey;
  wkey.setText(vkeytext);
  
  bool isFirstChapter = (strpbrk(vkeytext, " .") == NULL || wkey.getChapter() == 1);
  
  VerseKey topkey = introkey;
  topkey.setBook(1);
  topkey.setTestament(1);
  topkey.setChapter(1);
  topkey.setVerse(1);
  bool isFirstInModule = (isFirstChapter && !strcmp(wkey.getBookName(), topkey.getBookName()));
  
  topkey.setTestament(wkey.getTestament());
  bool isFirstInTestament = (isFirstChapter && !strcmp(wkey.getBookName(), topkey.getBookName()));
  
  introkey->setIntros(true);
  introkey->setAutoNormalize(false); // IMPORTANT!! Otherwise, introductions are skipped!
  introkey->setText(vkeytext);
  introkey->setVerse(0);
  introkey->setPersist(true);
  module->setKey(introkey);
  
  SWBuf intro;
  SWBuf test;
  
  // if vkeytext is first in module: get module, 1st testament, 1st book, and that book's 1st chapter intros
  if (isFirstInModule) {
		introkey->setTestament(0);
		introkey->setBook(0);
		introkey->setChapter(0);
		test = module->renderText();
		if (test.length() > 8) {
			intro.append(test);
			intro.append("<br /><br />");
		}
		introkey->setTestament(topkey.getTestament());
		isFirstInTestament = true;
	}
  // if vkeytext is first in testament: get Testament, book, and that book's 1st chapter intros
  if (isFirstInTestament) {
		introkey->setBook(0);
		introkey->setChapter(0);
		test = module->renderText();
		if (test.length() > 8) {
			intro.append(test);
			intro.append("<br /><br />");
		}
		introkey->setBook(topkey.getBook());
		isFirstChapter = true;
	}
  // if vkeytext's chapter is unspecified: get book and that book's 1st chapter intros
  if (isFirstChapter) {
		introkey->setChapter(0);
		test = module->renderText();
		if (test.length() > 8) {
			intro.append(test);
			intro.append("<br /><br />");
		}
		introkey->setChapter(1);
	}
  // get specified chapter intro
  test = module->renderText();
  if (test.length() > 8) {
		intro.append(test);
		intro.append("<br /><br />");
	}
  
  module->setKey(EmptyKey);
  delete(testkey);
  
  if (intro.length()) {
    SWBuf css;
    // use <div> rather than <span> because this needs block not inline display
    css.setFormatted("<div class=\"cs-%s%s\">", module->getName(), (module->getDirection() != DIRECTION_LTR ? " RTL":""));
    intro.insert(0, css);
    intro.append("</div>");
  }
  
  SWBuf check = assureValidUTF8(intro.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetDictionaryEntry
*********************************************************************/
char *xulsword::getDictionaryEntry(const char *lexdictmod, const char *key) {
  SWModule *dmod;
  dmod = MyManager->getModule(lexdictmod);
  if (!dmod) {
    xsThrow("GetDictionaryEntry: module \"%s\" not found.", lexdictmod);
    return NULL;
  }

  SWKey *tkey = dmod->createKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {
    delete(tkey);
    xsThrow("GetDictionaryEntry: module \"%s\" is not a Dictionary.", lexdictmod);
    return NULL;
  }
  delete(tkey);
  
  updateGlobalOptions(false);

  SWBuf xstring;
  
  dmod->setKey(key);

  dmod->increment(0); // Refresh the key's location

  if (strcmp(dmod->getKeyText(), key)) {xstring.set("");}
  else {
    xstring.append(dmod->renderText());
    //Now add any footnotes
    xstring.append("<div class=\"dfnlist\">");
    int footnoteNum = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = dmod->getEntryAttributes()["Footnote"].begin(); AtIndex != dmod->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      xstring.appendFormatted("<sup>%i</sup><span class=\"dfnote\">%s</span>", 
          footnoteNum++, 
          dmod->renderText(AtIndex->second["body"]).c_str());
    }
    xstring.append("</div>");
  }

  if (xstring.length() > 16) {
    SWBuf cssclass;
    cssclass.setFormatted("<div class=\"cs-%s%s\">", dmod->getName(), (dmod->getDirection() != DIRECTION_LTR ? " RTL":""));
    xstring.insert(0, cssclass);
    xstring.append("</div>");
  }
  
  SWBuf check = assureValidUTF8(xstring.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetAllDictionaryKeys
*********************************************************************/
char *xulsword::getAllDictionaryKeys(const char *lexdictmod) {
  SWModule * dmod;
  dmod = MyManager->getModule(lexdictmod);
  if (!dmod) {
    xsThrow("GetAllDictionaryKeys: module \"%s\" not found.", lexdictmod);
    return NULL;
  }

  SWKey *tkey = dmod->createKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {
    delete(tkey);
    xsThrow("GetAllDictionaryKeys: module \"%s\" is not a Dictionary.", lexdictmod);
    return NULL;
  }
  delete(tkey);

  dmod->setPosition(TOP);

  long count=0;
  SWBuf keytext;
  while (!dmod->popError() && count++<MAXDICTSIZE) {
    keytext.append(dmod->getKeyText());
    keytext.append("<nx>");
   //printf("%s\n", dmod->getKeyText());
   //printf("%i\n", count);
   dmod->increment(1);
  }

  SWBuf check = assureValidUTF8(keytext.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetGenBookChapterText
*********************************************************************/
char *xulsword::getGenBookChapterText(const char *gbmod, const char *treekey) {
  SWModule * module = MyManager->getModule(gbmod);
  if (!module) {
    xsThrow("GetGenBookChapterText: module \"%s\" not found.", gbmod);
    return NULL;
  }

  updateGlobalOptions(false);

  SWKey *testkey = module->createKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    xsThrow("GetGenBookChapterText: module \"%s\" is not a General-Book.", gbmod);
    return NULL;
  }

  if (!strcmp(treekey, "/")) {
    key->root();
    key->firstChild();
  }
  else {key->setText(treekey);}

  key->setPersist(true);
  module->setKey(key);
  if (module->popError()) key->root();

  SWBuf chapterText;
  chapterText.append(module->renderText());
  
  SWBuf noteText;
  saveFootnotes(module, NULL, NULL, &noteText, true);
  
  module->setKey(EmptyKey);
  
  delete(testkey);
  
  if (chapterText.length() > 16) {
    SWBuf css;
    css.setFormatted("<span class=\"cs-%s%s\">", module->getName(), (module->getDirection() != DIRECTION_LTR ? " RTL":""));
    chapterText.insert(0, css);
    if (Footnotes) {chapterText.append(noteText);}
    chapterText.append("</span>");
  }
  
  SWBuf check = assureValidUTF8(chapterText.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
GetGenBookTableOfContents
*********************************************************************/
char *xulsword::getGenBookTableOfContents(const char *gbmod) {
  SWModule * module = MyManager->getModule(gbmod);
  if (!module) {
    xsThrow("GetGenBookTableOfContents: module \"%s\" not found.", gbmod);
    return NULL;
  }

  SWKey *testkey = module->createKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    xsThrow("GetGenBookTableOfContents: module \"%s\" is not a General-Book.", gbmod);
    return NULL;
  }

  SWBuf toc;
  // xulSword requires the following header for the RDF file
  toc.set("<?xml version=\"1.0\"?>\n\n<RDF:RDF xmlns:TABLEOFCONTENTS=\"http://www.xulsword.com/tableofcontents/rdf#\" \n\t\txmlns:NC=\"http://home.netscape.com/NC-rdf#\" \n\t\txmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\n");

  // xulSword requires a table of contents having a single folder with name of the module
  toc.appendFormatted("\t<RDF:Bag RDF:about=\"rdf:#%s\">\n\t\t<RDF:li RDF:resource=\"rdf:#/%s\" />\n\t</RDF:Bag>\n\n",
        ROOTRDF,
        gbmod);

  // describe and create the root itself...
  key->root();
  toc.appendFormatted("\t<RDF:Description RDF:about=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Type=\"folder\" \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" />\n",
        gbmod,
        key->getText(),
        gbmod);

  // fill the root folder with everything else...
  SWBuf body;
  getFolderContents(key, gbmod, &body);
  toc.append(body);

  toc.append("</RDF:RDF>");

  delete(testkey);

  SWBuf check = assureValidUTF8(toc.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
LuceneEnabled
*********************************************************************/
bool xulsword::luceneEnabled(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return false;}

  bool supported = true;
  ListKey tmp = module->search(NULL,-4,0,NULL,&supported,NULL,NULL);

  return supported;
}


/********************************************************************
Search
*********************************************************************/
int xulsword::search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {
    xsThrow("Search: module \"%s\" not found.", mod);
    return 0;
  }

  ListKey listkeyInt;
  ListKey scopeK;
  VerseKey parser;
  SWKey key;

  SWBuf searchString;

  int type1;
  char noneed = 0;

  searchString.set(module->renderText(srchstr, -1, false));

  SWKey *nvk;
  SWKey *testkey = module->createKey();
  VerseKey *modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    parser.setVersificationSystem(modvkey->getVersificationSystem());
    scopeK = parser.parseVerseList(scope, parser, true);
    nvk = scopeK.getElement();
    nvk->setPersist(true);
    module->setKey(nvk);
  }
  delete(testkey);

  Searchedvers = getVerseSystemOfModule(mod);

  /*
   *                 >=0  - regex
   *                      -1  - phrase
   *                      -2  - multiword
   *                      -3  - entryAttrib (eg. Word//Strongs/G1234/)
   *                      -4  - Lucene
   */

  if (type == -5) {type1 = -2;}
  else {type1 = type;}

  ListKey tmpkeys;
  ListKey *workKeys;
  if (!newsearch) {workKeys = &tmpkeys;}
  else {
    SearchList.clear();
    workKeys = &SearchList;
  }
  
  // Since SWORD does not check for a null Clucene QueryParser, I'll check 
  // it here before searching. Otherwise, searching for words like "and", 
  // "or", or some Unicode chars like "←" will cause a crash in swmodule.cpp!
  Query *q  = 0;
  const TCHAR *stopWords[] = { 0 };
	standard::StandardAnalyzer analyzer(stopWords);
	wchar_t wbuff[5000];
	lucene_utf8towcs(wbuff, searchString.c_str(), 5000);
	q = QueryParser::parse(wbuff, _T("content"), &analyzer);
			
	if (q) {
//SWLog::getSystemLog()->logDebug("search:\"%s\" %i %i", searchString.c_str(), type1, flags);

		// COMPOUND SEARCH- currently a phrase search with nearly the speed of a multiword search
		if (type == -5) {
			listkeyInt = module->search(searchString.c_str(), type1, flags, 0, 0, &savePercentComplete, NULL);
			if (listkeyInt.getCount() > 0) {
				//searchString.Insert("[^[:alpha:]]",0);
				//searchString.Append("[^[:alpha:]]");
				listkeyInt.setPersist(true);
				module->setKey(listkeyInt);
				//*workKeys = module->search(searchString.get(), 0, flags, 0, 0, &savePercentComplete, NULL);
//SWLog::getSystemLog()->logDebug("search:\"%s\" -1 %i", searchString.c_str(), flags);
				*workKeys = module->search(searchString.c_str(), -1, flags, 0, 0, &savePercentComplete, NULL);
			}
		}
		// SIMPLE SEARCH
		else {*workKeys = module->search(searchString.c_str(), type1, flags, 0, 0, &savePercentComplete, NULL);}
	 }
	 
	// For Windows, sorting is done in swmodule.cpp and does not need to be done again here.
	// This ListKey sort implementation is unbearably slow when there are many results.
	#ifndef WIN32
		// 2048 is Sort By Relevance flag
		if ((flags & 2048) != 2048) workKeys->sort();
	#endif

  // If not a new search append new results to existing key
  if (!newsearch) {
    workKeys->setPosition(TOP);
    while (!workKeys->popError()) {
      SWKey *akey;
      akey = module->createKey(); // get correctly versified key
      akey->setText(workKeys->getText());
      SearchList.add(*akey);
      delete(akey);
      workKeys->increment(1);
    }
  }
  module->setKey(EmptyKey);

  MySearchVerses.set("");

  return SearchList.getCount();
}


/********************************************************************
GetSearchPointer
*********************************************************************/
ListKey *xulsword::getSearchPointer() {
	//SWLog::getSystemLog()->logDebug("(getSearchPointer) CREATING new searchPointer");
	ListKey *searchCopy = new ListKey(SearchList);
	return searchCopy;
}


/********************************************************************
GetSearchResults
*********************************************************************/
char *xulsword::getSearchResults(const char *mod, int first, int num, bool keepStrongs, ListKey *searchPointer) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {
    xsThrow("GetSearchResults: module \"%s\" not found.", mod);
    return NULL;
  }
  
  ListKey *resultList = (searchPointer ? searchPointer:&SearchList);

  if (num==0) {num=resultList->getCount();}

  if (keepStrongs) {
    MyManager->setGlobalOption("Strong's Numbers","On");
  }
  else {
    MyManager->setGlobalOption("Strong's Numbers","Off");
  }
  MyManager->setGlobalOption("Headings","Off");
  MyManager->setGlobalOption("Footnotes","Off");
  MyManager->setGlobalOption("Cross-references","Off");
  MyManager->setGlobalOption("Reference Material Links","Off");
  MyManager->setGlobalOption("Dictionary","Off"); // for backward compatibility
  MyManager->setGlobalOption("Words of Christ in Red","Off");
  MyManager->setGlobalOption("Morphological Tags","Off");
  MyManager->setGlobalOption("Morpheme Segmentation","Off");

  MySearchTexts.set("");
  resultList->setToElement(first,TOP);
  int written=0;
  int savePersist = resultList->isPersist();

  SWKey * testkey = module->createKey();
  VerseKey * modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    const char *toVS = modvkey->getVersificationSystem();
    delete(testkey);
    VerseKey fromkey;
    VerseKey tokey;
    fromkey.setVersificationSystem(Searchedvers);
    tokey.setVersificationSystem(toVS);

    tokey.setPersist(true);
    module->setKey(tokey);
    tokey.setAutoNormalize(0); // Non-existant calls should return empty string!

    while (!resultList->popError()&&(written<num)) {
      fromkey.copyFrom(resultList);
      if ((!strcmp(Searchedvers,WESTERN) && (!strcmp(toVS,EASTERN) || strstr(toVS,SYNODAL))) ||
      (!strcmp(toVS,WESTERN) && (!strcmp(Searchedvers,EASTERN) || strstr(Searchedvers,SYNODAL)))) {
        tokey.setVersificationSystem(toVS);
        mapVersifications(&fromkey, &tokey);
      }
      else {tokey.copyFrom(fromkey);}
      
      MySearchTexts.appendFormatted("<div class=\"slist\" title=\"%s.%s\">", tokey.getOSISRef(), mod);
      MySearchTexts.appendFormatted("<span class=\"cs-%s%s\">%s</span>", 
          mod,
          (module->getDirection() != DIRECTION_LTR ? " RTL":""),
          (keepStrongs ? module->renderText().c_str():module->renderText(0, -1, false).c_str())
      );
      MySearchTexts.append("</div>");

      MySearchVerses.append(tokey.getOSISRef());
      MySearchVerses.append("<nx>");
      
      resultList->increment(1);
      written++;
    }
  }
  else {
    delete(testkey);
    while (!resultList->popError()&&(written<num)) {     
      module->setKey(resultList->getElement()->getText());
      module->increment(0);
      
      SWBuf keyTextEN;
      const char *keyText = module->getKeyText();
      while (*keyText) {keyTextEN.appendFormatted("%%%x", (unsigned char)*keyText++);}

      MySearchTexts.appendFormatted("<div class=\"slist\" title=\"%s.%s\">", keyTextEN.c_str(), mod);
      MySearchTexts.appendFormatted("<span class=\"cs-%s%s\">%s</span>", 
          mod,
          (module->getDirection() != DIRECTION_LTR ? " RTL":""),
          (keepStrongs ? module->renderText().c_str():module->renderText(0, -1, false).c_str()));
      MySearchTexts.append("</div>");

      MySearchVerses.append(module->getKeyText());
      MySearchVerses.append("<nx>");

      resultList->increment(1);
      written++;
    }
  }

  module->setKey(EmptyKey); // Overcomes the crash on Persist problem
  resultList->setPersist(savePersist);

  SWBuf check = assureValidUTF8(MySearchTexts.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}


/********************************************************************
SearchIndexDelete
*********************************************************************/
void xulsword::searchIndexDelete(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (!module) {return;}

  if (!module->hasSearchFramework()) {return;}

  module->deleteSearchFramework();
}


/********************************************************************
SearchIndexBuild
*********************************************************************/
void xulsword::searchIndexBuild(const char *mod) {
  SWModule * module = MyManager->getModule(mod);
  if (module && ReportProgress) {
    if (module->hasSearchFramework()) {
      module->createSearchFramework(&savePercentComplete, (void *)ReportProgress);
    }
  }
}


/********************************************************************
SetGlobalOption
*********************************************************************/
void xulsword::setGlobalOption(const char *option, const char *setting) {
  bool * thisOption;

  // Find which global option we are updating
  if      (!strcmp(option,"Headings"))                 {thisOption = &Headings;}
  else if (!strcmp(option,"Footnotes"))                {thisOption = &Footnotes;}
  else if (!strcmp(option,"Cross-references"))         {thisOption = &Crossrefs;}
  else if (!strcmp(option,"Reference Material Links")) {thisOption = &Dictionary;}
  else if (!strcmp(option,"Words of Christ in Red"))   {thisOption = &Redwords;}
  else if (!strcmp(option,"Verse Numbers"))            {thisOption = &Versenumbers;}
  else if (!strcmp(option,"Hebrew Vowel Points"))      {thisOption = &HebrewPoints;}
  else if (!strcmp(option,"Hebrew Cantillation"))      {thisOption = &Cantillation;}
  else if (!strcmp(option,"Strong's Numbers"))         {thisOption = &Strongs;}
  else if (!strcmp(option,"Morphological Tags"))       {thisOption = &Morph;}
  else if (!strcmp(option,"Morpheme Segmentation"))    {thisOption = &MorphSeg;}
  else {xsThrow("SetGlobalOption: unknown option \"%s\" .", option); return;}

  // Now update the global option
  if (!strcmp(setting,"On"))  {*thisOption = 1;}
  else if (!strcmp(setting,"Off")) {*thisOption = 0;}
  else {xsThrow("SetGlobalOption: setting was not 'On' or 'Off', was \"%s\".", setting); return;}
}


/********************************************************************
GetGlobalOption
*********************************************************************/
char *xulsword::getGlobalOption(const char *option) {
  bool *thisOption;
  SWBuf rCText;

  //Find which global option is being asked for
  if      (!strcmp(option,"Headings"))                 {thisOption = &Headings;}
  else if (!strcmp(option,"Footnotes"))                {thisOption = &Footnotes;}
  else if (!strcmp(option,"Cross-references"))         {thisOption = &Crossrefs;}
  else if (!strcmp(option,"Reference Material Links")) {thisOption = &Dictionary;}
  else if (!strcmp(option,"Words of Christ in Red"))   {thisOption = &Redwords;}
  else if (!strcmp(option,"Verse Numbers"))            {thisOption = &Versenumbers;}
  else if (!strcmp(option,"Hebrew Vowel Points"))      {thisOption = &HebrewPoints;}
  else if (!strcmp(option,"Hebrew Cantillation"))      {thisOption = &Cantillation;}
  else if (!strcmp(option,"Strong's Numbers"))         {thisOption = &Strongs;}
  else if (!strcmp(option,"Morphological Tags"))       {thisOption = &Morph;}
  else if (!strcmp(option,"Morpheme Segmentation"))    {thisOption = &MorphSeg;}
  else {xsThrow("GetGlobalOption: unknown option \"%s\".", option); return NULL;}

  // Now return the proper value
  *thisOption ? rCText.set("On") : rCText.set("Off");

  char *retval;
  retval = (char *)emalloc(rCText.length() + 1);
  if (retval) {strcpy(retval, rCText.c_str());}
	return retval;
}


/********************************************************************
SetCipherKey
*********************************************************************/
void xulsword::setCipherKey(const char *mod, const char *cipherkey, bool useSecModule) {
  SWModule *module;
  module = MyManager->getModule(mod);
  if (!module) {
    delete(module);
    xsThrow("SetCipherKey: module \"%s\" not found.", mod);
    return;
  }
      
  #ifndef NOSECURITY
    if (useSecModule) {
      SWBuf paramstring;
      paramstring.set(NOTFOUND);
      ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&module->getConfig());
      ConfigEntMap::iterator it = infoConfig->find(MODVERSION);
      if (it != infoConfig->end()) {paramstring.set(it->second.c_str());}

      //printf("mod:%s, ver:%s\n", mod, paramstring.get());
      InstSecurity.ModCipherKey(Outtext, cipherkey, paramstring.c_str(), mod);
    }
    else {sprintf(Outtext,"%s", cipherkey);}
    
  #else
    sprintf(Outtext,"%s", cipherkey);
    
  #endif

  // Set the new Cipher Key. IF WRONG CIPHER KEY IS GIVEN, IT CANNOT BE CHANGED WITHOUT RELOAD (SWORD BUG)
//SWLog::getSystemLog()->logDebug("Actual CipherKey=%s\n", Outtext);
  MyManager->setCipherKey(mod, Outtext);
}


/********************************************************************
GetModuleList()
*********************************************************************/
char* xulsword::getModuleList() {
	std::string tr;
	SWModule * module;

  bool first = true;
	for (modIterator = MyManager->Modules.begin(); modIterator != MyManager->Modules.end(); modIterator++) {
		module = (*modIterator).second;
		if (!first) {tr.append("<nx>");}
		tr.append(module->getName());
		tr.append(";");
		tr.append(module->getType());
		first = false;
	}

	if (!strcmp(tr.c_str(), "")) {tr.assign("No Modules");}

  char *retval;
  retval = (char *)emalloc(tr.length() + 1);
  if (retval) {strcpy(retval, tr.c_str());}
	return retval;
}


/********************************************************************
GetModuleInformation
*********************************************************************/
char *xulsword::getModuleInformation(const char *mod, const char *paramname) {
  SWModule * infoModule;
  infoModule = MyManager->getModule(mod);
  SWBuf paramstring;

  if (infoModule) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&infoModule->getConfig());
    ConfigEntMap::iterator it = infoConfig->find(paramname);

    if (it == infoConfig->end()) {paramstring.set(NOTFOUND);}
    else {
      paramstring.set(it->second.c_str());
      it++;
      while (it != infoConfig->end() && !strcmp(it->first.c_str(), paramname)) {
        paramstring.append("<nx>");
        paramstring.append(it->second.c_str());
        it++;
      }
    }
  }

  SWBuf check = assureValidUTF8(paramstring.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}

/********************************************************************
UncompressTarGz
*********************************************************************/

#include "../sword-svn/src/utilfuns/zlib/untgz.c"
void xulsword::uncompressTarGz(const char *tarGzPath, const char *aDirPath) {

	FileDesc *fd = FileMgr::getSystemFileMgr()->open(tarGzPath, FileMgr::RDONLY);
	untargz(fd->getFd(), aDirPath);
	FileMgr::getSystemFileMgr()->close(fd);

	return;
}

/********************************************************************
Translate
*********************************************************************/
char *xulsword::translate(const char *text, const char *localeName) {

  SWBuf langReadable;
  langReadable.set(LocaleMgr::getSystemLocaleMgr()->translate(text, localeName));

  SWBuf check = assureValidUTF8(langReadable.c_str());

  char *retval;
  retval = (char *)emalloc(check.length() + 1);
  if (retval) {strcpy(retval, check.c_str());}
	return retval;
}

// END class xulsword

/********************************************************************
CUSTOM DERIVATIVE CLASSES
*********************************************************************/


/********************************************************************
MarkupFilterMgrXS - to implement xulsword's own OSIS markup filters
*********************************************************************/
MarkupFilterMgrXS::MarkupFilterMgrXS() {
  markup = -1;
  fromplain = NULL;
  fromthml = new ThMLXHTMLXS();
  fromgbf = new GBFXHTMLXS();
  fromosis = new OSISXHTMLXS();
  fromtei = NULL;
}

MarkupFilterMgrXS::~MarkupFilterMgrXS() {}


/********************************************************************
StringMgrXS - to over-ride broken toUpperCase
*********************************************************************/
StringMgrXS::StringMgrXS(char *(*toUpperCase)(char *)) {ToUpperCase = toUpperCase;}
StringMgrXS::~StringMgrXS() {}

char *StringMgrXS::upperUTF8(char *text, unsigned int maxlen) const {
  
  if (text) {
    SWBuf check = assureValidUTF8(text);
    char *res = ToUpperCase((char *)check.c_str());
    if (res) {
      if (maxlen && strlen(res) > maxlen) *(res+maxlen) = 0;
      strcpy(text, res);
    }
  }
  
  return text;
}

bool StringMgrXS::supportsUnicode() const {
  return true;
}


/********************************************************************
SWLogXS - to implement xulsword's own logger
*********************************************************************/
SWLogXS::SWLogXS() {}
SWLogXS::~SWLogXS() {}
void SWLogXS::logMessage(const char *message, int level) const {
#ifndef PHPSWORD
	std::cerr << message;
	std::cerr << std::endl;
#else
  printf("%s\n", message);
#endif
}
