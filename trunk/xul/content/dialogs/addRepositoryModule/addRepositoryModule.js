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

const RepositoryRDF = "repository.rdf"; // located in xulsword's profile dir
const ModuleRDF = "swordmods.rdf";
const ManifestFile = "mods.d.tar.gz";
const DownloadTimeOut = 5000; // in milliseconds

var HaveInternetPermission = false;
var RP, RPDS, MLDS, RDF, RDFC, RDFCU;
var RepositoryArray, RepositoryIndex, RepositoriesLoading, RepositoryCheckInterval;
var TEMP;

function onLoad() {
  
  // Create clean temp directory
  TEMP = getSpecialDirectory("TmpD");
  TEMP.append("xs_addRepositoryModule");
  if (TEMP.exists()) TEMP.remove(true);
  TEMP.create(TEMP.DIRECTORY_TYPE, DPERM);

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
  RP.IBTRepoID          = RP.ROOT + "/IBT";
  RP.CrossWireRepoID    = RP.ROOT + "/CrossWire";
  
  RP.Enabled = RDF.GetResource(RP.REPOSITORY+"Enabled");
  RP.Name    = RDF.GetResource(RP.REPOSITORY+"Name");
  RP.Site    = RDF.GetResource(RP.REPOSITORY+"Site");
  RP.Path    = RDF.GetResource(RP.REPOSITORY+"Path");
  RP.Status  = RDF.GetResource(RP.REPOSITORY+"Status");
  RP.Style   = RDF.GetResource(RP.REPOSITORY+"Style");
  RP.Url     = RDF.GetResource(RP.REPOSITORY+"Url");
  RP.Type    = RDF.GetResource(RP.REPOSITORY+"Type");
  
  RP.ModuleType       = RDF.GetLiteral("module");
  RP.LanguageListType = RDF.GetLiteral("language");
  RP.RepositoryType   = RDF.GetLiteral("repository");
  RP.True             = RDF.GetLiteral("true");
  RP.False            = RDF.GetLiteral("false");
  
  var data = "\
<?xml version=\"1.0\"?>" + NEWLINE + "\
<RDF:RDF xmlns:REPOSITORY=\"" + RP.REPOSITORY + "\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.IBTRepoID + "\"" + NEWLINE + "\
                   REPOSITORY:Type=\"repository\"" + NEWLINE + "\
                   REPOSITORY:Name=\"IBT\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.ibt.org.ru\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/modsword/raw\"" + NEWLINE + "\
                   REPOSITORY:Url=\"ftp://ftp.ibt.org.ru/pub/modsword/raw\"" + NEWLINE + "\
                   REPOSITORY:Enabled=\"true\" />" + NEWLINE + "\
                   REPOSITORY:Status=\"0%\" />" + NEWLINE + "\
                   REPOSITORY:Style=\"yellow\" />" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.CrossWireRepoID + "\"" + NEWLINE + "\
                   REPOSITORY:Type=\"repository\"" + NEWLINE + "\
                   REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/sword/raw\"" + NEWLINE + "\
                   REPOSITORY:Url=\"ftp://ftp.crosswire.org/pub/sword/raw\"" + NEWLINE + "\
                   REPOSITORY:Enabled=\"true\" />" + NEWLINE + "\
                   REPOSITORY:Status=\"0%\" />" + NEWLINE + "\
                   REPOSITORY:Style=\"yellow\" />" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.masterRepoListID + "\"" + NEWLINE + "\
                   REPOSITORY:Type=\"masterRepoList\"" + NEWLINE + "\
                   REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/sword/masterRepoList.conf\" />" + NEWLINE + "\
  <RDF:Seq RDF:about=\"" + RP.XulswordRepoListID + "\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"" + RP.CrossWireRepoID + "\"/>" + NEWLINE + "\
    <RDF:li RDF:resource=\"" + RP.IBTRepoID + "\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
</RDF:RDF>";
  RPDS = initDataSource(data, RepositoryRDF);
  
  data = "\
<?xml version=\"1.0\"?>" + NEWLINE + "\
<RDF:RDF xmlns:REPOSITORY=\"" + RP.REPOSITORY + "\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
  <RDF:Seq RDF:about=\"" + RP.LanguageListID + "\">" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
  <RDF:Seq RDF:about=\"" + RP.ModuleListID + "\">" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
</RDF:RDF>";
  MLDS = initDataSource(data, ModuleRDF);
  
  if (!RPDS || !MLDS) {
    throw("ERROR: Failed to load a Data Source!");
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
  
  document.getElementById("languageListTree").view.selection.select(0);
  
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
  
  // download masterRepoList.conf
  document.getElementById("iframe").setAttribute("src", "ftp://" + site + path);
  
  waitForMasterRepoList(DownloadTimeOut);
  
}

// Keep checking for the masterRepoList information to arrive
function waitForMasterRepoList(to_ms) {
  
  // only wait for a certain period
  if (to_ms <= 0) {
    masterRepoListLoaded();
    return;
  }
  
  var list = document.getElementById("iframe").contentDocument.getElementsByTagName("body");
  if (list && list[0] && list[0].firstChild && list[0].firstChild.innerHTML) {
    list = list[0].firstChild.innerHTML.match(/^\d+=FTPSource=.*?\|.*?\|.*?\s*$/img);
    for (var i=0; list && i < list.length; i++) {
      var r = list[i].match(/^\d+=FTPSource=(.*?)\|(.*?)\|(.*?)\s*$/i);
      
      var nres = { Type:"repository", Enabled:"false", Name:r[1], Site:r[2], Path:r[3], Status:"Off", Style:"red", Url:"ftp://" + r[2] + r[3] };
      if (!existsRepository(nres)) addRepository(nres)
    }
    
    if (list) {
      masterRepoListLoaded();
      return;
    }
    
  }
  
  window.setTimeout("waitForMasterRepoList(" + (to_ms - 300) + ");", 300);
}

// Fetch and process the manifest of the next repository on the global list.
// This can (does) occur asyncronously with other repositories at the same time.
function startProcessingNextRepository() {
  RepositoryIndex++;
  if (RepositoryIndex == RepositoryArray.length) return;
  
  var myURL = RPDS.GetTarget(RepositoryArray[RepositoryIndex].resource, RP.Url, true);
  myURL = myURL.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
  myURL += "/" + ManifestFile;
  
  var file = TEMP.clone();
  file.append(myURL.replace(/^ftp:\/\//, "").replace(/[\\\/]/g, "_"));
  RepositoryArray[RepositoryIndex].manifest = file;
  if (file.exists()) file.remove(false);

  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);  
  var uri = ios.newURI(myURL, null, null); 

  var target = ios.newFileURI(file);
  persist.progressListener = 
  {
    myResource:RepositoryArray[RepositoryIndex].resource,
    myManifestFile:RepositoryArray[RepositoryIndex].manifest,
    myURL:myURL,
     
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      var perc = Math.round(100*(aCurSelfProgress/aMaxSelfProgress));
      setResourceAttribute(RPDS, this.myResource, "Status", perc + "%");
      setResourceAttribute(RPDS, this.myResource, "Style", "yellow");
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      
      // it's all done!!
      RepositoriesLoading--;
      
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
      if (aMessage) alert(this.myURL + ": " + aMessage);
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };
  
  persist.saveURI(uri, null, null, null, null, file, null);
  
  startProcessingNextRepository();
}

// Unzips the manifest file, reads the .conf files within it, and populates
// the database with the language and module information contained therein.
function applyRepositoryManifest(resource, manifest) {

  // uncompress manifest to a TEMP subdir
  var tmpDir = TEMP.clone();
  tmpDir.append(manifest.path.match(/^.*?([^\\\/]+)\.tar\.gz$/)[1]);
  if (tmpDir.exists()) tmpDir.remove(true);
  tmpDir.create(tmpDir.DIRECTORY_TYPE, DPERM);
  
  // nsIZipReader only handles ZIP- ARGGGG!
  unCompress(manifest, tmpDir);
  
  tmpDir.append("mods.d");
  if (!tmpDir.exists()) return;
  
  var confs = tmpDir.directoryEntries;
  while (confs.hasMoreElements()) {
    var file = confs.getNext();
    if (!(/\.conf$/).test(file.QueryInterface(Components.interfaces.nsILocalFile).leafName)) continue; 
    
    // read the extracted file
    var filedata = readFile(file);
    
    // create a new module resource and add it to the modlist
    var newModRes = RDF.GetAnonymousResource();
    
    // add Type
    MLDS.Assert(newModRes, RP.Type, RP.ModuleType, true);
    // add Url
    MLDS.Assert(newModRes, RP.Url, RPDS.GetTarget(resource, RP.Url, true), true);
    
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    RDFC.AppendElement(newModRes);
    
    // write the new .conf info to new module resource
    // RDF-Attribute:"Conf-Entry"
    var confInfo = {
      Name:"ModuleName",
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
      TextSource:"TextSource"
    };
    
    for (var p in confInfo) {
      var confres = getConfEntry(filedata, confInfo[p]);
      if (confres === null) confres = "";
      MLDS.Assert(newModRes, RDF.GetResource(RP.REPOSITORY + p), RDF.GetLiteral(confres), true);
    }
  }
}


////////////////////////////////////////////////////////////////////////
// Utility functions
////////////////////////////////////////////////////////////////////////

function unCompress(aTarGz, aDir) {
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
  else throw ("ERROR: unCompress not implemented for this op-sys");
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

// Returns true if repository is already in the database, false otherwise
function existsRepository(repoInfo) {
  
  var ress = RPDS.GetAllResources();
  
  NextResource:
  while(ress.hasMoreElements()) {
    var res = ress.getNext();
    
    // if these resource attributes match repoInfo, this repo already exists
    var check = ["Type", "Name", "Site", "Path"];
     
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
// exist already, then a duplicate one will be created and added!
function addRepository(newRepoInfo) {
  
  // create a new resource
  var res = RDF.GetAnonymousResource();
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
// no Type checking to insure repoResouce is actually a repository.
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
  
  // add a resource for each language in the enabled repository database, 
  // with NO DUPLICATES
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  var mods = RDFC.GetElements();
  
  // get url of each enabled repository
  var urls = [];
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  var repos = RDFC.GetElements();
  while (repos.hasMoreElements()) {
    var repo = repos.getNext();
    if (RPDS.GetTarget(repo, RP.Enabled, true) == RP.False) continue;
    urls.push(RPDS.GetTarget(repo, RP.Url, true));
  }
  
  var langs = [];
  NextResource:
  while (mods.hasMoreElements()) {
    var mod = mods.getNext();
    
    var url = MLDS.GetTarget(mod, RP.Url, true);
    
    // if url is not on enabled repo list then don't include this mod
    for (var i=0; i<urls.length; i++) {if (urls[i] == url) break;}
    if (i == urls.length) continue;
    
    var lang = MLDS.GetTarget(mod, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
    lang = lang.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    if (lang == "") continue;
    
    for (var i=0; i<langs.length; i++) {
      if (langs[i] == lang) continue NextResource;
    }
    
    langs.push(lang);
  }
  
  RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
  for (var i=0; i<langs.length; i++) {
    var newLangRes = RDF.GetAnonymousResource();
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Type"), RP.LanguageListType, true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Lang"), RDF.GetLiteral(langs[i]), true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral("Readable: " + langs[i]), true);
    RDFC.AppendElement(newLangRes);
  }
  
}

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

function getSelectedResources(tree) {
  var resourceArray = [];
  
  var start = new Object();
  var end = new Object();
  var numRanges = tree.view.selection.getRangeCount();

  for (var i=0; i<numRanges; i++) {
    tree.view.selection.getRangeAt(i, start, end);
    for (var v=start.value; v<=end.value; v++) {
      try {
        var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(v);
      }
      catch (er) {continue;}
      resourceArray.push(res);
    }
  }
  
  return resourceArray;
}

function dbFlush(aDS) {
  // make it permanent
  aDS = aDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  aDS.Flush();
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
  
  document.getElementById("languageListTree").view.selection.select(0);
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

function changeModuleListLanguage() {
  var tree = document.getElementById("languageListTree");
  
  var selIndex = tree.view.selection.currentIndex;
  
  var lang = "none";
  try {
    if (selIndex != -1) {
      var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(selIndex);
      res = MLDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
      lang = res.QueryInterface(Components.interfaces.nsIRDFLiteral).Value
    }
  } catch (er) {}

  document.getElementById("dynamicLanguageRule").setAttribute("REPOSITORY:Lang", lang);
  document.getElementById("moduleListTree").builder.rebuild(); 
}

function writeModuleInfos() {
  
}

function toggleModuleBox() {
  var cont = document.getElementById("moduleDialog");
  var showModuleInfo = cont.getAttribute("showModuleInfo");
  showModuleInfo = (showModuleInfo == "false" ? "true":"false");
  cont.setAttribute("showModuleInfo", showModuleInfo);
}

function initiateModuleDownloads() {
  
}

// Install any downloaded modules
function installModules() {

  
}

function updateRepoListButtons(e) {
  var buttons  = ["toggle", "edit", "add", "delete"];
  var disabled = [true, true, false, true];
  
  // button states depend on selection
  var tree = document.getElementById("repoListTree");
  var sel = tree.view.selection;
  
  if (sel.currentIndex != -1) {
    disabled[0] = false; // toggle
    disabled[3] = false; // delete
    var selectedResources = getSelectedResources(tree);
    if (selectedResources.length == 1) disabled[1] = false; // edit
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function updateModuleButtons(e) {
  var buttons  = ["install", "showInfo", "showModules"];
  var disabled = [true, true, false];
  
  // button states depend on selection
  var tree = document.getElementById("moduleListTree");
  var sel = tree.view.selection;
  
  if (sel.currentIndex != -1) {
    disabled[0] = false; // install
    var selectedResources = getSelectedResources(tree);
    if (selectedResources.length == 1) disabled[1] = false; // showInfo
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}


////////////////////////////////////////////////////////////////////////
// onUnload routines
////////////////////////////////////////////////////////////////////////

function onUnload() {

  // remove all temporary files
  if (TEMP.exists()) TEMP.remove(true);
  
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
