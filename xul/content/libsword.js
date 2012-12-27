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

/*
SPECIAL SWORD MODULE CONFIGURATION FILE PARAMETERS (OPTIONAL):
Valid for all modules:
  "Font" - The font to use for the module
  "FontSizeAdjust" - The relative size of the module's font
  "LineHeight" - The relative line height of the module's font
  "xulswordVersion" - Min version of xulsword this SWORD mod is compatible with

Valid for Bible modules:
  "OriginalTabTestament" - If set to "OT" or "NT", an ORIG tab will be available,
      and this module will be shown (in interlinear format) when it is activated.
  "DictionaryModule" - Associate a dictionary with the module. There may be
      more than one DictionaryModule entry.
  "AudioCode" - Audio files located in this directory (within the Audio dir) will
      be avaialble in this Bible module.
  "NoticeLink" and "NoticeText" - Used to display a prominent message about a text.

Valid for Dictionary modules:
  "LangSortOrder" - Allows for sorting entries alphabetically in any language.
  "LangSortSkipChars" - Used in conjunction with LangSortOrder
  "ReferenceBible" - Preffered Bible module to use for Scripture references.
*/

// as a ChromeWorker, Components is not available but ctypes automatically is,
// so don't import ctypes again in that case...
if (typeof(ctypes) == "undefined") Components.utils.import("resource://gre/modules/ctypes.jsm");


