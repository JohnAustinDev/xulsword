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

//EDIT: adding OSISDictionary filter
  SWOptionFilter *tmpFilter = 0;
  tmpFilter = new OSISDictionary();
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

#ifndef WIN_32
SWModule *SWMgrXS::createModule(const char *name, const char *driver, ConfigEntMap &section)
{
	SWBuf description, datapath, misc1;
	ConfigEntMap::iterator entry;
	SWModule *newmod = 0;
	SWBuf lang, sourceformat, encoding;
	signed char direction, enc, markup;

	description  = ((entry = section.find("Description")) != section.end()) ? (*entry).second : (SWBuf)"";
	lang  = ((entry = section.find("Lang")) != section.end()) ? (*entry).second : (SWBuf)"en";
 	sourceformat = ((entry = section.find("SourceType"))  != section.end()) ? (*entry).second : (SWBuf)"";
 	encoding = ((entry = section.find("Encoding"))  != section.end()) ? (*entry).second : (SWBuf)"";
	datapath = prefixPath;
	if ((prefixPath[strlen(prefixPath)-1] != '\\') && (prefixPath[strlen(prefixPath)-1] != '/'))
		datapath += "/";

	SWBuf versification = ((entry = section.find("Versification"))  != section.end()) ? (*entry).second : (SWBuf)"KJV";

	// DataPath - relative path to data used by module driver.  May be a directory, may be a File.
	//   Typically not useful by outside world.  See AbsoluteDataPath, PrefixPath, and RelativePrefixPath
	//   below.
	misc1 += ((entry = section.find("DataPath")) != section.end()) ? (*entry).second : (SWBuf)"";
	char *buf = new char [ strlen(misc1.c_str()) + 1 ];
	char *buf2 = buf;
	strcpy(buf, misc1.c_str());
//	for (; ((*buf2) && ((*buf2 == '.') || (*buf2 == '/') || (*buf2 == '\\'))); buf2++);
	for (; ((*buf2) && ((*buf2 == '/') || (*buf2 == '\\'))); buf2++);
	if (!strncmp(buf2, "./", 2)) { //remove the leading ./ in the module data path to make it look better
		buf2 += 2;
	}
	// PrefixPath - absolute directory path to the repository in which this module was found
	section["PrefixPath"] = datapath;
	if (*buf2)
		datapath += buf2;
	delete [] buf;

	section["AbsoluteDataPath"] = datapath;

	if (!stricmp(sourceformat.c_str(), "GBF"))
		markup = FMT_GBF;
	else if (!stricmp(sourceformat.c_str(), "ThML"))
		markup = FMT_THML;
	else if (!stricmp(sourceformat.c_str(), "OSIS"))
		markup = FMT_OSIS;
	else if (!stricmp(sourceformat.c_str(), "TEI"))
		markup = FMT_TEI;
	else
		markup = FMT_GBF;

	if (!stricmp(encoding.c_str(), "SCSU"))
		enc = ENC_SCSU;
	else if (!stricmp(encoding.c_str(), "UTF-8")) {
		enc = ENC_UTF8;
	}
	else enc = ENC_LATIN1;

	if ((entry = section.find("Direction")) == section.end()) {
		direction = DIRECTION_LTR;
	}
	else if (!stricmp((*entry).second.c_str(), "rtol")) {
		direction = DIRECTION_RTL;
	}
	else if (!stricmp((*entry).second.c_str(), "bidi")) {
		direction = DIRECTION_BIDI;
	}
	else {
		direction = DIRECTION_LTR;
	}

	if ((!stricmp(driver, "zText")) || (!stricmp(driver, "zCom"))) {
		SWCompress *compress = 0;
		int blockType = CHAPTERBLOCKS;
		misc1 = ((entry = section.find("BlockType")) != section.end()) ? (*entry).second : (SWBuf)"CHAPTER";
		if (!stricmp(misc1.c_str(), "VERSE"))
			blockType = VERSEBLOCKS;
		else if (!stricmp(misc1.c_str(), "CHAPTER"))
			blockType = CHAPTERBLOCKS;
		else if (!stricmp(misc1.c_str(), "BOOK"))
			blockType = BOOKBLOCKS;

		misc1 = ((entry = section.find("CompressType")) != section.end()) ? (*entry).second : (SWBuf)"LZSS";
#ifndef EXCLUDEZLIB
		if (!stricmp(misc1.c_str(), "ZIP"))
			compress = new ZipCompress();
		else
		if (!stricmp(misc1.c_str(), "BZIP2_UNSUPPORTED"))
			compress = new Bzip2Compress();
		else
		if (!stricmp(misc1.c_str(), "XZ_UNSUPPORTED"))
			compress = new XzCompress();
		else
#endif
		if (!stricmp(misc1.c_str(), "LZSS"))
			compress = new LZSSCompress();

		if (compress) {
			if (!stricmp(driver, "zText"))
				newmod = new zTextXS(datapath.c_str(), name, description.c_str(), blockType, compress, 0, enc, direction, markup, lang.c_str(), versification);
			else	newmod = new zComXS(datapath.c_str(), name, description.c_str(), blockType, compress, 0, enc, direction, markup, lang.c_str(), versification);
		}
	}

	if (!stricmp(driver, "RawText")) {
		newmod = new RawTextXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawText4")) {
		newmod = new RawText4XS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	// backward support old drivers
	if (!stricmp(driver, "RawGBF")) {
		newmod = new RawTextXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str());
	}

	if (!stricmp(driver, "RawCom")) {
		newmod = new RawComXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawCom4")) {
		newmod = new RawCom4XS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawFiles")) {
		newmod = new RawFilesXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str());
	}

	if (!stricmp(driver, "HREFCom")) {
		misc1 = ((entry = section.find("Prefix")) != section.end()) ? (*entry).second : (SWBuf)"";
		newmod = new HREFComXS(datapath.c_str(), misc1.c_str(), name, description.c_str());
	}

        int pos = 0;  //used for position of final / in AbsoluteDataPath, but also set to 1 for modules types that need to strip module name
	if (!stricmp(driver, "RawLD")) {
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		bool strongsPadding = ((entry = section.find("StrongsPadding")) != section.end()) ? (*entry).second == "true": true;
		newmod = new RawLDXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), caseSensitive, strongsPadding);
                pos = 1;
        }

	if (!stricmp(driver, "RawLD4")) {
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		bool strongsPadding = ((entry = section.find("StrongsPadding")) != section.end()) ? (*entry).second == "true": true;
		newmod = new RawLD4XS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), caseSensitive, strongsPadding);
                pos = 1;
        }

	if (!stricmp(driver, "zLD")) {
		SWCompress *compress = 0;
		int blockCount;
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		bool strongsPadding = ((entry = section.find("StrongsPadding")) != section.end()) ? (*entry).second == "true": true;
		misc1 = ((entry = section.find("BlockCount")) != section.end()) ? (*entry).second : (SWBuf)"200";
		blockCount = atoi(misc1.c_str());
		blockCount = (blockCount) ? blockCount : 200;

		misc1 = ((entry = section.find("CompressType")) != section.end()) ? (*entry).second : (SWBuf)"LZSS";
#ifndef EXCLUDEZLIB
		if (!stricmp(misc1.c_str(), "ZIP"))
			compress = new ZipCompress();
		else
#endif
		if (!stricmp(misc1.c_str(), "LZSS"))
			compress = new LZSSCompress();

		if (compress) {
			newmod = new zLDXS(datapath.c_str(), name, description.c_str(), blockCount, compress, 0, enc, direction, markup, lang.c_str(), caseSensitive, strongsPadding);
		}
		pos = 1;
	}

	if (!stricmp(driver, "RawGenBook")) {
		misc1 = ((entry = section.find("KeyType")) != section.end()) ? (*entry).second : (SWBuf)"TreeKey";
		newmod = new RawGenBookXS(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), misc1.c_str());
		pos = 1;
	}

	if (pos == 1) {
		SWBuf &dp = section["AbsoluteDataPath"];
		for (int i = dp.length() - 1; i; i--) {
			if (dp[i] == '/') {
				dp.setSize(i);
				break;
			}
		}
/*
		SWBuf &rdp = section["RelativeDataPath"];
		for (int i = rdp.length() - 1; i; i--) {
			if (rdp[i] == '/') {
				rdp.setSize(i);
				break;
			}
		}
*/
	}

	if (newmod) {
		// if a specific module type is set in the config, use this
		if ((entry = section.find("Type")) != section.end())
			newmod->setType(entry->second.c_str());

		newmod->setConfig(&section);
	}

	return newmod;
}
#endif

