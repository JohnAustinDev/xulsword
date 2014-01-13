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


// IMPORTANT INFO ABOUT THIS FILE:
// The functions in common1.js may use and rely on the XSNS_MainWindow as 
// well as the global LibSword object and the other program-wide globals. 
// NOTE: this is unlike common0.js whose functions cannot rely on 
// XSNS_MainWindow or other XSNS_MainWindow globals, and can not even try to 
// access LibSword.

// XSNS_MainWindow is often assigned before any scripts are loaded, but we
// check it again here, just in case...
if (!XSNS_MainWindow) {
  var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
  XSNS_MainWindow = watcher.getWindowByName("xulsword-window", window);
}

if (!XSNS_MainWindow) {
  XSNS_MainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIWebNavigation)
      .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
      .rootTreeItem
      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIDOMWindow);
}

if (!XSNS_MainWindow) jsdump("WARNING: Unable to locate XSNS_MainWindow in: (" + window.name + ")\n");

/************************************************************************
 * Program-wide Globals defined in XSNS_MainWindow to be used anywhere
 ***********************************************************************/ 
var LibSword              = XSNS_MainWindow.LibSword;
var Location              = XSNS_MainWindow.Location;

var LocaleConfigs         = XSNS_MainWindow.LocaleConfigs;
var ModuleConfigs         = XSNS_MainWindow.ModuleConfigs;
var ProgramConfig         = XSNS_MainWindow.ProgramConfig;

var AudioDirs             = XSNS_MainWindow.AudioDirs;

var Book                  = XSNS_MainWindow.Book;

var Tabs                  = XSNS_MainWindow.Tabs;
var Tab                   = XSNS_MainWindow.Tab;

var BM                    = XSNS_MainWindow.BM;
var BMDS                  = XSNS_MainWindow.BMDS;
var BookmarkFuns          = XSNS_MainWindow.BookmarkFuns;
var ResourceFuns          = XSNS_MainWindow.ResourceFuns;

var BibleNavigator        = XSNS_MainWindow.BibleNavigator;
var GenBookNavigator      = XSNS_MainWindow.GenBookNavigator;

var AllWindows            = XSNS_MainWindow.AllWindows;

var SpecialModules        = XSNS_MainWindow.SpecialModules;

var CommandTarget         = XSNS_MainWindow.CommandTarget;

var XSBundle              = XSNS_MainWindow.XSBundle;


// The following objects are sometimes intentionally overwritten by 
// loading a corresponding js file after common1.js has loaded. This
// allows multiple copies of these objects to be used (a XSNS_MainWindow
// object as well as others located in other viweports).
var ViewPort              = XSNS_MainWindow.ViewPort;
var Texts                 = XSNS_MainWindow.Texts;
var BibleTexts            = XSNS_MainWindow.BibleTexts;
var DictTexts             = XSNS_MainWindow.DictTexts;
var GenBookTexts          = XSNS_MainWindow.GenBookTexts;
var CommTexts             = XSNS_MainWindow.CommTexts;


/************************************************************************
 * Bible Location Parsing Functions etc.
 ***********************************************************************/  

