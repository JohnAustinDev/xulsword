/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

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


/************************************************************************
 * XULSWORD INITIALIZATION
 ***********************************************************************/
var NewModuleInfo;
var AddRepositoryModules;
var DictKeyLists = {}; // save dictionary key lists
var DictKeyHTMLs = {}; // save dictionary key HTML
var Popup = null; // global to hold any Popup during Popup->toWindow

function loadedXUL() {
  //start_venkman();

  initCSS();
  
  document.getElementById("topbox").setAttribute("libSwordLoadFailed", LibSword.loadFailed ? "true":"false");
  document.getElementById("topbox").setAttribute("hasBible", LibSword.hasBible ? "true":"false");
  
  document.title = fixWindowTitle(XSBundle.getString("Title"));
  window.name = "xulsword-window";
  
  //To make the program window draw cleaner and faster, size initialization 
  //routines use prefs to size the frames since window size is not available during 
  //initialization. However, the first time the program is run, there are no size prefs 
  //as yet. The solution in this case is to init everything using a timeout so that 
  //window size is then available and can be stored into the size prefs before the frames 
  //are initialized.
  try {prefs.getIntPref("ViewPortHeight");}
  catch (er) {
    document.getElementById('main-viewport').style.visibility = 'hidden';
    window.setTimeout(
    "\
      loadedXUL2(); \
      document.getElementById('main-viewport').style.visibility = ''; \
    ",0);
    return;
  }
  
  loadedXUL2();
}

function loadedXUL2() {
  
  // don't automatically disable new extensions appearing in the user's profile directory
  // this pref cannot be overwritten by prefs.js so it's set here
  rootprefs.setIntPref("extensions.autoDisableScopes", 14);
  
  // check for newly installed modules and reset mods if necessary
  var resetUserPrefs = false;
  var pfile = getSpecialDirectory("xsResD");
  pfile.append(NEWINSTALLFILE);
  if (LibSword.hasBible) NewModuleInfo = (pfile.exists() ? readNewInstallsFile(pfile):null);
  if (pfile.exists()) removeFile(pfile, false);
  
  if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
    
    resetUserPrefs = true;
    for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
      resetSearchIndex(NewModuleInfo.NewModules[m]);
    }

    NewModuleInfo.NewModules = NewModuleInfo.NewModules.sort(
    function(a,b) {
      var order = [BIBLE, COMMENTARY, DICTIONARY, GENBOOK];
      var ra = (Tab.hasOwnProperty(a) ? Tab[a].modType:GENBOOK);
      var rb = (Tab.hasOwnProperty(b) ? Tab[b].modType:GENBOOK);
      return order.indexOf(ra) > order.indexOf(rb);
    });
    
    var w=1;
    for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
      if (!Tab.hasOwnProperty(NewModuleInfo.NewModules[m])) continue;
      Tab[NewModuleInfo.NewModules[m]]["w" + w + ".hidden"] = false;
      if (w <= ViewPort.NumDisplayedWindows) {
        ViewPort.Module[w] = NewModuleInfo.NewModules[m];
        w++;
      }
    }
      
  }
  
  if (LibSword.hasBible) {
    
    identifyModuleFeatures(resetUserPrefs);
    
    History.init();
    
    createLanguageMenu();
    
    fillModuleMenuLists();
    
    updateXulswordButtons();
    
  }
  
  // Add some numeric access keys but only if parent has an access key...
  function addAccessKeyIf(scelem, id) {
		if ((/^\s*$/).test(document.getElementById(scelem).getAttribute("accesskey")) ||
				!(/\(n\)/).test(id)) return;
    var n = 0;
    while (true) {
      var elem = document.getElementById(id.replace("(n)", n));
      if (!elem && n > 0) break;
      if (elem) elem.setAttribute("accesskey", dString(n));
      n += 1;
    }
  }
  addAccessKeyIf("window-menu", "w(n)");
  addAccessKeyIf("sub-fs", "f(n)");
  addAccessKeyIf("sub-Texts", "winRadio.(n).Texts");
  addAccessKeyIf("sub-Comms", "winRadio.(n).Comms");
  addAccessKeyIf("sub-Genbks", "winRadio.(n).Genbks");
  addAccessKeyIf("sub-Dicts", "winRadio.(n).Dicts");
  addAccessKeyIf("allTabs.submenu", "allTabs.w(n)");
  addAccessKeyIf("noTabs.submenu", "noTabs.w(n)");
  
  // Listen for keypresses on search textbox (for return key)
  document.getElementById("searchText").addEventListener("keypress", 
      function(event) {if ((event.target.id=="searchText") && (event.keyCode==13)) {goDoCommand("cmd_xs_searchFromTextBox");}}, 
      false);

  // Get our command handlers (context menus may insert their own controllers)
  window.controllers.appendController(XulswordController);
  window.controllers.appendController(BookmarksMenuController);
   
  BookmarkFuns.initTemplateDataSource(document.getElementById("bookmarks-menu"), BMDS); 
  
  // Cludge to get history button the right height, must happen after updating locale configuration
  document.getElementById("historymenu").style.height = String(document.getElementById("back").boxObject.height) + "px";
  
  // close splash window
  if (window.opener && window.opener.document.title == "hidden-window")
      closeWindowXS(window.opener); // Close hidden startup window (which in turn closes visible splash window)
	else if (window.opener && window.opener.SplashScreen) closeWindowXS(window.opener.SplashScreen);
 
  if (LibSword.hasBible) {
    //we're ok!
    // User pref DefaultVersion is guaranteed to exist and to be an installed Bible version
    Texts.update(SCROLLTYPEBEG, HILIGHT_IFNOTV1);
    window.setTimeout("postWindowInit()", 1); 
  }
  else if (LibSword.loadFailed) {
		window.setTimeout(function() {
			window.alert("Could not load " + LibSword.LibswordPath.replace(/^.*?[\\\/]([^\\\/]+)$/, "$1"));
			if (OPSYS == "Linux") {
				window.alert("\n\nRun:\n\n$ ldd \"" + LibSword.LibswordPath + "\"\n\nInstall any libraries listed as: \"not found\".");
			}
			closeWindowXS(window); // nothing we can to here...
		}, 1);
	}
  
  // otherwise, no Bibles loaded leaves user with choice to exit or install a module.
	else XulswordController.doCommand("cmd_xs_addRepositoryModule");
  
  jsdump("Initilization Complete\n");
}

function checkCipherKeys() {
  var gotKey = false;
  for (var t=0; t<LibSword.CheckTheseCipherKeys.length; t++) {
    if (!getAvailableBooks(LibSword.CheckTheseCipherKeys[t])[0]) {
      var retVals = {gotKey: false};
      window.openDialog("chrome://xulsword/content/dialogs/getkey/getkey.xul", "getkey", "chrome, dependent, alwaysRaised, centerscreen, modal", LibSword.CheckTheseCipherKeys[t], retVals);
      gotKey |= retVals.gotKey;
    }
  }
  if (gotKey) window.location.reload();
}

//This function is run after the xulsword window is built and displayed. Init functions
//which can wait until now should do so, so that the xulsword window can appear faster.
function postWindowInit() {
  
  // Hide disabled books on chooser
  useFirstAvailableBookIf();
  ViewPort.disableMissingBooks(getPrefOrCreate("HideDisabledBooks", "Bool", false));
  
  // Open language menu if a new locale was just installed
  if (NewModuleInfo && !document.getElementById("sub-lang").disabled &&
      (NewModuleInfo.hasOwnProperty("showLangMenu") && NewModuleInfo.showLangMenu ||
      NewModuleInfo.NewLocales && NewModuleInfo.NewLocales[0])) {
    var opmenu = getDataUI("menu.options");
    var lamenu = getDataUI("menu.options.language");
    var result={};
    var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
        fixWindowTitle(getDataUI("menu.options.language")),
        XSBundle.getFormattedString("LangSelectMsg", [opmenu, lamenu]), 
        DLGINFO,
        DLGOK);
    openLanguageMenu();
  }
  
  // Enable help email address
  var email = null;
  try {email = prefs.getCharPref("HelpEmailAddress");}
  catch (er) {}
  if (email) {
    var menu = document.getElementById("emailus");
    menu.setAttribute("label", email);
    menu.removeAttribute("hidden");
    document.getElementById("emailus-sep").removeAttribute("hidden");
  }
  
  createHelpVideoMenu();
  
  checkCipherKeys();
  
  initBookmarksLocale(BM, BMDS);

}

