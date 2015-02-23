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
// // Add Repository Module Utility Functions
////////////////////////////////////////////////////////////////////////

ARMU = {

  getRepositoryUrlTempDir: function(url) {
    var file = TEMP.clone();
    file.append(url.replace(/^[^\:]+:\/\//, "").replace(/[\\\/]/g, "_"));

    return file;
  },

  // gets, but does not create, the module listing directory of a module
  getModuleListingDirectory: function(modResource) {
    var dest = TEMP.clone();
    dest.append("listings");
    if (!dest.exists()) dest.create(dest.DIRECTORY_TYPE, DPERM);
    
    dest.append(ARMU.getModuleInstallerZipFile(modResource).leafName.replace(/\.(zip|xsm)$/, ""));
    
    return dest;
  },

  // gets, but does not create, the module download directory of a module
  getModuleDownloadDirectory: function(modResource) {
    var dest = TEMP.clone();
    dest.append("downloads");
    if (!dest.exists()) dest.create(dest.DIRECTORY_TYPE, DPERM);

    dest.append(ARMU.getModuleInstallerZipFile(modResource).leafName.replace(/\.(zip|xsm)$/, ""));
    
    return dest;
  },

  // return the final nsILocalFile this module resource will download into
  getModuleInstallerZipFile: function(modResource) {
    var installZipFile = TEMP_Install.clone();
    
    if (ARMU.is_XSM_module(MLDS, modResource)) {
      // get leafName of ModuleUrl
      var zipFileName = ARMU.getResourceLiteral(MLDS, modResource, "ModuleUrl").replace(/^.*?([^\/]+)$/, "$1");
      if (!(/\.(zip|xsm)$/).test(zipFileName)) zipFileName += ".xsm";
      zipFileName = zipFileName.replace(/[\&=]+/g, "");
      installZipFile.append(zipFileName);
    }
    else {
      installZipFile.append(ARMU.getResourceLiteral(MLDS, modResource, "ModuleName") + "_" + ARMU.getResourceLiteral(MLDS, modResource, "Version") + ".zip");
    }
    
    return installZipFile
  },

  // Set a resource's attribute (a string) to value (also a string)
  setResourceAttribute: function(aDS, resource, attribute, value, type) {
    attribute = RDF.GetResource(RP.REPOSITORY + attribute);
    var aNewValue = null;
    if (value !== null) {
      if (type && type == "int") aNewValue = RDF.GetIntLiteral(value);
      else if (type && type == "date") aNewValue = RDF.GetDateLiteral(value);
      else aNewValue = RDF.GetLiteral(value);
    }
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
  },

  // Get the value of a resources attribute
  getResourceLiteral: function(aDS, resource, attribute) {
    
    attribute = RDF.GetResource(RP.REPOSITORY + attribute);
    
    var val = aDS.GetTarget(resource, attribute, true);
    if (!val) return null;
    
    try { 
      var type = val.QueryInterface(Components.interfaces.nsIRDFDate);
      if (type) return type.Value;
    } catch (er) {}
    
    try {
      type = val.QueryInterface(Components.interfaces.nsIRDFInt);
      if (type) return type.Value;
    } catch (er) {}
    
    try {
      type = val.QueryInterface(Components.interfaces.nsIRDFLiteral);
      if (type) return type.Value;
    } catch (er) {}
    
    return null;
  },

  // Returns true if repository is already in the database, false otherwise
  existsRepository: function(repoInfo) {
    
    var ress = RPDS.GetAllResources();
    
    NextResource:
    while(ress.hasMoreElements()) {
      var res = ress.getNext();
      
      // if these resource attributes match repoInfo, this repo already exists
      var check = ["ResourceType", "Site", "Path", "Url"];
       
      for (var i=0; i<check.length; i++) {
        var val = RPDS.GetTarget(res, RDF.GetResource(RP.REPOSITORY+check[i]), true);
        if (!val) continue NextResource;
        val = val.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        if (val != repoInfo[check[i]]) continue NextResource;
      }
      
      return true;
    }
    
    return false;
  },

  // Add a repository to the database. If such a repository happens to 
  // exist already, then a duplicate one will be created and added.
  createRepository: function(newRepoInfo, resourceID) {
    
    // create a new resource
    var res = (resourceID ? RDF.GetResource(resourceID):RDF.GetAnonymousResource());
    for (var p in newRepoInfo) {
      RPDS.Assert(res, RDF.GetResource(RP.REPOSITORY+p), RDF.GetLiteral(replaceASCIIcontrolChars(newRepoInfo[p])), true);
    }
    
    // add the new resource to our database's xulswordRepo list
    var list = RDF.GetResource(RP.XulswordRepoListID);
    RDFC.Init(RPDS, list);
    RDFC.AppendElement(res);

    return res;
  },

  // Remove a repository resource entirely from the database. This does
  // no Type checking to ensure repoResouce is actually a repository.
  deleteRepository: function(repoResourceArray) {

    // collect url info before beginning to delete (to filter modules with)
    var urls = [];
    for (var i=0; i<repoResourceArray.length; i++) {
      urls.push(RPDS.GetTarget(repoResourceArray[i], RDF.GetResource(RP.REPOSITORY+"Url"), true));
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

    ARMU.deleteModuleData(urls);
  },

  // Delete all modules contained within a list of repository Urls 
  deleteModuleData: function(repoUrlArray) {

    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    var mods = RDFC.GetElements();
    while (mods.hasMoreElements()) {
      var mod = mods.getNext();
      
      var url = MLDS.GetTarget(mod, RDF.GetResource(RP.REPOSITORY+"Url"), true);
      for (var i=0; i<repoUrlArray.length; i++) {if (url == repoUrlArray[i]) break;}
      if (i == repoUrlArray.length) continue;
      
      // remove mod from ModuleList
      RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
      RDFC.RemoveElement(mod, (mods.hasMoreElements() ? false:true));
      
      ARMU.deleteResource(mod);
    }
  },
  
  deleteResource: function(res) {
    var arcsOut = MLDS.ArcLabelsOut(res);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = MLDS.GetTargets(res, thisarc, true);
      while (targs.hasMoreElements()) {
        MLDS.Unassert(res, thisarc, targs.getNext());
      }
    }
  },

  // Populate the language tree based on all modules within enabled repositories
  buildLanguageList: function() {

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
      if (RPDS.GetTarget(repo, RDF.GetResource(RP.REPOSITORY+"Enabled"), true) == RP.False) continue;
      urls.push(ARMU.getResourceLiteral(RPDS, repo, "Url"));
    }
   
    // add a resource for each language in the enabled repository database, 
    // with NO DUPLICATES
    var langs = [];
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    var mods = RDFC.GetElements();
    NextResource:
    while (mods.hasMoreElements()) {
      var mod = mods.getNext();
      
      var url = ARMU.getResourceLiteral(MLDS, mod, "Url");
    
      // if url is not on enabled repo list then don't include this mod
      for (var i=0; i<urls.length; i++) {if (urls[i] == url) break;}
      if (i == urls.length) continue;
      
      var lang = MLDS.GetTarget(mod, RDF.GetResource(RP.REPOSITORY + "Lang"), true);
      lang = lang.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      var rlang = ARMU.getLangReadable(lang);
      
      for (var i=0; i<langs.length; i++) {
        if (langs[i].rlang == rlang) continue NextResource;
      }
      
      langs.push( { lang:lang, rlang:rlang } );
    }
  
    RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
    for (var i=0; i<langs.length; i++) {
      var newLangRes = RDF.GetAnonymousResource();
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "ResourceType"), RP.LanguageListType, true);
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Lang"), RDF.GetLiteral(langs[i].lang), true);
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral(langs[i].rlang), true);
      RDFC.AppendElement(newLangRes);
    }
    
  },
  
  // reads a module resource's ModDrv attribute and returns a readable type string
  // or null if ModDrv could not be found.
  getTypeReadable: function(modDS, modResource) {
    var modDrv = ARMU.getResourceLiteral(modDS, modResource, "ModDrv");

    if (!modDrv || modDrv == NOTFOUND) return null;
    
    var moduleType;
    if ((/^(RawText|zText)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.Texts");
    else if ((/^(RawCom|RawCom4|zCom)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.Comms");
    else if ((/^(RawLD|RawLD4|zLD)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.Dicts");
    else if ((/^(RawGenBook)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.Genbks");
    else if ((/^(RawFiles)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.SimpleText");
    else if ((/^(HREFCom)$/i).test(modDrv)) moduleType = "URL"; 
    else if ((/^(audio)$/i).test(modDrv)) moduleType = MyStrings.GetStringFromName("arm.moduleType.Audio");
    
    moduleType = moduleType.replace(/\:$/, ""); // previous UI option had ":" at the end...
    
    if (ARMU.is_XSM_module(modDS, modResource) && moduleType != "Audio") moduleType += " XSM";
    
    return moduleType;
  },

  // returns a readable translation of an ISO language code. 
  //		translates code.en if UI is English and such a translation exists
  //		otherwise translates code if such a translation exists
  //		otherwise returns original ISO code
  getLangReadable: function(lang) {
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
  },

  // select a particular language in the languageListTree. This
  // triggers ARMI.updateModuleList() due to onselect.
  selectLanguage: function(language) {
    var tree = document.getElementById("languageListTree");
    
    var defRes = null;
    
    // try selecting language
    if (language) {
      RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
      var defRes = null;
      var langs = RDFC.GetElements();
      while (langs.hasMoreElements()) {
        var lang = langs.getNext();
        var lcode = ARMU.getResourceLiteral(MLDS, lang, "Lang");
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
      var progLang = getPrefOrCreate("addRepositoryModuleLang", "Char", getLocale());
      if (!progLang) progLang = DEFAULTLOCALE;
      
      RDFC.Init(MLDS, RDF.GetResource(RP.LanguageListID));
      var langs = RDFC.GetElements();
      while (langs.hasMoreElements()) {
        var lang = langs.getNext();
        var lcode = ARMU.getResourceLiteral(MLDS, lang, "Lang");
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
    if (defRes && tree) {
      index = tree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getIndexOfResource(defRes);
      if (!index || index < 0) index = 0;
    }
    
    if (tree && tree.view && tree.boxObject) {
      tree.view.selection.select(index);
      tree.boxObject.ensureRowIsVisible(index);
    }
  },
  
  // adjusts the Show attribute of each module. The moduleListTree filters
  // its displayed modules based on this Show attribute.
  showModules: function(lang) {
    // setting the rule's REPOSITORY:Lang attribute filters okay, but once it's  
    // removed (to show all) the tree is never rebuilt if it is re-added. Besides,
    // filtering is also being done on other bases as well now.
    
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    var mods = RDFC.GetElements();
    
    var xsm = {};
    var sword = {};
    while (mods.hasMoreElements()) {
      
      var mod = mods.getNext();
      var mlang = ARMU.getResourceLiteral(MLDS, mod, "Lang").replace(/\-.*$/, "");
      var is_XSM_module = ARMU.is_XSM_module(MLDS, mod);
      
      var show = (lang != "none" && (lang == mlang || lang == "all"));
      
      // dictionary modules are sometimes duplicated within various XSM modules, 
      // leading to strange (to the user) multiple listings and so here we
      // hide any dictionary(s) within XSM modules, unless the XSM is considered 
      // a "compilation" or unless the XSM is partially installed.
      if (show && is_XSM_module) {
        var isCompilation = ARMU.getResourceLiteral(MLDS, mod, "SwordModules").split(";").length > 3;
        if (!isCompilation) {
          var isDictRE = new RegExp(escapeRE(MyStrings.GetStringFromName("arm.moduleType.Dicts")));
          if ((isDictRE).test(ARMU.getResourceLiteral(MLDS, mod, "TypeReadable"))) {
            var isPartialInstall = false;
            var allxsm = ARMU.allMembersXSM(mod);
            for (var i=1; i<allxsm.length; i++) {
              isPartialInstall |= (ARMU.getResourceLiteral(MLDS, allxsm[0], "Installed") != ARMU.getResourceLiteral(MLDS, allxsm[i], "Installed"));
            }
            if (!isPartialInstall) show = false;
          }
        }
      }
      
      ARMU.setResourceAttribute(MLDS, mod, "Show", (show ? "true":"false"));
      
      // if showing, then save unique keys representing this module, as either 
      // an XSM or SWORD module, for use after the main loop to hide SWORD
      // modules which also exist within an XSM module.
      if (show) {
        if (is_XSM_module) {
          mname = ARMU.getResourceLiteral(MLDS, mod, "SwordModules").split(";");
          mvers = ARMU.getResourceLiteral(MLDS, mod, "SwordVersions").split(";");
          for (var i=0; i<mname.length; i++) {
            try {
              var key = mname[i] + mvers[i];
              key = key.replace(/\./g, "_");
              if (!xsm[key]) xsm[key] = [mod];
              else xsm[key].push(mod);
            }
            catch (er) {}
          }
        }
        else {
          var mname = ARMU.getResourceLiteral(MLDS, mod, "ModuleName");
          var mvers = ARMU.getResourceLiteral(MLDS, mod, "Version");
          try {
            key = mname + mvers;
            key = key.replace(/\./g, "_");
            if (!sword[key]) sword[key] = [mod];
            else sword[key].push(mod);
          }
          catch (er) {}
        }
      }
    
    } // ModuleListID loop
    
    // if an XSM module is showing, hide the separate SWORD modules
    // which are contained within it, unless they need updating.
    for (key in xsm) {
      for (var m=0; sword[key] && m<sword[key].length; m++) {
        if (ARMU.getResourceLiteral(MLDS, sword[key][m], "ModuleUpdateNeeded") == "true") continue;
        ARMU.setResourceAttribute(MLDS, sword[key][m], "Show", "false");
      }
    }
    
  },

  // Connect and disconnect tree data sources
  treeDataSource: function(disconnectArray, idArray) {

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
  },

  getConfEntry: function(filedata, param) {
    if (param == "ModuleName") {
      var prm = new RegExp("\\[(.*)\\]", "m");
      var retval = filedata.match(prm);
      if (retval) retval = retval[1];
    }
    else {
      var cont = new RegExp(/\\[\r\n]/m); // continuation character is "\"
      while(cont.test(filedata)) {filedata = filedata.replace(cont, " ");}
      prm = new RegExp("^\\s*" + escapeRE(param) + "\\s*=\\s*(.*?)\\s*?[\\r\\n]", "im");
      retval = filedata.match(prm);
      if (retval) retval = retval[1];
    }
    
    return retval;
  },

  getSelectedResources: function(tree, noDuplicateXSMs) {
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
        var is_XSM_module = ARMU.is_XSM_module(MLDS, res);
        selInfo.push( 
          { resource:res, 
            isXSM:is_XSM_module, 
            xsmUrl:(is_XSM_module ? ARMU.getResourceLiteral(MLDS, res, "ModuleUrl"):"")
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
  },
          
  dbFlush: function(aDS) {
    // make it permanent
    aDS = aDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    aDS.Flush();
  },
  
  // each web download is controlled by a nsIWebBrowserPersist object
  maxConnections:0,
  webAdd: function(aWebBrowserPersist, aType, aGroup, url) {
    Web.push( { persist:aWebBrowserPersist, type:aType, group:aGroup, url:url } );
    
    if (Web.length == MAX_CONNECTIONS) SYNC = true;
    
    if (Web.length > this.maxConnections) this.maxConnections = Web.length;
//jsdump("webAdd " + aType + " from " + url + "\n\n" + "Active connections = " + Web.length + "\nMax connections = " + this.maxConnections);

    ARMI.updateRepoListButtons();
    ARMI.updateModuleButtons();
  },
  
  // each web download is controlled by a nsIWebBrowserPersist object
  webRemove: function(aWebBrowserPersist) {
    for (var i=0; i<Web.length; i++) {
      if (aWebBrowserPersist == Web[i].persist) {
        var x = Web.splice(i,1);
        i--;
      }
    }
    
    if (Web.length < MAX_CONNECTIONS) SYNC = false;
    
//jsdump("webRemove " + (x[0].type ? x[0].type:"null") + " from " + (x[0].url ? x[0].url:"null") + "\n\n" + "Active connections = " + Web.length);
    ARMI.updateRepoListButtons();
    ARMI.updateModuleButtons();
  },

  // search the install TEMP directory for modules which can be installed
  getInstallableModules: function() {
    var installDir = TEMP_Install.clone();
    var files = installDir.directoryEntries;
    var installableModules = [];
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (file.isDirectory() || !(/\.(zip|xsm)$/).test(file.leafName)) continue;
      installableModules.push(file);
    }
    return installableModules;
  },
  
  // add a best guess protocol to URL's which are missing protocol
  guessProtocol: function(site, path) {
    if (path == ".") path = "";
    
    var url = site + path;
    if ((/^ftp/i).test(url)) url = "ftp://" + url;
    else if (!(/^[^\:]+\:\/\//).test(url)) url = "http://" + url;
    
    return url;
  },
  
  // clear any error messages from a particular set of resources
  clearErrors: function(aDS, aContainer) {
    var er = RDF.GetResource(RP.REPOSITORY+"ErrorMsg");
    
    RDFC.Init(aDS, aContainer);
    var ress = RDFC.GetElements();
    while (ress.hasMoreElements()) {
      var aRes = ress.getNext();
      var errorMsg = aDS.GetTargets(aRes, er, true);
      if (errorMsg.hasMoreElements()) {
        while (errorMsg.hasMoreElements()) aDS.Unassert(aRes, er, errorMsg.getNext());
      }
    }
  },
  
  notError: new RegExp("^\\s*(" + escapeRE(ON) + "|" + escapeRE(OFF) + "|.*\\%)\\s*$"),
  
  // apply status to aRes but DON'T overwrite any existing error message until errors are cleared
  setStatus: function(aDS, aRes, status, style) {
    
    // don't overwrite any existing error message, unless it was generic.
    var hasError = ARMU.getResourceLiteral(aDS, aRes, "ErrorMsg");
    if (hasError && hasError != ERROR) return;

    // handle any new error messages
    if (!this.notError.test(status)) {
      // all error messages should begin with ERROR
      if (status.indexOf(ERROR) != 0) status = ERROR + ": " + status;
      ARMU.setResourceAttribute(aDS, aRes, "ErrorMsg", status);
      style = "red";
    }
    
    var statusArray = [aRes];
    if (aDS == MLDS) statusArray = this.allMembersXSM(aRes);
    
    for (var i=0; i<statusArray.length; i++) {
      var pausei = (StatusUpdateMods.pause ? StatusUpdateMods.mods.indexOf(aRes):-1);
      if (pausei == -1) {
        ARMU.setResourceAttribute(aDS, statusArray[i], "Status", status);
        ARMU.setResourceAttribute(aDS, statusArray[i], "Style", style);
      }
      else {
        StatusUpdateMods.status[pausei] = status;
        StatusUpdateMods.style[pausei] = style;
      }
    }
    
  },
  
  // returns an array of all module resources which share the same XSM
  // module or else an array of 1 for a non-XSM resources.
  membersXSM: null, // cache these or suffer a big speed hit
  allMembersXSM: function(modResource) {
    
    if (!ARMU.is_XSM_module(MLDS, modResource)) return [modResource];
    
    var myKey = ARMU.getResourceLiteral(MLDS, modResource, "ModuleUrl");
    
    // mykey members could have been invalidated by a repository reload etc.
    // so check for this too.
    if (!this.membersXSM || !this.membersXSM.hasOwnProperty(myKey) || 
        !MLDS.ArcLabelsIn(this.membersXSM[myKey][0]).hasMoreElements()) { 
      this.membersXSM = {};
      RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
      var elems = RDFC.GetElements();
      while (elems.hasMoreElements()) {
        var elem = elems.getNext();
        var key = ARMU.getResourceLiteral(MLDS, elem, "ModuleUrl");
        if (!this.membersXSM.hasOwnProperty(key)) this.membersXSM[key] = [];
        this.membersXSM[key].push(elem);
      }
    }

    return this.membersXSM[myKey];
  },
  
  revertStatus: function(aDS, aRes) {
    if (aDS != MLDS) return;
    
    if (ARMU.getModuleInstallerZipFile(aRes).exists())
        ARMU.setStatus(MLDS, aRes, ON, "green");
    else {
      var isInstalled = ARMU.getResourceLiteral(MLDS, aRes, "Installed");
      ARMU.setStatus(MLDS, aRes, (isInstalled && isInstalled == "true" ? ON:dString(0) + "%"), "");
    }
  },
  
  is_XSM_module: function(modDS, modResource) {
    var moduleUrl = ARMU.getResourceLiteral(modDS, modResource, "ModuleUrl");
    return ((/\.(zip|xsm)$/).test(moduleUrl) || (/\/audio\.htm(\?|$)/).test(moduleUrl));
  },
  
  // compare two SWORD version numbers. 
  //   if a < b return -1 
  //   if a > b return 1
  //   if a == b return 0
  // If the difference is only a conf update it sets updateOnlyConf to true.
  compareSwordVersions: function(a, b) {
    var ret = {result:-1, updateOnlyConf:false};

    if (a == b) {ret.result = 0; return ret;}

    // SWORD module versions are composed of three "." separated parts.
    // If an update involves only the .conf file, only the third part
    // is incremented.
    a = a.split(".");
    b = b.split(".");
    if (!isNaN(Number(a[0]))) {
      if (a[0] == b[0]) {
        if (a.length > 1 && a[1]!==null && !isNaN(Number(a[1]))) {
          if (b.length < 2 || b[1]===null || isNaN(Number(b[1]))) {
            b[1] = 0;
          }
          if (Number(a[1]) > Number(b[1])) ret.result = 1;
          else if (Number(a[1]) == Number(b[1]) && (a.length == 3 && a[2] !== null && !isNaN(Number(a[2])))) {
            if (b.length < 3 || b[2]===null || isNaN(Number(b[2])) || Number(a[2]) > Number(b[2])) {
              ret.result = 1;
              ret.updateOnlyConf = true;
            }
          }
        }
      }
      else if (b[0]===null || isNaN(Number(b[0])) || Number(a[0]) > Number(b[0])) {
        ret.result = 1;
      }
    }

    return ret;
  },
  
  // checks modules to see if an update is needed. It checks EITHER XSM
  // OR REGULAR MODULES, depending on doXSM flag. Modules which need to
  // be upgraded will be included in the mods array. If multiple versions 
  // of a module exist, only the highest version will be included in the 
  // mods array. If two updateable modules have the same module name and 
  // version, only the first to appear on the list will be included.
  getUpdateMods: function(mods, doXSM) {
    RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
    var iter = RDFC.GetElements();
    while(iter.hasMoreElements()) {
      var mod = iter.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
      var meXSM = ARMU.is_XSM_module(MLDS, mod);
      if (doXSM && !meXSM || !doXSM && meXSM) continue;
      if (ARMU.getResourceLiteral(MLDS, mod, "ModuleUpdateNeeded") == "true") {
        var skipMe = false;
        for (var i=0; i<mods.length; i++) {
          if (ARMU.getResourceLiteral(MLDS, mod, "ModuleName") != ARMU.getResourceLiteral(MLDS, mods[i], "ModuleName")) continue;
          if (ARMU.compareSwordVersions(ARMU.getResourceLiteral(MLDS, mod, "Version"), ARMU.getResourceLiteral(MLDS, mods[i], "Version")).result < 1) {
            skipMe = true;
          }
          break;
        }
        if (!skipMe) {
          if (i == mods.length) mods.push(mod);
          else mods[i] = mod;
        }
      }
    }
  }

};
