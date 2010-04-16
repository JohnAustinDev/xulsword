/*  This file is part of Muqaddas Kitob.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    Muqaddas Kitob is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    Muqaddas Kitob is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Muqaddas Kitob.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
Bugs:
MK RELATED
Crashed one time when choosing Ps 114 (could be caused by xulrunner!)

MODULE RELATED
CARS intro doesn't always work! (1Cor)

Notes - EASTERN vs SynodalProt:
  EASTERN - 
      Encrypted
      Includes ESV cross references, Scripture references or dictionary links.
      No verse linking
      Verse system is unique to MK (NT books are in wrong order, internally)
      Works on ALL versions of MK, but not with other SWORD programs.
  SynodalProt-
      Not encrypted?
      No ESV cross references, Scripture references or dictionary links?
      Uses verse linking.
      Verse system is compiled into all new SWORD engines.
      Works on new versions of MK (2.13+), and on all other updated SWORD programs.
      Needs minMKVersion=2.13. 
*/

#include "windows.h"

#define MOZILLA_STRICT_API

#include "xulsword.h"
#ifndef NO_SWORD_NAMESPACE
using namespace sword;
#endif
#include <dirent.h>

#include <stdio.h>
#include <string>
#include <iostream>

#ifndef NOSECURITY
#include "security.h"
#endif

#include "versemaps.h"

#define MAPLEN 2697
// 2714

/* Implementation file */
NS_IMPL_ISUPPORTS1(xulsword, ixulsword)

/********************************************************************
percentUpdate 
*********************************************************************/
void percentUpdate(char percent, void *userData) {}


/********************************************************************
xulStringToUTF16 
*********************************************************************/
void xulsword::xulStringToUTF16(nsEmbedCString *xstring, nsEmbedString *utf16, signed char encoding, bool append) {
  if      (encoding == ENC_UTF8)   {
    if (append) {utf16->Append(NS_ConvertUTF8toUTF16(*xstring));}
    else {utf16->Assign(NS_ConvertUTF8toUTF16(*xstring));}
  }
  else if (encoding == ENC_LATIN1) {
    if (append) {utf16->Append(NS_ConvertASCIItoUTF16(*xstring));}
    else {utf16->Assign(NS_ConvertASCIItoUTF16(*xstring));}
  }
  else {
    /* Note: ENC_SCSU is currently not supported */
    printf("ERROR: Encoding not supported!\n");
  }
  return;
}

void xulsword::xulStringToUTF16(char * xstring, nsEmbedString *utf16, signed char encoding, bool append) {
  if      (encoding == ENC_UTF8)   {
    if (append) {utf16->Append(NS_ConvertUTF8toUTF16(xstring));}
    else {utf16->Assign(NS_ConvertUTF8toUTF16(xstring));}
  }
  else if (encoding == ENC_LATIN1) {
    if (append) {utf16->Append(NS_ConvertASCIItoUTF16(xstring));}
    else {utf16->Assign(NS_ConvertASCIItoUTF16(xstring));}
  }
  else {
    /* Note: ENC_SCSU is currently not supported */
    printf("ERROR: Encoding not supported!\n");
  }
  return;
}

/********************************************************************
GetFolderContents 
*********************************************************************/
#define ROOTRDF "http://www.xulsword.com/tableofcontents/ContentsRoot"
nsEmbedCString xulsword::GetFolderContents(TreeKey *key, const char *modname, bool isRoot) {
  char buffer[1024];
  nsEmbedCString retval;
  if (isRoot) {
    sprintf(buffer, "\t<RDF:Bag RDF:about=\"rdf:#%s\">\n\t\t<RDF:li RDF:resource=\"rdf:#/%s\" />\n\t</RDF:Bag>\n\n",
          ROOTRDF,
          modname);
    retval.Append(buffer);
    sprintf(buffer, "\t<RDF:Description RDF:about=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s\" \n\t\t\tTABLEOFCONTENTS:Type=\"folder\" \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" />\n",
          modname,
          key->getText(),
          modname);
    retval.Append(buffer);
  }
  sprintf(buffer, "\t<RDF:Seq RDF:about=\"rdf:#/%s%s\">\n", modname, (isRoot ? "":key->getText()));
  retval.Append(buffer);
  
  nsEmbedCString subfolders;
  nsEmbedCString descriptions;
  
  bool ok;
  bool isChild=false;
  for (ok = key->firstChild(); ok; ok = key->nextSibling()) {
    isChild=true;
    sprintf(buffer, "\t\t<RDF:li RDF:resource=\"rdf:#/%s%s\" />\n", modname, key->getText());
    retval.Append(buffer);
    sprintf(buffer, "\t<RDF:Description RDF:about=\"rdf:#/%s%s\" \n\t\t\tTABLEOFCONTENTS:Chapter=\"rdf:#/%s%s\" \n\t\t\tTABLEOFCONTENTS:Type=\"%s\" \n\t\t\tTABLEOFCONTENTS:Name=\"%s\" />\n", 
          modname,
          key->getText(),
          modname,
          key->getText(), 
          (key->hasChildren() ? "folder":"key"), 
          key->getLocalName());
          
    descriptions.Append(buffer);
    
    if (key->hasChildren()) {
      sprintf(buffer, "%s", key->getLocalName());
      subfolders.Append(GetFolderContents(key, modname, false).get());
      key->setLocalName(buffer);
    }
  }
  if (isChild) {key->parent();}
  
  retval.Append("\t</RDF:Seq>\n\n");
  retval.Append(descriptions.get());
  retval.Append(subfolders.get());

  return retval;
}


/********************************************************************
updateGlobalOptions 
*********************************************************************/
void xulsword::updateGlobalOptions(SWMgr * manager, bool disableFootCrossRed) {
  manager->setGlobalOption("Headings",xulsword::Headings ? "On":"Off");
  manager->setGlobalOption("Footnotes",xulsword::Footnotes && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Cross-references",xulsword::Crossrefs && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Dictionary",xulsword::Dictionary ? "On":"Off");
  manager->setGlobalOption("Words of Christ in Red",xulsword::Redwords && !disableFootCrossRed ? "On":"Off");
  manager->setGlobalOption("Hebrew Vowel Points",xulsword::HebrewPoints ? "On":"Off");
  manager->setGlobalOption("Hebrew Cantillation",xulsword::Cantillation ? "On":"Off");
  manager->setGlobalOption("Strong's Numbers",xulsword::Strongs ? "On":"Off");
  manager->setGlobalOption("Morphological Tags",xulsword::Morph ? "On":"Off");
  manager->setGlobalOption("Morpheme Segmentation",xulsword::MorphSeg ? "On":"Off");
}

