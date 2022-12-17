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
#include "libxulsword.h"
#include "swlog.h"
#include "stringmgr.h"
#include <iostream>

xulsword *my_xulsword;

/********************************************************************
EXPORTED INTERFACE FUNCTIONS
*********************************************************************/
xulsword *GetXulsword(char *path, char *(*toUpperCase)(char *), void (*reportProgress)(int)) {

  my_xulsword = new xulsword(path, toUpperCase, reportProgress);

  SWLog::getSystemLog()->logDebug("(c++ GetXulsword) CREATED xulsword object");

  return my_xulsword;
}

void FreeLibxulsword(xulsword *tofree) {
  // deleting a xulsword object causes unpredictable access violations,
  // so let created xulsword objects live until the end of the process
  // even if they're not referenced any longer.
  /*
  SWLog::getSystemLog()->logDebug("(c++ FreeLibxulsword) FREEING xulsword");
  if (tofree && tofree != my_xulsword) delete tofree;
  else if (my_xulsword) {
    delete my_xulsword;
    my_xulsword = NULL;
  }
  */
}

char *GetChapterText(const char *vkeymod, const char *vkeytext) {
  return my_xulsword->getChapterText(vkeymod, vkeytext);
}

char *GetFootnotes() {
  return my_xulsword->getFootnotes();
}

char *GetCrossRefs() {
  return my_xulsword->getCrossRefs();
}

char *GetNotes() {
  return my_xulsword->getNotes();
}

char *GetChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes) {
  return my_xulsword->getChapterTextMulti(vkeymodlist, vkeytext, keepnotes);
}

char *GetVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes) {
  return my_xulsword->getVerseText(vkeymod, vkeytext, keepnotes);
}

int GetMaxChapter(const char *v11n, const char *vkeytext) {
  return my_xulsword->getMaxChapter(v11n, vkeytext);
}

int GetMaxVerse(const char *v11n, const char *vkeytext) {
  return my_xulsword->getMaxVerse(v11n, vkeytext);
}

char *GetModuleBooks(const char *mod) {
  return my_xulsword->getModuleBooks(mod);
}

char *ParseVerseKey(const char *vkeymod, const char *vkeytext) {
  return my_xulsword->parseVerseKey(vkeymod, vkeytext);
}

char *GetVerseSystem(const char *mod) {
  return my_xulsword->getVerseSystem(mod);
}

char *ConvertLocation(const char *frVS, const char *vkeytext, const char *toVS) {
  return my_xulsword->convertLocation(frVS, vkeytext, toVS);
}

char *GetIntroductions(const char *vkeymod, const char *bname) {
  return my_xulsword->getIntroductions(vkeymod, bname);
}

char *GetDictionaryEntry(const char *lexdictmod, const char *key) {
  return my_xulsword->getDictionaryEntry(lexdictmod, key);
}

char *GetAllDictionaryKeys(const char *lexdictmod) {
  return my_xulsword->getAllDictionaryKeys(lexdictmod);
}

char *GetGenBookChapterText(const char *gbmod, const char *treekey) {
  return my_xulsword->getGenBookChapterText(gbmod, treekey);
}

char *GetGenBookTableOfContents(const char *gbmod) {
  return my_xulsword->getGenBookTableOfContents(gbmod);
}

char *GetGenBookTableOfContentsJSON(const char *gbmod) {
  return my_xulsword->getGenBookTableOfContentsJSON(gbmod);
}

bool LuceneEnabled(const char *mod) {
  return my_xulsword->luceneEnabled(mod);
}

int Search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  return my_xulsword->search(mod, srchstr, scope, type, flags, newsearch);
}

char *GetSearchResults(const char *mod, int first, int num, bool keepStrongs) {
  return my_xulsword->getSearchResults(mod, first, num, keepStrongs, NULL);
}

void SearchIndexDelete(const char *mod) {
  return my_xulsword->searchIndexDelete(mod);
}

void SearchIndexBuild(const char *mod) {
  return my_xulsword->searchIndexBuild(mod);
}

void SetGlobalOption(const char *option, const char *setting) {
  return my_xulsword->setGlobalOption(option, setting);
}

char *GetGlobalOption(const char *option) {
  return my_xulsword->getGlobalOption(option);
}

void SetCipherKey(const char *mod, const char *cipherkey, bool useSecModule) {
  return my_xulsword->setCipherKey(mod, cipherkey, useSecModule);
}

char* GetModuleList() {
  return my_xulsword->getModuleList();
}

char *GetModuleInformation(const char *mod, const char *paramname) {
  return my_xulsword->getModuleInformation(mod, paramname);
}
