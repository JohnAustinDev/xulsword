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

/************************************************************************
 * Functions in this file may NOT access any Bible XPCOM objects!
 ***********************************************************************/ 

/************************************************************************
 * Declare/Define Some Common Global Variables
 ***********************************************************************/
const LAST_VERSE_IN_CHAPTER=-1;       //Understood by xulsword to be last verse
const ORIGINAL = "ORIG";        //Value doen't really matter, just a const
const FootnoteMarker = 215;           //The Unicode character used by xulsword.dll to mark footnotes
const MAXVERSE = 176;
const MAXCHAPTER = 150;
const BIBLE = "Biblical Texts";
const DICTIONARY = "Lexicons / Dictionaries";
const COMMENTARY = "Commentaries";
const GENBOOK = "Generic Books";
const POPUPDELAY = 250;
const CONTAINS_THE_WORDS=0, EXACT_TEXT=1, USING_SEARCH_TERMS=2, SIMILAR_WORDS=3;
const highlt = "<span id=\"sv\" class=\"hl\">";
const indnt = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
const Vtext1 = "<span id=\"vs.";
const Vtext2 = "<div class=\"interB\">";
const NOTFOUND = "Not Found";
const TABTEXTLG = 13;
const TABTEXTSM = 10;
const CROSSREFTARGET = new RegExp(/^([^\.]+)\.(([^\.]+)\.(\d+)\.(\d+)(\.(\d+)|\s*-\s*[^\.]+\.\d+\.(\d+))?)$/);
const REDWORDS = new RegExp(/<font color="red">/i);
const NEWLINE = "\r\n"; //Only valid for Windows operating systems!!!
const DEFAULTLOCALE = "en-US";
const DLGSTD="centerscreen, modal, resizable=no";
const DLGALERT=0, DLGQUEST=1, DLGINFO=2;
const DLGOK=0, DLGOKCANCEL=1, DLGYESNO=2;
const WESTERNVS = "KJV";
const EASTERNVS = "EASTERN";
//const WESTERNVS = 1
//const EASTERNVS = 2;
const TOOLTIP_LEN=96;
const MODSD="mods.d", MODS="modules", CHROME="chrome", FONTS="fonts", AUDIO="audio", AUDIOPLUGIN="QuickTime Plugin", BOOKMARKS="bookmarks";
const MANIFEST_EXT=".manifest", CONF_EXT=".conf";
const SCROLLTYPEBEG = 1;
const SCROLLTYPECENTER = 0;
const SCROLLTYPEEND = 2;

/************************************************************************
 * THESE FUNCTIONS NEEDED BEFORE XPCOM BIBLE OBJECTS ARE CREATED! This is 
 *  why they have been placed in a separate file. 
 ***********************************************************************/ 
function jsdump(str)
{
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

jsdump("Load common: " + window.name + "\n");

function escapeRE(text) {
  const ESCAPE_RE= new RegExp(/([^\\]|^)([\[\]\(\)\{\}\-\+\*\.\^\$\?\|\\])/g);
  return text.replace(ESCAPE_RE, "$1\\$2");
}

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
    prm = new RegExp("\s*" + escapeRE(param) + "\s*=\s*(.*?)\s*?[\r\n]", "im");
    retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  return retval;
}


/************************************************************************
 * Global Preferences Obect and its Support Routines
 ***********************************************************************/ 
// Get the "xulsword." branch of prefs
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