// Will switch to an available book IF the current book is not available
// in the first displayed LibSword.
function useFirstAvailableBookIf() {
  var vers = ViewPort.firstDisplayBible();
  var availableBooks = getAvailableBooks(vers);
  if (!availableBooks || !availableBooks.length) return;
  var book = Location.getBookName();
  for (var b=0; b<availableBooks.length; b++) {if (availableBooks[b]==book) break;}
  if (b<availableBooks.length) return;
  Location.setLocation(vers, availableBooks[0] + ".1.1.1");
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

function readNewInstallsFile(aFile) {
  var filedata = readFile(aFile);
//jsdump("NewInstall=" + filedata);
  // Filedata example: NewLocales;uz;NewModules;uzv;uzdot;uzdnt;NewFonts;Arial.ttf
  filedata = filedata.split(";");
  var modInfo = {};
  var reading = "unknown";
  if (filedata && filedata.length) {
    for (var n=0; n<filedata.length; n++) {
      if (!filedata[n]) continue
      filedata[n] = filedata[n].replace(/(^\s+|\s+$)/g, "");
      if (filedata[n]=="NewLocales" || filedata[n]=="NewModules" || filedata[n]=="NewFonts") {
        reading = filedata[n];
        modInfo[reading] = [];
        continue;
      }
      switch(reading) {
      case "NewLocales":
        for (var lc in LocaleConfigs) {
          // check that we have a valid locale before saving it
          if (filedata[n] == DEFAULTLOCALE || filedata[n] == lc) {
            modInfo[reading].push(filedata[n]);
            break;
          }
        }
        break;
      case "NewModules":
        var modules = LibSword.getModuleList();
        if (modules) {
          modules = modules.split("<nx>");
          if (modules && modules.length) {
            for (var m=0; m<modules.length; m++) {
              var mod = modules[m].split(";");
              // check that we have a valid module before saving it
              if (mod && mod[0] && mod[0] == filedata[n]) {
                modInfo[reading].push(filedata[n]);
                break;
              }
            }
          }
        }
        break;
      case "NewFonts":
        modInfo[reading].push(filedata[n]);
        break;
      }
    }
  }
  return modInfo;
}

function openLanguageMenu(selectLocale) {
  document.getElementById('options-popup').showPopup(); 
  window.setTimeout("document.getElementById('sub-lang-pup').showPopup()", 100);
}

function resetSearchIndex(modName) {
  try {LibSword.searchIndexDelete(modName);} catch(er) {return false;}
  prefs.setBoolPref("dontAskAboutSearchIndex" + modName, false);
  return true;
}

function identifyModuleFeatures(resetUserPrefs) {
  var f = getModuleFeatures();
  for (var i=0; i<Tabs.length; i++) {
    var fthis = getModuleFeatures(Tabs[i].modName);
    for (var t in fthis) f[t] |= fthis[t];
  }
  
  var hide = getPrefOrCreate("HideDisabledViewMenuItems", "Bool", false);
  var infos = [];
  infos.push({n:"haveDictionary",   e:"cmd_xs_toggleDictionary",          b:"dtbutton", s:null});
  infos.push({n:"haveHeadings",     e:"cmd_xs_toggleHeadings",            b:"hdbutton", s:null});
  infos.push({n:"haveFootnotes",    e:"cmd_xs_toggleFootnotes",           b:"fnbutton", s:"sub-fn"});
  infos.push({n:"haveCrossRefs",    e:"cmd_xs_toggleCrossRefs",           b:"crbutton", s:"sub-cr"});
  infos.push({n:"haveHebrewVowels", e:"cmd_xs_toggleHebrewVowelPoints",   b:null,       s:null});
  infos.push({n:"haveHebrewCant",   e:"cmd_xs_toggleHebrewCantillation",  b:null,       s:null});
  infos.push({n:"haveRedWords",     e:"cmd_xs_toggleRedWords",            b:null,       s:null});
  infos.push({n:"haveStrongs",      e:"cmd_xs_toggleStrongsTags",         b:null,       s:null});
  for (var i=0; i<infos.length; i++) {updateFeature(infos[i], f, resetUserPrefs, hide);}
  
  if (!f.isStrongs) prefs.setCharPref("Strong's Numbers", "Off");
  prefs.setCharPref("Morphological Tags", prefs.getCharPref("Strong's Numbers"));

  var thv = document.getElementById("cmd_xs_toggleHebrewVowelPoints");
  var thc = document.getElementById("cmd_xs_toggleHebrewCantillation");
  if (getPrefOrCreate("HideHebrewOptions", "Bool", false) && ((thv.hidden || thv.getAttribute("disabled")=="true") && (thc.hidden || thc.getAttribute("disabled")=="true")))
    document.getElementById("sub-heb").hidden = true;
}

function updateFeature(info, f, resetUserPrefs, hideDisabledItems) {
  if (!f[info.n]) {
    if (info.e) prefs.setCharPref(GlobalToggleCommands[info.e], "Off");
    if (info.e) document.getElementById(info.e).setAttribute("disabled", "true");
    if (hideDisabledItems && info.e) document.getElementById(info.e).hidden = true;
    //if (info.b) document.getElementById(info.b).hidden = true; THIS WAS CONFUSING TO USERS WITH LITTLE BENEFIT
    if (info.s) document.getElementById(info.s).setAttribute("disabled", "true");
  }
  else if (resetUserPrefs && info.e) prefs.setCharPref(GlobalToggleCommands[info.e], "On");
}

function getModuleFeatures(module) {
  var features = {
    haveDictionary:false,
    haveHeadings:false,
    haveFootnotes:false,
    haveCrossRefs:false,
    haveHebrewCant:false,
    haveHebrewVowels:false,
    haveRedWords:false,
    haveStrongs:false,
    haveMorph:false,
    isStrongs:false
  };
  if (!module) return features;
  
  var globalOptionFilters = LibSword.getModuleInformation(module, "GlobalOptionFilter");
  features.haveHeadings      = (globalOptionFilters.search("Headings")  != -1);
  features.haveFootnotes     = (globalOptionFilters.search("Footnotes") != -1);
  features.haveCrossRefs     = (globalOptionFilters.search("Scripref")  != -1);
  features.haveHebrewCant    = (globalOptionFilters.search("UTF8Cantillation")  != -1);
  features.haveHebrewVowels  = (globalOptionFilters.search("UTF8HebrewPoints")  != -1);
  features.haveRedWords      = (globalOptionFilters.search("RedLetterWords")  != -1);
  features.haveStrongs       = (globalOptionFilters.search("Strongs")  != -1);
  features.haveMorph         = (globalOptionFilters.search("Morph")  != -1);
  
  var feature = LibSword.getModuleInformation(module, "Feature");
  features.isStrongs         = (feature.search("GreekDef")!=-1 || feature.search("HebrewDef")!=-1);
  
  // "Dictionary" is for backward compatibility to old mods which lack standard conf entry (made for xulsword <= 3.6)
  if (globalOptionFilters.search("Reference Material Links")!= -1 || 
			globalOptionFilters.search("Dictionary")!= -1) {
    features.haveDictionary = false;
    var dmods = LibSword.getModuleInformation(module, "DictionaryModule");
    dmods = dmods.split("<nx>");
    for (var m=0; m<dmods.length && !features.haveDictionary; m++) {
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modName==dmods[m]) features.haveDictionary=true;
      }
    }
  }
  return features;
}
  
