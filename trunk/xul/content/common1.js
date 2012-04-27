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


// VAR AND FUNCTION DECLARATIONS WHICH MAY BE USED BY ALL XUL AND HTML DOCUMENTS

/************************************************************************
 * String Bundle used for script locality
 ***********************************************************************/  
var WindowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
if (!MainWindow) MainWindow = WindowWatcher.getWindowByName("main-window", window);
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

var Tabs = [];
var Tab = {};

var LocaleList = [];
var LocaleDefaultVersion = [];

var LocaleDirectionEntity;
var LocaleDirectionChar;

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


/************************************************************************
 * Unlock all texts
 ***********************************************************************/ 

var CheckTexts = [];
function unlockAllModules(aBible, print) {
  var dumpMsg="";
  for (var t=0; t<Tabs.length; t++) {
    if (Tabs[t].isOrigTab) continue;
    if (Tabs[t].modType != BIBLE) continue; // only Bible modules are encrypted
    var retkey = unlockModule(aBible, Tabs[t].modName);
    if (retkey) dumpMsg += Tabs[t].modName + "(" + retkey + ") ";
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
var ChooserStartMargin;
var SelectedVerseCSS;
var SelectedVerseColor;
var ChooserBookButtonHeight;
var NormalBookBackground;
var ChapterArrowCSS;
var InitialCssFontSize = [];
var CssRuleHavingFontSize = [];
var DefaultFont = "Arial";
var DefaultFontSizeAdjust = "0.55";
var DefaultVersionLineHeight = "135%";
var DefaultLocaleLineHeight = "100%";

function getCSS(searchText) {
  searchText = new RegExp("^" + escapeRE(searchText));
  var myRule = null;
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    for (var z=0; z!=document.styleSheets[ssn].cssRules.length; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(searchText) != -1) return myRule;
    }
  }
  return null;
}

var StyleRules = [];
function createVersionClasses() {
  var sheet = document.styleSheets[document.styleSheets.length-1];
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

function updateCSSBasedOnVersion(version, cssRuleNameArray) {
  var versionConfig = VersionConfigs[version];
  var rules = [];
  for (var i=0; i<cssRuleNameArray.length; i++) {
    var thisRule = getCSS(cssRuleNameArray[i]);
    if (thisRule) {
      thisRule.style.fontFamily = (versionConfig && versionConfig.font ? "\"" + versionConfig.font + "\"":"\"" + DefaultFont + "\"");
      thisRule.style.direction = (versionConfig && versionConfig.direction ? versionConfig.direction:"ltr");
      thisRule.style.fontSizeAdjust = (versionConfig && versionConfig.fontSizeAdjust ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust);
      thisRule.style.lineHeight = (versionConfig && versionConfig.lineHeight ? versionConfig.lineHeight:DefaultVersionLineHeight);
    }
    else {
      var sheet = document.styleSheets[document.styleSheets.length-1];
      sheet.insertRule(getStyleRule(cssRuleNameArray[i], versionConfig), sheet.cssRules.length);
    }
  }
}

// Adjusts rtl related styles for listed CSS rules or creates the rule if it doesn't exist
function updateCSSBasedOnCurrentLocale(cssRuleNameArray) {
  var currentLocale = getLocale();
  var localeConfig = LocaleConfigs[currentLocale];
  for (var i=0; i<cssRuleNameArray.length; i++) {
    var thisRule = getCSS(cssRuleNameArray[i]);
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
      var sheet = document.styleSheets[document.styleSheets.length-1];
      sheet.insertRule(getStyleRule(cssRuleNameArray[i], localeConfig, true), sheet.cssRules.length);
    }
  }
}

