 /*****************************************************************************
 * InstallMgr functions to be made into something usefully exposed by
 * master Glassey
 *
 *
 *
 * Copyright 2009 CrossWire Bible Society (http://www.crosswire.org)
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



#ifndef EXCLUDEZLIB
extern "C" {
#include <untgz.h>
}
#endif

#include <installmgr.h>
#include <filemgr.h>
#include <utilstr.h>

#include <fcntl.h>

#include <swmgr.h>
#include <swmodule.h>
#include <swversion.h>
#include <swlog.h>
#include <dirent.h>

#include <stdio.h>
#include <map>

#ifdef CURLAVAILABLE
#include <curlftpt.h>
#include <curlhttpt.h>
#else
#include <ftplibftpt.h>
#endif

#include <iostream>
SWORD_NAMESPACE_START

namespace {

void removeTrailingSlash(SWBuf &buf) {
	int len = buf.size();
	if ((buf[len-1] == '/')
	 || (buf[len-1] == '\\'))
		buf.size(len-1);
}

const char *masterRepoList = "masterRepoList.conf";

};


using std::map;

const int InstallMgr::MODSTAT_OLDER            = 0x001;
const int InstallMgr::MODSTAT_SAMEVERSION      = 0x002;
const int InstallMgr::MODSTAT_UPDATED          = 0x004;
const int InstallMgr::MODSTAT_NEW              = 0x008;
const int InstallMgr::MODSTAT_CIPHERED         = 0x010;
const int InstallMgr::MODSTAT_CIPHERKEYPRESENT = 0x020;

// override this method and provide your own custom FTPTransport subclass
// here we try a couple defaults if sword was compiled with support for them.
// see these classes for examples of how to make your own
FTPTransport *InstallMgr::createFTPTransport(const char *host, StatusReporter *statusReporter) {
#ifdef CURLAVAILABLE
	return new CURLFTPTransport(host, statusReporter);
#else
	return new FTPLibFTPTransport(host, statusReporter);
#endif
}

FTPTransport *InstallMgr::createHTTPTransport(const char *host, StatusReporter *statusReporter) {
#ifdef CURLAVAILABLE
	return new CURLHTTPTransport(host, statusReporter);
#else
	return 0;
#endif
}



InstallMgr::InstallMgr(const char *privatePath, StatusReporter *sr, SWBuf u, SWBuf p) {
	userDisclaimerConfirmed = false;
	statusReporter = sr;
	this->u = u;
	this->p = p;
	this->privatePath = 0;
	this->transport = 0;
	installConf = 0;
	stdstr(&(this->privatePath), privatePath);
	if (this->privatePath) {
		int len = strlen(this->privatePath);
		if ((this->privatePath[len-1] == '/')
		 || (this->privatePath[len-1] == '\\'))
			this->privatePath[len-1] = 0;
	}
	confPath = (SWBuf)privatePath + "/InstallMgr.conf";
	FileMgr::createParent(confPath.c_str());
	
	readInstallConf();
}


InstallMgr::~InstallMgr() {
	delete [] privatePath;
	delete installConf;
	clearSources();
}

void InstallMgr::clearSources() {
	for (InstallSourceMap::iterator it = sources.begin(); it != sources.end(); ++it) {
		delete it->second;
	}
	sources.clear();
}

void InstallMgr::readInstallConf() {

	if (installConf) delete installConf;

	installConf = new SWConfig(confPath.c_str());

	clearSources();
	
	setFTPPassive(stricmp((*installConf)["General"]["PassiveFTP"].c_str(), "false") != 0);

	SectionMap::iterator confSection = installConf->Sections.find("Sources");
	ConfigEntMap::iterator sourceBegin;
	ConfigEntMap::iterator sourceEnd;

	if (confSection != installConf->Sections.end()) {
		sourceBegin = confSection->second.lower_bound("FTPSource");
		sourceEnd = confSection->second.upper_bound("FTPSource");

		while (sourceBegin != sourceEnd) {
			InstallSource *is = new InstallSource("FTP", sourceBegin->second.c_str());
			sources[is->caption] = is;
			SWBuf parent = (SWBuf)privatePath + "/" + is->uid + "/file";
			FileMgr::createParent(parent.c_str());
			is->localShadow = (SWBuf)privatePath + "/" + is->uid;
			sourceBegin++;
		}
		sourceBegin = confSection->second.lower_bound("HTTPSource");
		sourceEnd = confSection->second.upper_bound("HTTPSource");

		while (sourceBegin != sourceEnd) {
			InstallSource *is = new InstallSource("HTTP", sourceBegin->second.c_str());
			sources[is->caption] = is;
			SWBuf parent = (SWBuf)privatePath + "/" + is->uid + "/file";
			FileMgr::createParent(parent.c_str());
			is->localShadow = (SWBuf)privatePath + "/" + is->uid;
			sourceBegin++;
		}
	}

	defaultMods.clear();
	confSection = installConf->Sections.find("General");
	if (confSection != installConf->Sections.end()) {
		sourceBegin = confSection->second.lower_bound("DefaultMod");
		sourceEnd = confSection->second.upper_bound("DefaultMod");

		while (sourceBegin != sourceEnd) {
			defaultMods.insert(sourceBegin->second.c_str());
			sourceBegin++;
		}
	}
}


void InstallMgr::saveInstallConf() {

	installConf->Sections["Sources"].clear();

	for (InstallSourceMap::iterator it = sources.begin(); it != sources.end(); ++it) {
		if (it->second) {
			installConf->Sections["Sources"].insert(ConfigEntMap::value_type(it->second->type + "Source", it->second->getConfEnt().c_str()));
		}
	}
	(*installConf)["General"]["PassiveFTP"] = (isFTPPassive()) ? "true" : "false";

	installConf->Save();
}


void InstallMgr::terminate() { if (transport) transport->terminate(); }


int InstallMgr::removeModule(SWMgr *manager, const char *moduleName) {
	SectionMap::iterator module;
	ConfigEntMap::iterator fileBegin;
	ConfigEntMap::iterator fileEnd, entry;

	// save our own copy, cuz when we remove the module from the SWMgr
	// it's likely we'll free the memory passed to us in moduleName
	SWBuf modName = moduleName;
	module = manager->config->Sections.find(modName);

	if (module != manager->config->Sections.end()) {
		// to be sure all files are closed
		// this does not remove the .conf information from SWMgr
		manager->deleteModule(modName);

		fileBegin = module->second.lower_bound("File");
		fileEnd = module->second.upper_bound("File");

		SWBuf modFile;
		SWBuf modDir;
		entry = module->second.find("AbsoluteDataPath");
		modDir = entry->second.c_str();
		removeTrailingSlash(modDir);
		if (fileBegin != fileEnd) {	// remove each file
			while (fileBegin != fileEnd) {
				modFile = modDir;
				modFile += "/";
				modFile += fileBegin->second.c_str();
				//remove file
				FileMgr::removeFile(modFile.c_str());
				fileBegin++;
			}
		}
		else {	//remove all files in DataPath directory

			DIR *dir;
			struct dirent *ent;
			ConfigEntMap::iterator entry;

			FileMgr::removeDir(modDir.c_str());

			if ((dir = sw_opendir(manager->configPath))) {	// find and remove .conf file
				sw_rewinddir(dir);
				while ((ent = sw_readdir(dir))) {
					if ((strcmp(ent->d_name, ".")) && (strcmp(ent->d_name, ".."))) {
						modFile = manager->configPath;
						removeTrailingSlash(modFile);
						modFile += "/";
						modFile += ent->d_name;
						SWConfig *config = new SWConfig(modFile.c_str());
						if (config->Sections.find(modName) != config->Sections.end()) {
							delete config;
							FileMgr::removeFile(modFile.c_str());
						}
						else	delete config;
					}
				}
				sw_closedir(dir);
			}
		}
		return 0;
	}
	return 1;
}


// TODO: rename to netCopy
int InstallMgr::ftpCopy(InstallSource *is, const char *src, const char *dest, bool dirTransfer, const char *suffix) {
SWLog::getSystemLog()->logDebug("netCopy: %s, %s, %s, %c, %s", (is?is->source.c_str():"null"), src, (dest?dest:"null"), (dirTransfer?'t':'f'), (suffix?suffix:"null"));

	// assert user disclaimer has been confirmed
	if (!isUserDisclaimerConfirmed()) return -1;

	int retVal = 0;
	FTPTransport *trans = 0;
	if (is->type == "FTP") {
		trans = createFTPTransport(is->source, statusReporter);
		trans->setPassive(passive);
	}
	else if (is->type == "HTTP") {
		trans = createHTTPTransport(is->source, statusReporter);
	}
	transport = trans; // set classwide current transport for other thread terminate() call
	if (is->u.length()) {
		trans->setUser(is->u);
		trans->setPasswd(is->p);
	}
	else {
		trans->setUser(u);
		trans->setPasswd(p);
	}

	SWBuf urlPrefix = (SWBuf)((is->type == "HTTP") ? "http://" : "ftp://") + is->source;

	// let's be sure we can connect.  This seems to be necessary but sucks
//	SWBuf url = urlPrefix + is->directory.c_str() + "/"; //dont forget the final slash
//	if (trans->getURL("swdirlist.tmp", url.c_str())) {
//		 SWLog::getSystemLog()->logDebug("FTPCopy: failed to get dir %s\n", url.c_str());
//		 return -1;
//	}


	if (dirTransfer) {
		SWBuf dir = (SWBuf)is->directory.c_str();
		removeTrailingSlash(dir);
		dir += (SWBuf)"/" + src; //dont forget the final slash

		retVal = trans->copyDirectory(urlPrefix, dir, dest, suffix);


	}
	else {
		SWTRY {
			SWBuf url = urlPrefix + is->directory.c_str();
			removeTrailingSlash(url);
			url += (SWBuf)"/" + src; //dont forget the final slash
			if (trans->getURL(dest, url.c_str())) {
				SWLog::getSystemLog()->logDebug("netCopy: failed to get file %s", url.c_str());
				retVal = -1;
			}
		}
		SWCATCH (...) {
			retVal = -1;
		}
	}
	SWTRY {
		FTPTransport *deleteMe = trans;
		// do this order for threadsafeness
		// (see terminate())
		trans = transport = 0;
		delete deleteMe;
	}
	SWCATCH (...) {}
	return retVal;
}


int InstallMgr::installModule(SWMgr *destMgr, const char *fromLocation, const char *modName, InstallSource *is) {
	SectionMap::iterator module, section;
	ConfigEntMap::iterator fileBegin;
	ConfigEntMap::iterator fileEnd;
	ConfigEntMap::iterator entry;
	SWBuf sourceDir;
	SWBuf buffer;
	bool aborted = false;
	bool cipher = false;
	DIR *dir;
	struct dirent *ent;
	SWBuf modFile;

	SWLog::getSystemLog()->logDebug("***** InstallMgr::installModule\n");
	if (fromLocation)
		SWLog::getSystemLog()->logDebug("***** fromLocation: %s \n", fromLocation);
	SWLog::getSystemLog()->logDebug("***** modName: %s \n", modName);

	if (is)
		sourceDir = (SWBuf)privatePath + "/" + is->uid;
	else	sourceDir = fromLocation;

	removeTrailingSlash(sourceDir);
	sourceDir += '/';

	SWMgr mgr(sourceDir.c_str());
	
	module = mgr.config->Sections.find(modName);

	if (module != mgr.config->Sections.end()) {
	
		entry = module->second.find("CipherKey");
		if (entry != module->second.end())
			cipher = true;
		
		//
		// This first check is a method to allow a module to specify each
		// file that needs to be copied
		//
		fileEnd = module->second.upper_bound("File");
		fileBegin = module->second.lower_bound("File");

		if (fileBegin != fileEnd) {	// copy each file
			if (is) {
				while (fileBegin != fileEnd) {	// netCopy each file first
					buffer = sourceDir + fileBegin->second.c_str();
					if (ftpCopy(is, fileBegin->second.c_str(), buffer.c_str())) {
						aborted = true;
						break;	// user aborted
					}
					fileBegin++;
				}
				fileBegin = module->second.lower_bound("File");
			}

			if (!aborted) {
				// DO THE INSTALL
				while (fileBegin != fileEnd) {
					SWBuf sourcePath = sourceDir;
					sourcePath += fileBegin->second.c_str();
					SWBuf dest = destMgr->prefixPath;
					removeTrailingSlash(dest);
					dest += '/';
					dest += fileBegin->second.c_str();
					FileMgr::copyFile(sourcePath.c_str(), dest.c_str());

					fileBegin++;
				}
			}
			//---------------

			if (is) {
				fileBegin = module->second.lower_bound("File");
				while (fileBegin != fileEnd) {	// delete each tmp netCopied file
					buffer = sourceDir + fileBegin->second.c_str();
					FileMgr::removeFile(buffer.c_str());
					fileBegin++;
				}
			}
		}

		// This is the REAL install code, the above code I don't think has
		// ever been used
		//
		// Copy all files in DataPath directory
		// 
		else {
			ConfigEntMap::iterator entry;

			entry = module->second.find("AbsoluteDataPath");
			if (entry != module->second.end()) {
				SWBuf absolutePath = entry->second.c_str();
				SWBuf relativePath = absolutePath;
				entry = module->second.find("PrefixPath");
				if (entry != module->second.end()) {
					relativePath << strlen(entry->second.c_str());
				}
				else {
					relativePath << strlen(mgr.prefixPath);
				}
				SWLog::getSystemLog()->logDebug("***** mgr.prefixPath: %s \n", mgr.prefixPath);
				SWLog::getSystemLog()->logDebug("***** destMgr->prefixPath: %s \n", destMgr->prefixPath);
				SWLog::getSystemLog()->logDebug("***** absolutePath: %s \n", absolutePath.c_str());
				SWLog::getSystemLog()->logDebug("***** relativePath: %s \n", relativePath.c_str());

				if (is) {
					if (ftpCopy(is, relativePath.c_str(), absolutePath.c_str(), true)) {
						aborted = true;	// user aborted
					}
				}
				if (!aborted) {
					SWBuf destPath = (SWBuf)destMgr->prefixPath + relativePath;
					FileMgr::copyDir(absolutePath.c_str(), destPath.c_str());
				}
				if (is) {		// delete tmp netCopied files
//					mgr->deleteModule(modName);
					FileMgr::removeDir(absolutePath.c_str());
				}
			}
		}
		if (!aborted) {
			SWBuf confDir = sourceDir + "mods.d/";
			if ((dir = sw_opendir(confDir.c_str()))) {	// find and copy .conf file
				sw_rewinddir(dir);
				while ((ent = sw_readdir(dir))) {
					if ((strcmp(ent->d_name, ".")) && (strcmp(ent->d_name, ".."))) {
						modFile = confDir;
						modFile += ent->d_name;
						SWConfig *config = new SWConfig(modFile.c_str());
						if (config->Sections.find(modName) != config->Sections.end()) {
							SWBuf targetFile = destMgr->configPath; //"./mods.d/";
							removeTrailingSlash(targetFile);
							targetFile += "/";
							targetFile += ent->d_name;
							FileMgr::copyFile(modFile.c_str(), targetFile.c_str());
							if (cipher) {
								if (getCipherCode(modName, config)) {
									SWMgr newDest(destMgr->prefixPath);
									removeModule(&newDest, modName);
									aborted = true;
								}
								else {
									config->Save();
									FileMgr::copyFile(modFile.c_str(), targetFile.c_str());
								}
							}
						}
						delete config;
					}
				}
				sw_closedir(dir);
			}
		}
		return (aborted) ? -1 : 0;
	}
	return 1;
}

int InstallMgr::refreshRemoteSource(InstallSource *is) {

	// assert user disclaimer has been confirmed
	if (!isUserDisclaimerConfirmed()) return -1;

	SWBuf root = (SWBuf)privatePath + (SWBuf)"/" + is->uid.c_str();
	removeTrailingSlash(root);
	SWBuf target = root + "/mods.d";
	int errorCode = -1; //0 means successful

	FileMgr::removeDir(target.c_str());

	if (!FileMgr::existsDir(target))
		FileMgr::createPathAndFile(target+"/globals.conf");

#ifndef EXCLUDEZLIB
	SWBuf archive = root + "/mods.d.tar.gz";

	errorCode = ftpCopy(is, "mods.d.tar.gz", archive.c_str(), false);
	if (!errorCode) { //sucessfully downloaded the tar,gz of module configs
		FileDesc *fd = FileMgr::getSystemFileMgr()->open(archive.c_str(), FileMgr::RDONLY);
		untargz(fd->getFd(), root.c_str());
		FileMgr::getSystemFileMgr()->close(fd);
	}
	else
#endif
	errorCode = ftpCopy(is, "mods.d", target.c_str(), true, ".conf"); //copy the whole directory

	is->flush();
	return errorCode;
}


bool InstallMgr::isDefaultModule(const char *modName) {
	return defaultMods.count(modName);
}

/************************************************************************
 * getModuleStatus - compare the modules of two SWMgrs and return a 
 * 	vector describing the status of each.  See MODSTAT_*
 */
