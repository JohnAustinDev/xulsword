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
                   REPOSITORY:Enabled=\"true\" />" + NEWLINE + "\
                   REPOSITORY:Status=\"0%\" />" + NEWLINE + "\
                   REPOSITORY:Style=\"yellow\" />" + NEWLINE + "\
  <RDF:Description RDF:about=\"" + RP.CrossWireRepoID + "\"" + NEWLINE + "\
                   REPOSITORY:Type=\"repository\"" + NEWLINE + "\
                   REPOSITORY:Name=\"CrossWire\"" + NEWLINE + "\
                   REPOSITORY:Site=\"ftp.crosswire.org\"" + NEWLINE + "\
                   REPOSITORY:Path=\"/pub/sword/raw\"" + NEWLINE + "\
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
</RDF:RDF>";
  MLDS = initDataSource(data, ModuleRDF, true);
  
  RDFCU.MakeSeq(MLDS, RDF.GetResource(RP.LanguageListID));
  RDFCU.MakeSeq(MLDS, RDF.GetResource(RP.ModuleListID));
  
  if (!RPDS) {
    throw("ERROR: Failed to load Repository Data Source!");
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
  
  // add our datasource to the trees
  document.getElementById("repoListTree").database.AddDataSource(RPDS);
  document.getElementById("repoListTree").builder.rebuild();

  loadMasterRepoList(); // will call masterRepoListLoaded() when loaded
}

function masterRepoListLoaded() {
  
    initRepositoryArray();
    
    // get number of repositories which will be loaded
    RepositoriesLoading = 0;
    for (var i=0; i<RepositoryArray.length; i++) {
      var enabled = RPDS.GetTarget(RepositoryArray[i].resource, RP.Enabled, true);
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      if (enabled == "true") RepositoriesLoading++;
    }
    RepositoryCheckInterval = window.setInterval("checkAllRepositoriesLoaded();", 200);
    
    startProcessingNextRepository();
    
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

function initDataSource(data, fileName, startClean) {

  var rdfFile = getSpecialDirectory("ProfD");
  rdfFile.append(fileName);
  
  if (startClean) rdfFile.remove(false);

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
      
      var nres = { Type:"repository", Enabled:"false", Name:r[1], Site:r[2], Path:r[3], Status:"Off", Style:"red" };
      if (!existsRepository(nres)) addRepository(nres)
    }
    
    if (list) {
      masterRepoListLoaded();
      return;
    }
    
  }
  
  window.setTimeout("waitForMasterRepoList(" + (to_ms - 300) + ");", 300);
}

// Load a global array which lists all repositories in the database at this moment
function initRepositoryArray() {

    RepositoryArray = [];
    RepositoryIndex = -1; // begin sequence
    
    var ress = RPDS.GetAllResources();
    while(ress.hasMoreElements()) {
      var res = ress.getNext();
      var type = RPDS.GetTarget(res, RP.Type, true);
      if (!type) continue;
      type = type.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      if (type != "repository") continue;
      
      var obj = { resource:res, manifest:null };
      RepositoryArray.push(obj);
    }
}

// Fetch and process the manifest of the next repository on the global list.
// This can (does) occur asyncronously with other repositories at the same time.
function startProcessingNextRepository() {
  RepositoryIndex++;
  if (RepositoryIndex == RepositoryArray.length) return;
  
  // get basic repository data strings
  var rdata = {};
  var info = ["Enabled", "Site", "Path"];
  for (var i=0; i<info.length; i++) {
    var val = RPDS.GetTarget(RepositoryArray[RepositoryIndex].resource, RP[info[i]], true);
    if (!val) val = "";
    else val = val.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    
    rdata[info[i]] = val;
  }
  
  // read repository manifest only if repo is enabled!
  if (rdata.Enabled != "false") {
    
    var myURL = "ftp://" + rdata.Site + rdata.Path + "/" + ManifestFile;
    RPDS.Assert(RepositoryArray[RepositoryIndex].resource, RP.Url, RDF.GetLiteral(myURL), true);
    
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
        if (aStatus == 0) {
          setResourceAttribute(RPDS, this.myResource, "Status", "On");
          setResourceAttribute(RPDS, this.myResource, "Style", "green");
          applyRepositoryManifest(this.myResource, this.myManifestFile);
          RepositoriesLoading--;
        }
        else {
          setResourceAttribute(RPDS, this.myResource, "Status", "Error");
          setResourceAttribute(RPDS, this.myResource, "Style", "red");
        }
      },
      
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
        setResourceAttribute(RPDS, this.myResource, "Status", "Error");
        setResourceAttribute(RPDS, this.myResource, "Style", "red");
        if (aMessage) alert(myURL + ": " + aMessage);
      },
      
      onLocationChange: function(aWebProgress, aRequest, aLocation) {},
      
      onSecurityChange: function(aWebProgress, aRequest, aState) {}
    };
    
    persist.saveURI(uri, null, null, null, null, file, null);
  }
  
  startProcessingNextRepository();
}

