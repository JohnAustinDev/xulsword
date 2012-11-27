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

const NW = 3; // number of horizontal text windows xulsword supports

// THE LIST BELOW CANNOT BE CHANGED WITHOUT BREAKING COMPATIBILITY WITH EARLIER EXPORTED BOOKMARKS
// "TYPE" - "BookmarkSeparator", "Folder", or "Bookmark".
// "NAME" - Default name is generated based on TYPE and MODULE.
// "NOTE"  - User note.
// "BOOK" - Bible book for MODULEs using versekey.
// "CHAPTER" - 
//    Bible chapter for MODULEs using versekey, 
//    key for dictionary MODULEs, 
//    module:key for GENBOOK MODULEs
// "VERSE" - 
//    Bible verse for MODULEs using versekey.
//    paragraph for non-versekey MODULEs
// "LASTVERSE" - Bible lastVerse for MODULEs using versekey.
// "MODULE" - Module name
// "LOCATION" - Location in form bookShortName.chap.verse[.lastverse] ALWAYS WITH EASTERN VERSIFICATION
// "BMTEXT" - Bookmarked text sample
// "ICON" - URL to Texts.png, Comms.png, Dicts.png, Genbks.png. Or TextsWithNote.png etc. (add WithNote)
// "CREATIONDATE" - Creation month, day, year, localized to operating system locale.
// "VISITEDDATE" - Last visited month, day, year, localized to operating system locale. (When is this updated?)
//THE FOLLOWING WERE INTRODUCED IN v2.12. EARIER BOOKMARKS WILL NOT HAVE THESE PARAMETERS
// "NAMELOCALE" - Program locale when NAME was set.
// "NOTELOCALE" - Program locale when note was set.
const TYPE=0, NAME=1, NOTE=2, BOOK=3, CHAPTER=4, VERSE=5, LASTVERSE=6, MODULE=7, LOCATION=8, BMTEXT=9, ICON=10, CREATIONDATE=11, VISITEDDATE=12, NAMELOCALE=13, NOTELOCALE=14;


/************************************************************************
 * Functions in this file may NOT access any Bible objects!
 ***********************************************************************/ 

var OPSYS="Unknown OS";
if (navigator.appVersion.indexOf("Win")!=-1) OPSYS="Windows";
else if (navigator.appVersion.indexOf("Mac")!=-1) OPSYS="MacOS";
else if (navigator.appVersion.indexOf("Linux")!=-1) OPSYS="Linux";
else if (navigator.appVersion.indexOf("X11")!=-1) OPSYS="Linux";

var IsExtension = (Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo).name == "Firefox");

/************************************************************************
 * Declare/Define Some Common Global Variables
 ***********************************************************************/
const FPERM = 511; //0777; //511;
const DPERM = 511; //0777; //511;
const LAST_VERSE_IN_CHAPTER=-1;       //Understood by xulsword to be last verse
const ORIGINAL = "ORIG";        //Value doen't really matter, just a const
const FootnoteMarker = 215;           //The Unicode character used by xulsword.dll to mark footnotes
const MAXVERSE = 176;
const MAXCHAPTER = 150;
const BIBLE = "Biblical Texts";
const DICTIONARY = "Lexicons / Dictionaries";
const COMMENTARY = "Commentaries";
const GENBOOK = "Generic Books";
const CONTAINS_THE_WORDS=0, EXACT_TEXT=1, USING_SEARCH_TERMS=2, SIMILAR_WORDS=3;
const highlt = "<span id=\"sv\" class=\"hl\">";
const indnt = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
const Vtext1 = "<span id=\"vs.";
const Vtext2 = "<div class=\"interB\">";
const Titles = "<div class=\"head";
const NewChapter = "<div class=\"chapterhead\"";
const NOTFOUND = "Not Found";
const CROSSREFTITLE = new RegExp(/^([^\.]+)\.(([^\.]+)\.(\d+)\.(\d+)(\.(\d+)|\s*-\s*[^\.]+\.\d+\.(\d+))?)$/);
const REDWORDS = new RegExp(/<font color="red">/i);
const NEWLINE = "\r\n"; //Only valid for Windows operating systems!!!
const DEFAULTLOCALE = "en-US";
const DLGSTD="centerscreen, modal, resizable";
const DLGALERT=0, DLGQUEST=1, DLGINFO=2;
const DLGOK=0, DLGOKCANCEL=1, DLGYESNO=2;
const WESTERNVS = "KJV";
const EASTERNVS = "Synodal";
const TYPES = {Texts: "text", Comms: "comm", Dicts: "dict", Genbks: "book"};
const TOOLTIP_LEN=96;
const MODSD="mods.d", MODS="modules", CHROME="chrome", FONTS="fonts", AUDIO="audio", AUDIOPLUGIN="QuickTime Plugin", BOOKMARKS="bookmarks", VIDEO="video";
const MANIFEST_EXT=".manifest", CONF_EXT=".conf";
const PMSTD="centerscreen, dependent";
const PMSPLASH="alwaysRaised,centerscreen";
const PMMODAL="alwaysRaised,centerscreen,modal";
const PMNORMAL=0, PMSTOP=1;
const APPLICATIONID="xulsword@xulsword.org";
const XSNOTE = "(fn|cr|un)\\.([^\\.]+)\\.(\\w+)\\.(\\d+)\\.(\\d+)\\.(\\w+)";

