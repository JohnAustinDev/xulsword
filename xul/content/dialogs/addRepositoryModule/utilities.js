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
// addRepositoryModule Utility functions
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

    var is_XSM_module = (MLDS.GetTarget(modResource, RP.Type, true) == RP.XSM_ModuleType);
    
    if (is_XSM_module) {
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
  },

  // Add a repository to the database. If such a repository happens to 
  // exist already, then a duplicate one will be created and added.
  createRepository: function(newRepoInfo, resourceID) {
    
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
  },

  // Remove a repository resource entirely from the database. This does
  // no Type checking to ensure repoResouce is actually a repository.
  deleteRepository: function(repoResourceArray) {

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

    ARMU.deleteModuleData(urls);
  },

  // Delete all modules associated with a list of repository Urls 
  deleteModuleData: function(repoUrlArray) {

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

  // Populate the language tree's data from enabled repository modules
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
      if (RPDS.GetTarget(repo, RP.Enabled, true) == RP.False) continue;
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
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Type"), RP.LanguageListType, true);
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "Lang"), RDF.GetLiteral(langs[i].lang), true);
      MLDS.Assert(newLangRes, RDF.GetResource(RP.REPOSITORY + "LangReadable"), RDF.GetLiteral(langs[i].rlang), true);
      RDFC.AppendElement(newLangRes);
    }
    
  },

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
      tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(index);
    }
  },
  
  // adjusts the Show attribute of each module. The moduleListTree filters
  // its displayed modules based on the Show attribute.
  showModules: function(lang) {
		// setting the rule's REPOSITORY:Lang attribute filters okay, but once it's  
		// removed (to show all) the tree is never rebuilt if it is re-added. Besides
		// filtering is also being done on other bases now as well.
		
		RDFC.Init(MLDS, RDF.GetResource(RP.ModuleListID));
		var mods = RDFC.GetElements();
		
		var xsm = {};
		var sword = {};
		while (mods.hasMoreElements()) {
			
			var mod = mods.getNext();
			var mlang = ARMU.getResourceLiteral(MLDS, mod, "Lang").replace(/\-.*$/, "");
			var is_XSM_module = (MLDS.GetTarget(mod, RP.Type, true) == RP.XSM_ModuleType);
			
			var show = (lang != "none" && (lang == mlang || lang == "all"));
			
			// dictionary modules are sometimes duplicated within various XSM modules, 
			// leading to strange (to the user) multiple listings and so here we
			// hide any dictionary(s) within XSM modules, unless the XSM is considered 
			// a "compilation"
			if (show && is_XSM_module) {
				var isCompilation = ARMU.getResourceLiteral(MLDS, mod, "SwordModules").split(";").length > 3;
				var isDictRE = new RegExp(escapeRE(MyStrings.GetStringFromName("arm.moduleType.Dicts")));
				if (!isCompilation && (isDictRE).test(ARMU.getResourceLiteral(MLDS, mod, "ModuleType"))) {
					show = false;
				}
			}
			
			ARMU.setResourceAttribute(MLDS, mod, "Show", (show ? "true":"false"));
			
			// if showing, then save unique keys representing each module, as either 
			// XSM or SWORD modules, for use after the main loop.
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
		
		// if a .xsm module is showing, hide the SWORD modules
		// which are contained within it.
		for (key in xsm) {
			for (var m=0; sword[key] && m<sword[key].length; m++) {
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
      prm = new RegExp("\\s*" + escapeRE(param) + "\\s*=\\s*(.*?)\\s*?[\\r\\n]", "im");
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
        var is_XSM_module = (MLDS.GetTarget(res, RP.Type, true) == RP.XSM_ModuleType);
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

	// each file download is controlled by a progress object
  modulesInProgressAdd: function(progress) {
    ModulesInProgress.push(progress);
    updateRepoListButtons();
    updateModuleButtons();
  },
  
  // each file download is controlled by a progress object
  modulesInProgressRemove: function(progress) {
    for (var i=0; i<ModulesInProgress.length; i++) {
      if (progress == ModulesInProgress[i]) {
        ModulesInProgress.splice(i,1);
        i--;
      }
    }
    updateRepoListButtons();
    updateModuleButtons();
  },
  
	// each file download is controlled by a progress object
  reposInProgressAdd: function(progress) {
    ReposInProgress.push(progress);
    updateRepoListButtons();
    updateModuleButtons();
  },
  
  // each file download is controlled by a progress object
  reposInProgressRemove: function(progress) {
    for (var i=0; i<ReposInProgress.length; i++) {
      if (progress == ReposInProgress[i]) {
        ReposInProgress.splice(i,1);
        i--;
      }
    }
    updateRepoListButtons();
    updateModuleButtons();
  },

  // Search the install TEMP directory for modules which can be installed
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
  
  guessProtocol: function(url) {
    if ((/^ftp/i).test(url)) url = "ftp://" + url;
    else if (!(/^[^\:]+\:\/\//).test(url)) url = "http://" + url;
    
    return url;
  },
  
  // try to apply new status to aRes but DON'T overwrite any existing status message
  retainStatusMessage: function(aDS, aRes, status) {
    var existingStatus = ARMU.getResourceLiteral(aDS, aRes, "Status");
    if (!existingStatus || existingStatus.length < 16) existingStatus = null;
    
    ARMU.setResourceAttribute(aDS, aRes, "Status", (existingStatus ? existingStatus:status));
  }

};
