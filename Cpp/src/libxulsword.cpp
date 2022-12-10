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

#include "xulsword.h"
#include "swlog.h"
#include "stringmgr.h"
#include <iostream>

#ifdef WIN32
#define DLLEXPORT extern "C" __declspec(dllexport)
#else
#define DLLEXPORT extern "C"
#endif

static xulsword *my_xulsword;
static xulsword *my_xulswordfb;

/********************************************************************
EXPORTED INTERFACE FUNCTIONS
*********************************************************************/
// Ruturns a xulsword instance with firebibleMode = false
DLLEXPORT xulsword *GetXulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int), const char *localeDir) {

  if (my_xulsword) return my_xulsword;

  my_xulsword = new xulsword(path, toUpperCase, throwJS, reportProgress, localeDir, false);

  SWLog::getSystemLog()->logDebug("CREATED xulsword object (firebibleMode = false)");

  return my_xulsword;
}

// Ruturns a xulsword instance with firebibleMode = true
DLLEXPORT xulsword *GetXulswordFB(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int), const char *localeDir) {

  if (my_xulswordfb) return my_xulswordfb;

  my_xulswordfb = new xulsword(path, toUpperCase, throwJS, reportProgress, localeDir, true);

  SWLog::getSystemLog()->logDebug("CREATED xulsword object (firebibleMode = true)");

  return my_xulswordfb;
}

DLLEXPORT char *GetChapterText(xulsword *inst, const char *vkeymod, const char *vkeytext) {
  return inst->getChapterText(vkeymod, vkeytext);
}

DLLEXPORT char *GetFootnotes(xulsword *inst) {
  return inst->getFootnotes();
}

DLLEXPORT char *GetCrossRefs(xulsword *inst) {
  return inst->getCrossRefs();
}

DLLEXPORT char *GetNotes(xulsword *inst) {
  return inst->getNotes();
}

DLLEXPORT char *GetChapterTextMulti(xulsword *inst, const char *vkeymodlist, const char *vkeytext, bool keepnotes) {
  return inst->getChapterTextMulti(vkeymodlist, vkeytext, keepnotes);
}

DLLEXPORT char *GetVerseText(xulsword *inst, const char *vkeymod, const char *vkeytext, bool keepnotes) {
  return inst->getVerseText(vkeymod, vkeytext, keepnotes);
}

DLLEXPORT int GetMaxChapter(xulsword *inst, const char *v11n, const char *vkeytext) {
  return inst->getMaxChapter(v11n, vkeytext);
}

DLLEXPORT int GetMaxVerse(xulsword *inst, const char *v11n, const char *vkeytext) {
  return inst->getMaxVerse(v11n, vkeytext);
}

DLLEXPORT char *GetModuleBooks(xulsword *inst, const char *mod) {
  return inst->getModuleBooks(mod);
}

DLLEXPORT char *ParseVerseKey(xulsword *inst, const char *vkeymod, const char *vkeytext) {
  return inst->parseVerseKey(vkeymod, vkeytext);
}

DLLEXPORT char *GetVerseSystem(xulsword *inst, const char *mod) {
  return inst->getVerseSystem(mod);
}

DLLEXPORT char *ConvertLocation(xulsword *inst, const char *frVS, const char *vkeytext, const char *toVS) {
  return inst->convertLocation(frVS, vkeytext, toVS);
}

DLLEXPORT char *GetIntroductions(xulsword *inst, const char *vkeymod, const char *bname) {
  return inst->getIntroductions(vkeymod, bname);
}

DLLEXPORT char *GetDictionaryEntry(xulsword *inst, const char *lexdictmod, const char *key) {
  return inst->getDictionaryEntry(lexdictmod, key);
}

DLLEXPORT char *GetAllDictionaryKeys(xulsword *inst, const char *lexdictmod) {
  return inst->getAllDictionaryKeys(lexdictmod);
}

DLLEXPORT char *GetGenBookChapterText(xulsword *inst, const char *gbmod, const char *treekey) {
  return inst->getGenBookChapterText(gbmod, treekey);
}

