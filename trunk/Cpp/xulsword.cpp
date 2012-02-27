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

#include <windows.h>
#include <dirent.h>
#include <stdio.h>
#include <string>
#include <iostream>

#include "swmgr.h"
#include "swmodule.h"
#include "versekey.h"
#include "treekeyidx.h"
#include "strkey.h"
#include "markupfiltmgr.h"
#include "swlog.h"
#include "stringmgr.h"
#include "swconfig.h"
#include "osisxhtml.h"
#include "gbfxhtml.h"
#include "thmlxhtml.h"

#include "canon_synodal0.h"	// Russian Synodal sword-1.6.1 v11n system
#include "canon_east.h"
#include "canon_synodalprot.h"
#include "osisdictionary.h"
#include "versemaps.h"

#define DLLEXPORT extern "C" __declspec(dllexport)
#define MAXSTRING 1000
#define MAXDICTSIZE 20000 /*ISBE is 9350 entries*/
#define MODVERSION "xulswordVersion"
#define NOTFOUND "Not Found"
#define WESTERN "KJV"
#define EASTERN "EASTERN" // DEPRICATED verse system used by pre sword-1.6.1 built modules
#define SYNODAL "Synodal"  // can be used by strstr to match SynodalProt, SynodalP, Synodal0, and Synodal
#define VSERROR 99

using namespace sword;

ModMap::iterator modIterator;	//Iterator for modules
const char DefaultVersificationSystem[] = "KJV";


/********************************************************************
Global variables
*********************************************************************/
SWBuf ChapterW;    //current chapter (KJV)
int VerseW;        //current verse (KJV)
int LastVerseW;    //current last-verse (KJV)
SWBuf ChapterE;    //current chapter (Synodal)
int VerseE;        //current verse (Synodal)
int LastVerseE;    //current last-verse (Synodal)
bool Footnotes;         
bool Headings;
bool Crossrefs;
bool Dictionary;
bool Redwords;
bool Versenumbers;
bool HebrewPoints;
bool Cantillation;
bool Strongs;
bool Morph;
bool MorphSeg;
char Outtext[256];
VerseKey EmptyKey;
SWBuf MyFootnotes;
SWBuf MyCrossRefs;
SWBuf MyNotes;



/********************************************************************
Javascript callback functions
*********************************************************************/
static char *(*ToUpperCase)(char *) = NULL;


/********************************************************************
Custom classes
*********************************************************************/
#include "osisxhtmlxs.cpp"
#include "gbfxhtmlxs.cpp"
#include "thmlxhtmlxs.cpp"
#include "osisdictionary.cpp"

SWORD_NAMESPACE_START
class SWMgrXS : public SWMgr {
  public:
    SWMgrXS(SWFilterMgr *filterMgr, bool multiMod = false);
    SWMgrXS(const char *iConfigPath, bool autoload = true, SWFilterMgr *filterMgr = 0, bool multiMod = false, bool augmentHome = true);

  protected:
    void init() {
      SWMgr::init();
      SWOptionFilter *tmpFilter = 0;
      tmpFilter = new OSISDictionary();
      optionFilters.insert(OptionFilterMap::value_type("OSISDictionary", tmpFilter));
      cleanupFilters.push_back(tmpFilter);
    }
    
    // This createModule sets the proper version of Synodal for backward compatibility
    SWModule *createModule(const char *name, const char *driver, ConfigEntMap &section);
};
SWMgrXS::SWMgrXS(SWFilterMgr *filterMgr, bool multiMod)
    : SWMgr(filterMgr, multiMod) {};
SWMgrXS::SWMgrXS(const char *iConfigPath, bool autoload, SWFilterMgr *filterMgr, bool multiMod, bool augmentHome)
    : SWMgr(iConfigPath, autoload, filterMgr, multiMod, augmentHome) {};
SWORD_NAMESPACE_END
#include "createModule.cpp"

class StringMgrXS : public StringMgr {
  public:
  char *upperUTF8(char *text, unsigned int max = 0) const {
    if (ToUpperCase) {text = ToUpperCase(text);}
    return text;
  }
};