var LocaleConfigs = {};
var VersionConfigs = {};
// Return a locale (if any) to associate with the module:
//    Return a Locale which lists the module as its default
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return null if no match
function getLocaleOfModule(module) {
  var myLocale=null;
  for (var lc=0; lc<LocaleDefaultVersion.length; lc++) {
    var regex = new RegExp("(^|\s|,)+" + module + "(,|\s|$)+");
    if (LocaleDefaultVersion[lc] && LocaleDefaultVersion[lc].match(regex)) myLocale = LocaleList[lc];
  }
  if (Bible && !myLocale) {
    for (lc=0; lc<LocaleList.length; lc++) {
      var lcs, ms;
      try {
        lcs = LocaleList[lc].toLowerCase();
        ms = Bible.getModuleInformation(module, "Lang").toLowerCase();
      }
			catch(er) {lcs=null; ms==null;}
      
			if (ms && ms == lcs) {myLocale = LocaleList[lc]; break;}
			if (ms && lcs && ms.replace(/-.*$/, "") == lcs.replace(/-.*$/, "")) {
				myLocale = LocaleList[lc];
				if (myLocale == getLocale()) break;
			}
    }
  }
  return myLocale;
}

function getVersionOfLocale(alocale) {
  if (!alocale) alocale = getLocale();
  for (var i=0; i<LocaleList.length; i++) {
    if (LocaleList[i] == alocale) return LocaleDefaultVersion[i];
  }
  return "none";
}

function initializeStyleGlobals() {
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    //Save to global variables the CSS initial values of those things which may be programatically changed
    for (var z=0; z<document.styleSheets[ssn].cssRules.length; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      switch (myRule.cssText.match(/^(.*?) /)[1]) {
      case ".scriptbox": ScriptBoxFontColor = myRule.style.color; break;  
      case ".scriptboxtext": ScriptBoxTextCSS = myRule; break;
      case ".booknameshowing": SelectedBookBackground = myRule.style.background; break;
      case ".booknamepoint": PointedBookBackground = myRule.style.background; break;
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
}

function pullFontSizesFromCSS() {
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    //Save to global variables the CSS initial values of those things which may be programatically changed
    for (var z=0; z<document.styleSheets[ssn].cssRules.length; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.style && myRule.style.fontSize) {
        var fontSize = myRule.style.fontSize.match(/(\d+)\s*px/);
        if (!fontSize || !fontSize[1]) continue;
        InitialCssFontSize.push(Number(fontSize[1]));
        CssRuleHavingFontSize.push(ssn + "><" + z);
      }
    }
  }
}

function adjustFontSizes(delta) {
  for (var i=0; i<CssRuleHavingFontSize.length; i++) {
    var sheetNum = CssRuleHavingFontSize[i].split("><")[0];
    var ruleNum = CssRuleHavingFontSize[i].split("><")[1];
    var myRule = document.styleSheets[sheetNum].cssRules[ruleNum];
    var newFontSize = InitialCssFontSize[i] + delta;
    if (newFontSize < 6) newFontSize=6;
    
    if (myRule.cssText.match(/^(.*?) /)[1] != ".tabs")
        document.styleSheets[sheetNum].cssRules[ruleNum].style.fontSize = newFontSize + "px";
  }
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
  loc2parse = iString(loc2parse);
//jsdump("reference:\"" + loc2parse + "\"\n");
  if (loc2parse=="" || loc2parse==null) {return null;}
  var location = {shortName: null, version: null, chapter: null, verse: null, lastVerse: null}
  var m; //used for debugging only
  var has1chap;
  var shft;                                                   // book=1, chap=2, verse=3, lastVerse=4                          
  var parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);           shft=0; m=0; has1chap=false;  // book 1:2-3
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)/);        shft=0; m=1; has1chap=false;} // book 4:5
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)/);                    shft=0; m=2; has1chap=false;} // book 6
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+[v|V].*(\d+)/);             shft=0; m=3; has1chap=true;}  // book v6 THIS VARIES WITH LOCALE!!!
  if (parsed==null) {parsed = loc2parse.match(/^(\d+)$/);                             shft=2; m=4; has1chap=false;} // 6
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);       shft=1; m=5; has1chap=false;} // 1:2-3
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)/);                   shft=1; m=6; has1chap=false;} // 4:5
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*-\s*(\d+)/);                   shft=2; m=7; has1chap=false;} // 4-5
  if (parsed==null) {parsed = loc2parse.match(/^(.*?)$/);                             shft=0; m=8; has1chap=false;} // book
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
        bookInfo.locale = LocaleList[lc];
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
    var fnum = parts[p].match(/(\d+)/);
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
  var type = Bible.getModuleList().match(typeRE);
  if (type) type = type[2];
  return type;
}