// Unzips the manifest file, reads the .conf files within it, and populates
// the database with the language and module information contained therein.
function applyRepositoryManifest(resource, manifest) {
  
/*
  var waited = 0;
  if (!manifest.exists()) {
    var date = new Date();
    var timeMS = date.getTime();
    while (!manifest.exists()) {
      date = new Date();
      waited = date.getTime() - timeMS;
      if (waited > 1000) break;
    }
  }
  jsdump("waited " + waited + "ms, file.exists() = " + manifest.exists());
*/
  
  var repoUrl = RPDS.GetTarget(resource, RP.Url, true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
  deleteModuleData(repoUrl);
  
  // uncompress manifest to a TEMP subdir (nsIZipReader only handles ZIP!)
  var tmpDir = TEMP.clone();
  tmpDir.append(manifest.path.match(/^.*?([^\\\/]+)\.tar\.gz$/)[1]);
  if (tmpDir.exists()) tmpDir.remove(true);
  tmpDir.create(tmpDir.DIRECTORY_TYPE, DPERM);
  
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
    MLDS.Assert(newModRes, RP.Type, RP.ModuleType, true);
    MLDS.Assert(newModRes, RP.Url, RDF.GetLiteral(repoUrl), true);
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

function checkAllRepositoriesLoaded() {
  if (RepositoriesLoading !== 0) return;

  window.clearInterval(RepositoryCheckInterval);
  
  refreshLanguageList();
   
  document.getElementById("languageListTree").database.AddDataSource(MLDS);
  document.getElementById("languageListTree").builder.rebuild();
  
  document.getElementById("moduleListTree").database.AddDataSource(MLDS);
  document.getElementById("moduleListTree").builder.rebuild();
  
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
function deleteRepository(repoResource) {
  
  var repoUrl = RPDS.GetTarget(repoResource, RP.Url, true);
  if (repoUrl) deleteModuleData(repoUrl.QueryInterface(Components.interfaces.nsIRDFLiteral).Value);
  
  // remove from database's xulswordRepo list
  RDFC.Init(RPDS, RDF.GetResource(RP.XulswordRepoListID));
  RDFC.RemoveElement(repoResource, false);
  
  // remove attributes from resource
  var arcsOut = RPDS.ArcLabelsOut(repoResource);
  while (arcsOut.hasMoreElements()) {
    var thisarc = arcsOut.getNext();
    var targs = RPDS.GetTargets(repoResource, thisarc, true);
    while (targs.hasMoreElements()) {
      RPDS.Unassert(repoResource, thisarc, targs.getNext());
    }
  }
}

function deleteModuleData(repoUrl) {
  RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
  var ress = RDFC.GetElements();
  while (ress.hasMoreElements()) {
    var aRes = ress.getNext();
    
    var url = MLDS.GetTarget(aRes, RP.Url, true);
    if (url && url.QueryInterface(Components.interfaces.nsIRDFLiteral).Value != repoUrl) {
      continue;
    }
    
    // delete aRes attributes
    var arcsOut = MLDS.ArcLabelsOut(aRes);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = MLDS.GetTargets(aRes, thisarc, true);
      while (targs.hasMoreElements()) {
        MLDS.Unassert(aRes, thisarc, targs.getNext());
      }
    }
    
    // remove aRes from ModuleList
    RDFC.RemoveElement(aRes, false);
  }
}

function refreshLanguageList() {

  // remove all LanguageList contents
  RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
  var langs = RDFC.GetElements();
  while (langs.hasMoreElements()) {
    RDFC.RemoveElement(langs.getNext(), false);
  }
  
  // delete all LanguageList resources
  var llrs = MLDS.GetAllResources();
  while (llrs.hasMoreElements()) {
    var llr = llrs.getNext();
    var type = MLDS.GetTarget(llr, RP.Type, true);
    if (!type || type != RP.LanguageListType) continue;
    
    // delete llr attributes
    var arcsOut = MLDS.ArcLabelsOut(llr);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = MLDS.GetTargets(llr, thisarc, true);
      while (targs.hasMoreElements()) {
        MLDS.Unassert(llr, thisarc, targs.getNext());
      }
    }
  }

//TODO: this does not handle Enabled!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  // add a resource for each language in the repository database, 
  // with NO DUPLICATES
  var langs = [];
  var resources = MLDS.GetAllResources();
  
  NextResource:
  while (resources.hasMoreElements()) {
    var res = resources.getNext();
    var type = MLDS.GetTarget(res, RP.Type, true);
    if (!type || type != RP.ModuleType) continue;
    
    var lang = MLDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
    lang = lang.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
    if (lang == "") continue;
    
    for (var i=0; i<langs.length; i++) {
      if (langs[i] == lang) continue NextResource;
    }
    langs.push(lang);
    
    var newLangRes = RDF.GetAnonymousResource();
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Type"), RP.LanguageListType, true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Lang"), RDF.GetLiteral(lang), true);
    MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral("Readable: " + lang), true);
    RDFC.AppendElement(newLangRes);
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