class MarkupFilterMgrXS : MarkupFilterMgr {
  public:
    MarkupFilterMgrXS() {
      markup = -1;
      fromplain = NULL;
      fromthml = new ThMLXHTMLXS();
      fromgbf = new GBFXHTMLXS();
      fromosis = new OSISXHTMLXS();
      fromtei = NULL;
    }
    ~MarkupFilterMgrXS() {
        if (fromthml)
                delete (fromthml);
        if (fromgbf)
                delete (fromgbf);
        if (fromplain)
                delete (fromplain);
        if (fromosis)
                delete (fromosis);
        if (fromtei)
                delete (fromtei);
    }
};

SWMgrXS *MyManager;
StringMgrXS *MyStringMgr;
MarkupFilterMgrXS *MyMarkupFilterMgr;
VerseMgr *MyVerseMgr;


/********************************************************************
keyToStaticVars
*********************************************************************/
// Assign a set of static verse locations from a key
void keyToStaticVars(VerseKey *key, SWBuf *chapter, int *verse, int *lastverse) {
  chapter->appendFormatted("%s %i", key->getBookAbbrev(), key->Chapter());
  *verse = key->Verse();
  if (key->isBoundSet()) {*lastverse = key->UpperBound().Verse();}
  else {*lastverse = key->Verse();}
//printf("SETTING TO: %s:%i-%i\n", NS_ConvertUTF16toUTF8(*chapter).get(), *verse, *lastverse);
}


