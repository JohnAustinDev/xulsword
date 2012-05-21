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
 

var RestartToChangeLocale;
var HaveValidLocale;
var Progvers = prefs.getCharPref("Version");
var Enginevers; try {Enginevers = prefs.getCharPref("EngineVersion");} catch (er) {Enginevers = NOTFOUND;}
var LocaleConfigs = {};
var VersionConfigs = {};
var StyleRules = [];
var LocaleDirectionEntity;
var LocaleDirectionChar;
var Tabs = [];
var Tab = {};
var Win = new Array(null, {}, {}, {});
var Book = new Array(NumBooks);
var OrigModuleNT;
var OrigModuleOT;
var HaveOriginalTab;
var LocaleList = [];
var LocaleDefaultVersion = [];
var AllWindows = [];

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

function initLocales() {
  LocaleList = [];
  var chromeRegService = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService();
	var toolkitChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIToolkitChromeRegistry);
	var availableLocales = toolkitChromeReg.getLocalesForPackage("xulsword");
	while(availableLocales.hasMore()) {
		var locale = availableLocales.getNext();
		LocaleList.push(locale);
	}
  jsdump("Loaded locales:" + LocaleList);
  var currentLocale = getLocale();

  var LocaleDefaultVersionString="";
  var sep = "";
  var currentLocaleIsValid=false;
  for (var lc=0; lc<LocaleList.length; lc++) {
    if (LocaleList[lc] == currentLocale) currentLocaleIsValid=true;
    var bundle = getLocaleBundle(LocaleList[lc], "config.properties");
    try {var defaultModule = bundle.GetStringFromName("DefaultModule");}
    catch (er) {defaultModule="none";}
    LocaleDefaultVersionString += sep + defaultModule;
    sep = ";";
    var localeConfig = {direction:"ltr", font:DefaultFont, fontSizeAdjust:null, lineHeight:null};
    if (bundle) {
      try {localeConfig.direction = bundle.GetStringFromName("Direction");} catch (er) {}
      try {localeConfig.font = bundle.GetStringFromName("Font");} catch (er) {}
      try {localeConfig.fontSizeAdjust = bundle.GetStringFromName("FontSizeAdjust");} catch (er) {}
      try {localeConfig.lineHeight = bundle.GetStringFromName("LineHeight");} catch (er) {}
    }
    LocaleConfigs[LocaleList[lc]] = localeConfig;
    StyleRules.push(getStyleRule(".vstyle" + LocaleList[lc], localeConfig));
  }
  localeConfig = {direction:"ltr", font:DefaultFont, fontSizeAdjust:null, lineHeight:null};
  StyleRules.push(getStyleRule(".vstyle" + "ASCII", localeConfig));
  
  LocaleDefaultVersion = LocaleDefaultVersionString.split(";");
//dump ("LocaleDefaultVersion:" + LocaleDefaultVersion + "\n");
    
  RestartToChangeLocale = false;
  if (!currentLocaleIsValid) {
    rootprefs.setCharPref("general.useragent.locale", LocaleList[0]);
    RestartToChangeLocale = true;
    jsdump("Current locale is not valid: " + LocaleList + " " + currentLocale + "\n");
    return false;
  }
  else  {
    rootprefs.setCharPref("general.useragent.locale", currentLocale);
    return true;
  }
}

HaveValidLocale = initLocales();
//jsdump("LocaleList:" + LocaleList + "\n");

/************************************************************************
 * Initialize program tabs and labels
 ***********************************************************************/  