/********************************************************************
mapVersifications 
*********************************************************************/
// Reads an input key and sets the output key to the same verse in opposing verse system.
// If upper bound is set on input key, then converted upper bound will be set on output key
void xulsword::mapVersifications(VerseKey *vkin, VerseKey *vkout) {
  const char *inVerseSystem = vkin->getVersificationSystem();
	
  vkout->setVersificationSystem(!strcmp(inVerseSystem, WESTERN) ? EASTERN:WESTERN);
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
textToMaxVerse 
*********************************************************************/
// Takes vkeytext and versification, and returns max verse of chapter, plus inits vkey to vkeytext (with vmax).
int xulsword::textToMaxVerse(const char *vkeytext, VerseKey *vkey) {
  locationToVerseKey(vkeytext, vkey);
  return (PRInt32)vkey->getVerseMax();
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
int xulsword::locationToVerseKey(const char *locationText, VerseKey *vk) {
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
keyToStaticVars 
*********************************************************************/
// Assign a set of static verse locations from a key
void xulsword::keyToStaticVars(VerseKey *key, nsEmbedString *chapter, PRUint16 *verse, PRUint16 *lastverse) {
  SWBuf chapterText;
  chapterText.appendFormatted("%s %i", key->getBookAbbrev(), key->Chapter());
  chapter->Assign(NS_ConvertUTF8toUTF16(chapterText.c_str()));
  *verse = (PRInt16)key->Verse();
  if (key->isBoundSet()) {*lastverse = (PRInt16)key->UpperBound().Verse();}
  else {*lastverse = (PRInt16)key->Verse();}
//printf("SETTING TO: %s:%i-%i\n", NS_ConvertUTF16toUTF8(*chapter).get(), *verse, *lastverse);
}

/********************************************************************
getVerseSystemOfModule
*********************************************************************/
// Returns DefaultVersificationSystem if verse system cannot be determined.
const char *xulsword::getVerseSystemOfModule(const char * mod) {
  if (!mod) return DefaultVersificationSystem;
  SWModule * module = MyManager.getModule(mod);
  if (!module) {return DefaultVersificationSystem;}
  VerseKey *vkey;
  vkey = SWDYNAMIC_CAST(VerseKey, module->getKey());

  if (!vkey) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&module->getConfig());
    ConfigEntMap::iterator it = infoConfig->find("Versification");
    if (it != infoConfig->end()) {return it->second.c_str();}
    else {return DefaultVersificationSystem;}
  }

  return vkey->getVersificationSystem();
}

/********************************************************************
xulsword::xulsword()
*********************************************************************/
xulsword::xulsword()
{
//printf("INITIALIZING XULSWORD OBJECT\n");
  /* member initializers and constructor code */
  
  sprintf(DefaultVersificationSystem, "KJV");  
  
  //Initialize all modules
  OSISHTMLXUL_p =   new OSISHTMLXUL();
  ThMLHTMLXUL_p =   new ThMLHTMLXUL();
  GBFHTMLXUL_p =    new GBFHTMLXUL();
  RTFHTML_p =       new RTFHTML();
  OSISPlainXUL_p =  new OSISPlainXUL();
  TEIPlain_p =      new TEIPlain();
  PLAINHTML_p =     new PLAINHTML();

  for (modIterator = MyManager.Modules.begin(); modIterator != MyManager.Modules.end(); modIterator++) {
    SWModule *module = (*modIterator).second;
    if      (module->Markup() == FMT_OSIS)   module->AddRenderFilter(OSISHTMLXUL_p);
    else if (module->Markup() == FMT_PLAIN)  module->AddRenderFilter(PLAINHTML_p);
    else if (module->Markup() == FMT_THML)   module->AddRenderFilter(ThMLHTMLXUL_p);
    else if (module->Markup() == FMT_GBF)    module->AddRenderFilter(GBFHTMLXUL_p);
    else if (module->Markup() == FMT_RTF)    module->AddRenderFilter(RTFHTML_p);
    //if (module->Markup() == FMT_WEBIF) module->AddRenderFilter();
    else if (module->Markup() == FMT_TEI) {
      module->AddRenderFilter(TEIPlain_p);
      module->AddRenderFilter(PLAINHTML_p);
    }
    //printf("Module: %s, Type: %s, Markup: %i\n", module->Name(), module->Type(), module->Markup());
  }
}

/********************************************************************
xulsword::~xulsword()
*********************************************************************/
xulsword::~xulsword()
{
  /* destructor code */
  delete OSISHTMLXUL_p;
  delete ThMLHTMLXUL_p;
  delete GBFHTMLXUL_p;
  delete RTFHTML_p;
  delete OSISPlainXUL_p;
  delete TEIPlain_p;
  delete PLAINHTML_p;
}

/********************************************************************
SetBiblesReference
*********************************************************************/
/*  Determines verse system from mod parameter
    Assigns all static location varsiables
    Returns versification which was used when assigning chapter */
NS_IMETHODIMP xulsword::SetBiblesReference(const nsACString & Mod, const nsAString & Vkeytext, nsAString & _retval NS_OUTPARAM)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  // Determine which verse system is being used
  const char *versification = getVerseSystemOfModule(mod);
  VerseKey fromKey;
  fromKey.setVersificationSystem(versification);
  locationToVerseKey(NS_ConvertUTF16toUTF8(Vkeytext).get(), &fromKey);
  VerseKey toKey;
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

  nsEmbedCString vsystem;
  nsEmbedString retval;
  vsystem.Assign(versification);
  xulStringToUTF16(&vsystem, &retval, ENC_UTF8, false);
  _retval = retval;
  return NS_OK;
}


/********************************************************************
SetVerse
*********************************************************************/
/*  Determines verse system from mod parameter
    Assigns Verse and LastVerse static variables
    If firstverse or lastverse params are -1, maxverse is used  
    LastVerse is always greater than Verse
    Returns versification which was used when assigning chapter  */
NS_IMETHODIMP xulsword::SetVerse(const nsACString & Mod, PRInt32 firstverse, PRInt32 lastverse, nsAString & _retval NS_OUTPARAM)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  firstverse = (int)firstverse;
  lastverse  = (int)lastverse;
  // Determine which verse system is being used
  const char *versification = getVerseSystemOfModule(mod);

  // Get maxverse and fromKey
  nsEmbedString * Chapter;
  !strcmp(versification, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  VerseKey fromKey;
  fromKey.setVersificationSystem(versification);
  int maxverse = textToMaxVerse(NS_ConvertUTF16toUTF8(*Chapter).get(), &fromKey);
  fromKey.ClearBounds(); // otherwise, can't setVerse without error!
  
  // This routine checks the verse number and makes sure it exists, 
  // and if too small or to large sets to legal value (1 or v-max)
  // If verse is -1 this results in maxverse.
  if ((firstverse == -1)||(firstverse > maxverse)) {firstverse = maxverse;}
  else if (firstverse <= 0) {firstverse = 1;}
  if ((lastverse == -1)||(lastverse > maxverse)) {lastverse = maxverse;}
  else if (lastverse <= 0) {lastverse = 1;}
  if (lastverse < firstverse) {lastverse = firstverse;}
  
  // Set adjusted bounds
  fromKey.setVerse(firstverse);
  VerseKey ub;
  ub.copyFrom(fromKey);
  ub.setVerse(lastverse);
  fromKey.UpperBound(ub);
  
  // Map to other verse systems too
  VerseKey toKey;
  mapVersifications(&fromKey, &toKey);
  
  // Save map results
  if (!strcmp(versification, WESTERN)) {
    keyToStaticVars(&fromKey, &ChapterW, &VerseW, &LastVerseW);
    keyToStaticVars(&toKey, &ChapterE, &VerseE, &LastVerseE); 
  }
  else {
    keyToStaticVars(&fromKey, &ChapterE, &VerseE, &LastVerseE);
    keyToStaticVars(&toKey, &ChapterW, &VerseW, &LastVerseW); 
  }
//printf("SetVerse:\nSTATIC LOCATION:\n\tWESTERN = %s:%i-%i\n\tEASTERN = %s:%i-%i\n", NS_ConvertUTF16toUTF8(ChapterW).get(), VerseW, LastVerseW, NS_ConvertUTF16toUTF8(ChapterE).get(), VerseE, LastVerseE);    
  nsEmbedCString vsystem;
  nsEmbedString retval;
  vsystem.Assign(versification);
  xulStringToUTF16(&vsystem, &retval, ENC_UTF8, false);
  _retval = retval;
  return NS_OK;
}


