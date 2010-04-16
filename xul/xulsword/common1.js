/*  This file is part of Muqaddas Kitob.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    Muqaddas Kitob is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    Muqaddas Kitob is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Muqaddas Kitob.  If not, see <http://www.gnu.org/licenses/>.
*/


// VAR AND FUNCTION DECLARATIONS WHICH MAY BE USED BY ALL XUL AND HTML DOCUMENTS

function getRunDirectory() {
  var runDirectory = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("resource:app", Components.interfaces.nsIFile);
  var path = runDirectory.path;
  // encodeURI creates windows readable path for utf8 chars
  if (runDirectory.exists()) return encodeURI(runDirectory.path).replace(/%5C/g, "/");
  else return null;
}

/************************************************************************
 * String Bundle used for script locality
 ***********************************************************************/  
var WindowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
var MainWindow = WindowWatcher.getWindowByName("main-window", window);
if (!MainWindow) MainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow);
if (!MainWindow) jsdump("WARNING: Unable to initialize MainWindow: (" + window.name + ")\n");
var SBundle;
try {SBundle = MainWindow.document.getElementById("strings");}
catch (er) {}
if (!SBundle) jsdump("WARNING: Unable to initialize string SBundle: (" + window.name + " " + MainWindow.name + ")\n");

// This function is needed because window titles are NOT Unicode and so must fit into the operating system's code-page
function fixWindowTitle(title) {
  if (!title) return "";
  
  // Uzbek chars
  title = title.replace(String.fromCharCode(1202),String.fromCharCode(1061),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1203),String.fromCharCode(1093),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1178),String.fromCharCode(1050),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1179),String.fromCharCode(1082),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1170),String.fromCharCode(1043),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1171),String.fromCharCode(1075),"gm"); //? to ?
  
  // Kyrgyz chars
  title = title.replace(String.fromCharCode(2626),String.fromCharCode(205),"gm"); //? to ?
  title = title.replace(String.fromCharCode(2627),String.fromCharCode(237),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1198),"Y","gm"); //? to ?
  title = title.replace(String.fromCharCode(1199),"v","gm"); //? to ?
  title = title.replace(String.fromCharCode(1256),String.fromCharCode(206),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1257),String.fromCharCode(238),"gm"); //? to ?  
  
  // remove Unicode directional chars
  title = title.replace(String.fromCharCode(8207), "", "gm");
  title = title.replace(String.fromCharCode(8206), "", "gm");
  
  // The ? chars seem to be in the 1251 code page and so aren't included
  //title = title.replace(String.fromCharCode(1038),String.fromCharCode(1059),"gm"); //? to ?
  //title = title.replace(String.fromCharCode(1118),String.fromCharCode(1091),"gm"); //? to ?
  return title;
}

// This was added to allow backward compatibility <2.12 while also allowing unique terms
// to be used for window titles (since Windows can't display window titles in necessary fonts).
function getWindowTitle(term) {
  var title;
  try {title = SBundle.getString(term + ".window.title");} catch (er) {title=null;}
  if (!title) title = document.getElementById(term).childNodes[0].nodeValue;
  return title; 
}


/************************************************************************
 * Create Bible Instance, Versions, Tabs and their globals
 ***********************************************************************/ 
var Bible;
if (!UseBibleObjectFrom) {
  Bible = Components.classes["@xulsword.com/xulsword/xulsword;1"].createInstance(Components.interfaces.ixulsword);
  var mlist = Bible.getModuleList();
  if (mlist == "No Modules" || mlist.search(BIBLE)==-1) Bible=null;
}

var SupportedModuleTypes = {
  Texts: BIBLE, 
  Comms: COMMENTARY, 
  Dicts: DICTIONARY, 
  Genbks: GENBOOK
  };
  
var GlobalToggleCommands = {
  cmd_xs_toggleHeadings:   "Headings",
  cmd_xs_toggleFootnotes:  "Footnotes",
  cmd_xs_toggleCrossRefs:  "Cross-references",
  cmd_xs_toggleDictionary: "Dictionary",
  cmd_xs_toggleStrongsTags: "Strong's Numbers",
  cmd_xs_toggleMorphTags: "Morphological Tags",
  cmd_xs_toggleVerseNums:  "Verse Numbers",
  cmd_xs_toggleUserNotes:  "User Notes",
  cmd_xs_toggleHebrewCantillation:  "Hebrew Cantillation",
  cmd_xs_toggleHebrewVowelPoints:   "Hebrew Vowel Points",
  cmd_xs_toggleRedWords:  "Words of Christ in Red"
};
    
var NumBooks=66;
var NumOT=39;
var NumNT=27;
var Book = new Array(NumBooks);

var HaveOriginalTab;
var OrigModuleNT;
var OrigModuleOT;