// Config's properties are all the properties which Config type objects will have. 
// The Config property objects map the property for its various uses:
//  modConf = Name of a possible entry in a module's .conf file
//  localeConf = Name of a possible property in a locale's config.properties file
//  CSS = Name of a possible corresponding CSS property (should also be specified in cs-Program style)
const Config = {
  direction:        { modConf:"Direction", localeConf:"Direction", CSS:"direction" },
  fontFamily:       { modConf:"Font", localeConf:"Font", CSS:"font-family" },
  fontSizeAdjust:   { modConf:"FontSizeAdjust", localeConf:"FontSizeAdjust", CSS:"font-size-adjust" },
  lineHeight:       { modConf:"LineHeight", localeConf:"LineHeight", CSS:"line-height" },
  textAlign:        { modConf:null, localeConf:null, CSS:"text-align" },
  AssociatedModules:{ modConf:null, localeConf:"DefaultModule", CSS:null },
  AssociatedLocale: { modConf:null, localeConf:null, CSS:null },
  StyleRule:        { modConf:null, localeConf:null, CSS:null },
};

const NumBooks=66;
const NumOT=39;
const NumNT=27;

// scrolling
const SCROLLTYPENONE = 0;         // don't scroll (for links this becomes SCROLLTYPECENTER)
const SCROLLTYPETOP = 1;          // scroll to top
const SCROLLTYPEBEG = 2;          // put selected verse at the top of the window or link
const SCROLLTYPECENTER = 3;       // put selected verse in the middle of the window or link, unless verse is already visible or verse 1
const SCROLLTYPECENTERALWAYS = 4; // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
const SCROLLTYPEEND = 5;          // put selected verse at the end of the window or link, and don't change selection
const SCROLLTYPEENDSELECT = 6;    // put selected verse at the end of the window or link, then select first verse of link or verse 1
const SCROLLTYPECUSTOM = 7;       // scroll by running CustomScrollFunction
const SCROLLTYPEDELTA = 8;        // scroll by given delta in pixels
// highlighting
const HILIGHTNONE = 0;            // highlight no verse
const HILIGHTVERSE = 1;           // highlight selected verse in blue
const HILIGHT_IFNOTV1 = 2;        // highlight selected verse in blue unless it is verse 1
const HILIGHTSAME = 3;            // keep hilighted verse the same

var CustomScrollFunction;
/************************************************************************
 * THESE FUNCTIONS NEEDED BEFORE XPCOM BIBLE OBJECTS ARE CREATED! This is 
 *  why they have been placed in a separate file. 
 ***********************************************************************/ 
