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
 * Initialize global locale information
 ***********************************************************************/ 
 

var LocaleConfigs = {};
var ModuleConfigs = {};
var ProgramConfig = {};
var Tabs = [];
var Tab = {};
var LanguageStudyModules = {};
var Book = new Array(NumBooks);
var AllWindows = [];

// Global text objects defined in texts.js and -Texts.js files
var Texts;
var BibleTexts; 
var CommTexts; 
var DictTexts; 
var GenBookTexts;


/************************************************************************
 * GLOBAL Location
 ***********************************************************************/ 

var Location = {
  modname:null,
  modvsys:null,
  book:null,
  chapter:null,
  verse:null,
  lastverse:null,

  convertLocation: function(vsys1, xsref, vsys2) {
    var p = xsref.split(".");
    var vzero = false;
    if (p && (p.length==3 || p.length==4) && p[2]==0) {
      // libxulsword convertLocation was changed to always return valid
      // references (verse=0 is never returned any more). So the old 
      // behaviour is enforced here to keep xulsword happy.
      vzero = true;
      p[2] = 1;
      p[3] = 1;
      xsref = p.join(".");
    }
 
    var loc = Bible.convertLocation(vsys1, xsref, vsys2);
    if (!vzero) return loc;
    
    p = loc.split(".");
    p[2] = 0;
    p[3] = 0;
    return p.join(".");
  },
  
  setLocation: function(modname, xsref) {
    this.modname = modname;
    this.modvsys = Bible.getVerseSystem(modname);
/*    
    // dont highlight entire chapter unless specifically requested
    if ((/^[^\s\.]+\.\d+$/).test(xsref)) xsref += ".1.1";
*/ 
    var loc = this.convertLocation(this.modvsys, xsref, this.modvsys);
    var p = loc.split(".");

    this.book = p[0];
    this.chapter = p[1];
    this.verse = p[2];
    this.lastverse = p[3];

    return this.modvsys;
  },
  
  setVerse: function(modname, verse, lastverse) {
    var loc = this.getLocation(modname);
    var p = loc.split(".");
    var maxv = Bible.getMaxVerse(modname, loc);
    
    if (verse == -1 || verse > maxv) p[2] = maxv;
    else if (verse < 0) p[2] = 0;
    else p[2] = verse;
    
    if (lastverse == -1 || lastverse > maxv) p[3] = maxv;
    else if (lastverse < verse) p[3] = verse;
    else p[3] = lastverse;
  
    this.setLocation(modname, p.join("."));

    return this.modvsys;
  },
  
  getLocation: function(modname) {
    if (!this.modname) {setLocation(WESTERNVS, "Gen.1.1.1");}
    var r = this.convertLocation(Bible.getVerseSystem(this.modname), this.book + "." + this.chapter + "." + this.verse + "." + this.lastverse, Bible.getVerseSystem(modname));
    return r;
  },
  
  getChapter: function(modname) {
    var p = this.getLocation(modname).split(".");
    return p[0] + " " + p[1];
  },
    
  getBookName: function() {
    return this.getLocation(this.modname).split(".")[0];
  },

  getChapterNumber: function(modname) {
    return this.getLocation(modname).split(".")[1];
  },
  
  getVerseNumber: function(modname) {
    return this.getLocation(modname).split(".")[2];
  },
  
  getLastVerseNumber: function(modname) {
    return this.getLocation(modname).split(".")[3];
  }
};


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
  if (!Bible) return false;

  // Gets list of available modules
  var modules = Bible.getModuleList().split("<nx>");
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
    var xsversion = Bible.getModuleInformation(mod, VERSIONPAR);
    xsversion = (xsversion != NOTFOUND ? xsversion:MINVERSION);
    var modminxsvers;
    try {modminxsvers = prefs.getCharPref("MinXSMversion");} catch (er) {modminxsvers = MINVERSION;}
    if (comparator.compare(xsversion, modminxsvers) < 0) continue;
    var xminprogvers = Bible.getModuleInformation(mod, MINPVERPAR);
    xminprogvers = (xminprogvers != NOTFOUND ? xminprogvers:MINVERSION);
    if (comparator.compare(prefs.getCharPref("Version"), xminprogvers) < 0) continue;
    var xsengvers = Bible.getModuleInformation(mod, "MinimumVersion");
    xsengvers = (xsengvers!=NOTFOUND ? xsengvers:0);
    var enginevers; try {enginevers = prefs.getCharPref("EngineVersion");} catch (er) {enginevers = NOTFOUND;}
    if (enginevers != NOTFOUND && comparator.compare(enginevers, xsengvers) < 0) continue;
    
    // Language glossaries don't currently work (too big??) and so aren't supported.
    if (Bible.getModuleInformation(mod, "GlossaryFrom") != NOTFOUND) continue;
    
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
  
  if (!Bible) return null;
  
  for (var lc in LocaleConfigs) {
    var regex = new RegExp("(^|\s|,)+" + module + "(,|\s|$)+");
    if (LocaleConfigs[lc].AssociatedModules.match(regex)) myLocale = lc;
  }
  
  if (myLocale) return myLocale;
  
  for (lc in LocaleConfigs) {
    var lcs, ms;
    try {
      lcs = lc.toLowerCase();
      ms = Bible.getModuleInformation(module, "Lang").toLowerCase();
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
  if (!Bible) return false;
  
  var modlist = Bible.getModuleList();
  var modarray = [];
  var origModuleOT = null;
  var origModuleNT = null;

  for (var mod in ModuleConfigs) {
    var typeRE = new RegExp("(^|<nx>)" + mod + ";(.*?)(<nx>|$)");
    var type = modlist.match(typeRE)[2];
   
    if (type == DICTIONARY) {
    
      // Set Global dictionary module params
      var mlang = Bible.getModuleInformation(mod, "Lang");
      var mlangs = mlang.replace(/-.*$/, "");

      var feature = Bible.getModuleInformation(mod, "Feature");
      if (feature.search("DailyDevotion") != -1) {
        for (var w=1; w<=NW; w++) {
          setUnicodePref("DictKey_" + mod + "_" + w, "DailyDevotionToday");
        }
      }
      else if (feature.search("GreekDef") != -1)  {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.StrongsGreek) LanguageStudyModules.StrongsGreek = mod;
        LanguageStudyModules["StrongsGreek" + mlang] = mod;
        LanguageStudyModules["StrongsGreek" + mlangs] = mod;
      }
      else if (feature.search("HebrewDef") != -1) {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.StrongsHebrew) LanguageStudyModules.StrongsHebrew = mod;
        LanguageStudyModules["StrongsHebrew" + mlang] = mod;
        LanguageStudyModules["StrongsHebrew" + mlangs] = mod;
      }
      else if (feature.search("GreekParse") != -1) {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.GreekParse) LanguageStudyModules.GreekParse = mod;
        LanguageStudyModules["GreekParse" + mlang] = mod;
        LanguageStudyModules["GreekParse" + mlangs] = mod;
      }
    }
    
    // Get tab label
    var label = Bible.getModuleInformation(mod, "TabLabel");
    if (label == NOTFOUND) label = Bible.getModuleInformation(mod, "Abbreviation");
    
    // Set up Original tab Globals
    var isORIG = Bible.getModuleInformation(mod, "OriginalTabTestament");
    if (isORIG == "OT") {
      origModuleOT = mod;
      try {label = SBundle.getString("ORIGLabelOT");}
      catch (er) {}
    }
    else if (isORIG == "NT") {
      origModuleNT = mod;
      try {label = SBundle.getString("ORIGLabelNT");}
      catch (er) {}
    }
    
    label = (label != NOTFOUND ? label:mod);
    
    // Save now for sorting after this loop is complete
    var amod = {mod:mod, type:type, label:label};
    modarray.push(amod);

  }
 
   // Sort tabs...
  modarray = modarray.sort(tabOrder);
 
  // Get module source directory info
  var userConfFiles = {};
  var commConfFiles = {};
  var commonDir = getSpecialDirectory("xsModsCommon");
  getConfFiles(getSpecialDirectory("xsModsUser"), userConfFiles);
  getConfFiles(commonDir, commConfFiles);
  commonDir.append(MODSD);

  // Create Global Tab and Tabs
  Tab.ORIG_OT = null;
  Tab.ORIG_NT = null;
  for (var m=0; m<modarray.length; m++) {
    mod   = modarray[m].mod;
    type  = modarray[m].type;
    label = modarray[m].label;
    
    var tab = {label:null, modName:null, modType:null, tabType:null, isRTL:null, index:null, description:null, 
        conf:null, confModUnique:null, isCommDir:null};
    tab.label = label;
    tab.modName = mod;
    tab.modType = type;
    tab.confModUnique = true;
    tab.conf = commConfFiles[mod]; // Sword looks at common directory first...
    if (!tab.conf) tab.conf = userConfFiles[mod];
    else if (userConfFiles[mod]) tab.confModUnique = false;
    tab.isCommDir = (tab.conf && tab.conf.path.substring(0, tab.conf.path.lastIndexOf("\\")) == commonDir.path);
    tab.tabType = getShortTypeFromLong(tab.modType);
    tab.isRTL = (ModuleConfigs[mod].direction == "rtl");
    tab.index = m;
    tab.description = Bible.getModuleInformation(mod, "Description");
    tab.locName = (isASCII(tab.description) ? DEFAULTLOCALE:mod);
    
    // Save Global tab objects
    Tabs.push(tab);
    Tab[label] = tab;
    Tab[mod] = tab;
    if (origModuleOT && mod == origModuleOT) Tab.ORIG_OT = tab;
    if (origModuleNT && mod == origModuleNT) Tab.ORIG_NT = tab;
  }

