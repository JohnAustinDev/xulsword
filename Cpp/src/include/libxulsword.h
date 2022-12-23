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

#ifdef WIN32
  #ifdef NODE_GYP_MODULE_NAME
    #define DLLEXPORT extern "C" __declspec(dllimport)
  #else
    #define DLLEXPORT extern "C" __declspec(dllexport)
  #endif
#else
  #define DLLEXPORT extern "C"
#endif

DLLEXPORT xulsword *GetXulsword(char *path, void (*throwJS)(const char *), char *(*toUpperCase)(char *), void (*reportProgress)(int));
DLLEXPORT void FreeLibxulsword(xulsword *tofree = NULL);
DLLEXPORT const char *GetChapterText(const char *vkeymod, const char *vkeytext);
DLLEXPORT const char *GetFootnotes();
DLLEXPORT const char *GetCrossRefs();
DLLEXPORT const char *GetNotes();
DLLEXPORT const char *GetChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes);
DLLEXPORT const char *GetVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes);
DLLEXPORT int GetMaxChapter(const char *v11n, const char *vkeytext);
DLLEXPORT int GetMaxVerse(const char *v11n, const char *vkeytext);
DLLEXPORT const char *GetModuleBooks(const char *mod);
DLLEXPORT const char *ParseVerseKey(const char *vkeymod, const char *vkeytext);
DLLEXPORT const char *GetVerseSystem(const char *mod);
DLLEXPORT const char *ConvertLocation(const char *frVS, const char *vkeytext, const char *toVS);
DLLEXPORT const char *GetIntroductions(const char *vkeymod, const char *bname);
DLLEXPORT const char *GetDictionaryEntry(const char *lexdictmod, const char *key);
DLLEXPORT const char *GetAllDictionaryKeys(const char *lexdictmod);
DLLEXPORT const char *GetGenBookChapterText(const char *gbmod, const char *treekey);
DLLEXPORT const char *GetGenBookTableOfContents(const char *gbmod);
DLLEXPORT const char *GetGenBookTableOfContentsJSON(const char *gbmod);
DLLEXPORT bool LuceneEnabled(const char *mod);
DLLEXPORT int Search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch);
DLLEXPORT const char *GetSearchResults(const char *mod, int first, int num, bool keepStrongs);
DLLEXPORT bool SearchIndexDelete(const char *mod);
DLLEXPORT bool SearchIndexBuild(const char *mod);
DLLEXPORT void SetGlobalOption(const char *option, const char *setting);
DLLEXPORT const char *GetGlobalOption(const char *option);
DLLEXPORT void SetCipherKey(const char *mod, const char *cipherkey, bool useSecModule);
DLLEXPORT const char *GetModuleList();
DLLEXPORT const char *GetModuleInformation(const char *mod, const char *paramname);