/********************************************************************
GetChapter
*********************************************************************/
NS_IMETHODIMP xulsword::GetChapter(const nsACString & Mod, nsAString & _retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  const char *versification = getVerseSystemOfModule(mod);
  
  nsEmbedString * Chapter;
  !strcmp(versification, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  _retval = *Chapter;

  return NS_OK;
}


/********************************************************************
GetBookName
*********************************************************************/
NS_IMETHODIMP xulsword::GetBookName(nsAString & _retval)
{
  std::string chapter;
  std::string book;
  
  chapter.assign(NS_ConvertUTF16toUTF8(ChapterW).get());

  int space = chapter.find(' ',0);
  book.assign(chapter.substr(0,space));
  nsEmbedString bookname;
  bookname.Assign(NS_ConvertUTF8toUTF16(book.c_str()));

  _retval = bookname;

  return NS_OK;
}


/********************************************************************
GetVerseNumber
*********************************************************************/
NS_IMETHODIMP xulsword::GetVerseNumber(const nsACString & Mod, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  const char *versification = getVerseSystemOfModule(mod);
  *_retval = (!strcmp(versification, WESTERN) ? VerseW:VerseE);

  return NS_OK;
}


/********************************************************************
GetLastVerseNumber
*********************************************************************/
NS_IMETHODIMP xulsword::GetLastVerseNumber(const nsACString & Mod, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  const char *versification = getVerseSystemOfModule(mod);
  
  *_retval = (!strcmp(versification, WESTERN) ? LastVerseW:LastVerseE);

  return NS_OK;
}


/********************************************************************
GetChapterNumber
*********************************************************************/
NS_IMETHODIMP xulsword::GetChapterNumber(const nsACString & Mod, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  const char *versification = getVerseSystemOfModule(mod);

  VerseKey myVerseKey;
  myVerseKey.setVersificationSystem(versification);

  nsEmbedString * Chapter;
  !strcmp(versification, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  myVerseKey.setText(NS_ConvertUTF16toUTF8(*Chapter).get());

  *_retval = myVerseKey.Chapter();

  return NS_OK;
}


/********************************************************************
GetLocation
*********************************************************************/
NS_IMETHODIMP xulsword::GetLocation(const nsACString & Mod, nsAString & _retval)
{
  nsEmbedString bk;
  PRInt32 ch,vs,lv;
  if (GetBookName(bk)              != NS_OK) {return NS_ERROR_FAILURE;}
  if (GetChapterNumber(Mod, &ch)   != NS_OK) {return NS_ERROR_FAILURE;}
  if (GetVerseNumber(Mod, &vs)     != NS_OK) {return NS_ERROR_FAILURE;}
  if (GetLastVerseNumber(Mod, &lv) != NS_OK) {return NS_ERROR_FAILURE;}
  
  SWBuf location;
  location.appendFormatted("%s.%i.%i.%i", NS_ConvertUTF16toUTF8(bk).get(), ch, vs, lv);
  
  nsEmbedString ret;
  ret.Assign(NS_ConvertUTF8toUTF16(location.c_str()));
  _retval = ret;
  
  return NS_OK;
}



/********************************************************************
GetChapterText
*********************************************************************/
NS_IMETHODIMP xulsword::GetChapterText(const nsACString & Vkeymod, nsAString & _retval)
{
  nsEmbedCString chapText;
  nsEmbedCString verseText;
  nsEmbedCString footnoteText;
  nsEmbedCString crossRefText;
  nsEmbedCString noteText;
  nsEmbedString * Chapter;
  
  const char * vkeymod;
  NS_CStringGetData(Vkeymod, &vkeymod);

  SWModule * module = MyManager.getModule(vkeymod);
  if (!module) {return NS_ERROR_FAILURE;}
  
  SWKey *testkey = module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    return NS_ERROR_ILLEGAL_VALUE;
  }
  myVerseKey->Persist(1);
  myVerseKey->setAutoNormalize(0); // Non-existant calls should return empty string
  module->setKey(myVerseKey);

  updateGlobalOptions(&MyManager);
  module->setSkipConsecutiveLinks(true);
  
  //Initialize Key
  !strcmp(myVerseKey->getVersificationSystem(), WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  myVerseKey->setText(NS_ConvertUTF16toUTF8(*Chapter).get());
  
  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->UpperBound(ub);

  //Is this a Commentary??
  bool isCommentary = !strcmp(module->Type(), "Commentaries");

  //NOW READ ALL VERSES IN THE CHAPTER
  PRUint16 * Verse;
  PRUint16 * LastVerse;
  if (!strcmp(myVerseKey->getVersificationSystem(), WESTERN)) {
		Verse = &VerseW; 
		LastVerse = &LastVerseW;
  }
  else {
    Verse = &VerseE;
		LastVerse = &LastVerseE;
  }

  bool haveText = false;
  while (!module->Error()) {
    int vNum = myVerseKey->Verse();
    if (vNum>1 && vNum == *Verse) {MyManager.setGlobalOption("Words of Christ in Red","Off");}
    else if (vNum == (*LastVerse + 1)) {MyManager.setGlobalOption("Words of Christ in Red", Redwords ? "On":"Off");}
    verseText.Assign(module->RenderText()); //THIS MUST BE RENDERED BEFORE READING getEntryAttributes!!!
  
    // move verse number after any paragraph indents
    bool verseStartsWithIndent = false;
    if (!strncmp(verseText.get(),"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;",30)) {
      verseStartsWithIndent = true;
      verseText.Cut(0,30);
    }
    haveText = haveText || *verseText.get();

	
    //SAVE ANY FOOTNOTES
    int fnV = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = module->getEntryAttributes()["Footnote"].begin(); AtIndex != module->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      if ((AtIndex->second["type"] == "crossReference")||(AtIndex->second["type"] == "x-cross-ref")) {
        sprintf(Outtext, "cr.%d.%s<bg/>", fnV, myVerseKey->getOSISRef());
		    crossRefText.Append(Outtext);
		    crossRefText.Append(AtIndex->second["refList"]);
		    crossRefText.Append("<nx/>");
		    noteText.Append(Outtext);
		    noteText.Append(AtIndex->second["refList"]);
		    noteText.Append("<nx/>");
		  }
		  else {
		    sprintf(Outtext, "fn.%d.%s<bg/>", fnV, myVerseKey->getOSISRef());
		    footnoteText.Append(Outtext);
		    footnoteText.Append(AtIndex->second["body"]);
		    footnoteText.Append("<nx/>");
		    noteText.Append(Outtext);
		    noteText.Append(AtIndex->second["body"]);
		    noteText.Append("<nx/>");
		  }
		  fnV++;
    }

    //FIRST PRINT OUT ANY HEADINGS IN THE VERSE
    AttributeValue::iterator Value;
    for (Value = module->getEntryAttributes()["Heading"]["Preverse"].begin(); Value != module->getEntryAttributes()["Heading"]["Preverse"].end(); Value++) {
		  chapText.Append("<br><div class=\"");
      if (module->getEntryAttributes()["Heading"][Value->first]["level"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["level"], "2")) {
        chapText.Append("head2");
      }
      else {chapText.Append("head1");}
      if (module->getEntryAttributes()["Heading"][Value->first]["canonical"] && !strcmp(module->getEntryAttributes()["Heading"][Value->first]["canonical"], "true")) {
        chapText.Append(" canonical");
      }
      chapText.Append("\">");
		  chapText.Append(Value->second);
		  chapText.Append("</div>");
    }
	
    //NOW PRINT OUT THE VERSE ITSELF
    //If this is selected verse then designate as so
    //Output verse html code
    sprintf(Outtext, "<span id=\"vs.%d\">", vNum); 
    chapText.Append(Outtext);

    if (vNum==*Verse) {chapText.Append("<span id=\"sv\" class=\"hl\">");}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {chapText.Append("<span class=\"hl\">");}

    if (verseStartsWithIndent) {chapText.Append("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;");}
  
    chapText.Append("<sup class=\"versenum\">");
    //If verse is non-empty and verse numbers are being displayed then print the verse number
    if (Versenumbers && (verseText.Length() > 0)) {
		  sprintf(Outtext, "%d", vNum); 
		  chapText.Append(Outtext);
		  chapText.Append("</sup>");
    }
    else {chapText.Append("</sup> ");}
    
    chapText.Append(verseText.get());
    if (isCommentary) {chapText.Append("<br><br>");}

    if(vNum==*Verse) {chapText.Append("</span>");}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {chapText.Append("</span>");}

    chapText.Append("</span>");

    module->increment(1);
  }
  module->setKey(EmptyKey);

  nsEmbedString chapText16;
  if (!haveText) {chapText16.Assign(NS_ConvertUTF8toUTF16(""));}
  else {xulStringToUTF16(&chapText, &chapText16, module->Encoding(), false);}
  xulStringToUTF16(&footnoteText, &MyFootnotes, module->Encoding(), false);
  xulStringToUTF16(&crossRefText, &MyCrossRefs, module->Encoding(), false);
  xulStringToUTF16(&noteText, &MyNotes, module->Encoding(), false);

  delete(testkey);
  _retval = chapText16;
  return NS_OK;
}


/********************************************************************
GetChapterTextMulti
*********************************************************************/
NS_IMETHODIMP xulsword::GetChapterTextMulti(const nsACString & Vkeymodlist, nsAString & _retval)
{
  nsEmbedString * Chapter;
  PRUint16 * Verse;
	PRUint16 * LastVerse;
	
  const char * vkeymodlist;
  NS_CStringGetData(Vkeymodlist, &vkeymodlist);
  
  updateGlobalOptions(&MyManager, true);
  MyManager.setGlobalOption("Words of Christ in Red","Off"); // Words of Christ in Red is off for multidisplay

	std::string modstr;
	modstr.assign(vkeymodlist);
	int comma = modstr.find(',',0);
	std::string thismod;
	thismod.assign(modstr.substr(0,comma));
	if (comma == std::string::npos) {return NS_ERROR_ILLEGAL_VALUE;}
	
	SWModule * module = MyManager.getModule(thismod.c_str());
  if (!module) {return NS_ERROR_FAILURE;}
  
  SWKey *testkey1 =  module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey1);
  if (!myVerseKey) {
    delete(testkey1);
    return NS_ERROR_ILLEGAL_VALUE;
  }

  const char *modvers = myVerseKey->getVersificationSystem();

  !strcmp(modvers, WESTERN) ? Chapter = &ChapterW : Chapter = &ChapterE;
  myVerseKey->setText(NS_ConvertUTF16toUTF8(*Chapter).get());
  
  VerseKey ub;
  ub.copyFrom(myVerseKey);
  ub.setVerse(ub.getVerseMax());
  myVerseKey->UpperBound(ub);

	if (!strcmp(modvers, WESTERN)) {
		Verse = &VerseW; 
		LastVerse = &LastVerseW;
	}
	else {
 		Verse = &VerseE;
		LastVerse = &LastVerseE;
	}
	
/*
  <div class="interB>
  
    [<span class="hl" [id="sv"]>]
    <div class="interV1">
      <sup class="versnum">5</sup>
      <span id="vs.5.1">Some verse text from module 1.</span>
    </div>
    
    <div class="interS"></div>
    
    <div class="interV2">
      <sup class="versnum">5</sup>
      <span id="vs.5.2">Some verse text from module 2.</span>
    </div>
    [</span>]
    
  </div>
*/

  //NOW READ ALL VERSES IN THE CHAPTER
  nsEmbedString chapText16;
  SWModule * versemod;
  bool haveText = false;
  while (!myVerseKey->Error()) {
    int vNum = myVerseKey->Verse();
    
    // Each verse group has its own div with a class
    xulStringToUTF16("<div class=\"interB\">", &chapText16, ENC_UTF8, true);
    
    //If this is the selected verse group then designate as so
    if(vNum==*Verse) {xulStringToUTF16("<span id=\"sv\" class=\"hl\">", &chapText16, ENC_UTF8, true);}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {xulStringToUTF16("<span class=\"hl\">", &chapText16, ENC_UTF8, true);}
    
    int versionNum = 1;
    modstr.assign(vkeymodlist);
    do {
      // each version is separated by a separator that has a class
      if (versionNum > 1) {xulStringToUTF16("<div class=\"interS\"></div>", &chapText16, ENC_UTF8, true);}
      
      // each version has its own unique class ID
      sprintf(Outtext, "<div class=\"interV%d\">", versionNum);
      xulStringToUTF16(Outtext, &chapText16, ENC_UTF8, true);
      xulStringToUTF16("<sup class=\"versenum\">", &chapText16, ENC_UTF8, true);
      if (Versenumbers) {
      	sprintf(Outtext, "%d",vNum); 
      	xulStringToUTF16(Outtext, &chapText16, ENC_UTF8, true);
      }
      sprintf(Outtext,"</sup><span id=\"vs.%d.%d\">", vNum, versionNum++);
      xulStringToUTF16(Outtext, &chapText16, ENC_UTF8, true);
      
      comma = modstr.find(',',0);
      thismod.assign(modstr.substr(0,comma));
      if (comma != std::string::npos) {modstr.assign(modstr.substr(comma+1));}
      
      versemod = MyManager.getModule(thismod.c_str());
      if (!versemod) {break;}
      
      SWKey *testkey2 = versemod->CreateKey();
      VerseKey *mainkey = SWDYNAMIC_CAST(VerseKey, testkey2);
      if (!mainkey) {
        delete(testkey2);
        break;
      }
      const char * toVS = mainkey->getVersificationSystem();
      delete(testkey2);
      
      VerseKey readKey;
      readKey.copyFrom(myVerseKey);
      readKey.setAutoNormalize(0); // Non-existant calls should return empty string!
      const char * frVS = readKey.getVersificationSystem();
      if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || !strcmp(toVS,SYNODALPRO))) || 
          (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || !strcmp(frVS,SYNODALPRO)))) {
        VerseKey convertKey;
        convertKey.copyFrom(readKey);
        mapVersifications(&convertKey, &readKey);
      }
      versemod->SetKey(readKey);
      
      nsEmbedCString tmp;
      if (!versemod->Error()) {tmp.Assign(versemod->RenderText());}
      xulStringToUTF16(&tmp, &chapText16, versemod->Encoding(), true);
      haveText = haveText || tmp.get();
      
      xulStringToUTF16("</span></div>", &chapText16, ENC_UTF8, true);
    } while (comma != std::string::npos);
    
    if (vNum==*Verse) {xulStringToUTF16("</span>", &chapText16, ENC_UTF8, true);}
    else if ((vNum > *Verse)&&(vNum <= *LastVerse)) {xulStringToUTF16("</span>", &chapText16, ENC_UTF8, true);}
    xulStringToUTF16("</div>", &chapText16, ENC_UTF8, true);
    
    myVerseKey->increment(1);
  }

  if (!haveText) {chapText16.Assign(NS_ConvertUTF8toUTF16(""));}

  // Return Words of Christ in Red feature to original value
  MyManager.setGlobalOption("Words of Christ in Red",xulsword::Redwords ? "On":"Off");
  
  delete(testkey1);
  _retval = chapText16;
  return NS_OK;
}