function dbFlush(aDS) {
  // make it permanent
  aDS = aDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  aDS.Flush();
}


////////////////////////////////////////////////////////////////////////
// Mouse and Selection functions
////////////////////////////////////////////////////////////////////////

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
    disabled[1] = false; // showInfo
  }
  
  // apply disabled attribute
  for (var i=0; i<buttons.length; i++) {
    if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
    else document.getElementById(buttons[i]).removeAttribute("disabled");
  }
}

function getSelectedResources(tree) {
  var resourceArray = [];
  
  var start = new Object();
  var end = new Object();
  var numRanges = tree.view.selection.getRangeCount();

  for (var i=0; i<numRanges; i++) {
    tree.view.selection.getRangeAt(i, start, end);
    for (var v=start.value; v<=end.value; v++) {
      var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(v);
      resourceArray.push(res);
    }
  }
  
  return resourceArray;
}

function deleteSelectedRepositories() {
  var selectedResources = getSelectedResources(document.getElementById("repoListTree"));
  
  for (var i=0; i<selectedResources.length; i++) {
    deleteRepository(selectedResources[i]);
  }
  
  refreshLanguageList();
}

function toggleReposOnOff(tree, e) {
  var selectedResources = getSelectedResources(document.getElementById("repoListTree"));
  if (!selectedResources.length) return;
  
  var treex = document.getElementById("repoListTree");
  var ss = treex.database.GetDataSources();
  while (ss.hasMoreElements()) {treex.database.RemoveDataSource(ss.getNext());}
  treex.builder.rebuild();
  
  treex = document.getElementById("languageListTree");
  ss = treex.database.GetDataSources();
  while (ss.hasMoreElements()) {treex.database.RemoveDataSource(ss.getNext());}
  treex.builder.rebuild();
  
  treex = document.getElementById("moduleListTree");
  ss = treex.database.GetDataSources();
  while (ss.hasMoreElements()) {treex.database.RemoveDataSource(ss.getNext());}
  treex.builder.rebuild();
  
  window.alert("sdfs");

  for (var i=0; i<selectedResources.length; i++) {
  
    var enabled = RPDS.GetTarget(selectedResources[i], RP.Enabled, true);
    
    var newval = (enabled ? null:"true");
    if (!newval) {
      enabled = enabled.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      newval = (enabled == "true" ? "false":"true");
    }
    
    setResourceAttribute(RPDS, selectedResources[i], "Enabled", newval);
  }
  
  refreshLanguageList();
  
  treex = document.getElementById("repoListTree");
  treex.database.AddDataSource(RPDS);
  treex.builder.rebuild();
  
  treex = document.getElementById("languageListTree");
  treex.database.AddDataSource(MLDS);
  treex.builder.rebuild();
  
  treex = document.getElementById("moduleListTree");
  treex.database.AddDataSource(MLDS);
  treex.builder.rebuild();
}

function changeModuleListLanguage() {
  var tree = document.getElementById("languageListTree");
  
  var selIndex = tree.view.selection.currentIndex;
  
  var lang = "none";
  if (selIndex != -1) {
    var res = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(selIndex);
    res = MLDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
    lang = res.QueryInterface(Components.interfaces.nsIRDFLiteral).Value
  }

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

////////////////////////////////////////////////////////////////////////
// onUnload routines
////////////////////////////////////////////////////////////////////////

function onUnload() {

  // remove all temporary files
  if (TEMP.exists()) TEMP.remove(true);
  
  dbFlush(RPDS);
  dbFlush(MLDS);
  
}
