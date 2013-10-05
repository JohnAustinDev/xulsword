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
#include "swmodule.h"
#include "swlog.h"
#include "ztext.h"
#include "rawtext.h"
#include "rawtext4.h"
#include "zcom.h"
#include "rawcom.h"
#include "rawcom4.h"
#include "zld.h"
#include "rawld.h"
#include "rawld4.h"
#include "rawgenbook.h"
#include "rawfiles.h"
#include "hrefcom.h"
#include "localemgr.h"
#include "listkey.h"

#ifndef NOSECURITY
   #include "security.h"
#endif

SWORD_NAMESPACE_START

/********************************************************************
CUSTOM DERIVATIVE CLASSES
*********************************************************************/
//SWMgrXS - to over-ride modules and how they are loaded
class SWMgrXS : public SWMgr {
  public:
    SWMgrXS(const char *iConfigPath, bool autoload = true, SWFilterMgr *filterMgr = 0, bool multiMod = false, bool augmentHome = true);
    ~SWMgrXS();
    
    // needed to enable support sword-1.6.1 Synodal modules
    signed char Load();

  protected:
    bool mgrModeMultiMod; // was private in SWMgr...
    bool augmentHome; // was private in SWMgr...
};

//StringMgrXS - to over-ride broken toUpperCase
class StringMgrXS : public StringMgr {
  public:
  StringMgrXS(char *(*toUpperCase)(char *));
  ~StringMgrXS();
  char *upperUTF8(char *text, unsigned int max = 0) const;
  char *(*ToUpperCase)(char *);
  
  protected:
  virtual bool supportsUnicode() const;
};

//MarkupFilterMgrXS - to implement xulsword's own OSIS markup filters
class MarkupFilterMgrXS : MarkupFilterMgr {
  public:
    MarkupFilterMgrXS();
    ~MarkupFilterMgrXS();
};

//SWLog - for custom logging
class SWLogXS : public SWLog {
  public:
    SWLogXS();
    ~SWLogXS();
    virtual void logMessage(const char *message, int level) const;
};


SWORD_NAMESPACE_END

using namespace sword;


/********************************************************************
MAIN XULSWORD CLASS
*********************************************************************/
class xulsword {

  private:
  SWMgrXS *MyManager;

  char *(*ToUpperCase)(char *);
  void (*ThrowJS)(const char *);
  void (*ReportProgress)(int);
  
  ModMap::iterator modIterator;	//Iterator for modules

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
  void xsThrow(const char *msg, const char *param = NULL);
  void keyToVars(VerseKey *key, SWBuf *chapter, int *verse, int *lastverse);
  const char *getVerseSystemOfModule(const char * mod);
  int locationToVerseKey(const char *locationText, VerseKey *vk);
  int textToMaxChapter(const char *vkeytext, VerseKey *vkey);
  int textToMaxVerse(const char *vkeytext, VerseKey *vkey);
  void getFolderContents(TreeKey *key, const char *modname, SWBuf *retval);
  virtual void updateGlobalOptions(bool disableFootCrossRed);
  void mapVersifications(VerseKey *vkin, VerseKey *vkout);
  char *getBookName(SWBuf *Chapter);
  void saveFootnotes(SWModule *module, SWBuf *footnoteText, SWBuf *crossRefText, SWBuf *noteText);


  public:
  xulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int), const char *localeDir = NULL);
  ~xulsword();
  
  static StringMgrXS *MyStringMgrXS;
  static SWLogXS *MySWLogXS;

  char *getChapterText(const char *vkeymod, const char *vkeytext);
  char *getFootnotes();
  char *getCrossRefs();
  char *getNotes();
  char *getChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes);
  char *getVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes = false);
  int   getMaxChapter(const char *mod, const char *vkeytext);
  int   getMaxVerse(const char *mod, const char *vkeytext);
  char *getVerseSystem(const char *mod);
  char *convertLocation(const char *frVS, const char *vkeytext, const char *toVS);
  char *getBookIntroduction(const char *vkeymod, const char *bname);
  char *getDictionaryEntry(const char *lexdictmod, const char *key);
  char *getAllDictionaryKeys(const char *lexdictmod);
  char *getGenBookChapterText(const char *gbmod, const char *treekey);
  char *getGenBookTableOfContents(const char *gbmod);
  bool  luceneEnabled(const char *mod);
  int   search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch);
  ListKey *getSearchPointer();
  char *getSearchResults(const char *mod, int first, int num, bool keepStrongs, ListKey *searchPointer = NULL);
  void  searchIndexDelete(const char *mod);
  void  searchIndexBuild(const char *mod);
  void  setGlobalOption(const char *option, const char *setting);
  char *getGlobalOption(const char *option);
  void  setCipherKey(const char *mod, const char *cipherkey, bool useSecModule);
  char *getModuleList();
  char *getModuleInformation(const char *mod, const char *paramname);
  void  uncompressTarGz(const char *tarGzPath, const char *aDirPath);
  char *translate(const char *text, const char *localeName);

};

#endif
