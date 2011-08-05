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

#ifndef XULSWORD_H
#define XULSWORD_H

#include "nsXPCOM.h"
#include "nsIGenericFactory.h"
#include "nsISupportsUtils.h"
#include "nsStringAPI.h"
#include "nsMemory.h"
#include "nsEmbedString.h"
#include "nsCOMPtr.h"
#include "ixulsword.h"

#include "nsDirectoryServiceDefs.h"
#include "nsIServiceManager.h"
#include "nsIProperties.h"
#include "nsIFile.h"

#include "swmgr.h"
#include "swmodule.h"
#include "versekey.h"
#include "treekeyidx.h"
#include "strkey.h"
#include <markupfiltmgr.h>

#include <swlog.h>

#define MAXSTRING 1000
#define MAXDICTSIZE 20000 /*ISBE is 9350 entries*/
#define MODVERSION "xulswordVersion"
#define NOTFOUND "Not Found"

#define XULSWORD_CONTRACTID "@xulsword.com/xulsword/xulsword;1"
#define XULSWORD_CLASSNAME "SWORD implementation"
#define XULSWORD_CID \
{ 0x5503a97b, 0x6198, 0x49f6, \
{ 0x99, 0x25, 0x56, 0xe1, 0x04, 0x88, 0x02, 0xca}}

#define WESTERN "KJV"
#define EASTERN "EASTERN" // DEPRICATED verse system used by pre sword-1.6.1 built modules
#define SYNODAL "Synodal"  // can be used by strstr to match SynodalProt, SynodalP, Synodal0, and Synodal
#define VSERROR 99

#ifndef NO_SWORD_NAMESPACE
using namespace sword;
#endif

#ifndef NOSECURITY
#include "security.h"
security Security;
#endif

struct w2emap
{
	const char *west;
	const char *east;
};

/* Header file */
class xulsword: public ixulsword
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IXULSWORD

  xulsword();

  static nsEmbedString ChapterW;	//Holds current global chapter
  static PRUint16 VerseW;			    //Holds current global verse number
  static PRUint16 LastVerseW;		  //Holds current global verse highlight end
  static nsEmbedString ChapterE;  //Holds current global chapter
  static PRUint16 VerseE;         //Holds current global verse number
  static PRUint16 LastVerseE;     //Holds current global verse highlight end
  static bool Footnotes;          //Holds global settings
  static bool Headings;
  static bool Crossrefs;
  static bool Dictionary;
  static bool Redwords;
  static bool Versenumbers;
  static bool HebrewPoints;
  static bool Cantillation;
  static bool Strongs;
  static bool Morph;
  static bool MorphSeg;
   
private:
  ~xulsword();
   nsEmbedCString GetFolderContents(TreeKey *key, const char *modname);
   void updateGlobalOptions(SWMgr * manager, bool disableFootCross = false);
   void mapVersifications(VerseKey *vkin, VerseKey *vkout);
   const char *getVerseSystemOfModule(const char * mod);
   int locationToVerseKey(const char *locationText, VerseKey *vk);
   int textToMaxVerse(const char *vkeytext, VerseKey *vkey);
   void keyToStaticVars(VerseKey *key, nsEmbedString *chapter, PRUint16 *verse, PRUint16 *lastverse);
   void xulStringToUTF16(nsEmbedCString *xstring, nsEmbedString *utf16, signed char encoding=ENC_UTF8, bool append = false);
   void xulStringToUTF16(char *xstring, nsEmbedString *utf16, signed char encoding=ENC_UTF8, bool append = false);
   
#ifndef NOSECURITY
   security InstSecurity;
#endif
   
protected:
  /* additional members */
  SWMgr *MyManager;				//Global Module Manager
  ModMap::iterator modIterator;	//Iterator for modules

  VerseKey EmptyKey;			//Used to replace Persist-ed keys in module
  ListKey SearchList;			//Used to hold all search results

  nsEmbedString MyFootnotes;
  nsEmbedString MyCrossRefs;
  nsEmbedString MyNotes;

  nsEmbedString MySearchVerses;
  nsEmbedString MySearchTexts;
  
  int setchaptervers;
  
  SWFilter * OSISHTMLXUL_p;			//Will point to this filter if created
  SWFilter * ThMLHTMLXUL_p;
  SWFilter * GBFHTMLXUL_p;

  nsresult rv;

  char Outtext[256];

  const char *searchedvers;
  
  typedef std::map < SWBuf, SWBuf, std::less < SWBuf > > AttributeValue;

  static struct w2emap West2EastMap[];
  
  int PercentComplete;
  
  char DefaultVersificationSystem[64];
};

#endif