//jsdump("StrongsGreek=" + LanguageStudyModules.StrongsGreek + ", StrongsHebrew=" + LanguageStudyModules.StrongsHebrew + ", Robinson=" + LanguageStudyModules.Robinson);
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

function getConfFiles(dir, aObj) {
  var aDir = dir.clone();
  aDir.append(MODSD);
  if (!aDir.exists()) return;
  var re = new RegExp(CONF_EXT + "$");
  var files = aDir.directoryEntries;
  while (files.hasMoreElements()) {
    var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (file.leafName.match(re)) {
      var mname = readParamFromConf(file, "ModuleName");
      if (mname) aObj[mname] = file;
    }
  }
}
  

/************************************************************************
 * INITIALIZE LOCALE BOOK NAMES
 ***********************************************************************/ 
function initBooks() {

  var allBooks = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", 
      "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", 
      "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", 
      "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", 
      "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Matt", "Mark", "Luke", 
      "John", "Acts", "Jas", "1Pet", "2Pet", "1John", "2John", "3John", 
      "Jude", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", 
      "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Rev"];
      
  var b = getCurrentLocaleBundle("books.properties");
  
  for (var i=0; i < NumBooks; i++) {
    Book[i] = new Object();
    Book[i].sName  = "";
    Book[i].bName  = "";
    Book[i].bNameL = "";
  }

  for (i=0; i < NumBooks; i++) {
  
    // implement book order from xulsword locale
    var x = Number(b.GetStringFromName(allBooks[i] + "i"));
    
    Book[x].sName = allBooks[i];
    
    var localName = b.GetStringFromName(Book[x].sName);
    Book[x].bName  = localName;
    Book[x].bNameL = localName;
    
  }
  
  // Search locale for long books names, and save them
  var strings = b.getSimpleEnumeration();
  while (strings.hasMoreElements()) {
    var s = strings.getNext();
    s = s.QueryInterface(Components.interfaces.nsIPropertyElement);
    var isLong = s.key.match(/Long(.*?)\s*$/);
    if (!isLong) continue;
    
    var bookNum = findBookNum(isLong[1]);
    if (bookNum == null) continue;
    
    Book[bookNum].bNameL = b.GetStringFromName(s.key);
  }
  
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
  
    // log our modules
    /*
    var s = "";
    for (var m in ModuleConfigs) {s += m + "; ";}
    jsdump("Loaded modules:" + s);
    */
    
    initTabGlobals();

    // Assign default Bible from first Bible tab
    for (var t=0; t<Tabs.length; t++) {
      if (Tabs[t].modType == BIBLE) {defaultMod = Tabs[t].modName; break;}
    }
    
  }
  
  prefs.setCharPref("DefaultVersion", defaultMod);
  
  initBooks();

  if (Bible && !Bible.unlock()) Bible=null;
  
}

xulswordInit();
