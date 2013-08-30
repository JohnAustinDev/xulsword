/*  This file is part of xulSword.

    Copyright 2013 John Austin (gpl.programs.info@gmail.com)

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


////////////////////////////////////////////////////////////////////////
// // Add Repository Module Download Functions
////////////////////////////////////////////////////////////////////////

ARMD = {
	
/*
	Downloading happens in two separate phases: Querying module contents,
	and downloading module contents. The second phase does not begin until
	the first has totally completed for all active modules. This allows 
	total download size to be predetermined before downloading begins.
*/

////////////////////////////////////////////////////////////////////////
// PHASE 1: QUERYING MODULE CONTENTS
////////////////////////////////////////////////////////////////////////

	ModulesQuerying: [],
	QueryCheckInterval: null,
	
	queryNextModule: function() {
//jsdump("queryNextModule c=" + this.ModulesQuerying.length);

		if (!this.ModulesQuerying.length) return;
		
		// fetch files into separate module directories so that in the end, 
		// only complete downloads will be installed.
		var mod = this.ModulesQuerying[0];
		this.ModulesQuerying.splice(this.ModulesQuerying.indexOf(mod), 1);
		
		var is_XSM_module = ARMU.is_XSM_module(MLDS, mod);
		
		var moduleUrl = ARMU.getResourceLiteral(MLDS, mod, "ModuleUrl");
		var repoUrl = ARMU.getResourceLiteral(MLDS, mod, "Url");
		
		// prompt for audio book and chapters if needed
		if (is_XSM_module && !(/\.(zip|xsm)$/).test(moduleUrl)) {
			
			// is a variety of this audio file already underway?
			var dest = ARMU.getModuleDownloadDirectory(mod);
			var destPathStart = dest.path.replace(/bk[^\/]*$/, "");
			var check = dest.parent.directoryEntries;
			while(check.hasMoreElements()) {
				if (check.getNext().QueryInterface(Components.interfaces.nsILocalFile).path.indexOf(destPathStart) == 0) {
					jsdump("INFO: Audio download is already underway");
					// leave status
					this.queryNextModule();
					return;
				}
			}
			
			// get info about available audio books and chapters and get user's choice
			var modConf = ARMU.getRepositoryUrlTempDir(repoUrl);
			modConf.append("mods.d");
			modConf.append(ARMU.getResourceLiteral(MLDS, mod, "ConfFileName"));
			var data = { ok:false, bk:null, ch:null, cl:null, audio:eval(ARMU.getConfEntry(readFile(modConf), "AudioChapters")) };
			var dlg = window.openDialog("chrome://xulsword/content/dialogs/addRepositoryModule/audioDialog.xul", "dlg", DLGSTD, data);
			if (!data.ok || !data.bk || !data.ch || !data.cl) {
				jsdump("INFO: User canceled audio prompt");
				ARMU.revertStatus(MLDS, mod);
				this.queryNextModule();
				return;
			}
			
			moduleUrl = ARMU.getResourceLiteral(MLDS, mod, "DataPath") + "&bk=" + data.bk + "&ch=" + data.ch + "&cl=" + data.cl;
			ARMU.setResourceAttribute(MLDS, mod, "ModuleUrl", moduleUrl);
		}
		
		// don't download something that has already been succesfully downloaded!
		if (ARMU.getModuleInstallerZipFile(mod).exists()) {
			jsdump("INFO: Download already complete");
			ARMU.setStatus(MLDS, mod, ON, "green");
			this.queryNextModule();
			return;
		}
		
		// all module downloads will go under "downloads/subdir/"
		// this directory will be deleted once download is copied so
		// don't allow another download until this one is done
		var dest = ARMU.getModuleDownloadDirectory(mod);
		if (dest.exists()) {
			jsdump("INFO: Download is already underway");
			// leave status
			this.queryNextModule();
			return;
		}
		dest.create(dest.DIRECTORY_TYPE, DPERM);
		
		if (!is_XSM_module) {
			
			// first, copy .conf file from local dir to "downloads/modName/mods.d"
			var modsdDir = dest.clone();
			modsdDir.append("mods.d");
			if (!modsdDir.exists()) modsdDir.create(modsdDir.DIRECTORY_TYPE, DPERM);
			
			var confSource;
			if ((/^file\:\/\//i).test(repoUrl)) {
				confSource = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				try {confSource.initWithPath(lpath(repoUrl.replace(/^file\:\/\//, "")));}
        catch (er) {jsdump("ERROR: " + er); confSource = null;}
			}
			else confSource = ARMU.getRepositoryUrlTempDir(repoUrl);
      if (confSource) {
        confSource.append("mods.d");
        confSource.append(ARMU.getResourceLiteral(MLDS, mod, "ConfFileName"));
      }
			if (!confSource || !confSource.exists()) {
				dest.remove(true);
				jsdump("ERROR: Conf file doesn't exist \"" + (confSource ? confSource.path:lpath(repoUrl.replace(/^file\:\/\//, ""))) + "\".");
				ARMU.setStatus(MLDS, mod, ERROR, "red");
				this.queryNextModule();
				return;
			}
			confSource.copyTo(modsdDir, null);
		}
		
		var moduleListingDir = ARMU.getModuleListingDirectory(mod);
		if (moduleListingDir.exists()) moduleListingDir.remove(true);
		moduleListingDir.create(moduleListingDir.DIRECTORY_TYPE, DPERM);
	
		ARMU.setStatus(MLDS, mod, dString(1) + "%", "yellow");
		
		// fetchModuleUrls will call addNewDownload() for each module file,  
		// and checkAllQueriesAreCompleted will watch for completion.
		this.fetchModuleUrls( { modResource:mod, modContentData:[], status:0} );
	},
	
	// Recursively fetches and saves the file and directory url information 
	// of a SWORD or XSM module. This data is saved in the module object.
	fetchModuleUrls: function(module, subdirectory) {
		if (!subdirectory) subdirectory = "";

		var directoryUrl = ARMU.getResourceLiteral(MLDS, module.modResource, "ModuleUrl");
		directoryUrl += subdirectory;
		
		// handle local repositories separately
		if ((/^file\:\/\//i).test(directoryUrl)) {
			var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try {aFile.initWithPath(lpath(directoryUrl.replace(/^file\:\/\//, "")));}
      catch (er) {jsdump("ERROR: " + er); aFile = null;}
			if (!aFile || !aFile.exists()) {
				jsdump("ERROR: local repository directory problem \"" + (aFile ? aFile.path:lpath(directoryUrl.replace(/^file\:\/\//, ""))) + "\"");
				ARMU.setStatus(MLDS, module.modResource, ERROR, "red");
				var downDir = ARMU.getModuleDownloadDirectory(module.modResource);
				if (downDir.exists()) downDir.remove(true);
				this.queryNextModule();
				return;
			}
			if (aFile.isDirectory()) {
				var dirFiles = aFile.directoryEntries;
				while (dirFiles.hasMoreElements()) {
					var file = dirFiles.getNext().QueryInterface(Components.interfaces.nsILocalFile);
					if (file.isDirectory()) {
						this.fetchModuleUrls(module, subdirectory + "/" + file.leafName);
					}
					else module.modContentData.push( { url:directoryUrl + "/" + file.leafName, size:file.fileSize } );
				}
			}
			else module.modContentData.push( { url:directoryUrl, size:aFile.fileSize } );

			// do this only once after module is entirely read
			if (!subdirectory) {
				this.addNewDownload( { modResource:module.modResource, modContentData:module.modContentData } );
				this.queryNextModule();
			}
			
			return;
		}
		
		// request a listing of the remote directory and parse the listing
		var directoryListingFile = ARMU.getModuleListingDirectory(module.modResource);
		directoryListingFile.append(ARMU.getModuleInstallerZipFile(module.modResource).leafName.replace(/\.(zip|xsm)$/, "") + "_" + subdirectory.replace(/\//g, "_"));
		
		// XSM modules are queried slightly differently
		if (ARMU.is_XSM_module(MLDS, module.modResource)) {
			
			// if this is an xsm or zip file, get the parent directory listing 
			// now, and search for the particular file size later
			if ((/\/[^\/]*\.(zip|xsm)$/).test(directoryUrl)) 
					directoryUrl = directoryUrl.replace(/\/[^\/]*\.(zip|xsm)$/, "");
					
			// otherwise, this is a dynamically generated file, whose contents
			// cannot be known until downloading begins.
			else {
				this.addNewDownload( {
					modResource:module.modResource, 
					modContentData:[ { url:directoryUrl, size:-1 } ] 
				} );
				this.queryNextModule();
				return;
			}
			
		}
				
		var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
		if (!USE_CACHE) persist.persistFlags |= PERSIST_FLAGS_BYPASS_CACHE;
		
		persist.progressListener = 
		{
			module:module,
			subdirectory:(subdirectory ? subdirectory:""),
			
			persist:persist,
			directoryListingFile:directoryListingFile,
			directoryUrl:directoryUrl,
			
			onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
				ARMU.setStatus(MLDS, this.module.modResource, dString(2) + "%", "yellow");
			},
			
			onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
				if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
				if (WindowIsClosing) return;

				// finished directory query
				ARMU.webRemove(this.persist);
				
				var is_XSM_module = ARMU.is_XSM_module(MLDS, this.module.modResource);

				if (aStatus == 0) {
					
					var data = readFile(this.directoryListingFile);
			
					var files = data.match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/gm);
					var dirs = data.match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/gm);
					
					for (var i=0; dirs && !is_XSM_module && i<dirs.length; i++) {
						// initiate another directory listing
						var subdir = dirs[i].match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/)[1];
						ARMD.fetchModuleUrls(this.module, this.subdirectory + "/" + subdir);
					}
					
					if (is_XSM_module) {
						var XSM_size = -1;
						var file = ARMU.getResourceLiteral(MLDS, this.module.modResource, "ModuleUrl").match(/\/([^\/]*)$/)[1];
						for (i=0; files && i<files.length; i++) {
							var m = files[i].match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/);
							if (m[1] != file) continue;
							XSM_size = Number(m[2]);
						}
						this.module.modContentData.push( { url:this.directoryUrl + "/" + file, size:XSM_size } );
					}
					else {
						for (i=0; files && i<files.length; i++) {
							var file = files[i].match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/);
							// save our file data read from the listing
							this.module.modContentData.push( { url:this.directoryUrl + "/" + file[1], size:file[2] } );
						}
					}
					
				}
				else {
					
					// this listing is not necessary for XSM modules, but only improves ProgressBar feedback.
					if (is_XSM_module) {
						var file = ARMU.getResourceLiteral(MLDS, this.module.modResource, "ModuleUrl").match(/\/([^\/]*)$/)[1];
						this.module.modContentData.push( { url:this.directoryUrl + "/" + file, size:-1 } );
						jsdump("WARN: fetchModuleUrls failed for \"" + this.directoryUrl + "\"");
					}
					else {
						this.module.status = 1;
						ARMU.setStatus(MLDS, this.module.modResource, dString(0) + "%", "");
						jsdump("ERROR: fetchModuleUrls failed for \"" + this.directoryUrl + "\"");
						var downDir = ARMU.getModuleDownloadDirectory(this.module.modResource);
						if (downDir.exists()) downDir.remove(true);
					}
					
				}
				
				var stillWorking = 0;
				for (var p=0; p<Web.length; p++) {
					if (
						Web[p].type == "moduleListing" && 
						Web[p].group == this.module.modResource.ValueUTF8
					) stillWorking++;
				}
				
				if (!stillWorking) {
					var dirListingDir = ARMU.getModuleListingDirectory(this.module.modResource);
					if (dirListingDir.exists()) dirListingDir.remove(true);

					if (this.module.status == 0) {
						// this entire module's contents are now known!
						ARMD.addNewDownload( {modResource:this.module.modResource, modContentData:this.module.modContentData } );
					}
					ARMD.queryNextModule();
				}
				
			},
			
			onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
				ARMU.setStatus(MLDS, this.module.modResource, (aMessage ? aMessage:ERROR), "red");
				if (aMessage) jsdump("ERROR: fetchModuleUrls failed for " + this.directoryUrl + ": " + aMessage);
			},
			
			onLocationChange: function(aWebProgress, aRequest, aLocation) {},
			
			onSecurityChange: function(aWebProgress, aRequest, aState) {}
		};

		persist.saveURI(ios.newURI(directoryUrl, null, null), null, null, null, null, directoryListingFile, null);
		ARMU.webAdd(persist, "moduleListing", module.modResource.ValueUTF8, directoryUrl);
		
		if (!SYNC) this.queryNextModule();
	},
	
	check1: {},
	check2: {},
	addNewDownload: function(modobj) {
		
		// never download lucene directory or its contents
		for (var i=0; i<modobj.modContentData.length; i++) {
			if ((/\/lucene(\/|$)/i).test(modobj.modContentData[i].url)) {
				modobj.modContentData.splice(i, 1);
				i--;
			}
		}
				
		this.ModulesDownloading.push(modobj);
		
		// add module file sizes to progress meter and do some sanity checks
		for (var f=0; f<modobj.modContentData.length; f++) {
			var size = Number(modobj.modContentData[f].size);
			if (size < 0) continue; // -1 means unknown until download begins
			
			ProgressBar.max = Number(ProgressBar.max) + Number(size);
			
			if (this.check1.hasOwnProperty(encodeURI(modobj.modContentData[f].url)))
					jsdump("REPEATED DOWNLOAD SCHEDULED " + modobj.modContentData[f].url);
			this.check1[encodeURI(modobj.modContentData[f].url)] = modobj.modContentData[f].size;
//jsdump("Added file for download: " + modobj.modContentData[f].url);
		}
		
	},
	
	checkAllQueriesAreCompleted: function() {
		if (this.ModulesQuerying.length) return;
		for (var p=0; p<Web.length; p++) {
			if (Web[p].type == "moduleListing") return;
		}
		
		window.clearInterval(this.QueryCheckInterval);
		this.QueryCheckInterval = null;
		
		if (!ARMD.ModuleCheckInterval) ARMD.ModuleCheckInterval = window.setInterval("ARMD.checkAllModulesAreDownloaded();", 200);
		
		// start the file download process...
		this.downloadNextModule();
	},
	
////////////////////////////////////////////////////////////////////////
// PHASE 2: DOWNLOADING MODULE CONTENTS
////////////////////////////////////////////////////////////////////////

	ModulesDownloading: [],
	ModuleCheckInterval: null,
	
	downloadNextModule: function() {
//jsdump("downloadNextModule c=" + this.ModulesDownloading.length);

		if (!this.ModulesDownloading.length) return;
		
		// Download a module whose contents are listed in module.modContentData 
		// as [ { url:url, size:size }, ... ].
		// this module object is shared by all this module's downloads
		var module = this.ModulesDownloading[0];
		this.ModulesDownloading.splice(this.ModulesDownloading.indexOf(module), 1);
			
		module.moduleDir = ARMU.getModuleDownloadDirectory(module.modResource);

		if (!ARMU.is_XSM_module(MLDS, module.modResource)) {
			var p = ARMU.getResourceLiteral(MLDS, module.modResource, "DataPath").split("/");
			for (var i=0; i<p.length; i++) {
				if (!p[i]) contine; // case of dir//subdir
				module.moduleDir.append(p[i]);
				module.moduleDir.create(module.moduleDir.DIRECTORY_TYPE, DPERM);
			}
		}
		
		module.downloadedFiles = [];
		if (!ARMU.is_XSM_module(MLDS, module.modResource)) {
			// the .conf file has already been taken care of
			var modConf = ARMU.getModuleDownloadDirectory(module.modResource);
			modConf.append("mods.d");
			modConf.append(ARMU.getResourceLiteral(MLDS, module.modResource, "ConfFileName"));
			module.downloadedFiles.push(modConf);
		}
		
		var total = 0;
		for (var c=0; c<module.modContentData.length; c++) {
			var size = Number(module.modContentData[c].size);
			if (size < 0) continue;
			total += size;
		}
		module.total = total; 
		module.current = 0; 
		module.status = 0;
		
		this.downloadNextFile(module);
	},
	
	downloadNextFile: function(module) {
//jsdump("downloadNextFile c=" + module.modContentData.length);
		
		if (!module.modContentData.length) {
			this.downloadNextModule();
			return;
		}
		
		var aContentData = module.modContentData[0];
		module.modContentData.splice(module.modContentData.indexOf(aContentData), 1);
		
		// begin separate download of each module content file
		var destFile = module.moduleDir.clone();

		if (ARMU.is_XSM_module(MLDS, module.modResource)) {
			destFile.append(ARMU.getModuleInstallerZipFile(module.modResource).leafName);
		}
		else {
			var url = ARMU.getResourceLiteral(MLDS, module.modResource, "Url").replace("\\", "/", "g");
			var datapath = ARMU.getResourceLiteral(MLDS, module.modResource, "DataPath");
			var sub = aContentData.url.replace("\\", "/", "g").replace(url + "/" + datapath + "/", "");
			sub = sub.split("/");
			for (var sd=0; sd<sub.length-1; sd++) {
				if (!sub[sd]) return; // handle dir//subdir
				destFile.append(sub[sd]);
				if (!destFile.exists()) destFile.create(destFile.DIRECTORY_TYPE, DPERM);
			}
			destFile.append(sub[sub.length-1]);
		}

		var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
		var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
		if (!USE_CACHE) persist.persistFlags |= PERSIST_FLAGS_BYPASS_CACHE;

		persist.progressListener = 
		{
			module:module,
			myDestFile:destFile,
			
			mySize:aContentData.size,
			myLastProgress:-1,

			myPersist:persist,
			
			onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
				// if this is first progress, get any missing info...
				if (this.myLastProgress == -1) {
					this.myLastProgress = 0;
					if (this.mySize == -1) { // -1 means unknown until download begins
						this.mySize = aMaxSelfProgress;
						this.module.total += aMaxSelfProgress;
						ProgressBar.max = Number(ProgressBar.max) + Number(aMaxSelfProgress);
					}
				}
				
				var thisProgress = this.mySize*(aCurSelfProgress/aMaxSelfProgress);
				
				// update total downloads progress bar
				ProgressBar.value = Number(ProgressBar.value) + Number(thisProgress) - Number(this.myLastProgress);
				ProgressBar.mode = "determined";
				
				// update status of this module (which is MORE than this download alone)
				this.module.current += thisProgress - this.myLastProgress;
				var perc = Math.round(100*(this.module.current/this.module.total));
				if (perc < 2) perc = 2; // was 2 by the time progress got here
				ARMU.setStatus(MLDS, this.module.modResource, dString(perc) + "%", "yellow");
				
				this.myLastProgress = thisProgress;
				
			},
			
			onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
				if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
				if (WindowIsClosing) return;
				
				// finished file download		
				ARMU.webRemove(this.myPersist);

				if (ARMD.check2.hasOwnProperty(aRequest.name)) 
						jsdump("REPEATED DOWNLOAD " + aRequest.name);
				ARMD.check2[aRequest.name] = Number(this.mySize);

				// update manifest total progress bar
				ProgressBar.value = Number(ProgressBar.value) + Number(this.mySize) - Number(this.myLastProgress);
				
				if (aStatus == 0) {
					this.module.downloadedFiles.push(this.myDestFile);
				}
				else {
					this.module.status = 1;
					var cancel = [];
					for (var p=0; p<Web.length; p++) {
						if (Web[p].type != "moduleFile" || Web[p].group != this.module.modResource.ValueUTF8) continue;
						cancel.push(Web[p].persist);
					}
					for (var p=0; p<cancel.length; p++) {cancel[p].cancelSave();}
				}
				
				ARMD.checkModuleComplete(this.module);
				ARMD.downloadNextFile(this.module);
			},
			
			onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
				var msg = ERROR + ": " + (aRequest ? aRequest.name:"null") + "\n\n" + (aMessage ? aMessage:"null") + "\n\nstatus=0x" + (aStatus ? aStatus.toString(16):"null");
				ARMU.setStatus(MLDS, this.module.modResource, msg, "red");
				jsdump(msg);
			},
			
			onLocationChange: function(aWebProgress, aRequest, aLocation) {},
			
			onSecurityChange: function(aWebProgress, aRequest, aState) {}
		};
		
		// if it's a file of zero size, persist fails to copy the file... sigh... so here goes the fix...
		var isZeroFile = false;
		var test = aContentData.url.match(/^file\:\/\/(.*)$/);
		if (test) {
			var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try {aFile.initWithPath(lpath(test[1]));}
      catch (er) {jsdump("ERROR: " + er); aFile = null;}
			if (aFile && aFile.exists() && aFile.fileSize == 0) {
				isZeroFile = true;
				aFile.copyTo(destFile.parent, destFile.leafName);
				module.downloadedFiles.push(destFile);
				this.checkModuleComplete(module);
			}
		}
		if (!isZeroFile) {
			persist.saveURI(ios.newURI(aContentData.url, null, null), null, null, null, null, destFile, null);
			ARMU.webAdd(persist, "moduleFile", module.modResource.ValueUTF8, aContentData.url);
		}
		
		if (!SYNC) this.downloadNextFile(module);
		
	},
	
	checkModuleComplete: function(module) {
	
		var stillWorking = module.modContentData.length;
		for (var p=0; p<Web.length; p++) {
			if (Web[p].type == "moduleFile" && Web[p].group == module.modResource.ValueUTF8) {
				stillWorking++;
			}
		}
		
		if (stillWorking) return;
			
		var is_XSM_module = ARMU.is_XSM_module(MLDS, module.modResource);
		
		// then entire module is complete...
		if (!module.status) {
		
			ARMU.setStatus(MLDS, module.modResource, ON, "green");
			
			var installerZipFile = ARMU.getModuleInstallerZipFile(module.modResource);
			
			// check output files
			var ok = true;
			for (var i=0; i<module.downloadedFiles.length; i++) {
				if (module.downloadedFiles[i].exists()) continue;
				jsdump("ERROR: Local downloaded file does not exist:" + module.downloadedFiles[i].path);
				ok = false;
			}
			
			if (!ok) {
				ARMU.setStatus(MLDS, module.modResource, ERROR, "red");
				USE_CACHE = false; // cache sometimes returns empty files without throwing any errors
			}
			else {
				// copy the completed module to our install directory
				if (is_XSM_module) {
					module.downloadedFiles[0].copyTo(installerZipFile.parent, installerZipFile.leafName);
				}
				else {
					var zipWriter = Components.classes["@mozilla.org/zipwriter;1"].createInstance(Components.interfaces.nsIZipWriter);
					
					zipWriter.open(installerZipFile, 0x02 | 0x08 | 0x20); // PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE
					for (var i=0; i<module.downloadedFiles.length; i++) {
						var zipEntry = module.downloadedFiles[i].path.replace(/\\/g, "/").replace(/^.*\/(mods\.d|modules)(\/.*?)$/, "$1$2");
						zipWriter.addEntryFile(zipEntry, zipWriter.COMPRESSION_NONE, module.downloadedFiles[i], false);
					}
					zipWriter.close();
				}
			}
			
		}
		else ARMU.setStatus(MLDS, module.modResource, dString(0) + "%", "");
		
		var downDir = ARMU.getModuleDownloadDirectory(module.modResource);
		if (downDir.exists()) downDir.remove(true);
	},

	lastProgressValue:0,
	lastProgressTime:null,
	lastRateTime:null,
	averagedRate:null,
	
	UPDATE_PROGRESS_MS:1000,
	UPDATE_RATE_MS:5000,
	
	checkAllModulesAreDownloaded: function() {
		
		var done = true;
		done &= !this.ModulesQuerying.length
		done &= !this.ModulesDownloading.length
		for (var p=0; p<Web.length; p++) {
			if (Web[p].type == "moduleFile" || Web[p].type == "moduleListing") done = false;
		}
	
		if (!done) {
			document.getElementById("apply").setAttribute("disabled", "true");
			
			// update the time remaining as required
			var time = new Date().getTime();
			if (!this.lastProgressTime) {
				this.lastProgressTime = time;
				this.lastRateTime = time;
			}
			if (time - this.lastProgressTime >= this.UPDATE_PROGRESS_MS) {
				this.lastProgressTime = time;
				
				// update average download rate as required
				if (time - this.lastRateTime >= this.UPDATE_RATE_MS) {
					this.lastRateTime = time;
					var pbv = Number(ProgressBar.value);
					var pbl = Number(this.lastProgressValue);
					var r = Number(this.UPDATE_RATE_MS);
					this.averagedRate = 1000 * ((pbv - pbl)/r);
					this.lastProgressValue = ProgressBar.value;
				}
				
				// display new time remaining to user
				if (this.averagedRate) {
					var secondsLeft = Math.round((Number(ProgressBar.max) - Number(ProgressBar.value))/this.averagedRate);
					if (secondsLeft < 0) secondsLeft = 0;
					var s = secondsLeft%60; 
					var m = ((secondsLeft - s)/60)%60;
					var h = (secondsLeft - s - 60*m)/3600;
					s = (s < 10 ? "0":"") + String(s);
					m = (m < 10 ? "0":"") + String(m);
					h = (h < 10 ? "0":"") + String(h);
					document.getElementById("timeRemaining").value = (h ? h + ":":"") + (m ? m + ":":"") + s;
				}
			}
			
			return;
		}
		
		window.clearInterval(this.ModuleCheckInterval);
		this.ModuleCheckInterval = null;
		
		// do some sanity checking and error reporting
		for (var t in this.check1) {
			if (!this.check2.hasOwnProperty(t)) jsdump("WARN: Download file is missing: " + t);
			else if (this.check1[t] != this.check2[t]) jsdump("ERROR: Scheduled-download-size:" + this.check1[t] + " <> actual-size:" + this.check2[t]);
		}
		for (var t in ARMD.check2) {
			if (!this.check1.hasOwnProperty(t)) jsdump("WARN: Query file is missing: " + t);
		}
		this.check1 = {};
		this.check2 = {};
		
		ProgressBar.max = 0;
		ProgressBar.value = 0;
		ProgressBar.mode = "undetermined";
		ProgressBar.hidden = true;
		
		document.getElementById("timeRemaining").value = "";
		
		var mods = ARMU.getInstallableModules();
		if (mods.length) document.getElementById("apply").removeAttribute("disabled");
		else document.getElementById("apply").setAttribute("disabled", "true");
	}

}
