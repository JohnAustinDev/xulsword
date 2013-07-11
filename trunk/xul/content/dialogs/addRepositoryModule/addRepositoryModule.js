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
TODO:
  CSS and Locale
*/

const RepositoryRDF = "repository.rdf"; // located in xulsword's profile dir
const ModuleRDF = "swordmods.rdf";
const ManifestFile = "mods.d.tar.gz";

var HaveInternetPermission = false;
var RP, RPDS, MLDS, RDF, RDFC, RDFCU;
var RepositoryArray, RepositoryIndex, RepositoriesLoading, RepositoryCheckInterval;
var ModulesLoading, ModuleCheckInterval;
var TEMP, TEMP_Install;
var DownloadsInProgress = [];
var CompletedDownloads = [];

function onLoad() {

  ModulesLoading = 0; // global to track total number of modules downloading at any given time
  
  // Create clean temp directories
  TEMP = getSpecialDirectory("TmpD");
  TEMP.append("xs_addRepositoryModule");
  if (TEMP.exists()) TEMP.remove(true);
  TEMP.create(TEMP.DIRECTORY_TYPE, DPERM);
  
  TEMP_Install = getSpecialDirectory("TmpD");
  TEMP_Install.append("xs_addRepositoryModule_Install");
  if (TEMP_Install.exists()) TEMP_Install.remove(true);
  TEMP_Install.create(TEMP_Install.DIRECTORY_TYPE, DPERM);
  
  // add About dialog's style sheets to InfoBox
  var infoBox = document.getElementById("infoBox").contentDocument;
  var element = infoBox.createElement('link');
  element.type = 'text/css';
  element.rel = 'stylesheet';
  element.href = "chrome://xulsword/skin/common/global-xul.css";
  infoBox.getElementsByTagName('head')[0].appendChild(element);
  element = infoBox.createElement('link');
  element.type = 'text/css';
  element.rel = 'stylesheet';
  element.href = "chrome://xulsword/skin/dialogs/about/about-htm.css";
  infoBox.getElementsByTagName('head')[0].appendChild(element);

//prefs.clearUserPref("HaveInternetPermission");

  // Don't allow access to internet until we have express permission!
  try {
    HaveInternetPermission = prefs.getBoolPref("HaveInternetPermission");
  }
  catch(er) {HaveInternetPermission = false;}
  
  if (!HaveInternetPermission) {
    var result = requestInternetPermission();
    HaveInternetPermission = result.ok;
    if (result.checked) prefs.setBoolPref("HaveInternetPermission", HaveInternetPermission);
  }
  
  if (!HaveInternetPermission) {
    window.close();
    return;
  }
  
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
  
  RP.Enabled    = RDF.GetResource(RP.REPOSITORY+"Enabled");
  RP.Name       = RDF.GetResource(RP.REPOSITORY+"Name");
  RP.Site       = RDF.GetResource(RP.REPOSITORY+"Site");
  RP.Path       = RDF.GetResource(RP.REPOSITORY+"Path");
  RP.Status     = RDF.GetResource(RP.REPOSITORY+"Status");
  RP.Style      = RDF.GetResource(RP.REPOSITORY+"Style");
  RP.Url        = RDF.GetResource(RP.REPOSITORY+"Url");
  RP.ModuleType = RDF.GetResource(RP.REPOSITORY+"ModuleType");
  RP.Show       = RDF.GetResource(RP.REPOSITORY+"Show");
  RP.Type       = RDF.GetResource(RP.REPOSITORY+"Type");
  RP.ModuleUrl  = RDF.GetResource(RP.REPOSITORY+"ModuleUrl");
  
  RP.XSM_ModuleType   = RDF.GetLiteral("xsm_module");
  RP.SWORD_ModuleType = RDF.GetLiteral("sword_module");
  RP.LanguageListType = RDF.GetLiteral("language");
  RP.RepositoryType   = RDF.GetLiteral("repository");
  
  RP.True             = RDF.GetLiteral("true");
  RP.False            = RDF.GetLiteral("false");
  
  // initialize RPDS Data Source with CrossWire info...
  var data = "\
<?xml version=\"1.0\"?>" + NEWLINE + "\
<RDF:RDF xmlns:REPOSITORY=\"" + RP.REPOSITORY + "\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
  <RDF:Description RDF:about=\"http://www.xulsword.com/repository/CrossWire\"" + NEWLINE + "\
           REPOSITORY:Type=\"repository\"" + NEWLINE + "\
           REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
           REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
           REPOSITORY:Path=\"/pub/sword/raw\"" + NEWLINE + "\
           REPOSITORY:Url=\"ftp://ftp.crosswire.org/pub/sword/raw\"" + NEWLINE + "\
           REPOSITORY:Enabled=\"false\" />" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.masterRepoListID + "\"" + NEWLINE + "\
                   REPOSITORY:Type=\"masterRepoList\"" + NEWLINE + "\
                   REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/sword/masterRepoList.conf\" />" + NEWLINE + "\
  <RDF:Seq RDF:about=\"" + RP.XulswordRepoListID + "\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"http://www.xulsword.com/repository/CrossWire\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
</RDF:RDF>";
  RPDS = initDataSource(data, RepositoryRDF);

  // initialize MLDS Data Source from scratch each time (all this data is  
  // wiped when the window is closed)
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
  
  // look for a default data source, load it, and augment other data sources
  var defDS = null;
  var defRDF = getSpecialDirectory("DefRt");
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
          var arc = arcsOut.getNext();
          var attrib = arc.ValueUTF8.replace(RP.REPOSITORY, "");
          var val = getResourceLiteral(defDS, repo, attrib);
          rinfo[attrib] = val;
        }
        if (!existsRepository(rinfo)) createRepository(rinfo);
      }
      // add any modules
      RDFC.Init(defDS, RDF.GetResource(RP.ModuleListID));
      var mods = RDFC.GetElements();
      while (mods.hasMoreElements()) {
        var mod = mods.getNext();
        RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
        RDFC.AppendElement(mod);
        arcsOut = defDS.ArcLabelsOut(mod);
        while (arcsOut.hasMoreElements()) {
          arc = arcsOut.getNext();
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
    var enabled = RPDS.GetTarget(res, RP.Enabled, true);
    if (enabled) {
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      setResourceAttribute(RPDS, res, "Status", (enabled == "false" ? "Off":"0%"));
      setResourceAttribute(RPDS, res, "Style", (enabled == "false" ? "red":"yellow"));
    }
  }
  
  // add our datasource to the repository tree
  treeDataSource([false], ["repoListTree"]);
  
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
      var oldUrl = getResourceLiteral(RPDS, repoResource, "Url");
      var oldValue = getResourceLiteral(RPDS, repoResource, editingColumn.id);
      var newValue = (!(/^\s*$/).test(input.value) ? input.value:"?");
      
      if (newValue != "?") {
      
        // save new value
        setResourceAttribute(RPDS, repoResource, editingColumn.id, newValue);
        
        // reload repo if necessary
        var site = getResourceLiteral(RPDS, repoResource, "Site");
        var path = getResourceLiteral(RPDS, repoResource, "Path");
        if (editingColumn.id != "Name" && oldValue != newValue && site != "?" && path != "?") {
          deleteModuleData([oldUrl]);
          setResourceAttribute(RPDS, repoResource, "Url", "ftp://" + site + path);
          loadRepositories([repoResource]);
        }
      }
      
    }
    input.hidden = true;
    input.value = "";
    this.removeAttribute("editing");
  };

  loadMasterRepoList(); // will call masterRepoListLoaded() when finished
}