/********************************************************************
GetVerseText
*********************************************************************/
NS_IMETHODIMP xulsword::GetVerseText(const nsACString & Vkeymod, const nsAString & Vkeytext, nsAString & _retval)
{
  const char * vkeymod;
  NS_CStringGetData(Vkeymod, &vkeymod);
  
  SWModule * module = MyManager.getModule(vkeymod);
  if (!module) {return NS_ERROR_FAILURE;}
  
  SWKey *testkey = module->CreateKey();
  VerseKey *myVerseKey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!myVerseKey) {
    delete(testkey);
    return NS_ERROR_ILLEGAL_VALUE;
  }
  myVerseKey->Persist(1);
  module->setKey(myVerseKey);
  
  MyManager.setGlobalOption("Headings","Off");
  MyManager.setGlobalOption("Footnotes","Off");
  MyManager.setGlobalOption("Cross-references","Off");
  MyManager.setGlobalOption("Dictionary","Off");
  MyManager.setGlobalOption("Words of Christ in Red","Off");
  MyManager.setGlobalOption("Strong's Numbers","Off");
  MyManager.setGlobalOption("Morphological Tags","Off");
  MyManager.setGlobalOption("Morpheme Segmentation","Off");

  nsEmbedCString bText;
//myVerseKey->setText(NS_ConvertUTF16toUTF8(ChapterW).get());
//printf("mod=%s, set=%s, key=%s\n", module->Name(), NS_ConvertUTF16toUTF8(ChapterW).get(), myVerseKey->getShortText());
  locationToVerseKey(NS_ConvertUTF16toUTF8(Vkeytext).get(), myVerseKey);
  int numverses = 176; // set to max verses of any chapter
  while (!myVerseKey->Error())
  {
    SWBuf vtext = module->StripText();
    const char * vt = vtext.c_str();
    bool printChars = false;
    // trim() locks up if string is only white space! (sword 1.5.9)
    for (const char * vt = vtext.c_str(); *vt; vt++) {
      if (strchr("\t\r\n ", *vt)==NULL) {printChars=true; break;}
    }
    if (printChars) {
      vtext.trim();
      bText.Append(vtext.c_str());
      bText.Append(" ");
    }
    myVerseKey->increment(1);
    if (--numverses == 0) {break;}
  }
  module->setKey(EmptyKey);
  
  nsEmbedString retval;
  xulStringToUTF16(&bText, &retval, module->Encoding(), false);

  delete(testkey);
  _retval = retval;
  return NS_OK;
}