DLLEXPORT char *GetGenBookTableOfContents(xulsword *inst, const char *gbmod) {
  return inst->getGenBookTableOfContents(gbmod);
}

DLLEXPORT char *GetGenBookTableOfContentsJSON(xulsword *inst, const char *gbmod) {
  return inst->getGenBookTableOfContentsJSON(gbmod);
}

DLLEXPORT bool LuceneEnabled(xulsword *inst, const char *mod) {
  return inst->luceneEnabled(mod);
}

DLLEXPORT int Search(xulsword *inst, const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  return inst->search(mod, srchstr, scope, type, flags, newsearch);
}

DLLEXPORT void *GetSearchPointer(xulsword *inst) {
  return inst->getSearchPointer();
}

DLLEXPORT char *GetSearchResults(xulsword *inst, const char *mod, int first, int num, bool keepStrongs, void *searchPointer = NULL) {
  return inst->getSearchResults(mod, first, num, keepStrongs, (ListKey *)searchPointer);
}

DLLEXPORT void SearchIndexDelete(xulsword *inst, const char *mod) {
  return inst->searchIndexDelete(mod);
}

DLLEXPORT void SearchIndexBuild(xulsword *inst, const char *mod) {
  return inst->searchIndexBuild(mod);
}

DLLEXPORT void SetGlobalOption(xulsword *inst, const char *option, const char *setting) {
  return inst->setGlobalOption(option, setting);
}

DLLEXPORT char *GetGlobalOption(xulsword *inst, const char *option) {
  return inst->getGlobalOption(option);
}

DLLEXPORT void SetCipherKey(xulsword *inst, const char *mod, const char *cipherkey, bool useSecModule) {
  return inst->setCipherKey(mod, cipherkey, useSecModule);
}

DLLEXPORT char* GetModuleList(xulsword *inst) {
  return inst->getModuleList();
}

DLLEXPORT char *GetModuleInformation(xulsword *inst, const char *mod, const char *paramname) {
  return inst->getModuleInformation(mod, paramname);
}

DLLEXPORT void UncompressTarGz(xulsword *inst, const char *tarGzPath, const char *aDirPath) {
  return inst->uncompressTarGz(tarGzPath, aDirPath);
}

DLLEXPORT char *Translate(xulsword *inst, const char *text, const char *localeName) {
  return inst->translate(text, localeName);
}

DLLEXPORT void FreeMemory(void *tofree, const char *type) {

  if (!strcmp(type, "char")) free(tofree);

  else if (!strcmp(type, "xulsword")) {
    if (my_xulsword == (xulsword *)tofree) {

      SWLog::getSystemLog()->logDebug("(FreeMemory) FREEING xulsword");

      delete my_xulsword;
      my_xulsword = NULL;

    }
  }

  else if (!strcmp(type, "searchPointer")) {
    ListKey *sp = (ListKey *)tofree;
    if (sp) {
      //SWLog::getSystemLog()->logDebug("(FreeMemory) FREEING searchPointer");
      delete sp;
    }
    else SWLog::getSystemLog()->logDebug("(FreeMemory) NULL pointer, nothing freed.");
  }

}

DLLEXPORT void FreeLibxulsword() {
  std::cerr << "LIBXULSWORD DESTRUCTOR" << std::endl;

  if (my_xulsword) {

    SWLog::getSystemLog()->logDebug("(FreeLibxulsword) FREEING xulsword");

    delete my_xulsword;
    my_xulsword = NULL;

  }

  SWLog::setSystemLog(NULL);
  xulsword::MySWLogXS = NULL;

  StringMgr::setSystemStringMgr(NULL);
  xulsword::MyStringMgrXS = NULL;

/*
  VersificationMgr::getSystemVersificationMgr(NULL);
  FileMgr::setSystemFileMgr(NULL);
  delete LocaleMgr::systemLocaleMgr;
  LocaleMgr::systemLocaleMgr = NULL;
*/

}