// Tries to parse a string to return short book name, chapter, verses, and version. 
// If the string fails to parse, null is returned. Information that cannot be
// determined from the parsed string is returned as null. Parsed negative numbers are
// converted to "1"
function parseLocation(loc2parse) {
	var dot = dotStringLoc2ObjectLoc(loc2parse);
	var bknum = findBookNum(dot.shortName);
	if (bknum !== null) {
		// loc2parse started with something like Gen. so we assume it's a valid osisRef
		return dot;
	}
	
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
  
//jsdump(uneval(location));
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
    for (var i=0; i<Book.length; i++) {
      var key = lc + "-" + Book[i].sName;
      if (!BookNameCache[key]) {
        if (!bundle) bundle = getLocaleBundle(lc, "common/books.properties");
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

function getModuleLongType(aModule) {
  if (aModule == ORIGINAL) return BIBLE;
  var typeRE = new RegExp("(^|<nx>)\\s*" + escapeRE(aModule) + "\\s*;\\s*(.*?)\\s*(<nx>|$)");
  var type = LibSword.getModuleList().match(typeRE);
  if (type) type = type[2];
  return type;
}

function getShortTypeFromLong(longType) {
  for (var shortType in SupportedModuleTypes) {
    if (SupportedModuleTypes[shortType] == longType) return shortType;
  }
  return null;
}

// Find "original" version name corresponding to book's short name
function resolveOriginalVersion(bookShortName) {
  var bnum = (bookShortName ? findBookNum(bookShortName):0);
  if (bnum>=0 && bnum<NumOT) {return Tab.ORIG_OT ? Tab.ORIG_OT.modName:null;}
  else if (bnum < Book.length)  {return Tab.ORIG_NT ? Tab.ORIG_NT.modName:null;}
  else return null;
}

// Returns an array containing available books (shortName) for version
// Cache available books for speedup...
// This currently does nothing for commentaries- all books are said to be available.
var AvailableBooks = {};
function getAvailableBooks(version) {
  if (AvailableBooks[version]) return AvailableBooks[version];
  var hasMissing = false;
  var shortNames = [];
  var type = getModuleLongType(version);
  if (type!=BIBLE && type!=COMMENTARY) return null;
  for (var b=0; b<Book.length; b++) {
    if (type==BIBLE) {
      var v1 = LibSword.getVerseText(version, Book[b].sName + " 1:1", false);
      var v2 = LibSword.getVerseText(version, Book[b].sName + " 1:2", false);
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
  if (!LibSword || !Tabs || !value) return ret;
  value = new RegExp("^" + value + (matchValueBase ? "(-.*)?":"") + "$", (ignoreCase ? "i":""));
  for (var t=0; t<Tabs.length; t++) {
    if (biblesOnly && Tabs[t].modType!=BIBLE) continue;
    var tparam = LibSword.getModuleInformation(Tabs[t].modName, param);
    if (!tparam ||  tparam==NOTFOUND) continue;
    if (tparam.search(value) != -1) ret.push(Tabs[t].modName);
  }
  return ret;
}

function dotStringLoc2ObjectLoc(dotLocation, version) {
  var retval = {shortName:null, chapter:null, book:null, verse:null, lastVerse:null, version:null};
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

function getModuleConfig(mod) {
  var moduleConfig = {};
  
  var moduleConfigDefaultCSS = getModuleConfigDefaultCSS();

  // All versionconfig members should have a valid value, and it must not be null.
  // Read values from module's .conf file
  for (var p in Config) {
    if (!Config[p].modConf) continue;
    if (mod != "LTR_DEFAULT") {
			var val = LibSword.getModuleInformation(mod, Config[p].modConf);
		}
		else val = "";
    if ((/^\s*$/).test(val)) val = NOTFOUND;

    if (val == NOTFOUND && Config[p].CSS && moduleConfigDefaultCSS[p]) {
      val = moduleConfigDefaultCSS[p];
    }
  
    // allow user to overwrite module defaults
    try {
			var userVal = prefs.getCharPref("user." + p + "." + mod);
			if (userVal) val = userVal;
		} catch (er) {}
    
    moduleConfig[p] = val;
  }
  
  // Assign associated locale and modules
  if (mod != "LTR_DEFAULT") {
		moduleConfig["AssociatedLocale"] = getLocaleOfModule(mod);
		if (!moduleConfig["AssociatedLocale"]) moduleConfig["AssociatedLocale"] = NOTFOUND;
		
		if (moduleConfig["AssociatedLocale"] != NOTFOUND && LocaleConfigs.hasOwnProperty(moduleConfig["AssociatedLocale"]))
				moduleConfig["AssociatedModules"] = LocaleConfigs[moduleConfig["AssociatedLocale"]].AssociatedModules;
		else moduleConfig["AssociatedModules"] = NOTFOUND;
	}
	else {
		moduleConfig["AssociatedLocale"] = DEFAULTLOCALE;
		moduleConfig["AssociatedModules"] = NOTFOUND;
	}
	
  // Normalize direction value
  moduleConfig.direction = (moduleConfig.direction.search("RtoL", "i") != -1 ? "rtl":"ltr");

  // Insure there are single quotes around font names
  moduleConfig.fontFamily = moduleConfig.fontFamily.replace(/\"/g, "'");
  if (moduleConfig.fontFamily != NOTFOUND && !(/'.*'/).test(moduleConfig.fontFamily)) 
      moduleConfig.fontFamily = "'" + moduleConfig.fontFamily + "'";

  // Save the CSS style rules for this module, which can be appended to CSS stylesheets
  moduleConfig.StyleRule = createStyleRule(".cs-" + mod, moduleConfig);
  // "m" is prepended to mod because some module names begin with a digit,
  // which would otherwise result in an invalid selector
  moduleConfig.TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(m" + mod + ")", moduleConfig);
  
  return moduleConfig;
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

// "location" may have the forms: 
// "Matt 3:5", "John 3:16-John 3:21", "John.3", "John.3.5", "John.3.16-John.3.16.21", or "John.3.7.10".
// If "version" is not a Bible, or does not have the book where "location" is, then an alternate 
// Bible version is used and the location is converted to the new verse system. NOTE! returned 
// location is "." delimited type! Returns "" if verse text cannot be found in any Bible module.
//
// Is module a Bible, or does module specify another reference Bible in its config file? Then use that.
// If version does not yield verse text, then look at visible tabs in their order.
// If visible tabs do not yield verse text, then look at hidden tabs in their order.
function findAVerseText(version, location, windowNum, keepTextNotes) {
  if (!windowNum) windowNum = 1;
  if (!keepTextNotes) keepTextNotes = false;
  if (!Tab[version]) return null;
  var ret = {tabNum:Tab[version].index, location:location, text:""};
  
  //Is version a Bible, or does version specify a Bible?
  var bibleVersion = null;
  var bibleLocation = location;
  if (getModuleLongType(version)==BIBLE) bibleVersion = version;
  else if (!getPrefOrCreate("DontReadReferenceBible", "Bool", false)) {
    bibleVersion = LibSword.getModuleInformation(version, "ReferenceBible");
    bibleVersion = (bibleVersion==NOTFOUND || !Tab[bibleVersion] ? null:bibleVersion);
    if (bibleVersion) bibleLocation = Location.convertLocation(LibSword.getVerseSystem(version), location, LibSword.getVerseSystem(bibleVersion));
  }
  //If we have a Bible, try it first.
  if (bibleVersion && Tab[bibleVersion]) {
    try {var text = LibSword.getVerseText(bibleVersion, bibleLocation, keepTextNotes).replace(/\n/g, " ");}
    catch (er) {text = "";}
    if (text && text.length > 7) {
      var vsys = LibSword.getVerseSystem(bibleVersion);
      ret.tabNum = Tab[bibleVersion].index;
      ret.location = Location.convertLocation(vsys, bibleLocation, vsys);
      ret.text = text; 
      return ret;
    }
  }
  //Passed version does not yield verse text. So now look at tabs...
  var book = location.match(/^\W*(\w+)/)[1];
  for (var v=0; v<Tabs.length; v++) {
    if (Tab.ORIG_NT && Tabs[v].modName == Tab.ORIG_NT.modName || Tab.ORIG_OT && Tabs[v].modName == Tab.ORIG_OT.modName) continue;
    if (Tabs[v].modType!=BIBLE) continue;
    var abooks = getAvailableBooks(Tabs[v].modName);
    for (var ab=0; ab<abooks.length; ab++) {if (abooks[ab]==book) break;}
    if (ab==abooks.length) continue;
    var tlocation = Location.convertLocation(LibSword.getVerseSystem(version), location, LibSword.getVerseSystem(Tabs[v].modName));
    text = LibSword.getVerseText(Tabs[v].modName, tlocation, keepTextNotes).replace(/\n/g, " ");
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned
      var vsys = LibSword.getVerseSystem(Tabs[v].modName);
      if (!Tabs[v]["w" + windowNum + ".hidden"]) {
        ret.tabNum = v;
        ret.location = Location.convertLocation(vsys, tlocation, vsys);
        ret.text = text;
        return ret;
      }
      else if (!ret.text) {
        ret.tabNum = v;
        ret.location = Location.convertLocation(vsys, tlocation, vsys);
        ret.text = text;      
      }
    }
  }
  
  return ret;
}


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 

var LocaleDir;
function guiDirection() {
  if (LocaleDir) return LocaleDir;
  var guidir = LocaleConfigs[getLocale()];
  if (guidir && guidir.direction) guidir=guidir.direction;
  else {guidir="ltr";}
  LocaleDir = guidir;
  return LocaleDir;
}

//Removes white-space, trailing or leading punctuation, "x" (note symbol),
//and leading digits (for verse numbers)
function cleanDoubleClickSelection(sel) {
  var punctuation = String.fromCharCode(8220); //“
  punctuation += String.fromCharCode(8221);    //”
  punctuation += ",!\":;\\-\\?\\(\\)";
  
  sel = sel.replace(/\s+/g,""); //remove white-space
  sel = sel.replace(/^\d+/, ""); // remove verse numbers

  return sel;
}

// Return the viewport window in which this element resides.
// Note: null means unknown window, but 0 means popup window.
function getContextWindow(elem) {
  while(elem && (!elem.id || (!(/^(text|tabs)\d+$/).test(elem.id) && !(/^npopup$/).test(elem.id)))) {
    elem = elem.parentNode;
  }
  if (!elem) return null;
  else if (elem.id == "npopup") return 0;
  
  return Number(elem.id.substr(4));
}

// Return the module context in which the element resides, NOT the
// module associated with the data of the element itself.
function getContextModule(elem) {
	var contextMod = null;
  
  // first let's see if we're in a verse
  var telem = elem;
  while (telem && (!telem.className || !(/^vs(\s|$)/).test(telem.className))) {
    telem = telem.parentNode;
  }
  if (telem) contextMod = getElementInfo(telem).mod;
  
  // then see if we're in a viewport window, and use its module
  if (!contextMod) {
		var w = getContextWindow(elem);
		if (w) contextMod = ViewPort.Module[w];
	}
  
  // are we in cross reference text?
  if (!contextMod) {
		telem = elem;
		while (telem && (!telem.className || !(/^crtext(\s|$)/).test(telem.className))) {
			telem = telem.parentNode;
		}
		if (telem && telem.className && (/(^|\s)cs\-(\S+)(\s|$)/).test(telem.className)) {
			contextMod = telem.className.match(/(^|\s)cs\-(\S+)(\s|$)/)[2];
		}
	}
	
	// in a search lexicon list?
	if (!contextMod) {
		telem = elem;
		while (telem && (!telem.className || !(/^snlist(\s|$)/).test(telem.className))) {
			telem = telem.parentNode;
		}
		if (telem) contextMod = telem.getAttribute("contextModule");
	}
  
  // otherwise see if we're in a search results list
  if (!contextMod) {
		telem = elem;
		while (telem && (!telem.className || !(/^slist(\s|$)/).test(telem.className))) {
			telem = telem.parentNode;
		}
		if (telem) contextMod = getElementInfo(telem).mod;
	}
	
//jsdump("contextMod=" + contextMod ? contextMod:"null");
  return contextMod;
  
}

function getOffset(elem) {
  var offset = {left:elem.offsetLeft, top:elem.offsetTop};
  
  while(elem.offsetParent) {
    elem = elem.offsetParent;
    offset.left += elem.offsetLeft || 0;
    offset.top += elem.offsetTop || 0;
  }
  
  return offset;
}
