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
// Download related subroutines
////////////////////////////////////////////////////////////////////////

// Recursively fetches and saves the file and directory url information 
// of a SWORD module. This data is saved in the moduledata object.
function fetchSwordModuleUrls(moduledata, subdirectory) {
  if (!subdirectory) subdirectory = "";

  var directoryUrl = ARMU.getResourceLiteral(MLDS, moduledata.modResource, "ModuleUrl");
  directoryUrl += subdirectory;
  
  // handle local repositories separately
  if ((/^file\:\/\//i).test(directoryUrl)) {
    var aDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    aDir.initWithPath(lpath(directoryUrl.replace(/^file\:\/\//, "")));
    if (!aDir.exists() || !aDir.isDirectory()) {
      ARMU.retainStatusMessage(MLDS, moduledata.modResource, ERROR);
      ARMU.setResourceAttribute(MLDS, moduledata.modResource, "Style", "red");
      jsdump("ERROR: local repository directory problem \"" + aDir.path + "\"");
      return;
    }
    var dirFiles = aDir.directoryEntries;
    while (dirFiles.hasMoreElements()) {
      var file = dirFiles.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (file.isDirectory()) {
        moduledata.directoriesBeingRead++;
        fetchSwordModuleUrls(moduledata, subdirectory + "/" + file.leafName);
      }
      else moduledata.modContentData.push( { url:directoryUrl + "/" + file.leafName, size:file.fileSize } );
    }
    moduledata.directoriesBeingRead--;
    if (moduledata.directoriesBeingRead == 0) downloadModule(moduledata.modResource, moduledata.modContentData);
    
    return;
  }
  
  // request a listing of the remote directory and parse the listing
  var directoryListingFile = ARMU.getModuleListingDirectory(moduledata.modResource);
  directoryListingFile.append(ARMU.getModuleInstallerZipFile(moduledata.modResource).leafName.replace(/\.(zip|xsm)$/, "") + "_" + subdirectory.replace(/\//g, "_"));
      
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  persist.progressListener = 
    {
      moduledata:moduledata,
      subdirectory:(subdirectory ? subdirectory:""),
      
      persist:persist,
      directoryListingFile:directoryListingFile,
      directoryUrl:directoryUrl,
      
      maxPerc:2,
      approxFileSize:2000,
      
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
        // add this download's progress to the existing percentage, but only up to a maximum maxPerc for this download
        var oldperc = ARMU.getResourceLiteral(MLDS, this.moduledata.modResource, "Status");
        if (!(/^\d+\s*\%$/).test(oldperc)) oldperc = 0;
        else oldperc = Number(oldperc.match(/^(\d+)\s*\%$/)[1]);
        if (aCurSelfProgress > this.approxFileSize) aCurSelfProgress = this.approxFileSize;
        var perc = oldperc + Math.round(this.maxPerc*(aCurSelfProgress/this.approxFileSize));
        ARMU.retainStatusMessage(MLDS, this.moduledata.modResource, dString(perc) + "%");
        ARMU.setResourceAttribute(MLDS, this.moduledata.modResource, "Style", "yellow");
      },
      
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
        if (!WindowIsAlive) return;

        ARMU.modulesInProgressRemove(this.persist);

        if (aStatus == 0) {
          
          var data = readFile(this.directoryListingFile);
          
          var files = data.match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/gm);
          var dirs = data.match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/gm);
          
          for (var i=0; dirs && i<dirs.length; i++) {
            // initiate another directory listing
            var subdir = dirs[i].match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/)[1];
            this.moduledata.directoriesBeingRead++;
            fetchSwordModuleUrls(this.moduledata, this.subdirectory + "/" + subdir);
          }
          
          for(i=0; files && i<files.length; i++) {
            // save our file data read from the listing
            var file = files[i].match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/);
            this.moduledata.modContentData.push( { url:this.directoryUrl + "/" + file[1], size:file[2] } );
          }
          
          this.moduledata.directoriesBeingRead--; // must decrement after previous increment possibility?
          if (this.moduledata.directoriesBeingRead == 0) {
         
            var dirListingDir = ARMU.getModuleListingDirectory(this.moduledata.modResource);
            if (dirListingDir.exists()) dirListingDir.remove(true);

            if (this.moduledata.status == 0) {
              // this entire module's contents are now known!
              downloadModule(this.moduledata.modResource, this.moduledata.modContentData);
            }
          }
          
        }
        else {
          this.moduledata.status = 1;
          this.moduledata.directoriesBeingRead--; // must decrement after previous increment possibility?
          ARMU.retainStatusMessage(MLDS, this.moduledata.modResource, ERROR);
          ARMU.setResourceAttribute(MLDS, this.moduledata.modResource, "Style", "red");
          jsdump("ERROR: fetchSwordModuleUrls failed for \"" + this.directoryUrl + "\"");
        }
        
      },
      
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
        ARMU.setResourceAttribute(MLDS, this.moduledata.modResource, "Status", (aMessage ? aMessage:ERROR));
        ARMU.setResourceAttribute(MLDS, this.moduledata.modResource, "Style", "red");
        if (aMessage) jsdump("ERROR: fetchSwordModuleUrls failed for " + this.directoryUrl + ": " + aMessage);
      },
      
      onLocationChange: function(aWebProgress, aRequest, aLocation) {},
      
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    };
  persist.saveURI(ios.newURI(directoryUrl, null, null), null, null, null, null, directoryListingFile, null);
  ARMU.modulesInProgressAdd(persist);
  ARMI.updateRepoListButtons();
}