function getShortTypeFromLong(longType) {
  for (var shortType in SupportedModuleTypes) {
    if (SupportedModuleTypes[shortType] == longType) return shortType;
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
      if ((!v1 && !v2) || (v1.match(/^\s*-\s*$/) && v2.match(/^\s*-\s*$/))) {
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

function getModsWithConfigEntry(param, value, biblesOnly, ignoreCase, matchValueBase) {
  var ret = [];
  if (!Bible || !Tabs || !value) return ret;
  value = new RegExp("^" + value + (matchValueBase ? "(-.*)?":"") + "$", (ignoreCase ? "i":""));
  for (var t=0; t<Tabs.length; t++) {
    if (biblesOnly && Tabs[t].modType!=BIBLE) continue;
    var tparam = Bible.getModuleInformation(Tabs[t].modName, param);
    if (!tparam ||  tparam==NOTFOUND) continue;
    if (tparam.search(value) != -1) ret.push(Tabs[t].modName);
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
    
  //else {jsdump("WARNING: Unrecognized Osis Cross Reference " + "\"" + saveref + ", " + ref + "\" found in " + Location.getLocation(bibleMod) + "\n");}
  return null;
}


/************************************************************************
 * Bible Text Display Routines
 ***********************************************************************/ 

// "location" may have forms: "Matt 3:5", "John 3:16-John 3:21", "John.3", "John.3.5", "John.3.16-John.3.16.21"
// If "location" has "John.3.7.10" form, then it must be normalized BEFORE calling this function.
// If "version" is not a Bible, or does not have the book where "location" is, then an alternate 
// Bible version is used and the location is converted to the new verse system. NOTE! returned 
// location is "." delimited type! Returns "" if verse text cannot be found in any Bible module.
//
// Is module a Bible, or does module specify another reference Bible in its config file? Then use that.
// If version does not yield verse text, then look at visible tabs in their order.
// If visible tabs do not yield verse text, then look at hidden tabs in their order.

function findAVerseText(version, location, windowNum) {
  if (!windowNum) windowNum = 1;
  if (!Tab[version]) return null;
  var ret = {tabNum:Tab[version].index, location:location, text:""};
  
  //Is version a Bible, or does version specify a Bible?
  var bibleVersion = null;
  var bibleLocation = location;
  if (getModuleLongType(version)==BIBLE) bibleVersion = version;
  else if (!getPrefOrCreate("DontReadReferenceBible", "Bool", false)) {
    bibleVersion = Bible.getModuleInformation(version, "ReferenceBible");
    bibleVersion = (bibleVersion==NOTFOUND || !Tab[bibleVersion] ? null:bibleVersion);
    if (bibleVersion) bibleLocation = Location.convertLocation(Bible.getVerseSystem(version), location, Bible.getVerseSystem(bibleVersion));
  }
  //If we have a Bible, try it first.
  if (bibleVersion && Tab[bibleVersion]) {
    try {var text = Bible.getVerseText(bibleVersion, bibleLocation).replace(/\n/g, " ");}
    catch (er) {text = "";}
    if (text && text.length > 7) {
      ret.tabNum = Tab[bibleVersion].index;
      ret.location = bibleLocation;
      ret.text = text; 
      return ret;
    }
  }
  //Passed version does not yield verse text. So now look at tabs...
  var book = location.match(/^\W*(\w+)/)[1];
  for (var v=0; v<Tabs.length; v++) {
    if (Tabs[v].modName==ORIGINAL || Tabs[v].modName==OrigModuleNT || Tabs[v].modName==OrigModuleOT) continue;
    if (Tabs[v].modType!=BIBLE) continue;
    var abooks = getAvailableBooks(Tabs[v].modName);
    for (var ab=0; ab<abooks.length; ab++) {if (abooks[ab]==book) break;}
    if (ab==abooks.length) continue;
    var tlocation = Location.convertLocation(Bible.getVerseSystem(version), location, Bible.getVerseSystem(Tabs[v].modName));
    text = Bible.getVerseText(Tabs[v].modName, tlocation).replace(/\n/g, " ");
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned
      if (MainWindow.isTabShowing(v, windowNum)) {
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
  if (!Tab[version] || (Tab[version].modType != BIBLE && Tab[version].modType != COMMENTARY)) return "";
  bibleObj.setGlobalOption("Headings", "On");
  var intro = bibleObj.getBookIntroduction(version, book);
  bibleObj.setGlobalOption("Headings", prefs.getCharPref("Headings"));
  return intro;
}


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 

function firstDisplayBible(returnFrameNumber) {
  try {var vers=prefs.getCharPref("DefaultVersion");}
  catch (er) {vers = null;}
  var numWins = prefs.getIntPref("NumDisplayedWindows");
  for (var w=1; w<=numWins; w++) {
    if (!MainWindow || !MainWindow.Win[w]) continue;
    vers = MainWindow.Win[w].modName;
    if (MainWindow.Win[w].modType == BIBLE) break;
  }
  if (!returnFrameNumber) return vers;
  else {
    if (!vers || w>numWins) w=1;
    return w;
  }
}

function firstDisplayModule() {
  return MainWindow.Win[1].modName;
}

var LocaleDir;
function guiDirection() {
  if (LocaleDir) return LocaleDir;
  var guidir = LocaleConfigs[getLocale()];
  if (guidir && guidir.direction) guidir=guidir.direction;
  else {guidir="ltr";}
  LocaleDir = guidir;
  return LocaleDir;
}

function setGlobalDirectionPrefs() {
  // Set scrollbar location (left side for RTL locale)
  var progdir = guiDirection();
  rootprefs.setIntPref("layout.scrollbar.side", (progdir=="rtl" ? 4:0));
  rootprefs.setIntPref("bidi.direction", (progdir=="rtl" ? 2:1));
}

function windowLocationReload() {
  setGlobalDirectionPrefs();
  REL=true; window.location.reload();
}

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

function getGenBookChapterText(moduleAndKey, bible, fn) {
  var parts = moduleAndKey.match(/^\/([^\/]+)(\/.*)$/);
  if (!parts) {
    var mod = moduleAndKey.match(/^\/(.*)$/);
    if (!mod) return null;
    parts = [null, mod[1], "/"];
  }
  var text = bible.getGenBookChapterText(parts[1], parts[2]);
  text = MainWindow.addParagraphIDs(text);
  
  if (fn) {
    var t = insertUserNotes("na", 1, parts[1], text);
    text = t.html;
    fn.CrossRefs = "";
    fn.Footnotes = "";
    fn.Notes = "";
    fn.UserNotes = text.notes;
  }
  return text;
}

var VerseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
function getChapterText(bible, location, fn, vers, appendNotes) {
  var text = bible.getChapterText(vers, Location.getLocation(vers));
  var tl = getLocaleOfModule(vers);
  if (!tl) {tl = getLocale();}
  if (!DisplayNumeral[tl]) getDisplayNumerals(tl);
  if (DisplayNumeral[tl][10])
      text = text.replace(VerseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});
  text = insertUserNotes(location.getBookName(), location.getChapterNumber(vers), vers, text);
  
  if (!appendNotes) {
    fn.CrossRefs = bible.getCrossRefs();
    fn.Footnotes = bible.getFootnotes();
    fn.Notes = bible.getNotes();
    fn.UserNotes = text.notes;
  }
  else {
    fn.CrossRefs = (fn.CrossRefs ? fn.CrossRefs:"") + bible.getCrossRefs();
    fn.Footnotes = (fn.Footnotes ? fn.Footnotes:"") + bible.getFootnotes();
    fn.Notes = (fn.Notes ? fn.Notes:"") + bible.getNotes();
    fn.UserNotes = (fn.UserNotes ? fn.UserNotes:"") + text.notes;
  }

  return text.html;
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