function masterRepoListLoaded() {
  
  // get all enabled repositories
  var repoArray = [];
  
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  var repos = RDFC.GetElements();
  
  while(repos.hasMoreElements()) {
    var res = repos.getNext();
    
    if (RPDS.GetTarget(res, RP.Enabled, true) != RP.True) continue;
    
    repoArray.push(res);
  }

  loadRepositories(repoArray);
}

function loadRepositories(resourceArray, moduleDataAlreadyDeleted) {
  
  // init repository array
  RepositoryArray = [];
  RepositoryIndex = -1; // begin sequence
  RepositoriesLoading = 0;
  
  var repoUrlArray = [];
  
  for (var i=0; i<resourceArray.length; i++) {
    
    // don't load unknown or uninitialized Urls
    if ((/^(\s*|\?)$/).test(getResourceLiteral(RPDS, resourceArray[i], "Url"))) continue;
    
    repoUrlArray.push(RPDS.GetTarget(resourceArray[i], RP.Url, true));
    
    RepositoriesLoading++;
    var obj = { resource:resourceArray[i], manifest:null };
    RepositoryArray.push(obj);
  }

  if (!moduleDataAlreadyDeleted) deleteModuleData(repoUrlArray);
  
  RepositoryCheckInterval = window.setInterval("checkAllRepositoriesLoaded();", 200);
  
  // now begin to process each repository asynchronously while 
  // checkAllRepositoriesLoaded will watch for final completion
  startProcessingNextRepository()
}

function checkAllRepositoriesLoaded() {
  if (RepositoriesLoading !== 0) return;

  window.clearInterval(RepositoryCheckInterval);
  
  buildLanguageList();
  
  treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
  
  selectLanguage(getPrefOrCreate("addRepositoryModuleLang", "Char", getLocale()));
  
  // now we're done with onLoad and we turn things over to the user!
  return;
}


////////////////////////////////////////////////////////////////////////
// onLoad subroutines
////////////////////////////////////////////////////////////////////////

function requestInternetPermission() {

  var title = safeGetStringFromName("Download From Internet", null, null, "InternetWarning.title");
  var msg = safeGetStringFromName("This will access Bible related websites on the Internet.\n\nDo you wish to continue?", null, null, "InternetWarning.message");
  var cbText = safeGetStringFromName("Remember my choice", null, null, "RememberMyChoice");
  
  var result = {};
  var dlg = window.opener.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result,
      fixWindowTitle(title),
      msg,
      DLGALERT,
      DLGYESNO,
      cbText);
      
  return result;
}

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
function loadMasterRepoList() {
  
  // get URL for masterRepoList.conf
  var site = RDF.GetResource(RP.masterRepoListID);
  site = RPDS.GetTarget(site, RP.Site, true);
  site = site.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

  var path = RDF.GetResource(RP.masterRepoListID);
  path = RPDS.GetTarget(path, RP.Path, true);
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
    
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      var perc = Math.round(100*(aCurSelfProgress/aMaxSelfProgress))/10;
      setResourceAttribute(RPDS, this.crosswire, "Status", perc + "%");
      setResourceAttribute(RPDS, this.crosswire, "Style", "yellow");
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      
      // it's all done!!
      removeProgress(this.myPersist);
      if (getResourceLiteral(RPDS, this.crosswire, "Enabled") == "true") {
        setResourceAttribute(RPDS, this.crosswire, "Status", "5%");
        setResourceAttribute(RPDS, this.crosswire, "Style", "yellow");
      }
      else {
        setResourceAttribute(RPDS, this.crosswire, "Status", "Off");
        setResourceAttribute(RPDS, this.crosswire, "Style", "red");
      }
      readMasterRepoList(this.myDestFile);
    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      setResourceAttribute(RPDS, this.crosswire, "Status", "Error");
      setResourceAttribute(RPDS, this.crosswire, "Style", "red");
      if (aMessage) jsdump(this.myURL + ": " + aMessage);
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  persist.saveURI(ios.newURI(url, null, null), null, null, null, null, destFile, null);
  DownloadsInProgress.push(persist);
  
}

function readMasterRepoList(aFile) {
  if (aFile) {
  
    var list = readFile(aFile);
    
    if (list) {

      list = list.match(/^\d+=FTPSource=.*?\|.*?\|.*?\s*$/img);
      
      // add each repository on the list
      for (var i=0; list && i < list.length; i++) {
        var r = list[i].match(/^\d+=FTPSource=(.*?)\|(.*?)\|(.*?)\s*$/i);
        
        var nres = { Type:"repository", Enabled:"false", Name:r[1], Site:r[2], Path:r[3], Status:"Off", Style:"red", Url:"ftp://" + r[2] + r[3] };
        if (!existsRepository(nres)) createRepository(nres);
      }
      
    }
  }
  
  masterRepoListLoaded();
}

// Fetch and process the manifest of the next repository on the global list.
// This can (does) occur asyncronously with other repositories at the same time.
function startProcessingNextRepository() {
  RepositoryIndex++;
  if (RepositoryIndex == RepositoryArray.length) return;
  
  var myURL = getResourceLiteral(RPDS, RepositoryArray[RepositoryIndex].resource, "Url");
   
  var file = getTempDirOfUrl(myURL);
  if (file.exists()) file.remove(true);
  file.create(file.DIRECTORY_TYPE, DPERM);
  file.append(ManifestFile);

  RepositoryArray[RepositoryIndex].manifest = file;

  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);  
  var uri = ios.newURI(myURL + "/" + ManifestFile, null, null); 

  persist.progressListener = 
  {
    myResource:RepositoryArray[RepositoryIndex].resource,
    myManifestFile:RepositoryArray[RepositoryIndex].manifest,
    myURL:myURL,
    myPersist:persist,
     
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      var perc = Math.round(100*(aCurSelfProgress/aMaxSelfProgress));
      setResourceAttribute(RPDS, this.myResource, "Status", perc + "%");
      setResourceAttribute(RPDS, this.myResource, "Style", "yellow");
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      
      // it's all done!!
      RepositoriesLoading--;
      removeProgress(this.myPersist);
      
      if (aStatus == 0) {
        setResourceAttribute(RPDS, this.myResource, "Status", "On");
        setResourceAttribute(RPDS, this.myResource, "Style", "green");
        applyRepositoryManifest(this.myResource, this.myManifestFile);
      }
      else {
        setResourceAttribute(RPDS, this.myResource, "Status", "Error");
        setResourceAttribute(RPDS, this.myResource, "Style", "red");
      }
    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      setResourceAttribute(RPDS, this.myResource, "Status", "Error");
      setResourceAttribute(RPDS, this.myResource, "Style", "red");
      if (aMessage) jsdump(this.myURL + ": " + aMessage);
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  
  persist.saveURI(uri, null, null, null, null, file, null);
  DownloadsInProgress.push(persist);
  
  startProcessingNextRepository();
}