// Download a module whose contents are listed in modContentData 
// as [ { url:url, size:size }, ... ]. Size is not used unless there
// are multiple modContentData objects.
function downloadModule(modResource, modContentData) {
//for (var i=0; i<modContentData.length; i++) {jsdump(uneval(modContentData[i]));}

  // don't fetch lucene directory or its contents
  for (var i=0; i<modContentData.length; i++) {
    if ((/\/lucene(\/|$)/i).test(modContentData[i].url)) {
      modContentData.splice(i, 1);
      i--;
    }
  }
    
  var repoUrl = ARMU.getResourceLiteral(MLDS, modResource, "Url");
  var moduleDir = ARMU.getModuleDownloadDirectory(modResource);
  var is_XSM_module = ARMU.is_XSM_module(MLDS, modResource);

  var modPath = "";
  if (!is_XSM_module) {
    var modPath = ARMU.getResourceLiteral(MLDS, modResource, "DataPath");
    var p = modPath.split("/");
    for (var i=0; i<p.length; i++) {
      if (!p[i]) continue; // case of dir//subdir
      moduleDir.append(p[i]);
      moduleDir.create(moduleDir.DIRECTORY_TYPE, DPERM);
    }
  }
  
  var downloadedFiles = [];
  if (!is_XSM_module) {
    // the .conf file has already been taken care of
    var modConf = ARMU.getModuleDownloadDirectory(modResource);
    modConf.append("mods.d");
    modConf.append(ARMU.getResourceLiteral(MLDS, modResource, "ConfFileName"));
    downloadedFiles.push(modConf);
  }

  // progress has already been started when the module contents were read
  // so add new progress to this starting value
  var startPerc = ARMU.getResourceLiteral(MLDS, modResource, "Status");
  if (!(/^\d+\s*\%$/).test(startPerc)) startPerc = 0;
  else startPerc = Number(startPerc.match(/^(\d+)\s*\%$/)[1]);
  
  var statusArray = [];
  if (is_XSM_module) {
    // update status of all modules included in this XSM file
    var myKey = ARMU.getResourceLiteral(MLDS, modResource, "ModuleUrl");
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    var elems = RDFC.GetElements();
    while (elems.hasMoreElements()) {
      var elem = elems.getNext();
      var key = ARMU.getResourceLiteral(MLDS, elem, "ModuleUrl");
      if (key == myKey) statusArray.push(elem);
    }
  }
  else statusArray.push(modResource);
  
  var total = 0;
  for (var c=0; c<modContentData.length; c++) {total += Number(modContentData[c].size);}
  
  // this data object is shared by all this module's downloads
  var data = { total:total, current:0, count:1, status:0, downloadedFiles:downloadedFiles }; 
  
  // begin separate download of each module content file
  for (var c=0; c<modContentData.length; c++) {

    var destFile = moduleDir.clone();

    if (is_XSM_module) destFile.append(ARMU.getModuleInstallerZipFile(modResource).leafName);
    else {
      var sub = modContentData[c].url.replace(repoUrl + "/" + modPath + "/", "");
      sub = sub.split("/");
      for (var sd=0; sd<sub.length-1; sd++) {
        if (!sub[sd]) continue; // handle dir//subdir
        destFile.append(sub[sd]);
        if (!destFile.exists()) destFile.create(moduleDir.DIRECTORY_TYPE, DPERM);
      }
      destFile.append(sub[sub.length-1]);
    }

    var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
    var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
    persist.progressListener = 
    {
      data:data,
          
      myResource:modResource,
      myStatusArray:statusArray,
      myURL:modContentData[c].url,
      myDestFile:destFile,
      mySize:Number(modContentData[c].size),
      myLast:0,

      myPersist:persist,
      startPerc:startPerc,
      
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
        this.data.current += this.mySize*aCurSelfProgress/aMaxSelfProgress - this.myLast;
        this.myLast = this.mySize*aCurSelfProgress/aMaxSelfProgress;
        
        var perc = this.startPerc + Math.round((100-this.startPerc)*(this.data.current/this.data.total));
        for (var s=0; s<this.myStatusArray.length; s++) {
          ARMU.retainStatusMessage(MLDS, this.myStatusArray[s], dString(perc) + "%");
          ARMU.setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "yellow");
        }
      },
      
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
        if (!WindowIsAlive) return;
        
        // download finished
        this.data.count--;
        ARMU.modulesInProgressRemove(this.myPersist);
        
        if (aStatus == 0) this.data.downloadedFiles.push(this.myDestFile);
        else this.data.status = 1;
        
        if (this.data.count == 0) {
          
          var is_XSM_module = ARMU.is_XSM_module(MLDS, this.myResource);
          
          if (!this.data.status) {
          
            // then entire module is also complete...
            for (var s=0; s<this.myStatusArray.length; s++) {
              ARMU.setResourceAttribute(MLDS, this.myStatusArray[s], "Status", ON);
              ARMU.setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "green");
            }
            
            var installerZipFile = ARMU.getModuleInstallerZipFile(this.myResource);
            
            // copy the completed module to our install directory
            if (is_XSM_module) {
              this.data.downloadedFiles[0].copyTo(installerZipFile.parent, installerZipFile.leafName);
            }
            else {
              var zipWriter = Components.classes["@mozilla.org/zipwriter;1"].createInstance(Components.interfaces.nsIZipWriter);
              
              zipWriter.open(installerZipFile, 0x02 | 0x08 | 0x20); // PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE
              for (var i=0; i<this.data.downloadedFiles.length; i++) {
                var zipEntry = this.data.downloadedFiles[i].path.replace(/\\/g, "/").replace(/^.*\/(mods\.d|modules)(\/.*?)$/, "$1$2");
                zipWriter.addEntryFile(zipEntry, zipWriter.COMPRESSION_NONE, this.data.downloadedFiles[i], false);
              }
              zipWriter.close();
              
            }
            
          }
          else {
            for (var s=0; s<this.myStatusArray.length; s++) {
              ARMU.retainStatusMessage(MLDS, this.myStatusArray[s], ERROR);
              ARMU.setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "red");
            }
          }
          
          var downDir = ARMU.getModuleDownloadDirectory(this.myResource);
          downDir.remove(true);
          ModulesLoading--;
        
        }
      },
      
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
        for (var s=0; s<this.myStatusArray.length; s++) {
          ARMU.setResourceAttribute(RPDS, this.myStatusArray[s], "Status", (aMessage ? aMessage:ERROR));
          ARMU.setResourceAttribute(RPDS, this.myStatusArray[s], "Style", "red");
        }
        if (aMessage) jsdump("ERROR: downloadModule failed for " + this.myURL + ": " + aMessage);
      },
      
      onLocationChange: function(aWebProgress, aRequest, aLocation) {},
      
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    };
    
    // if it's a file of zero size, persist fails to copy the file... sigh... so here goes the fix...
    var isZeroFile = false;
    var test = modContentData[c].url.match(/^file\:\/\/(.*)$/);
    if (test) {
      var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      aFile.initWithPath(lpath(test[1]));
      if (aFile.exists() && aFile.fileSize == 0) {
        isZeroFile = true;
        aFile.copyTo(destFile.parent, destFile.leafName);
        data.downloadedFiles.push(destFile);
      }
    }
    if (!isZeroFile) {
      persist.saveURI(ios.newURI(modContentData[c].url, null, null), null, null, null, null, destFile, null);
      ARMU.modulesInProgressAdd(persist);
      ARMI.updateRepoListButtons();
      
      if (c<modContentData.length-1) data.count++; // don't increment for last file because count started as "1"
    }
  }
  
}

function checkAllModulesAreDownloaded() {
  if (ModulesLoading !== 0) {
    document.getElementById("apply").setAttribute("disabled", "true");
    return;
  }
  
  window.clearInterval(ModuleCheckInterval);
  ModuleCheckInterval = null;
  
  var mods = ARMU.getInstallableModules();
  if (mods.length) document.getElementById("apply").removeAttribute("disabled");
  else document.getElementById("apply").setAttribute("disabled", "true");
}