LibSword = {
  libsword:null,        // reference to the libxulsword dynamic library
  inst:null,            // the LibSword (xulsword) instance returned by libxulsword
  callback:null,        // an object used to implement callbacks from Javascript
  fdata:null,
  paused:false,
  freeMemory:null,      // to free memory allocated by libxulsword
  freeLibxulsword:null, // to free memory allocated to libxulsword
  
  ModuleDirectory:null,
  LibswordPath:null,
  CheckTheseCipherKeys:[],
  hasBible:null,
  loadFailed:null,

  initLibsword: function() {
    if (this.loadFailed) return; // if we already failed to load don't keep trying
    
    if (typeof(jsdump) != "undefined") jsdump("Initializing libsword...");
    
    if (this.libsword) return;
    
    this.fdata = {};

    // get paths to local directories in which SWORD modules are (or will be) located
    if (!this.ModuleDirectory) {
      // NOTE: getSpecialDirectory is not available from within a ChromeWorker, so 
      // ModuleDirectory must be explicitly set on the LibSword object in such case.
      this.ModuleDirectory = getSpecialDirectory("xsResD").path;
      if (IsExtension) this.ModuleDirectory += ", " + getSpecialDirectory("xsExtResource").path;
    }

    // get path to libxulsword dynamic library built from C++ SWORD engine
    if (!this.LibswordPath) {
      var dll = (OPSYS == "Windows" ? "xulsword.dll":"libxulsword.so");
      if (!IsExtension) {this.LibswordPath = getSpecialDirectory("CurProcD").path + "/" + dll;}
      else {
        // NOTE: getSpecialDirectory is not available from within a ChromeWorker, so 
        // LibswordPath must be explicitly set on the LibSword object in such case.
        this.LibswordPath = getSpecialDirectory("xsExtension").path + "/" + APPLICATIONID + "/" + dll;
      }
    }
    
    // get our libxulsword instance
    try {this.libsword = ctypes.open(this.LibswordPath);}
    catch (er) {
      window.alert("Could not load " + this.LibswordPath);
      if (OPSYS == "Linux") {window.alert("These Linux libraries must be installed:	libz, libm, libc, libstdc++, libgcc_s, libpthread");}
      this.loadFailed = true;
      this.libsword = null;
      return;
    }
    
    // assign a function for freeing memory allocated by LibSword
    this.freeMemory = this.libsword.declare("FreeMemory", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t, ctypes.PointerType(ctypes.char));
    
    // assign a function for freeing memory allocated to LibSword itself
    this.freeLibxulsword = this.libsword.declare("FreeLibxulsword", ctypes.default_abi, ctypes.void_t);

    this.initInstance();
    
    // when starting, read our xulsword prefs if they're available...
    if (typeof(prefs) != "undefined" && prefs && Location && Location.setLocation) {
      Location.setLocation(WESTERNVS, getPrefOrCreate("Location", "Char", "Gen.1.1.1"));
      for (var cmd in GlobalToggleCommands) {
        if (GlobalToggleCommands[cmd] == "User Notes") continue;
        LibSword.setGlobalOption(GlobalToggleCommands[cmd], getPrefOrCreate(GlobalToggleCommands[cmd], "Char", "On"));
      }
    }
    
    this.loadFailed = false;
  },
  
  initInstance: function() {
    var funcTypeUpperCasePtr = ctypes.FunctionType(ctypes.default_abi, ctypes.PointerType(ctypes.char), [ctypes.ArrayType(ctypes.char)]).ptr;
    this.UpperCasePtr = funcTypeUpperCasePtr(this.UpperCase);

    var funcTypeThrowJSErrorPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.PointerType(ctypes.char)]).ptr;
    this.ThrowJSErrorPtr = funcTypeThrowJSErrorPtr(this.ThrowJSError);

    var funcTypeReportProgressPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.int]).ptr;
    this.ReportProgressPtr = funcTypeReportProgressPtr(this.ReportProgress);
    
    var newXulsword = this.libsword.declare("GetXulsword", ctypes.default_abi, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), funcTypeUpperCasePtr, funcTypeThrowJSErrorPtr, funcTypeReportProgressPtr);
    this.inst = newXulsword(ctypes.char.array()(this.ModuleDirectory), this.UpperCasePtr, this.ThrowJSErrorPtr, this.ReportProgressPtr);
    if (typeof(jsdump) != "undefined") jsdump("CREATED new xulsword object (window.name=" + (typeof(window)!="undefined" && window ? window.name:"<no-window>") + ")");
    if (typeof(jsdump) != "undefined") jsdump("ModuleDirectory=\"" + this.ModuleDirectory + "\""); 
  },
  
  freeInstance: function() {
    
    if (this.inst) {
      this.freeMemory(this.inst, ctypes.char.array()("xulsword"));
      this.inst = null;
    }
    
  },
  
  quitLibsword: function() {
    if (this.libsword) {
      this.freeInstance();
      this.freeLibxulsword();
      this.libsword.close();
    }
    
    this.libsword = null;
    this.loadFailed = null;
    this.hasBible = null;
    this.fdata = null;
    
    if (typeof(jsdump) != "undefined") 
        jsdump("CLOSED libsword (window.name=" + (typeof(window)!="undefined" && window ? window.name:"<no-window-name>") + ")");
  
  },
  
  // pause() saves LibSword info and closes LibSword so that it may be 
  // re-opened by another thread. pause() should only be called at the 
  // end of a thread if LibSword has already been initialized. In this 
  // case, any required processing after pausing should be initiated 
  // by callback.libswordPauseComplete().
  pause: function(callback) {
    
    // already paused, or not yet initialized? then just callback now...
    if (this.paused || !this.libsword) {
      this.paused = true;
      if (callback && typeof(callback.libswordPauseComplete) == "function")
          callback.libswordPauseComplete();
      return;
    }
    
    // When pausing, save current global option settings of this libsword 
    // object, because that way they will be recovered when we resume.
    if (typeof(prefs) != "undefined" && prefs && Location) {
      for (var cmd in GlobalToggleCommands) {
        if (GlobalToggleCommands[cmd] == "User Notes") continue;
        prefs.setCharPref(GlobalToggleCommands[cmd], LibSword.getGlobalOption(GlobalToggleCommands[cmd]));
      }
    }
    
    // prevent UI events from calling LibSword functions while LibSword is paused!
    this.allWindowsModal(true);
    
    // save our callback if requested
    this.callback = (callback && typeof(callback.libswordPauseComplete) == "function" ? callback:null);

    // call quitLibsword only after any currently pending calls to LibSword have been handled
    window.setTimeout(function() {
      LibSword.quitLibsword(); 
      LibSword.paused = true;
      if (LibSword.callback) {
        LibSword.callback.libswordPauseComplete();
      }
      LibSword.callback = null;
    }, 1);
    
  },

  resume: function() {
    if (!this.paused) return;
    
    this.paused = false;
    
    this.unlock();
    
    if (!this.hasBible && typeof(jsdump) != "undefined")
        jsdump("LibSword resumed with no Bible modules.");
        
    this.allWindowsModal(false);
    
  },

  // unlock encrypted SWORD modules
  unlock: function() {
    var mlist = this.getModuleList();
    if (!mlist || mlist == "No Modules" || mlist.search(BIBLE) == -1) {
      this.hasBible = false;
      return;
    }
    this.hasBible = true;
    
    var msg = "";
    var mods = mlist.split("<nx>");
    for (var m=0; m<mods.length; m++) {
      var mod = mods[m].split(";")[0];
      var type = mods[m].split(";")[1];
      
      if (type != BIBLE) continue; // only Bible modules are encrypted
      
      // We don't need to supply a cipher key if the CipherKey conf
      // entry is not present (the module is not encrypted) or else if 
      // it is present with a value (cipher key is supplied in conf file).
      if (!(/^\s*$/).test(this.getModuleInformation(mod, "CipherKey"))) continue;
      
      // The module is encrypted but the CipherKey is not supplied in the
      // .conf file. So we need to get a key from prefs or from the 
      // xulsword security module.
      var cipherKey;
      try {cipherKey = getPrefOrCreate("CipherKey" + mod, "Char", prefs.getCharPref("DefaultCK"));}
      catch (er) {cipherKey = "0";}
      var useSecurityModule = this.usesSecurityModule(mod);
      this.setCipherKey(mod, cipherKey, useSecurityModule);
      
      // If our key is from prefs, then later on check that it works,
      // and if it does not, the user should be asked to enter a 
      // different key.
      if (!useSecurityModule) this.CheckTheseCipherKeys.push(mod);
      
      if (cipherKey) msg += mod + "(" + cipherKey + ") ";
    }
    if (typeof(jsdump) != "undefined" && msg != "") {jsdump("Opening:" + msg + "\n");}

  },
  
  usesSecurityModule: function(mod) {
    if (this.getModuleInformation(mod, "CipherKey") != "") return false;
    
    //checking "ProducedFor" is for backward compatibility to modules before version 2.7
    return ((this.getModuleInformation(mod, VERSIONPAR) != NOTFOUND || 
        this.getModuleInformation(mod, "ProducedFor") == "xulsword") ? true:false);
  },

  allWindowsModal: function(setModal) {
    if (!MainWindow) return;
    for (var i=0; MainWindow.AllWindows && i<MainWindow.AllWindows.length; i++) {
      this.windowModal(MainWindow.AllWindows[i], setModal);
    }
  },

  windowModal: function(win, setModal) {
    var events = ["dragstart", "drop", "click", "mousewheel", "mouseover", "mouseout", "mousemove", "mousedown",
              "mouseup", "dblclick", "select", "keydown", "keypress", "keyup", "contextmenu"];
    if (setModal) {
      for (var i=0; i<events.length; i++){
        win.addEventListener(events[i], this.stopevent, true);
      }
    }
    else {
      for (var i=0; i<events.length; i++){
        win.removeEventListener(events[i], this.stopevent, true);
      }
    }
  },
  
  stopevent: function(event) {event.stopPropagation(); event.preventDefault();},

  // reports last error logged by previous LibSword call
  checkerror: function() {
    if (this.throwMsg) {
      var tmp = this.throwMsg;
      this.throwMsg = "";
      if (typeof(jsdump) != "undefined") jsdump("THROW: libsword, " + tmp);
      throw(new Error("THROW: libsword, " + tmp));
    }
  },
  
  libSwordReady: function(caller) {
    if (this.paused) throw(new Error("libsword paused, \"" + caller + "\" inaccessible."));
    
    if (!this.libsword) this.initLibsword();
    if (this.loadFailed) return false;
    
    if (!this.inst) this.initInstance();
    if (!this.inst) return false;
    
    return true;
  },

