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
// Mouse and Selection functions
////////////////////////////////////////////////////////////////////////

ARMI = {
	
	deleteSelectedRepositories: function() {
		var selectedResources = ARMU.getSelectedResources(document.getElementById("repoListTree"));
		if (!selectedResources.length) return;
		
		ARMU.treeDataSource([true, true], ["languageListTree", "moduleListTree"]);
		
		ARMU.deleteRepository(selectedResources);
		
		ARMU.buildLanguageList();
		
		ARMU.treeDataSource([false, false], ["languageListTree", "moduleListTree"]);
		
		ARMU.selectLanguage();
	},

	toggleReposOnOff: function() {
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

	initiateModuleDownloads: function() {
		var mods = ARMU.getSelectedResources(document.getElementById("moduleListTree"), true);
		if (!mods.length) return;
		
		if (document.getElementById("moduleDialog").getAttribute("showModuleInfo") == "true")
				ARMI.toggleModuleBox();
		
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
			
			// and don't download something that has already been succesfully downloaded either!
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
	},

	installModules: function() {

		MainWindow.AddRepositoryModules = ARMU.getInstallableModules();
		
		MainWindow.installModuleArray(MainWindow.finishAndHandleReset, MainWindow.AddRepositoryModules);
		
		window.close();
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
		
		disabled[3] = (ModulesInProgress.length ? false:true);
		
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

	moduleCancel: function() {
		for (var i=0; i<ModulesInProgress.length; i++) {
			ModulesInProgress[i].cancelSave();
		}
	},

	repoCancel: function() {
		for (var i=0; i<ReposInProgress.length; i++) {
			ReposInProgress[i].cancelSave();
		}
	},


////////////////////////////////////////////////////////////////////////
// Module Info routines
////////////////////////////////////////////////////////////////////////

	// Taken from dialogs/about.html
	writeModuleInfos: function() {
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
					html +=     ".ARMI.toggleInfo('" + modName + "', '" + ARMU.getResourceLiteral(MLDS, aModRes, "Url") + "', '" + confFile + "');\">";
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
	},

	toggleInfo: function(mod, url, conf) {
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

}