function createLanguageMenu() {
  var numlocs = 0;
  for (var lc in LocaleConfigs) {numlocs++;}
  if (numlocs <= 1) {
    document.getElementById("sub-lang").setAttribute("disabled", "true");
    return;
  }
  var menuItems = [];
  for (var lc in LocaleConfigs) {
    var bundle = getLocaleBundle(lc, "xulsword.properties");
    
    // check for hideUntilModuleInstalled pref
    try {var hideUntilModuleInstalled = prefs.getBoolPref("hideUntilModuleInstalled." + lc);}
    catch (er) {hideUntilModuleInstalled = false;}
    
    if (hideUntilModuleInstalled) {
      // let's see of a corresponding module is now installed...
      
      // get language base codes to associate with the current lc
      var associatedLocales = lc.match(/^([^\.\-]*)/)[0];
      try {
        var morelocs = bundle.GetStringFromName("AssociatedLanguageCodes");
        if (morelocs && !(/^\s*$/).test(morelocs)) 
            associatedLocales += " " + morelocs;
      }
      catch (er) {}
      associatedLocales = associatedLocales.replace(/\s+/g, "|");
      var locs = new RegExp("(^|,|\\s)(" +  associatedLocales + ")(\\s|,|$)", "i");

      // does any module have one of our associated language base codes?
      for (var t=0; t<Tabs.length; t++) {
        var modlang = LibSword.getModuleInformation(Tabs[t].modName, "Lang");
        if (!modlang) continue;
        modlang = modlang.match(/^([^\.\-]*)/)[0];
        if (!(locs).test(modlang)) continue;
        
        // if so, then show this locale now and cancel the pref
        prefs.setBoolPref("hideUntilModuleInstalled." + lc, false);
        hideUntilModuleInstalled = false;
        if (!NewModuleInfo) NewModuleInfo = {};
        NewModuleInfo.showLangMenu = true;
        break;
      }
    }
    
    // is this locale an extension? if so then never hide it...
    var isExtension = getSpecialDirectory("xsExtension");
    isExtension.append(lc + "." + APPLICATIONID + ".xpi");
    
    if (!isExtension.exists() && hideUntilModuleInstalled) continue;
  
    // now show this lc in the language menu!
    var myAccKey = ""; try {myAccKey = bundle.GetStringFromName("LanguageMenuAccKey");} catch (er) {};

    var xulElement = document.createElement("menuitem");
    xulElement.setAttribute("label", bundle.GetStringFromName("LanguageMenuLabel"));
    if (myAccKey) xulElement.setAttribute("accesskey", myAccKey);
    xulElement.setAttribute("id", "langMenu." + lc);
    xulElement.setAttribute("class", "cs-" + lc);
    xulElement.setAttribute("type", "radio");
    xulElement.setAttribute("name", "lng");
    xulElement.setAttribute("oncommand", "handleOptions(this)");
    menuItems.push(xulElement);
  }
  menuItems.sort(localeElemSort);
  var menu = document.getElementById("sub-lang-pup");
  for (var e=0; e<menuItems.length; e++) {menu.appendChild(menuItems[e]);}
}

function localeElemSort(a,b) {
  var la = a.getAttribute("label").charCodeAt();
  var lb = b.getAttribute("label").charCodeAt();
  if (la < lb) return -1;
  if (la > lb) return 1;
  return 0;
}

var AllVideos = [];
function createHelpVideoMenu() {
  var olditems = [];
  var olditem = document.getElementById("help-popup").firstChild;
  while (olditem && olditem.id && olditem.id != "help-popup-sep1") {
    olditems.push(olditem);
    olditem = olditem.nextSibling;
  }
  while(olditems.length) {
    olditems[0].parentNode.removeChild(olditems[0]);
    olditems.shift();
  }
  while(AllVideos.length) {AllVideos.shift();}


  if (!readVideos(AllVideos)) {
    document.getElementById("help-popup-sep1").setAttribute("hidden", "true");
    return;
  }
  
  document.getElementById("help-popup-sep1").removeAttribute("hidden");
  for (var v=0; v<AllVideos.length; v++) {
    if (!AllVideos[v].type || AllVideos[v].type != "help" || !AllVideos[v].file.leafName.match(XSVIDEOEXT)) continue;
    var xulElement = document.createElement("menuitem");
    xulElement = writeHelpVideoElem(xulElement, AllVideos[v]);
    document.getElementById("help-popup").insertBefore(xulElement, document.getElementById("help-popup-sep1"));
  }
}

function readVideos(vArray) {
  var vdirs = [getSpecialDirectory("xsVideo")];
  for (var i=0; i<vdirs.length; i++) {
    if (!vdirs[i].exists()) continue;
    getVideosInDir(vdirs[i], vArray, null, null);
  }
  return vArray.length;
}

function getVideosInDir(dir, vArray, type, locale) {
  if (!dir || !dir.isDirectory() || !dir.directoryEntries) return;
  var subs = dir.directoryEntries;
  while (subs && subs.hasMoreElements()) {
    var v = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
    if (!v) continue;
    if (v.isDirectory()) getVideosInDir(v, vArray, (!type ? v.leafName:type), (type && !locale ? v.leafName:null));
    if (!v.leafName.match(XSVIDEOEXT)) continue;
    else {
      var obj = {file:v, type:type, locale:locale, label:getLabelOfVideo(v), index:vArray.length, id:"video.help." + vArray.length};
      vArray.push(obj);
    }
  }
}

var VideoInfoFiles = {};
function getLabelOfVideo(file) {
  var info = file.parent.clone();
  info.append(file.leafName.replace(/\d\d\..*$/, "00.txt"));
  if (!VideoInfoFiles[info.leafName]) VideoInfoFiles[info.leafName] = readFile(info);
  if (!VideoInfoFiles[info.leafName]) return file.leafName;
  var labels = VideoInfoFiles[info.leafName];
  var re = new RegExp("^\\s*" + escapeRE(file.leafName) + "\\s*=\\s*(.*)\\s*$", "im");
  var label = labels.match(re);
  return (label ? label[1]:file.leafName);
}

function writeHelpVideoElem(elem, v) {
  elem.setAttribute("id", v.id);
  elem.setAttribute("label", v.label);
  elem.setAttribute("oncommand", "AllVideos[" + v.index + "].file.launch()");
  elem.setAttribute("class", "menuitem-iconic videoHelpMenuItem" + (v.locale ? " cs-" + v.locale:""));
  return elem;
}

function fillModuleMenuLists() {
  var moduleTypeCounts = {}
  for (var t=0; t<Tabs.length; t++) {
    var xulElement = document.createElement("menuitem");
    xulElement.setAttribute("class", "cs-" + Tabs[t].locName);
    xulElement.setAttribute("label", Tabs[t].label + (Tabs[t].description ? " --- " + Tabs[t].description:""));
    xulElement.setAttribute("id", "modulemenu." + String(t));
    xulElement.setAttribute("type", "checkbox");
    xulElement.setAttribute("oncommand", "holdMenuAndHandleOptions(this)");
    xulElement.setAttribute("autocheck","false");
    
    for (var type in SupportedModuleTypes) {
      if (Tabs[t].modType!=SupportedModuleTypes[type]) continue;
      var sub = "sub-" + type;
      var subPup = "sub-" + type + "-pup";
      var sepShowAll = "sepShowAll-" + type;
      if (!moduleTypeCounts[type]) moduleTypeCounts[type]=1;
      else moduleTypeCounts[type]++;
      document.getElementById(subPup).insertBefore(xulElement, document.getElementById(sepShowAll));
    }
  }
    
  for (var type in SupportedModuleTypes) {
    sub = "sub-" + type;
    subPup = "sub-" + type + "-pup";
    sepShowAll = "sepShowAll-" + type;
    var showAllTabs = "showAllTabs." + type;
    var showNoTabs = "showNoTabs." + type;
    if (!moduleTypeCounts[type]) {
      if (getPrefOrCreate("HideDisabledViewMenuItems", "Bool", false)) document.getElementById(sub).hidden=true;
      else document.getElementById(sub).disabled=true;
    }
    else if (moduleTypeCounts[type]==1) {
      if (getPrefOrCreate("HideDisabledViewMenuItems", "Bool", false)) {
        document.getElementById(sepShowAll).hidden=true;
        document.getElementById(showAllTabs).hidden=true;
        document.getElementById(showNoTabs).hidden=true;
      }
      else {
        document.getElementById(sepShowAll).disabled=true;
        document.getElementById(showAllTabs).disabled=true;
        document.getElementById(showNoTabs).disabled=true;
      }
    }
  }
}


/************************************************************************
 * History
 ***********************************************************************/ 
 