/* void setGlobalOption (in string fil); */
NS_IMETHODIMP xulsword::SetGlobalOption(const nsACString & Option, const nsACString & Setting)
{
  const char * option;
  NS_CStringGetData(Option, &option);
  
  const char * setting;
  NS_CStringGetData(Setting, &setting);

	bool * thisOption;

	// Find which global option we are updating
	if		(!strcmp(option,"Headings"))				{thisOption = &Headings;}
	else if (!strcmp(option,"Footnotes"))				{thisOption = &Footnotes;}
	else if (!strcmp(option,"Cross-references"))		{thisOption = &Crossrefs;}
	else if (!strcmp(option,"Dictionary"))				{thisOption = &Dictionary;}
	else if (!strcmp(option,"Words of Christ in Red"))	{thisOption = &Redwords;}
	else if (!strcmp(option,"Verse Numbers"))			{thisOption = &Versenumbers;}
	else if (!strcmp(option,"Hebrew Vowel Points"))		{thisOption = &HebrewPoints;}
	else if (!strcmp(option,"Hebrew Cantillation"))		{thisOption = &Cantillation;}
	else if (!strcmp(option,"Strong's Numbers"))   {thisOption = &Strongs;}
	else if (!strcmp(option,"Morphological Tags"))   {thisOption = &Morph;}
	else if (!strcmp(option,"Morpheme Segmentation"))   {thisOption = &MorphSeg;}
	else {return NS_ERROR_ILLEGAL_VALUE;}

	// Now update the global option
	if		(!strcmp(setting,"On"))  {*thisOption = 1;}
	else if (!strcmp(setting,"Off")) {*thisOption = 0;}
	else {return NS_ERROR_ILLEGAL_VALUE;}

	return NS_OK;
}


/********************************************************************
GetMaxVerse
*********************************************************************/
NS_IMETHODIMP xulsword::GetMaxVerse(const nsACString & Mod, const nsAString & Vkeytext, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  VerseKey vkey;
  vkey.setVersificationSystem(getVerseSystemOfModule(mod));
  *_retval = textToMaxVerse(NS_ConvertUTF16toUTF8(Vkeytext).get(), &vkey); 
   return NS_OK;    
}

/********************************************************************
GetVerseSystem
*********************************************************************/
NS_IMETHODIMP xulsword::GetVerseSystem(const nsACString & Mod, nsAString & _retval NS_OUTPARAM)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);

  nsEmbedCString vsystem;
  nsEmbedString retval;
  vsystem.Assign(getVerseSystemOfModule(mod));
  xulStringToUTF16(&vsystem, &retval, ENC_UTF8, false);
  
  _retval = retval;
  return NS_OK;  
}


/********************************************************************
ConvertLocation
*********************************************************************/
NS_IMETHODIMP xulsword::ConvertLocation(const nsACString & FromVerseSystem, const nsAString & Vkeytext, const nsACString & ToVerseSystem, nsAString & _retval NS_OUTPARAM)
{
  const char * frVS;
  NS_CStringGetData(FromVerseSystem, &frVS);
  const char * toVS;
  NS_CStringGetData(ToVerseSystem, &toVS);
  
  VerseKey fromKey;
  fromKey.setVersificationSystem(frVS);
  locationToVerseKey(NS_ConvertUTF16toUTF8(Vkeytext).get(), &fromKey);
//printf("FROM- KT:%s, LB:%s, UB:%s\n", fromKey.getShortText(), fromKey.LowerBound().getShortText(), fromKey.UpperBound().getShortText());

  SWBuf result;
  if ((!strcmp(frVS,WESTERN) && (!strcmp(toVS,EASTERN) || !strcmp(toVS,SYNODALPRO))) || 
      (!strcmp(toVS,WESTERN) && (!strcmp(frVS,EASTERN) || !strcmp(frVS,SYNODALPRO)))) {
    VerseKey toKey;
    mapVersifications(&fromKey, &toKey);
//printf("TO  - KT:%s, LB:%s, UB:%s\n", toKey.getShortText(), toKey.LowerBound().getShortText(), toKey.UpperBound().getShortText());
    result.appendFormatted("%s.%i", toKey.getOSISRef(), toKey.UpperBound().Verse());
  }
  else {
    result.appendFormatted("%s.%i", fromKey.getOSISRef(), fromKey.UpperBound().Verse());  
  }

  nsEmbedCString newloc;
  nsEmbedString retval;
  newloc.Assign(result.c_str());
  xulStringToUTF16(&newloc, &retval, ENC_UTF8, false);
  
  _retval = retval;
  return NS_OK;    
}


/********************************************************************
GetGlobalOption
*********************************************************************/
NS_IMETHODIMP xulsword::GetGlobalOption(const nsACString & Option, nsAString & _retval)
{
  const char * option;
  NS_CStringGetData(Option, &option);

  bool * thisOption;
  nsEmbedCString rCText;

  //Find which global option is being asked for
  if      (!strcmp(option,"Headings"))					{thisOption = &Headings;}
  else if (!strcmp(option,"Footnotes"))					{thisOption = &Footnotes;}
  else if (!strcmp(option,"Cross-references"))			{thisOption = &Crossrefs;}
  else if (!strcmp(option,"Dictionary"))				{thisOption = &Dictionary;}
  else if (!strcmp(option,"Words of Christ in Red"))	{thisOption = &Redwords;}
  else if (!strcmp(option,"Verse Numbers"))				{thisOption = &Versenumbers;}
  else if (!strcmp(option,"Hebrew Vowel Points"))		{thisOption = &HebrewPoints;}
	else if (!strcmp(option,"Hebrew Cantillation"))		{thisOption = &Cantillation;}
	else if (!strcmp(option,"Strong's Numbers"))   {thisOption = &Strongs;}
	else if (!strcmp(option,"Morphological Tags"))   {thisOption = &Morph;}
	else if (!strcmp(option,"Morpheme Segmentation"))   {thisOption = &MorphSeg;}
  else {return NS_ERROR_ILLEGAL_VALUE;}

  // Now return the proper value
  *thisOption ? rCText.Assign("On") : rCText.Assign("Off");

  nsEmbedString retval;
  xulStringToUTF16(&rCText, &retval, ENC_UTF8, false);
  
  _retval = retval;

  return NS_OK;
}