map<SWModule *, int> InstallMgr::getModuleStatus(const SWMgr &base, const SWMgr &other) {
	map<SWModule *, int> retVal;
	SWBuf targetVersion;
	SWBuf sourceVersion;
	SWBuf softwareVersion;
	bool cipher;
	bool keyPresent;
	int modStat;
	
	for (ModMap::const_iterator mod = other.Modules.begin(); mod != other.Modules.end(); mod++) {
	
		modStat = 0;

		cipher = false;
		keyPresent = false;
		
		const char *v = mod->second->getConfigEntry("CipherKey");
		if (v) {
			cipher = true;
			keyPresent = *v;
		}
		
		targetVersion = "0.0";
		sourceVersion = "1.0";
		softwareVersion = (const char *)SWVersion::currentVersion;
		
		v = mod->second->getConfigEntry("Version");
		if (v) sourceVersion = v;

		v = mod->second->getConfigEntry("MinimumVersion");
		if (v) softwareVersion = v;

		const SWModule *baseMod = base.getModule(mod->first);
		if (baseMod) {
			targetVersion = "1.0";
			v = baseMod->getConfigEntry("Version");
			if (v) targetVersion = v;
			modStat |= (SWVersion(sourceVersion.c_str()) > SWVersion(targetVersion.c_str())) ? MODSTAT_UPDATED : (SWVersion(sourceVersion.c_str()) < SWVersion(targetVersion.c_str())) ? MODSTAT_OLDER : MODSTAT_SAMEVERSION;
		}
		else modStat |= MODSTAT_NEW;

		if (cipher) modStat |= MODSTAT_CIPHERED;
		if (keyPresent) modStat |= MODSTAT_CIPHERKEYPRESENT;
		retVal[mod->second] = modStat;
	}
	return retVal;
}