var TabLongType = [];
var TabVers = [];
var TabLabel = [];
var Tabs = [];

var LocaleList = [];
var LocaleDefaultVersion = [];

var LocaleDirectionEntity;
var LocaleDirectionChar;


/************************************************************************
 * Unlock all texts
 ***********************************************************************/ 

var CheckTexts = [];
function unlockAllModules(aBible, print) {
  var dumpMsg="";
  for (var t=0; t<TabVers.length; t++) {
    if (TabVers[t] == ORIGINAL) continue;
    if (TabLongType[t] != BIBLE) continue; // only Bible modules are encrypted
    var retkey = unlockModule(aBible, TabVers[t]);
    if (retkey) dumpMsg += TabVers[t] + "(" + retkey + ") ";
  }
  if (print && dumpMsg != "") {jsdump("Opening:" + dumpMsg + "\n");}
}

function unlockModule(myBible, version) {
  // If key is specified in conf file, don't do anything.
  if (myBible.getModuleInformation(version, "CipherKey")) return null;
  try {var mykey = getPrefOrCreate("CipherKey" + version, "Char", prefs.getCharPref("DefaultCK"));}
  catch (er) {mykey="0";}
  var useSecurityModule = usesSecurityModule(myBible, version);
  myBible.setCipherKey(version, mykey, useSecurityModule);
  if (!useSecurityModule) CheckTexts.push(version);
  return mykey
}

function usesSecurityModule(aXSobj, version) {
  if (aXSobj.getModuleInformation(version, "CipherKey") != "") return false;
  //checking "ProducedFor" is for backward compatibility to modules before version 2.7
  var usesSecurityModule = ((aXSobj.getModuleInformation(version, MainWindow.VERSIONPAR)!=NOTFOUND || 
      aXSobj.getModuleInformation(version, "ProducedFor")=="xulsword") ? true:false);
  return usesSecurityModule;
}

/************************************************************************
 * Style Globals
 ***********************************************************************/ 
var ScriptBoxFontColor;
var ScriptBoxTextCSS;
var SelectedBookBackground;
var PointedBookBackground;
var ChooserLeftMargin;
var SelectedVerseCSS;
var SelectedVerseColor;
//var BookNameCSS;
var ChooserBookButtonHeight;
var NormalBookBackground;
//var ChooserFontSize;
//var TestHeadingCSS;
//var TestHeadingFontSize;
var ChapterArrowCSS;
var InitialCssFontSize = [];
var CssRuleHavingFontSize = [];
var DefaultFont = "Arial";
var DefaultFontSizeAdjust = "0.55";
var DefaultVersionLineHeight = "135%";
var DefaultLocaleLineHeight = "100%";

function getCSS(searchText, styleSheetNumber) {
  if (!styleSheetNumber) styleSheetNumber=0;
  searchText = new RegExp("^" + escapeRE(searchText));
  for (var z=0; z!=document.styleSheets[styleSheetNumber].cssRules.length; z++) {
    var myRule = document.styleSheets[styleSheetNumber].cssRules[z];
    if (myRule.cssText.search(searchText) != -1) return myRule;
  }
  return null;
}

var StyleRules = [];
function createVersionClasses(sheetNum) {
  var sheet = document.styleSheets[sheetNum];
  if (!sheet) return;
  var sheetLength = sheet.cssRules.length;
  for (var r=0; r<StyleRules.length; r++) {
    sheet.insertRule(StyleRules[r], sheetLength);
  }
}

function getStyleRule(selector, config, notImportant, sizeNotImportant) {
  var importance = (notImportant ? "":" !important");
  var font = "font-family:\"" + (config && config.font ? config.font:DefaultFont) + "\"" + importance + "; ";
  var direction = "direction:" + (config && config.direction ? config.direction:"ltr") + importance + "; ";
  importance = (notImportant || sizeNotImportant ? "":" !important");
  var fontSizeAdjust = "font-size-adjust:" + (config && config.fontSizeAdjust ? config.fontSizeAdjust:DefaultFontSizeAdjust) + importance + "; ";
  var lineHeight = "line-height:" + (config && config.lineHeight ? config.lineHeight:DefaultVersionLineHeight) + importance + "; ";
  return selector + " {" + direction + font + fontSizeAdjust + lineHeight + " }";
}

