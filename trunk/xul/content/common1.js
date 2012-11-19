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
if (!MainWindow) MainWindow = WindowWatcher.getWindowByName("xulsword-window", window);
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


/************************************************************************
 * DYNAMIC CSS FUNCTIONS
 ***********************************************************************/ 

function getLocaleConfig(lc) {
  // Assign localeConfig members from all config.properties entries (see UI-MAP.txt)
  // These must properly map to ConfigProps members (most of which are CSS properties)
  var localeProps = ["Direction", "Font", "FontSizeAdjust", "LineHeight", "DefaultModule"];

  var localeConfig = {};
  
  var programCSS = getCSS(".cs-Program {");
  var b = getLocaleBundle(lc, "config.properties");

  for (var i=0; i<localeProps.length; i++) {
    var val = b.GetStringFromName(localeProps[i]);
    if ((/^\s*$/).test(val)) val = NOTFOUND;
    
    // All localeconfig members should have a valid value, and it must not be null.
    if (val == NOTFOUND && i < 4) {
      if (programCSS.style[ConfigProps[i]]) {
        val = programCSS.style[ConfigProps[i]];
      }
    }
    
    localeConfig[ConfigProps[i]] = val;
  }
 
  localeConfig["AssociatedLocale"] = lc;
  
  // Insure there are single quotes around font names
  localeConfig.fontFamily = localeConfig.fontFamily.replace(/\"/g, "'");
  if (localeConfig.fontFamily != NOTFOUND && !(/'.*'/).test(localeConfig.fontFamily)) 
      localeConfig.fontFamily = "'" + localeConfig.fontFamily + "'";

  // Save the CSS style rule for this locale, which can be appended to CSS stylesheets
  localeConfig.StyleRule = createStyleRule(".cs-" + lc, localeConfig);
  
  return localeConfig;
}

function getModuleConfig(mod) {
  // Create and populate ModuleConfigs
  var moduleConfig = {};
  
  var programCSS = getCSS(".cs-Program {");
  
  // Assign ModuleConfigs members from module .conf entries.
  // These must properly map to ConfigProps members (most of which are CSS properties)
  var confProps = ["Direction", "Font", "FontSizeAdjust", "LineHeight"];
  for (var i=0; i<confProps.length; i++) {
    var val = Bible.getModuleInformation(mod, confProps[i]);
    if ((/^\s*$/).test(val)) val = NOTFOUND;
    
    // All versionconfig members should have a valid value, and it must not be null.
    if (val == NOTFOUND && i < 4) {
      if (programCSS.style[ConfigProps[i]]) {
        val = programCSS.style[ConfigProps[i]];
      }
    }
    
    moduleConfig[ConfigProps[i]] = val;
  }
  
  // Assign associated locale and modules
  moduleConfig["AssociatedLocale"] = getLocaleOfModule(mod);
  if (!moduleConfig["AssociatedLocale"]) moduleConfig["AssociatedLocale"] = NOTFOUND;
  
  if (moduleConfig["AssociatedLocale"] != NOTFOUND && LocaleConfigs.hasOwnProperty(moduleConfig["AssociatedLocale"]))
      moduleConfig["AssociatedModules"] = LocaleConfigs[moduleConfig["AssociatedLocale"]].AssociatedModules;
  else moduleConfig["AssociatedModules"] = NOTFOUND;
  
  // Normalize direction value
  moduleConfig.direction = (moduleConfig.direction.search("RtoL", "i") != -1 ? "rtl":"ltr");
  
  // Insure there are single quotes around font names
  moduleConfig.fontFamily = moduleConfig.fontFamily.replace(/\"/g, "'");
  if (moduleConfig.fontFamily != NOTFOUND && !(/'.*'/).test(moduleConfig.fontFamily)) 
      moduleConfig.fontFamily = "'" + moduleConfig.fontFamily + "'";

  // Save the CSS style rule for this module, which can be appended to CSS stylesheets
  moduleConfig.StyleRule = createStyleRule(".cs-" + mod, moduleConfig);
  
  return moduleConfig;
}

function createStyleRule(selector, config) {
  var rule = selector + " {";
  for (var i=0; i<ConfigCSS.length; i++) {rule += ConfigCSS[i] + ":" + config[ConfigProps[i]] + "; ";}
  rule += "}";

//jsdump(rule); 
  return rule;
}

// This function returns the FIRST rule matching the selector.
function getCSS(selector) {
  selector = new RegExp("^" + escapeRE(selector));
  var myRule = null;
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    try {var zend = document.styleSheets[ssn].cssRules.length;} catch (er) {zend = 0;}
    for (var z=0; z<zend; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(selector) != -1) return myRule;
    }
  }
  return null;
}

// Will create CSS classes for locales and modules and append to a stylesheet.
// This must be a global function so that any window can create our classes.
function createDynamicClasses() {
  var sheet = document.styleSheets[document.styleSheets.length-1];
  if (!sheet) return;
  
  var sheetLength = sheet.cssRules.length;
  
  for (var lc in LocaleConfigs) {sheet.insertRule(LocaleConfigs[lc].StyleRule, sheetLength)}
  
  for (var m in ModuleConfigs) {sheet.insertRule(ModuleConfigs[m].StyleRule, sheetLength)}
}

