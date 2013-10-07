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

/*

	IMPLEMENTATION NOTE:
	
	This implementation does not use the libsword install manager API. It 
	would be rather difficult to create a libxulsword Javascript interface to
	implement the SWORD API, and doing so would not make XUL's RDF database
	coding any simpler anyway. But the major advantage of this implemen-
	tation is that it makes full use of Firefox's powerful simultaneous, 
	asynchronous download capability. This works faster, allows simultaneous 
	download of many modules, allows the user to continue using xulsword 
	(including the install manager itself) while waiting for downloads to 
	finish, and provides more user feedback.
	
	Another reason is this implementation also supports XSM (xulsword module) 
	repositories and audio module repositories as well as traditional SWORD repos.

*/

const RepositoryRDF = "repositoryDefaults.rdf";
const ModuleRDF = "addRepositoryModule.rdf";
const ManifestFile = "mods.d.tar.gz";
const ON = String.fromCharCode(9745);
const OFF =  String.fromCharCode(9746);
const EmptyRepoSite = "file://";
const SCRIPT_PROPS = "dialogs/addRepositoryModule/addRepositoryModule.properties";
const MAX_CONNECTIONS = 7;
const PERSIST_FLAGS_BYPASS_CACHE = 2;

var RP, RPDS, MLDS, RDF, RDFC, RDFCU; // RDF database related globals
var RepositoryArray, RepositoryIndex;
var ManifestsLoading, ManifestCheckInterval;
var Web = [];
var TEMP, TEMP_Install;
var ProgressBar;
var WindowIsClosing = false;
var MyStrings = null;
var ERROR = null;
var PromptUpdateMods = { prompt:false, mods:[] };

var SYNC = false;
var USE_CACHE = false;

var ARMU; // defined in utilities.js
var ARMI; // defined in interfaceFuncs.js
var ARMD; // defined in download.js

function onLoad() {
	
  RepositoryArray = []; // must not be undefined from the get-go
  RepositoryIndex = -1;
  ManifestsLoading = 0;
	
	MyStrings = getCurrentLocaleBundle(SCRIPT_PROPS);
	if (!MyStrings) {
		jsdump("ERROR: No current locale string bundle \"" + SCRIPT_PROPS + "\"");
		window.close; 
		return;
	}
  
  initCSS();
  
  ERROR = MyStrings.GetStringFromName("arm.error");

  document.title = fixWindowTitle(getDataUI("menu.addNewModule.label"));

  ProgressBar = document.getElementById("progressBar");
  
  document.getElementById("repoListLabel").value = MyStrings.GetStringFromName("arm.repositoryTreeTitle");
  
  // start with totally clean temp directories
  TEMP = getSpecialDirectory("TmpD");
  TEMP.append("xs_addRepositoryModule_" + String(Math.round(10000*Math.random())));
  if (TEMP.exists()) TEMP.remove(true);
  TEMP.create(TEMP.DIRECTORY_TYPE, DPERM);
  
  TEMP_Install = getSpecialDirectory("TmpD");
  TEMP_Install.append("xs_addRepositoryModule_Install");
  if (TEMP_Install.exists()) TEMP_Install.remove(true);
  TEMP_Install.create(TEMP_Install.DIRECTORY_TYPE, DPERM);
  
  // init Data Source utility globals
  RP = {};
  RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
  RDFC = Components.classes["@mozilla.org/rdf/container;1"].createInstance(Components.interfaces.nsIRDFContainer);
  RDFCU = Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils);
  
  RP.ROOT               = "http://www.xulsword.com/repository";
  RP.REPOSITORY         = RP.ROOT + "/rdf#";
  
  // special resources
  RP.masterRepoListID   = RP.ROOT + "/masterRepoList";
  RP.XulswordRepoListID = RP.ROOT + "/xulswordRepoList";
  RP.LanguageListID     = RP.ROOT + "/LanguageList";
  RP.ModuleListID       = RP.ROOT + "/ModuleList";
  RP.CrossWireRepoID    = RP.ROOT + "/CrossWire";
  
  // possible values of ResourceType
  RP.XSM_ModuleType   = RDF.GetLiteral("xsm_module");
  RP.SWORD_ModuleType = RDF.GetLiteral("sword_module");
  RP.LanguageListType = RDF.GetLiteral("language");
  RP.RepositoryType   = RDF.GetLiteral("repository");
  RP.MasterRepoList   = RDF.GetLiteral("masterRepoList");
  
  RP.True             = RDF.GetLiteral("true");
  RP.False            = RDF.GetLiteral("false");
  
  // initialize RPDS Data Source with CrossWire info...
  var data = "\
<?xml version=\"1.0\"?>" + NEWLINE + "\
<RDF:RDF xmlns:REPOSITORY=\"" + RP.REPOSITORY + "\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
  <RDF:Description RDF:about=\"http://www.xulsword.com/repository/CrossWire\"" + NEWLINE + "\
           REPOSITORY:ResourceType=\"repository\"" + NEWLINE + "\
           REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
           REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
           REPOSITORY:Path=\"/pub/sword/raw\"" + NEWLINE + "\
           REPOSITORY:Url=\"ftp://ftp.crosswire.org/pub/sword/raw\"" + NEWLINE + "\
           REPOSITORY:Enabled=\"true\" />" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.masterRepoListID + "\"" + NEWLINE + "\
                   REPOSITORY:ResourceType=\"masterRepoList\"" + NEWLINE + "\
                   REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/sword/masterRepoList.conf\" />" + NEWLINE + "\
  <RDF:Seq RDF:about=\"" + RP.XulswordRepoListID + "\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"http://www.xulsword.com/repository/CrossWire\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
