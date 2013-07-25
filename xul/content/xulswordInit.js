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


// INITIALIZES GLOBAL COMMON VARS WHICH ONLY NEED TO BE EVALUATED ONCE

/************************************************************************
 * Initialize program-wide global variables
 ***********************************************************************/ 
 
LocaleConfigs = {};
ModuleConfigs = {};
ProgramConfig = {};
Tabs = [];
Tab = {};
SpecialModules = {DailyDevotion:{}, LanguageStudy:{ GreekDef:[], HebrewDef:[], GreekParse:[] }};
AllWindows = []; // this is needed by viewport...


/************************************************************************
 * LOCALE INIT ROUTINE
 ***********************************************************************/ 

function initLocales() {
  var validLocale = null;
  
  var chromeRegService = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService();
	var toolkitChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIToolkitChromeRegistry);
	var availableLocales = toolkitChromeReg.getLocalesForPackage("xulsword");
  
  var currentLocale = getLocale();
  rootprefs.setCharPref("general.useragent.locale", currentLocale);
  
  // Create LocaleConfigs
	while(availableLocales.hasMore()) {
		var lc = availableLocales.getNext();
    
    if (lc == currentLocale) validLocale = lc;
    LocaleConfigs[lc] = getLocaleConfig(lc);
	}
  
  if (!validLocale) jsdump("Current locale is not valid: " + currentLocale + "\n");

  return validLocale;
}


/************************************************************************
 * MODULE INIT ROUTINE
 ***********************************************************************/ 

function initModules() {

  // Gets list of available modules
  var modules = LibSword.getModuleList();
  if (!modules) return false;
  modules = modules.split("<nx>");
  
  for (var m=0; m<modules.length; m++) {
  
    var mod = modules[m].split(";")[0];
    var type = modules[m].split(";")[1];
        
    // Weed out unsupported module types
    var supported = false;
    for each (var stype in SupportedModuleTypes) {supported |= (type == stype);}
    if (!supported) continue;
    
    // Weed out incompatible module versions. The module installer shouldn't 
    // allow bad mods, but this is just in case.
    var comparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
    var xsversion = LibSword.getModuleInformation(mod, VERSIONPAR);
    xsversion = (xsversion != NOTFOUND ? xsversion:MINVERSION);
    var modminxsvers;
    try {modminxsvers = prefs.getCharPref("MinXSMversion");} catch (er) {modminxsvers = MINVERSION;}
    if (comparator.compare(xsversion, modminxsvers) < 0) continue;
    var xminprogvers = LibSword.getModuleInformation(mod, MINPVERPAR);
    xminprogvers = (xminprogvers != NOTFOUND ? xminprogvers:MINVERSION);
    if (comparator.compare(prefs.getCharPref("Version"), xminprogvers) < 0) continue;
    var xsengvers = LibSword.getModuleInformation(mod, "MinimumVersion");
    xsengvers = (xsengvers!=NOTFOUND ? xsengvers:0);
    var enginevers; try {enginevers = prefs.getCharPref("EngineVersion");} catch (er) {enginevers = NOTFOUND;}
    if (enginevers != NOTFOUND && comparator.compare(enginevers, xsengvers) < 0) continue;
    
    // Language glossaries don't currently work (too big??) and so aren't supported.
    if (LibSword.getModuleInformation(mod, "GlossaryFrom") != NOTFOUND) continue;
    
    ModuleConfigs[mod] = getModuleConfig(mod);
  }
  
  return true;
}

// Return a locale (if any) to associate with the module:
//    Return a Locale which lists the module as its default
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return null if no match
function getLocaleOfModule(module) {
  var myLocale=null;
  
  for (var lc in LocaleConfigs) {
    var regex = new RegExp("(^|\s|,)+" + module + "(,|\s|$)+");
    if (LocaleConfigs[lc].AssociatedModules.match(regex)) myLocale = lc;
  }
  
  if (myLocale) return myLocale;
  
  for (lc in LocaleConfigs) {
    var lcs, ms;
    try {
      lcs = lc.toLowerCase();
      ms = LibSword.getModuleInformation(module, "Lang").toLowerCase();
    }
    catch(er) {lcs=null; ms==null;}
    
    if (ms && ms == lcs) {myLocale = lc; break;}
    if (ms && lcs && ms.replace(/-.*$/, "") == lcs.replace(/-.*$/, "")) {
      myLocale = lc;
      if (myLocale == getLocale()) break;
    }
  }
  
  return myLocale;
}


/************************************************************************
 * INITIALIZE PROGRAM TABS AND LABELS ETC.
 ***********************************************************************/  