// The userFontSize class in all stylesheets is dynamically updated by this routine.
var StartingFont = {};
function adjustFontSizes(delta) {
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    for (var z=0; z<document.styleSheets[ssn].cssRules.length; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(".userFontSize") == -1) continue;
      if (!StartingFont["ssn" + ssn + "z" + z]) {
          StartingFont["ssn" + ssn + "z" + z] = Number(myRule.style.fontSize.match(/(\d+)/)[0]);
      }
      myRule.style.fontSize = Number(StartingFont["ssn" + ssn + "z" + z] + delta) + "px";
    }
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
  for (var lc in LocaleConfigs) {
    var bundle = null;
    for (var i=0; i<NumBooks; i++) {
      var key = lc + "-" + Book[i].sName;
      if (!BookNameCache[key]) {
        if (!bundle) bundle = getLocaleBundle(lc, "books.properties");
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
        bookInfo.version = LocaleConfigs[lc].AssociatedModules.replace(/\s*,.*$/, "");
        bookInfo.locale = lc;
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

// Converts a short book reference into readable text in the locale language, and can handle from-to cases
// Possible inputs: bk.c.v[.lv][-bk.c.v[.lv]]
// Possible outputs:
//    bk c:v
//    bk c:v-lv
//    bk c:v-lv, bk c:v-lv
//    
function ref2ProgramLocaleText(reference, notHTML) {
  var separator="";
  
  var entity = "&rlm;";
  entity = ((LocaleConfigs[getLocale()].direction && 
                          LocaleConfigs[getLocale()].direction=="rtl") ? "&rlm;":"&lrm;");
  var char = (guiDirection=="rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));


  var dc = notHTML ? char:entity;
  var retv=dc;
 
  reference += "-";
  var myrefs = reference.split("-");
  myrefs.pop();
  for (var ix=0; ix<myrefs.length; ix++) {
    // Some ref names returned by xulsword have a leading space!! Remove it first...
    myrefs[ix] = myrefs[ix].replace(/^\s*/,"");
    var myrefsP = myrefs[ix].split(".");
    if (myrefsP[2] && myrefsP[3] && myrefsP[2]==myrefsP[3]) {myrefsP.pop();}
    if (myrefsP.length == 4) {
      myrefsP[0] = Book[findBookNum(myrefsP[0])].bName;
      if (myrefsP[0]==null) {jsdump("WARNING: Didn't find ref >" + myrefs[ix] + "< in ref2ProgramLocaleText\n");}
      else {
        if (separator != "") {retv += dc + "-" + myrefsP[3];}
        else {retv += separator + myrefsP[0] + dc + " " + myrefsP[1] + ":" + dc + myrefsP[2] + dc + "-" + myrefsP[3];}
      }
      separator = ", ";
    }
    else if (myrefsP.length == 3) {
      var bn = findBookNum(myrefsP[0]);
      if (bn!=null) myrefsP[0] = Book[bn].bName;
      if (bn==null || myrefsP[0]==null) {jsdump("WARNING: Didn't find ref >" + myrefs[ix] + "< in ref2ProgramLocaleText\n");}
      else {
        if (separator != "") {retv += dc + "-" + myrefsP[2];}
        else {retv += separator + myrefsP[0] + dc + " " + myrefsP[1] + ":" + dc + myrefsP[2];}
      }
      separator = dc + " " + dc + "-" + dc + " ";
    }
  }
  return dString(retv);
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
  if (bnum>=0 && bnum<NumOT) {return Tab.ORIG_OT ? Tab.ORIG_OT.modName:null;}
  else if (bnum < NumBooks)  {return Tab.ORIG_NT ? Tab.ORIG_NT.modName:null;}
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

function usesSecurityModule(aXSobj, version) {
  if (aXSobj.getModuleInformation(version, "CipherKey") != "") return false;
  //checking "ProducedFor" is for backward compatibility to modules before version 2.7
  var usesSecurityModule = ((aXSobj.getModuleInformation(version, MainWindow.VERSIONPAR)!=NOTFOUND || 
      aXSobj.getModuleInformation(version, "ProducedFor")=="xulsword") ? true:false);
  return usesSecurityModule;
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
    if (Tab.ORIG_NT && Tabs[v].modName == Tab.ORIG_NT.modName || Tab.ORIG_OT && Tabs[v].modName == Tab.ORIG_NT.modName) continue;
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
      if (!Tabs[v]["w" + windowNum + ".hidden"]) {
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


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 

function firstDisplayBible(returnNumber) {
  try {var ret=prefs.getCharPref("DefaultVersion");}
  catch (er) {ret = null;}
  
  var wn = prefs.getIntPref("NumDisplayedWindows");
  for (var w=1; w<=wn; w++) {
    var amod = prefs.getCharPref("Version" + w);
    if (Tab[amod].modType == BIBLE) {
      ret = amod;
      break;
    }
  }
  if (!returnNumber) return ret;
  else {
    if (!ret || w>wn) w=1;
    return w;
  }
}

function firstDisplayModule() {
  return {mod:prefs.getCharPref("Version1"), w:1};
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
  window.location.reload();
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

const UTF8ENCODEDELIM = "_|_";
function encodeUTF8(a) {
  if (!a) return null;
  var b="";
  for (var i=0; i<a.length; i++) {
    b += String(a.charCodeAt(i)) + UTF8ENCODEDELIM;
  }
  return b;
}
function decodeUTF8(b) {
  var a = "";
  b = b.split(UTF8ENCODEDELIM);
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

function copyObj(obj) {
  var newobj = {};
  for (var m in obj) {
    if (typeof(obj[m]) == "object") {
      newobj[m] = copyObj(obj[m]);
    }
    else newobj[m] = obj[m];
  }
  
  return newobj;
}

// Return the window in which this element resides.
// Note: null means no window, but 0 means popup window.
function getWindow(elem) {
  while(elem && (!elem.id || (!(/^text\d+$/).test(elem.id) && !(/^npopup$/).test(elem.id)))) {
    elem = elem.parentNode;
  }
  if (!elem) return null;
  else if (elem.id == "npopup") return 0;
  
  return Number(elem.id.substr(4));
}