// Unzips the manifest file, reads the .conf files within it, and populates
// the database with the language and module information contained therein.
function applyRepositoryManifest(resource, manifest) {

  // uncompress manifest to a TEMP subdir
  var tmpDir = getTempDirOfUrl(getResourceLiteral(RPDS, resource, "Url"));
  if (!tmpDir.exists()) tmpDir.create(tmpDir.DIRECTORY_TYPE, DPERM);
  
  // nsIZipReader only handles ZIP- ARGGGG!
  unCompressTarGz(manifest, tmpDir);
  
  tmpDir.append("mods.d");
  
  if (!tmpDir.exists()) {
    setResourceAttribute(RPDS, resource, "Status", "Error");
    setResourceAttribute(RPDS, resource, "Style", "red");
    jsdump("ERROR: could not read repository manifest in \"" + tmpDir.path + "\"");
    return;
  }
  
  var confs = tmpDir.directoryEntries;
  while (confs.hasMoreElements()) {
    var file = confs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
    if (!(/\.conf$/).test(file.leafName)) continue; 
    
    // read the extracted file
    var filedata = readFile(file);
    
    // create a new module resource and add it to the modlist
    var newModRes = RDF.GetAnonymousResource();
    
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    RDFC.AppendElement(newModRes);
    
    var type, confInfo, confDefault;
    var datapath = getConfEntry(filedata, "DataPath");
    var is_XSM_module = ((/\.(zip|xsm)$/).test(datapath) || (/\/audio\.htm(\?|$)/).test(datapath));
    if (is_XSM_module) {
      MLDS.Assert(newModRes, RP.Type, RP.XSM_ModuleType, true);
    }
    else {
      MLDS.Assert(newModRes, RP.Type, RP.SWORD_ModuleType, true);
    }
    
    // add ModuleType
    var moduleType = getConfEntry(filedata, "ModDrv");
    if ((/^(RawText|zText)$/i).test(moduleType)) moduleType = "Bible";
    else if ((/^(RawCom|RawCom4|zCom)$/i).test(moduleType)) moduleType = "Commentary";
    else if ((/^(RawLD|RawLD4|zLD)$/i).test(moduleType)) moduleType = "Dictionary";
    else if ((/^(RawGenBook)$/i).test(moduleType)) moduleType = "General Book";
    else if ((/^(RawFiles)$/i).test(moduleType)) moduleType = "Simple Text";
    else if ((/^(HREFCom)$/i).test(moduleType)) moduleType = "URL";
    else if ((/^(audio)$/i).test(moduleType)) moduleType = "Audio";
    if (is_XSM_module && moduleType != "Audio") {moduleType = "XSM (" + moduleType + ")";}
    MLDS.Assert(newModRes, RP.ModuleType, RDF.GetLiteral(moduleType), true);
    
    // write the new .conf info to new module resource
    // RDF-Attribute:"Conf-Entry"
    confInfo = {
      ModuleName:"ModuleName",
      DataPath:"DataPath",
      Version:"Version",
      Lang:"Lang",
      Abbreviation:"Abbreviation",
      Description:"Description",
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
      
      NameXSM:"NameXSM",
      SwordModules:"SwordModules",
      SwordVersions:"SwordVersions",
      HasXulswordUI:"UI",
      HasFont:"Font",
      HasXulswordBookmark:"Bookmark",
    };
    
    confDefault = {
      ModuleName:"?",
      DataPath:"?",
      Version:"?",
      Lang:"?",
      Abbreviation:"",
      Description:"",
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
      
      NameXSM:"",
      SwordModules:"",
      SwordVersions:"",
      HasXulswordUI:"",
      HasFont:"",
      HasXulswordBookmark:"",
    };
    
    for (var p in confInfo) {
      var confres = getConfEntry(filedata, confInfo[p]);
      if (!confres || (/^\s*$/).test(confres)) confres = confDefault[p];
      MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + p), RDF.GetLiteral(confres), true);
    }
    
    // add .conf file name
    MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "ConfFileName"), RDF.GetLiteral(file.leafName), true);
    // add Url (of repository)
    MLDS.Assert(newModRes, RP.Url, RPDS.GetTarget(resource, RP.Url, true), true);
    // add LangReadable
    var langReadable = getLangReadable(getConfEntry(filedata, "Lang"));
    MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral(langReadable), true);
    // add Status
    MLDS.Assert(newModRes, RP.Status, RDF.GetLiteral("0%"), true);
    // ModuleUrl
    var moduleUrl = getResourceLiteral(MLDS, newModRes, "DataPath");
    if ((/^(\.|\/)/).test(moduleUrl)) {
      moduleUrl = getResourceLiteral(MLDS, newModRes, "Url") + "/" + moduleUrl.replace(/^\.*\//, "");
    }
    MLDS.Assert(newModRes, RP.ModuleUrl, RDF.GetLiteral(moduleUrl), true);

  }
}


////////////////////////////////////////////////////////////////////////
// Download related subroutines
////////////////////////////////////////////////////////////////////////

// fill a data object with information about the contents of a module
function getModContentUrls(modResource, modPath, data) {
  var repoUrl = getResourceLiteral(MLDS, modResource, "Url");
  
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  var destFile = getTempDirOfUrl(repoUrl);
  if (!destFile.exists()) destFile.create(destFile.DIRECTORY_TYPE, DPERM);
  destFile.append("listing_" + modPath.replace(/\//g, "_"));
  persist.progressListener = 
    {
      modResource:modResource,
      modPath:modPath,
      data:data,
      myURL:repoUrl + "/" + modPath,
      myDestFile:destFile,
      myPersist:persist,
      myMaxPerc:2,
      myApproxFileSize:2000,
      
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
        // add this download's progress to the existing percentage, but add a maximum myMaxPerc for this download
        var oldperc = getResourceLiteral(MLDS, this.modResource, "Status");
        if (!(/^\d+\s*\%$/).test(oldperc)) oldperc = 0;
        else oldperc = Number(oldperc.match(/^(\d+)\s*\%$/)[1]);
        if (aCurSelfProgress > this.myApproxFileSize) aCurSelfProgress = this.aCurSelfProgress;
        var perc = oldperc + Math.round(this.myMaxPerc*(aCurSelfProgress/this.myApproxFileSize));
        setResourceAttribute(MLDS, this.modResource, "Status", perc + "%");
        setResourceAttribute(MLDS, this.modResource, "Style", "yellow");
      },
      
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return

        if (aStatus == 0) {
          removeProgress(this.myPersist);
          
          var data = readFile(this.myDestFile);
          
          var files = data.match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/gm);
          var dirs = data.match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/gm);
          
          for (var i=0; dirs && i<dirs.length; i++) {
            var dir = dirs[i].match(/201\: \"(.*?)\" \d+ .*? DIRECTORY\s*$/)[1];
            this.data.count++;
            
            // start another download to read the subdirectory contents
            getModContentUrls(this.modResource, this.modPath + "/" + dir, this.data);
          }
          
          for(i=0; files && i<files.length; i++) {
            var file = files[i].match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/);
            this.data.modContentData.push({ url:this.myURL + "/" + file[1], size:file[2] });
          }
          
          this.data.count--;
          if (this.data.count == 0) {
            // this entire module's contents is now known!
            downloadModule(this.modResource, this.data.mpath, this.data.dest, this.data.modContentData);
          }
          
        }
        else {
          setResourceAttribute(MLDS, this.modResource, "Status", "Error");
          setResourceAttribute(MLDS, this.modResource, "Style", "red");
          jsdump("ERROR: getModContentUrls failed for \"" + this.myURL + "\"");
        }
      },
      
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
        setResourceAttribute(MLDS, this.modResource, "Status", "Error");
        setResourceAttribute(MLDS, this.modResource, "Style", "red");
        if (aMessage) jsdump(this.myURL + ": " + aMessage);
      },
      
      onLocationChange: function(aWebProgress, aRequest, aLocation) {},
      
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    };
  persist.saveURI(ios.newURI(repoUrl + "/" + modPath, null, null), null, null, null, null, destFile, null);
  DownloadsInProgress.push(persist);
}