var History = {
  list:null,
  index:0,
  depth:30,
  timer:null,
  delay:3500,
  delim:"<nx>",
  
  init: function() {
    this.list = getPrefOrCreate("History", "Char", this.delim).split(this.delim);
    this.index = getPrefOrCreate("HistoryIndex", "Int", 0);
    this.list.pop(); // History pref should always end with HistoryDelimeter
    if (prefs.getCharPref("DefaultVersion") != NOTFOUND) {
      var aVersion = prefs.getCharPref("DefaultVersion");
      var loc = Location.convertLocation(LibSword.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
      this.list[this.index] = loc[0] + "." + loc[1] + "." + loc[2];
    } 
  },
  
  save: function() {
    var newhist="";
    for (var i=0; this.list && i<this.list.length; i++) {
      newhist += this.list[i] + this.delim;
    }
    prefs.setCharPref("History", newhist);
    prefs.setIntPref("HistoryIndex", this.index);
  },
  
  back: function() {
    if (this.index <= 0) return;
    // If we've clicked back, make sure the current location has been added to history first!
    try {window.clearTimeout(this.timer);} catch(er){}
    this.add();
    this.index--;
    this.toHistory(this.index);
  },

  forward: function() {
    if (this.index >= this.depth) return;
    this.index++;
    this.toHistory(this.index);
  },

  toHistory: function (index) {
    var refBible = ViewPort.firstDisplayBible();
    var loc = Location.convertLocation(WESTERNVS, this.list[index] + ".1", LibSword.getVerseSystem(refBible));
    Location.setLocation(refBible, loc);
    document.getElementById("book").book = Location.getBookName();
    document.getElementById("book").version = refBible;
    document.getElementById("chapter").value = dString(Location.getChapterNumber(refBible));
    document.getElementById("verse").value = dString(Location.getVerseNumber(refBible));
    updateFromNavigator();
    goUpdateCommand("cmd_xs_forward");
    goUpdateCommand("cmd_xs_back");
  },

  //When something is selected from the menulist, this routine processes the selection
  toSelection: function(index) {
      this.index = index;
      var toFront = this.list[this.index];  // save chosen entry
      this.list.splice(this.index, 1);   // delete chosen entry
      this.list.push(toFront);        // append chosen entry to front
      this.index = this.list.length-1;  // update Historyi to point to moved entry
      
      this.toHistory(this.index);
  },

  createMenu: function(aEvent) {
    var popup = aEvent.target;
    // clear out the old context menu contents (if any)
    while (popup.hasChildNodes()) 
      popup.removeChild(popup.firstChild);
    // Show history in verse system of firstDisplayBible(), save current Bible location and restore it after creating menu
    var vers = ViewPort.firstDisplayBible();
    for (var i=this.list.length-1; i>=0; i--) {
      var xulElement = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
      xulElement.setAttribute("oncommand", "History.toSelection('" + i + "')");
      var aref = Location.convertLocation(WESTERNVS, this.list[i], LibSword.getVerseSystem(vers));
      xulElement.setAttribute("label", ref2ProgramLocaleText(aref, true));
      //if (i == this.index) {xulElement.style.background="rgb(230,200,255)";}
      popup.appendChild(xulElement);  
    }
  },
    
  add: function() {
		if (LibSword.paused) return;
    var bcvH = this.list[this.index].split(".");
    var bcvN = new Array(3);
    // Always store as SAME versification!
    var aVersion = prefs.getCharPref("DefaultVersion");
    var loc = Location.convertLocation(LibSword.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
    bcvN[0] = loc[0];
    bcvN[1] = loc[1];
    bcvN[2] = loc[2];
    // Check to see if book or chapter is different than last saved history
    if ((bcvN[0] != bcvH[0]) || (bcvN[1] != bcvH[1])) {
      // If so, then record this as a new history entry
      this.index++;
      if (this.index == this.depth) {
        this.list.shift(); 
        this.index--;
      }
      this.list.splice(this.index, (this.depth-this.index), bcvN.join("."));
        
      //update buttons
      goUpdateCommand("cmd_xs_forward");
      goUpdateCommand("cmd_xs_back");
    }
    // If book/chap is same as history, but verse is different, then update verse number in current history, but don't create new history entry
    else if ((bcvN[2] != bcvH[2])) {this.list[this.index] = bcvN.join(".");}
  }
  
};


/************************************************************************
 * Bible Navagator...
 ***********************************************************************/ 
 function updateNavigator() {
  
  var myvers = ViewPort.firstDisplayBible();

  document.getElementById("book").book = Location.getBookName();
  document.getElementById("book").version = myvers;
  document.getElementById("chapter").value = dString(Location.getChapterNumber(myvers));
  document.getElementById("verse").value = dString(Location.getVerseNumber(myvers));
}

function onRefUserUpdate(event, location, version) {
  location = location.split(".");
  var newloc = {shortName:location[0], chapter:location[1], verse:location[2], lastVerse:location[3]}
  if (!newloc.chapter) newloc.chapter = 1;
  if (!newloc.verse) newloc.verse = 1;
  if (!newloc.lastVerse || newloc.lastVerse < newloc.verse) newloc.lastVerse = newloc.verse;
  updateToReference(newloc);
}
 
function updateToReference(loc) {
  if (loc==null) {return;}
  var numberOfSelectedVerses=1;
  if (loc.shortName) {
    document.getElementById("book").book = loc.shortName;
    document.getElementById("book").version = ViewPort.firstDisplayBible();
  }
  if (loc.chapter)   {document.getElementById("chapter").value = dString(loc.chapter);}
  if (loc.verse)     {document.getElementById("verse").value = dString(loc.verse);}
  if (loc.lastVerse) {numberOfSelectedVerses = loc.lastVerse - loc.verse + 1;}
  updateFromNavigator(numberOfSelectedVerses);
}

function updateFromNavigator(numberOfSelectedVerses) {
  var fail=false;
  if (numberOfSelectedVerses == null) {numberOfSelectedVerses = 1;}
  
  var myb = document.getElementById("book").book;
  var myversion = document.getElementById("book").version;
  var myc = Number(iString(document.getElementById("chapter").value));
  if (isNaN(myc)) {myc=1; document.getElementById("chapter").value=dString(myc);}
  var myv = Number(iString(document.getElementById("verse").value));
  if (isNaN(myv)) {myv=1; document.getElementById("verse").value=dString(myv);}
  
  //check book
  var mybn = findBookNum(myb);
  if (mybn == null) {fail=true;}
  
  //force chapter to boundary if over in either direction
  if (myc < 1) {myc=1;}
  if (myc > LibSword.getMaxChapter("KJV", myb)) {myc = LibSword.getMaxChapter("KJV", myb);}
  
  if (!fail) {Location.setLocation(myversion, Book[mybn].sName + "." + myc);}

  //check verse is not necessary since sending Location an illegal verse number will result in return of the appropriate boundary (1 or max verse)
  Location.setVerse(myversion, myv, myv+numberOfSelectedVerses-1);
  Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
}


/************************************************************************
 * Main Command Controller...
 ***********************************************************************/

CommandTarget = {};
var XulswordController = {
  parsedLocation: {},
 
  doCommand: function (aCommand, target) {
    
    // If no target is passed, or it's incomplete, this fills in the defaults
    CommandTarget = getCommandTarget(target);

    switch (aCommand) {
    case "cmd_undo":
      BookmarksCommand.undoBookmarkTransaction();
      break;
    case "cmd_redo":
      BookmarksCommand.redoBookmarkTransaction();
      break;
    case "cmd_xs_toggleHeadings":
    case "cmd_xs_toggleFootnotes":
    case "cmd_xs_toggleCrossRefs":
    case "cmd_xs_toggleDictionary":
    case "cmd_xs_toggleStrongsTags":
    case "cmd_xs_toggleMorphTags":
    case "cmd_xs_toggleVerseNums":
    case "cmd_xs_toggleUserNotes":
    case "cmd_xs_toggleRedWords":
    case "cmd_xs_toggleHebrewCantillation":
    case "cmd_xs_toggleHebrewVowelPoints":
      prefs.setCharPref(GlobalToggleCommands[aCommand],(prefs.getCharPref(GlobalToggleCommands[aCommand])=="Off") ? "On":"Off");
      updateXulswordButtons();
      Texts.update();
      break;
    case "cmd_xs_allTogglesOn":
    case "cmd_xs_allTogglesOff":
      for (var tcmd in GlobalToggleCommands) {
        if (tcmd!="cmd_xs_toggleHebrewVowelPoints" && tcmd!="cmd_xs_toggleHebrewCantillation") {
          var elem = document.getElementById(tcmd);
          if (!elem || elem.getAttribute("disabled") != "true")
            prefs.setCharPref(GlobalToggleCommands[tcmd], aCommand.substring(17));
        }
      }
      updateXulswordButtons();
      Texts.update();
      break;
    case "cmd_xs_search":
      openWindowXS("chrome://xulsword/content/search/search.xul", "search", "chrome,resizable,centerscreen");
      break;
    case "cmd_xs_searchFromTextBox":
      CommandTarget.search.searchtext = document.getElementById("searchText").value;
      openWindowXS("chrome://xulsword/content/search/search.xul", "search", "chrome,resizable,centerscreen");
      break;
    case "cmd_xs_searchForSelection":
      CommandTarget.search.mod = CommandTarget.mod;
      CommandTarget.search.searchtext = CommandTarget.selection;
      CommandTarget.search.type = "SearchExactText";
      openWindowXS("chrome://xulsword/content/search/search.xul", "search", "chrome,resizable,centerscreen");
      break;
    case "cmd_xs_searchForLemma":
      if (!(/lemma\:/).test(CommandTarget.search.searchtext)) break;
      CommandTarget.search.type = "SearchAdvanced";
      openWindowXS("chrome://xulsword/content/search/search.xul", "search", "chrome,resizable,centerscreen");
      break;
    case "cmd_xs_openFromSelection":
      updateToReference(this.parsedLocation);
      break;
    case "cmd_xs_newBookmark":
      BookmarkFuns.addBookmarkAs({shortName:CommandTarget.bk, chapter:CommandTarget.ch, verse:CommandTarget.vs, lastVerse:CommandTarget.lv, version:CommandTarget.mod}, false);
      break;
    case "cmd_xs_newUserNote":
      BookmarkFuns.addBookmarkAs({shortName:CommandTarget.bk, chapter:CommandTarget.ch, verse:CommandTarget.vs, lastVerse:CommandTarget.lv, version:CommandTarget.mod}, true);
      break;
    case "cmd_xs_selectVerse":
      Location.setLocation(CommandTarget.mod, CommandTarget.bk + "." + CommandTarget.ch + "." + CommandTarget.vs + "." + CommandTarget.lv);
      Texts.update(SCROLLTYPECENTER, HILIGHTVERSE);
      break;
    case "cmd_xs_back":
      History.back();
      break;
    case "cmd_xs_forward":
      History.forward();
      break;
    case "cmd_xs_navigatorUpdate":
      updateFromNavigator();
      break;
    case "cmd_xs_openManager":
			openWindowXS("chrome://xulsword/content/bookmarks/bookmarksManager/bookmarksManager.xul", "bookmarksManager", "chrome,resizable,centerscreen", "bookmarksManager");
      break;
    case "cmd_xs_toggleTab":
      if (CommandTarget.w) {
        Tab[CommandTarget.mod]["w" + CommandTarget.w + ".hidden"] = !Tab[CommandTarget.mod]["w" + CommandTarget.w + ".hidden"];
        insureValidTextSelections();
        Texts.update();
      }
      break;
    case "cmd_xs_aboutModule":
      openWindowXS("chrome://xulsword/content/dialogs/about/about.xul", "about", "chrome,modal,centerscreen", "about");
      break;
    case "cmd_xs_chooseFont":
			openWindowXS("chrome://xulsword/content/dialogs/chooseFont/chooseFont.xul","chooseFont","chrome,centerscreen", "chooseFont", CommandTarget.window);
			break;
    case "cmd_xs_addLocalModule":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!addNewModule()) ModuleCopyMutex=false;
      break;
    case "cmd_xs_addRepositoryModule":
			openWindowXS("chrome://xulsword/content/dialogs/addRepositoryModule/addRepositoryModule.xul", "addRepositoryModule", "chrome,resizable,centerscreen", "addRepositoryModule");
      break;
    case "cmd_xs_removeModule":
      openWindowXS("chrome://xulsword/content/dialogs/removeModule/removeModule.xul", "removeModule", "chrome,resizable,centerscreen", "removeModule");
      break;
    case "cmd_xs_exportAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!exportAudio(AUDIOFILELOC)) ModuleCopyMutex=false;
      break;
    case "cmd_xs_importAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!importAudio(null, null, false)) ModuleCopyMutex=false;
      break;
    case "cmd_xs_nextVerse":
      var l = Location.getLocation(CommandTarget.mod).split(".");
      l[1] = Number(l[1]);
      l[2] = Number(l[2]);
      l[2]++;
      if (l[2] > LibSword.getMaxVerse(CommandTarget.mod, l[0] + "." + l[1])) {
        l[1]++;
        if (l[1] > LibSword.getMaxChapter(CommandTarget.mod, l[0])) return;
        l[2] = 1;
      }
      l[3] = l[2];
      Location.setLocation(CommandTarget.mod, l.join("."));
      Texts.update(SCROLLTYPECENTER, HILIGHTVERSE);
      break;
    case "cmd_xs_previousVerse":
      var l = Location.getLocation(CommandTarget.mod).split(".");
      l[1] = Number(l[1]);
      l[2] = Number(l[2]);
      l[2]--;
      if (l[2] == 0) {
        l[1]--;
        if (l[1] == 0) return;
        l[2] = LibSword.getMaxVerse(CommandTarget.mod, l[0] + "." + l[1]);
      }
      l[3] = l[2];
      Location.setLocation(CommandTarget.mod, l.join("."));
      Texts.update(SCROLLTYPECENTER, HILIGHTVERSE);
      break;
    case "cmd_xs_nextChapter":
      if (CommandTarget.ch < LibSword.getMaxChapter(CommandTarget.mod, CommandTarget.bk)) {CommandTarget.ch++;}
      else return;
      Location.setLocation(CommandTarget.mod, CommandTarget.bk + "." + CommandTarget.ch);
      Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
      break;
    case "cmd_xs_previousChapter":
      if (CommandTarget.ch > 1) {CommandTarget.ch--;}
      else return;
      Location.setLocation(CommandTarget.mod, CommandTarget.bk + "." + CommandTarget.ch);
      Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
      break;
    case "cmd_xs_nextBook":
      var bkn = findBookNum(CommandTarget.bk);
      bkn++;
      if (bkn >= Book.length) return;
      Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
      Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
      break;
    case "cmd_xs_previousBook":
      var bkn = findBookNum(CommandTarget.bk);
      bkn--;
      if (bkn < 0) return;
      Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
      Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
      break;
    }
  },
  
  isCommandEnabled: function (aCommand, target) {
    
    target = getCommandTarget(target);
    
    switch (aCommand) {
    case "cmd_undo":
      return (BM.gTxnSvc.numberOfUndoItems > 0);
    case "cmd_redo":
      return (BM.gTxnSvc.numberOfRedoItems > 0);
    case "cmd_xs_searchFromTextBox":
      return (document.getElementById("searchText").value.length > 0);
    case "cmd_xs_searchForSelection":
      return (target.selection ? true:false);
    case "cmd_xs_searchForLemma":
      return ((/lemma\:/).test(target.search.searchtext) && target.mod ? true:false);
    case "cmd_xs_forward":
      return (History.index < History.list.length-1);
    case "cmd_xs_back":
      return (History.index > 0);
    case "cmd_xs_openFromSelection":
      this.parsedLocation = null;
      var s = target.selection;
      if (s) this.parsedLocation = parseLocation(s.substr(0,64));
      return this.parsedLocation ? true:false;
    case "cmd_xs_toggleTab":
      return (target.w && target.mod && !ViewPort.IsPinned[target.w] ? true:false);
    case "cmd_xs_exportAudio":
      if (ModuleCopyMutex) return false;
      if (!AudioDirs.length) return false;
      for (var i=0; i<AudioDirs.length; i++) {
        if (AudioDirs[i].isExportable && AudioDirs[i].dir.exists()) {
          var subs = AudioDirs[i].dir.directoryEntries;
          while (subs && subs.hasMoreElements()) {
            var sub = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
            if (!sub || !sub.isDirectory() || sub.equals(getSpecialDirectory("xsAudioPI"))) continue;
            return true;
          }
        }
      }
      return false;
      break;
    case "cmd_xs_addLocalModule":
    case "cmd_xs_addRepositoryModule":
    case "cmd_xs_removeModule":
    case "cmd_xs_importAudio":
      if (ModuleCopyMutex) return false;
      break;
    case "cmd_xs_nextVerse":
      var mod = ViewPort.firstDisplayBible();
      return (target.vs < LibSword.getMaxVerse(target.mod, Location.getLocation(target.mod)));
    case "cmd_xs_previousVerse":
      return (target.vs > 1);
    case "cmd_xs_nextChapter":
      return (target.ch < LibSword.getMaxChapter(target.mod, Location.getLocation(target.mod)));
    case "cmd_xs_previousChapter":
      return (target.ch > 1);
    case "cmd_xs_nextBook":
      return (findBookNum(target.bk) < Book.length-1);
    case "cmd_xs_previousBook":
      return (findBookNum(target.bk) > 1);
    }
    
    return true;
  },
      
  supportsCommand: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
    case "cmd_redo":
    case "cmd_xs_toggleHeadings":
    case "cmd_xs_toggleFootnotes":
    case "cmd_xs_toggleCrossRefs":
    case "cmd_xs_toggleDictionary":
    case "cmd_xs_toggleStrongsTags":
    case "cmd_xs_toggleMorphTags":
    case "cmd_xs_toggleVerseNums":
    case "cmd_xs_toggleUserNotes":
    case "cmd_xs_toggleRedWords":
    case "cmd_xs_toggleHebrewCantillation":
    case "cmd_xs_toggleHebrewVowelPoints":
    case "cmd_xs_allTogglesOn":
    case "cmd_xs_allTogglesOff":
    case "cmd_xs_search":
    case "cmd_xs_searchFromTextBox":
    case "cmd_xs_searchForSelection":
    case "cmd_xs_searchForLemma":
    case "cmd_xs_newBookmark":
    case "cmd_xs_newUserNote":
    case "cmd_xs_selectVerse":
    case "cmd_xs_back":
    case "cmd_xs_forward":
    case "cmd_xs_navigatorUpdate":
    case "cmd_xs_openManager":
    case "cmd_xs_openFromSelection":
    case "cmd_xs_toggleTab":
    case "cmd_xs_aboutModule":
    case "cmd_xs_chooseFont":
    case "cmd_xs_addLocalModule":
    case "cmd_xs_addRepositoryModule":
    case "cmd_xs_removeModule":
    case "cmd_xs_exportAudio":
    case "cmd_xs_importAudio":
    case "cmd_xs_nextVerse":
    case "cmd_xs_previousVerse":
    case "cmd_xs_nextChapter":
    case "cmd_xs_previousChapter":
    case "cmd_xs_nextBook":
    case "cmd_xs_previousBook":
      return true;
    default:
      return false;
    }
  }
}