/********************************************************************
GetFootnotes
*********************************************************************/
NS_IMETHODIMP xulsword::GetFootnotes(nsAString & _retval)
{
	//NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED
  _retval = MyFootnotes;
	return NS_OK;
}


/********************************************************************
GetCrossRefs
*********************************************************************/
NS_IMETHODIMP xulsword::GetCrossRefs(nsAString & _retval)
{
	//NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED

  _retval = MyCrossRefs;
	return NS_OK;
}


/********************************************************************
GetNotes
*********************************************************************/
NS_IMETHODIMP xulsword::GetNotes(nsAString & _retval)
{
	//NOTE: getChapterText MUST HAVE BEEN RUN BEFORE THIS IS CALLED

  _retval = MyNotes;
	return NS_OK;
}


/********************************************************************
GetBookIntroduction
*********************************************************************/
NS_IMETHODIMP xulsword::GetBookIntroduction(const nsACString & Vkeymod, const nsAString & Bname, nsAString & _retval)
{
	const char * vkeymod;
	NS_CStringGetData(Vkeymod, &vkeymod);
	
  SWModule * module = MyManager.getModule(vkeymod);
  if (!module) {return NS_ERROR_FAILURE;}
  
  SWKey *testkey = module->CreateKey();
  VerseKey *introkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (!introkey) {
    delete(testkey);
    return NS_ERROR_ILLEGAL_VALUE;
  }
  
  updateGlobalOptions(&MyManager);

	introkey->Headings(1);
	introkey->setAutoNormalize(false);	// IMPORTANT!! Otherwise, introductions are skipped!
	introkey->setText(NS_ConvertUTF16toUTF8(Bname).get());
	introkey->Chapter(0);
	introkey->Verse(0);
	introkey->Persist(true);
	module->setKey(introkey);
	
	nsEmbedCString intro;
	nsEmbedString retval;
	intro.Assign(module->RenderText());
	xulStringToUTF16(&intro, &retval, module->Encoding(), false);
	
	module->setKey(EmptyKey);
	delete(testkey);

  _retval = retval;
  return NS_OK;
}


/********************************************************************
GetDictionaryEntry
*********************************************************************/
NS_IMETHODIMP xulsword::GetDictionaryEntry(const nsACString & Lexdictmod, const nsAString & Key, nsAString & _retval)
{
	const char * lexdictmod;
	NS_CStringGetData(Lexdictmod, &lexdictmod);
		
  updateGlobalOptions(&MyManager);

	SWModule * dmod;
	dmod = MyManager.getModule(lexdictmod);
	if (!dmod) {return NS_ERROR_FAILURE;}
	
	SWKey *tkey = dmod->CreateKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {return NS_ERROR_ILLEGAL_VALUE;}
  delete(tkey);
  
	nsEmbedString retval;
	
	dmod->setKey(NS_ConvertUTF16toUTF8(Key).get());
	dmod->increment(0); // Refresh the key's location
	if (strcmp(dmod->getKeyText(), NS_ConvertUTF16toUTF8(Key).get())) {retval.Assign(NS_ConvertUTF8toUTF16(""));}
	else {
    nsEmbedCString xstring;
    xstring.Assign(dmod->RenderText());
    //Now add any footnotes
    int footnoteNum = 1;
    AttributeList::iterator AtIndex;
    for (AtIndex = dmod->getEntryAttributes()["Footnote"].begin(); AtIndex != dmod->getEntryAttributes()["Footnote"].end(); AtIndex++) {
      if (footnoteNum == 1) {xstring.Append("<br><br><br><hr>");}
	    sprintf(Outtext, "<sup>%i</sup>", footnoteNum++);
	    xstring.Append(Outtext);
	    xstring.Append(AtIndex->second["body"]);
	    xstring.Append("<br><br>");
    }
    xulStringToUTF16(&xstring, &retval, dmod->Encoding(), false);
//printf("%s\n", utf8.get());
  }

//printf("%s\n", dmod->RenderText());
//printf("%s\n", NS_ConvertUTF16toUTF8(retval).get());
  _retval = retval;
	return NS_OK;
}


/********************************************************************
GetAllDictionaryKeys
*********************************************************************/
NS_IMETHODIMP xulsword::GetAllDictionaryKeys(const nsACString & Lexdictmod, nsAString & _retval)
{
	const char * lexdictmod;
	NS_CStringGetData(Lexdictmod, &lexdictmod);

  SWModule * dmod;
	dmod = MyManager.getModule(lexdictmod);
	if (!dmod) {return NS_ERROR_FAILURE;}
	
	SWKey *tkey = dmod->CreateKey();
  if (!SWDYNAMIC_CAST(StrKey, tkey)) {return NS_ERROR_ILLEGAL_VALUE;}
  delete(tkey);
  
	dmod->setPosition(TOP);

  long count=0;
  nsEmbedCString keytext;
	while (!dmod->Error() && count++<MAXDICTSIZE) {
	 keytext.Append(dmod->getKeyText());
	 keytext.Append("<nx>");
   //printf("%s\n", dmod->getKeyText());
   //printf("%i\n", count);
	 dmod->increment(1);
	}
	
	nsEmbedString retval;
	xulStringToUTF16(&keytext, &retval, dmod->Encoding(), false);
  
  _retval = retval;
	return NS_OK;
}


/********************************************************************
GetGenBookChapterText
*********************************************************************/
NS_IMETHODIMP xulsword::GetGenBookChapterText(const nsACString & Gbmod, const nsAString & Treekey, nsAString & _retval)
{
  const char * gbmod;
  NS_CStringGetData(Gbmod, &gbmod);
  
  SWModule * module = MyManager.getModule(gbmod);
  if (!module) {return NS_ERROR_FAILURE;}
  
  updateGlobalOptions(&MyManager);

  SWKey *testkey = module->CreateKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    return NS_ERROR_ILLEGAL_VALUE;
  }
  
  nsEmbedCString retval;
  if (!strcmp(NS_ConvertUTF16toUTF8(Treekey).get(), "/")) {
    key->root();
    key->firstChild();
  }
  else {key->setText(NS_ConvertUTF16toUTF8(Treekey).get());}

  key->Persist(1);  
  module->setKey(key);
  if (module->Error()) key->root();
  
  retval.Assign(module->RenderText());
  module->SetKey(EmptyKey);
    
  nsEmbedString retval16;
  xulStringToUTF16(&retval, &retval16, module->Encoding(), false);

  delete(testkey);
  
  _retval = retval16;
  return NS_OK;
}


/********************************************************************
GetGenBookTableOfContents
*********************************************************************/
NS_IMETHODIMP xulsword::GetGenBookTableOfContents(const nsACString & Gbmod, nsAString & _retval)
{
  const char * gbmod;
  NS_CStringGetData(Gbmod, &gbmod);
  
  SWModule * module = MyManager.getModule(gbmod);
  if (!module) {return NS_ERROR_FAILURE;}
  
  SWKey *testkey = module->CreateKey();
  TreeKey *key = SWDYNAMIC_CAST(TreeKey, testkey);
  if (!key) {
    delete(testkey);
    return NS_ERROR_ILLEGAL_VALUE;
  }
  
  key->root();
  nsEmbedCString retval;
  retval.Assign("<?xml version=\"1.0\"?>\n\n<RDF:RDF xmlns:TABLEOFCONTENTS=\"http://www.xulsword.com/tableofcontents/rdf#\" \n\t\txmlns:NC=\"http://home.netscape.com/NC-rdf#\" \n\t\txmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\n");
  retval.Append(GetFolderContents(key, gbmod, true).get());
  retval.Append("</RDF:RDF>");
  
  nsEmbedString retval16;
  xulStringToUTF16(&retval, &retval16, module->Encoding(), false);

  delete(testkey);
    
  _retval = retval16;
  return NS_OK;
}



