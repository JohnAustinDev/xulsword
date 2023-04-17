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
xulsword *GetXulsword(char *path, void (*throwJS)(const char *), char *(*toUpperCase)(char *), void (*reportProgress)(int)) {

  my_xulsword = new xulsword(path, throwJS, toUpperCase, reportProgress);

  SWLog::getSystemLog()->logDebug("(c++ GetXulsword) CREATED xulsword object");

  return my_xulsword;
}

void FreeLibxulsword(xulsword *tofree) {
  // Deleting a xulsword object causes unpredictable access violations,
  // so let created xulsword objects live until the end of the process
  // even if they're not referenced any longer. However, an unreferenced
  // xulsword object may still keep locks to NTFS files, so freeLibxulsword
  // is used to release those file locks.
  return my_xulsword->freeLibxulsword();
  /*
  SWLog::getSystemLog()->logDebug("(c++ FreeLibxulsword) FREEING xulsword");
  if (tofree && tofree != my_xulsword) delete tofree;
  else if (my_xulsword) {
    delete my_xulsword;
    my_xulsword = NULL;
  }
  */
}

const char *GetChapterText(const char *vkeymod, const char *vkeytext) {
  return my_xulsword->getChapterText(vkeymod, vkeytext);
}

const char *GetFootnotes() {
  return my_xulsword->getFootnotes();
}

const char *GetCrossRefs() {
  return my_xulsword->getCrossRefs();
}

const char *GetNotes() {
  return my_xulsword->getNotes();
}

const char *GetChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes) {
  return my_xulsword->getChapterTextMulti(vkeymodlist, vkeytext, keepnotes);
}

const char *GetVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes) {
  return my_xulsword->getVerseText(vkeymod, vkeytext, keepnotes);
}

int GetMaxChapter(const char *v11n, const char *vkeytext) {
  return my_xulsword->getMaxChapter(v11n, vkeytext);
}

int GetMaxVerse(const char *v11n, const char *vkeytext) {
  return my_xulsword->getMaxVerse(v11n, vkeytext);
}

const char *GetModuleBooks(const char *mod) {
  return my_xulsword->getModuleBooks(mod);
}

const char *ParseVerseKey(const char *vkeymod, const char *vkeytext) {
  return my_xulsword->parseVerseKey(vkeymod, vkeytext);
}

const char *GetVerseSystem(const char *mod) {
  return my_xulsword->getVerseSystem(mod);
}

const char *ConvertLocation(const char *frVS, const char *vkeytext, const char *toVS) {
  return my_xulsword->convertLocation(frVS, vkeytext, toVS);
}

const char *GetIntroductions(const char *vkeymod, const char *bname) {
  return my_xulsword->getIntroductions(vkeymod, bname);
}

const char *GetDictionaryEntry(const char *lexdictmod, const char *key) {
  return my_xulsword->getDictionaryEntry(lexdictmod, key);
}

const char *GetAllDictionaryKeys(const char *lexdictmod) {
  return my_xulsword->getAllDictionaryKeys(lexdictmod);
}

const char *GetGenBookChapterText(const char *gbmod, const char *treekey) {
  return my_xulsword->getGenBookChapterText(gbmod, treekey);
}

const char *GetGenBookTableOfContents(const char *gbmod) {
  return my_xulsword->getGenBookTableOfContents(gbmod);
}

bool LuceneEnabled(const char *mod) {
  return my_xulsword->luceneEnabled(mod);
}

int Search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch) {
  return my_xulsword->search(mod, srchstr, scope, type, flags, newsearch);
}

const char *GetSearchResults(const char *mod, int first, int num, bool keepStrongs) {
  return my_xulsword->getSearchResults(mod, first, num, keepStrongs, NULL);
}

bool SearchIndexDelete(const char *mod) {
  return my_xulsword->searchIndexDelete(mod);
}

bool SearchIndexBuild(const char *mod) {
  return my_xulsword->searchIndexBuild(mod);
}

void SetGlobalOption(const char *option, const char *setting) {
  return my_xulsword->setGlobalOption(option, setting);
}

const char *GetGlobalOption(const char *option) {
  return my_xulsword->getGlobalOption(option);
}

void SetCipherKey(const char *mod, const char *cipherkey, bool useSecModule) {
  return my_xulsword->setCipherKey(mod, cipherkey, useSecModule);
}

const char* GetModuleList() {
  return my_xulsword->getModuleList();
}

const char *GetModuleInformation(const char *mod, const char *paramname) {
  return my_xulsword->getModuleInformation(mod, paramname);
}
