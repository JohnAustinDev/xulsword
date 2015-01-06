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
// Add Repository Module User Interface Functions
////////////////////////////////////////////////////////////////////////

ARMI = {
  
  installBeforeClosing: true,
  
  deleteSelectedRepositories: function() {
    var selectedResources = ARMU.getSelectedResources(document.getElementById("repoListTree"));
    if (!selectedResources.length) return;
    
    ARMU.clearErrors(RPDS, RDF.GetResource(RP.XulswordRepoListID));
    
    ARMU.treeDataSource([true, true], ["languageListTree", "moduleListTree"]);
    
    ARMU.deleteRepository(selectedResources);
    
    ARMU.buildLanguageList();
    
    ARMU.treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
    
    ARMU.selectLanguage();
  },

  toggleReposOnOff: function() {
    var selectedResources = ARMU.getSelectedResources(document.getElementById("repoListTree"));
    if (!selectedResources.length) return;
    
    ARMU.clearErrors(RPDS, RDF.GetResource(RP.XulswordRepoListID));
    
    // disconnect large trees to speed things up. loadRepositories reconnects them
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
        ARMU.setStatus(RPDS, selectedResources[i], dString(1) + "%", "yellow");
        nowOnRes.push(selectedResources[i]);
      }
      else {
        ARMU.setStatus(RPDS, selectedResources[i], OFF, "red");
      }
    }
    
    ARMU.deleteModuleData(deleteModDataUrl);
    loadRepositories(nowOnRes, true);
  },

  // updates moduleListTree to show certain modules. 
  //		If flag is an ISO language code, modules with that base language will be shown.
  //		If flag is "all" then all modules will be shown.
  //		If flag is "none" then no modules will be shown.
  //		If flag is null, then modules having languageListTree's selected language are 
  //			shown, and if nothing is selected in the languageListTree, no modules are shown.
  updateModuleList: function(flag) {
    if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true") ARMI.toggleModuleBox();
    
    ARMU.treeDataSource([true], ["moduleListTree"]);
    
    var tree = document.getElementById("languageListTree");
    
    if (tree.view && flag == "all") {tree.view.selection.clearSelection();}
    
    if (tree.view && !flag) {
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
    else if (!flag) flag = "none";
    
    flag = flag.replace(/\-.*$/, ""); // match all root language modules
    
    if (flag != "none" && flag != "all") prefs.setCharPref("addRepositoryModuleLang", flag);
    
    ARMU.showModules(flag);
    
    ARMU.treeDataSource([false], ["moduleListTree"]);
  },

  toggleModuleBox: function() {
    var cont = document.getElementById("moduleDialog");
    var showModuleInfo = cont.getAttribute("showModuleInfo");
    showModuleInfo = (showModuleInfo == "false" ? "true":"false");
    
    cont.setAttribute("showModuleInfo", showModuleInfo);
    document.getElementById("moduleDeck").setAttribute("selectedIndex", (showModuleInfo=="true" ? 1:0));
  },

  toggleLanguageList: function() {
    var vbox = document.getElementById("moduleDialog");
    vbox.setAttribute("showLanguageList", (vbox.getAttribute("showLanguageList")=="false" ? "true":"false"));
  },

  initiateModuleDownloads: function(mods) {
    if (!mods) mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
    if (!mods.length) return;
    
    if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true")
        ARMI.toggleModuleBox();
        
    ARMU.clearErrors(MLDS, RDF.GetResource(RP.ModuleListID));
    
    for (var m=0; m<mods.length; m++) {
      ARMU.setStatus(MLDS, mods[m], dString(0) + "%", "yellow");
    }
    
    ProgressBar.hidden = false;
  
    ARMD.ModulesQuerying = ARMD.ModulesQuerying.concat(mods);
    if (!ARMD.QueryCheckInterval) ARMD.QueryCheckInterval = window.setInterval(function () {ARMD.checkAllQueriesAreCompleted();}, 200);
    
    ARMD.queryNextModule();
  },

  installModules: function() {
    if (!XS_window || XS_window.XS_WindowIsClosing) return; // can't install without XS_window!

    XS_window.AddRepositoryModules = ARMU.getInstallableModules();
    
    if (XS_window.AddRepositoryModules.length) {
      XS_window.installModuleArray(XS_window.finishAndHandleReset, XS_window.AddRepositoryModules);
    }

  },

  updateRepoListButtons: function() {
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
      if (Web.length) {
        disabled[0] = true; // toggle
        disabled[1] = true; // add
        disabled[2] = true; // delete
      }
      
      disabled[3] = !this.repoCancel(true);
    }
    
    // apply disabled attribute
    for (var i=0; i<buttons.length; i++) {
      if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
      else document.getElementById(buttons[i]).removeAttribute("disabled");
    }
  },

  updateModuleButtons: function() {
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
    
    disabled[3] = !this.moduleCancel(true);
    
    // apply disabled attribute
    for (var i=0; i<buttons.length; i++) {
      if (disabled[i]) document.getElementById(buttons[i]).setAttribute("disabled", "true");
      else document.getElementById(buttons[i]).removeAttribute("disabled");
    }
  },

  onModuleListTreeSelect: function() {
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
    
    ARMI.updateModuleButtons();
  },

  addRepository: function() {
    
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
  },

  // cancels selected modules if possible, and returns true if anything was
  // canceled. The testOnly bool is used to return the possibility of a
  // cancelation given the selection.
  moduleCancel: function(testOnly, mods) {
    var didCancel = false;
    
    if (!mods) mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
    if (!mods.length) return didCancel;
    
    // add to selection any other XSM members too
    var allmods = [];
    for (var m=0; m<mods.length; m++) {
      allmods = allmods.concat(ARMU.allMembersXSM(mods[m]));
    }
    mods = allmods;
    
    for (var m=0; m<mods.length; m++) {
    
      // is this mod queued for querying?
      var mqi = ARMD.ModulesQuerying.indexOf(mods[m]);
      if (mqi != -1) {
        didCancel = true;
        if (!testOnly) {
          ARMD.ModulesQuerying.splice(mqi, 1);
          ARMU.revertStatus(MLDS, mods[m]);
          jsdump("INFO: Module \"" + ARMU.getResourceLiteral(MLDS, mods[m], "ModuleName") + "\" removed from query queue.");
        }
      }
      
      // is this mod queued for downloading?
      for (var x=0; x<ARMD.ModulesDownloading.length; x++) {
        if (ARMD.ModulesDownloading[x].modResource != mods[m]) continue;
        didCancel = true;
        if (!testOnly) {
          ARMD.ModulesDownloading.splice(x, 1);
          ARMU.revertStatus(MLDS, mods[m]);
          x--;
          jsdump("INFO: Module \"" + ARMU.getResourceLiteral(MLDS, mods[m], "ModuleName") + "\" removed from download queue.");
          
          var downDir = ARMU.getModuleDownloadDirectory(mods[m]);
          if (downDir.exists()) downDir.remove(true);
        }
      }

      // is this mod currently downloading
      var cancel = [];
      for (var i=0; i<Web.length; i++) {
        if (Web[i].type != "moduleListing" && Web[i].type != "moduleFile") continue;	
        if (Web[i].group == mods[m].ValueUTF8) {
          didCancel = true;
          if (!testOnly) {
            cancel.push(Web[i].persist);
            jsdump("INFO: Module \"" + uneval(Web[i]) + "\" download cancelled.");
          }
        }
      }
      for (var p=0; p<cancel.length; p++) {cancel[p].cancelSave();}
      
    }
    
    if (didCancel && !testOnly) USE_CACHE = false;
    
    return didCancel;
  },

  // cancels selected repos if possible, and returns true if anything was
  // canceled. The testOnly bool is used to return the possibility of a
  // cancelation given the selection.
  repoCancel: function(testOnly, repos) {
    var didCancel = false;
    
    if (!repos) repos = ARMU.getSelectedResources(document.getElementById("repoListTree"), true);
    if (!repos.length) return didCancel;
    
    for (var r=0; r<repos.length; r++) {
    
      // is this repo queued for loading?
      for (var x=0; x<RepositoryArray.length; x++) {
        if (RepositoryArray[x] != ARMU.getResourceLiteral(RPDS, repos[r], "Url")) continue;
        didCancel = true;
        if (!testOnly) {
          RepositoryArray.splice(x, 1);
          ARMU.setStatus(RPDS, repos[r], dString(0) + "%", "");
          x--;
        }
      }

      // is this repo manifest currently downloading?
      var cancel = [];
      for (var i=0; i<Web.length; i++) {
        if (Web[i].type != "masterRepoList" && Web[i].type != "manifest") continue;
        if (Web[i].url.indexOf(ARMU.getResourceLiteral(RPDS, repos[r], "Url")) == 0) {
          didCancel = true;
          if (!testOnly) cancel.push(Web[i].persist);
        }
      }
      for (var p=0; p<cancel.length; p++) {cancel[p].cancelSave();}
      
    }
    
    return didCancel;
  },