function jsdump(str)
{
  window.dump(str + "\n");
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

jsdump("Load common: " + window.name + "\n");

function escapeRE(text) {
  const ESCAPE_RE= new RegExp(/([\-\[\]\(\)\{\}\+\*\.\:\^\$\?\|\\])/g);
  return text.replace(ESCAPE_RE, "\\$1");
}

var SupportedModuleTypes = {
  Texts: BIBLE,
  Comms: COMMENTARY,
  Dicts: DICTIONARY,
  Genbks: GENBOOK
  };
  
//returns data from file. Does little checking!
function readFile(nsIFile) {
  if (!nsIFile || !nsIFile.exists()) return "";
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
	fstream.init(nsIFile, -1, 0, 0);
	var charset = "UTF-8";
  const replacementChar = Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
  var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
  is.init(fstream, charset, 1024, replacementChar);
  var filedata = "";
  var str = {};
  while (is.readString(4096, str) != 0) {filedata = filedata + str.value;}
  fstream.close();
  is.close();
  return filedata;
}

function writeFile(nsIFile, str, overwrite, toEncoding) {
  if (!nsIFile || ! nsIFile.QueryInterface(Components.interfaces.nsILocalFile)) return 0;
  if (nsIFile.exists()) {
    if (!overwrite) return 0;
    nsIFile.remove(true);
  }
  nsIFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);
    
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(nsIFile, 0x02 | 0x08 | 0x20, -1, 0);
  var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  os.init(foStream, (toEncoding ? toEncoding:"UTF-8"), 0, 0x0000);
  os.writeString(str);
  os.close();
  foStream.close();
  return 1;
}

function removeFile(file, recurse) {
  if (!recurse) recurse = false;
  if (file) file = file.QueryInterface(Components.interfaces.nsILocalFile);
  if (!file) return false;
  if (!file.exists()) return true;
  try {file.remove(recurse);}
  catch (er) {jsdump("Failed to remove " + (file.isDirectory() ? "directory":"file") + " \"" + file.path + "\", recurse=" + recurse + ". " + er); return false;}
  return true;
}