function downloadModule(modResource, modPath, modDest, modContentData) {
  // don't fetch lucene directory or its contents
  for (var i=0; i<modContentData.length; i++) {
    if ((/\/lucene(\/|$)/i).test(modContentData[i].url)) {
      modContentData.splice(i, 1);
      i--;
    }
  }
  
  var is_XSM_module = (MLDS.GetTarget(modResource, RP.Type, true) == RP.XSM_ModuleType);
    
  var repoUrl = getResourceLiteral(MLDS, modResource, "Url");
  
  var moduleDir = modDest.clone();
  var p = (modPath ? modPath.split("/"):null);

  if (!is_XSM_module) {
    for (var i=0; p && i<p.length; i++) {
      if (!p[i]) continue; // case of dir//subdir
      moduleDir.append(p[i]);
      moduleDir.create(moduleDir.DIRECTORY_TYPE, DPERM);
    }
  }
    
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
  
  var total = 0;
  for (var c=0; c<modContentData.length; c++) {total += Number(modContentData[c].size);}
  
  var downloadedFiles = [];
  if (!is_XSM_module) {
    // the .conf file was already downloaded during repository loading so just copy it
    var modConf = modDest.clone(); 
    modConf.append("mods.d");
    modConf.append(getResourceLiteral(MLDS, modResource, "ConfFileName"));
    downloadedFiles.push(modConf);
  }

  // this data object is shared by all this module's downloads
  var data = { total:total, current:0, count:1, status:0, downloadedFiles:downloadedFiles }; 
  
  // progress has already been started when the module contents were read
  // so add new progress to this starting value
  var startPerc = getResourceLiteral(MLDS, modResource, "Status");
  if (!(/^\d+\s*\%$/).test(startPerc)) startPerc = 0;
  else startPerc = Number(startPerc.match(/^(\d+)\s*\%$/)[1]);
  
  for (var c=0; c<modContentData.length; c++) {

    var destFile = moduleDir.clone();

    var statusArray = [];
    if (is_XSM_module) {
      var myKey = getResourceLiteral(MLDS, modResource, "ModuleUrl");
      RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
      var elems = RDFC.GetElements();
      while (elems.hasMoreElements()) {
        var elem = elems.getNext();
        var key = getResourceLiteral(MLDS, elem, "ModuleUrl");
        if (key == myKey) statusArray.push(elem);
      }
      
      var destFileName = modContentData[c].url.replace(/^.*?([^\/]+)$/, "$1");
      if (!(/\.(zip|xsm)$/).test(destFileName)) destFileName += ".xsm";
      destFileName = destFileName.replace(/[\&=]+/g, "");
      destFile.append(destFileName);
    }
    else {
      statusArray.push(modResource);
      var sub = modContentData[c].url.replace(repoUrl + "/" + modPath + "/", "");
      sub = sub.split("/");
      for (var sd=0; sd<sub.length-1; sd++) {
        if (!sub[sd]) continue; // handle dir//subdir
        destFile.append(sub[sd]);
        if (!destFile.exists()) destFile.create(moduleDir.DIRECTORY_TYPE, DPERM);
      }
      destFile.append(sub[sub.length-1]);
    }

    var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
    persist.progressListener = 
    {
      myResource:modResource,
      myStatusArray:statusArray,
      myURL:modContentData[c].url,
      myDestFile:destFile,
      mySize:Number(modContentData[c].size),
      myLast:0,
      data:data,
      myPersist:persist,
      startPerc:startPerc,
      
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
        this.data.current += this.mySize*aCurSelfProgress/aMaxSelfProgress - this.myLast;
        this.myLast = this.mySize*aCurSelfProgress/aMaxSelfProgress;
        
        var perc = this.startPerc + Math.round((100-this.startPerc)*(this.data.current/this.data.total));
        for (var s=0; s<this.myStatusArray.length; s++) {
          setResourceAttribute(MLDS, this.myStatusArray[s], "Status", perc + "%");
          setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "yellow");
        }
      },
      
      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
        
        // download finished
        this.data.count--;
        removeProgress(this.myPersist);
        
        this.data.status = (this.data.status | aStatus);
        this.data.downloadedFiles.push(this.myDestFile);
        
        if (this.data.count == 0) {
          
          var is_XSM_module = (MLDS.GetTarget(this.myResource, RP.Type, true) == RP.XSM_ModuleType);
          
          // then entire module is also complete...
          if (!this.data.status) {
            for (var s=0; s<this.myStatusArray.length; s++) {
              setResourceAttribute(MLDS, this.myStatusArray[s], "Status", "100%");
              setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "green");
            }
            
            // copy the completed module to our install directory
            if (is_XSM_module) {
              this.data.downloadedFiles[0].copyTo(TEMP_Install.clone(), null);
            }
            else {
              var modName = getResourceLiteral(MLDS, this.myResource, "ModuleName");
              var zipFile = TEMP_Install.clone();
              zipFile.append(modName + ".zip");
              
              var zipRoot = getModuleDownloadDirectory(this.myResource, is_XSM_module);
              
              var zipWriter = Components.classes["@mozilla.org/zipwriter;1"].createInstance(Components.interfaces.nsIZipWriter);
              zipWriter.open(zipFile, 0x02 | 0x08 | 0x20); // PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE
              for (var i=0; i<this.data.downloadedFiles.length; i++) {
                var zipEntry = this.data.downloadedFiles[i].path.replace(zipRoot.path + "/", "");
                zipWriter.addEntryFile(zipEntry, zipWriter.COMPRESSION_NONE, this.data.downloadedFiles[i], false);
              }
              zipWriter.close();
            }
            
          }
          else {
            for (var s=0; s<this.myStatusArray.length; s++) {
              setResourceAttribute(MLDS, this.myStatusArray[s], "Status", "Error");
              setResourceAttribute(MLDS, this.myStatusArray[s], "Style", "red");
            }
          }
          
          var downDir = getModuleDownloadDirectory(this.myResource, is_XSM_module);
          downDir.remove(true);
          CompletedDownloads.push(downDir.path);
          ModulesLoading--;
        
        }
      },
      
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
        for (var s=0; s<this.myStatusArray.length; s++) {
          setResourceAttribute(RPDS, this.myStatusArray[s], "Status", "Error");
          setResourceAttribute(RPDS, this.myStatusArray[s], "Style", "red");
        }
        if (aMessage) jsdump(this.myURL + ": " + aMessage);
      },
      
      onLocationChange: function(aWebProgress, aRequest, aLocation) {},
      
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    };
    persist.saveURI(ios.newURI(modContentData[c].url, null, null), null, null, null, null, destFile, null);
    DownloadsInProgress.push(persist);
    
    if (c<modContentData.length-1) data.count++; // don't increment for last file because count started as "1"
  }
  
}

function checkAllModulesAreDownloaded() {
  if (ModulesLoading !== 0) {
    document.getElementById("apply").setAttribute("disabled", "true");
    return;
  }
  
  window.clearInterval(ModuleCheckInterval);
  ModuleCheckInterval = null;
  
  var mods = getInstallableModules();
  if (mods.length) document.getElementById("apply").removeAttribute("disabled");
  else document.getElementById("apply").setAttribute("disabled", "true");
}


////////////////////////////////////////////////////////////////////////
// Mouse and Selection functions
////////////////////////////////////////////////////////////////////////

function deleteSelectedRepositories() {
  var selectedResources = getSelectedResources(document.getElementById("repoListTree"));
  if (!selectedResources.length) return;
  
  treeDataSource([true, true], ["languageListTree", "moduleListTree"]);
  
  deleteRepository(selectedResources);
  
  buildLanguageList();
  
  treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
  
  selectLanguage(getPrefOrCreate("addRepositoryModuleLang", "Char", getLocale()));
}

