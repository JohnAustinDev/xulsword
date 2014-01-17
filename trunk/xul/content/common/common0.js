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
// The functions in common0.js may be used even before the XS_window has 
// loaded. But NO FUNCTION IN THIS FILE may use LibSword or call another 
// function which uses LibSword. Otherwise there will be unhandled excep-
// tions. This file also assigns global constants and it should be loaded
// into every scope which uses any common Javascript code. Naturally, 
// functions in this file must properly handle any exceptions which may
// arise from unset XS_window globals.

var prefs, rootprefs;
var IsPortable;
var IsExtension;

// BOOKMARK CONSTANTS:
// NOTE: THE LIST BELOW CANNOT BE CHANGED WITHOUT BREAKING COMPATIBILITY WITH EARLIER EXPORTED BOOKMARKS
// "TYPE" - "BookmarkSeparator", "Folder", "EmptyBookmark", or "Bookmark".
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

// What's our operating system?
var OPSYS = "Unknown OS";
if (navigator.appVersion.indexOf("Win")!=-1) OPSYS="Windows";
else if (navigator.appVersion.indexOf("Mac")!=-1) OPSYS="MacOS";
else if (navigator.appVersion.indexOf("Linux")!=-1) OPSYS="Linux";
else if (navigator.appVersion.indexOf("X11")!=-1) OPSYS="Linux";

// Are we running as a Firefox extension?
IsExtension = (Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo).name == "Firefox");

/************************************************************************
 * Declare/Define Common Global Constants
 ***********************************************************************/
const FPERM = 511; //0777; //511;
const DPERM = 511; //0777; //511;
const ORIGINAL = "ORIG";        //Value doen't really matter, just a const
const MAXVERSE = 176;
const MAXCHAPTER = 150;
const BIBLE = "Biblical Texts";
const DICTIONARY = "Lexicons / Dictionaries";
const COMMENTARY = "Commentaries";
const GENBOOK = "Generic Books";
const NOTFOUND = "Not Found";
const NEWLINE = (OPSYS == "Windows" ? "\r\n":(OPSYS == "MacOS" ? "\r":"\n"));
const DIRSEP = (OPSYS == "Windows" ? "\\":"/");
const BMFileReturn="\r\n"; // used in imported/exported bookmarks.txt because < 3.6 could only read files with this newline.
const DEFAULTLOCALE = "en-US";
const DLGSTD="centerscreen,modal,resizable";
const DLGALERT=0, DLGQUEST=1, DLGINFO=2;
const DLGOK=0, DLGOKCANCEL=1, DLGYESNO=2;
const WESTERNVS = "KJV";
const EASTERNVS = "Synodal";
const TOOLTIP_LEN=96;
const MODSD="mods.d", MODS="modules", LOCALE="locale", CHROME="chrome", FONTS="fonts", AUDIO="audio", BOOKMARKS="bookmarks", VIDEO="video";
const MANIFEST_EXT=".manifest", CONF_EXT=".conf", EXTENSION_EXT=".xpi";
const PMSTD="centerscreen, dependent";
const PMSPLASH="alwaysRaised,centerscreen";
const PMMODAL="alwaysRaised,centerscreen,modal";
const PMNORMAL=0, PMSTOP=1;
const APPLICATIONID="xulsword@xulsword.org";
const FIREFOXUID="ec8030f7-c20a-464f-9b0e-13a3a9e97384";
const VERSIONPAR = "xulswordVersion";
const LOCALE_SEARCH_SYMBOLS = {SINGLECharWildCard:"?", MULTICharWildCard:"*", AND:"&&", OR:"||", NOT:"!", SIMILAR:"~", GROUPSTART:"(", GROUPEND:")", QUOTESTART:"\"", QUOTEEND:"\""};
const AUDEXT = (OPSYS == "Windows" ? ["mp3", "ogg"]:["ogg", "mp3"]);
const AUDMIME = {mp3:"audio/mpeg", ogg:"audio/ogg"};
const LOCALEPREF = "general.useragent.locale";
const MSMOVE = "mousemove";
const MSOVER = "mouseover";
const MSOUT  = "mouseout";

const NumOT = 39;
const NumNT = 27;
const NW = 3; // max number of text windows a single viewport supports

// scrolling
const SCROLLTYPENONE = 0;         // don't scroll un-linked windows, but scroll linked windows to center.
const SCROLLTYPETOP = 1;          // scroll to top of current chapter
const SCROLLTYPEBEG = 2;          // put selected verse at the top of the window or link
const SCROLLTYPECENTER = 3;       // put selected verse in the middle of the window or link, unless verse is already visible or verse 1
const SCROLLTYPECENTERALWAYS = 4; // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
const SCROLLTYPEEND = 5;          // put selected verse at the end of the window or link, and don't change selection
const SCROLLTYPEENDSELECT = 6;    // put selected verse at the end of the window or link, then select first verse of link or verse 1
const SCROLLTYPEDELTA = 7;        // scroll by given delta in pixels
const SCROLLTYPEPREVIOUS = 8;     // scroll exactly as previous