function updateCSSBasedOnVersion(version, cssRuleNameArray, styleSheetNumber) {
  if (!styleSheetNumber) styleSheetNumber=0;
  var versionConfig = VersionConfigs[version];
  var rules = [];
  for (var i=0; i<cssRuleNameArray.length; i++) {
    var thisRule = getCSS(cssRuleNameArray[i], styleSheetNumber);
    if (thisRule) {
      thisRule.style.fontFamily = (versionConfig && versionConfig.font ? "\"" + versionConfig.font + "\"":"\"" + DefaultFont + "\"");
      thisRule.style.direction = (versionConfig && versionConfig.direction ? versionConfig.direction:"ltr");
      thisRule.style.fontSizeAdjust = (versionConfig && versionConfig.fontSizeAdjust ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust);
      thisRule.style.lineHeight = (versionConfig && versionConfig.lineHeight ? versionConfig.lineHeight:DefaultVersionLineHeight);
    }
    else {
      var sheet = document.styleSheets[styleSheetNumber];
      sheet.insertRule(getStyleRule(cssRuleNameArray[i], versionConfig), sheet.cssRules.length);
    }
  }
}

// Adjusts rtl related styles for listed CSS rules or creates the rule if it doesn't exist
function updateCSSBasedOnCurrentLocale(cssRuleNameArray, styleSheetNumber) {
  if (!styleSheetNumber) styleSheetNumber=0;
  var currentLocale = rootprefs.getCharPref("general.useragent.locale");
  var localeConfig = LocaleConfigs[currentLocale];
  for (var i=0; i<cssRuleNameArray.length; i++) {
    var thisRule = getCSS(cssRuleNameArray[i], styleSheetNumber);
    if (thisRule) {
      thisRule.style.fontFamily = (localeConfig && localeConfig.font ? "\"" + localeConfig.font + "\"":"\"" + DefaultFont + "\"");
      thisRule.style.direction = (localeConfig && localeConfig.direction ? localeConfig.direction:"ltr");
      if (!thisRule.style.fontSizeAdjust) 
          thisRule.style.fontSizeAdjust = (localeConfig && localeConfig.fontSizeAdjust ? localeConfig.fontSizeAdjust:DefaultFontSizeAdjust);
      if (!thisRule.style.lineHeight)
          thisRule.style.lineHeight = (localeConfig && localeConfig.lineHeight ? localeConfig.lineHeight:DefaultLocaleLineHeight);    
      if (localeConfig && localeConfig.direction && localeConfig.direction == "rtl") {
        if (thisRule.style.cssText.search("float: left") == -1) thisRule.style.cssText = thisRule.style.cssText.replace("float: right", "float: left");
        else thisRule.style.cssText = thisRule.style.cssText.replace("float: left", "float: right");
      }
    }
    else {
      var sheet = document.styleSheets[styleSheetNumber];
      sheet.insertRule(getStyleRule(cssRuleNameArray[i], localeConfig, true), sheet.cssRules.length);
    }
  }
}

var LocaleConfigs = {};
var VersionConfigs = {};

function getLocaleOfVersion(version) {
  var myLocale=null;
  for (var lc=0; lc<LocaleDefaultVersion.length; lc++) {
    var regex = new RegExp("(^|\s|,)+" + version + "(,|\s|$)+");
    if (LocaleDefaultVersion[lc] && LocaleDefaultVersion[lc].match(regex)) myLocale = LocaleList[lc];
  }
  return myLocale;
}

function getVersionOfLocale(alocale) {
  if (!alocale) alocale = rootprefs.getCharPref("general.useragent.locale");
  for (var i=0; i<LocaleList.length; i++) {
    if (LocaleList[i] == alocale) return LocaleDefaultVersion[i];
  }
  return "none";
}

function initializeStyleGlobals(sheetNum) {
  if (!document.styleSheets[sheetNum]) return;
  //Save to global variables the CSS initial values of those things which may be programatically changed
  for (var z=0; z<document.styleSheets[sheetNum].cssRules.length; z++) {
    var myRule = document.styleSheets[sheetNum].cssRules[z];
    switch (myRule.cssText.match(/^(.*?) /)[1]) {
    case ".scriptbox": ScriptBoxFontColor = myRule.style.color; break;  
    case ".scriptboxtext": ScriptBoxTextCSS = myRule; break;
    case ".booknameshowing": SelectedBookBackground = myRule.style.background; break;
    case ".booknamepoint": PointedBookBackground = myRule.style.background; break;
    case ".testamentchooser": ChooserLeftMargin = Number(myRule.style.left.match(/(\d+)/)[1]); break;  
    case ".hl":
      //Save the CSS hl color for future use
      SelectedVerseCSS = myRule;
      SelectedVerseColor = myRule.style.color;
      break;
    case ".bookname":
      //BookNameCSS = myRule;
      NormalBookBackground = myRule.style.background;
      ChooserBookButtonHeight = Number(myRule.style.height.match(/(\d+)/)[1]);
      //ChooserFontSize = Number(myRule.style.fontSize.match(/(\d+)/)[1]);
      break;
    
/*    case ".testheading":
      TestHeadingCSS = myRule;
      TestHeadingFontSize = Number(myRule.style.fontSize.match(/(\d+)/)[1]);
      break;*/
    } 
  }
}