function initTabGlobals() {
  
  var modlist = LibSword.getModuleList();
  var modarray = [];
  var origModuleOT = null;
  var origModuleNT = null;

  for (var mod in ModuleConfigs) {
    var typeRE = new RegExp("(^|<nx>)" + mod + ";(.*?)(<nx>|$)");
    var type = modlist.match(typeRE)[2];
   
    if (type == DICTIONARY) {
    
      // Set Global dictionary module params
      var mlang = LibSword.getModuleInformation(mod, "Lang");
      var mlangs = mlang.replace(/-.*$/, "");

      var feature = LibSword.getModuleInformation(mod, "Feature");
      if (feature.search("DailyDevotion") != -1) {
        SpecialModules.DailyDevotion[mod] = "DailyDevotionToday";
      }
      else if (feature.search("GreekDef") != -1) SpecialModules.LanguageStudy.GreekDef.push(mod);
      else if (feature.search("HebrewDef") != -1) SpecialModules.LanguageStudy.HebrewDef.push(mod);
      else if (feature.search("GreekParse") != -1) SpecialModules.LanguageStudy.GreekParse.push(mod);
      
    }
    
    // Get tab label
    var label = LibSword.getModuleInformation(mod, "TabLabel");
    if (label == NOTFOUND) label = LibSword.getModuleInformation(mod, "Abbreviation");
    var labelFromUI = null;
    
    // Set up Original tab Globals
    var isORIG = LibSword.getModuleInformation(mod, "OriginalTabTestament");
    if (isORIG == "OT") {
      origModuleOT = mod;
      try {labelFromUI = XSBundle.getString("ORIGLabelOT");}
      catch (er) {}
    }
    else if (isORIG == "NT") {
      origModuleNT = mod;
      try {labelFromUI = XSBundle.getString("ORIGLabelNT");}
      catch (er) {}
    }
    
    label = (label != NOTFOUND ? label:mod);
    labelFromUI = (labelFromUI != NOTFOUND ? labelFromUI:null);
    
    // Save now for sorting after this loop is complete
    var amod = {mod:mod, type:type, label:label, labelFromUI:labelFromUI };
    modarray.push(amod);

  }
  
  // Set LanguageStudy prefs
  var defLang = LibSword.getModuleInformation(prefs.getCharPref("DefaultVersion"), "Lang");
  if (defLang == NOTFOUND) defLang = "";
  var defLangBase = (defLang ? defLang.replace(/-.*$/, ""):"");
  var lng = [ 
    new RegExp("^" + escapeRE(defLang) + "$", "i"), 
    new RegExp("^" + escapeRE(defLangBase) + "$", "i"), 
    new RegExp("^\\S+$", "i")
  ];
  
  for (var sls in SpecialModules.LanguageStudy) {
FindMod:
    for (var r=0; r<lng.length; r++) {
      var mods = SpecialModules.LanguageStudy[sls];
      for (var m=0; m<mods.length; m++) {
        if (lng[r].test(LibSword.getModuleInformation(mods[m], "Lang"))) {
          prefs.setCharPref("Selected" + sls, mods[m]);
          break FindMod;
        }
      }
    }
  }
 
  // Sort tabs...
  modarray = modarray.sort(tabOrder);
 
  var commonDir = getSpecialDirectory("xsModsCommon");
  commonDir.append(MODSD);

  // Create Global Tab and Tabs
  Tab.ORIG_OT = null;
  Tab.ORIG_NT = null;
  for (var m=0; m<modarray.length; m++) {
    mod   = modarray[m].mod;
    type  = modarray[m].type;
    label = modarray[m].label;
    labelFromUI = modarray[m].labelFromUI;
    
    var tab = {label:null, labelFromUI:null, modName:null, modType:null, tabType:null, isRTL:null, index:null,  
        description:null, conf:null, isCommDir:null};
    tab.label = label;
    tab.labelFromUI = labelFromUI;
    tab.modName = mod;
    tab.modType = type;
    
    // find .conf file. Try usual guesses first, then do a rote search if necessary
    tab.conf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    var p = LibSword.getModuleInformation(mod, "AbsoluteDataPath").replace(/[\\\/]/g, DIRSEP);
    p = p.replace(/[\\\/]modules[\\\/].*?$/, DIRSEP + "mods.d");
    tab.conf.initWithPath(p + DIRSEP + mod.toLowerCase() + ".conf");
    if (!tab.conf.exists()) {
      tab.conf.initWithPath(p + DIRSEP + mod + ".conf");
      if (!tab.conf.exists()) {
        var modRE = new RegExp("^\\[" + mod + "\\]");
        tab.conf.initWithPath(p);
        var files = tab.conf.directoryEntries;
        while (files.hasMoreElements()) {
          var file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
          var cdata = readFile(file);
          if (!(modRE.test(cdata))) continue;
          tab.conf = file;
          break;
        }
      }
    }
    if (!tab.conf.exists()) jsdump("WARNING: tab.conf bad path \"" + p + DIRSEP + mod.toLowerCase() + ".conf\"");
    
    tab.isCommDir = (tab.conf && tab.conf.path.toLowerCase().indexOf(commonDir.path.toLowerCase()) == 0 ? true:false);
    tab.tabType = getShortTypeFromLong(tab.modType);
    tab.isRTL = (ModuleConfigs[mod].direction == "rtl");
    tab.index = m;
    tab.description = LibSword.getModuleInformation(mod, "Description");
    tab.locName = (isASCII(tab.label) ? DEFAULTLOCALE:mod);
    
    // Save Global tab objects
    Tabs.push(tab);
    Tab[label] = tab;
    Tab[mod] = tab;
    if (origModuleOT && mod == origModuleOT) Tab.ORIG_OT = tab;
    if (origModuleNT && mod == origModuleNT) Tab.ORIG_NT = tab;
  }

//jsdump("StrongsGreek=" + SpecialModules.LanguageStudy.StrongsGreek + ", StrongsHebrew=" + SpecialModules.LanguageStudy.StrongsHebrew + ", Robinson=" + SpecialModules.LanguageStudy.Robinson);
  return true;
}