function toggleReposOnOff(tree, e) {
  var selectedResources = getSelectedResources(document.getElementById("repoListTree"));
  if (!selectedResources.length) return;
  
  // disconnect large trees to speed things up. loadRepositories reconnects them
  treeDataSource([true, true], ["languageListTree", "moduleListTree"]);

  // set enable/disable etc. attributes
  var nowOnRes = [];
  var deleteModDataUrl = [];
  for (var i=0; i<selectedResources.length; i++) {
    
    deleteModDataUrl.push(RPDS.GetTarget(selectedResources[i], RP.Url, true));
  
    var enabled = RPDS.GetTarget(selectedResources[i], RP.Enabled, true);
    
    var newval = (enabled ? null:"true");
    if (!newval) {
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      newval = (enabled == "true" ? "false":"true");
    }
    
    setResourceAttribute(RPDS, selectedResources[i], "Enabled", newval);
    
    if (newval == "true") {
      setResourceAttribute(RPDS, selectedResources[i], "Status", "0%");
      setResourceAttribute(RPDS, selectedResources[i], "Style", "yellow");
      nowOnRes.push(selectedResources[i]);
    }
    else {
      setResourceAttribute(RPDS, selectedResources[i], "Status", "Off");
      setResourceAttribute(RPDS, selectedResources[i], "Style", "red");
    }
  }
  
  deleteModuleData(deleteModDataUrl);
  loadRepositories(nowOnRes, true);
}

function changeModuleListLanguage(lang) {
  treeDataSource([true], ["moduleListTree"]);
  var tree = document.getElementById("languageListTree");
  
  if (lang == "all") {tree.view.selection.clearSelection();}
  
  if (!lang) {
    var selIndex = tree.view.selection.currentIndex;
    
    lang = "none";
    try {
      if (selIndex != -1) {
        var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(selIndex);
        res = MLDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
        lang = res.QueryInterface(Components.interfaces.nsIRDFLiteral).Value
      }
    } catch (er) {}
  }
  
  lang = lang.replace(/\-.*$/, ""); // match all root language modules
  
  if (lang != "none") prefs.setCharPref("addRepositoryModuleLang", lang);
  
  // setting the rule's REPOSITORY:Lang attribute filters okay, but once it's  
  // removed (to show all) the tree is never rebuilt if it is re-added
  var inxsm = [];
  var swordShowing = {};
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  var mods = RDFC.GetElements();
  while (mods.hasMoreElements()) {
    
    var mod = mods.getNext();
    var mlang = getResourceLiteral(MLDS, mod, "Lang").replace(/\-.*$/, "");
    var show = (lang == mlang || lang == "all" ? "true":"false");
    
    setResourceAttribute(MLDS, mod, "Show", show);
    
    if (show == "true") {
      var is_XSM_module = (MLDS.GetTarget(mod, RP.Type, true) == RP.XSM_ModuleType);
      if (is_XSM_module) {
        mname = getResourceLiteral(MLDS, mod, "SwordModules").split(";");
        mvers = getResourceLiteral(MLDS, mod, "SwordVersions").split(";");
        for (var i=0; i<mname.length; i++) {
          try {
            key = mname[i] + mvers[i];
            key = key.replace(/\./g, "_");
            inxsm.push(key);
          }
          catch (er) {}
        }
      }
      else {
        var mname = getResourceLiteral(MLDS, mod, "ModuleName");
        var mvers = getResourceLiteral(MLDS, mod, "Version");
        try {
          var key = mname + mvers;
          key = key.replace(/\./g, "_");
          if (!swordShowing[key]) swordShowing[key] = [mod];
          else swordShowing[key].push(mod);
        }
        catch (er) {}
      }
    }
  
    // if a .xsm module is showing, hide the SWORD modules
    // which are contained within it.
    for (var i=0; i<inxsm.length; i++) {
      var key = inxsm[i];
      for (var m=0; swordShowing[key] && m<swordShowing[key].length; m++) {
        setResourceAttribute(MLDS, swordShowing[key][m], "Show", "false");
      }
    }
  
  }
  
  treeDataSource([false], ["moduleListTree"]);
}

function toggleModuleBox() {
  var cont = document.getElementById("moduleDialog");
  var showModuleInfo = cont.getAttribute("showModuleInfo");
  showModuleInfo = (showModuleInfo == "false" ? "true":"false");
  
  cont.setAttribute("showModuleInfo", showModuleInfo);
  document.getElementById("moduleDeck").setAttribute("selectedIndex", (showModuleInfo=="true" ? 1:0));
}