function pullFontSizesFromCSS(sheetNum) {
  if (!document.styleSheets[sheetNum]) return;
  //Save to global variables the CSS initial values of those things which may be programatically changed
  for (var z=0; z<document.styleSheets[sheetNum].cssRules.length; z++) {
    var myRule = document.styleSheets[sheetNum].cssRules[z];
    if (myRule.style && myRule.style.fontSize) {
      var fontSize = myRule.style.fontSize.match(/(\d+)\s*px/);
      if (!fontSize || !fontSize[1]) continue;
      InitialCssFontSize.push(Number(fontSize[1]));
      CssRuleHavingFontSize.push(z);
    }
  }
}

function adjustFontSizes(sheetNum, delta) {
  for (var i=0; i<CssRuleHavingFontSize.length; i++) {
    var myRule = document.styleSheets[sheetNum].cssRules[CssRuleHavingFontSize[i]];
    var newFontSize = InitialCssFontSize[i] + delta;
    if (newFontSize < 6) newFontSize=6;
    document.styleSheets[sheetNum].cssRules[CssRuleHavingFontSize[i]].style.fontSize = newFontSize + "px";
  }
}

function firstDisplayBible(returnFrameNumber) {
  var vers=null;
  var numWins = prefs.getIntPref("NumDisplayedWindows");
  var guidir = guiDirection();
  var beg = (guidir=="rtl" ? numWins:1);
  var end = (guidir=="rtl" ? 1-1:numWins+1);
  var step = (guidir=="rtl" ? -1:1);
  for (var w=beg; w!=end; w+=step) {
    vers = prefs.getCharPref("Version" + w);
    if (getModuleLongType(vers) == BIBLE) break;
  }
  if (!returnFrameNumber) {
    if (!vers || w==end) vers=prefs.getCharPref("DefaultVersion");
    return vers;
  }
  else {
    if (!vers || w==end) w=beg;
    return w;  
  }
}

function firstDisplayModule() {
  return prefs.getCharPref("Version" + (guiDirection()=="rtl" ? prefs.getIntPref("NumDisplayedWindows"):1));
}

function guiDirection() {
  var guidir = LocaleConfigs[rootprefs.getCharPref("general.useragent.locale")];
  if (guidir && guidir.direction) guidir=guidir.direction;
  else {guidir="ltr";}
  return guidir;
}

function setGlobalDirectionPrefs() {
  // Set scrollbar location (left side for RTL locale)
  var progdir = guiDirection();
  rootprefs.setIntPref("layout.scrollbar.side", (progdir=="rtl" ? 4:0));
  rootprefs.setIntPref("bidi.direction", (progdir=="rtl" ? 2:1));
}

function windowLocationReload() {
  setGlobalDirectionPrefs();
  window.location.reload();
}

/************************************************************************
 * Bible Location Parsing Functions etc.
 ***********************************************************************/  

