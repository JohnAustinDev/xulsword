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

const RepositoryRDF = "repositoryDefaults.rdf";
const ModuleRDF = "addRepositoryModule.rdf";
const ManifestFile = "mods.d.tar.gz";
const ON = String.fromCharCode(9745);
const OFF =  String.fromCharCode(9746);
const EmptyRepoSite = "file://";
const SCRIPT_PROPS = "dialogs/addRepositoryModule/addRepositoryModule.properties";

var RP, RPDS, MLDS, RDF, RDFC, RDFCU;
var RepositoryArray, RepositoryIndex, RepositoriesLoading, RepositoryCheckInterval;
var ModulesLoading, ModuleCheckInterval;
var ReposInProgress = [];
var ModulesInProgress = [];
var TEMP, TEMP_Install;
var RepoProgress;
var WindowIsAlive = true;
var MyStrings = null;
var ERROR = null;

var ARMU; // defined in utilities.js

function onLoad() {
	
	MyStrings = getCurrentLocaleBundle(SCRIPT_PROPS);
	if (!MyStrings) {
		jsdump("ERROR: No current locale string bundle \"" + SCRIPT_PROPS + "\"");
		window.close; 
		return;
	}
  
  initCSS();
  
  ERROR = MyStrings.GetStringFromName("arm.error");

  document.title = getDataUI("menu.addNewModule.label");

  ModulesLoading = 0; // global to track total number of modules downloading at any given time
  RepoProgress = document.getElementById("repoProgress");
  
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
  
  RP.masterRepoListID   = RP.ROOT + "/masterRepoList";
  RP.XulswordRepoListID = RP.ROOT + "/xulswordRepoList";
  RP.LanguageListID     = RP.ROOT + "/LanguageList";
  RP.ModuleListID       = RP.ROOT + "/ModuleList";
  RP.CrossWireRepoID    = RP.ROOT + "/CrossWire";
  
  // possible values for ResourceType
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

  // look for a default data source, load it, using it to augment other 
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
        
        // add readable (localized) attribute(s) and status
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
      ARMU.setResourceAttribute(RPDS, res, "Status", (enabled == "false" ? OFF:dString(1) + "%"));
      ARMU.setResourceAttribute(RPDS, res, "Style", (enabled == "false" ? "red":"yellow"));
    }
  }
  
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
            Url:ARMU.guessProtocol(site + path)
          };
          var res = ARMU.createRepository(nres);
          loadRepositoryArray([res], true);
        }
      }
      
    }
    input.hidden = true;
    input.value = "";
    this.removeAttribute("editing");
  };

  RepoProgress.value = "0";
  
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
	
	RepoProgress.value = "10";
  loadMasterRepoList(true); // will call loadXulswordRepositories() when successfully finished
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

  loadRepositoryArray(repoArray, moduleDataAlreadyDeleted);
}

function loadRepositoryArray(resourceArray, moduleDataAlreadyDeleted) {
  
  // init global repository array for new loading
  RepositoryArray = [];
  RepositoryIndex = -1; // begin sequence
  RepositoriesLoading = 0;
  
  var repoUrlArray = [];
  
  for (var i=0; i<resourceArray.length; i++) {
    
    // don't load unknown or uninitialized Urls
    if ((/^(\s*|\?)$/).test(ARMU.getResourceLiteral(RPDS, resourceArray[i], "Url"))) continue;
    
    repoUrlArray.push(RPDS.GetTarget(resourceArray[i], RDF.GetResource(RP.REPOSITORY+"Url"), true));
    
    RepositoriesLoading++;

    var obj = { resource:resourceArray[i], manifest:null };
    RepositoryArray.push(obj);
  }

  if (!moduleDataAlreadyDeleted) ARMU.deleteModuleData(repoUrlArray);
  
  RepositoryCheckInterval = window.setInterval("checkAllRepositoriesLoaded();", 200);
  
  // now begin to process each repository asynchronously while 
  // checkAllRepositoriesLoaded will watch for final completion
  startProcessingNextRepository()
}

