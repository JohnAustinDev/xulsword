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

#include <windows.h>
#include <dirent.h>
#include <stdio.h>
#include <string>
#include <iostream>

#include "swmgr.h"
#include "swmodule.h"
#include "versekey.h"
#include "treekeyidx.h"
#include "strkey.h"
#include "markupfiltmgr.h"
#include "swlog.h"
#include "stringmgr.h"
#include "swconfig.h"
#include "osisxhtml.h"
#include "gbfxhtml.h"
#include "thmlxhtml.h"
#include "canon_synodal0.h"	// Russian Synodal sword-1.6.1 v11n system
#include "canon_east.h"
#include "canon_synodalprot.h"
#include "osisdictionary.h"

#define DLLEXPORT extern "C" __declspec(dllexport)

using namespace sword;

ModMap::iterator modIterator;	//Iterator for modules

/********************************************************************
Javascript callback functions
*********************************************************************/
static char *(*ToUpperCase)(char *) = NULL;


/********************************************************************
Custom classes
*********************************************************************/
#include "osisxhtmlxs.cpp"
#include "gbfxhtmlxs.cpp"
#include "thmlxhtmlxs.cpp"
#include "osisdictionary.cpp"

SWORD_NAMESPACE_START
class SWMgrXS : public SWMgr {
  public:
    SWMgrXS(SWFilterMgr *filterMgr, bool multiMod = false);
    SWMgrXS(const char *iConfigPath, bool autoload = true, SWFilterMgr *filterMgr = 0, bool multiMod = false, bool augmentHome = true);

  protected:
    void init() {
      SWMgr::init();
      SWOptionFilter *tmpFilter = 0;
      tmpFilter = new OSISDictionary();
      optionFilters.insert(OptionFilterMap::value_type("OSISDictionary", tmpFilter));
      cleanupFilters.push_back(tmpFilter);
    }
    
    // This createModule sets the proper version of Synodal for backward compatibility
    SWModule *createModule(const char *name, const char *driver, ConfigEntMap &section);
};
SWMgrXS::SWMgrXS(SWFilterMgr *filterMgr, bool multiMod)
    : SWMgr(filterMgr, multiMod) {};
SWMgrXS::SWMgrXS(const char *iConfigPath, bool autoload, SWFilterMgr *filterMgr, bool multiMod, bool augmentHome)
    : SWMgr(iConfigPath, autoload, filterMgr, multiMod, augmentHome) {};
SWORD_NAMESPACE_END
#include "createModule.cpp"

class StringMgrXS : public StringMgr {
  public:
  char *upperUTF8(char *text, unsigned int max = 0) const {
    if (ToUpperCase) {text = ToUpperCase(text);}
    return text;
  }
};

class MarkupFilterMgrXS : MarkupFilterMgr {
  public:
    MarkupFilterMgrXS() {
      markup = -1;
      fromplain = NULL;
      fromthml = new ThMLXHTMLXS();
      fromgbf = new GBFXHTMLXS();
      fromosis = new OSISXHTMLXS();
      fromtei = NULL;
    }
    ~MarkupFilterMgrXS() {
        if (fromthml)
                delete (fromthml);
        if (fromgbf)
                delete (fromgbf);
        if (fromplain)
                delete (fromplain);
        if (fromosis)
                delete (fromosis);
        if (fromtei)
                delete (fromtei);
    }
};


/********************************************************************
Global variables
*********************************************************************/
SWMgrXS *MyManager;				//Global Module Manager
StringMgrXS *MyStringMgr;
MarkupFilterMgrXS *MyMarkupFilterMgr;
VerseMgr *MyVerseMgr;


/********************************************************************
InitSwordEngine()
*********************************************************************/
DLLEXPORT void InitSwordEngine(char *path, char *(*toUpperCase)(char *))
{
  if (toUpperCase) {ToUpperCase = toUpperCase;}

  MyVerseMgr = VerseMgr::getSystemVerseMgr();
  MyVerseMgr->registerVersificationSystem("Synodal0", otbooks_synodal0, ntbooks_synodal0, vm_synodal0);
  MyVerseMgr->registerVersificationSystem("EASTERN", otbooks_eastern, ntbooks_eastern, vm_eastern);
  MyVerseMgr->registerVersificationSystem("SynodalProt", otbooks_synodalprot, ntbooks_synodalprot, vm_synodalprot);
  
  MyMarkupFilterMgr = new MarkupFilterMgrXS();

  MyManager = 0;
  MyManager = new SWMgrXS(path, true, (MarkupFilterMgr *)MyMarkupFilterMgr, false);

  if (!MyManager) {MyManager = new SWMgrXS((MarkupFilterMgr *)MyMarkupFilterMgr, false);}
  
  MyStringMgr = new StringMgrXS();
  StringMgr::setSystemStringMgr(MyStringMgr);

  SWLog::getSystemLog()->setLogLevel(0); // set SWORD log reporting... 5 is all stuff
}


/********************************************************************
QuitSwordEngine()
*********************************************************************/
DLLEXPORT void QuitSwordEngine()
{
  delete MyManager;
  delete MyStringMgr;
  delete MyMarkupFilterMgr;
}


/********************************************************************
GetModuleList()
*********************************************************************/
DLLEXPORT const char* GetModuleList(char * retval)
{
	std::string tr;
	SWModule * module;

  bool first = true;
	for (modIterator = MyManager->Modules.begin(); modIterator != MyManager->Modules.end(); modIterator++) {
		module = (*modIterator).second;
		if (!first) {tr.append("<nx>");}
		tr.append(module->Name());
		tr.append(";");
		tr.append(module->Type());
		first = false;
	}

	if (!strcmp(tr.c_str(), "")) {tr.assign("No Modules");}

  strcpy(retval, tr.c_str());
	return retval;
}