/*******************************************************************************
 * Callback functions available to libsword binary
 ******************************************************************************/
 
// NOTE: these are invoked as functions by libsword, so "this" will refer to global context!

upperCaseResult:"",
UpperCase: function(charPtr) {
  var aString = charPtr.readString();
  if (aString) {
    LibSword.upperCaseResult = ctypes.char.array()(aString.toUpperCase());
    return LibSword.upperCaseResult; // assigning to LibSword member keeps pointer alive
  }
  else return null;
},

throwMsg:"",
ThrowJSError: function(charPtr) {
  var aString = charPtr.readString();
  LibSword.freeMemory(charPtr, ctypes.char.array()("char"));
  if (aString) LibSword.throwMsg = aString;
  else LibSword.throwMsg = "An unknown libsword exception occurred."; 
},

ReportProgress: function(intgr) {
  // NOTE: postMessage is a ChromeWorker function
  if (typeof(postMessage) == "function") postMessage(intgr);
},


/*******************************************************************************
* GETTING BIBLE TEXT AND BIBLE LOCATION INFORMATION:
*******************************************************************************/
/*
DEFINITION OF A "XULSWORD REFERENCE":
  Xulsword references don't cross chapter boundaries. The smallest reference
  is to a single verse, and the largest is to a whole chapter. Xulsword references
  take one of the following forms:

  Preffered forms (because most xulsword subroutines use these forms). These forms are
  often refered to as locations:
    Gen.5             --> Genesis chapter 5 (in this case Verse=1 and LastVerse=maxverse)
    Gen.5.6           --> Genesis chapter 5 verse 6 (in this case LastVerse=Verse)
    Gen.5.6.7         --> Genesis chapter 5 verses 6 through 7

  Other valid forms (but may need subsequent conversion for use by some subroutines in xulsword):
    Gen 5             --> same as Gen.5
    Gen 5:6           --> same as Gen.5.6
    Gen 5:6-7         --> same as Gen.5.6.7

  Valid form, but may not always return what is expected:
    Gen 5:6 - Gen 5:7 --> same as Gen.5.6.7 but note that the book and chapter
                          number mentioned after the "-" are completely ignored,
                          and only the verse is used (because xulsword references
                          never cross chapter boundaries).
*/
                          