</RDF:RDF>";
  RPDS = initDataSource(data, RepositoryRDF);

  // initialize MLDS Data Source from scratch each time (all this data is  
  // wiped every time the window is closed)
  data = "\
<?xml version=\"1.0\"?>" + NEWLINE + "\
<RDF:RDF xmlns:REPOSITORY=\"" + RP.REPOSITORY + "\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
</RDF:RDF>";
  MLDS = initDataSource(data, ModuleRDF);
  RDFCU.MakeSeq(MLDS, RDF.GetResource(RP.LanguageListID));
  RDFCU.MakeSeq(MLDS, RDF.GetResource(RP.ModuleListID));
  
  if (!RPDS || !MLDS) {
    throw("ERROR: Failed to load a Data Source!");
  }

  // look for a default data source, load it, and use it to augment other 
  // data sources. This is used to apply installation specific repos and 
  // modules which are found in a xsDefaults/RepositoryRDF file. 
  var defDS = null;
  var defRDF = getSpecialDirectory("xsDefaults");
  defRDF.append(RepositoryRDF);
  if (defRDF.exists()) {

    defDS = RDF.GetDataSourceBlocking(encodeURI("File://" + defRDF.path.replace("\\", "/", "g")));
    
    if (defDS) {
      // add any repositories
      RDFC.Init(defDS, RDF.GetResource(RP.XulswordRepoListID));
      var repos = RDFC.GetElements();
      while (repos.hasMoreElements()) {
        var repo = repos.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        var rinfo = {};
        var arcsOut = defDS.ArcLabelsOut(repo);
        while (arcsOut.hasMoreElements()) {
          var arc = arcsOut.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
          var attrib = arc.ValueUTF8.replace(RP.REPOSITORY, "");
          var val = ARMU.getResourceLiteral(defDS, repo, attrib);
          rinfo[attrib] = val;
        }
        if (!ARMU.existsRepository(rinfo)) ARMU.createRepository(rinfo);
      }
      // add any modules
      RDFC.Init(defDS, RDF.GetResource(RP.ModuleListID));
      var mods = RDFC.GetElements();
      while (mods.hasMoreElements()) {
        var mod = mods.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
        
        // add readable (localized) attribute(s) and status to module
        var modDrv = ARMU.getResourceLiteral(defDS, mod, "ModDrv");
        if (!modDrv || modDrv == NOTFOUND) {
					jsdump("ERROR: a default module is missing the \"ModDrv\" .conf attribute.");
					continue;
				}
        
        RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
        RDFC.AppendElement(mod);
        
        MLDS.Assert(
					mod, 
					RDF.GetResource(RP.REPOSITORY+"TypeReadable"), 
					RDF.GetLiteral(ARMU.getTypeReadable(defDS, mod)), 
					true
				);
				
        MLDS.Assert(
					mod, 
					RDF.GetResource(RP.REPOSITORY + "LangReadable"), 
					RDF.GetLiteral(ARMU.getLangReadable(ARMU.getResourceLiteral(defDS, mod, "Lang"))), 
					true
				);
				
				MLDS.Assert(
					mod, 
					RDF.GetResource(RP.REPOSITORY + "Status"), 
					RDF.GetLiteral(dString(0) + "%"), 
					true
				);
        
        arcsOut = defDS.ArcLabelsOut(mod);
        while (arcsOut.hasMoreElements()) {
          arc = arcsOut.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
          var targ = defDS.GetTarget(mod, arc, true);
          MLDS.Assert(mod, arc, targ, true);
        }
        
      }
    }
    
  }
  
  // init the status of all database repositories to 0%
  var ress = RPDS.GetAllResources();
  while(ress.hasMoreElements()) {
    var res = ress.getNext();
    var enabled = RPDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY+"Enabled"), true);
    if (enabled) {
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      ARMU.setStatus(
				RPDS, 
				res, 
				(navigator.onLine ? (enabled == "false" ? OFF:dString(1) + "%"):ERROR), 
				(navigator.onLine ? (enabled == "false" ? "red":"yellow"):"red")
			);
    }
  }
  if (!navigator.onLine) document.getElementById('body').setAttribute('showRepositoryList', 'true');
  
  // add our datasource to the repository tree
  ARMU.treeDataSource([false], ["repoListTree"]);
  
  // add an event handler to allow repoListTree editing
  document.getElementById("repoListTree").stopEditing = 
  function(accept) {
    if (!this._editingColumn)
      return;
    var input = this.inputField;
    var editingRow = this._editingRow;
    var editingColumn = this._editingColumn;
    this._editingRow = -1;
    this._editingColumn = null;
    if (accept) {
      var repoResource = this.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(editingRow);
      var oldUrl = ARMU.getResourceLiteral(RPDS, repoResource, "Url");
      var oldValue = ARMU.getResourceLiteral(RPDS, repoResource, editingColumn.id);
      var newValue = (!(/^\s*$/).test(input.value) ? input.value:"?");

      if (newValue != "?") {
      
        // save new value
        ARMU.setResourceAttribute(RPDS, repoResource, editingColumn.id, newValue);
        
        var name = ARMU.getResourceLiteral(RPDS, repoResource, "Name");
        var site = ARMU.getResourceLiteral(RPDS, repoResource, "Site");
        var path = ARMU.getResourceLiteral(RPDS, repoResource, "Path");
        
        // delete old repo and create a new one if it has been changed
        if (editingColumn.id != "Name" && oldValue != newValue && site != "?" && path != "?") {
          ARMU.treeDataSource([true, true], ["languageListTree", "moduleListTree"]);
          ARMU.deleteRepository([repoResource]);
          var nres = { 
            ResourceType:"repository", 
            Enabled:"true", 
            Name:name, 
            Site:site, 
            Path:path, 
            Status:dString(0) + "%", 
            Style:"yellow", 
            Url:ARMU.guessProtocol(site, path)
          };
          var res = ARMU.createRepository(nres);
          loadRepositories([res], true);
        }
      }
      
    }
    input.hidden = true;
    input.value = "";
    this.removeAttribute("editing");
  };
  
  window.setTimeout("checkInternetPermission();", 1);
}