//Get types, module names, and labels of all tabs.
//Tab labels are chosen using the following priority:
//  XXXXX-v2.12: 1 Tab label from the program locale
//  XXXXX-v2.12: 2 Tab label from a loaded locale which lists this module as its default
//  1 Tab label from .conf file's TabLabel entry
//  2 module name
var UserConfFiles = {};
var CommConfFiles = {};
var LanguageStudyModules = {};
function createTabs() {
  if (!Bible) return;
  // Gets list of available modules
  var moduleInfo = "";
  var modules = Bible.getModuleList().split("<nx>");
  for (var m=0; m<modules.length; m++) {
    var info = modules[m].split(";");
        
    // Weed out unsupported module types
    var supported=false;
    for each (var type in SupportedModuleTypes) {
      supported |= (info[1]==type);
      if (supported) break;
    }
    if (!supported) continue;
    
    // Weed out incompatible module versions. The module installer shouldn't 
    // allow bad mods, but this is just in case.
    var comparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
    var xsversion = Bible.getModuleInformation(info[0], VERSIONPAR);
    xsversion = (xsversion!=NOTFOUND ? xsversion:MINVERSION);
    var modminxsvers;
    try {modminxsvers = prefs.getCharPref("MinXSMversion");} catch (er) {modminxsvers = MINVERSION;}
    if (comparator.compare(xsversion, modminxsvers) < 0) continue;
    var xminprogvers = Bible.getModuleInformation(info[0], MINPVERPAR);
    xminprogvers = (xminprogvers!=NOTFOUND ? xminprogvers:MINVERSION);
    if (comparator.compare(Progvers, xminprogvers) < 0) continue;
    var xsengvers = Bible.getModuleInformation(info[0], "MinimumVersion");
    xsengvers = (xsengvers!=NOTFOUND ? xsengvers:0);
    if (Enginevers != NOTFOUND && comparator.compare(Enginevers, xsengvers) < 0) continue;
    
    //Use this opportunity to init the StyleRules and version configs...
    var versionConfig = {direction:"ltr", font:DefaultFont, fontSizeAdjust:null, lineHeight:null};
    var dir = Bible.getModuleInformation(info[0], "Direction");
    var font = Bible.getModuleInformation(info[0], "Font")
    var fontSA = Bible.getModuleInformation(info[0], "FontSizeAdjust");
    var fontLH = Bible.getModuleInformation(info[0], "LineHeight");
    var mlang = Bible.getModuleInformation(info[0], "Lang");
    var mlangs = mlang.replace(/-.*$/, "");
    if (dir.search("RtoL","i")!=-1) versionConfig.direction = "rtl";
    if (font != NOTFOUND) versionConfig.font = font;
    if (fontSA != NOTFOUND) versionConfig.fontSizeAdjust = fontSA;
    if (fontLH != NOTFOUND) versionConfig.lineHeight = fontLH;
    VersionConfigs[info[0]] = versionConfig;
    StyleRules.push(getStyleRule(".vstyle" + info[0], versionConfig));

    // Language glossaries don't currently work (too big??) and so aren't supported.
    if (Bible.getModuleInformation(info[0], "GlossaryFrom") != NOTFOUND) continue;
    if (type == DICTIONARY) {
      var feature = Bible.getModuleInformation(info[0], "Feature");
      if (feature.search("DailyDevotion")!=-1) {
        prefs.setCharPref("ShowingKey" + info[0], "DailyDevotionToday");
      }
      else if (feature.search("GreekDef")!=-1)  {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.StrongsGreek) LanguageStudyModules.StrongsGreek = info[0];
        LanguageStudyModules["StrongsGreek" + mlang] = info[0];
        LanguageStudyModules["StrongsGreek" + mlangs] = info[0];
      }
      else if (feature.search("HebrewDef")!=-1) {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.StrongsHebrew) LanguageStudyModules.StrongsHebrew = info[0];
        LanguageStudyModules["StrongsHebrew" + mlang] = info[0];
        LanguageStudyModules["StrongsHebrew" + mlangs] = info[0];
      }
      else if (feature.search("GreekParse")!=-1) {
        if (mlang.match(/^ru/i) || !LanguageStudyModules.GreekParse) LanguageStudyModules.GreekParse = info[0];
        LanguageStudyModules["GreekParse" + mlang] = info[0];
        LanguageStudyModules["GreekParse" + mlangs] = info[0];
      }
    }
    //dump(m + " " + info[0] + " " + info[1] + "\n");
    var moduleLabel = Bible.getModuleInformation(info[0], "TabLabel");
    if (moduleLabel == NOTFOUND) moduleLabel = Bible.getModuleInformation(info[0], "Abbreviation");
    var isORIG = Bible.getModuleInformation(info[0], "OriginalTabTestament");
    if (isORIG=="OT") {
      OrigModuleOT = info[0];
      HaveOriginalTab=true;
      try {moduleLabel = SBundle.getString("ORIGLabelOT");}
      catch (er) {}
    }
    else if (isORIG=="NT") {
      OrigModuleNT = info[0];
      HaveOriginalTab=true;
      try {moduleLabel = SBundle.getString("ORIGLabelNT");}
      catch (er) {}
    }
    moduleInfo += info[1] + ";";
    moduleInfo += info[0] + ";";
    moduleInfo += (moduleLabel!=NOTFOUND ? moduleLabel:info[0]) + "<nx>";
  }
  
  //Finish the StyleRules init...
  StyleRules.push(getStyleRule(".vstyleProgram", LocaleConfigs[getLocale()], false, true));
  
  
  moduleInfo = moduleInfo.split("<nx>");
  moduleInfo.pop();
  
  // Add ORIG tab if needed...
  if (HaveOriginalTab && SBundle) {
    moduleInfo.push(getModuleLongType(ORIGINAL) + ";" + ORIGINAL + ";" + SBundle.getString("ORIGLabelTab"));
  }
  else {for (var w=1; w<=3; w++) {prefs.setBoolPref("ShowOriginal" + w, false);}}
 
   // Sort tabs...
  moduleInfo = moduleInfo.sort(tabOrder);
 
  var commonDir = getSpecialDirectory("xsModsCommon");
  getConfFiles(getSpecialDirectory("xsModsUser"), UserConfFiles);
  getConfFiles(commonDir, CommConfFiles);
  commonDir.append(MODSD);

  // Create global arrays
  for (m=0; m<moduleInfo.length; m++) {
    info = moduleInfo[m].split(";");
    
    var tab = {label:null, modName:null, modType:null, tabType:null, vstyle:null, isRTL:null, isOrigTab:null, index:null};
    tab.label = info[2];
    tab.modName = info[1];
    tab.modType = info[0];
    tab.confModUnique = true;
    tab.conf = CommConfFiles[info[1]]; // Sword looks at common directory first...
    if (!tab.conf) tab.conf = UserConfFiles[info[1]];
    else if (UserConfFiles[info[1]]) tab.confModUnique = false;
    tab.isCommDir = (tab.conf && tab.conf.path.substring(0, tab.conf.path.lastIndexOf("\\")) == commonDir.path);
    tab.tabType = getShortTypeFromLong(tab.modType);
    try {var isOT = (tab.label==SBundle.getString("ORIGLabelOT"));}
    catch (er) {isOT = false;}
    try {var isNT = (tab.label==SBundle.getString("ORIGLabelNT"));}
    catch (er) {isNT = false;}
    tab.vstyle = (tab.modName==ORIGINAL || isOT || isNT ? "program":tab.modName);
    tab.isRTL = (VersionConfigs[tab.vstyle] && VersionConfigs[tab.vstyle].direction == "rtl");
    tab.isOrigTab = (tab.modName==ORIGINAL);
    tab.index = m;
    tab.description = Bible.getModuleInformation(info[1], "Description");
    Tabs.push(tab);
    Tab[tab.label] = tab;
    Tab[tab.modName] = tab;
  }