// Tabs are sorted by the following:
//    1) Type
//        a) Bibles
//        b) commentaries
//        c) general books
//        d) dictionaries
//    2) Priority
//        a) tabs matching program locale
//        b) other tabs with installed locale
//        c) remaining tabs
//        d) ORIG tab
//    3) Alphabetically
var ModuleTypeOrder = {}
ModuleTypeOrder[BIBLE] = 1;
ModuleTypeOrder[COMMENTARY] = 2;
ModuleTypeOrder[GENBOOK] = 3;
ModuleTypeOrder[DICTIONARY] = 4;
function tabOrder(a,b) {
  if (a.type == b.type) {
    // Tab type is the same.
    if (Tab.ORIG_NT && a.mod==Tab.ORIG_NT.modName) return 1;
    if (Tab.ORIG_NT && b.mod==Tab.ORIG_NT.modName) return -1;
    if (Tab.ORIG_OT && a.mod==Tab.ORIG_OT.modName) return 1;
    if (Tab.ORIG_OT && b.mod==Tab.ORIG_OT.modName) return -1;

    // Priority: 1) Modules matching current locale, 2) Other tabs that have
    // locales installed, 3) remaining tabs.
    var aLocale = ModuleConfigs[a.mod].AssociatedLocale;
    var bLocale = ModuleConfigs[b.mod].AssociatedLocale;
    var currentLocale = getLocale();
    var aPriority = (aLocale != NOTFOUND ? (aLocale==currentLocale ? 1:2):3);
    var bPriority = (bLocale != NOTFOUND ? (bLocale==currentLocale ? 1:2):3);
    if (aPriority != bPriority) return (aPriority > bPriority);
    // Type and Priority are same. Sort by label's alpha.
    return (a.label > b.label ? 1:-1);
  }
  else return (ModuleTypeOrder[a.type] > ModuleTypeOrder[b.type] ? 1:-1);
}


/************************************************************************
 * RUN ALL THE INITIALIZATION ROUTINES
 ***********************************************************************/ 

function xulswordInit() {

  var currentLocale = initLocales();
  if (!currentLocale) {
  
    // Present locale not valid? Change to DEFAULTLOCALE and restart.
    rootprefs.setCharPref("general.useragent.locale", DEFAULTLOCALE);
    var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                     .getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eForceQuit);
    return;
  }

  // log our locales
  var s = "";
  for (var l in LocaleConfigs) {s += l + "; ";}
  jsdump("Loaded locales:" + s);
    
  // Copy current locale's config to ProgramConfig.
  ProgramConfig = copyObj(LocaleConfigs[currentLocale]);
  ProgramConfig.StyleRule = createStyleRule(".cs-Program", ProgramConfig);
  ProgramConfig.TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(Program)", ProgramConfig);
  
  var defaultMod = NOTFOUND;
 
  if (initModules()) {
  
    initTabGlobals();

    // Assign default Bible from first Bible tab
    for (var t=0; t<Tabs.length; t++) {
      if (Tabs[t].modType == BIBLE) {defaultMod = Tabs[t].modName; break;}
    }
    
  }
  
  prefs.setCharPref("DefaultVersion", defaultMod);

  if (!LibSword.loadFailed) LibSword.unlock();
  
}