/********************************************************************
LuceneEnabled
*********************************************************************/
NS_IMETHODIMP xulsword::LuceneEnabled(const nsACString & Mod, PRBool *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  SWModule * module = MyManager.getModule(mod);
  if (!module) {*_retval=false; return NS_OK;}
  
	bool supported = true;
	ListKey tmp = module->search(NULL,-4,NULL,NULL,&supported, NULL, NULL);
	*_retval=supported;
	return NS_OK;
}


/********************************************************************
Search
*********************************************************************/
NS_IMETHODIMP xulsword::Search(const nsACString & Mod, const nsAString & Srchstr, const nsACString & Scope, PRInt32 type, PRInt32 flags, PRBool newsearch, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  const char * scope;
  NS_CStringGetData(Scope, &scope);
  
  SWModule * module = MyManager.getModule(mod);
  if (!module) {return NS_ERROR_FAILURE;}

	ListKey listkeyInt;
	ListKey scopeK;
	VerseKey parser;
	SWKey key;
	
	nsEmbedCString searchString;

	PRInt32 type1;
	char noneed = 0;

	searchString.Assign(NS_ConvertUTF16toUTF8(Srchstr).get());
  
  SWKey *nvk;
  SWKey *testkey = module->CreateKey();
  VerseKey *modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    parser.setVersificationSystem(modvkey->getVersificationSystem());
    scopeK = parser.ParseVerseList(scope, parser, true);
    nvk = scopeK.getElement();
    nvk->Persist(1);
    module->setKey(nvk);
  }
  delete(testkey);
  
  searchedvers = getVerseSystemOfModule(mod);

    /*
	 *		   >=0  - regex
	 *			-1  - phrase
	 *			-2  - multiword
	 *			-3  - entryAttrib (eg. Word//Strongs/G1234/)
	 *			-4  - Lucene
     */

	if (type == -5) {type1 = -2;}
	else {type1 = type;}

	ListKey tmpkeys;
	ListKey *workKeys;
	if (!newsearch) {workKeys = &tmpkeys;}
	else {
		SearchList.clear();
		workKeys = &SearchList;
	}


	// COMPOUND SEARCH- currently a phrase search with nearly the speed of a multiword search
	if (type == -5) {
		listkeyInt = module->search(searchString.get(), type1, flags, 0, 0, &percentUpdate, &noneed);
		if (listkeyInt.Count() > 0) {
			//searchString.Insert("[^[:alpha:]]",0);
			//searchString.Append("[^[:alpha:]]");
			listkeyInt.Persist(1);
			module->setKey(listkeyInt);
			//*workKeys = module->search(searchString.get(), 0, flags, 0, 0, &percentUpdate, &noneed);
			*workKeys = module->search(searchString.get(), -1, flags, 0, 0, &percentUpdate, &noneed);			
		}
	}
	// SIMPLE SEARCH
	else {*workKeys = module->search(searchString.get(), type1, flags, 0, 0, &percentUpdate, &noneed);}
	
	// If not a new search append new results to existing key
	if (!newsearch) {
		workKeys->setPosition(TOP);
		while (!workKeys->Error()) {
		  SWKey *akey;
		  akey = module->CreateKey(); // get correctly versified key
		  akey->setText(workKeys->getText());
			SearchList.add(*akey);
			delete(akey);
			workKeys->increment(1);
		}
	}
	module->setKey(EmptyKey);
  
	MySearchVerses.Assign(NS_ConvertUTF8toUTF16(""));

	*_retval = SearchList.Count();

	return NS_OK;

}


/********************************************************************
GetSearchTexts
*********************************************************************/
NS_IMETHODIMP xulsword::GetSearchTexts(const nsACString & Mod, PRInt32 first, PRInt32 num, PRBool keepStrongs, nsAString & _retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  SWModule * module = MyManager.getModule(mod);
  if (!module) {return NS_ERROR_FAILURE;}
  
	if(num==0) {num=SearchList.Count();}
	
  if (keepStrongs) {updateGlobalOptions(&MyManager, true);}
  else {
    MyManager.setGlobalOption("Headings","Off");
    MyManager.setGlobalOption("Footnotes","Off");
    MyManager.setGlobalOption("Cross-references","Off");
    MyManager.setGlobalOption("Dictionary","Off");
    MyManager.setGlobalOption("Words of Christ in Red","Off");
    MyManager.setGlobalOption("Strong's Numbers","Off");
    MyManager.setGlobalOption("Morphological Tags","Off");
    MyManager.setGlobalOption("Morpheme Segmentation","Off");
  }

	MySearchTexts.Assign(NS_ConvertUTF8toUTF16(""));
	SearchList.SetToElement(first,TOP);
	PRInt32 written=0;
	int savePersist = SearchList.Persist();
	
	SWKey * testkey = module->CreateKey();
	VerseKey * modvkey = SWDYNAMIC_CAST(VerseKey, testkey);
  if (modvkey) {
    const char *toVS = modvkey->getVersificationSystem();
    delete(testkey);
    VerseKey fromkey;
    VerseKey tokey;
    fromkey.setVersificationSystem(searchedvers);
    tokey.setVersificationSystem(toVS);

    tokey.Persist(1);
    module->setKey(tokey);
    
    while (!SearchList.Error()&&(written<num)) {
      fromkey=SearchList;
      if ((!strcmp(searchedvers,WESTERN) && (!strcmp(toVS,EASTERN) || !strcmp(toVS,SYNODALPRO))) || 
          (!strcmp(toVS,WESTERN) && (!strcmp(searchedvers,EASTERN) || !strcmp(searchedvers,SYNODALPRO)))) {
         mapVersifications(&fromkey, &tokey);
      }
      else {tokey.copyFrom(fromkey);}

		  nsEmbedCString narrowBuf;
		  nsEmbedString wideBuf;
		  narrowBuf.Assign(tokey.getOSISRef());
		  narrowBuf.Append("<bg/>");
		  keepStrongs ? narrowBuf.Append(module->RenderText()):narrowBuf.Append(module->StripText());
		  narrowBuf.Append("<nx/>");
		  xulStringToUTF16(&narrowBuf, &wideBuf, module->Encoding(), false);
		  MySearchTexts.Append(wideBuf);

		  narrowBuf.Assign(tokey.getOSISRef());
		  narrowBuf.Append("<nx/>");
		  xulStringToUTF16(&narrowBuf, &wideBuf, ENC_UTF8, false);
		  MySearchVerses.Append(wideBuf);
		  SearchList++;
		  written++;
    }
	}
	else {
    delete(testkey);
    SearchList.Persist(1);
    module->setKey(SearchList);
    while (!SearchList.Error()&&(written<num)) {
    	nsEmbedCString narrowBuf;
		  nsEmbedString wideBuf;
      narrowBuf.Assign(module->getKeyText());
		  narrowBuf.Append("<bg/>");
		  keepStrongs ? narrowBuf.Append(module->RenderText()):narrowBuf.Append(module->StripText());
		  narrowBuf.Append("<nx/>");
		  xulStringToUTF16(&narrowBuf, &wideBuf, module->Encoding(), false);
		  MySearchTexts.Append(wideBuf);
		  
		  narrowBuf.Assign(module->getKeyText());
		  narrowBuf.Append("<nx/>");
		  xulStringToUTF16(&narrowBuf, &wideBuf, ENC_UTF8, false);
		  MySearchVerses.Append(wideBuf);
		  SearchList++;
		  written++;
		}
	}
  
	module->setKey(EmptyKey); // Overcomes the crash on Persist problem
  SearchList.Persist(savePersist);

  _retval = MySearchTexts;
	return NS_OK;
}


/********************************************************************
GetSearchVerses
*********************************************************************/
NS_IMETHODIMP xulsword::GetSearchVerses(const nsACString & Mod, nsAString & _retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);

  _retval = MySearchVerses;
	return NS_OK;
}