// This is the default target for the main command controller. This 
// default target is returned each time the controller is used, unless
// a target is supplied, which will overwrite the defaults.
function getCommandTarget(target) {
  if (!LibSword.hasBible) {return {};}
  
  // first get all default target parameters
  var deftarg = {};
  deftarg.search = { 
      mod:ViewPort.firstDisplayBible(), 
      searchtext:document.getElementById('searchText').value, 
      type:"SearchAnyWord", 
      scope:"SearchAll" 
  };
  deftarg.bookmark = null;
  deftarg.w = null;
  deftarg.mod = ViewPort.firstDisplayBible();

  switch (Tab[deftarg.mod].modType) {
  case BIBLE:
  case COMMENTARY:
    deftarg.bk = Location.getBookName();
    deftarg.ch = Location.getChapterNumber(deftarg.mod);
    deftarg.vs = Location.getVerseNumber(deftarg.mod);
    deftarg.lv = Location.getLastVerseNumber(deftarg.mod);
    break;
  case DICTIONARY:
  case GENBOOK:
    deftarg.bk = "";
    deftarg.ch = (deftarg.w ? ViewPort.Key[deftarg.w]:null);
    deftarg.vs = 1;
    deftarg.lv = 1;
    break;
  }
  
  var s = ViewPort.ownerDocument.defaultView.getSelection();
  if (s && s.isCollapsed) {s = null;}
  if (s) s = replaceASCIIcontrolChars(s.toString())
  deftarg.selection = s;
  
  deftarg.window = window;
  
  // now overwrite defaults with any provided target parameters
  if (target) {
    for (var m in target) {
      if (target.hasOwnProperty(m) && target[m] !== undefined && target[m] !== null) {
        deftarg[m] = target[m];
      }
    }
  }
  
  return deftarg;
}

