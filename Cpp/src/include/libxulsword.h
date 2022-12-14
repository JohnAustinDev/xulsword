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

DLLEXPORT bool GetXulsword(char *path, char *(*toUpperCase)(char *), void (*throwJS)(const char *), void (*reportProgress)(int));
DLLEXPORT char *GetChapterText(const char *vkeymod, const char *vkeytext);
DLLEXPORT char *GetFootnotes();
DLLEXPORT char *GetCrossRefs();
DLLEXPORT char *GetNotes();
DLLEXPORT char *GetChapterTextMulti(const char *vkeymodlist, const char *vkeytext, bool keepnotes);
DLLEXPORT char *GetVerseText(const char *vkeymod, const char *vkeytext, bool keepnotes);
DLLEXPORT int GetMaxChapter(const char *v11n, const char *vkeytext);
DLLEXPORT int GetMaxVerse(const char *v11n, const char *vkeytext);
DLLEXPORT char *GetModuleBooks(const char *mod);
DLLEXPORT char *ParseVerseKey(const char *vkeymod, const char *vkeytext);
DLLEXPORT char *GetVerseSystem(const char *mod);
DLLEXPORT char *ConvertLocation(const char *frVS, const char *vkeytext, const char *toVS);
DLLEXPORT char *GetIntroductions(const char *vkeymod, const char *bname);
DLLEXPORT char *GetDictionaryEntry(const char *lexdictmod, const char *key);
DLLEXPORT char *GetAllDictionaryKeys(const char *lexdictmod);
DLLEXPORT char *GetGenBookChapterText(const char *gbmod, const char *treekey);
DLLEXPORT char *GetGenBookTableOfContents(const char *gbmod);
DLLEXPORT char *GetGenBookTableOfContentsJSON(const char *gbmod);
DLLEXPORT bool LuceneEnabled(const char *mod);
DLLEXPORT int Search(const char *mod, const char *srchstr, const char *scope, int type, int flags, bool newsearch);
DLLEXPORT char *GetSearchResults(const char *mod, int first, int num, bool keepStrongs);
DLLEXPORT void SearchIndexDelete(const char *mod);
DLLEXPORT void SearchIndexBuild(const char *mod);
DLLEXPORT void SetGlobalOption(const char *option, const char *setting);
DLLEXPORT char *GetGlobalOption(const char *option);
DLLEXPORT void SetCipherKey(const char *mod, const char *cipherkey, bool useSecModule);
DLLEXPORT char* GetModuleList();
DLLEXPORT char *GetModuleInformation(const char *mod, const char *paramname);
DLLEXPORT void UncompressTarGz(const char *tarGzPath, const char *aDirPath);
DLLEXPORT char *Translate(const char *text, const char *localeName);
DLLEXPORT void FreeMemory(void *tofree, const char *type);
DLLEXPORT void FreeLibxulsword();