/********************************************************************
getVerseSystemOfModule
*********************************************************************/
// Returns DefaultVersificationSystem if verse system cannot be determined.
const char *getVerseSystemOfModule(const char * mod) {
  if (!mod) return DefaultVersificationSystem;
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
int locationToVerseKey(const char *locationText, VerseKey *vk) {
  int firstverse=0;
  int lastverse=0;
  vk->ClearBounds(); // important to prevent errors after setText
  VerseKey ub;
  std::string keytext = locationText;
  int dash = keytext.find('-',0);
  if (dash != std::string::npos) {
    std::string upperbound;
    upperbound.assign(keytext, dash+1, keytext.length()-dash-1);
          keytext.assign(keytext, 0, dash);
          lastverse = atoi(upperbound.c_str());
          // test for anything other than just a last verse number
          if (lastverse < 1 || upperbound.length() > 3) {
           ub.setVersificationSystem(vk->getVersificationSystem());
           locationToVerseKey(upperbound.c_str(), &ub);
           lastverse = ub.Verse();
         }
  }
  else {
    // If there is no dash, look for a "." delineated lastverse location (The "last verse"
    // position is unique to MK and so if it exists, it needs to be parsed here before handing to verse key.)
    lastverse = 0;
    unsigned int p=0;
    for (int i=0; i<3; i++) {
      p = keytext.find('.',p);
      if (p == std::string::npos) {break;}
      p++;
    }
    // less than three "."s
    if (p == std::string::npos) {
      // check if no verse, and if not, then first verse is 1 and lastverse is maxverse
      p = keytext.find_first_not_of(" ", 0); // allow for leading spaces
      for (int i=0; i<2; i++) {
        p = keytext.find_first_of(" :.", p);
        if (p == std::string::npos) {break;}
        p++;
      }
      // if less than two delimiters were found, or no number following second delimiter = no verse
      if (p == std::string::npos || atoi(keytext.substr(p).c_str()) == 0) {
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
//printf("set=%s, actual=%s\n", keytext.c_str(), vk->getText());
  ub.copyFrom(vk);
  if (lastverse < ub.Verse()) {lastverse = ub.Verse();}
  else if (lastverse > ub.getVerseMax()) {lastverse = ub.getVerseMax();}
  ub.Verse(lastverse);
  vk->UpperBound(ub);
  return (vk->Error());
}


/********************************************************************
updateGlobalOptions
*********************************************************************/
void updateGlobalOptions(SWMgr * manager, bool disableFootCrossRed) {
  manager->setGlobalOption("Headings",Headings ? "On":"Off");
  manager->setGlobalOption("Footnotes",Footnotes && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Cross-references",Crossrefs && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Dictionary",Dictionary ? "On":"Off");
  manager->setGlobalOption("Words of Christ in Red",Redwords && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Hebrew Vowel Points",HebrewPoints ? "On":"Off");
  manager->setGlobalOption("Hebrew Cantillation",Cantillation ? "On":"Off");
  manager->setGlobalOption("Strong's Numbers",Strongs ? "On":"Off");
  manager->setGlobalOption("Morphological Tags",Morph ? "On":"Off");
  manager->setGlobalOption("Morpheme Segmentation",MorphSeg ? "On":"Off");
}


/********************************************************************
mapVersifications
*********************************************************************/
// Reads an input key and sets the output key to the same verse in opposing verse system.
// Conversion is always between WESTERN (KJV) and EASTERN (Synodal, Synodal0, SynodalP, SynodalProt etc).
// If upper bound is set on input key, then converted upper bound will be set on output key
void mapVersifications(VerseKey *vkin, VerseKey *vkout) {
  const char *inVerseSystem = vkin->getVersificationSystem();
  const char *outVerseSystem = vkout->getVersificationSystem();

  // only change output key's verse system when it's necessary
  if (!strcmp(inVerseSystem,EASTERN) || strstr(inVerseSystem,SYNODAL)) vkout->setVersificationSystem(WESTERN);
  else if (!strcmp(inVerseSystem,WESTERN) && (strcmp(outVerseSystem,EASTERN) && !strstr(outVerseSystem,SYNODAL)))
    vkout->setVersificationSystem(EASTERN);

  vkout->ClearBounds(); // important to prevent errors which changing key!

        // Prepare to map UpperBound
  SWBuf keyTextU;
  VerseKey bkey;
  if (vkin->isBoundSet()) {
    keyTextU.appendFormatted("%s %i:%i", vkin->UpperBound().getBookAbbrev(), vkin->UpperBound().Chapter(), vkin->UpperBound().Verse());
    bkey.setVersificationSystem(!strcmp(inVerseSystem, WESTERN) ? EASTERN:WESTERN);
    bkey.setText(keyTextU.c_str());
  }

  // Prepare to map key
  SWBuf keyText;
  keyText.appendFormatted("%s %i:%i", vkin->getBookAbbrev(), vkin->Chapter(), vkin->Verse());
  vkout->setText(keyText.c_str());

//printf("MAPPING\nfromKey=%s, %s, fromUB=%s, %s\ntoKey  =%s, %s, toUB  =%s, %s\n\n", vkin->getText(), vkin->getVersificationSystem(), vkin->UpperBound().getText(), vkin->UpperBound().getVersificationSystem(), vkout->getText(), vkout->getVersificationSystem(), vkout->UpperBound().getText(), vkout->UpperBound().getVersificationSystem());

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
        if (vkin->isBoundSet()) {vkout->UpperBound(bkey);}

//printf("POST MAPPING\nfromKey=%s, %s, fromUB=%s, %s\ntoKey  =%s, %s, toUB  =%s, %s\n\n", vkin->getText(), vkin->getVersificationSystem(), vkin->UpperBound().getText(), vkin->UpperBound().getVersificationSystem(), vkout->getText(), vkout->getVersificationSystem(), vkout->UpperBound().getText(), vkout->UpperBound().getVersificationSystem());
}


/********************************************************************
InitSwordEngine()
*********************************************************************/
DLLEXPORT void InitSwordEngine(char *path, char *(*toUpperCase)(char *))
{
  if (toUpperCase) {ToUpperCase = toUpperCase;}

  MyVerseMgr = VerseMgr::getSystemVerseMgr();
  MyVerseMgr->registerVersificationSystem("Synodal0", otbooks_synodal0, ntbooks_synodal0, vm_synodal0);
  MyVerseMgr->registerVersificationSystem("EASTERN", otbooks_eastern, ntbooks_eastern, vm_eastern);
  MyVerseMgr->registerVersificationSystem("SynodalProt", otbooks_synodalprot, ntbooks_synodalprot, vm_synodalprot);
  
  MyMarkupFilterMgr = new MarkupFilterMgrXS();

  MyManager = 0;
  MyManager = new SWMgrXS(path, true, (MarkupFilterMgr *)MyMarkupFilterMgr, false);

  if (!MyManager) {MyManager = new SWMgrXS((MarkupFilterMgr *)MyMarkupFilterMgr, false);}
  
  MyStringMgr = new StringMgrXS();
  StringMgr::setSystemStringMgr(MyStringMgr);

  SWLog::getSystemLog()->setLogLevel(0); // set SWORD log reporting... 5 is all stuff
}


/********************************************************************
QuitSwordEngine()
*********************************************************************/
DLLEXPORT void QuitSwordEngine()
{
  delete MyManager;
  delete MyStringMgr;
  delete MyMarkupFilterMgr;
}


/********************************************************************
GetModuleList()
*********************************************************************/
DLLEXPORT char* GetModuleList()
{
	std::string tr;
	SWModule * module;

  bool first = true;
	for (modIterator = MyManager->Modules.begin(); modIterator != MyManager->Modules.end(); modIterator++) {
		module = (*modIterator).second;
		if (!first) {tr.append("<nx>");}
		tr.append(module->Name());
		tr.append(";");
		tr.append(module->Type());
		first = false;
	}

	if (!strcmp(tr.c_str(), "")) {tr.assign("No Modules");}

  char *retval;
  retval = (char *)malloc(tr.length() + 1);
  if (retval) {strcpy(retval, tr.c_str());}
 
	return retval;
}


/********************************************************************
SetBiblesReference()
*********************************************************************/
/*  Determines verse system from mod parameter
    Assigns all static location variables
    Returns versification which was used when assigning chapter */
DLLEXPORT char* SetBiblesReference(char * mod, char * Vkeytext)
{
  // Determine which verse system is being used
  const char *versification = getVerseSystemOfModule(mod);
  VerseKey fromKey;
  fromKey.setVersificationSystem(versification);
  locationToVerseKey(Vkeytext, &fromKey);
  VerseKey toKey;
  toKey.setVersificationSystem(EASTERN); // init value only, may be changed by mapVersifications
  mapVersifications(&fromKey, &toKey);

  if (!strcmp(versification, WESTERN)) {
    keyToStaticVars(&fromKey, &ChapterW, &VerseW, &LastVerseW);
    keyToStaticVars(&toKey, &ChapterE, &VerseE, &LastVerseE);
  }
  else {
    keyToStaticVars(&fromKey, &ChapterE, &VerseE, &LastVerseE);
    keyToStaticVars(&toKey, &ChapterW, &VerseW, &LastVerseW);
  }
//printf("SetBookChapter:\nSTATIC LOCATION:\n\tWESTERN = %s:%i-%i\n\tEASTERN = %s:%i-%i\n", NS_ConvertUTF16toUTF8(ChapterW).get(), VerseW, LastVerseW, NS_ConvertUTF16toUTF8(ChapterE).get(), VerseE, LastVerseE);

  char *retval;
  retval = (char *)malloc(strlen(versification) + 1);
  if (retval) {strcpy(retval, versification);}

	return retval;
}


/********************************************************************
GetChapter
*********************************************************************/
DLLEXPORT char *GetChapter(const char *mod)
{
  const char *versification = getVerseSystemOfModule(mod);

  SWBuf * Chapter;
  !strcmp(versification, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  char *retval;
  retval = (char *)malloc(Chapter->length() + 1);
  if (retval) {strcpy(retval, Chapter->c_str());}
  return retval;
}


/********************************************************************
GetBookName
*********************************************************************/
DLLEXPORT char *GetBookName()
{
  std::string chapter;
  std::string book;

  chapter.assign(ChapterW.c_str());

  int space = chapter.find(' ',0);
  book.assign(chapter.substr(0,space));
  
  char *retval;
  retval = (char *)malloc(book.length() + 1);
  if (retval) {strcpy(retval, book.c_str());}
  return retval;
}


/********************************************************************
GetVerseNumber
*********************************************************************/
DLLEXPORT int GetVerseNumber(const char *mod)
{
  const char *versification = getVerseSystemOfModule(mod);
  return (!strcmp(versification, WESTERN) ? VerseW:VerseE);
}


/********************************************************************
GetLastVerseNumber
*********************************************************************/
DLLEXPORT int GetLastVerseNumber(const char *mod)
{
  const char *versification = getVerseSystemOfModule(mod);
  return (!strcmp(versification, WESTERN) ? LastVerseW:LastVerseE);
}


/********************************************************************
GetChapterNumber
*********************************************************************/
DLLEXPORT int GetChapterNumber(const char * mod)
{
  const char *versification = getVerseSystemOfModule(mod);

  VerseKey myVerseKey;
  myVerseKey.setVersificationSystem(versification);

  SWBuf *Chapter;
  !strcmp(versification, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  myVerseKey.setText(Chapter->c_str());
  
  return myVerseKey.Chapter();;
}


/********************************************************************
GetLocation
*********************************************************************/
DLLEXPORT char *GetLocation(const char *mod)
{
  char *bkp;
  bkp = GetBookName();
  SWBuf bk = *bkp;
  delete(bkp);
  int ch = GetChapterNumber(mod);
  int vs = GetVerseNumber(mod);
  int lv = GetLastVerseNumber(mod);

  SWBuf location;
  location.appendFormatted("%s.%i.%i.%i", bk.c_str(), ch, vs, lv);

  char *retval;
  retval = (char *)malloc(location.length() + 1);
  if (retval) {strcpy(retval, location);}
  return retval;
}


/********************************************************************
GetChapterText
*********************************************************************/
DLLEXPORT char *GetChapterText(const char *vkeymod)
{
  SWBuf verseText;
  SWBuf footnoteText;
  SWBuf crossRefText;
  SWBuf noteText;
  SWBuf * Chapter;

  SWModule * module = MyManager->getModule(vkeymod);
  if (!module) {return NULL;}

  SWKey *testkey = module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    return NULL;
  }
  myVerseKey->Persist(1);
  myVerseKey->setAutoNormalize(0); // Non-existant calls should return empty string
  module->setKey(myVerseKey);

  updateGlobalOptions(MyManager, false);
  module->setSkipConsecutiveLinks(true);

  //Initialize Key
  !strcmp(myVerseKey->getVersificationSystem(), WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  myVerseKey->setText(Chapter->c_str());

  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->UpperBound(ub);

  //Is this a Commentary??
  bool isCommentary = !strcmp(module->Type(), "Commentaries");

  //NOW READ ALL VERSES IN THE CHAPTER
  int * Verse;
  int * LastVerse;
  if (!strcmp(myVerseKey->getVersificationSystem(), WESTERN)) {
    Verse = &VerseW;
    LastVerse = &LastVerseW;
  }
  else {
    Verse = &VerseE;
    LastVerse = &LastVerseE;
  }

  char *bkp;
  bkp = GetBookName();
  SWBuf bk = *bkp;
  delete(bkp);
  int ch = GetChapterNumber(vkeymod);

  bool haveText = false;
  std::string chapHTML;
  while (!module->Error()) {
    SWBuf verseHTML;
    int vNum = myVerseKey->Verse();
    if (vNum>1 && vNum == *Verse) {MyManager->setGlobalOption("Words of Christ in Red","Off");}
    else if (vNum == (*LastVerse + 1)) {MyManager->setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");}
    verseText = module->RenderText(); //THIS MUST BE RENDERED BEFORE READING getEntryAttributes!!!

    // move verse number after any paragraph indents
    bool verseStartsWithIndent = false;
    if (!strncmp(verseText.c_str(),"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;",30)) {
      verseStartsWithIndent = true;
      verseText << 30;
    }
    haveText = haveText || *verseText.c_str();


    //SAVE ANY FOOTNOTES
    int fnV = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = module->getEntryAttributes()["Footnote"].begin(); AtIndex != module->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      if ((AtIndex->second["type"] == "crossReference")||(AtIndex->second["type"] == "x-cross-ref")) {
          sprintf(Outtext, "cr.%d.%s<bg/>", fnV, myVerseKey->getOSISRef());
          crossRefText.append(Outtext);
          crossRefText.append(AtIndex->second["refList"]);
          crossRefText.append("<nx/>");
          noteText.append(Outtext);
          noteText.append(AtIndex->second["refList"]);
          noteText.append("<nx/>");
        }
        else {
          sprintf(Outtext, "fn.%d.%s<bg/>", fnV, myVerseKey->getOSISRef());
          footnoteText.append(Outtext);
          footnoteText.append(module->RenderText(AtIndex->second["body"]));
          footnoteText.append("<nx/>");
          noteText.append(Outtext);
          noteText.append(module->RenderText(AtIndex->second["body"]));
          noteText.append("<nx/>");
        }
      fnV++;
    }

    //FIRST PRINT OUT ANY HEADINGS IN THE VERSE
    AttributeValue::iterator Value;
    for (Value = module->getEntryAttributes()["Heading"]["Preverse"].begin(); Value != module->getEntryAttributes()["Heading"]["Preverse"].end(); Value++) {
      // if a line break is not found at or near the end of the previous verse,
      // add a line break to help insure titles have space above them.
      if (!verseHTML.length() && chapHTML.length() > 64) {
        int lbr = chapHTML.rfind("<br />");
        if (lbr != std::string::npos && chapHTML.length()-1-lbr < 64) verseHTML.append("<br />");
      }
      verseHTML.append("<div class=\"");
      if (module->getEntryAttributes()["Heading"][Value->first]["level"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["level"], "2")) {
        verseHTML.append("head2");
      }
      else {verseHTML.append("head1");}
      if (module->getEntryAttributes()["Heading"][Value->first]["canonical"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["canonical"], "true")) {
        verseHTML.append(" canonical");
      }
      verseHTML.append("\">");
      verseHTML.append(module->RenderText(Value->second));
      verseHTML.append("</div>");
    }

    //NOW PRINT OUT THE VERSE ITSELF
    //If this is selected verse then designate as so
    //Output verse html code
    sprintf(Outtext, "<span id=\"vs.%s.%d.%d\">", bk.c_str(), ch, vNum);
    verseHTML.append(Outtext);

    if (vNum==*Verse) {verseHTML.append("<span id=\"sv\" class=\"hl\">");}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {verseHTML.append("<span class=\"hl\">");}

    if (verseStartsWithIndent) {verseHTML.append("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");}

    verseHTML.append("<sup class=\"versenum\">");
    //If verse is non-empty and verse numbers are being displayed then print the verse number
    if (Versenumbers && (verseText.length() > 0)) {
      sprintf(Outtext, "%d", vNum);
      verseHTML.append(Outtext);
      verseHTML.append("</sup>");
    }
    else {verseHTML.append("</sup> ");}

    verseHTML.append(verseText.c_str());
    if (isCommentary) {verseHTML.append("<br><br>");}

    if(vNum==*Verse) {verseHTML.append("</span>");}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {verseHTML.append("</span>");}

    verseHTML.append("</span>");
    chapHTML.append(verseHTML.c_str());
    module->increment(1);
  }
  module->setKey(EmptyKey);

  if (!haveText) {chapHTML.assign("");}
  MyFootnotes = footnoteText;
  MyCrossRefs = crossRefText;
  MyNotes = noteText;
  
  delete(testkey);
  
  char *retval;
  retval = (char *)malloc(chapHTML.length() + 1);
  if (retval) {strcpy(retval, chapHTML.c_str());}
  return retval;
}


DLLEXPORT void FreeMemory(void * tofree) {if (tofree) {delete tofree;}}