// getChapterText
//Will return a chapter of text with footnote markers from module Vkeymod.
//Vkeymod must be a module having a key type of versekey (Bibles & commentaries),
//  otherwise null is returned.
getChapterText: function(modname, vkeytext) {
  if (!this.libSwordReady("getChapterText")) return null;
  if (!this.fdata.gct)
    this.fdata.gct = this.libsword.declare("GetChapterText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gct(this.inst, ctypes.char.array()(modname), ctypes.char.array()(vkeytext));
  this.checkerror();
  var str = cdata.readString();//} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getChapterTextMulti
//Will return chapter text in interlinear style.
//Footnote markers are NOT included.
//Vkeymodlist is formatted as follows: "UZV,TR,RSTE". The first module must be a
//  versekey module or an error is returned. If any successive module is not a
//  versekey module, it is simply ignored. Verse numbers retured are those of
//  the first module listed, subsequent modules return the same reference as
//  that returned by the first, even though it may have come from a different
//  chapter or verse number than did the first.
getChapterTextMulti: function(modstrlist, vkeytext) {
  if (!this.libSwordReady("getChapterTextMulti")) return null;
  if (!this.fdata.ctm)
    this.fdata.ctm = this.libsword.declare("GetChapterTextMulti", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.ctm(this.inst, ctypes.char.array()(modstrlist), ctypes.char.array()(vkeytext));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

//IMPORTANT: THE FOLLOWING 3 ROUTINES MUST BE CALLED AFTER getChapterText IS CALLED!

// getFootnotes
//Will return the footnotes (or empty string if there aren't any).
//See * below.
getFootnotes:function() {
  if (!this.libSwordReady("getFootnotes")) return null;
  if (!this.fdata.gfn)
    this.fdata.gfn = this.libsword.declare("GetFootnotes", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gfn(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getCrossRefs
//Will return the cross references (or empty string if there aren't any).
//See * below.
getCrossRefs:function() {
  if (!this.libSwordReady("getCrossRefs")) return null;
  if (!this.fdata.gcr)
    this.fdata.gcr = this.libsword.declare("GetCrossRefs", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gcr(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getNotes
//Will return both footnotes and cross references interleaved.
//See * below.
//order is: v1-footnotes, v1-crossrefs, v2-footnotes, v2-crossrefs, etc
getNotes:function() {
  if (!this.libSwordReady("getNotes")) return null;
  if (!this.fdata.gns)
    this.fdata.gns = this.libsword.declare("GetNotes", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gns(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getVerseText
//Will return the requested verse(s) as raw text, without features such as
//  verse numbers, note markers, red-words-of-Christ etc.
//Vkeymod is the module from which to return text. If it's not a versekey
//  type module, an error is returned.
//Vkeytext is the "xulsword reference" (see definition above) from which to
//  return the text.
getVerseText: function(vkeymod, vkeytext) {
  if (!this.libSwordReady("getVerseText")) return null;
  if (!this.fdata.vtx)
    this.fdata.vtx = this.libsword.declare("GetVerseText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.vtx(this.inst, ctypes.char.array()(vkeymod), ctypes.char.array()(vkeytext));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getMaxChapter
//Returns the maximum chapter number of the chapter refered to by the
//  xulsword reference Vkeytext, when using the verse system of Mod.
getMaxChapter: function(modname, vkeytext) {
  if (!this.libSwordReady("getMaxChapter")) return null;
  if (!this.fdata.gmc)
    this.fdata.gmc = this.libsword.declare("GetMaxChapter", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.gmc(this.inst, ctypes.char.array()(modname), ctypes.char.array()(vkeytext));
  this.checkerror();
  return intgr;
},

// getMaxVerse
//Returns the maximum verse number of the chapter refered to by the
//  xulsword reference Vkeytext, when using the verse system of Mod.
getMaxVerse: function(modname, vkeytext) {
  if (!this.libSwordReady("getMaxVerse")) return null;
  if (!this.fdata.gmv)
    this.fdata.gmv = this.libsword.declare("GetMaxVerse", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.gmv(this.inst, ctypes.char.array()(modname), ctypes.char.array()(vkeytext));
  this.checkerror();
  return intgr;
},

// getVerseSystem
//Returns the verse system of module Mod.
getVerseSystem: function(modname) {
  if (!this.libSwordReady("getVerseSystem")) return null;
  if (!this.fdata.gsy)
    this.fdata.gsy = this.libsword.declare("GetVerseSystem", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gsy(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// convertLocation
//Returns location (ie Gen.5.6.7) of Vkeytext (a xulsword reference) in
//  FromVerseSystem as it would be specified in ToVerseSystem (so given
//  Ps 119:1 from "KJV", it would return Ps.118.1.1 when converted to
//  "Synodal" or "EASTERN" verse systems).
//Returned value is always of the form shortBook.chapter.verse.lastVerse
convertLocation: function(fromVerseSystem, vkeytext, toVerseSystem) {
  if (!this.libSwordReady("convertLocation")) return null;
  if (!this.fdata.clo)
    this.fdata.clo = this.libsword.declare("ConvertLocation", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.clo(this.inst, ctypes.char.array()(fromVerseSystem), ctypes.char.array()(vkeytext), ctypes.char.array()(toVerseSystem));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},


/*******************************************************************************
* RETRIEVING FOOTNOTES, CROSS REFERENCES, INTRODUCTIONS, DICTIONARY ENTRIES, ETC.:
*******************************************************************************/
// getBookIntroduction
//Will return the introduction for a given short book name in module Vkeymod,
//  if one exists in the version. If there is not introduction, "" is returned.
//If Vkeymod is not a versekey type module, an error is returned.
getBookIntroduction: function(vkeymod, bname) {
  if (!this.libSwordReady("getBookIntroduction")) return null;
  if (!this.fdata.git)
    this.fdata.git = this.libsword.declare("GetBookIntroduction", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.git(this.inst, ctypes.char.array()(vkeymod), ctypes.char.array()(bname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getDictionaryEntry
//Will return the dictionary entry, or "" if the entry is not found.
//An exception is thrown if the dictionary itself is not found, or if the
//  Lexdictmod is not of type StrKey.
getDictionaryEntry: function(lexdictmod, key) {
  if (!this.libSwordReady("getDictionaryEntry")) return null;
  if (!this.fdata.gdi)
    this.fdata.gdi = this.libsword.declare("GetDictionaryEntry", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gdi(this.inst, ctypes.char.array()(lexdictmod), ctypes.char.array()(key));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getAllDictionaryKeys
//Returns all keys in form key1<nx>key2<nx>key3<nx>
//Returns an error is module Lexdictmod is not of type StrKey
getAllDictionaryKeys: function(lexdictmod) {
  if (!this.libSwordReady("getAllDictionaryKeys")) return null;
  if (!this.fdata.gdk)
    this.fdata.gdk = this.libsword.declare("GetAllDictionaryKeys", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gdk(this.inst, ctypes.char.array()(lexdictmod));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getGenBookChapterText
//Returns chapter text for key Treekey in GenBook module Gbmod.
//Returns an error if module Gbmod is not a TreeKey mod.
getGenBookChapterText:function(gbmod, treekey) {
  if (!this.libSwordReady("getGenBookChapterText")) return null;
  if (!this.fdata.gbt)
    this.fdata.gbt = this.libsword.declare("GetGenBookChapterText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gbt(this.inst, ctypes.char.array()(gbmod), ctypes.char.array()(treekey));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getGenBookTableOfContents
//Returns table of contents RDF code for GenBook module Gbmod.
//Returns an error if module Gbmod is not a TreeKey mod.
getGenBookTableOfContents: function(gbmod) {
  if (!this.libSwordReady("getGenBookTableOfContents")) return null;
  if (!this.fdata.gtc)
    this.fdata.gtc = this.libsword.declare("GetGenBookTableOfContents", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gtc(this.inst, ctypes.char.array()(gbmod));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},


/******************************************************************************
* SEARCHING: USE THESE TO SEARCH MODULES:
******************************************************************************/
// luceneEnabled
//Will return true if indexed searching is available for the current module, false otherwise.
luceneEnabled: function(modname) {
  if (!this.libSwordReady("luceneEnabled")) return null;
  if (!this.fdata.lce)
    this.fdata.lce = this.libsword.declare("LuceneEnabled", ctypes.default_abi, ctypes.bool, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var bool = this.fdata.lce(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  return bool;
},

// search
//Returns the number of matches found
//Mod is the version to search
//Srchstr is the string you want to search for.
//Scope is the scope of the search. For example: "Gen", or "Matt-Rev".
//type is the type of search which can take one of the following values:
// >=0 - regex (use C++ regex matching)
//  -1 - phrase (only matches EXACTLY the text- including punctuation etc!)
//  -2 - multiword (match verses that contain all the words in any form or order)
//  -3 - entryAttribute (eg. Word//Strongs/G1234/) NOT TESTED.
//  -4 - Lucene fast indexed search (if index is available)
//  -5 - a compound search
//flags are many useful flags as defined in regex.h
//newsearch should be set to false if you want the search results added to the previous results
search: function(modname, srchstr, scope, type, flags, newsearch) {
  if (!this.libSwordReady("search")) return null;
  if (!this.fdata.sch)
    this.fdata.sch = this.libsword.declare("Search", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.int, ctypes.int, ctypes.bool);
  var intgr = this.fdata.sch(this.inst, ctypes.char.array()(modname), ctypes.char.array()(srchstr), ctypes.char.array()(scope), type, flags, newsearch);
  this.checkerror();
  return intgr;
},

// getSearchVerses
//UNEMPLEMENTED AS YET. Returns a list of verse addresses which matched the previous search.
getSearchVerses: function(modname) {
  return null;
},

// getSearchResults
//Will return the verse texts from previous search.
//See * below
getSearchResults: function(modname, first, num, keepStrongs) {
  if (!this.libSwordReady("getSearchResults")) return null;
  if (!this.fdata.gst)
    this.fdata.gst = this.libsword.declare("GetSearchResults", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.int, ctypes.int, ctypes.bool);
  var cdata = this.fdata.gst(this.inst, ctypes.char.array()(modname), first, num, keepStrongs);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// searchIndexDelete
//Deletes the search index of modname.
searchIndexDelete: function(modname) {
  if (!this.libSwordReady("searchIndexDelete")) return;
  if (!this.inst) this.initInstance();
  if (!this.fdata.sid)
    this.fdata.sid = this.libsword.declare("SearchIndexDelete", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  this.fdata.sid(this.inst, modname);
  this.checkerror();
},

//**************** CHANGED! removed maxwait and return value*************************
// searchIndexBuild
//Before starting to build a new search index, call "searchIndexDelete()"
//CAUTION: Do not call any LibSword functions other than getPercentComplete until
//getPercentComplete returns 100!
searchIndexBuild: function(modname) {
  if (!this.libSwordReady("searchIndexBuild")) return;
  if (!this.fdata.sib)
    this.fdata.sib = this.libsword.declare("SearchIndexBuild", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  this.fdata.sib(this.inst, ctypes.char.array()(modname));
  this.checkerror();
},


/******************************************************************************
* SETTING/READING GLOBAL OPTIONS FOR RENDERING SCRIPTURE TEXTS:
******************************************************************************/
// setGlobalOption
//"Option" is one of the following and can have a "Setting" of either "Off" or "On":
//  "Footnotes"
//  "Headings"
//  "Cross-references"
//  "Words of Christ in Red"
//  "Verse Numbers"
//  "Hebrew Cantillation"
//  "Hebrew Vowel Points"
setGlobalOption: function(option, setting) {
  if (!this.libSwordReady("setGlobalOption")) return;
  if (!this.fdata.sgo)
    this.fdata.sgo = this.libsword.declare("SetGlobalOption", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  this.fdata.sgo(this.inst, option, setting);
  this.checkerror();
},

// getGlobalOption
//Option must one of the above option strings. Either "Off" or "On" will be returned.
getGlobalOption: function(option) {
  if (!this.libSwordReady("getGlobalOption")) return null;
  if (!this.fdata.ggo)
    this.fdata.ggo = this.libsword.declare("GetGlobalOption", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.ggo(this.inst, ctypes.char.array()(option));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},


/******************************************************************************
* PROVIDING THE DECRYPTION KEY:
******************************************************************************/
// setCipherKey
//Will set the module's key. Key can only be set once.
setCipherKey: function(modname, cipherKey, useSecModule) {
  if (!this.libSwordReady("setCipherKey")) return;
  if (!this.fdata.sck)
    this.fdata.sck = this.libsword.declare("SetCipherKey", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.bool);
  this.fdata.sck(this.inst, ctypes.char.array()(modname), ctypes.char.array()(cipherKey), useSecModule);
  this.checkerror();
},


/*******************************************************************************
* READING MODULE LIST AND MODULE INFORMATION:
*******************************************************************************/
// getModuleList
//Returns a string of form: name1;type1<nx>name2;type2<nx> etc...
//Returns "No Modules" if there are no modules available.
getModuleList: function() {
  if (!this.libSwordReady("getModuleList")) return null;
  if (!this.fdata.gml)
    this.fdata.gml = this.libsword.declare("GetModuleList", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gml(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
},

// getModuleInformation
//Paramname can be anything that is in the module's .conf file.
//Returns Paramname from conf file of module Mod.
//Returns NOTFOUND if the Paramname does not exist in the conf file.
//Returns empty string if the module Mod does not exist.
//Returns val1<nx>val2<nx>val3 if there is more than one entry of type infotype (eg. GlobalOptionFilter)
getModuleInformation: function(modname, paramname) {
  if (!this.libSwordReady("getModuleInformation")) return null;
  if (!this.fdata.gmi)
    this.fdata.gmi = this.libsword.declare("GetModuleInformation", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gmi(this.inst, ctypes.char.array()(modname), ctypes.char.array()(paramname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.freeMemory(cdata, ctypes.char.array()("char"));
  return str;
}
}; 