function checkInternetPermission() {
  
  //prefs.clearUserPref("HaveInternetPermission");

  // don't allow access to internet until we have express permission!
  var haveInternetPermission = getPrefOrCreate("HaveInternetPermission", "Bool", false);

  if (!haveInternetPermission) {
    var title = MyStrings.GetStringFromName("arm.internetPromptTitle");
    var msg = MyStrings.GetStringFromName("arm.internetPromptMessage");
    msg += "\n\n";
    msg += MyStrings.GetStringFromName("arm.wishToContinue");
    var cbText = MyStrings.GetStringFromName("arm.rememberMyChoice");

    var result = {};
    var dlg = window.openDialog(
				"chrome://xulsword/content/dialogs/dialog/dialog.xul",
				"dlg",
				DLGSTD,
				result,
        fixWindowTitle(title),
        msg,
        DLGALERT,
        DLGYESNO,
        null,
        null,
        cbText
    );
    haveInternetPermission = result.ok;

    // if user wants this choice to be permanent...
    if (result.checked2) {
			prefs.setBoolPref("HaveInternetPermission", haveInternetPermission);

			// there is no way for regular users to undo this, so I've commented it out...
			//prefs.setBoolPref("AllowNoInternetAccess", !haveInternetPermission);
		}
  }

  if (!haveInternetPermission) {
		window.close();
		return;
	}
	
  if (navigator.onLine) {
    loadMasterRepoList(true); // will call loadXulswordRepositories() when successfully finished
  }
  else ProgressBar.hidden = true;

}