function goUpdateFileMenu () {
  goUpdateCommand('cmd_xs_exportAudio');
  goUpdateCommand('cmd_xs_removeModule');
  goUpdateCommand('cmd_xs_exportAudio');
  goUpdateCommand('cmd_xs_importAudio');
}

function goUpdateNewModuleMenu() {
	
  // permanently block all internet access if required
  var allowNoInternetAccess;
  try {allowNoInternetAccess = prefs.getBoolPref("AllowNoInternetAccess");}
	catch (er) {allowNoInternetAccess = false;}
	
	if (allowNoInternetAccess) document.getElementById("newInternetModule").setAttribute("hidden", "true");
	else document.getElementById("newInternetModule").removeAttribute("hidden");

}


/************************************************************************
 * XULSWORD Window click handlers
 ***********************************************************************/

//Sets view->Show... prefs
function handleViewPopup(elem) {
  var val=elem.getAttribute('value');
  var vals=val.split("_");
  prefs.setBoolPref(vals[0],(vals[1]=="1" ? true:false));
  Texts.update();
}

var OptionsElement;
function holdMenuAndHandleOptions(elem) {
  preventMenuFromHiding();
  OptionsElement = elem;
  window.setTimeout("handleOptions();", 0);
}

function handleOptions(elem) {
  if (!elem) elem = OptionsElement;
  var id = String(elem.id + ".").split(".");
  id.pop();
  switch (id[0]) {
    case "w1":
    case "w2":
    case "w3":
      ViewPort.NumDisplayedWindows = Number(elem.id.substr(1,1));
      Texts.update();
      break;
        
    case "f0":
    case "f1":
    case "f2":
    case "f3":
    case "f4":
      prefs.setIntPref("FontSize", 2*(Number(elem.id.substr(1,1)) - 2));

      // change font for all those windows and all their iframes which
      // have a setUserFontSize function
      for (var i=0; i<AllWindows.length; i++) {
        if (!AllWindows[i]) next;
        
        if (typeof(AllWindows[i].setUserFontSize) != "undefined") 
            AllWindows[i].setUserFontSize(prefs.getIntPref('FontSize'));
            
        var iframe = AllWindows[i].document.getElementsByTagName("iframe");
        for (var j=0; j<iframe.length; j++) {
          if (typeof(iframe[j].contentDocument) == "undefined") continue;
          if (typeof(iframe[j].contentDocument.defaultView.setUserFontSize) != "undefined") {
            iframe[j].contentDocument.defaultView.setUserFontSize(prefs.getIntPref('FontSize'));
          }
        }
      }
      
      Texts.update(SCROLLTYPETOP, HILIGHTNONE, [null, 1, 1, 1]);
      break;
      
    case "fontAdjust":
			CommandTarget.mod = null;
			MainWindow.XulswordController.doCommand("cmd_xs_chooseFont");
			break;
    
    case "about":
      CommandTarget = { mod:null }; // show logo, not modules info
      openWindowXS("chrome://xulsword/content/dialogs/about/about.xul", "about", "chrome,modal,centerscreen", "about");
      break;
      
    case "modulemenu":
      var oldCheckedValue = (elem.getAttribute("checked") == "true");
      elem.setAttribute("checked", (oldCheckedValue ? "false":"true"));
    case "showAllTabs":
    case "showNoTabs":
      var subPupId = elem.parentNode.id.match(/sub-([^-]+)-pup/)[1];
      MainWindow.setTimeout("moduleMenuClick1('" + id[0] + "', '" + id[1] + "', '" + subPupId + "', " + oldCheckedValue + ")", 0);
      break;

    case "winRadio":
      for (var shortType in SupportedModuleTypes) {
				for (var i=1; i<=(NW+1); i++) {
					document.getElementById("winRadio." + i + "." + shortType).removeAttribute("checked");
				}
				document.getElementById("winRadio." + id[1] + "." + shortType).setAttribute("checked", "true");
      }
      updateModuleMenuCheckmarks();
      insureValidTextSelections();
      break;

    case "emailus":
      var email = null;
      try {email = prefs.getCharPref("HelpEmailAddress");}
      catch (er) {}
      if (email) {
        var aURI = "mailto:" + email;
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
        aURI = ios.newURI(aURI, null, null);
        aURI = aURI.asciiSpec;
        jsdump("Launching mailto URI of " + aURI.length + " chars.");
        try {window.location = aURI;}
        catch(er) {jsdump("Unable to launch email client.");}
      }
      break;
      
    case "allTabs":
      var w = id[1].match(/^w(\d)$/);
      setAllTabs(true, w[1]);
      break;
      
    case "noTabs":
      var w = id[1].match(/^w(\d)$/);
      setAllTabs(false, w[1]);
      break;
      
    case "langMenu":
      for (var lc in LocaleConfigs) {
        if (elem.id == "langMenu." + lc) {
          changeLocaleTo(lc);
          return;
        }
      }
      break;
    
    default:
      jsdump("WARNING: No handler found for: " + elem.parentNode.id + " " + elem.id + "\n");
      break;
  }
}

