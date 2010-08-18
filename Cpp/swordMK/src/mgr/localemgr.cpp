/******************************************************************************
 *  localemgr.cpp - implementation of class LocaleMgr used to interact with
 *				registered locales for a sword installation
 *
 * $Id: localemgr.cpp 2499 2010-01-02 04:51:05Z scribe $
 *
 * Copyright 1998 CrossWire Bible Society (http://www.crosswire.org)
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

#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>

#include <sys/stat.h>
#include <dirent.h>

#include <swmgr.h>
#include <utilstr.h>

#include <stringmgr.h>
#include <filemgr.h>
#include <localemgr.h>
#include <swlocale.h>
#include <swlog.h>


SWORD_NAMESPACE_START

LocaleMgr *LocaleMgr::systemLocaleMgr = 0;

class __staticsystemLocaleMgr {
public:
	__staticsystemLocaleMgr() { }
	~__staticsystemLocaleMgr() { delete LocaleMgr::systemLocaleMgr; }
} _staticsystemLocaleMgr;


LocaleMgr *LocaleMgr::getSystemLocaleMgr() {
	if (!systemLocaleMgr) {
		setSystemLocaleMgr(new LocaleMgr());
	}

	return systemLocaleMgr;
}


void LocaleMgr::setSystemLocaleMgr(LocaleMgr *newLocaleMgr) {
	if (systemLocaleMgr)
		delete systemLocaleMgr;
	systemLocaleMgr = newLocaleMgr;
	SWLocale *locale = new SWLocale(0);
	systemLocaleMgr->locales->insert(LocaleMap::value_type(locale->getName(), locale));
}


LocaleMgr::LocaleMgr(const char *iConfigPath) {
	locales = new LocaleMap();
	char *prefixPath = 0;
	char *configPath = 0;
	SWConfig *sysConf = 0;
	char configType = 0;
	SWBuf path;
	std::list<SWBuf> augPaths;
	ConfigEntMap::iterator entry;
	
	defaultLocaleName = 0;
	
	if (!iConfigPath) {
		SWLog::getSystemLog()->logDebug("LOOKING UP LOCALE DIRECTORY...");
		SWMgr::findConfig(&configType, &prefixPath, &configPath, &augPaths, &sysConf);
		if (sysConf) {
			if ((entry = sysConf->Sections["Install"].find("LocalePath")) != sysConf->Sections["Install"].end()) {
				configType = 9;	// our own
				stdstr(&prefixPath, (char *)entry->second.c_str());
				SWLog::getSystemLog()->logDebug("LocalePath provided in sysConfig.");
			}
		}
		SWLog::getSystemLog()->logDebug("LOOKING UP LOCALE DIRECTORY COMPLETE.");
	}
	else {
		loadConfigDir(iConfigPath);
	}
	
	if (prefixPath) {
		switch (configType) {
		case 2:
			int i;
			for (i = strlen(configPath)-1; ((i) && (configPath[i] != '/') && (configPath[i] != '\\')); i--);
			configPath[i] = 0;
			path = configPath;
			path += "/";
			break;
		default:
			path = prefixPath;
			if ((prefixPath[strlen(prefixPath)-1] != '\\') && (prefixPath[strlen(prefixPath)-1] != '/'))
				path += "/";

			break;
		}
		if (FileMgr::existsDir(path.c_str(), "locales.d")) {
			path += "locales.d";
			loadConfigDir(path.c_str());
		}
	}
	
	if (augPaths.size() && configType != 9) { //load locale files from all augmented paths
		std::list<SWBuf>::iterator it = augPaths.begin();
		std::list<SWBuf>::iterator end = augPaths.end();
		
		for (;it != end; ++it) {
			if (FileMgr::existsDir((*it).c_str(), "locales.d")) {
				SWBuf path = (*it) + "locales.d";
				loadConfigDir(path.c_str());
			}
		}
	}

	// Locales will be invalidated if you change the StringMgr
	// So only use the default hardcoded locale and let the
	// frontends change the locale if they want
	stdstr(&defaultLocaleName, SWLocale::DEFAULT_LOCALE_NAME);

	if (prefixPath)
		delete [] prefixPath;

	if (configPath)
		delete [] configPath;

	if (sysConf)
		delete sysConf;
}


LocaleMgr::~LocaleMgr() {
	if (defaultLocaleName)
		delete [] defaultLocaleName;
     	deleteLocales();
	delete locales;
}


void LocaleMgr::loadConfigDir(const char *ipath) {
	DIR *dir;
	struct dirent *ent;
	SWBuf newmodfile;
	LocaleMap::iterator it;
	SWLog::getSystemLog()->logInformation("LocaleMgr::loadConfigDir loading %s", ipath);
 
	if ((dir = sw_opendir(ipath))) {
		sw_rewinddir(dir);
		while ((ent = sw_readdir(dir))) {
			if ((strcmp(ent->d_name, ".")) && (strcmp(ent->d_name, ".."))) {
				newmodfile = ipath;
				if ((ipath[strlen(ipath)-1] != '\\') && (ipath[strlen(ipath)-1] != '/'))
					newmodfile += "/";
				newmodfile += ent->d_name;
				SWLocale *locale = new SWLocale(newmodfile.c_str());
				
				if (locale->getName()) {					
					bool supported = false;
					if (StringMgr::hasUTF8Support()) {
						supported = (locale->getEncoding() && (!strcmp(locale->getEncoding(), "UTF-8") || !strcmp(locale->getEncoding(), "ASCII")) );
					}
					else {
						supported = !locale->getEncoding() || (locale->getEncoding() && (strcmp(locale->getEncoding(), "UTF-8") != 0)); //exclude UTF-8 locales
					}
					
					if (!supported) { //not supported
						delete locale;
						continue;
					}
				
					it = locales->find(locale->getName());
					if (it != locales->end()) { // already present
						*((*it).second) += *locale;
						delete locale;
					}
					else locales->insert(LocaleMap::value_type(locale->getName(), locale));
				}
				else	delete locale;
			}
		}
		sw_closedir(dir);
	}
}


void LocaleMgr::deleteLocales() {

	LocaleMap::iterator it;

	for (it = locales->begin(); it != locales->end(); it++)
		delete (*it).second;

	locales->erase(locales->begin(), locales->end());
}


SWLocale *LocaleMgr::getLocale(const char *name) {
	LocaleMap::iterator it;

	it = locales->find(name);
	if (it != locales->end())
		return (*it).second;

	SWLog::getSystemLog()->logWarning("LocaleMgr::getLocale failed to find %s\n", name);
	return (*locales)[SWLocale::DEFAULT_LOCALE_NAME];
}


std::list <SWBuf> LocaleMgr::getAvailableLocales() {
	std::list <SWBuf> retVal;
	for (LocaleMap::iterator it = locales->begin(); it != locales->end(); it++) {
		if (strcmp(it->second->getName(), "locales")) {
			retVal.push_back((*it).second->getName());
		}
	}

	return retVal;
}


const char *LocaleMgr::translate(const char *text, const char *localeName) {
	SWLocale *target;
	if (!localeName) {
		localeName = getDefaultLocaleName();
	}
	target = getLocale(localeName);
	if (target)
		return target->translate(text);
	return text;
}


const char *LocaleMgr::getDefaultLocaleName() {
	return defaultLocaleName;
}


void LocaleMgr::setDefaultLocaleName(const char *name) {
	char *tmplang=0;
	stdstr(&tmplang, name);
	// discard everything after '.' usually encoding e.g. .UTF-8
	strtok(tmplang, ".");
	// also discard after '@' so e.g. @euro locales are found
	strtok(tmplang, "@");

	stdstr(&defaultLocaleName, tmplang);

	// First check for what we ask for
	if (!getLocale(tmplang)) {
		// check for locale without country
		char *nocntry=0;
		stdstr(&nocntry, tmplang);
		strtok(nocntry, "_");
		if (getLocale(nocntry)) {
			stdstr(&defaultLocaleName, nocntry);
		}
		delete [] nocntry;
	}
	delete [] tmplang;
}

SWORD_NAMESPACE_END