// Returns null if param is not found.
function readParamFromConf(nsIFileConf, param) {
  nsIFileConf = nsIFileConf.QueryInterface(Components.interfaces.nsILocalFile);
  if (!nsIFileConf) return "";
  if (nsIFileConf.leafName.search(".conf", "i") == -1) return null;
  
  var filedata = readFile(nsIFileConf);
  
  if (param == "ModuleName") {
    var prm = new RegExp("\\[(.*)\\]", "m");
    var retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  else {
    prm = new RegExp("\\s*" + escapeRE(param) + "\\s*=\\s*(.*?)\\s*?[\\r\\n]", "im");
    retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
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

function lpath(path) {
  if (OPSYS == "Windows") {path = path.replace(/\//g, "\\");}
  else if (OPSYS == "Linux") {path = path.replace(/\\/g, "/");}

  return path;
}

// in addition to the XULRunner special directories, the following are also recognized
// xsResD       = resource directory
// xsFonts      = user fonts directory
// xsAudio      = user audio directory
// xsAudioPI    = user audio plugin directory
// xsBookmarks  = user bookmarks directory
// xsModsUser   = user SWORD module directory (contains mods.d & modules)
// xsModsCommon = shared SWORD module directory (contains mods.d & modules)
// xsExtension  = profile extensions directory
function getSpecialDirectory(name) {
  var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  if (name.substr(0,2) == "xs") {
    var retval = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    var profile = directoryService.get("ProfD", Components.interfaces.nsIFile);
    
    var re = new RegExp(profile.leafName + "$");
    var path = profile.path;
    if (!IsExtension) path = path.replace(re, "resources");
    else path += "/xulsword_resources";
    retval.initWithPath(lpath(path));
    
    switch(name) {
    case "xsFonts":
      retval.append(FONTS);
      break;
    case "xsAudio":
      retval.append(AUDIO);
      break;
    case "xsAudioPI":
      retval.append(AUDIO);
      retval.append(AUDIOPLUGIN);
      break;
    case "xsBookmarks":
      retval.append(BOOKMARKS);
      break;
    case "xsVideo":
      retval.append(VIDEO);
      break;
    case "xsExtension":
      retval = profile.clone();
      retval.append("extensions");
      break;
    case "xsResD":
    case "xsModsUser":
      // already correct...
      break;
    case "xsExtResource":
      if (IsExtension) {
        retval = profile.clone().QueryInterface(Components.interfaces.nsILocalFile);
        retval.append("extensions");
        retval.append(APPLICATIONID);
        retval.append("resources");
      }
      // else return regular profile directory
      break;
    case "xsModsCommon":
      switch (OPSYS) {
      case "Windows":
        var userAppPath = Components.classes["@mozilla.org/process/environment;1"].
            getService(Components.interfaces.nsIEnvironment).get("APPDATA");
        userAppPath += "/Sword";
        break
      case "Linux":
        var userAppPath = Components.classes["@mozilla.org/process/environment;1"].
            getService(Components.interfaces.nsIEnvironment).get("HOME");
        userAppPath += "/.sword";
        break;
      }
      retval.initWithPath(lpath(userAppPath));
      break;
    }
  }
  else {
    retval = directoryService.get(name, Components.interfaces.nsIFile);
    retval = retval.QueryInterface(Components.interfaces.nsILocalFile);
  }
  return retval;
}

function createAppDirectories() {
  var checkdir = getSpecialDirectory("xsResD");   if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsModsUser");   if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  var checkdi2 = checkdir.clone();
  checkdi2.append(MODSD);                         if (!checkdi2.exists()) checkdi2.create(checkdi2.DIRECTORY_TYPE, DPERM);
  checkdir.append(MODS);                          if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  if (!ProgramIsPortable) {
    checkdir=getSpecialDirectory("xsModsCommon"); if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
    checkdi2=checkdir.clone();
    checkdi2.append(MODSD);                       if (!checkdi2.exists()) checkdi2.create(checkdi2.DIRECTORY_TYPE, DPERM);
    checkdir.append(MODS);                        if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  }
  checkdir = getSpecialDirectory("xsFonts");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsAudio");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsBookmarks");  if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsAudioPI");    if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsVideo");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
}

/************************************************************************
 * Global Preferences Obect and its Support Routines
 ***********************************************************************/ 
// Get the "xulsword." branch of prefs

// IMPORTANT: Preferences in Mozilla have two separate values stored in
// two separate trees: A Default value, and a User value. Default values are
// assigned each time the program starts up, and they come from whatever
// is in the /defaults/pref/*.js files. User values are set by the
// program or user, and they permanently override the default values.
// SO, IT IS IMPORTANT NOT TO SET VALUES FOR ANY PREFERENCES
// WHICH MIGHT NEED TO BE CHANGED DURING A PROGRAM UPGRADE!
var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);  
prefs = prefs.getBranch("xulsword.");

var rootprefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefBranch); 

// Needed for Unicode preference values
function getUnicodePref(prefName) {
  return prefs.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
}

function setUnicodePref(prefName,prefValue) {
  var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
  sString.data = prefValue;
  prefs.setComplexValue(prefName,Components.interfaces.nsISupportsString,sString);
}

function getPrefOrCreate(prefName, prefType, defaultValue) {
  var prefVal;
  try {
    switch (prefType) {
    case "Char":
      prefVal = prefs.getCharPref(prefName);
      break;
    case "Bool":
      prefVal = prefs.getBoolPref(prefName);
      break;
    case "Int":
      prefVal = prefs.getIntPref(prefName);
      break;
    case "Unicode":
      prefVal = getUnicodePref(prefName);
      break;
    default:
      jsdump("Warning!: Could not handle pref type: " + prefType + "\n");
      return null;
    }
  }
  catch (er) {
    prefVal = defaultValue;
    switch (prefType) {
    case "Char":
      prefs.setCharPref(prefName,prefVal);
      break;
    case "Bool":
      prefs.setBoolPref(prefName,prefVal);
      break;
    case "Int":
      prefs.setIntPref(prefName,prefVal);
      break;
    case "Unicode":
      setUnicodePref(prefName,prefVal);
      break;
    }
  }
  return prefVal;
}


/************************************************************************
 * Locale Functions
 ***********************************************************************/

function getLocale() {
  var loc = rootprefs.getCharPref("general.useragent.locale");
  if (loc.indexOf("chrome")==0) {
    try {
      loc = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle(loc);
      loc = GetStringFromName("general.useragent.locale");
    }
    catch(er) {loc = DEFAULTLOCALE;}
  }
  return loc;
}

// THERE MAY BE A BETTER WAY TO IMPLEMENT THIS IMPORTANT FUNCTION!!!!
function getLocaleBundle(locale, file) {
  var bundle;
  var saveLocale = getLocale();
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
  title = title.replace(String.fromCharCode(1198),"Y","gm"); //? to ?
  title = title.replace(String.fromCharCode(1199),"v","gm"); //? to ?
  title = title.replace(String.fromCharCode(1256),String.fromCharCode(216),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1257),String.fromCharCode(248),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1186),String.fromCharCode(1053),"gm"); //? to ?
  title = title.replace(String.fromCharCode(1187),String.fromCharCode(1085),"gm"); //? to ?

  // remove Unicode directional chars
  title = title.replace(String.fromCharCode(8207), "", "gm");
  title = title.replace(String.fromCharCode(8206), "", "gm");

  // The ? chars seem to be in the 1251 code page and so aren't included
  //title = title.replace(String.fromCharCode(1038),String.fromCharCode(1059),"gm"); //? to ?
  //title = title.replace(String.fromCharCode(1118),String.fromCharCode(1091),"gm"); //? to ?
  return title;
}

