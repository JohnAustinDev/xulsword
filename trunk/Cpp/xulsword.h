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
#ifndef XULSWORD_INCLUDED
#define XULSWORD_INCLUDED

#include "swmgr.h"
#include "versekey.h"
#include "treekeyidx.h"
#include "markupfiltmgr.h"
#include "stringmgr.h"
#include "swconfig.h"

#ifndef NOSECURITY
   #include "security.h"
#endif

SWORD_NAMESPACE_START

/********************************************************************
CUSTOM DERIVATIVE CLASSES
*********************************************************************/

class SWMgrXS : public SWMgr {
  public:
    SWMgrXS(const char *iConfigPath, bool autoload = true, SWFilterMgr *filterMgr = 0, bool multiMod = false, bool augmentHome = true);
    // needed to enable support sword-1.6.1 Synodal modules and to add OSISDictionary filter option to all modules
    signed char Load();
  
  protected:
    bool mgrModeMultiMod; // was private in SWMgr...
    bool augmentHome; // was private in SWMgr...
};


class StringMgrXS : public StringMgr {
  public:
  StringMgrXS::StringMgrXS(char *(*toUpperCase)(char *));
  char *upperUTF8(char *text, unsigned int max = 0) const;
  char *(*ToUpperCase)(char *);
};

class MarkupFilterMgrXS : MarkupFilterMgr {
  public:
    MarkupFilterMgrXS();
    ~MarkupFilterMgrXS();
};

SWORD_NAMESPACE_END

using namespace sword;

/********************************************************************
MAIN XULSWORD CLASS
*********************************************************************/
class xulsword {

  private:
  SWMgrXS           *MyManager;
  StringMgrXS       *MyStringMgr;
  MarkupFilterMgrXS *MyMarkupFilterMgr;
  VerseMgr          *MyVerseMgr;

  ModMap::iterator modIterator;	//Iterator for modules

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
  const char *Searchedvers;
  ListKey SearchList;
  SWBuf MySearchVerses;
  SWBuf MySearchTexts;
  #ifndef NOSECURITY
     security InstSecurity;
  #endif


  protected:
  void keyToStaticVars(VerseKey *key, SWBuf *chapter, int *verse, int *lastverse);
  const char *getVerseSystemOfModule(const char * mod);
  int locationToVerseKey(const char *locationText, VerseKey *vk);
  int textToMaxVerse(const char *vkeytext, VerseKey *vkey);
  void getFolderContents(TreeKey *key, const char *modname, SWBuf *retval);
  virtual void updateGlobalOptions(bool disableFootCrossRed);
  void mapVersifications(VerseKey *vkin, VerseKey *vkout);


  public:
  xulsword::xulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(char *), void (*reportProgress)(int));

  xulsword::~xulsword();

  char *(*ToUpperCase)(char *);
  void (*ThrowJS)(char *);
  void (*ReportProgress)(int);

  xulsword *initSwordEngine(char *path, char *(*toUpperCase)(char *), void (*throwJS)(char *), void (*reportProgress)(int));
  char* setBiblesReference(char * mod, char * Vkeytext);
  char *setVerse(char *mod, int firstverse, int lastverse);
  char *getBookName();
  char *getChapter(const char *mod);
  int getVerseNumber(const char *mod);
  int getLastVerseNumber(const char *mod);
  int getChapterNumber(const char * mod);
  char *getLocation(const char *mod);
  char *getChapterText(const char *vkeymod);
  char *getChapterTextMulti(const char *vkeymodlist);
  char *getVerseText(const char *vkeymod, const char *vkeytext);
  int getMaxVerse(const char *mod, const char *vkeytext);
  char *getVerseSystem(const char *mod);
  char *convertLocation(const char *frVS, const char *vkeytext, const char *toVS);
  char *getBookIntroduction(const char *vkeymod, const char *bname);
  char *getDictionaryEntry(const char *lexdictmod, const char *key);
  char *getAllDictionaryKeys(const char *lexdictmod);
  char *getGenBookChapterText(const char *gbmod, const char *treekey);
  char *getGenBookTableOfContents(const char *gbmod);
  char *getFootnotes();
  char *getCrossRefs();
  char *getNotes();
  bool luceneEnabled(const char *mod);
  int search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch);
  char *getSearchTexts(const char *mod, int first, int num, bool keepStrongs);
  void searchIndexDelete(const char *mod);
  void searchIndexBuild(const char *mod);
  void setGlobalOption(const char *option, const char *setting);
  char *getGlobalOption(const char *option, char *e);
  void setCipherKey(const char *mod, const char *cipherkey, bool useSecModule);
  char* getModuleList();
  char *getModuleInformation(const char *mod, const char *paramname);

};


#endif