//jsdump("StrongsGreek=" + LanguageStudyModules.StrongsGreek + ", StrongsHebrew=" + LanguageStudyModules.StrongsHebrew + ", Robinson=" + LanguageStudyModules.Robinson);
}

if (HaveValidLocale) createTabs();

//Use first BIBLE tab or "none" if not found.
for (var t=0; t<Tabs.length; t++) {
  if (Tabs[t].modType==BIBLE && !Tabs[t].isOrigTab) {var defaultMod=Tabs[t].modName; break;}
}
prefs.setCharPref("DefaultVersion", (defaultMod ? defaultMod:"none"));

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
function tabOrder(a,b) {
  // First sort by tap type
  var moduleTypeOrder = {};
  moduleTypeOrder[BIBLE] = 1;
  moduleTypeOrder[COMMENTARY] = 2;
  moduleTypeOrder[GENBOOK] = 3;
  moduleTypeOrder[DICTIONARY] = 4;
  var infoA = a.split(";");
  var infoB = b.split(";");
  if (infoA[0] == infoB[0]) {
    // Tab type is the same.
    // Always put original tab last.
    if (infoA[1]==ORIGINAL) return 1;
    if (infoB[1]==ORIGINAL) return -1;
    if (OrigModuleNT && infoA[1]==OrigModuleNT) return 1;
    if (OrigModuleNT && infoB[1]==OrigModuleNT) return -1;
    if (OrigModuleOT && infoA[1]==OrigModuleOT) return 1;
    if (OrigModuleOT && infoB[1]==OrigModuleOT) return -1;

    // Priority: 1) Modules matching current locale, 2) Other tabs that have
    // locales installed, 3) remaining tabs.
    var aLocale = getLocaleOfModule(infoA[1]);
    var bLocale = getLocaleOfModule(infoB[1]);
    var currentLocale = getLocale();
    var aPriority = (aLocale ? (aLocale==currentLocale ? 1:2):3);
    var bPriority = (bLocale ? (bLocale==currentLocale ? 1:2):3);
    if (aPriority!=bPriority) return (aPriority > bPriority);
    // Type and Priority are same. Sort by label's alpha.
    return (infoA[2] > infoB[2] ? 1:-1);
  }
  else return (moduleTypeOrder[infoA[0]] > moduleTypeOrder[infoB[0]] ? 1:-1);
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
 * Initialize Locale Book Names
 ***********************************************************************/ 
function initBooks() {
  for (var b=0; b < NumBooks; b++) {
    Book[b] = new Object();
    Book[b].sName = "";
    Book[b].bName = "";
    Book[b].numChaps = 0;
  }

  var bundle = getCurrentLocaleBundle("books.properties");

Book[Number(bundle.GetStringFromName("Geni"))].sName = "Gen";
Book[Number(bundle.GetStringFromName("Geni"))].numChaps = 50;

Book[Number(bundle.GetStringFromName("Exodi"))].sName = "Exod";
Book[Number(bundle.GetStringFromName("Exodi"))].numChaps = 40;

Book[Number(bundle.GetStringFromName("Levi"))].sName = "Lev";
Book[Number(bundle.GetStringFromName("Levi"))].numChaps = 27;

Book[Number(bundle.GetStringFromName("Numi"))].sName = "Num";
Book[Number(bundle.GetStringFromName("Numi"))].numChaps = 36;

Book[Number(bundle.GetStringFromName("Deuti"))].sName = "Deut";
Book[Number(bundle.GetStringFromName("Deuti"))].numChaps = 34;

Book[Number(bundle.GetStringFromName("Joshi"))].sName = "Josh";
Book[Number(bundle.GetStringFromName("Joshi"))].numChaps = 24;

Book[Number(bundle.GetStringFromName("Judgi"))].sName = "Judg";
Book[Number(bundle.GetStringFromName("Judgi"))].numChaps = 21;

Book[Number(bundle.GetStringFromName("Ruthi"))].sName = "Ruth";
Book[Number(bundle.GetStringFromName("Ruthi"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("1Sami"))].sName = "1Sam";
Book[Number(bundle.GetStringFromName("1Sami"))].numChaps = 31;

Book[Number(bundle.GetStringFromName("2Sami"))].sName = "2Sam";
Book[Number(bundle.GetStringFromName("2Sami"))].numChaps = 24;

Book[Number(bundle.GetStringFromName("1Kgsi"))].sName = "1Kgs";
Book[Number(bundle.GetStringFromName("1Kgsi"))].numChaps = 22;

Book[Number(bundle.GetStringFromName("2Kgsi"))].sName = "2Kgs";
Book[Number(bundle.GetStringFromName("2Kgsi"))].numChaps = 25;

Book[Number(bundle.GetStringFromName("1Chri"))].sName = "1Chr";
Book[Number(bundle.GetStringFromName("1Chri"))].numChaps = 29;

Book[Number(bundle.GetStringFromName("2Chri"))].sName = "2Chr";
Book[Number(bundle.GetStringFromName("2Chri"))].numChaps = 36;

Book[Number(bundle.GetStringFromName("Ezrai"))].sName = "Ezra";
Book[Number(bundle.GetStringFromName("Ezrai"))].numChaps = 10;

Book[Number(bundle.GetStringFromName("Nehi"))].sName = "Neh";
Book[Number(bundle.GetStringFromName("Nehi"))].numChaps = 13;

Book[Number(bundle.GetStringFromName("Esthi"))].sName = "Esth";
Book[Number(bundle.GetStringFromName("Esthi"))].numChaps = 10;

Book[Number(bundle.GetStringFromName("Jobi"))].sName = "Job";
Book[Number(bundle.GetStringFromName("Jobi"))].numChaps = 42;

Book[Number(bundle.GetStringFromName("Psi"))].sName = "Ps";
Book[Number(bundle.GetStringFromName("Psi"))].numChaps = 150;

Book[Number(bundle.GetStringFromName("Provi"))].sName = "Prov";
Book[Number(bundle.GetStringFromName("Provi"))].numChaps = 31;

Book[Number(bundle.GetStringFromName("Eccli"))].sName = "Eccl";
Book[Number(bundle.GetStringFromName("Eccli"))].numChaps = 12;

Book[Number(bundle.GetStringFromName("Songi"))].sName = "Song";
Book[Number(bundle.GetStringFromName("Songi"))].numChaps = 8;

Book[Number(bundle.GetStringFromName("Isai"))].sName = "Isa";
Book[Number(bundle.GetStringFromName("Isai"))].numChaps = 66;

Book[Number(bundle.GetStringFromName("Jeri"))].sName = "Jer";
Book[Number(bundle.GetStringFromName("Jeri"))].numChaps = 52;

Book[Number(bundle.GetStringFromName("Lami"))].sName = "Lam";
Book[Number(bundle.GetStringFromName("Lami"))].numChaps = 5;

Book[Number(bundle.GetStringFromName("Ezeki"))].sName = "Ezek";
Book[Number(bundle.GetStringFromName("Ezeki"))].numChaps = 48;

Book[Number(bundle.GetStringFromName("Dani"))].sName = "Dan";
Book[Number(bundle.GetStringFromName("Dani"))].numChaps = 12;

Book[Number(bundle.GetStringFromName("Hosi"))].sName = "Hos";
Book[Number(bundle.GetStringFromName("Hosi"))].numChaps = 14;

Book[Number(bundle.GetStringFromName("Joeli"))].sName = "Joel";
Book[Number(bundle.GetStringFromName("Joeli"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("Amosi"))].sName = "Amos";
Book[Number(bundle.GetStringFromName("Amosi"))].numChaps = 9;

Book[Number(bundle.GetStringFromName("Obadi"))].sName = "Obad";
Book[Number(bundle.GetStringFromName("Obadi"))].numChaps = 1;

Book[Number(bundle.GetStringFromName("Jonahi"))].sName = "Jonah";
Book[Number(bundle.GetStringFromName("Jonahi"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("Mici"))].sName = "Mic";
Book[Number(bundle.GetStringFromName("Mici"))].numChaps = 7;

Book[Number(bundle.GetStringFromName("Nahi"))].sName = "Nah";
Book[Number(bundle.GetStringFromName("Nahi"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("Habi"))].sName = "Hab";
Book[Number(bundle.GetStringFromName("Habi"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("Zephi"))].sName = "Zeph";
Book[Number(bundle.GetStringFromName("Zephi"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("Hagi"))].sName = "Hag";
Book[Number(bundle.GetStringFromName("Hagi"))].numChaps = 2;

Book[Number(bundle.GetStringFromName("Zechi"))].sName = "Zech";
Book[Number(bundle.GetStringFromName("Zechi"))].numChaps = 14;

Book[Number(bundle.GetStringFromName("Mali"))].sName = "Mal";
Book[Number(bundle.GetStringFromName("Mali"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("Matti"))].sName = "Matt";
Book[Number(bundle.GetStringFromName("Matti"))].numChaps = 28;

Book[Number(bundle.GetStringFromName("Marki"))].sName = "Mark";
Book[Number(bundle.GetStringFromName("Marki"))].numChaps = 16;

Book[Number(bundle.GetStringFromName("Lukei"))].sName = "Luke";
Book[Number(bundle.GetStringFromName("Lukei"))].numChaps = 24;

Book[Number(bundle.GetStringFromName("Johni"))].sName = "John";
Book[Number(bundle.GetStringFromName("Johni"))].numChaps = 21;

Book[Number(bundle.GetStringFromName("Actsi"))].sName = "Acts";
Book[Number(bundle.GetStringFromName("Actsi"))].numChaps = 28;

Book[Number(bundle.GetStringFromName("Jasi"))].sName = "Jas";
Book[Number(bundle.GetStringFromName("Jasi"))].numChaps = 5;

Book[Number(bundle.GetStringFromName("1Peti"))].sName = "1Pet";
Book[Number(bundle.GetStringFromName("1Peti"))].numChaps = 5;

Book[Number(bundle.GetStringFromName("2Peti"))].sName = "2Pet";
Book[Number(bundle.GetStringFromName("2Peti"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("1Johni"))].sName = "1John";
Book[Number(bundle.GetStringFromName("1Johni"))].numChaps = 5;

Book[Number(bundle.GetStringFromName("2Johni"))].sName = "2John";
Book[Number(bundle.GetStringFromName("2Johni"))].numChaps = 1;

Book[Number(bundle.GetStringFromName("3Johni"))].sName = "3John";
Book[Number(bundle.GetStringFromName("3Johni"))].numChaps = 1;

Book[Number(bundle.GetStringFromName("Judei"))].sName = "Jude";
Book[Number(bundle.GetStringFromName("Judei"))].numChaps = 1;

Book[Number(bundle.GetStringFromName("Romi"))].sName = "Rom";
Book[Number(bundle.GetStringFromName("Romi"))].numChaps = 16;

Book[Number(bundle.GetStringFromName("1Cori"))].sName = "1Cor";
Book[Number(bundle.GetStringFromName("1Cori"))].numChaps = 16;

Book[Number(bundle.GetStringFromName("2Cori"))].sName = "2Cor";
Book[Number(bundle.GetStringFromName("2Cori"))].numChaps = 13;

Book[Number(bundle.GetStringFromName("Gali"))].sName = "Gal";
Book[Number(bundle.GetStringFromName("Gali"))].numChaps = 6;

Book[Number(bundle.GetStringFromName("Ephi"))].sName = "Eph";
Book[Number(bundle.GetStringFromName("Ephi"))].numChaps = 6;

Book[Number(bundle.GetStringFromName("Phili"))].sName = "Phil";
Book[Number(bundle.GetStringFromName("Phili"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("Coli"))].sName = "Col";
Book[Number(bundle.GetStringFromName("Coli"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("1Thessi"))].sName = "1Thess";
Book[Number(bundle.GetStringFromName("1Thessi"))].numChaps = 5;

Book[Number(bundle.GetStringFromName("2Thessi"))].sName = "2Thess";
Book[Number(bundle.GetStringFromName("2Thessi"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("1Timi"))].sName = "1Tim";
Book[Number(bundle.GetStringFromName("1Timi"))].numChaps = 6;

Book[Number(bundle.GetStringFromName("2Timi"))].sName = "2Tim";
Book[Number(bundle.GetStringFromName("2Timi"))].numChaps = 4;

Book[Number(bundle.GetStringFromName("Titusi"))].sName = "Titus";
Book[Number(bundle.GetStringFromName("Titusi"))].numChaps = 3;

Book[Number(bundle.GetStringFromName("Phlmi"))].sName = "Phlm";
Book[Number(bundle.GetStringFromName("Phlmi"))].numChaps = 1;

Book[Number(bundle.GetStringFromName("Hebi"))].sName = "Heb";
Book[Number(bundle.GetStringFromName("Hebi"))].numChaps = 13;

Book[Number(bundle.GetStringFromName("Revi"))].sName = "Rev";
Book[Number(bundle.GetStringFromName("Revi"))].numChaps = 22;

  for (var b=0; b < NumBooks; b++) {
    Book[b].bName  = bundle.GetStringFromName(Book[b].sName);
    Book[b].bNameL = bundle.GetStringFromName(Book[b].sName);
  }
}

function initLongNames() {
  var myLocale = getLocale();
  var bundle = getLocaleBundle(myLocale, "books.properties");
  if (myLocale && bundle) {
    var strings = bundle.getSimpleEnumeration();
    while (strings.hasMoreElements()) {
      var string = strings.getNext();
      string = string.QueryInterface(Components.interfaces.nsIPropertyElement);
      var key = string.key;
      var isLong = key.match(/Long(.*?)\s*$/);
      if (!isLong) continue;
      var bookNum = findBookNum(isLong[1]);
      if (bookNum == null) continue;
      Book[bookNum].bNameL = bundle.GetStringFromName(key);
    }
  }
}

LocaleDirectionEntity = "&rlm;";
if (HaveValidLocale) {
  LocaleDirectionEntity = ((LocaleConfigs[getLocale()].direction && 
                        LocaleConfigs[getLocale()].direction=="rtl") ? "&rlm;":"&lrm;");
}
LocaleDirectionChar = (guiDirection=="rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));

initBooks();
initLongNames();

if (!Bible.unlock()) Bible=null;