/************************************************************************
 * refreshRemoteSourceConfiguration - grab master list of know remote
 * 	sources and integrate it with our configurations.
 */
int InstallMgr::refreshRemoteSourceConfiguration() {

	// assert user disclaimer has been confirmed
	if (!isUserDisclaimerConfirmed()) return -1;

	SWBuf root = (SWBuf)privatePath;
	removeTrailingSlash(root);
	SWBuf masterRepoListPath = root + "/" + masterRepoList;
	InstallSource is("FTP");
	is.source = "ftp.crosswire.org";
	is.directory = "/pub/sword";
	int errorCode = ftpCopy(&is, masterRepoList, masterRepoListPath.c_str(), false);
	if (!errorCode) { //sucessfully downloaded the repo list
		SWConfig masterList(masterRepoListPath);
		SectionMap::iterator sections = masterList.Sections.find("Repos");
		if (sections != masterList.Sections.end()) {
			for (ConfigEntMap::iterator actions = sections->second.begin(); actions != sections->second.end(); actions++) {
				// Search through our current sources and see if we have a matching UID
				InstallSourceMap::iterator it;
				for (it = sources.begin(); it != sources.end(); ++it) {
					// is this our UID?
					if ((it->second) && (it->second->uid == actions->first)) {
						if (actions->second == "REMOVE") {
							// be sure to call save/reload after this
							// or this could be dangerous
							delete it->second;
							it->second = 0;
						}
						else {
							SWBuf key = actions->second.stripPrefix('=');
							if (key == "FTPSource") {
								// we might consider instantiating a temp IS
								// from our config string and then copy only
								// some entries.  This would allow the use to
								// change some fields and not have them overwritten
								// but it seems like we might want to change any
								// of the current fields so we don't do this now
								// InstallSource i("FTP", actions->second);
								delete it->second;
								it->second = new InstallSource("FTP", actions->second.c_str());
								it->second->uid = actions->first;
							}
						}
						break;
					}
				}
				// didn't find our UID, let's add it
				if (it == sources.end()) {
					SWBuf key = actions->second.stripPrefix('=');
					if (key == "FTPSource") {
						if (actions->second != "REMOVE") {
							InstallSource *is = new InstallSource("FTP", actions->second.c_str());
							is->uid = actions->first;
							sources[is->caption] = is;
						}
					}
				}
			}

			// persist and re-read
			saveInstallConf();
			readInstallConf();

			return 0;
		}
	}
	return -1;
}


InstallSource::InstallSource(const char *type, const char *confEnt) {
	this->type = type;
	mgr = 0;
	userData = 0;
	if (confEnt) {
		SWBuf buf = confEnt;
		caption   = buf.stripPrefix('|', true);
		source    = buf.stripPrefix('|', true);
		directory = buf.stripPrefix('|', true);
		u         = buf.stripPrefix('|', true);
		p         = buf.stripPrefix('|', true);
		uid       = buf.stripPrefix('|', true);

		if (!uid.length()) uid = source;

		removeTrailingSlash(directory);
	}
}


InstallSource::~InstallSource() {
	if (mgr)
		delete mgr;
}


void InstallSource::flush() {
	if (mgr) {
		delete mgr;
		mgr = 0;
	}
}


SWMgr *InstallSource::getMgr() {
	if (!mgr)
		// ..., false = don't augment ~home directory.
		mgr = new SWMgr(localShadow.c_str(), true, 0, false, false);
	return mgr;
}


SWORD_NAMESPACE_END

