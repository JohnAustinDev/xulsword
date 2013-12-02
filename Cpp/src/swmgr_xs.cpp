 /******************************************************************************
 *
 *  swmgr.cpp -	used to interact with an install base of sword modules
 *
 * $Id: swmgr.cpp 2973 2013-09-10 11:53:43Z scribe $
 *
 * Copyright 1998-2013 CrossWire Bible Society (http://www.crosswire.org)
 *	CrossWire Bible Society
 *	P. O. Box 2528
 *	Tempe, AZ  85280-2528
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation version 2.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 */

#include <lzsscomprs.h>
#ifndef EXCLUDEZLIB
#include "zipcomprs.h"
#include "bz2comprs.h"
#include "xzcomprs.h"
#endif

#include "osisreferencelinks.h"

/********************************************************************
SWMgrXS - to over-ride modules and how they are loaded
*********************************************************************/
SWMgrXS::SWMgrXS(const char *iConfigPath, bool autoload, SWFilterMgr *filterMgr, bool multiMod, bool xaugmentHome)
    : SWMgr(iConfigPath, autoload, filterMgr, multiMod, xaugmentHome) {

  mgrModeMultiMod = multiMod;
  augmentHome = xaugmentHome;
}

SWMgrXS::~SWMgrXS() {}

signed char SWMgrXS::Load() {
//COPIED from SWMgr::Load 3/6/2012
	signed char ret = 0;
	
  //EDIT: adding OSISReferenceLinks filter for backward compatibility to old mods which lack this conf entry (made for xulsword <= 3.6)
  SWOptionFilter *tmpFilter = 0;
  tmpFilter = new OSISReferenceLinks("Reference Material Links", "Hide or show links to study helps in the Biblical text.", "x-glossary", "", "On");
  optionFilters.insert(OptionFilterMap::value_type("OSISDictionary", tmpFilter));
  cleanupFilters.push_back(tmpFilter);
  //EDIT_END

	if (!config) {	// If we weren't passed a config object at construction, find a config file
		if (!configPath) {	// If we weren't passed a config path at construction...
			SWLog::getSystemLog()->logDebug("LOOKING UP MODULE CONFIGURATION...");
			SWConfig *externalSysConf = sysConfig;	// if we have a sysConf before findConfig, then we were provided one from an external source.
			findConfig(&configType, &prefixPath, &configPath, &augPaths, &sysConfig);
			if (!externalSysConf) mysysconfig = sysConfig;	// remind us to delete our own sysConfig in d-tor
			SWLog::getSystemLog()->logDebug("LOOKING UP MODULE CONFIGURATION COMPLETE.");
		}
		if (configPath) {
			if (configType)
				loadConfigDir(configPath);
			else	config = myconfig = new SWConfig(configPath);
		}
	}

	if (config) {
		SectionMap::iterator Sectloop, Sectend;
		ConfigEntMap::iterator Entryloop, Entryend;

		DeleteMods();

		for (Sectloop = config->Sections.lower_bound("Globals"), Sectend = config->Sections.upper_bound("Globals"); Sectloop != Sectend; Sectloop++) {		// scan thru all 'Globals' sections
			for (Entryloop = (*Sectloop).second.lower_bound("AutoInstall"), Entryend = (*Sectloop).second.upper_bound("AutoInstall"); Entryloop != Entryend; Entryloop++)	// scan thru all AutoInstall entries
				InstallScan((*Entryloop).second.c_str());		// Scan AutoInstall entry directory for new modules and install
		}
		if (configType) {	// force reload on config object because we may have installed new modules
			delete myconfig;
			config = myconfig = 0;
			loadConfigDir(configPath);
		}
		else	config->Load();

//EDIT:
// sword-1.6.1 Synodal canon was missing Psalms 114:9, but we need to detect it and continue its support
    ConfigEntMap::iterator versif, mv;
    SectionMap::iterator it;
    for (it = config->Sections.begin(); it != config->Sections.end(); it++) {
		  ConfigEntMap &section = (*it).second;
		  SWBuf versification = ((versif = section.find("Versification")) != section.end()) ? (*versif).second : (SWBuf)"KJV";
    	if (versification == "Synodal") {
    		SWBuf minvers = ((mv = section.find("MinimumVersion"))  != section.end()) ? (*mv).second : (SWBuf)"1.6.1";
    		if (minvers == "1.6.1") {versification = "Synodal0";}
    		(*versif).second = versification.c_str();
    	}
		}
//EDIT_END

		CreateMods(mgrModeMultiMod);

		for (std::list<SWBuf>::iterator pathIt = augPaths.begin(); pathIt != augPaths.end(); pathIt++) {
			augmentModules(pathIt->c_str(), mgrModeMultiMod);
		}
		if (augmentHome) {
			// augment config with ~/.sword/mods.d if it exists ---------------------
			SWBuf homeDir = getHomeDir();
			if (homeDir.length() && configType != 2) { // 2 = user only
				SWBuf path = homeDir;
				path += ".sword/";
				augmentModules(path.c_str(), mgrModeMultiMod);
				path = homeDir;
				path += "sword/";
				augmentModules(path.c_str(), mgrModeMultiMod);
			}
		}
// -------------------------------------------------------------------------
		if (!Modules.size()) // config exists, but no modules
			ret = 1;

	}
	else {
		SWLog::getSystemLog()->logError("SWMgr: Can't find 'mods.conf' or 'mods.d'.  Try setting:\n\tSWORD_PATH=<directory containing mods.conf>\n\tOr see the README file for a full description of setup options (%s)", (configPath) ? configPath : "<configPath is null>");
		ret = -1;
	}

	return ret;
}