////////////////////////////////////////////////////////////////////////
// Module Info routines
////////////////////////////////////////////////////////////////////////

  // Taken from dialogs/about.html
  writeModuleInfos: function() {
    var mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
    if (!mods.length) return;
    
    var body = document.getElementById("infoBox").contentDocument.getElementsByTagName("body")[0];
    body.style.background = "white";
    while (body.firstChild) {body.removeChild(body.firstChild);}
    
    var fdoc = body.ownerDocument;
    
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
      
        var detail = body.appendChild(fdoc.createElement("div"));
        detail.className = "module-detail cs-" + DEFAULTLOCALE;
        
        // Heading and version
        var vers = ARMU.getResourceLiteral(MLDS, aModRes, "Version");
        var modAbbr = ARMU.getResourceLiteral(MLDS, aModRes, "Abbreviation");
        if (!modAbbr || modAbbr == "?") modAbbr = modName; 
        var span = detail.appendChild(fdoc.createElement("span"));
        span.className = "mod-detail-heading";
        span.textContent = modAbbr + (vers != "?" ? "(" + vers + ")":"");
        
        // Descripton
        var description = ARMU.getResourceLiteral(MLDS, aModRes, "Description");
        if (description) {
          var div = detail.appendChild(fdoc.createElement("div"));
          div.className = "description";
          div.textContent = description;
        }

        // Copyright
        var copyright = ARMU.getResourceLiteral(MLDS, aModRes, "DistributionLicense");
        if (copyright) {
          var div = detail.appendChild(fdoc.createElement("div"));
          div.className = "copyright";
          div.textContent = copyright;
        }
             
        // About
        var about = ARMU.getResourceLiteral(MLDS, aModRes, "About");
        if (about == description || about == NOTFOUND) about = "";
        if (about) {
          var div = detail.appendChild(fdoc.createElement("div"));
          div.className = "about";
          RTF2DOM(about, div);
        }
                      
        // Conf contents
        var confFile = ARMU.getResourceLiteral(MLDS, aModRes, "ConfFileName");

        if (confFile) {
          var div = body.appendChild(fdoc.createElement("div"));
          div.className = "conf-info";
          div.id = "conf." + modName;
          div.setAttribute("showInfo", "false");
          div.setAttribute("readonly", "readonly");
          
          var a = div.appendChild(fdoc.createElement("a"));
          a.className = "link";
          a.setAttribute("href", "javascript:frameElement.ownerDocument.defaultView.ARMI.toggleInfo('" + modName + "', '" + ARMU.getResourceLiteral(MLDS, aModRes, "Url") + "', '" + confFile + "');");
          var span = a.appendChild(fdoc.createElement("span"));
          span.className = "more-label";
          span.textContent = getDataUI("more.label");
          var span = a.appendChild(fdoc.createElement("span"));
          span.className = "less-label";
          span.textContent = getDataUI("less.label");
          
          var textarea = div.appendChild(fdoc.createElement("textarea"));
          textarea.className = "cs-" + DEFAULTLOCALE;
          textarea.id = "conftext." + modName;
          textarea.setAttribute("readonly", "readonly");
        }
      }
      
    }

  },

  toggleInfo: function(mod, url, conf) {
    var fdoc = document.getElementById("infoBox").contentDocument;
    var elem = fdoc.getElementById("conf." + mod);
    var textarea = elem.getElementsByTagName("textarea")[0]; 
    var showInfo = elem.getAttribute("showInfo");
   
    if (showInfo == "false") {
      var confInfo = "-----";
      var confFile;
      if ((/^file\:\/\//i).test(url)) {
        confFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        try {confFile.initWithPath(lpath(url.replace(/^file\:\/\//, "")));}
        catch (er) {jsdump("ERROR: " + er); confFile = null;}
      }
      else confFile = ARMU.getRepositoryUrlTempDir(url);
      if (confFile) {
        confFile.append("mods.d");
        confFile.append(conf);
      }
      if (!confFile || !confFile.exists()) {
        jsdump("ERROR: Missing .conf file \"" + (confFile ? confFile.path:lpath(url.replace(/^file\:\/\//, ""))) + "\"");
      }
      else {confInfo  = readFile(confFile);}

      textarea.value = confInfo;
    }

    elem.setAttribute("showInfo", (showInfo == "true" ? "false":"true"));

    if (elem.getAttribute("showInfo") == "true") 
        textarea.style.height = Number(textarea.scrollHeight + 10) + "px";

  }

}