function checkAllRepositoriesLoaded() {
  if (RepositoriesLoading !== 0) return;

  window.clearInterval(RepositoryCheckInterval);
  
  RepoProgress.hidden = true;
  
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
  persist.progressListener = 
  {
    myDestFile:destFile,
    myURL:url,
    myPersist:persist,
    crosswire:RDF.GetResource(RP.CrossWireRepoID),
    moduleDataAlreadyDeleted:moduleDataAlreadyDeleted,
    
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      var perc = Math.round(100*(aCurSelfProgress/aMaxSelfProgress))/10;
      ARMU.retainStatusMessage(RPDS, this.crosswire, dString(perc) + "%");
      ARMU.setResourceAttribute(RPDS, this.crosswire, "Style", "yellow");
      RepoProgress.value = 10 + Math.round(40*(aCurSelfProgress/aMaxSelfProgress));
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      if (!WindowIsAlive) return;
      
      // it's all done!!
      ARMU.reposInProgressRemove(this.myPersist);

      if (ARMU.getResourceLiteral(RPDS, this.crosswire, "Enabled") == "true") {
        ARMU.setResourceAttribute(RPDS, this.crosswire, "Status", dString(5) + "%");
        ARMU.setResourceAttribute(RPDS, this.crosswire, "Style", "yellow");
      }
      else {
        ARMU.retainStatusMessage(RPDS, this.crosswire, OFF);
        ARMU.setResourceAttribute(RPDS, this.crosswire, "Style", "red");
      }
      
      if (aStatus == 0) readMasterRepoList(this.myDestFile, this.moduleDataAlreadyDeleted);
      else loadXulswordRepositories(true);

    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      ARMU.setResourceAttribute(RPDS, this.crosswire, "Status", (aMessage ? aMessage:ERROR));
      ARMU.setResourceAttribute(RPDS, this.crosswire, "Style", "red");
      if (aMessage) {
        jsdump(this.myURL + ": " + aMessage);
        document.getElementById('body').setAttribute('showRepositoryList', 'true');
      }
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  persist.saveURI(ios.newURI(url, null, null), null, null, null, null, destFile, null);
  ARMU.reposInProgressAdd(persist);
  updateRepoListButtons();
  
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
					Url:ARMU.guessProtocol(r[2] + r[3]) 
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
  if (RepositoryIndex == RepositoryArray.length) return;
  
  var myURL = ARMU.getResourceLiteral(RPDS, RepositoryArray[RepositoryIndex].resource, "Url");

  // handle local repositories syncronously
  if ((/^file\:\/\//i).test(myURL)) {
    var res = RepositoryArray[RepositoryIndex].resource;
    ARMU.setResourceAttribute(RPDS, res, "Status", ON);
    ARMU.setResourceAttribute(RPDS, res, "Style", "green");
    applyRepositoryLocalConfs(res);
    window.setTimeout("RepositoriesLoading--;", 1);
    RepoProgress.value = Math.round(Number(RepoProgress.value) + (50/RepositoryArray.length));

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
  persist.progressListener = 
  {
    myResource:RepositoryArray[RepositoryIndex].resource,
    myManifestFile:RepositoryArray[RepositoryIndex].manifest,
    myURL:myURL,
    myPersist:persist,
     
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      var perc = Math.round(100*(aCurSelfProgress/aMaxSelfProgress));
      ARMU.retainStatusMessage(RPDS, this.myResource, dString(perc) + "%");
      ARMU.setResourceAttribute(RPDS, this.myResource, "Style", "yellow");
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      if (!WindowIsAlive) return;
      
      // it's all done!!
      RepositoriesLoading--;
      ARMU.reposInProgressRemove(this.myPersist);
      RepoProgress.value = Math.round(Number(RepoProgress.value) + (50/RepositoryArray.length));
      
      if (aStatus == 0) {
        ARMU.setResourceAttribute(RPDS, this.myResource, "Status", ON);
        ARMU.setResourceAttribute(RPDS, this.myResource, "Style", "green");
        applyRepositoryManifest(this.myResource, this.myManifestFile);
      }
      else {
        ARMU.retainStatusMessage(RPDS, this.myResource, ERROR);
        ARMU.setResourceAttribute(RPDS, this.myResource, "Style", "red");
      }
    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      ARMU.setResourceAttribute(RPDS, this.myResource, "Status", (aMessage ? aMessage:ERROR));
      ARMU.setResourceAttribute(RPDS, this.myResource, "Style", "red");
      if (aMessage) {
        jsdump(this.myURL + ": " + aMessage);
        document.getElementById('body').setAttribute('showRepositoryList', 'true');
      }
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  
  persist.saveURI(ios.newURI(myURL + "/" + ManifestFile, null, null), null, null, null, null, file, null);
  ARMU.reposInProgressAdd(persist);
  updateRepoListButtons();
  
  startProcessingNextRepository();
}

function applyRepositoryLocalConfs(resource) {
  var localUrl = ARMU.getResourceLiteral(RPDS, resource, "Url");
  localUrl = localUrl.replace(/^file\:\/\//, "");
  var localDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  localDir.initWithPath(localUrl);
  localDir.append("mods.d");
  
  if (!localDir.exists()) {
    ARMU.setResourceAttribute(RPDS, resource, "Status", ERROR);
    ARMU.setResourceAttribute(RPDS, resource, "Style", "red");
    jsdump("ERROR: could not read local repository directory in \"" + localDir.path + "\"");
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
    ARMU.setResourceAttribute(RPDS, resource, "Status", ERROR);
    ARMU.setResourceAttribute(RPDS, resource, "Style", "red");
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
  // add Status
  MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY+"Status"), RDF.GetLiteral(dString(0) + "%"), true);
  
  // add the new resource to the Module List
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  RDFC.AppendElement(newModRes);

}


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
  updateRepoListButtons();
}

// Download a module whose contents are listed in modContentData 
// as [ { url:url, size:size }, ... ]. Size is not needed unless there
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
			jsdump(modContentData[c].url);
      persist.saveURI(ios.newURI(modContentData[c].url, null, null), null, null, null, null, destFile, null);
      ARMU.modulesInProgressAdd(persist);
      updateRepoListButtons();
      
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


////////////////////////////////////////////////////////////////////////
// Mouse and Selection functions
////////////////////////////////////////////////////////////////////////

function deleteSelectedRepositories() {
  var selectedResources = ARMU.getSelectedResources(document.getElementById("repoListTree"));
  if (!selectedResources.length) return;
  
  ARMU.treeDataSource([true, true], ["languageListTree", "moduleListTree"]);
  
  ARMU.deleteRepository(selectedResources);
  
  ARMU.buildLanguageList();
  
  ARMU.treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
  
  ARMU.selectLanguage();
}

function toggleReposOnOff() {
  var selectedResources = ARMU.getSelectedResources(document.getElementById("repoListTree"));
  if (!selectedResources.length) return;
  
  // disconnect large trees to speed things up. loadRepositoryArray reconnects them
  ARMU.treeDataSource([true, true], ["languageListTree", "moduleListTree"]);

  // set enable/disable etc. attributes
  var nowOnRes = [];
  var deleteModDataUrl = [];
  for (var i=0; i<selectedResources.length; i++) {
    
    deleteModDataUrl.push(RPDS.GetTarget(selectedResources[i], RDF.GetResource(RP.REPOSITORY+"Url"), true));
  
    var enabled = RPDS.GetTarget(selectedResources[i], RDF.GetResource(RP.REPOSITORY+"Enabled"), true);
    
    var newval = (enabled ? null:"true");
    if (!newval) {
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      newval = (enabled == "true" ? "false":"true");
    }
    
    ARMU.setResourceAttribute(RPDS, selectedResources[i], "Enabled", newval);
    
    if (newval == "true") {
      ARMU.setResourceAttribute(RPDS, selectedResources[i], "Status", dString(1) + "%");
      ARMU.setResourceAttribute(RPDS, selectedResources[i], "Style", "yellow");
      nowOnRes.push(selectedResources[i]);
    }
    else {
      ARMU.setResourceAttribute(RPDS, selectedResources[i], "Status", OFF);
      ARMU.setResourceAttribute(RPDS, selectedResources[i], "Style", "red");
    }
  }
  
  ARMU.deleteModuleData(deleteModDataUrl);
  loadRepositoryArray(nowOnRes, true);
}

// updates moduleListTree to show certain modules. 
//		If flag is an ISO language code, modules with that base language will be shown.
//		If flag is "all" then all modules will be shown.
//		If flag is "none" then no modules will be shown.
//		If flag is null, then modules having languageListTree's selected language are 
//			shown, and if nothing is selected in the languageListTree, no modules are shown.
function updateModuleList(flag) {
  if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true") toggleModuleBox();
  
  ARMU.treeDataSource([true], ["moduleListTree"]);
  
  var tree = document.getElementById("languageListTree");
  
  if (flag == "all") {tree.view.selection.clearSelection();}
  
  if (!flag) {
    var selIndex = tree.view.selection.currentIndex;
    
    flag = "none";
    try {
      if (selIndex != -1) {
        var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(selIndex);
        res = MLDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
        flag = res.QueryInterface(Components.interfaces.nsIRDFLiteral).Value
      }
    } catch (er) {}
  }
  
  flag = flag.replace(/\-.*$/, ""); // match all root language modules
  
  if (flag != "none" && flag != "all") prefs.setCharPref("addRepositoryModuleLang", flag);
  
  ARMU.showModules(flag);
  
  ARMU.treeDataSource([false], ["moduleListTree"]);
}

function toggleModuleBox() {
  var cont = document.getElementById("moduleDialog");
  var showModuleInfo = cont.getAttribute("showModuleInfo");
  showModuleInfo = (showModuleInfo == "false" ? "true":"false");
  
  cont.setAttribute("showModuleInfo", showModuleInfo);
  document.getElementById("moduleDeck").setAttribute("selectedIndex", (showModuleInfo=="true" ? 1:0));
}

function toggleLanguageList() {
  var vbox = document.getElementById("moduleDialog");
  vbox.setAttribute("showLanguageList", (vbox.getAttribute("showLanguageList")=="false" ? "true":"false"));
}

function initiateModuleDownloads() {
  var mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
  if (!mods.length) return;
  
  if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true")
      toggleModuleBox();
  
  ModulesLoading += mods.length;
  if (!ModuleCheckInterval) ModuleCheckInterval = window.setInterval("checkAllModulesAreDownloaded();", 200);
  
  // fetch files into separate module directories so that in the end, 
  // only complete downloads will be installed.
  for (var m=0; m<mods.length; m++) {
    var is_XSM_module = ARMU.is_XSM_module(MLDS, mods[m]);
    
    var moduleUrl = ARMU.getResourceLiteral(MLDS, mods[m], "ModuleUrl");
    var repoUrl = ARMU.getResourceLiteral(MLDS, mods[m], "Url");
    
    // prompt for audio book and chapters if needed
    if (is_XSM_module && !(/\.(zip|xsm)$/).test(moduleUrl)) {
      var modConf = ARMU.getRepositoryUrlTempDir(repoUrl);
      modConf.append("mods.d");
      modConf.append(ARMU.getResourceLiteral(MLDS, mods[m], "ConfFileName"));
      var data = { ok:false, bk:null, ch:null, cl:null, audio:eval(ARMU.getConfEntry(readFile(modConf), "AudioChapters")) };
      var dlg = window.openDialog("chrome://xulsword/content/dialogs/addRepositoryModule/audioDialog.xul", "dlg", DLGSTD, data);
      
      if (!data.ok || !data.bk || !data.ch || !data.cl) {
        ModulesLoading--;
        continue;
      }
      
      moduleUrl = ARMU.getResourceLiteral(MLDS, mods[m], "DataPath") + "&bk=" + data.bk + "&ch=" + data.ch + "&cl=" + data.cl;
      ARMU.setResourceAttribute(MLDS, mods[m], "ModuleUrl", moduleUrl);
    }
    
    // all module downloads will go under "downloads/subdir/"
    // this directory will be deleted once download is copied so
    // don't allow another download until this one is done
    var dest = ARMU.getModuleDownloadDirectory(mods[m]);
    if (dest.exists()) {
      ModulesLoading--;
      continue;
    }
    dest.create(dest.DIRECTORY_TYPE, DPERM);
    
    // don't download something that has already been succesfully downloaded!
    if (ARMU.getModuleInstallerZipFile(mods[m]).exists()) {
      ModulesLoading--;
      continue;
    }
    
    if (is_XSM_module) {
      // install a .xsm module
      downloadModule(mods[m], [ { url:moduleUrl, size:1 } ]);
    }
    else {
      // install a SWORD module
    
      // first, copy .conf file from local dir to "downloads/modName/mods.d"
      var modsdDir = dest.clone();
      modsdDir.append("mods.d");
      if (!modsdDir.exists()) modsdDir.create(modsdDir.DIRECTORY_TYPE, DPERM);
      
      var confSource;
      if ((/^file\:\/\//i).test(repoUrl)) {
        confSource = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        confSource.initWithPath(lpath(repoUrl.replace(/^file\:\/\//, "")));
      }
      else confSource = ARMU.getRepositoryUrlTempDir(repoUrl);
      confSource.append("mods.d");
      confSource.append(ARMU.getResourceLiteral(MLDS, mods[m], "ConfFileName"));
      if (!confSource.exists()) {
        jsdump("ERROR: Conf file doesn't exist \"" + confSource.path + "\".");
        ModulesLoading--;
        continue;
      }
      confSource.copyTo(modsdDir, null);
    
      var moduleListingDir = ARMU.getModuleListingDirectory(mods[m]);
      if (moduleListingDir.exists()) {
        ModulesLoading--;
        continue;
      }
      moduleListingDir.create(moduleListingDir.DIRECTORY_TYPE, DPERM);
    
      // now copy the module contents from the Url to "downloads/modName/modules/..."
      ARMU.setResourceAttribute(MLDS, mods[m], "Status", dString(1) + "%");
      ARMU.setResourceAttribute(MLDS, mods[m], "Style", "yellow");
      
      // fetchSwordModuleUrls will asyncronously call downloadModule 
      // when all module content files are finally known.
      fetchSwordModuleUrls( { modResource:mods[m], modContentData:[], directoriesBeingRead:1 , status:0} );
    }
  }
}

function installModules() {

  MainWindow.AddRepositoryModules = ARMU.getInstallableModules();
  
  MainWindow.installModuleArray(MainWindow.finishAndHandleReset, MainWindow.AddRepositoryModules);
  
  window.close();
}


function updateRepoListButtons() {
  var buttons  = ["toggle", "add", "delete", "repoCancel"];
  var disabled = [true, false, true, true];
  
  // button states depend on selection and downloads status
  var tree = document.getElementById("repoListTree");
  if (tree && tree.view) {
    var sel = tree.view.selection;
    
    if (sel.currentIndex != -1) {
      disabled[0] = false; // toggle
      disabled[2] = false; // delete
    }
    if (ModulesInProgress.length || ReposInProgress.length) {
      disabled[0] = true; // toggle
      disabled[1] = true; // add
      disabled[2] = true; // delete
    }
    disabled[3] = (ReposInProgress.length ? false:true);
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function updateModuleButtons() {
  var buttons  = ["installButton", "showInfoButton", "showModulesButton", "moduleCancel"];
  var disabled = [true, true, false, true];
  
  // button states depend on selection
  var tree = document.getElementById("moduleListTree");
  if (!tree || !tree.view) return;
  var sel = tree.view.selection;
  
  if (sel.currentIndex != -1) {
    disabled[0] = false; // install
    disabled[1] = false; // showInfo
  }
  
  disabled[3] = (ModulesInProgress.length ? false:true);
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function onModuleListTreeSelect() {
  var mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"));

  var xsmUrls = [];
  for (var m=0; m < mods.length; m++) {
    var mod = mods[m];
    var is_XSM_module = ARMU.is_XSM_module(MLDS, mod);
    if (!is_XSM_module) continue;
    var url = ARMU.getResourceLiteral(MLDS, mod, "ModuleUrl");
    if (!url) continue;
    xsmUrls.push();
  }
  
  updateModuleButtons();
}

function addRepository() {
  
  // ensure user sees the columns which will need updating
  document.getElementById("Name").removeAttribute("hidden");
  document.getElementById("Site").removeAttribute("hidden");
  document.getElementById("Path").removeAttribute("hidden");
  
  var nres = { 
		ResourceType:"repository", 
		Enabled:"false", 
		Name:getDataUI("treecol.name.label"), 
		Site:EmptyRepoSite, Path:"?", 
		Status:OFF, 
		Style:"red", 
		Url:"?" 
	};
	
  var res = ARMU.createRepository(nres);
  
  // scroll to the new repository and select and focus it
  var tree = document.getElementById("repoListTree");
  var index = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getIndexOfResource(res);
  tree.view.selection.select(index);
  tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(index);
  tree.focus();
}

function moduleCancel() {
  for (var i=0; i<ModulesInProgress.length; i++) {
    ModulesInProgress[i].cancelSave();
  }
}

function repoCancel() {
  for (var i=0; i<ReposInProgress.length; i++) {
    ReposInProgress[i].cancelSave();
  }
}


////////////////////////////////////////////////////////////////////////
// Module Info routines
////////////////////////////////////////////////////////////////////////

// Taken from dialogs/about.html
function writeModuleInfos() {
  var mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
  if (!mods.length) return;
  
  var html = "";
  for (var m=0; m<mods.length; m++) {
    var submods = [];
    
    var is_XSM_module = ARMU.is_XSM_module(MLDS, mods[m]);
    
    if (is_XSM_module) {
      // include all SWORD modules within this XSM module
      var myXSM = ARMU.getResourceLiteral(MLDS, mods[m], "ModuleUrl");
      if (myXSM) {
        RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
        var mls = RDFC.GetElements();
        while (mls.hasMoreElements()) {
          var ml = mls.getNext();
          var xsm = ARMU.getResourceLiteral(MLDS, ml, "ModuleUrl");
          if (myXSM == xsm) {
            submods.push(ml);
          }
        }
      }
      else submods.push(mods[m]);
    }
    else submods.push(mods[m]);
    
    for (var s=0; s<submods.length; s++) {
      var aModRes = submods[s];
      
      var modName = ARMU.getResourceLiteral(MLDS, aModRes, "ModuleName");
    
      html += "<div class=\"module-detail cs-Program\">";
      
      // Heading and version
      var vers = ARMU.getResourceLiteral(MLDS, aModRes, "Version");
      var modAbbr = ARMU.getResourceLiteral(MLDS, aModRes, "Abbreviation");
      if (!modAbbr || modAbbr == "?") modAbbr = modName; 
      html +=  "<span class=\"mod-detail-heading\">";
      html +=    modAbbr + (vers != "?" ? "(" + vers + ")":"");
      html +=  "</span>";
      
      // Descripton
      var description = ARMU.getResourceLiteral(MLDS, aModRes, "Description");
      if (description) 
          html += "<div class=\"description\">" + description + "</div>";

      // Copyright
      var copyright = ARMU.getResourceLiteral(MLDS, aModRes, "DistributionLicense");
      if (copyright)
           html += "<div class=\"copyright\">" + copyright + "</div>";
           
      // About
      var about = ARMU.getResourceLiteral(MLDS, aModRes, "About");
      if (about) {
        about = about.replace(/(\\par)/g, "<br>");
        html += "<div class=\"about\">" + about + "</div>";
      }
           
      html += "</div>"; // end module-detail
         
      // Conf contents
      var confFile = ARMU.getResourceLiteral(MLDS, aModRes, "ConfFileName");

      if (confFile) {
        html += "<div id=\"conf." + modName + "\" class=\"conf-info\" showInfo=\"false\" readonly=\"readonly\">";
        html +=   "<a class=\"link\" href=\"javascript:frameElement.ownerDocument.defaultView";
        html +=     ".toggleInfo('" + modName + "', '" + ARMU.getResourceLiteral(MLDS, aModRes, "Url") + "', '" + confFile + "');\">";
        html +=     "<span class=\"more-label\">" + getDataUI("more.label") + "</span>";
        html +=     "<span class=\"less-label\">" + getDataUI("less.label") + "</span>";
        html +=   "</a>";
        html +=   "<textarea id=\"conftext." + modName + "\" class=\"cs-" + DEFAULTLOCALE + "\" readonly=\"readonly\"></textarea>";
        html += "</div>";
      }
    }
  }
  
  var body = document.getElementById("infoBox").contentDocument.getElementsByTagName("body")[0];
  body.innerHTML = html;
  body.style.background = "white";
}

function toggleInfo(mod, url, conf) {
  var doc = document.getElementById("infoBox").contentDocument;
  var elem = doc.getElementById("conf." + mod);
  var textarea = elem.getElementsByTagName("textarea")[0]; 
  var showInfo = elem.getAttribute("showInfo");
 
  if (showInfo == "false") {
    var confInfo = "-----";
    var confFile;
      if ((/^file\:\/\//i).test(url)) {
        confFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        confFile.initWithPath(lpath(url.replace(/^file\:\/\//, "")));
      }
      else confFile = ARMU.getRepositoryUrlTempDir(url);
      confFile.append("mods.d");
      confFile.append(conf);
    if (!confFile.exists()) {
      jsdump("ERROR: Missing .conf file \"" + confFile.path + "\"");
    }
    else {confInfo  = readFile(confFile);}

    textarea.value = confInfo;
  }

  elem.setAttribute("showInfo", (showInfo == "true" ? "false":"true"));

  if (elem.getAttribute("showInfo") == "true") 
      textarea.style.height = Number(textarea.scrollHeight + 10) + "px";

}




////////////////////////////////////////////////////////////////////////
// onUnload routines
////////////////////////////////////////////////////////////////////////

function onUnload() {
  WindowIsAlive = false; // tells progress not to bother reporting anything
  
  // disconnect each data source
  ARMU.treeDataSource([true, true, true], ["repoListTree", "languageListTree", "moduleListTree"]);
  
  // abort any downloads which are still in progress
  for (var i=0; i<ModulesInProgress.length; i++) {
    ModulesInProgress[i].cancelSave();
  }
  for (var i=0; i<ReposInProgress.length; i++) {
    ReposInProgress[i].cancelSave();
  }

  // remove all temporary files (except install temp files will remain)
  if (TEMP.exists()) TEMP.remove(true);
  
  // delete all module and language data (it's regenerated every time the window is opened)
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