function holdPopupAndDo(cmd) {
  preventMenuFromHiding();
  if (cmd == "cmd_xs_toggleStrongsTags") window.setTimeout("goDoCommand('cmd_xs_toggleStrongsTags'); goDoCommand('cmd_xs_toggleMorphTags');", 0);
  else window.setTimeout("goDoCommand('" + cmd + "');", 0);
}

var PreventMenuHide = false;
function preventMenuFromHiding() {
  PreventMenuHide = true;
  window.setTimeout("PreventMenuHide = false; Pups = null;", 0);
}

var Pups;
function checkMenuHide(elem, e) {
  if (!PreventMenuHide) {Pups = null; return;}

  if (!Pups) Pups = [];
  Pups.push(e.target);
  
  if (elem == e.target) {
    for (var i=Pups.length-1; i>=0; i--) {
      Pups[i].parentNode.open = true;
    }
  }
}

// Shows or hides all tabs for: if w is passed then window w, otherwise all windows
function setAllTabs(toShowing, w) {
  if (w<4) {var s=w; var e=w;}
  else {s=1; e=NW;}
  for (var i=s; i<=e; i++) {
    for (var t=0; t<Tabs.length; t++) {
      var toggleMe = (toShowing ? Tabs[t]["w" + i + ".hidden"]:!Tabs[t]["w" + i + ".hidden"]);
      if (toggleMe) Tabs[t]["w" + i + ".hidden"] = !Tabs[t]["w" + i + ".hidden"];
    }
  }
  
  updateModuleMenuCheckmarks();
  insureValidTextSelections();
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

function moduleMenuClick1(id, tabNum, subPupId, oldCheckedValue) {
  var rs = getWinRadioSelection(subPupId);
  var aWindowNum = rs;
  if (aWindowNum <= NW) var sw=aWindowNum;
  else {sw=1; aWindowNum=NW;}
  
  for (var i=sw; i<=aWindowNum; i++) {
    switch (id) {
    case "modulemenu":
      if (oldCheckedValue != Tabs[tabNum]["w" + i + ".hidden"]) {
        Tabs[tabNum]["w" + i + ".hidden"] = !Tabs[tabNum]["w" + i + ".hidden"] ;
      }
      break;
    case "showAllTabs":
    case "showNoTabs":
      var moduletype = SupportedModuleTypes[subPupId];
      if (!moduletype) return;
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType != moduletype) continue;
        var toggleMe = (id=="showNoTabs" ? !Tabs[t]["w" + i + ".hidden"]:Tabs[t]["w" + i + ".hidden"]);
        if (toggleMe) Tabs[t]["w" + i + ".hidden"] = !Tabs[t]["w" + i + ".hidden"];
      }
      break;
    }
  }
  
	updateModuleMenuCheckmarks();
	insureValidTextSelections();
	Texts.update(SCROLLTYPETOP, HILIGHTNONE);

}

function getWinRadioSelection(type) {
  for (var r=1; r<=(NW+1); r++) {
    var elem = document.getElementById("winRadio." + r + "." + type);
    if (elem.getAttribute("checked") == "true") return r;
  }
  return 4;
}

function changeLocaleTo(newLocale) {
  var rootPrefBranch = Components.classes["@mozilla.org/preferences-service;1"].
                      getService(Components.interfaces.nsIPrefBranch);
  if (newLocale == getLocale()) return;
  rootPrefBranch.setCharPref("general.useragent.locale",newLocale);
  
  prefs.clearUserPref("addRepositoryModuleLang");
  
  restartApplication();
}

function updateXulswordButtons() {
	
	// update global toggle menu and buttons
  var checkboxes = ["cmd_xs_toggleHebrewCantillation", "cmd_xs_toggleHebrewVowelPoints"];
  for (var cmd in GlobalToggleCommands) {
    var checkbox=false;
    for (var cb=0; cb<checkboxes.length; cb++) {checkbox |= (cmd==checkboxes[cb]);}
    if (checkbox) document.getElementById(cmd).setAttribute("checked",(prefs.getCharPref(GlobalToggleCommands[cmd])=="On") ? true:false);
    else {
      try {document.getElementById(cmd).setAttribute("value",(prefs.getCharPref(GlobalToggleCommands[cmd])=="On") ? true:false);}
      catch (er) {}
    }
    if (GlobalToggleCommands[cmd] != "User Notes")
      LibSword.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
  }
  
  // update language menu
  var myLocale = getLocale();
  if (document.getElementById("sub-lang").getAttribute("disabled") != "true") {
    for (var lc in LocaleConfigs) {
      var lmenu = document.getElementById("langMenu." + lc);
      if (!lmenu) continue; // due to hideUntilModuleInstalled not all locales may have menu items
      lmenu.setAttribute("checked",(lc == myLocale ? true:false));
    }
  }
  
  // update font size menu
  document.getElementById("f0").setAttribute("checked",(prefs.getIntPref("FontSize")==-4 ? true:false));
  document.getElementById("f1").setAttribute("checked",(prefs.getIntPref("FontSize")==-2 ? true:false));
  document.getElementById("f2").setAttribute("checked",(prefs.getIntPref("FontSize")==0 ? true:false));
  document.getElementById("f3").setAttribute("checked",(prefs.getIntPref("FontSize")==2 ? true:false));
  document.getElementById("f4").setAttribute("checked",(prefs.getIntPref("FontSize")==4 ? true:false));
  
  // update show notes in popup/footnote-box
  document.getElementById("note0").setAttribute("checked",(prefs.getBoolPref("ShowFootnotesAtBottom") ? false:true));
  document.getElementById("note1").setAttribute("checked",(prefs.getBoolPref("ShowFootnotesAtBottom") ? true:false));
  document.getElementById("note2").setAttribute("checked",(prefs.getBoolPref("ShowCrossrefsAtBottom") ? false:true));
  document.getElementById("note3").setAttribute("checked",(prefs.getBoolPref("ShowCrossrefsAtBottom") ? true:false));
  document.getElementById("note4").setAttribute("checked",(prefs.getBoolPref("ShowUserNotesAtBottom") ? false:true));
  document.getElementById("note5").setAttribute("checked",(prefs.getBoolPref("ShowUserNotesAtBottom") ? true:false));
  
  // update window menu
  document.getElementById("w1").setAttribute("checked",(ViewPort.NumDisplayedWindows==1 ? true:false));
  document.getElementById("w2").setAttribute("checked",(ViewPort.NumDisplayedWindows==2 ? true:false));
  document.getElementById("w3").setAttribute("checked",(ViewPort.NumDisplayedWindows==3 ? true:false));
  
  // disable show notes in popup/footnote-box menus if related footnotes are off
  if (LibSword.getGlobalOption("Footnotes") == "On") {document.getElementById("sub-fn").setAttribute("disabled",false);}
  else {document.getElementById("sub-fn").setAttribute("disabled",true);}
  if (LibSword.getGlobalOption("Cross-references") == "On")  {document.getElementById("sub-cr").setAttribute("disabled",false);}
  else {document.getElementById("sub-cr").setAttribute("disabled",true);}
  if (prefs.getCharPref("User Notes") == "On")  {document.getElementById("sub-un").setAttribute("disabled",false);}
  else {document.getElementById("sub-un").setAttribute("disabled",true);}

  window.setTimeout("updateXulswordCommands();", 0); // timeout insures commandDispatcher is ready during xulSword init
}

function updateXulswordCommands() {
  goUpdateCommand("cmd_xs_forward");
  goUpdateCommand("cmd_xs_back");
  goUpdateCommand("cmd_bm_properties");
  goUpdateCommand("cmd_xs_searchFromTextBox");
  goUpdateCommand("cmd_xs_searchForSelection");
}

function updateModuleMenuCheckmarks() {

  for (var t=0; t<Tabs.length; t++) {
		
    var aWindowNum = getWinRadioSelection(Tabs[t].tabType);
    var checked = true;
    if (aWindowNum <= NW) var sw = aWindowNum;
    else {sw=1; aWindowNum=NW;}
    for (var w=sw; w<=aWindowNum; w++) {
      checked &= !Tabs[t]["w" + w + ".hidden"];
    }

    if (checked) document.getElementById("modulemenu." + t).setAttribute("checked", "true");
    else document.getElementById("modulemenu." + t).removeAttribute("checked");
    
  }
  
}