function getLocalizedChapterTerm(shortBookName, chapternumber, bookbundle, locale) {
  var chapTerm;
  if (shortBookName=="Ps") {
    try {chapTerm = bookbundle.formatStringFromName("PsalmTerm",[dString(chapternumber, locale)],1);}
    catch (er) {chapTerm=null;}
  }
  if (!chapTerm) chapTerm = bookbundle.formatStringFromName("Chaptext",[dString(chapternumber, locale)],1);
  return chapTerm;
}

function dString(x, locale) {
  if (!locale) locale = getLocale();
  var s = String(x);
  if (!DisplayNumeral[locale]) getDisplayNumerals(locale);
  s = s.replace("0", DisplayNumeral[locale][0],"g");
  s = s.replace("1", DisplayNumeral[locale][1],"g");
  s = s.replace("2", DisplayNumeral[locale][2],"g");
  s = s.replace("3", DisplayNumeral[locale][3],"g");
  s = s.replace("4", DisplayNumeral[locale][4],"g");
  s = s.replace("5", DisplayNumeral[locale][5],"g");
  s = s.replace("6", DisplayNumeral[locale][6],"g");
  s = s.replace("7", DisplayNumeral[locale][7],"g");
  s = s.replace("8", DisplayNumeral[locale][8],"g");
  s = s.replace("9", DisplayNumeral[locale][9],"g");
  return s;
}

function iString(x, locale) {
  if (!locale) locale = getLocale();
  var s = String(x);
  if (!DisplayNumeral[locale]) getDisplayNumerals(locale);
  s = s.replace(DisplayNumeral[locale][0], "0", "g");
  s = s.replace(DisplayNumeral[locale][1], "1", "g");
  s = s.replace(DisplayNumeral[locale][2], "2", "g");
  s = s.replace(DisplayNumeral[locale][3], "3", "g");
  s = s.replace(DisplayNumeral[locale][4], "4", "g");
  s = s.replace(DisplayNumeral[locale][5], "5", "g");
  s = s.replace(DisplayNumeral[locale][6], "6", "g");
  s = s.replace(DisplayNumeral[locale][7], "7", "g");
  s = s.replace(DisplayNumeral[locale][8], "8", "g");
  s = s.replace(DisplayNumeral[locale][9], "9", "g");
  return s;
}

var DisplayNumeral = new Object();
function getDisplayNumerals(locale) {
  DisplayNumeral[locale] = new Array(11);
  DisplayNumeral[locale][10] = false;
  var bundle = getLocaleBundle(locale, "numbers.properties");
  for (var i=0; i<=9; i++) {
    var n = null;
    if (bundle) {
      try {
        n = bundle.GetStringFromName("n" + i);
        if (!n || test(/^\s*$/).test(n)) throw "No UI digit";
      } 
      catch(er) {n = null;}
    }
    if (n) DisplayNumeral[locale][10] = true;
    DisplayNumeral[locale][i] = (n ? n:i);
  }
}

function isProgramPortable() {
  var appInfo = prefs.getCharPref("BuildID");
  return (appInfo && appInfo.substr(appInfo.length-1) == "P");
}
var ProgramIsPortable = isProgramPortable();