function loadXulswordRepositories(moduleDataAlreadyDeleted) {
  
  // get all enabled repositories
  var repoArray = [];
  
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  var repos = RDFC.GetElements();
  
  while(repos.hasMoreElements()) {
    var res = repos.getNext();
    
    if (RPDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY+"Enabled"), true) != RP.True) continue;
    
    repoArray.push(res);
  }

  loadRepositories(repoArray, moduleDataAlreadyDeleted);
}

function loadRepositories(resourceArray, moduleDataAlreadyDeleted) {
	
	ARMU.clearErrors(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  
  // init global repository array for new loading
  RepositoryArray = [];
  RepositoryIndex = -1; // begin sequence
  ManifestsLoading = 0;
  
  var repoUrlArray = [];
  
  for (var i=0; i<resourceArray.length; i++) {
    
    // don't load unknown or uninitialized Urls
    if ((/^(\s*|\?)$/).test(ARMU.getResourceLiteral(RPDS, resourceArray[i], "Url"))) continue;
    
    repoUrlArray.push(RPDS.GetTarget(resourceArray[i], RDF.GetResource(RP.REPOSITORY+"Url"), true));
    
    ManifestsLoading++;

    var obj = { resource:resourceArray[i], manifest:null };
    RepositoryArray.push(obj);
  }

  if (!moduleDataAlreadyDeleted) ARMU.deleteModuleData(repoUrlArray);
  
  ManifestCheckInterval = window.setInterval("checkAllRepositoriesLoaded();", 200);
  
  ProgressBar.max = 0;
  ProgressBar.value = 0;
  ProgressBar.mode = "undetermined";
  ProgressBar.hidden = false;
  
  // now begin to process each repository asynchronously while 
  // checkAllRepositoriesLoaded will watch for final completion
  startProcessingNextRepository()
}

function checkAllRepositoriesLoaded() {
  if (ManifestsLoading !== 0) return;

  window.clearInterval(ManifestCheckInterval);
  
  ProgressBar.max = 0;
	ProgressBar.value = 0;
	ProgressBar.mode = "undetermined";
  ProgressBar.hidden = true;
		
	// if any modules are flagged as a needed upgrade, then ask user to upgrade them
	var mods = [];
	ARMU.getUpdateMods(mods, false); // prefer non-xsm
	ARMU.getUpdateMods(mods, true); // xsm wins only if it's a greater version than all non-xsm

	// begin updating texts which need it
	if (mods.length) {
		ARMI.initiateModuleDownloads(mods);
		PromptUpdateMods.mods = mods;
		PromptUpdateMods.prompt = true; // triggers a prompt after files are located
	}
  
  ARMU.buildLanguageList();

  ARMU.treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
  
  ARMU.selectLanguage();
  
  // now we're finally done with onLoad and we turn things over to the user!
  return;
}


////////////////////////////////////////////////////////////////////////
// onLoad subroutines
////////////////////////////////////////////////////////////////////////

function initDataSource(data, fileName) {

  var rdfFile = getSpecialDirectory("ProfD");
  rdfFile.append(fileName);

  var ds = null;
  if (rdfFile.exists()) {
    ds = RDF.GetDataSourceBlocking(encodeURI("File://" + rdfFile.path.replace("\\", "/", "g")));
    if (!ds) rdfFile.remove(false);
  }
  
  if (!rdfFile.exists()) {
    rdfFile.create(rdfFile.NORMAL_FILE_TYPE, FPERM);
    writeFile(rdfFile, data, 1);
    ds = RDF.GetDataSourceBlocking(encodeURI("File://" + rdfFile.path.replace("\\", "/", "g")));
  }

  return ds;
}

// Download the masterRepoList from CrossWire's designated source
function loadMasterRepoList(moduleDataAlreadyDeleted) {
	
	ProgressBar.mode = "undetermined";
  
  // get URL for masterRepoList.conf
  var site = RDF.GetResource(RP.masterRepoListID);
  site = RPDS.GetTarget(site, RDF.GetResource(RP.REPOSITORY+"Site"), true);
  site = site.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

  var path = RDF.GetResource(RP.masterRepoListID);
  path = RPDS.GetTarget(path, RDF.GetResource(RP.REPOSITORY+"Path"), true);
  path = path.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
  
  var url = "ftp://" + site + path;
  var destFile = TEMP.clone();
  destFile.append("masterRepoList.conf");
  if (destFile.exists()) destFile.remove(false);
  
  // download masterRepoList.conf
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  if (!USE_CACHE) persist.persistFlags |= PERSIST_FLAGS_BYPASS_CACHE;

  persist.progressListener = 
  {
    myDestFile:destFile,
    myURL:url,
    myPersist:persist,
    crosswire:RDF.GetResource(RP.CrossWireRepoID),
    moduleDataAlreadyDeleted:moduleDataAlreadyDeleted,
    
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      if (WindowIsClosing) return;
      
      // finished downloading masterRepoList.conf
      ARMU.webRemove(this.myPersist);

      if (ARMU.getResourceLiteral(RPDS, this.crosswire, "Enabled") == "true") {
        ARMU.setStatus(RPDS, this.crosswire, dString(5) + "%", "yellow");
      }
      else {
        ARMU.setStatus(RPDS, this.crosswire, OFF, "red");
      }
      
      if (aStatus == 0) readMasterRepoList(this.myDestFile, this.moduleDataAlreadyDeleted);
      else loadXulswordRepositories(true);

    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      ARMU.setStatus(RPDS, this.crosswire, (aMessage ? aMessage:ERROR), "red");
      if (aMessage) {
        jsdump(this.myURL + ": " + aMessage);
        document.getElementById('body').setAttribute('showRepositoryList', 'true');
      }
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  
  persist.saveURI(ios.newURI(url, null, null), null, null, null, null, destFile, null);
  ARMU.webAdd(persist, "masterRepoList", "", url);
  
}

function readMasterRepoList(aFile, moduleDataAlreadyDeleted) {
  if (aFile) {
  
    var list = readFile(aFile);
    
    if (list) {

      list = list.match(/^\d+=FTPSource=.*?\|.*?\|.*?\s*$/img);
      
      // add each repository on the list
      for (var i=0; list && i < list.length; i++) {
        var r = list[i].match(/^\d+=FTPSource=(.*?)\|(.*?)\|(.*?)\s*$/i);
        
        var nres = { 
					ResourceType:"repository", 
					Enabled:"false", 
					Name:r[1], 
					Site:r[2], 
					Path:r[3], 
					Status:OFF, 
					Style:"red", 
					Url:ARMU.guessProtocol(r[2], r[3]) 
				};
        if (!ARMU.existsRepository(nres)) ARMU.createRepository(nres);
      }
      
    }
  }
  
  loadXulswordRepositories(moduleDataAlreadyDeleted);
}

// Fetch and process the manifest of the next repository on the global list.
// This can (does) occur asyncronously with other repositories at the same time.
function startProcessingNextRepository() {
  RepositoryIndex++;
  if (RepositoryIndex >= RepositoryArray.length) return;
  
  var myURL = ARMU.getResourceLiteral(RPDS, RepositoryArray[RepositoryIndex].resource, "Url");

  // handle local repositories syncronously
  if ((/^file\:\/\//i).test(myURL)) {
    var res = RepositoryArray[RepositoryIndex].resource;
    ARMU.setStatus(RPDS, res, ON, "green");
    applyRepositoryLocalConfs(res);
    window.setTimeout("ManifestsLoading--;", 1);

    startProcessingNextRepository();
    return;
  }
   
  var file = ARMU.getRepositoryUrlTempDir(myURL);
  if (file.exists()) file.remove(true);
  file.create(file.DIRECTORY_TYPE, DPERM);
  file.append(ManifestFile);

  RepositoryArray[RepositoryIndex].manifest = file;

  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  if (!USE_CACHE) persist.persistFlags |= PERSIST_FLAGS_BYPASS_CACHE;
  
  persist.progressListener = 
  {
    myResource:RepositoryArray[RepositoryIndex].resource,
    myManifestFile:RepositoryArray[RepositoryIndex].manifest,
    myURL:myURL,
    myPersist:persist,
    
    myMaxSelfProgress:0,
    myLastSelfProgress:0,
     
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
			
			// update repo status progress
      ARMU.setStatus(RPDS, this.myResource, dString(Math.round(100*(aCurSelfProgress/aMaxSelfProgress))) + "%", "yellow");

    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      if (WindowIsClosing) return;
      
      // finished downloading repository manifest
      ARMU.webRemove(this.myPersist);
      ManifestsLoading--;
      
			// update manifest total progress bar
			ProgressBar.value = Number(ProgressBar.value) + Number(this.myMaxSelfProgress) - Number(this.myLastSelfProgress);
			this.myLastSelfProgress = 0;
			if (ProgressBar.value == ProgressBar.max) {
				ProgressBar.mode = "undetermined";
			}
      
      if (aStatus == 0) {
        ARMU.setStatus(RPDS, this.myResource, ON, "green");
        applyRepositoryManifest(this.myResource, this.myManifestFile);
      }
      else {
        ARMU.setStatus(RPDS, this.myResource, OFF, "red");
      }
      
      startProcessingNextRepository();
    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      ARMU.setStatus(RPDS, this.myResource, (aMessage ? aMessage:ERROR), "red");
      if (aMessage) {
        jsdump(this.myURL + ": " + aMessage);
        document.getElementById('body').setAttribute('showRepositoryList', 'true');
      }
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
 
  persist.saveURI(ios.newURI(myURL + "/" + ManifestFile, null, null), null, null, null, null, file, null);
  ARMU.webAdd(persist, "manifest", "", myURL);
  
  if (!SYNC) startProcessingNextRepository();
}

function applyRepositoryLocalConfs(resource) {
  var localUrl = ARMU.getResourceLiteral(RPDS, resource, "Url");
  localUrl = localUrl.replace(/^file\:\/\//, "");
  var localDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  try {localDir.initWithPath(lpath(localUrl));}
  catch (er) {jsdump("ERROR: " + er); localDir = null;}
  if (localDir) localDir.append("mods.d");
  
  if (!localDir || !localDir.exists()) {
    ARMU.setStatus(RPDS, resource, ERROR, "red");
    jsdump("ERROR: could not read local repository directory in \"" + (localDir ? localDir.path:lpath(localUrl)) + "\"");
    return;
  }
  
  var confs = localDir.directoryEntries;
  while (confs.hasMoreElements()) {applyConfFile(confs.getNext(), ARMU.getResourceLiteral(RPDS, resource, "Url"));}
  
}

// Unzips the manifest file, reads the .conf files within it, and populates
// the database with the language and module information contained therein.
function applyRepositoryManifest(resource, manifest) {

  // uncompress manifest to a TEMP subdir
  var url = ARMU.getResourceLiteral(RPDS, resource, "Url");
  var tmpDir = ARMU.getRepositoryUrlTempDir(url);
  if (!tmpDir.exists()) tmpDir.create(tmpDir.DIRECTORY_TYPE, DPERM);
  
  LibSword.uncompressTarGz(manifest.path, tmpDir.path);
  
  tmpDir.append("mods.d");
  
  if (!tmpDir.exists()) {
    ARMU.setStatus(RPDS, resource, ERROR, "red");
    jsdump("ERROR: could not read repository manifest in \"" + tmpDir.path + "\"");
    return;
  }
  
  var confs = tmpDir.directoryEntries;
  while (confs.hasMoreElements()) {applyConfFile(confs.getNext(), url);}
}

function applyConfFile(file, repoUrl) {
  if (!file) return;
  file = file.QueryInterface(Components.interfaces.nsILocalFile);
  if (!file) return;
  if (file.isDirectory() || !(/\.conf$/).test(file.leafName)) return; 
   
  // read the extracted file
  var filedata = readFile(file);
  
  // do any module filtering
  var category = ARMU.getConfEntry(filedata, "Category");
  if (getPrefOrCreate("filterQuestionableTexts", "Bool", true) && category 
      && (/(Cults|Unorthodox|Questionable)/i).test(category)) return;
      
  // create a new module resource
  var newModRes = RDF.GetAnonymousResource();
  var type, confInfo, confDefault, confType;
  
  // add DataPath and add ModuleUrl (of module)
  var dataPath = ARMU.getConfEntry(filedata, "DataPath");
  if (!dataPath || dataPath == NOTFOUND) {
    ARMU.deleteResource(newModRes)
    return;
  }
  var moduleUrl;
  if ((/^(\.|\/)/).test(dataPath)) {
    dataPath = dataPath.replace(/^\.*\//, "");
    if (!(/\.(zip|xsm)$/i).test(dataPath)) 
				dataPath = dataPath.replace(/\/[^\/]*$/, "");
    moduleUrl = repoUrl + "/" + dataPath;
  }
  else moduleUrl = dataPath;
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "DataPath"), RDF.GetLiteral(dataPath), true);
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"ModuleUrl"), RDF.GetLiteral(moduleUrl), true);
  
  var is_XSM_module = ARMU.is_XSM_module(MLDS, newModRes);
  
  // add ModDrv (used to determine TypeReadable)
  var modDrv = ARMU.getConfEntry(filedata, "ModDrv");
  if (!modDrv || modDrv == NOTFOUND) {
    ARMU.deleteResource(newModRes)
    return;
  }
	MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "ModDrv"), RDF.GetLiteral(modDrv), true);

  // add TypeReadable
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"TypeReadable"), RDF.GetLiteral(ARMU.getTypeReadable(MLDS, newModRes)), true);
  
  // add XSM/SWORD Type
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"ResourceType"), (is_XSM_module ? RP.XSM_ModuleType:RP.SWORD_ModuleType), true);
  
  // write this .conf info to the new module resource
  // RDF-Attribute:"Conf-Entry"
  confInfo = {
    Description:"Description",
    ModuleName:"ModuleName",
    Version:"Version",
    Lang:"Lang",
    Abbreviation:"Abbreviation",
    About:"About",
    InstallSize:"InstallSize",
    Versification:"Versification",
    Scope:"Scope",
    DistributionLicense:"DistributionLicense",
    ShortPromo:"ShortPromo",
    CopyrightHolder:"CopyrightHolder",
    CopyrightContactAddress:"CopyrightContactAddress",
    CopyrightContactEmail:"CopyrightContactEmail",
    Copyright:"Copyright",
    CopyrightDate:"CopyrightDate",
    TextSource:"TextSource",
    Feature:"Feature",
    
    // these are specific to the .confs of modules located within .xsm files
    NameXSM:"NameXSM",
    SwordModules:"SwordModules",
    SwordVersions:"SwordVersions",
    HasXulswordUI:"UI",
    HasFont:"Font",
    HasXulswordBookmark:"Bookmark",
  };
  
  confDefault = {
    Description:"",
    ModuleName:"?",
    Version:"?",
    Lang:"?",
    Abbreviation:"",
    About:"",
    InstallSize:"?",
    Versification:"KJV",
    Scope:"?",
    DistributionLicense:"",
    ShortPromo:"",
    CopyrightHolder:"",
    CopyrightContactAddress:"",
    CopyrightContactEmail:"",
    Copyright:"",
    CopyrightDate:"",
    TextSource:"",
    Feature:"",
    
    NameXSM:"",
    SwordModules:"",
    SwordVersions:"",
    HasXulswordUI:"",
    HasFont:"",
    HasXulswordBookmark:"",
  };
  
  confType = {
    InstallSize:"int",
  };
  
  for (var p in confInfo) {
    var confres = ARMU.getConfEntry(filedata, confInfo[p]);
    if (!confres || (/^\s*$/).test(confres)) confres = confDefault[p];
    var type = "string";
    if (confType.hasOwnProperty(p)) type = confType[p];
    ARMU.setResourceAttribute(MLDS, newModRes, p, confres, type);
  }
  
  // add Url (of module's repository)
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"Url"), RDF.GetLiteral(repoUrl), true);
  // add .conf file name (NOT always lower case of module name!)
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "ConfFileName"), RDF.GetLiteral(file.leafName), true);
  // add LangReadable (so language can be read in moduleListTree)
  var langReadable = ARMU.getLangReadable(ARMU.getConfEntry(filedata, "Lang"));
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral(langReadable), true);
  // add Status and Installed
  var moduleName = ARMU.getResourceLiteral(MLDS, newModRes, "ModuleName");
	var moduleVersion = ARMU.getResourceLiteral(MLDS, newModRes, "Version");
  var isInstalled = (Tab.hasOwnProperty(moduleName) && Tab[moduleName].modVersion == moduleVersion);
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"Status"), RDF.GetLiteral(isInstalled ? ON:dString(0) + "%"), true);
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"Installed"), RDF.GetLiteral(isInstalled ? "true":"false"), true);
  
  // add the new resource to the Module List
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  RDFC.AppendElement(newModRes);
  
	var moduleUpdateNeeded = false;

	// set flags to update any updateable modules
	if (Tab.hasOwnProperty(moduleName) && moduleName != "Personal") {
		if (ARMU.compareSwordVersions(moduleVersion, Tab[moduleName].modVersion).result == 1) {
			moduleUpdateNeeded = true;
		}
		if (moduleUpdateNeeded) {
			jsdump("INFO: module \"" + moduleName + ", " + Tab[moduleName].modVersion + "\" can be updated to version \"" + moduleVersion + (is_XSM_module ? " XSM":"") + "\".");
			var change = ARMU.getConfEntry(filedata, "History_" + moduleVersion);
			if (change && !(/^\s*$/).test(change)) ARMU.setResourceAttribute(MLDS, newModRes, "History_" + moduleVersion, change);
		}
	}
	ARMU.setResourceAttribute(MLDS, newModRes, "ModuleUpdateNeeded", (moduleUpdateNeeded ? "true":"false"));

}