function initiateModuleDownloads() {
  var mods = getSelectedResources(document.getElementById("moduleListTree"), true);
  if (!mods.length) return;
  
  if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true")
      toggleModuleBox();
  
  ModulesLoading += mods.length;
  if (!ModuleCheckInterval) ModuleCheckInterval = window.setInterval("checkAllModulesAreDownloaded();", 200);
  
  // fetch files into separate module directories so that in the end, 
  // only complete downloads will be installed.
  for (var m=0; m<mods.length; m++) {
    var is_XSM_module = (MLDS.GetTarget(mods[m], RP.Type, true) == RP.XSM_ModuleType);
    
    // all module downloads will go under "downloads/modName"
    // this directory will be deleted once download is copied away
    // don't allow another download until this one is done
    var dest = getModuleDownloadDirectory(mods[m], is_XSM_module);
    
    // start with a clean module directory each time
    if (dest.exists()) {
      ModulesLoading--;
      continue;
    }
    dest.create(dest.DIRECTORY_TYPE, DPERM);
    
    // don't download something that has already been succesfully downloaded!
    for (var x=0; x<CompletedDownloads.length; x++) {if (CompletedDownloads[x] == dest.path) break;}
    if (x < CompletedDownloads.length) {
      ModulesLoading--;
      continue;
    }
    
    if (is_XSM_module) {
      // install a .xsm module
      var xsm_url = getResourceLiteral(MLDS, mods[m], "ModuleUrl");
      if ((/\.(zip|xsm)$/).test(xsm_url)) {
        downloadModule(mods[m], "", dest, 
          [ { url:xsm_url, size:1 } ]
        );
      }
      else {
        // get audio book and chapters
        var modConf = getTempDirOfUrl(getResourceLiteral(MLDS, mods[m], "Url"));
        modConf.append("mods.d");
        modConf.append(getResourceLiteral(MLDS, mods[m], "ConfFileName"));
        var data = { ok:false, bk:null, ch:null, cl:null, audio:eval(getConfEntry(readFile(modConf), "AudioChapters")) };
        var dlg = window.openDialog("chrome://xulsword/content/dialogs/addRepositoryModule/audioDialog.xul", "dlg", DLGSTD, data);
        if (!data.ok || !data.bk || !data.ch || !data.cl) {
          ModulesLoading--;
          continue;
        }
        downloadModule(mods[m], "", dest, 
            [{ url:xsm_url + "&bk=" + data.bk + "&ch=" + data.ch + "&cl=" + data.cl, size:1 }] );
      }
    }
    else {
      // install a SWORD module
    
      // first, copy .conf file from local dir to "downloads/modName/mods.d"
      var modsdDir = dest.clone();
      modsdDir.append("mods.d");
      if (!modsdDir.exists()) modsdDir.create(modsdDir.DIRECTORY_TYPE, DPERM);
      
      var repoUrl = getResourceLiteral(MLDS, mods[m], "Url");
      var confSource = getTempDirOfUrl(repoUrl);
      confSource.append("mods.d");
      confSource.append(getResourceLiteral(MLDS, mods[m], "ConfFileName"));
      if (!confSource.exists()) {
        jsdump("ERROR: Conf file doesn't exist \"" + confSource.path + "\".");
        ModulesLoading--;
        continue;
      }
      confSource.copyTo(modsdDir, null);
      
      // now copy the module contents from the Url to "downloads/modName/modules/..."
      setResourceAttribute(MLDS, mods[m], "Status", "0%");
      setResourceAttribute(MLDS, mods[m], "Style", "yellow");
          
      var mpath = getResourceLiteral(MLDS, mods[m], "DataPath");
      mpath = mpath.replace(/^\.\//, "").replace(/[\\\/][^\\\/]*$/, "");
      
      setResourceAttribute(MLDS, mods[m], "Status", "0%");
      setResourceAttribute(MLDS, mods[m], "Style", "yellow");
    
      // getModContentUrls will asyncronously call downloadModule when all 
      // module content files are known. Then checkAllModulesAreDownloaded 
      // will finish up once all downloads have completed
      var data = { repoUrl:repoUrl, mpath:mpath, dest:dest, count:1, modContentData:[] };
      getModContentUrls(mods[m], mpath, data);
    }
  }
}

function installModules() {

  MainWindow.AddRepositoryModules = getInstallableModules();
  
  MainWindow.installModuleArray(MainWindow.finishAndHandleReset, MainWindow.AddRepositoryModules);
  
  window.close();
}


function updateRepoListButtons(e) {
  var buttons  = ["toggle", "add", "delete"];
  var disabled = [true, false, true];
  
  // button states depend on selection
  var tree = document.getElementById("repoListTree");
  var sel = tree.view.selection;
  
  if (sel.currentIndex != -1) {
    disabled[0] = false; // toggle
    disabled[2] = false; // delete
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function onModuleListTreeSelect() {
  var mods = getSelectedResources(document.getElementById("moduleListTree"));

  var xsmUrls = [];
  for (var m=0; m < mods.length; m++) {
    var mod = mods[m];
    var is_XSM_module = (MLDS.GetTarget(mod, RP.Type, true) == RP.XSM_ModuleType);
    if (!is_XSM_module) continue;
    var url = getResourceLiteral(MLDS, mod, "ModuleUrl");
    if (!url) continue;
    xsmUrls.push();
  }
  
  // this doesn't work on Windows, and is perhaps a bit annoying anyway
  /*
  // if an XSM module is selected, select its other members as well
  if (xsmUrls.length) {
    var tree = document.getElementById("moduleListTree");
    var treeBuilder = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var selection = tree.view.selection;
    for (var i=0; i<tree.view.rowCount; i++) {
      var res = treeBuilder.getResourceAtIndex(i);
      var is_XSM_module = (MLDS.GetTarget(res, RP.Type, true) == RP.XSM_ModuleType);
      if (!is_XSM_module) continue;
      var url = getResourceLiteral(MLDS, res, "ModuleUrl");
      if (!url) continue;
      for (var m=0; m<xsmUrls.length; m++) {if (xsmUrls[m] == url) break;}
      if (m == xsmUrls.length) continue;
      
      // this index should be selected
      if (selection.isSelected(i)) continue;
      selection.toggleSelect(i);
    }
  }
  */
  
  updateModuleButtons();
}

function updateModuleButtons() {
  var buttons  = ["installButton", "showInfoButton", "showModulesButton"];
  var disabled = [true, true, false];
  
  // button states depend on selection
  var tree = document.getElementById("moduleListTree");
  var sel = tree.view.selection;
  
  if (sel.currentIndex != -1) {
    disabled[0] = false; // install
    disabled[1] = false; // showInfo
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function addRepository() {
  
  // ensure user sees the columns which will need updating
  document.getElementById("Name").removeAttribute("hidden");
  document.getElementById("Site").removeAttribute("hidden");
  document.getElementById("Path").removeAttribute("hidden");
  
  var nres = { Type:"repository", Enabled:"false", Name:"?", Site:"?", Path:"?", Status:"Off", Style:"red", Url:"?" };
  var res = createRepository(nres);
  
  // scroll to the new repository and select and focus it
  var tree = document.getElementById("repoListTree");
  var index = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getIndexOfResource(res);
  tree.view.selection.select(index);
  tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(index);
  tree.focus();
}


////////////////////////////////////////////////////////////////////////
// Module Info routines
////////////////////////////////////////////////////////////////////////

// Taken from dialogs/about.html
function writeModuleInfos() {
  var mods = getSelectedResources(document.getElementById("moduleListTree"), true);
  if (!mods.length) return;
  
  var html = "";
  
  for (var m=0; m<mods.length; m++) {
    var submods = [];
    
    var is_XSM_module = (MLDS.GetTarget(mods[m], RP.Type, true) == RP.XSM_ModuleType);
    
    if (is_XSM_module) {
      // include all SWORD modules within this XSM module
      var myXSM = getResourceLiteral(MLDS, mods[m], "ModuleUrl");
      if (myXSM) {
        RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
        var mls = RDFC.GetElements();
        while (mls.hasMoreElements()) {
          var ml = mls.getNext();
          var xsm = getResourceLiteral(MLDS, ml, "ModuleUrl");
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
      
      var modName = getResourceLiteral(MLDS, aModRes, "ModuleName");
    
      html += "<div class=\"module-detail cs-Program\">";
      
      // Heading and version
      var vers = getResourceLiteral(MLDS, aModRes, "Version");
      var modAbbr = getResourceLiteral(MLDS, aModRes, "Abbreviation");
      if (!modAbbr || modAbbr == "?") modAbbr = modName; 
      html +=  "<span class=\"mod-detail-heading\">";
      html +=    modAbbr + (vers != "?" ? "(" + vers + ")":"");
      html +=  "</span>";
      
      // Descripton
      var description = getResourceLiteral(MLDS, aModRes, "Description");
      if (description) 
          html += "<div class=\"description\">" + description + "</div>";

      // Copyright
      var copyright = getResourceLiteral(MLDS, aModRes, "DistributionLicense");
      if (copyright)
           html += "<div class=\"copyright\">" + copyright + "</div>";
           
      // About
      var about = getResourceLiteral(MLDS, aModRes, "About");
      if (about) {
        about = about.replace(/(\\par)/g, "<br>");
        html += "<div class=\"about\">" + about + "</div>";
      }
           
      html += "</div>"; // end module-detail
         
      // Conf contents
      var confFile = getResourceLiteral(MLDS, aModRes, "ConfFileName");
      if (confFile) {
        html += "<div id=\"conf." + modName + "\" class=\"conf-info\" showInfo=\"false\" readonly=\"readonly\">";
        html +=   "<a class=\"link\" href=\"javascript:frameElement.ownerDocument.defaultView";
        html +=     ".toggleInfo('" + modName + "', '" + getResourceLiteral(MLDS, aModRes, "Url") + "', '" + confFile + "');\">";
        html +=     "<span class=\"more-label\">" + getUI("more.label") + "</span>";
        html +=     "<span class=\"less-label\">" + getUI("less.label") + "</span>";
        html +=   "</a>";
        html +=   "<textarea id=\"conftext." + modName + "\" class=\"cs-" + DEFAULTLOCALE + "\" readonly=\"readonly\"></textarea>";
        html += "</div>";
      }
    }
  }
  
  var body = document.getElementById("infoBox").contentDocument.getElementsByTagName("body")[0];
  body.innerHTML = html;
}

function getUI(id) {
  return getDataUI(id);
}

function toggleInfo(mod, url, conf) {
  var doc = document.getElementById("infoBox").contentDocument;
  var elem = doc.getElementById("conf." + mod);
  var showInfo = elem.getAttribute("showInfo");
 
  if (showInfo == "false") {
    var confInfo = "-----";
    var confFile = getTempDirOfUrl(url);
    confFile.append("mods.d");
    confFile.append(conf);
    if (!confFile.exists()) {
      jsdump("ERROR: Missing .conf file \"" + confFile.path + "\"");
    }
    else {confInfo  = readFile(confFile);}

    elem.getElementsByTagName("textarea")[0].value = confInfo;
  }

  elem.setAttribute("showInfo", (showInfo == "true" ? "false":"true"));

}


////////////////////////////////////////////////////////////////////////
// Utility functions
////////////////////////////////////////////////////////////////////////

// this function blocks (is not intended for asynchronous use)
function unCompressTarGz(aTarGz, aDir) {
  if (OPSYS == "Linux") {

    var script = "\
#!/bin/sh" + NEWLINE + "\
cd \"" + aDir.path + "\"" + NEWLINE + "\
tar -xf \"" + aTarGz.path + "\"" + NEWLINE;

    var sfile = aDir.clone();
    sfile.append("untargz.sh");
    writeFile(sfile, script, true);
    
    var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(sfile);
    process.run(true, [], 0);
  }
  
  // for Windows, 7za.exe must be included with xulsword (250kb compressed)
  else if (OPSYS == "Windows") {
    var w7z = getSpecialDirectory("CurProcD");
    w7z.append("7za.exe");
    
    var script = "\
Set objShell = CreateObject(\"WScript.Shell\")" + NEWLINE + "\
objShell.Run \"\"\"" + w7z.path + "\"\" x \"\"" + aTarGz.path + "\"\" -o\"\"" + aDir.path + "\"\"\", 0, True" + NEWLINE + "\
objShell.Run \"\"\"" + w7z.path + "\"\" x \"\"" + aDir.path + "\\" +  aTarGz.leafName.replace(".gz", "") + "\"\" -o\"\"" + aDir.path + "\"\"\", 0, True" + NEWLINE;

    var sfile = aDir.clone();
    sfile.append("untargz.vbs");
    writeFile(sfile, script, true);
    
    var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(sfile);
    process.run(true, [], 0);
  }
  else throw ("ERROR: unCompressTarGz not implemented for this op-sys");
}

// Set a resource's attribute (a string) to value (also a string)
function setResourceAttribute(aDS, resource, attribute, value) {
  try {attribute = RP[attribute];} catch (er) {return false;}
  var aNewValue = (value !== null ? RDF.GetLiteral(value):null);
  var aOldValue = aDS.GetTarget(resource, attribute, true);
  if ((aOldValue || aNewValue) && aOldValue != aNewValue) {
    if (aOldValue && !aNewValue)
      aDS.Unassert(resource, attribute, aOldValue);
    else if (!aOldValue && aNewValue)
      aDS.Assert(resource, attribute, aNewValue, true);
    else /* if (aOldValue && aNewValue) */
      aDS.Change(resource, attribute, aOldValue, aNewValue);
    return true;
  }
  return false;
}

// Get a string value of a resources string attribute
function getResourceLiteral(aDS, resource, attribute) {
  
  attribute = RDF.GetResource(RP.REPOSITORY + attribute);
  
  var val = aDS.GetTarget(resource, attribute, true);
  if (!val) return null;
  
  return val.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
}

// Returns true if repository is already in the database, false otherwise
function existsRepository(repoInfo) {
  
  var ress = RPDS.GetAllResources();
  
  NextResource:
  while(ress.hasMoreElements()) {
    var res = ress.getNext();
    
    // if these resource attributes match repoInfo, this repo already exists
    var check = ["Type", "Site", "Path", "Url"];
     
    for (var i=0; i<check.length; i++) {
      var val = RPDS.GetTarget(res, RP[check[i]], true);
      if (!val) continue NextResource;
      val = val.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      if (val != repoInfo[check[i]]) continue NextResource;
    }
    
    return true;
  }
  
  return false;
}

// Add a repository to the database. If such a repository happens to 
// exist already, then a duplicate one will be created and added.
function createRepository(newRepoInfo, resourceID) {
  
  // create a new resource
  var res = (resourceID ? RDF.GetResource(resourceID):RDF.GetAnonymousResource());
  for (var p in newRepoInfo) {
    RPDS.Assert(res, RP[p], RDF.GetLiteral(replaceASCIIcontrolChars(newRepoInfo[p])), true);
  }
  
  // add the new resource to our database's xulswordRepo list
  var list = RDF.GetResource(RP.XulswordRepoListID);
  RDFC.Init(RPDS, list);
  RDFC.AppendElement(res);

  return res;
}

// Remove a repository resource entirely from the database. This does
// no Type checking to ensure repoResouce is actually a repository.
function deleteRepository(repoResourceArray) {

  // collect url info before beginning to delete (to filter modules with)
  var urls = [];
  for (var i=0; i<repoResourceArray.length; i++) {
    urls.push(RPDS.GetTarget(repoResourceArray[i], RP.Url, true));
  }
  
  // remove from database's xulswordRepo list
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  for (var i=0; i<repoResourceArray.length; i++) {
    RDFC.RemoveElement(repoResourceArray[i], (i==(repoResourceArray.length-1) ? true:false));
  }
  
  // remove attributes from repository resource
  for (var i=0; i<repoResourceArray.length; i++) {
    var arcsOut = RPDS.ArcLabelsOut(repoResourceArray[i]);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = RPDS.GetTargets(repoResourceArray[i], thisarc, true);
      while (targs.hasMoreElements()) {
        RPDS.Unassert(repoResourceArray[i], thisarc, targs.getNext());
      }
    }
  }

  deleteModuleData(urls);
}

// Delete all modules associated with a list of repository Urls 
function deleteModuleData(repoUrlArray) {

  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  var mods = RDFC.GetElements();
  while (mods.hasMoreElements()) {
    var mod = mods.getNext();
    
    var url = MLDS.GetTarget(mod, RP.Url, true);
    for (var i=0; i<repoUrlArray.length; i++) {if (url == repoUrlArray[i]) break;}
    if (i == repoUrlArray.length) continue;
    
    // remove mod from ModuleList
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    RDFC.RemoveElement(mod, (mods.hasMoreElements() ? false:true));
    
    // delete mod attributes
    var arcsOut = MLDS.ArcLabelsOut(mod);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = MLDS.GetTargets(mod, thisarc, true);
      while (targs.hasMoreElements()) {
        MLDS.Unassert(mod, thisarc, targs.getNext());
      }
    }
  }
}

// Populate the language tree's data from enabled repository modules
function buildLanguageList() {

  // delete all LanguageList resources
  RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
  var langs = RDFC.GetElements();
  while (langs.hasMoreElements()) {
    var lang = langs.getNext();
    
    // delete llr attributes
    var arcsOut = MLDS.ArcLabelsOut(lang);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = MLDS.GetTargets(lang, thisarc, true);
      while (targs.hasMoreElements()) {
        MLDS.Unassert(lang, thisarc, targs.getNext());
      }
    }
    
    RDFC.RemoveElement(lang, (langs.hasMoreElements() ? false:true));
  }
  
  // get url of each enabled repository
  var urls = [];
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  var repos = RDFC.GetElements();
  while (repos.hasMoreElements()) {
    var repo = repos.getNext();
    if (RPDS.GetTarget(repo, RP.Enabled, true) == RP.False) continue;
    urls.push(RPDS.GetTarget(repo, RP.Url, true));
  }
  
  // add a resource for each language in the enabled repository database, 
  // with NO DUPLICATES
  var langs = [];
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  var mods = RDFC.GetElements();
  NextResource:
  while (mods.hasMoreElements()) {
    var mod = mods.getNext();
    
    var url = MLDS.GetTarget(mod, RP.Url, true);
    
    // if url is not on enabled repo list then don't include this mod
    for (var i=0; i<urls.length; i++) {if (urls[i] == url) break;}
    if (i == urls.length) continue;
    
    var lang = MLDS.GetTarget(mod, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
    lang = lang.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    var rlang = getLangReadable(lang);
    
    for (var i=0; i<langs.length; i++) {
      if (langs[i].rlang == rlang) continue NextResource;
    }
    
    langs.push( { lang:lang, rlang:rlang } );
  }
  
  RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
  for (var i=0; i<langs.length; i++) {
    var newLangRes = RDF.GetAnonymousResource();
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Type"), RP.LanguageListType, true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Lang"), RDF.GetLiteral(langs[i].lang), true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral(langs[i].rlang), true);
    RDFC.AppendElement(newLangRes);
  }
  
}

function getLangReadable(lang) {
  if ((/^en(\-*|\_*)$/).test(lang)) return "English";
  
  if (!lang || lang == "?" || (/^\s*$/).test(lang)) return "?";

  var rlang = LibSword.translate(lang, "locales");
  
  var renlang = null;
  if (rlang == lang || (/^en(\-|$)/).test(getLocale())) {
    var enlang = lang.match(/^([^\-]+).*?$/)[1]; // remove extensions since this is in English
    renlang = LibSword.translate(enlang + ".en", "locales");
    if (renlang == enlang + ".en") renlang = null;
  }

  return (renlang ? renlang:rlang);
}

function selectLanguage(language) {
  var tree = document.getElementById("languageListTree");
  
  var defRes = null;
  
  // try selecting language
  if (language) {
    RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
    var defRes = null;
    var langs = RDFC.GetElements();
    while (langs.hasMoreElements()) {
      var lang = langs.getNext();
      var lcode = getResourceLiteral(MLDS, lang, "Lang");
      if (!lcode) continue;
      if (lcode == language) {
        defRes = lang;
        break;
      }
      if (lcode.replace(/\-.*$/, "") == language.replace(/\-.*$/, "")) defRes = lang;
    }
  }
  
  // otherwise select program language
  if (!defRes) {
    var progLang = getLocale();
    if (!progLang) progLang = DEFAULTLOCALE;
    
    RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
    var langs = RDFC.GetElements();
    while (langs.hasMoreElements()) {
      var lang = langs.getNext();
      var lcode = getResourceLiteral(MLDS, lang, "Lang");
      if (!lcode) continue;
      if (lcode == progLang) {
        defRes = lang;
        break;
      }
      if (lcode.replace(/\-.*$/, "") == progLang.replace(/\-.*$/, "")) defRes = lang;
    }
  }
  
  // otherwise select first language on list
  var index = 0;
  if (defRes) {
    index = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getIndexOfResource(defRes);
    if (!index || index < 0) index = 0;
  }
  
  tree.view.selection.select(index);
  tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(index);
}

// Connect and disconnect tree data sources
function treeDataSource(disconnectArray, idArray) {

  for (var i=0; i<idArray.length; i++) {
    if (!disconnectArray[i]) {
      document.getElementById(idArray[i]).database.AddDataSource(idArray[i]=="repoListTree" ? RPDS:MLDS);
      document.getElementById(idArray[i]).builder.rebuild();
    }
    else {
      var tree = document.getElementById(idArray[i]);
      var ss = tree.database.GetDataSources();
      while (ss.hasMoreElements()) {tree.database.RemoveDataSource(ss.getNext());}
      tree.builder.rebuild();
    }
  }
  
}

function getTempDirOfUrl(url) {
  var file = TEMP.clone();
  file.append(url.replace(/^ftp:\/\//, "").replace(/[\\\/]/g, "_"));

  return file;
}

function getConfEntry(filedata, param) {
  if (param == "ModuleName") {
    var prm = new RegExp("\\[(.*)\\]", "m");
    var retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  else {
    prm = new RegExp("\\s*" + escapeRE(param) + "\\s*=\\s*(.*?)\\s*?[\\r\\n]", "im");
    retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  
  return retval;
}

function getSelectedResources(tree, noDuplicateXSMs) {
  var resourceArray = [];
  
  var start = new Object();
  var end = new Object();
  var numRanges = tree.view.selection.getRangeCount();
  
  var selInfo = [];
  for (var i=0; i<numRanges; i++) {
    tree.view.selection.getRangeAt(i, start, end);
    for (var v=start.value; v<=end.value; v++) {
      try {
        var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(v);
      }
      catch (er) {continue;}
      var is_XSM_module = (MLDS.GetTarget(res, RP.Type, true) == RP.XSM_ModuleType);
      selInfo.push( 
        { resource:res, 
          isXSM:is_XSM_module, 
          xsmUrl:(is_XSM_module ? getResourceLiteral(MLDS, res, "ModuleUrl"):"")
        }
      );
    }
  }
  
  for (var i=0; i<selInfo.length; i++) {
    if (!selInfo[i].resource) continue;
    if (noDuplicateXSMs && selInfo[i].isXSM) {
      for (var j=i+1; j<selInfo.length; j++) {
        if (!selInfo[j].resource) continue;
        if (selInfo[j].xsmUrl == selInfo[i].xsmUrl) {
          selInfo[j].resource = null;
        }
      }
    }
    
    resourceArray.push(selInfo[i].resource);
  }

  return resourceArray;
}
        
function dbFlush(aDS) {
  // make it permanent
  aDS = aDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  aDS.Flush();
}

// each file download is controlled by a progress object
function removeProgress(progress) {
  for (var i=0; i<DownloadsInProgress.length; i++) {
    if (progress == DownloadsInProgress[i]) {
      DownloadsInProgress.splice(i,1);
      i--;
    }
  }
}

// Search the install TEMP directory for modules which can be installed
function getInstallableModules() {
  var installDir = TEMP_Install.clone();
  var files = installDir.directoryEntries;
  var installableModules = [];
  while (files.hasMoreElements()) {
    var file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
    if (file.isDirectory() || !(/\.(zip|xsm)$/).test(file.leafName)) continue;
    installableModules.push(file);
  }
  return installableModules;
}

function getModuleDownloadDirectory(modResource, is_XSM_module) {
  var dest = TEMP.clone();
  dest.append("downloads");
  if (!dest.exists()) dest.create(dest.DIRECTORY_TYPE, DPERM);
  var modName = (is_XSM_module ? getResourceLiteral(MLDS, modResource, "NameXSM"):getResourceLiteral(MLDS, modResource, "ModuleName"));
  dest.append(modName);
  
  return dest;
}


////////////////////////////////////////////////////////////////////////
// onUnload routines
////////////////////////////////////////////////////////////////////////

function onUnload() {
  
  // disconnect each data source
  treeDataSource([true, true, true], ["repoListTree", "languageListTree", "moduleListTree"]);
  
  // abort any downloads which are still in progress
  for (var i=0; i<DownloadsInProgress.length; i++) {
    DownloadsInProgress[i].cancelSave();
  }

  // remove all temporary files (but install temp files will remain)
  if (TEMP.exists()) TEMP.remove(true);
  
  // delete all module and language data (since it's reloaded anew every time)
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
  
  dbFlush(RPDS);
  dbFlush(MLDS);
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