// highlighting
const HILIGHTNONE = 0;            // highlight no verse
const HILIGHTVERSE = 1;           // highlight selected verse in blue
const HILIGHT_IFNOTV1 = 2;        // highlight selected verse in blue unless it is verse 1
const HILIGHTPREVIOUS = 3;        // do same hilight type as during previous update
const HILIGHTSKIP = 4             // skip hilighting step to speed things up- any previously hilighted verse(s) will remain so

function jsdump(str)
{
  window.dump(str + "\n");
  try {Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);}
	catch (er) {}
}

jsdump("Load common: " + window.name + "\n");

// TextClasses is an object used to parse information from element classes
// and titles. Many of these are generated by libxulsword. The TextClasses object 
// is mainly used by the getElementInfo function below to retrieve any relevant 
// info from an arbitrary DOM element. DOM elements must of course have their class 
// and title pattern(s) included in TextClasses for their infos to be retreivable. 
// The TextClasses class must always be the first class in the element's 
// class list, and only the part before any "-" defines its TextClasses class.
// If a null parameter value exists for a particular class expression, this 
// signifies the value should be provided by context. NOTE: the sr, 
// dt, and dtl class may have multiple ";" or " " separated references 
// in their titles.
const TextClasses = {
  vs:     [ { re:new RegExp(/^(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                               bk:2,    ch:3,     vs:4,    lv:4,     mod:5, osisref:1 } ],
  fn:     [ { re:new RegExp(/^(\d+)\.(unavailable)\.([^\.]+)$/),                                            nid:1, bk:null, ch:null, vs:null, lv:null, mod:3, osisref:2 },
            { re:new RegExp(/^(\d+)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                 nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  cr:     [ { re:new RegExp(/^(\d+)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                 nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  un:     [ { re:new RegExp(/^([^\.]+)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                              nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 },
            { re:new RegExp(/^([^\.]+)\.[^\.]+\.(.*)\.(\d+)\.([^\.]+)$/),                                   nid:1, bk:null, ch:2,     vs:3,    lv:3,    mod:4 } ],
  sr:     [ { re:new RegExp(/^(unavailable)\.([^\.]+)$/),                                               reflist:1, bk:null, ch:null, vs:null, lv:null, mod:2, osisref:1 },
            { re:new RegExp(/^((([^\.]+)\.(\d+)\.(\d+))(\;.*?)?)\.([^\.]+)$/),                          reflist:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:7, osisref:2 },
            { re:new RegExp(/^((([^\.]+)\.(\d+)\.(\d+)\s*-\s*[^\.]+\.\d+\.(\d+))(\;.*?)?)\.([^\.]+)$/), reflist:1, bk:3,    ch:4,     vs:5,    lv:6,     mod:8, osisref:2 },
            { re:new RegExp(/^(.*?)\.([^\.]+)$/),                                                       reflist:1, bk:null, ch:null, vs:null, lv:null, mod:2 } ],
  // dt and dtl allow [:.] as delineator for backward compatibility < 2.23 ([:] is correct)
  dt:     [ { re:new RegExp(/^((([^\:\.]+)[\:\.]([^\.]+))(\s+[^\:\.]+[\:\.][^\.]+)?)\.([^\.]+)$/),      reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  dtl:    [ { re:new RegExp(/^((([^\:\.]+)[\:\.]([^\.]+))(\s+[^\:\.]+[\:\.][^\.]+)?)\.([^\.]+)$/),      reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  snbut:  [ { re:new RegExp(/^((\S+)\:(\S+))\.([^\.]+)$/),                                                         bk:null, ch:3,    vs:null, lv:null, mod:4, osisref:1 } ],
  fnrow:  [ { re:new RegExp(/^([^\.]+)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                              nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  fnlink: [ { re:new RegExp(/^([^\.]*)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                              nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  crref:  [ { re:new RegExp(/^(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                               bk:2,    ch:3,     vs:4,    lv:4,     mod:5, osisref:1 },
            { re:new RegExp(/^(([^\.]+)\.(\d+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                        bk:2,    ch:3,     vs:4,    lv:5,     mod:6, osisref:1 } ],
  nlist:  [ { re:new RegExp(/^(\w+)\.([^\.]*)\.(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),              ntype:1, nid:2, bk:4,    ch:5,     vs:6,    lv:6,     mod:7, osisref:3 },
            { re:new RegExp(/^(un)\.([^\.]*)\.[^\.]*\.(.*)\.(\d+)\.([^\.]+)$/),                    ntype:1, nid:2, bk:null, ch:3,    vs:4,     lv:4,     mod:5 } ],
  slist:  [ { re:new RegExp(/^([^\.]*)\.([^\.]*)$/),                                                               bk:null, ch:1,    vs:null, lv:null,  mod:2 },
            { re:new RegExp(/^(([^\.]*)\.(\d+)\.(\d+))\.([^\.]*)$/),                                               bk:2,    ch:3,     vs:4,    lv:4,     mod:5, osisref:1 } ],
  listenlink: [ { re:new RegExp(/^(([^\.]+)\.(\d+)\.(\d+))\.([^\.]+)$/),                                           bk:2,    ch:3,     vs:4,    lv:4,     mod:5, osisref:1 } ]
};

// This function will accept either raw HTML or a DOM element as "elem"
// NOTES ABOUT ENCODING:
// - nid: encoded with encodeURIComponent (for use in HTML tags)
// - osisref: encoded with _cp_ encoding (UTF8, and some other chars, require encoding in osisRef attributes)
// - reflist: is an array of UTF8 strings
// - ch: is UTF8 (may be a number or a key)
// - all other properties: are ASCII
function getElementInfo(elem) {
  
  // Info is parsed from className and title, so start by getting each
  var className, title;
  if (typeof(elem) == "string") {
    // If elem is string HTML, parse only the first tag
    try {
      title = elem.match(/^[^<]*<[^>]+title\s*=\s*["']([^"']*)["']/)[1];
      className = elem.match(/^[^<]*<[^>]+class\s*=\s*["']([^"']*)["']/)[1];
    }
    catch (er) {return null;}
  }
  else {
    if (!elem.className || !elem.title) return null;
    className = elem.className;
    title = elem.title;
  }

//jsdump("getElementInfo class=" + className + ", title=" + title);
  
  // Read info using TextClasses...
  var r = {};
  var type = className.match(/^([^\-\s]*)/)[1];
  if (!TextClasses.hasOwnProperty(type)) return null;
  
  r.type = type;
  r.title = title;
  
  for (var i=0; i<TextClasses[type].length; i++) {
    var m = title.match(TextClasses[type][i].re);
    if (!m) continue;
    r.i = i;
//jsdump("i=" + i + "\n" + uneval(m));    
    for (var p in TextClasses[type][i]) {
      if (p == "re") continue;
      if (TextClasses[type][i][p] === null) r[p] = null;
      else r[p] = m[TextClasses[type][i][p]];
      
      // convert integers into Number type, rather than String type
      if (r[p] && r[p].indexOf(".") == -1 && Number(r[p])) {
         r[p] = Number(r[p]);
        continue;
      }
     
      // decode properties which need decodeURIComponent
      if ((/^(osisref|reflist|ch)$/).test(p)) r[p] = decodeURIComponent(r[p]);
      
      // fix incorrect dictionary osisRefs for backward compatibility to <2.23
      if (p == "osisref" && (/^(dtl|dt)$/).test(type)) {
        r[p] = r[p].replace(/(^|\s)([^\.\:]+)\./g, "$1$2:");
      }
      
      // convert reflist into arrays
      if (p == "reflist") {
        
        if ((/^(dtl|dt)$/).test(type)) {
          // Backward Compatibility to < 2.23
          if (r[p].indexOf(":") == -1) {
            r[p] = r[p].replace(" ", "_32_", "g");
            r[p] = r[p].replace(";", " ", "g");
            r[p] = r[p].replace(/((^|\s)\w+)\./g, "$1:");
          }
          r[p] = r[p].split(/ +/);
        }
        
        else if (type == "sr") {
					r[p] = r[p].split(";");
					// remove useless "Bible:" from refs (like module SME)
					for (var ii=0; ii<r[p].length; ii++) {r[p][ii] = r[p][ii].replace(/^\s*Bible\:\s*/i, "");}
				}
        
        else {throw("Unknown type of reflist:" + type);}
        
      }
      
      // decode properties which need decodeOSISRef
      if (p == "reflist") {
        for (var x=0; x<r[p].length; x++) {r[p][x] = decodeOSISRef(r[p][x]);}
      }
      if (p == "ch") r[p] = decodeOSISRef(r[p]);
      
    }
    
    break;
  }
  if (i == TextClasses[type].length) return null;

//jsdump(uneval(r));

  return r;
}

function decodeOSISRef(aRef) {
  var re = new RegExp(/_(\d+)_/);
  var m = aRef.match(re);
  while(m) {
    var r = String.fromCharCode(Number(m[1]));
    aRef = aRef.replace(m[0], r, "g");
    m = aRef.match(re);
  }
  return aRef;
}

// Config's properties are all the properties which Config type objects will have. 
// The Config property objects map the property for its various uses:
//   - modConf = Name of a possible entry in a module's .conf file
//   - localeConf = Name of a possible property in a locale's config.properties file
//   - CSS = Name of a possible corresponding CSS property (should also be specified in cs-Program style)
const Config = {
  direction:        { modConf:"Direction", localeConf:"Direction", CSS:"direction" },
  fontFamily:       { modConf:"Font", localeConf:"Font", CSS:"font-family" },
  fontSizeAdjust:   { modConf:"FontSizeAdjust", localeConf:"FontSizeAdjust", CSS:"font-size-adjust" },
  lineHeight:       { modConf:"LineHeight", localeConf:"LineHeight", CSS:"line-height" },
  fontSize:         { modConf:"FontSize", localeConf:"FontSize", CSS:"font-size" },
  color:            { modConf:"FontColor", localeConf:"FontColor", CSS:"color" },
  background:       { modConf:"FontBackground", localeConf:"FontBackground", CSS:"background" },
  AssociatedModules:{ modConf:null, localeConf:"DefaultModule", CSS:null },
  AssociatedLocale: { modConf:null, localeConf:null, CSS:null },
  StyleRule:        { modConf:null, localeConf:null, CSS:null },
  TreeStyleRule:    { modConf:null, localeConf:null, CSS:null }
};

const LocaleConfigDefaultCSS = {
  fontFamily:"'Arial'",
  direction:"ltr",
  fontSizeAdjust:"none",
  lineHeight:"unspecified",
  fontSize:"unspecified",
  color:"unspecified",
  background:"unspecified"
};

function getModuleConfigDefaultCSS() {
	var moduleConfigDefaultCSS = {
		fontFamily:getPrefOrCreate("user.fontFamily.default", "Char", "'Arial'"),
		direction: getPrefOrCreate("user.direction.default", "Char", "ltr"),
		fontSizeAdjust: getPrefOrCreate("user.fontSizeAdjust.default", "Char", "none"),
		lineHeight: getPrefOrCreate("user.lineHeight.default", "Char", "1.6em"),
		fontSize: getPrefOrCreate("user.fontSize.default", "Char", "1em"),
		color: getPrefOrCreate("user.color.default", "Char", "#202020"),
		background: getPrefOrCreate("user.background.default", "Char", "unspecified")
	};
	
	return moduleConfigDefaultCSS;
}

const GlobalToggleCommands = {
  cmd_xs_toggleHeadings:   "Headings",
  cmd_xs_toggleFootnotes:  "Footnotes",
  cmd_xs_toggleCrossRefs:  "Cross-references",
  cmd_xs_toggleDictionary: "Reference Material Links",
  cmd_xs_toggleStrongsTags: "Strong's Numbers",
  cmd_xs_toggleMorphTags: "Morphological Tags",
  cmd_xs_toggleVerseNums:  "Verse Numbers",
  cmd_xs_toggleUserNotes:  "User Notes",
  cmd_xs_toggleHebrewCantillation:  "Hebrew Cantillation",
  cmd_xs_toggleHebrewVowelPoints:   "Hebrew Vowel Points",
  cmd_xs_toggleRedWords:  "Words of Christ in Red"
};

const SupportedModuleTypes = {
  Texts: BIBLE,
  Comms: COMMENTARY,
  Dicts: DICTIONARY,
  Genbks: GENBOOK
};

// Firefox Add-On validation throws warnings about setting innerHTML 
// directly, so this is a safe solution. In future, it's better to 
// manipulate the DOM directly rather than use innerHTML also 
// because it's faster. NOTE: This function scrubs out all Javascript 
// as well as non-standard HTML attributes.
function setInnerHTML(parent, html) {
	while (parent.firstChild) {parent.removeChild(parent.firstChild);}
	
	var parser = Components.classes["@mozilla.org/parserutils;1"].getService(Components.interfaces.nsIParserUtils);
	parent.appendChild(parser.parseFragment(html, parser.SanitizerAllowStyle, false, null, parent.ownerDocument.documentElement));
}

// Firefox Add-On validation throws warnings about eval(uneval(obj)), so
// this is an alternate way...
function deepClone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function escapeRE(text) {
  const ESCAPE_RE= new RegExp(/([\-\[\]\(\)\{\}\+\*\.\:\^\$\?\|\\])/g);
  return text.replace(ESCAPE_RE, "\\$1");
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
    var prm = new RegExp("^\\s*\\[(.*)\\]", "m");
    var retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  else {
    prm = new RegExp("^\\s*" + escapeRE(param) + "\\s*=\\s*(.*?)\\s*?[\\r\\n]", "im");
    retval = filedata.match(prm);
    if (retval) retval = retval[1];
  }
  return retval;
}

// Replaces character with codes <32 with " " (these may occur in text/footnotes at times- code 30 is used for sure)
function replaceASCIIcontrolChars(string) {
  for (var i=0; i<string.length; i++) {
    
    var c = string.charCodeAt(i);
    if (c<32) string = string.substring(0,i) + " " + string.substring(i+1);

  }
  
  return string;
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

// Convert file path separators into native platform separators 
function lpath(path) {
  if (OPSYS == "Windows") {path = path.replace(/\//g, "\\");}
  else if (OPSYS == "Linux") {path = path.replace(/\\/g, "/");}

  return path;
}

// in addition to the XULRunner special directories, the following are also recognized
// xsResD       = resource directory
// xsFonts      = user fonts directory
// xsAudio      = user audio directory
// xsBookmarks  = user bookmarks directory
// xsModsUser   = user SWORD module directory (contains mods.d & modules)
// xsModsCommon = shared SWORD module directory (contains mods.d & modules)
// xsExtension  = profile extensions directory
// xsLocale     = libsword locale directory
// xsDefaults   = xulsword's defaults directory
// xsProgram    = xulsword's program files root directory
function getSpecialDirectory(name) {
  var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  if (name.substr(0,2) == "xs") {
  
    var profile = directoryService.get("ProfD", Components.interfaces.nsILocalFile);
    
    var resources = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    var path = profile.path;
    if (IsExtension) path += "/xulsword_resources";
    else path = path.replace(new RegExp(escapeRE(profile.leafName) + "$"), "resources");
    resources.initWithPath(lpath(path));
    
    var retval = resources.clone().QueryInterface(Components.interfaces.nsILocalFile);
    
    switch(name) {
    case "xsFonts":
      retval.append(FONTS);
      break;
    case "xsAudio":
      retval.append(AUDIO);
      break;
    case "xsBookmarks":
      retval.append(BOOKMARKS);
      break;
    case "xsVideo":
      retval.append(VIDEO);
      break;
    case "xsLocale":
      retval.append("locales.d");
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
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
        retval.append("resources");
      }
      // else return regular resources directory
      break;
    case "xsDefaults":
      if (IsExtension) {
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
        retval.append("defaults");
      }
      else {
        retval = directoryService.get("DefRt", Components.interfaces.nsILocalFile);
      }
      break;
    case "xsProgram":
      if (IsExtension) {
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
      }
      else {
        retval = directoryService.get("CurProcD", Components.interfaces.nsILocalFile);
      }
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
    retval = directoryService.get(name, Components.interfaces.nsILocalFile);
  }
  return retval;
}

function createAppDirectories() {
  var checkdir = getSpecialDirectory("xsResD");   if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsModsUser");   if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  var checkdi2 = checkdir.clone();
  checkdi2.append(MODSD);                         if (!checkdi2.exists()) checkdi2.create(checkdi2.DIRECTORY_TYPE, DPERM);
  checkdir.append(MODS);                          if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  if (!IsPortable) {
    checkdir=getSpecialDirectory("xsModsCommon"); if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
    checkdi2=checkdir.clone();
    checkdi2.append(MODSD);                       if (!checkdi2.exists()) checkdi2.create(checkdi2.DIRECTORY_TYPE, DPERM);
    checkdir.append(MODS);                        if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  }
  checkdir = getSpecialDirectory("xsFonts");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsAudio");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsBookmarks");  if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsVideo");      if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
  checkdir = getSpecialDirectory("xsLocale");     if (!checkdir.exists()) checkdir.create(checkdir.DIRECTORY_TYPE, DPERM);
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
// WHICH MIGHT NEED TO BE CHANGED DURING A PROGRAM UPGRADE: values set
// by xulsword cannot be later changed by updating /defaults/pref/*.js
// files.
prefs = Components.classes["@mozilla.org/preferences-service;1"]
										.getService(Components.interfaces.nsIPrefService) 
										.getBranch("extensions.xulsword.");

rootprefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefBranch); 

// Needed for Unicode preference values
function getUnicodePref(prefName) {
  return prefs.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
}

function setUnicodePref(prefName,prefValue) {
  var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
  sString.data = prefValue;
  prefs.setComplexValue(prefName, Components.interfaces.nsISupportsString, sString);
}

// Reading a pref which does not exist causes an exception, so this
// function (or else a try block) must be used the first time a user 
// pref is accessed or created.
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

function getDataUI(prop) {
  var d = document.getElementById("ui." + prop);
  if (!d) d = document.getElementById("xulsword-ui." + prop);
  
  if (!d) {
    if (typeof("jsdump") != "undefined") jsdump("WARNING: getDataUI() failed to locate data: " + prop);
    return "";
  }
  
  if (!d.childNodes || !d.childNodes.length) return "";

  return d.childNodes[0].nodeValue.replace(/\\n/g, "\n");
}

function getLocale() {
  var loc = rootprefs.getCharPref(LOCALEPREF);
  if (loc.indexOf("chrome")==0) {
    try {
      loc = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle(loc);
      loc = GetStringFromName(LOCALEPREF);
    }
    catch(er) {loc = DEFAULTLOCALE;}
  }
  return loc;
}

function getLocaleBundle(locale, file) {
  var bundle;
  if (!locale || !file) return null;
  
  var saveLocale = getLocale();
  if (locale == saveLocale) return getCurrentLocaleBundle(file);
  
  rootprefs.setCharPref(LOCALEPREF, locale);
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle = null;}
  try {bundle.GetStringFromName("dummy");} catch (er) {} //CLUDGE to get bundle initialized before locale changes!
  rootprefs.setCharPref(LOCALEPREF, saveLocale);
  
  return bundle;
}

function getCurrentLocaleBundle(file) {
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {var bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle = null;}
  return bundle;
}

function safeGetStringFromName(defvalue, locale, filename, value) {
  var b = getLocaleBundle(locale, filename);
  if (!b) b = getCurrentLocaleBundle(filename);
  if (!b) {
    jsdump("WARN: No string bundle for: " + filename + ":" + value);
    return defvalue;
  }
  
  try {var v = b.GetStringFromName(value);}
  catch (er) {
    jsdump("ERROR: while reading: " + filename + ":" + value);
    return defvalue;
  }
  
  if (v == "" || v === null) {
    jsdump("WARN: Missing value: " + filename + ":" + value);
    return defvalue;
  }
  
  return v;
}

function safeFormatStringFromName(defvalue, locale, filename, value, paramArray, paramArrayLength) {
  throw "safeFormatStringFromName is not yet fully implemented";
  
  defvalue = defvalue; // TODO: replace markers!
  
  var b = getLocaleBundle(locale, filename);
  if (!b) b = getCurrentLocaleBundle(filename);
  if (!b) return defvalue; 
  
  try {var v = b.formatStringFromName(value, paramArray, paramArrayLength);}
  catch (er) {return defvalue;}
  
  if (v == "" || v === null) return defvalue;
  
  return v;
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
  try {chapTerm = bookbundle.formatStringFromName(shortBookName + "_Chaptext",[dString(chapternumber, locale)], 1);}
  catch (er) {chapTerm=null;}
  if (!chapTerm) chapTerm = bookbundle.formatStringFromName("Chaptext",[dString(chapternumber, locale)], 1);
  return chapTerm;
}

var DisplayNumeral = new Object();

// converts any normal digits in a string or number into localized digits
function dString(x, locale) {
  try {var cache = XS_window.DisplayNumeral;}
  catch (er) {cache = DisplayNumeral;}
  
  if (!locale) locale = getLocale();
  
  if (!cache[locale]) getDisplayNumerals(locale, cache);
  
  var s = String(x);
  if (!cache[locale][10]) return s; // then no numbers are localized
  
  s = s.replace("0", cache[locale][0],"g");
  s = s.replace("1", cache[locale][1],"g");
  s = s.replace("2", cache[locale][2],"g");
  s = s.replace("3", cache[locale][3],"g");
  s = s.replace("4", cache[locale][4],"g");
  s = s.replace("5", cache[locale][5],"g");
  s = s.replace("6", cache[locale][6],"g");
  s = s.replace("7", cache[locale][7],"g");
  s = s.replace("8", cache[locale][8],"g");
  s = s.replace("9", cache[locale][9],"g");
  
  return s;
}

// converts any localized digits in a string into normal digits
function iString(x, locale) {
  try {var cache = XS_window.DisplayNumeral;}
  catch (er) {cache = DisplayNumeral;}
  
  if (!locale) locale = getLocale();
  
  if (!cache[locale]) getDisplayNumerals(locale, cache);
  
  var s = String(x);
  if (!cache[locale][10]) return s; // then no numbers are localized
  
  s = s.replace(cache[locale][0], "0", "g");
  s = s.replace(cache[locale][1], "1", "g");
  s = s.replace(cache[locale][2], "2", "g");
  s = s.replace(cache[locale][3], "3", "g");
  s = s.replace(cache[locale][4], "4", "g");
  s = s.replace(cache[locale][5], "5", "g");
  s = s.replace(cache[locale][6], "6", "g");
  s = s.replace(cache[locale][7], "7", "g");
  s = s.replace(cache[locale][8], "8", "g");
  s = s.replace(cache[locale][9], "9", "g");
  
  return s;
}

function getDisplayNumerals(locale, localnumbers) {
  localnumbers[locale] = new Array(11);
  localnumbers[locale][10] = false;
  
  var bundle = getLocaleBundle(locale, "common/numbers.properties");
  for (var i=0; i<=9; i++) {
    var n = null;
    try {n = bundle.GetStringFromName("n" + String(i));}
    catch(er) {n = null;}
    if (n && (/^\s*$/).test(n)) n = null;
    if (n) localnumbers[locale][10] = true;
    localnumbers[locale][i] = (n ? n:i);
  }
//jsdump(uneval(localnumbers));
}


/************************************************************************
 * DYNAMIC CSS FUNCTIONS
 ***********************************************************************/ 

// This should be called during onload of every .xul or .html file. It
// creates the CSS classes for locales and modules and adds them to the
// current stylesheet. It also sets the attributes used by CSS to control
// direction (rtl or ltr).
function initCSS(adjustableFontSize) {
	if (typeof(AllWindows) != "undefined") {
		var i = AllWindows.indexOf(window);
		if (i == -1) AllWindows.push(window);
	}
  
  // If we don't have LocaleConfigs yet, set LocaleConfigs of current locale.
  if (typeof(LocaleConfigs) == "undefined") {
    var lc = getLocale();
    LocaleConfigs = {};
    LocaleConfigs[lc] = getLocaleConfig(lc);
  }
  
  // If we don't have ProgramConfig, make it. If we don't have ModuleConfigs
  // that's perfectly ok to leave empty
  if (typeof(ProgramConfig) == "undefined") {
    ProgramConfig = deepClone(LocaleConfigs[getLocale()]);
    ProgramConfig.StyleRule = createStyleRule(".cs-Program", ProgramConfig);
    ProgramConfig.TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(Program)", ProgramConfig);
  }

  // Create and append font, module and locale specific CSS rules to stylesheet
  createDynamicCssClasses();

  setUserFontSize(getPrefOrCreate('FontSize', "Int", 0));

  // Both XUL and HTML documents are given cs-Program class. Also, the  
  // chromedir attribute is added to each document's root element. The  
  // chromedir attribute can be used in CSS selectors to select according 
  // to the the program locale's direction. Although Firefox provides the
  // :-moz-locale-dir CSS pseudoclass for selecting by locale direction,
  // this should usually NOT be used for xulsword CSS. Since some parts
  // of xulsword may come from the Firefox locale (ie. print functions)
  // we need to use chromedir, which is independent of the Firefox method.
  // NOTE: Firefox did use chromedir for CSS selection in the past, but 
  // modern versions do not use it anymore.
  
  // If this is an HTML document...
  var root = document.getElementsByTagName("body");
  if (root.length) {
    root[0].setAttribute("chromedir", ProgramConfig.direction);
    root[0].className += (root[0].className ? " ":"") + "cs-Program" + (adjustableFontSize ? " userFontSize":" fixedFontSize");
  }
  
  // If this is a XUL document...
  if (!root.length) {
    root = document.getElementsByTagName('*')[0];
    root.setAttribute("chromedir", ProgramConfig.direction);
    var c = root.getAttribute("class");
    root.setAttribute("class", (c ? c + " " :"") + "cs-Program" + (adjustableFontSize ? " userFontSize":" fixedFontSize"));
  }

}

// Will add/update CSS classes for fonts, locales and modules in last style sheet.
// Replaces any existing identical selector or else appends a new one.
function createDynamicCssClasses() {
	var sheetIndex = document.styleSheets.length-1;
  var sheet = document.styleSheets[sheetIndex];
  if (!sheet) return;

	//var debug = sheet.cssRules.length;

	// create CSS rules for LocaleConfigs and ModuleConfigs
  var configProps = ["StyleRule", "TreeStyleRule"];
	for (var cp=0; cp<configProps.length; cp++) {
		var configProp = configProps[cp];
		
		if (typeof(LocaleConfigs) != "undefined" && LocaleConfigs) {
			for (var lc in LocaleConfigs) {
				var ex = getCSS(LocaleConfigs[lc][configProp].replace(/\s*\{.*$/, ""), sheetIndex);
				if (ex) sheet.deleteRule(ex.index);
				sheet.insertRule(LocaleConfigs[lc][configProp], sheet.cssRules.length);
	//jsdump(LocaleConfigs[lc][configProp]);
				}
		}
		
		if (typeof(ModuleConfigs) != "undefined" && ModuleConfigs) {
			for (var m in ModuleConfigs) {
				ex = getCSS(ModuleConfigs[m][configProp].replace(/\s*\{.*$/, ""), sheetIndex);
				if (ex) sheet.deleteRule(ex.index);
				sheet.insertRule(ModuleConfigs[m][configProp], sheet.cssRules.length);
	//jsdump(ModuleConfigs[m][configProp]);
			}
		}
		
		if (typeof(XS_window) != "undefined" && XS_window && 
				typeof(XS_window.ModuleConfigDefault) != "undefined" && XS_window.ModuleConfigDefault) {
			ex = getCSS(XS_window.ModuleConfigDefault[configProp].replace(/\s*\{.*$/, ""), sheetIndex);
			if (ex) sheet.deleteRule(ex.index);
			sheet.insertRule(XS_window.ModuleConfigDefault[configProp], sheet.cssRules.length);
	//jsdump(XS_window.ModuleConfigDefault[configProp]);
		}
		
		if (typeof(ProgramConfig) != "undefined" && ProgramConfig) {
			ex = getCSS(ProgramConfig[configProp].replace(/\s*\{.*$/, ""), sheetIndex);
			if (ex) sheet.deleteRule(ex.index);
			sheet.insertRule(ProgramConfig[configProp], sheet.cssRules.length);
	//jsdump(ProgramConfig[configProp]);
		}
	}

	// create CSS rules for fonts
	if (typeof(FontFaceConfigs) != "undefined" && FontFaceConfigs) {
		for (var ff in FontFaceConfigs) {
			var rule = "@font-face {font-family:" + ff + "; src:url(\"" + FontFaceConfigs[ff] + "\");}";
			ex = getCSS(rule.replace(/src\:.*$/, ""), sheetIndex);
			if (ex) sheet.deleteRule(ex.index);
			sheet.insertRule(rule, sheet.cssRules.length);
		}
	}
  
//if (sheet.cssRules.length != debug) jsdump(window.name + ": \nADDED " + (sheet.cssRules.length - debug) + " new dynamic " + configProp + " rules (" + sheet.cssRules.length + ")");
}

function createStyleRule(selector, config) {
  var rule = selector + " {";
  for (var p in Config) {
    if (!Config[p].CSS || config[p] == "unspecified") continue;
    rule += Config[p].CSS + ":" + config[p] + "; ";
  }
  rule += "}";

//jsdump(rule);
  return rule;
}

// The userFontSize class in all stylesheets is dynamically updated by this routine.
var StartingFont = {};
function setUserFontSize(delta) {
  // Don't let font get too small
  if (delta < -2) delta = -3;
  if (!document || !document.styleSheets || !document.styleSheets.length) return;
  
  for (var ssn=0; ssn < document.styleSheets.length; ssn++) {
    for (var z=0; document.styleSheets[ssn].cssRules && z<document.styleSheets[ssn].cssRules.length; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(".userFontSize") == -1) continue;
      if (!StartingFont["ssn" + ssn + "z" + z]) {
          StartingFont["ssn" + ssn + "z" + z] = Number(myRule.style.fontSize.match(/(\d+)/)[0]);
      }
      myRule.style.fontSize = Number(StartingFont["ssn" + ssn + "z" + z] + delta) + "px";
    }
  }
}

function getLocaleConfig(lc) {
  var localeConfig = {};

  var b = getLocaleBundle(lc, "common/config.properties");

  // All config properties should have a valid value, and it must not be null.
  // Read values from locale's config.properties file
  for (var p in Config) {
    if (!Config[p].localeConf) continue;
    var val = b.GetStringFromName(Config[p].localeConf);
    if ((/^\s*$/).test(val)) val = NOTFOUND;
    
    
    if (val == NOTFOUND && Config[p].CSS && LocaleConfigDefaultCSS[p]) {
      val = LocaleConfigDefaultCSS[p];
    }
    
    localeConfig[p] = val;
  }
 
  localeConfig["AssociatedLocale"] = lc;
  
  // Insure there are single quotes around font names
  localeConfig.fontFamily = localeConfig.fontFamily.replace(/\"/g, "'");
  if (localeConfig.fontFamily != NOTFOUND && !(/'.*'/).test(localeConfig.fontFamily)) 
      localeConfig.fontFamily = "'" + localeConfig.fontFamily + "'";

  // Save the CSS style rules for this locale, which can be appended to CSS stylesheets
  localeConfig.StyleRule = createStyleRule(".cs-" + lc, localeConfig);
  localeConfig.TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(" + lc + ")", localeConfig);
  
  return localeConfig;
}

// This function returns the FIRST rule matching the selector from the
// given style sheet, or the first of all style sheets if sheet not specified.
function getCSS(selector, sheetIndex) {
  selector = new RegExp("^" + escapeRE(selector));

  var ss1 = 0;
  var ss2 = document.styleSheets.length-1;
  if (sheetIndex != null) {
		ss1 = sheetIndex;
		ss2 = sheetIndex;
	}
  
  var myRule = null;
  for (var ssn=ss1; ssn <= ss2; ssn++) {
    try {var zend = document.styleSheets[ssn].cssRules.length;} catch (er) {zend = 0;}
    for (var z=0; z<zend; z++) {
      var myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(selector) != -1) return {rule:myRule, sheet:ssn, index:z};
    }
  }
  return null;
}


/************************************************************************
 * MISC FUNCTIONS
 ***********************************************************************/ 

// Returns the number of a given short book name
function findBookNum(bText) {
  var retv=null;
  for (var b=0; typeof(Book) != "undefined" && b < Book.length; b++)  {
    if (Book[b].sName == bText) {retv = b;}
  }
  return retv;
}

// Returns the number of a given long book name
function findBookNumL(bText) {
  var retv=null;
  for (var b=0; typeof(Book) != "undefined" && b < Book.length; b++)  {
    if (Book[b].bNameL == bText) {retv = b;}
  }
  return retv;
}

function isProgramPortable() {
  var appInfo = prefs.getCharPref("BuildID");
  return (appInfo && appInfo.substr(appInfo.length-1) == "P");
}
IsPortable = isProgramPortable();

function openWindowXS(url, name, args, windowtype, parentWindow) {
	if (!parentWindow) parentWindow = window;
	
	var existingWin = null;
	if (windowtype) {
		existingWin = Components.classes['@mozilla.org/appshell/window-mediator;1'].
		getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow(windowtype);
	}
	else name += "-" + Math.round(10000*Math.random());
	
	if (existingWin) {
		existingWin.focus();
		return existingWin;
	}
	
	return window.open(url, name, args);
}

function closeWindowXS(aWindow) {
	if (typeof(AllWindows) == "object" && 
			AllWindows instanceof Array && 
			AllWindows.length) {
		var i = AllWindows.indexOf(aWindow);
		if (i != -1) AllWindows.splice(i, 1);
	}
	aWindow.close();
}

// DEBUG helps
/*
function debugStyle(elem) {
  var s = window.getComputedStyle(elem);
  for (var m in s) {
    jsdump(m + " = " + s[m]);
  }
}

function printGLobOps() {
  var m = "";
  for (var cmd in GlobalToggleCommands) {
    if (GlobalToggleCommands[cmd] == "User Notes") continue;
    m += GlobalToggleCommands[cmd] + "=" + LibSword.getGlobalOption(GlobalToggleCommands[cmd]) + " ";
  }
  jsdump(m);
}
*/