/********************************************************************
SetCipherKey
*********************************************************************/
NS_IMETHODIMP xulsword::SetCipherKey(const nsACString & Mod, const nsAString & Cipherkey, PRBool useSecModule)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
#ifndef NOSECURITY
  if (useSecModule) {
    SWModule * infoModule;
  	infoModule = MyManager.getModule(mod);
  	nsEmbedCString paramstring;
    paramstring.Assign(NOTFOUND);
    if (infoModule) {
      ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&infoModule->getConfig());
      ConfigEntMap::iterator it = infoConfig->find(MODVERSION);
      if (it != infoConfig->end()) {paramstring.Assign(it->second.c_str());}
    }
//printf("mod:%s, ver:%s\n", mod, paramstring.get());
    InstSecurity.ModCipherKey(Outtext, NS_ConvertUTF16toUTF8(Cipherkey).get(), paramstring.get(), mod);
  }
  else {sprintf(Outtext,"%s",NS_ConvertUTF16toUTF8(Cipherkey).get());}
#else
	sprintf(Outtext,"%s",NS_ConvertUTF16toUTF8(Cipherkey).get());
#endif

	// Set the new Cipher Key. IF WRONG CIPHER KEY IS GIVEN, IT CANNOT BE CHANGED WITHOUT RELOAD (SWORD BUG)
	if (SWModule * testmod=MyManager.getModule(mod)) 
	{
		MyManager.setCipherKey(mod,Outtext);
		return NS_OK;
	}
	else {return NS_ERROR_FAILURE;}
}


/********************************************************************
GetModuleList
*********************************************************************/
NS_IMETHODIMP xulsword::GetModuleList(nsAString & _retval)
{
	std::string tr;
	nsEmbedString trx;
	SWModule * module;
  
  bool first = true;
	for (modIterator = MyManager.Modules.begin(); modIterator != MyManager.Modules.end(); modIterator++) {
		module = (*modIterator).second;
		if (!first) {tr.append("<nx>");}
		tr.append(module->Name());
		tr.append(";");
		tr.append(module->Type());
		first = false;
	}
	
	if (!strcmp(tr.c_str(), "")) {tr.assign("No Modules");}

  nsEmbedCString modlist;
  nsEmbedString retval;
  modlist.Assign(tr.c_str());
  xulStringToUTF16(&modlist, &retval, ENC_UTF8, false);
	
  _retval = retval;
	return NS_OK;
}


/********************************************************************
GetModuleInformation
*********************************************************************/
NS_IMETHODIMP xulsword::GetModuleInformation(const nsACString & Mod, const nsACString & Paramname, nsAString & _retval)
{
	const char * mod;
	NS_CStringGetData(Mod, &mod);
	
	const char * paramname;
	NS_CStringGetData(Paramname, &paramname);
	
 	SWModule * infoModule;
	infoModule = MyManager.getModule(mod);
	nsEmbedCString paramstring;
	
  if (infoModule) {
    ConfigEntMap * infoConfig = const_cast<ConfigEntMap *>(&infoModule->getConfig());
    ConfigEntMap::iterator it = infoConfig->find(paramname);

    if (it == infoConfig->end()) {paramstring.Assign(NOTFOUND);}
    else {
      paramstring.Assign(it->second.c_str());
      it++;
      while (it != infoConfig->end() && !strcmp(it->first.c_str(), paramname)) {
        paramstring.Append("<nx>");
        paramstring.Append(it->second.c_str());
        it++;
      }
    }
  }
	 
	nsEmbedString retval;
	xulStringToUTF16(&paramstring, &retval, ENC_UTF8, false);

	_retval = retval;
	return NS_OK;
}


/********************************************************************
SearchIndexDelete
*********************************************************************/
NS_IMETHODIMP xulsword::SearchIndexDelete(const nsACString & Mod)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  SWModule * module = MyManager.getModule(mod);
  if (!module) {return NS_ERROR_FAILURE;}
  
	if (!module->hasSearchFramework()) {
		return NS_OK;
	}
	module->deleteSearchFramework();
	return NS_OK;
}


/********************************************************************
SearchIndexBuild
*********************************************************************/
NS_IMETHODIMP xulsword::SearchIndexBuild(const nsACString & Mod, PRInt32 maxwait, PRInt32 *_retval)
{
  const char * mod;
  NS_CStringGetData(Mod, &mod);
  
  SWModule * module = MyManager.getModule(mod);
  if (!module) {return NS_ERROR_FAILURE;}
  
	if (!module->hasSearchFramework()) {
		*_retval=100;
    return NS_OK;
	}
	
	int percentComplete = 0;
	char noneed = 0;
	module->createSearchFramework(&percentUpdate, &noneed, (double)maxwait, &percentComplete);
	*_retval = (PRInt32)percentComplete;
  	
	return NS_OK;
}

/* End of implementation class template. */



NS_GENERIC_FACTORY_CONSTRUCTOR(xulsword);

static const nsModuleComponentInfo components[] =
{
  { XULSWORD_CLASSNAME,
    XULSWORD_CID,
    XULSWORD_CONTRACTID,
    xulswordConstructor
  }
};

//NS_IMPL_NSGETMODULE(nsxulswordModule, components)

//Declare Static Variables
nsEmbedString xulsword::ChapterW;	//Holds current global chapter
PRUint16 xulsword::VerseW;			//Holds current global verse number
PRUint16 xulsword::LastVerseW;		//Holds current global last verse number
nsEmbedString xulsword::ChapterE;	//Holds current global chapter
PRUint16 xulsword::VerseE;			//Holds current global verse number
PRUint16 xulsword::LastVerseE;		//Holds current global last verse number
bool xulsword::Footnotes;			//Holds global settings
bool xulsword::Headings;
bool xulsword::Crossrefs;
bool xulsword::Dictionary;
bool xulsword::Redwords;
bool xulsword::Versenumbers;
bool xulsword::HebrewPoints;
bool xulsword::Cantillation;
bool xulsword::Strongs;
bool xulsword::Morph;
bool xulsword::MorphSeg;

static nsModuleInfo const kModuleInfo = {                                     
    NS_MODULEINFO_VERSION,                                                    
    ("nsxulswordModule"),                                                                 
    (components),                                                            
    (sizeof(components) / sizeof(components[0])),                           
    (nsnull),                                                                  
    (nsnull)                                                                   
};                                                                            
NSGETMODULE_ENTRY_POINT(nsxulswordModule)                                                
(nsIComponentManager *servMgr,                                                
            nsIFile* location,                                                
            nsIModule** result)                                               
{
  SWLog::getSystemLog()->setLogLevel(1); // set SWORD lof reporting... 5 is all stuff
  //Initialize static variables only once
	xulsword::ChapterW.Assign(NS_ConvertUTF8toUTF16("Matt 1"));
  xulsword::VerseW = 1;		
	xulsword::LastVerseW = 1;	
	xulsword::ChapterE.Assign(NS_ConvertUTF8toUTF16("Matt 1"));
  xulsword::VerseE = 1;		
	xulsword::LastVerseE = 1;	
  xulsword::Footnotes = 1;			
  xulsword::Headings = 1;
  xulsword::Crossrefs = 1;
	xulsword::Dictionary = 1;
  xulsword::Redwords = 1;
	xulsword::HebrewPoints = 1;
	xulsword::Cantillation = 1;
  xulsword::Versenumbers = 1;
  xulsword::Strongs = 1;
  xulsword::Morph = 1;
  xulsword::MorphSeg = 1;

#ifndef NOSECURITY
  Security.CheckIntegrity();
#endif

	CreateMutexA(NULL, FALSE, "xulswordmutex");


  NS_WARNING("*********************************");
	NS_WARNING("GOING TO CREATE NEW NSIMODULE NOW");
	NS_WARNING("*********************************");
	return NS_NewGenericModule2(&kModuleInfo, result);                        
}