// Tries to parse a string to return short book name, chapter, verses, and version. 
// If the string fails to parse, null is returned. Information that cannot be
// determined from the parsed string is returned as null. Parsed negative numbers are
// converted to "1"
function parseLocation(loc2parse) {
  loc2parse = loc2parse.replace(/[“|”|\(|\)|\[|\]|,]/g," ");
  loc2parse = loc2parse.replace(/^\s+/,"");
  loc2parse = loc2parse.replace(/\s+$/,"");
//jsdump("reference:\"" + loc2parse + "\"\n");
  if (loc2parse=="" || loc2parse==null) {return null;}
  var location = {shortName: null, version: null, chapter: null, verse: null, lastVerse: null}
  var m; //used for debugging only
  var has1chap;
  var shft;                                                   // book=1, chap=2, verse=3, lastVerse=4                          
  var parsed = /([^:-]+)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/(loc2parse);           shft=0; m=0; has1chap=false;  // book 1:2-3
  if (parsed==null) {parsed = /([^:-]+)\s+(\d+)\s*:\s*(\d+)/(loc2parse);        shft=0; m=1; has1chap=false;} // book 4:5
  if (parsed==null) {parsed = /([^:-]+)\s+(\d+)/(loc2parse);                    shft=0; m=2; has1chap=false;} // book 6
  if (parsed==null) {parsed = /([^:-]+)\s+[v|V].*(\d+)/(loc2parse);             shft=0; m=3; has1chap=true;}  // book v6 THIS VARIES WITH LOCALE!!!
  if (parsed==null) {parsed = /^(\d+)$/(loc2parse);                             shft=2; m=4; has1chap=false;} // 6
  if (parsed==null) {parsed = /(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/(loc2parse);       shft=1; m=5; has1chap=false;} // 1:2-3
  if (parsed==null) {parsed = /(\d+)\s*:\s*(\d+)/(loc2parse);                   shft=1; m=6; has1chap=false;} // 4:5
  if (parsed==null) {parsed = /(\d+)\s*-\s*(\d+)/(loc2parse);                   shft=2; m=7; has1chap=false;} // 4-5
  if (parsed==null) {parsed = /^(.*?)$/(loc2parse);                             shft=0; m=8; has1chap=false;} // book
//jsdump("parsed:" + parsed + " match type:" + m + "\n");
  
  if (parsed) {
    while (shft--) {parsed.splice(1,0,null);}
    if (has1chap) parsed.splice(2,0,1); // insert chapter=1 if book has only one chapter
    if (parsed[1]) {
      var book=identifyBook(parsed[1].replace(/["'«»“”\.\?]/g,""));
      if (book==null || book.shortName==null) {return null;}
      location.shortName = book.shortName;
      location.version = book.version;
      if (location.version.indexOf(",")>-1) {
        var vs = location.version.split(",");
LOOP1:
        for (var v=0; v<vs.length; v++) {
          vs[v] = vs[v].replace(/\s/g, "");
          location.version = vs[v];
          var bs = getAvailableBooks(vs[v]);
          for (var b=0; b<bs.length; b++) if (bs[b] == location.shortName) break LOOP1;
        }
      }
    }
    if (parsed[2]) {location.chapter = (Number(parsed[2])>0) ? Number(parsed[2]):1;}
    if (parsed[3]) {location.verse = (Number(parsed[3])>0) ? Number(parsed[3]):1;}
    if (parsed[4]) {location.lastVerse = (Number(parsed[4])>0) ? Number(parsed[4]):1;}
  }
  else {return null;}
//jsdump("book:" + location.shortName + " version:" + location.version + " chapter:" + location.chapter + " verse:" + location.verse + " last-verse:" + location.lastVerse + "\n");
  return location;
}

// Takes a string and tries to parse out a book name and version
// null is returned if parsing is unsuccessfull
function identifyBook(book) {
//jsdump(">" + book + "<");
  var bookInfo = {shortName: null, version: null}
  // book number is separated from the name to allow for variations in 
  // the number's suffix/prefix and placement (ie before or after book name).
  var inbook = getBookNameParts(book);
//jsdump(inbook.number + " >" + inbook.name + "<");
  // look for exact match over all locales, if not found look for partial match
  if (!compareAgainstLocales(inbook, true, bookInfo)) compareAgainstLocales(inbook, false, bookInfo);
//jsdump("bookInfo.shortName:" + bookInfo.shortName + " bookInfo.version:" + bookInfo.version + "\n");
  return bookInfo;
}

var BookNameCache = {};
// cycle through each book name (including short, long, + variations) of each locale
function compareAgainstLocales(inbook, exact, bookInfo) {
  for (var lc=0; lc<LocaleList.length; lc++) {
    var bundle = null;
    for (var i=0; i<NumBooks; i++) {
      var key = LocaleList[lc] + "-" + Book[i].sName;
      if (!BookNameCache[key]) {
        if (!bundle) bundle = getLocaleBundle(LocaleList[lc], "books.properties");
        BookNameCache[key] = bundle.GetStringFromName(Book[i].sName);
        try {var add = "," + bundle.GetStringFromName("Long" + Book[i].sName);}
        catch (er) {add = "";}
        BookNameCache[key] += add;
        try {add = "," + bundle.GetStringFromName(Book[i].sName + "Variations");}
        catch (er) {add = "";}
        BookNameCache[key] += add + ",";
      }
      var variation = BookNameCache[key].split(",");
      variation.pop();
      if (compareAgainstList(inbook, variation, exact)) {
        bookInfo.shortName = Book[i].sName;
        bookInfo.version = LocaleDefaultVersion[lc];
//jsdump("Matched book with exact = " + exact);
        return true;
      }
    }
  }
  return false;
}

// Compares inbook against each item in the list and returns true only if:
//   exact ? one is equal to the other
//  !exact ? one is equal to, or a truncated version of the other.
function compareAgainstList(inbook, list, exact) {
  var s, l;
  for (var v=0; v<list.length; v++) {
    var testbook = getBookNameParts(list[v]);
    if (inbook.number != testbook.number) continue;
    if (testbook.name.length < inbook.name.length) {s=testbook.name; l=inbook.name;}
    else {s=inbook.name; l=testbook.name;}
    if (exact) var sre = new RegExp("^" + escapeRE(s) + "$","i");
    else sre = new RegExp("^" + escapeRE(s),"i");
    if (l.search(sre)!=-1) return true;
  }
  return false;
}

// Breaks a book name up into "name" and "number". EX: 1st John-->"John","1"
// If the name has no number associated with it, 0 is returned as number.
function getBookNameParts(bname) {
  bname = bname.replace(/^\s+/,"");
  bname = bname.replace(/\s+$/,"");
  bname = replaceASCIIcontrolChars(bname);
  bname += " ";
  var parts = bname.split(" ");
  parts.pop();
  var number=0;
  var name="";
  var sp = "";
  for (var p=0; p<parts.length; p++) {
    var fnum = /(\d+)/(parts[p]);
    if (fnum) {
      var number = Number(fnum[1]);
      if (parts.length==1) {name=parts[p].replace(String(number),"");}
    }
    else if (parts[p]) {
      name += sp + parts[p];
      sp = " ";
    }
  }
  var retval = {number: number, name: name}
  return retval;
}

// Replaces certain character with codes <32 with " " (these may occur in text/footnotes at times- code 30 is used for sure)
function replaceASCIIcontrolChars(string) {
  for (var i=0; i<string.length; i++) {
    var c = string.charCodeAt(i);
    //don't replace space, tab, newline, or return, 
    if (c<32 && c!=9 && c!=10 && c!=13) {
      jsdump("Illegal character code " + string.charCodeAt(i) + " found in string: " + string.substr(0,10) + "\n");
      string = string.substring(0,i) + " " + string.substring(i+1);
    }
  }
  return string;
}

/************************************************************************
 * Some Bible Utility Functions
 ***********************************************************************/ 
// Returns the number of a given short book name
function findBookNum(bText) {
  var retv=null;
  for (var b=0; b < NumBooks; b++)  {
    if (Book[b].sName == bText) {retv = b;}
  }
  return retv;
}

// Returns the number of a given long book name
function findBookNumL(bText) {
  var retv=null;
  for (var b=0; b < NumBooks; b++)  {
    if (Book[b].bNameL == bText) {retv = b;}
  }
  return retv;
}

function getModuleLongType(aModule) {
  if (!Bible) return null;
  if (aModule==ORIGINAL) return BIBLE;
  var typeRE = new RegExp("(^|<nx>)\\s*" + escapeRE(aModule) + "\\s*;\\s*(.*?)\\s*(<nx>|$)");
  var type = typeRE(Bible.getModuleList());
  if (type) type = type[2];
  return type;
}

function getShortTypeFromLong(longType) {
  for (var shortType in SupportedModuleTypes) {
    if (SupportedModuleTypes[shortType] == longType) return shortType;
  }
  return null;
}

// Pass a tab label and get a version name in return
function tabLabel2ModuleName(tablabel, bookShortName) {
  if (tablabel == SBundle.getString("ORIGLabelTab")) {return resolveOriginalVersion(bookShortName);}
  for (var i=0; i<TabLabel.length; i++) {
    if (TabLabel[i] == tablabel) {return TabVers[i];}
  }
  return null;
}

function moduleName2TabIndex(modulename) {
  var versionIsOriginal = false;
  if ((modulename == OrigModuleOT)||(modulename == OrigModuleNT)) {versionIsOriginal = true;}
  for (var i=0; i<TabVers.length; i++) {
    if (TabVers[i] == modulename) {return i;}
    if (versionIsOriginal && TabVers[i]==ORIGINAL) {return i;}
  }
  return null;
}

// Find "original" version name corresponding to book's short name "bsName"
function resolveOriginalVersion(bookShortName) {
  var bnum = (bookShortName ? findBookNum(bookShortName):0);
  if (bnum>=0 && bnum<NumOT) {return OrigModuleOT;}
  else if (bnum < NumBooks)  {return OrigModuleNT;}
  else return null;
}

// Returns an array containing available books (shortName) for version
// Cash available books for speedup...
// This currently does nothing for commentaries, all books are said to be available.
var AvailableBooks = {};
function getAvailableBooks(version) {
  if (AvailableBooks[version]) return AvailableBooks[version];
  var hasMissing = false;
  var shortNames = [];
  var type = getModuleLongType(version);
  if (type!=BIBLE && type!=COMMENTARY) return null;
  for (var b=0; b<Book.length; b++) {
    if (type==BIBLE) {
      var v1 = Bible.getVerseText(version, Book[b].sName + " 1:1");
      var v2 = Bible.getVerseText(version, Book[b].sName + " 1:2");
      if (!v1 && !v2) {
        hasMissing=true;
        continue;
      }
    }
    shortNames.push(Book[b].sName);
  }
  AvailableBooks[version] = shortNames;
  
  //CLUDGE: If a complete Bible is ever found, disable 
  //"HideUnavailableCrossReferences" because it will WASTE A LOT OF TIME.
  //It is unneeded since "findAVerseText" will always return text in this case.
  if (type==BIBLE && !hasMissing) prefs.setBoolPref("HideUnavailableCrossReferences", false);
  return AvailableBooks[version];
}

function getModsWithConfigEntry(param, value, biblesOnly) {
  var ret = [];
  if (!Bible || !TabVers) return ret;
  for (var t=0; t<TabVers.length; t++) {
    if (biblesOnly && TabLongType[t]!=BIBLE) continue;
    if (Bible.getModuleInformation(TabVers[t], param)==value) ret.push(TabVers[t]);
  }
  return ret;
}

function dotStringLoc2ObjectLoc(dotLocation, version) {
  var retval = {shortName:null, chapter:null, book:null, verse:null, lastVerse:null};
  dotLocation = dotLocation.split(".");
  if (dotLocation[0]!=null) retval.shortName =  dotLocation[0];
  if (dotLocation[1]!=null) retval.chapter =    Number(dotLocation[1]);
  if (dotLocation[2]!=null) retval.verse =      Number(dotLocation[2]);
  if (dotLocation[3]!=null) retval.lastVerse =  Number(dotLocation[3]);
  if (version!=null) retval.version = version;
  return retval;
}

// Takes locations of the from shortName.bk.vs[.lv]
// NOTE: lastVerse of locations A and B are ignored!
// Returns true of A and B are same.
function isLocationAbeforeB(locA, locB) {
//jsdump("A:" + locA + " B:" + locB + "\n");
  locA = locA.split(".");
  locB = locB.split(".");
  locA[0] = findBookNum(locA[0]);
  if (locA[0]==null) return null;
  locB[0] = findBookNum(locB[0]);
  if (locB[0]==null) return null;
  for (var i=0; i<locA.length; i++) {
    locA[i] = Number(locA[i]);
    locB[i] = Number(locB[i]);
  }

  if (locA[0]<locB[0]) return true;
  if (locA[0]>locB[0]) return false;
  
  if (locA[1]<locB[1]) return true;
  if (locA[1]>locB[1]) return false;
  
  if (locA[2]>locB[2]) return false;
  return true;
}

// Takes a "." delineated Scripture reference, checks, and normalizes it.
// Returns null if it reference format is wrong or incomplete.
// Converts book.c to book.c.vfirst-book.c.vlast
// And returns one of the following forms:
// a)   book.c.v
// b)   book.c.v-book.c.v
function normalizeOsisReference(ref, bibleMod) {
//dump(ref + "\n");
  var saveref = ref;
  if (ref.search("null")!=-1) return null;
  ref = ref.replace(/^\s+/,""); // remove beginning white space
  ref = ref.replace(/\s+$/,""); // remove trailing white space
  if (ref.search(/^[^\.]+\.\d+\.\d+$/) != -1)                   // bk.c.v
    return ref;
  if (ref.search(/^[^\.]+\.\d+\.\d+-\d+$/) != -1) {             // bk.c.v1-v2
    var p = ref.match(/(^[^\.]+\.\d+\.)(\d+)-(\d+)$/);
    return p[1] + p[2] + "-" + p[1] + p[3];
  }
  if (ref.search(/^[^\.]+\.\d+\.\d+-[^\.]+\.\d+\.\d+$/) != -1)  // bk.c.v-bk.c.v
    return ref; 
  if (ref.search(/^[^\.]+\.\d+$/) != -1)                        // bk.c
    return  ref + ".1-" + ref + "." + Bible.getMaxVerse(bibleMod, ref);
    
  //else {jsdump("WARNING: Unrecognized Osis Cross Reference " + "\"" + saveref + ", " + ref + "\" found in " + Bible.getLocation(bibleMod) + "\n");}
  return null;
}

/************************************************************************
 * Locale Functions
 ***********************************************************************/  

// THERE MAY BE A BETTER WAY TO IMPLEMENT THIS IMPORTANT FUNCTION!!!!
function getLocaleBundle(locale, file) {
  var bundle;
  var saveLocale = rootprefs.getCharPref("general.useragent.locale");
  rootprefs.setCharPref("general.useragent.locale", locale);
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle=null;}
  try {bundle.GetStringFromName("dummy");} catch (er) {} //CLUDGE to get bundle initialized before locale changes!
  rootprefs.setCharPref("general.useragent.locale", saveLocale);
  return bundle;
}

function getCurrentLocaleBundle(file) {
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {var bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle=null;}
  return bundle;
}


/************************************************************************
 * Bible Text Display Routines
 ***********************************************************************/ 

// "location" may have forms: "Matt 3:5", "John 3:16-John 3:21", "John.3", "John.3.5", "John.3.16-John.3.16.21"
// If "location" has "John.3.7.10" form, then it must be normalized BEFORE calling this function.
// If "version" is not a Bible, or does not have the book where "location" is, then an alternate 
// Bible version is used and the location is converted to the new verse system. NOTE! returned 
// location is "." delimited type! Returns "" if verse text cannot be found in any Bible module.
function findAVerseText(version, location, windowNum) {
  if (!windowNum) windowNum = 1;
  var ret = {tabNum:moduleName2TabIndex(version), location:location, text:""};
  if (ret.tabNum == null) return null;
  
  //Is version a Bible, or does version specify a Bible?
  var bibleVersion = null;
  var bibleLocation = location;
  if (getModuleLongType(version)==BIBLE) bibleVersion = version;
  else if (!getPrefOrCreate("DontReadReferenceBible", "Bool", false)) {
    bibleVersion = Bible.getModuleInformation(version, "ReferenceBible");
    bibleVersion = (bibleVersion==NOTFOUND || moduleName2TabIndex(bibleVersion)==null ? null:bibleVersion);
    if (bibleVersion) bibleLocation = Bible.convertLocation(Bible.getVerseSystem(version), location, Bible.getVerseSystem(bibleVersion));
  }
  //If we have a Bible, try it first.
  if (bibleVersion) {
    try {var text = Bible.getVerseText(bibleVersion, bibleLocation);}
    catch (er) {text = "";}
    if (text && text.length > 7) {
      ret.tabNum = moduleName2TabIndex(bibleVersion);
      ret.location = bibleLocation;
      ret.text = text;
      return ret;
    }
  }
  //Passed version does not yield verse text. So now look at tabs...
  var book = location.match(/^\W*(\w+)/)[1];
  for (var v=0; v<TabVers.length; v++) {
    if (TabVers[v]==ORIGINAL || TabVers[v]==OrigModuleNT || TabVers[v]==OrigModuleOT) continue;
    if (TabLongType[v]!=BIBLE) continue;
    var abooks = getAvailableBooks(TabVers[v]);
    for (var ab=0; ab<abooks.length; ab++) {if (abooks[ab]==book) break;}
    if (ab==abooks.length) continue;
    var tlocation = Bible.convertLocation(Bible.getVerseSystem(version), location, Bible.getVerseSystem(TabVers[v]));
    text = Bible.getVerseText(TabVers[v], tlocation);
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned
      if (MainWindow.isTabVersionVisible(v, windowNum)) {
        ret.tabNum = v;
        ret.location = tlocation;
        ret.text = text;
        return ret;
      }
      else if (!ret.text) {
        ret.tabNum = v;
        ret.location = tlocation;
        ret.text = text;      
      }
    }
  }
  
  return ret;
} 

// Turns headings on before reading introductions
function getBookIntroduction(version, book, bibleObj) {
  bibleObj.setGlobalOption("Headings", "On");
  var intro = bibleObj.getBookIntroduction(version, book);
  bibleObj.setGlobalOption("Headings", prefs.getCharPref("Headings"));
  return intro;
}


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 

//Removes white-space, trailing or leading punctuation, "x" (note symbol),
//and leading digits (for verse numbers)
function cleanDoubleClickSelection(sel) {
  var punctuation = String.fromCharCode(8220); //“
  punctuation += String.fromCharCode(8221);    //”
  punctuation += ",!\":;\\-\\?\\(\\)";
  
  sel = sel.replace(/\s+/g,""); //remove white-space
  var regexp = new RegExp("^([" + String.fromCharCode(FootnoteMarker) + "\\d\\s" + punctuation + "]+)(.*)");
  var parse = sel.match(regexp);
  if (parse) {sel = parse[2];} // Remove leading stuff
  regexp = new RegExp("(.*)([" + String.fromCharCode(FootnoteMarker) + "\\s" + punctuation + "]+$)");
  parse = sel.match(regexp);
  if (parse) {sel = parse[1];} // Remove trailing stuff
  return sel;
}

function getGenBookChapterText(moduleAndKey, bible) {
  var parts = moduleAndKey.match(/^\/([^\/]+)(\/.*)$/);
  if (!parts) {
    var mod = moduleAndKey.match(/^\/(.*)$/);
    if (!mod) return null;
    parts = [null, mod[1], "/"];
  }
  var text = bible.getGenBookChapterText(parts[1], parts[2]);
  text = MainWindow.addParagraphIDs(text);
  return text;
}

const delim = "[-]";
function encodeUTF8(a) {
  if (!a) return null;
  var b="";
  for (var i=0; i<a.length; i++) {
    b += String(a.charCodeAt(i)) + delim;
  }
  return b;
}
function decodeUTF8(b) {
  var a = "";
  b = b.split(delim);
  b.pop();
  for (var i=0; i<b.length; i++) {
    a += String.fromCharCode(Number(b[i]));
  }
  return a;
}

function isASCII(text) {
  var notASCII = false;
  for (var c=0; c<text.length; c++) {
    if (text.charCodeAt(c) > 128) {
      notASCII = true;
      break;
    }
  }
  return !notASCII;
}