////////////////////////////////////////////////////////////////////////
// onUnload routines
////////////////////////////////////////////////////////////////////////

function onUnload() {
  WindowIsClosing = true; // tells progress not to try reporting anything anymore
  
  // disconnect each data source
  ARMU.treeDataSource([true, true, true], ["repoListTree", "languageListTree", "moduleListTree"]);
  
  // abort any downloads which are still in progress
  var cancel = [];
  for (var i=0; i<Web.length; i++) {
		cancel.push(Web[i].persist);
		jsdump("INFO: Cancelling download on unload: \"" + uneval(Web[i]) + "\"");
	}
  for (var p=0; p<cancel.length; p++) {cancel[p].cancelSave();}
  
  ARMU.clearErrors(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  ARMU.clearErrors(MLDS, RDF.GetResource(RP.ModuleListID));

  // remove all temporary files (except install temp files will remain)
  if (TEMP.exists()) TEMP.remove(true);
  
  // delete all module and language data (it's regenerated every time the 
  // window is opened) but repository data is retained between loads.
  if (MLDS) {
    var ress = MLDS.GetAllResources();
    while (ress.hasMoreElements()) {
      var res = ress.getNext();
      var arcsOut = MLDS.ArcLabelsOut(res);
      while (arcsOut.hasMoreElements()) {
        var arcOut = arcsOut.getNext();
        var targs = MLDS.GetTargets(res, arcOut, true);
        while (targs.hasMoreElements()) {
          MLDS.Unassert(res, arcOut, targs.getNext());
        }
      }
    }
    ARMU.dbFlush(MLDS);
  }
  
  if (RPDS) ARMU.dbFlush(RPDS);
  
}


////////////////////////////////////////////////////////////////////////
// Debug
////////////////////////////////////////////////////////////////////////

function getCount(aDS) {
  var ress = aDS.GetAllResources();
  var c = 0;
  while (ress.hasMoreElements()) {c++; ress.getNext();}
  return c;
}
