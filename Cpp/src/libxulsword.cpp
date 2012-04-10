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

#ifdef WIN32
#define DLLEXPORT extern "C" __declspec(dllexport)
#else
#define DLLEXPORT extern "C"
#endif

/********************************************************************
EXPORTED INTERFACE FUNCTIONS
*********************************************************************/
DLLEXPORT xulsword *InitSwordEngine(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int)) {
  SWLog::getSystemLog()->setLogLevel(5); // set SWORD log reporting... 5 is all stuff
  xulsword *xsobj = (xulsword *)malloc(sizeof(xulsword));
  xsobj = new xulsword(path, toUpperCase, throwJS, reportProgress);
  return xsobj;
}

DLLEXPORT char *GetChapterText(xulsword *inst, const char *vkeymod, const char *vkeytext) {
  return inst->getChapterText(vkeymod, vkeytext);
}

DLLEXPORT char *GetChapterTextMulti(xulsword *inst, const char *vkeymodlist, const char *vkeytext) {
  return inst->getChapterTextMulti(vkeymodlist, vkeytext);
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

DLLEXPORT char *GetVerseText(xulsword *inst, const char *vkeymod, const char *vkeytext) {
  return inst->getVerseText(vkeymod, vkeytext);
}

DLLEXPORT int GetMaxChapter(xulsword *inst, const char *mod, const char *vkeytext) {
  return inst->getMaxVerse(mod, vkeytext);
}

DLLEXPORT int GetMaxVerse(xulsword *inst, const char *mod, const char *vkeytext) {
  return inst->getMaxVerse(mod, vkeytext);
}

DLLEXPORT char *GetVerseSystem(xulsword *inst, const char *mod) {
  return inst->getVerseSystem(mod);
}

DLLEXPORT char *ConvertLocation(xulsword *inst, const char *frVS, const char *vkeytext, const char *toVS) {
  return inst->convertLocation(frVS, vkeytext, toVS);
}

DLLEXPORT char *GetBookIntroduction(xulsword *inst, const char *vkeymod, const char *bname) {
  return inst->getBookIntroduction(vkeymod, bname);
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

DLLEXPORT bool LuceneEnabled(xulsword *inst, const char *mod) {
  return inst->luceneEnabled(mod);
}

DLLEXPORT int Search(xulsword *inst, const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  return inst->search(mod, srchstr, scope, type, flags, newsearch);
}

DLLEXPORT char *GetSearchTexts(xulsword *inst, const char *mod, int first, int num, bool keepStrongs) {
  return inst->getSearchTexts(mod, first, num, keepStrongs);
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

DLLEXPORT void FreeMemory(void *tofree) {if (tofree) {delete tofree;}}