function insureValidTextSelections() {
  // insure each window has a selected tab
  for (var w=1; w<=NW; w++) {
    if (Tab[ViewPort.Module[w]]["w" + w + ".hidden"]) {
      for (var t=1; t<Tabs.length; t++) {if (!Tabs[t]["w" + w + ".hidden"]) break;} 
      if (t<Tabs.length) ViewPort.selectTab(w, Tabs[t].modName);
    }
  }
}

var GotoLocation;
function showLocation(mod, bk, ch, vs, lv) {
  var w = ensureModuleShowing(mod);
  if (!w) return;
  
  if (!bk) bk = "Gen";
  if (!ch) return; // must be either Bible chapter or key!
  if (!vs) vs = 1;
  if (!lv) lv = vs;
  
  GotoLocation = { w:w, mod:mod, bk:bk, ch:ch, vs:vs, lv:lv };
  
//jsdump("showLocation:" + w + ", " + mod + ", " + bk + ", " + ch + ", " + vs + ", " + lv);  
  window.setTimeout("showLocation2()", 1);
  
}

function showLocation2() {

  var l = GotoLocation; // always set by showLocation()
 
  switch (Tab[l.mod].modType) {
    
  case BIBLE:
  case COMMENTARY:
    Location.setLocation(l.mod, l.bk + "." + l.ch + "." + l.vs + "." + l.lv);
    MainWindow.focus();
    Texts.update(SCROLLTYPECENTER, HILIGHTVERSE, [null,1,1,1]);
    break;
    
  case GENBOOK:
  case DICTIONARY:
    ViewPort.Key[l.w] = l.ch;
    MainWindow.focus();
    Texts.update(SCROLLTYPETOP, HILIGHTNONE, [null,1,1,1]);
    break;
    
  }
  
}

// This routine returns the number of the first window which is showing the desired version.
// If no window is showing the version, it looks for the first unpinned window
// which has the version's tab showing, selects that tab, and returns that window's number.
// If no window even has the tab showing, the tab is added to the first unpinned
// window, and that tab is selected, and that window's number is returned.
// If no window can be made to show the desired version, then "0" is returned.
function ensureModuleShowing(version) {
  if (!Tab[version]) return 0;
  var aWindow = 0;
  var firstUnPinnedWin;
  for (var w=1; w <= ViewPort.NumDisplayedWindows; w++) {
    if (ViewPort.IsPinned[w]) continue;
    if (!firstUnPinnedWin) firstUnPinnedWin = w;
    if (ViewPort.Module[w] == version) return w;
    if (!aWindow && !Tab[version]["w" + w + ".hidden"]) {aWindow = w;}
  }
  if (aWindow == 0) {
    if (!firstUnPinnedWin) return 0;
    aWindow = firstUnPinnedWin;
    Tab[version]["w" + aWindow + ".hidden"] = !Tab[version]["w" + aWindow + ".hidden"]
    insureValidTextSelections();
  }

  ViewPort.selectTab(aWindow, version);
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
 
  return aWindow;
}
 

/************************************************************************
 * XUL Window Unload
 ***********************************************************************/ 

function unloadXUL() {
  
  // set these so xulsword viewport can draw cleaner and faster upon next startup
  if (ViewPort.ownerDocument.defaultView && ViewPort.ownerDocument.defaultView.innerHeight) {
    prefs.setIntPref("ViewPortHeight", ViewPort.ownerDocument.defaultView.innerHeight);
    prefs.setIntPref("ViewPortWidth", ViewPort.ownerDocument.defaultView.innerWidth);
  }
  
  ViewPort.unload();
  
  // remove the exception reporter
  setConsoleService(false);
  
  // remove ALL command controllers because window.location.reload otherwise
  // allows them to pile up, causing very strange effects during debugging (like
  // xulsword running old versions of commands).
  while(true) {
    try {window.controllers.removeControllerAt(0);}
    catch (er) {break;}
  }
  
  // close all windows
  for (var i=0; i<AllWindows.length; i++) {
    if (AllWindows[i] === window) continue;
    try {AllWindows[i].close();} catch(er) {}
  }

  // clear Transactions
  BM.gTxnSvc.clear();

  // purge UserData data source
  if (BMDS) ResourceFuns.purgeDataSource(BMDS);

  if (!LibSword.hasBible) return;
  
  prefs.setCharPref("Location", Location.getLocation(WESTERNVS));
  
  // save our xulsword global option prefs...
  for (var cmd in GlobalToggleCommands) {
    if (GlobalToggleCommands[cmd] == "User Notes") continue;
    prefs.setCharPref(GlobalToggleCommands[cmd], LibSword.getGlobalOption(GlobalToggleCommands[cmd]));
  }

  History.save();
  LibSword.quitLibsword();

  jsdump("Finished unloading xulsword.js");
}

/************************************************************************
 * Display Copy/Printing Functions
 ***********************************************************************/ 

function copyPassageDialog() {
  openWindowXS("chrome://xulsword/content/dialogs/copyPassage/copyPassage.xul", "copyPassage", "chrome,resizable,centerscreen", "copyPassage");
}

// To print, you must pass a print-target to this handlePrintCommand
// function. Then, the file which was asked to load in the printBrowser 
// must call printBrowserLoaded() when it's done loading.
var PrintTarget = null;
function handlePrintCommand(command, target) {
  if (!command) return;
 
  // default print target is viewport
  PrintTarget = {
    command:command,
    uri:(target && target.uri ? target.uri:"chrome://xulsword/content/viewport/viewport.html"), 
    bodyHTML:(target && target.bodyHTML ? target.bodyHTML:null),
    callback:(target && target.callback ? target.callback:null)
  };
  
  switch (command) {
  case "cmd_pageSetup":
    document.getElementById("cmd_pageSetup").doCommand();
    break;
    
  case "cmd_printPreview":
  case "cmd_print":
    // NOTE: The loaded URI must call MainWindow.printBrowserLoaded() after it has loaded!
    document.getElementById('printBrowser').loadURI(PrintTarget.uri);
    break;
    
  case "cmd_print_passage":
			openWindowXS("chrome://xulsword/content/dialogs/printPassage/printPassage.xul", "printPassage", "chrome,resizable,centerscreen", "printPassage");
    break;
  }
}

function printBrowserLoaded() {
  var pbDoc = document.getElementById("printBrowser").contentDocument;
  
  pbDoc.title = ".";

  if (PrintTarget.bodyHTML) {
    // NOTE: this copies the body HTML but not any body attributes. So
    // body attributes will remain what they were when the doc was loaded.
    pbDoc.getElementsByTagName("body")[0].innerHTML = PrintTarget.bodyHTML;
  }
  
  document.getElementById(PrintTarget.command).doCommand();
  
  if (PrintTarget.command == "cmd_print" && PrintTarget.callback && 
      typeof(PrintTarget.callback.onPrintDone) == "function") {
    PrintTarget.callback.onPrintDone(); 
  }
  
}

var PrintPreviewCallbacks = {
  onEnter: function() {
    document.getElementById("mainbar").hidden = true;
    document.getElementById("main-controlbar").hidden = true;
    document.getElementById("viewport-deck").selectedIndex = 1;
  },
  
  onExit: function() {
    document.getElementById("mainbar").hidden = false;
    document.getElementById("main-controlbar").hidden = false;
    document.getElementById("viewport-deck").selectedIndex = 0;
    
    // Allow original caller to do something (like refocus their window) 
    // after print preview is done.
    if (PrintTarget.callback && typeof(PrintTarget.callback.onPrintPreviewDone) == "function") {
      PrintTarget.callback.onPrintPreviewDone();
    }
    
  },
  
  getSourceBrowser: function() {
    return document.getElementById("printBrowser");
  },
  
  getPrintPreviewBrowser: function() {
    return document.getElementById("printPreviewBrowser");
  },
  
  getNavToolbox: function() {
    return document.getElementById("mainbar");
  }
}


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 
 
function toOpenWindowByType(inType, uri, features)
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
  var topWindow = windowManagerInterface.getMostRecentWindow(inType);

  var thiswin;
  if (topWindow)
    topWindow.focus();
  else if (features) {
    thiswin = window.open(uri, "_blank", features);
  }
  else {
    thiswin = window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  }
  
  return thiswin;
}



