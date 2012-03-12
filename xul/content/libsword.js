// as a ChromeWorker, Components is not available and automatically ctypes is.
if (typeof ctypes == "undefined") Components.utils.import("resource://gre/modules/ctypes.jsm");

/*
The following is the list of libsword functions to use with Bible objects.
IMPORTANT NOTE: Bibles may have different verse systems. Therefore, when
setting the Book, Chapter and Verse variables, the Version (and thereby the
verse system) must also be provided. Psalm 10 in Synodal is not the same text
as Psalm 10 in KJV for instance.


SPECIAL MODULE CONFIGURATION PARAMETERS (OPTIONAL):
Valid for all modules:
  "Font" - The font to use for the module
  "FontSizeAdjust" - The relative size of the module's font
  "LineHeight" - The relative line height of the module's font

Valid for Bible modules:
  "OriginalTabTestament" - If set to "OT" or "NT", an ORIG tab will be available,
      and this module will be shown (in interlinear format) when it is activated.
  "DictionaryModule" - Associate a dictionary with the module. There may be
      more than one DictionaryModule entry.
  "AudioCode" - Audio files located in this directory (within the Audio dir) will
      be avaialble in this Bible module.

Valid for Dictionary modules:
  "LangSortOrder" - Allows to sort entries alphabetically
  "ReferenceBible" - Bible module to use for Scripture references.


DEFINITION OF A "XULSWORD REFERENCE":
  "xulsword reference"s never cross chapter boundaries. The smallest reference
  is to a single verse, and the largest is to a whole chapter. "xulsword reference"s
  take one of the following forms:

  Preffered forms (because most MK subroutines use these forms). These forms are
  often refered to as "location"s in MK:
    Gen.5             --> Genesis chapter 5 (in this case Verse=1 and LastVerse=maxverse)
    Gen.5.6           --> Genesis chapter 5 verse 6 (in this case LastVerse=Verse)
    Gen.5.6.7         --> Genesis chapter 5 verses 6 through 7

  Other valid forms (but may need subsequent conversion for use by some subroutines in MK):
    Gen 5             --> same as Gen.5
    Gen 5:6           --> same as Gen.5.6
    Gen 5:6-7         --> same as Gen.5.6.7

  Valid form, but may not always return what is expected:
    Gen 5:6 - Gen 5:7 --> same as Gen.5.6.7 but note that the book and chapter
                          number mentioned after the "-" are completely ignored,
                          and only the verse is used (because xulsword references
                          never cross chapter boundaries).

LISTS OF VERSES OR NOTES ARE RETURNED IN THE FOLLOWING FORMAT:
  identifier<bg/>body<nx/>
  Note: the identifier and <bg/> tag are not returned with getSearchVerses()

*/

var Bible = {
  fdata:null,

  inst:null,

  ThrowMSG:"",
  
  paused:false,

  checkerror: function() {
    if (this.ThrowMSG) {
      var msg = this.ThrowMSG;
      this.ThrowMSG = null;
      var er = new Error("libsword, " + msg);
      throw(er);
    }
  },

  Libsword:null,

  ModuleDirectory:null,

  LibswordPath:null,

  initLibsword: function() {
    if (typeof(jsdump) != "undefined") jsdump("Initializing libsword...");
    
    if (this.Libsword) return;

    this.fdata = {};

    var funcTypeUpperCasePtr = ctypes.FunctionType(ctypes.default_abi, ctypes.PointerType(ctypes.char), [ctypes.ArrayType(ctypes.char)]).ptr;
    this.UpperCasePtr = funcTypeUpperCasePtr(this.UpperCase);

    var funcTypeThrowJSErrorPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.ArrayType(ctypes.char)]).ptr;
    this.ThrowJSErrorPtr = funcTypeThrowJSErrorPtr(this.ThrowJSError);

    var funcTypeReportProgressPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.int]).ptr;
    this.ReportProgressPtr = funcTypeReportProgressPtr(this.ReportProgress);

    if (!this.ModuleDirectory) {
      // can't call this in indexWorker...
      this.ModuleDirectory = getSpecialDirectory("xsResD").path;
    }

    if (!this.LibswordPath) {
      if (!IsExtension) this.LibswordPath = "xulsword.dll";
      else {
        // can't call this in indexWorker...
        this.LibswordPath = getSpecialDirectory("xsExtension").path + "/" + APPLICATIONID + "/xulsword.dll";
      }
    }
    this.Libsword = ctypes.open(this.LibswordPath);

    var initSwordEngine = this.Libsword.declare("InitSwordEngine", ctypes.default_abi, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), funcTypeUpperCasePtr, funcTypeThrowJSErrorPtr, funcTypeReportProgressPtr);
    this.inst = initSwordEngine(ctypes.char.array()(this.ModuleDirectory), this.UpperCasePtr, this.ThrowJSErrorPtr, this.ReportProgressPtr);

    this.free = this.Libsword.declare("FreeMemory", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
    
    if (typeof(prefs) != "undefined") {
      Bible.setBiblesReference(WESTERNVS, prefs.getCharPref("Location"));
    }

  },

  quitLibsword: function() {
    if (this.Libsword) {
      if (typeof(prefs) != "undefined") {
        prefs.setCharPref("Location", Bible.getLocation(WESTERNVS));
      }
      this.free(this.inst);
      this.Libsword.close();
      this.Libsword = null;
    }
  },

  // save Bible info and free up libsword for another thread to use.
  pause: function() {
    if (this.paused) return;
    this.allWindowsModal(true);
    this.quitLibsword();
    this.paused = true;
  },

  resume: function() {
    if (!this.paused) return;
    this.paused = false;
    if (!this.unlock())
        throw(new Error("libsword, resumed with no Bible modules."));
    this.allWindowsModal(false);
  },

  unlock: function() {
    var mlist=this.getModuleList();
    if (mlist=="No Modules" || mlist.search(BIBLE)==-1) return false;
    unlockAllModules(this, true);
    return true;
  },

  allWindowsModal: function(setModal) {
    if (!MainWindow) return;
    for (var i=0; i<MainWindow.SearchWins.length; i++) {
      this.windowModal(MainWindow.SearchWins[i], setModal);
    }
    if (MainWindow.ManagerWindow)
      this.windowModal(MainWindow.ManagerWindow, setModal);
    this.windowModal(MainWindow, setModal);
  },

  stopevent: function(event) {event.stopPropagation(); event.preventDefault();},

  windowModal: function(win, setModal) {
    var events = ["click", "mouseover", "mouseout", "mousemove", "mousedown",
              "mouseup", "dblclick", "select", "keydown", "keypress", "keyup"];
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


/*******************************************************************************
 * Callback functions available to libsword binary
 ******************************************************************************/
UpperCase: function(charPtr) {
  var aString = charPtr.readString();
  if (aString) {
    return ctypes.char.array()(aString.toUpperCase());
  }
  else return null;
},

ThrowJSError: function(charPtr) {
  var aString = charPtr.readString();
  if (aString) ThrowMSG = aString;
  else ThrowMSG = "Uknown libsword exception";
},

ReportProgress: function(intgr) {
  if (postMessage) postMessage(intgr);
},

/*******************************************************************************
* GETTING BIBLE TEXT AND BIBLE LOCATION INFORMATION:
*******************************************************************************/

// setBiblesReference
//Choose the Bible reference for all ixulsword instances to work with (it sets
//  the static Book, Chapter, Verse, Lastverse variables as desribed using
//  the verse system of Mod).
//Vkeytext is a "xulsword reference" (see definition above).
//returns versification of Mod.
setBiblesReference: function(modname, xsref) {
  if (this.paused) throw(new Error("libsword paused, setBiblesReference inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sbr)
    this.fdata.sbr = this.Libsword.declare("SetBiblesReference", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.sbr(this.inst, ctypes.char.array()(modname), ctypes.char.array()(xsref));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// setVerse
//Sets static Verse and Lastverse variables (applies to ALL Bible calls).
//  Book and Chapter remain whatever they were previously set to.
//firstverse:
//  If firstverse is 0 then no verse is selected.
//  If firstverse is -1 then Verse will be set to the current chapter's max-verse.
//  If firstverse is greater then max-verse then Verse equals max-verse.
//lastverse:
//  Lastverse will always be: verse >= lastVerse <= max-verse.
//Returns versification which was used when assigning chapter
setVerse: function(modname, firstverse, lastverse) {
  if (this.paused) throw(new Error("libsword paused, setVerse inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.svr)
    this.fdata.svr = this.Libsword.declare("SetVerse", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.int, ctypes.int);
  var cdata = this.fdata.svr(this.inst, ctypes.char.array()(modname), firstverse, lastverse);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getBookName
//Returns current short book name, "Gen" for instance.
getBookName: function() {
  if (this.paused) throw(new Error("libsword paused, getBookName inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gbn)
    this.fdata.gbn = this.Libsword.declare("GetBookName", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gbn(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getChapter
//Returns current Book and Chapter as described using the verse system of module Mod.
//Returns in the form: "Gen 3"
getChapter: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getChapter inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gch)
    this.fdata.gch = this.Libsword.declare("GetChapter", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gch(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getVerseNumber
//Returns current Verse number as described using the verse system of module Mod.
getVerseNumber: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getVerseNumber inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gvn)
    this.fdata.gvn = this.Libsword.declare("GetVerseNumber", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.gvn(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  return intgr;
},

// getLastVerseNumber
//Returns current Lastverse number as described using the verse system of module Mod.
getLastVerseNumber: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getLastVerseNumber inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.glv)
    this.fdata.glv = this.Libsword.declare("GetLastVerseNumber", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.glv(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  return intgr;
},

// getChapterNumber
//Returns current Chapter number as described using the verse system of module Mod.
getChapterNumber: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getChapterNumber inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gcn)
    this.fdata.gcn = this.Libsword.declare("GetChapterNumber", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.gcn(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  return intgr;
},

// getLocation
//Returns current location as described using the verse system of module Mod;
//Returns in the form: Gen.1.2.5 (meaning Genesis 1:2-5)
getLocation: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getLocation inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.glc)
    this.fdata.glc = this.Libsword.declare("GetLocation", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.glc(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getChapterText
//Will return a chapter of text with footnote markers from module Vkeymod.
//Vkeymod must be a module having a key type of versekey (Bibles & commentaries),
//  otherwise null is returned.
getChapterText: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getChapterText inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gct)
    this.fdata.gct = this.Libsword.declare("GetChapterText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gct(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
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
getChapterTextMulti: function(modstrlist) {
  if (this.paused) throw(new Error("libsword paused, getChapterTextMulti inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.ctm)
    this.fdata.ctm = this.Libsword.declare("GetChapterTextMulti", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.ctm(this.inst, ctypes.char.array()(modstrlist));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
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
  if (this.paused) throw(new Error("libsword paused, getVerseText inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.vtx)
    this.fdata.vtx = this.Libsword.declare("GetVerseText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.vtx(this.inst, ctypes.char.array()(vkeymod), ctypes.char.array()(vkeytext));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getMaxVerse
//Returns the maximum verse number of the chapter refered to by the
//  xulsword reference Vkeytext, when using the verse system of Mod.
getMaxVerse: function(modname, vkeytext) {
  if (this.paused) throw(new Error("libsword paused, getMaxVerse inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gmv)
    this.fdata.gmv = this.Libsword.declare("GetMaxVerse", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var intgr = this.fdata.gmv(this.inst, ctypes.char.array()(modname), ctypes.char.array()(vkeytext));
  this.checkerror();
  return intgr;
},

// getVerseSystem
//Returns the verse system of module Mod.
getVerseSystem: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getVerseSystem inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gsy)
    this.fdata.gsy = this.Libsword.declare("GetVerseSystem", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gsy(this.inst, ctypes.char.array()(modname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// convertLocation
//Returns location (ie Gen.5.6.7) of Vkeytext (a xulsword reference) in
//  FromVerseSystem as it would be specified in ToVerseSystem (so given
//  Ps 119:1 from "KJV", it would return Ps.118.1.1 when converted to
//  "Synodal" or "EASTERN" verse systems).
//Returned value is always of the form shortBook.chapter.verse.lastVerse
convertLocation: function(fromVerseSystem, vkeytext, toVerseSystem) {
  if (this.paused) throw(new Error("libsword paused, convertLocation inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.clo)
    this.fdata.clo = this.Libsword.declare("ConvertLocation", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.clo(this.inst, ctypes.char.array()(fromVerseSystem), ctypes.char.array()(vkeytext), ctypes.char.array()(toVerseSystem));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
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
  if (this.paused) throw(new Error("libsword paused, getBookIntroduction inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.git)
    this.fdata.git = this.Libsword.declare("GetBookIntroduction", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.git(this.inst, ctypes.char.array()(vkeymod), ctypes.char.array()(bname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getDictionaryEntry
//Will return the dictionary entry, or "" if the entry is not found.
//An exception is thrown if the dictionary itself is not found, or if the
//  Lexdictmod is not of type StrKey.
getDictionaryEntry: function(lexdictmod, key) {
  if (this.paused) throw(new Error("libsword paused, getDictionaryEntry inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gdi)
    this.fdata.gdi = this.Libsword.declare("GetDictionaryEntry", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gdi(this.inst, ctypes.char.array()(lexdictmod), ctypes.char.array()(key));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getAllDictionaryKeys
//Returns all keys in form key1<nx>key2<nx>key3<nx>
//Returns an error is module Lexdictmod is not of type StrKey
getAllDictionaryKeys: function(lexdictmod) {
  if (this.paused) throw(new Error("libsword paused, getAllDictionaryKeys inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gdk)
    this.fdata.gdk = this.Libsword.declare("GetAllDictionaryKeys", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gdk(this.inst, ctypes.char.array()(lexdictmod));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getGenBookChapterText
//Returns chapter text for key Treekey in GenBook module Gbmod.
//Returns an error if module Gbmod is not a TreeKey mod.
getGenBookChapterText:function(gbmod, treekey) {
  if (this.paused) throw(new Error("libsword paused, getGenBookChapterText inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gbt)
    this.fdata.gbt = this.Libsword.declare("GetGenBookChapterText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gbt(this.inst, ctypes.char.array()(gbmod), ctypes.char.array()(treekey));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getGenBookTableOfContents
//Returns table of contents RDF code for GenBook module Gbmod.
//Returns an error if module Gbmod is not a TreeKey mod.
getGenBookTableOfContents: function(gbmod) {
  if (this.paused) throw(new Error("libsword paused, getGenBookTableOfContents inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gtc)
    this.fdata.gtc = this.Libsword.declare("GetGenBookTableOfContents", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gtc(this.inst, ctypes.char.array()(gbmod));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

//IMPORTANT: THE FOLLOWING 3 ROUTINES MUST BE CALLED AFTER getChapterText IS CALLED!

// getFootnotes
//Will return the footnotes (or empty string if there aren't any).
//See * below.
getFootnotes:function() {
  if (this.paused) throw(new Error("libsword paused, getFootnotes inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gfn)
    this.fdata.gfn = this.Libsword.declare("GetFootnotes", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gfn(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getCrossRefs
//Will return the cross references (or empty string if there aren't any).
//See * below.
getCrossRefs:function() {
  if (this.paused) throw(new Error("libsword paused, getCrossRefs inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gcr)
    this.fdata.gcr = this.Libsword.declare("GetCrossRefs", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gcr(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getNotes
//Will return both footnotes and cross references interleaved.
//See * below.
//order is: v1-footnotes, v1-crossrefs, v2-footnotes, v2-crossrefs, etc
getNotes:function() {
  if (this.paused) throw(new Error("libsword paused, getNotes inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gns)
    this.fdata.gns = this.Libsword.declare("GetNotes", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gns(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},


/******************************************************************************
* SEARCHING: USE THESE TO SEARCH MODULES:
******************************************************************************/
// luceneEnabled
//Will return true if indexed searching is available for the current module, false otherwise.
luceneEnabled: function(modname) {
  if (this.paused) throw(new Error("libsword paused, luceneEnabled inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.lce)
    this.fdata.lce = this.Libsword.declare("LuceneEnabled", ctypes.default_abi, ctypes.bool, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
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
  if (this.paused) throw(new Error("libsword paused, search inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sch)
    this.fdata.sch = this.Libsword.declare("Search", ctypes.default_abi, ctypes.int, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.int, ctypes.int, ctypes.bool);
  var intgr = this.fdata.sch(this.inst, ctypes.char.array()(modname), ctypes.char.array()(srchstr), ctypes.char.array()(scope), type, flags, newsearch);
  this.checkerror();
  return intgr;
},

// getSearchVerses
//UNEMPLEMENTED AS YET. Returns a list of verse addresses which matched the previous search.
getSearchVerses: function(modname) {
  if (this.paused) throw(new Error("libsword paused, getSearchVerses inaccessible."));
  if (!this.Libsword) this.initLibsword();
  return null;
},

// getSearchTexts
//Will return the verse texts from previous search.
//See * below
getSearchTexts: function(modname, first, num, keepStrongs) {
  if (this.paused) throw(new Error("libsword paused, getSearchTexts inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gst)
    this.fdata.gst = this.Libsword.declare("GetSearchTexts", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.int, ctypes.int, ctypes.bool);
  var cdata = this.fdata.gst(this.inst, ctypes.char.array()(modname), first, num, keepStrongs);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// searchIndexDelete
//Deletes the search index of Bible.
searchIndexDelete: function(modname) {
  if (this.paused) throw(new Error("libsword paused, searchIndexDelete inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sid)
    this.fdata.sid = this.Libsword.declare("SearchIndexDelete", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  this.fdata.sid(this.inst, modname);
  this.checkerror();
},

//**************** CHANGED! removed maxwait and return value*************************
// searchIndexBuild
//Before starting to build a new search index, call "searchIndexDelete()"
//CAUTION: Do not call any Bible functions other than getPercentComplete until
//getPercentComplete returns 100!
searchIndexBuild: function(modname) {
  if (this.paused) throw(new Error("libsword paused, searchIndexBuild inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sib)
    this.fdata.sib = this.Libsword.declare("SearchIndexBuild", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
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
  if (this.paused) throw(new Error("libsword paused, setGlobalOption inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sgo)
    this.fdata.sgo = this.Libsword.declare("SetGlobalOption", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  this.fdata.sgo(this.inst, option, setting);
  this.checkerror();
},

// getGlobalOption
//Option must one of the above option strings. Either "Off" or "On" will be returned.
getGlobalOption: function(option) {
  if (this.paused) throw(new Error("libsword paused, getGlobalOption inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.ggo)
    this.fdata.ggo = this.Libsword.declare("GetGlobalOption", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.ggo(this.inst, ctypes.char.array()(option));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},


/******************************************************************************
* PROVIDING THE DECRYPTION KEY:
******************************************************************************/
// setCipherKey
//Will set the module's key. Key can only be set once.
setCipherKey: function(modname, cipherKey, useSecModule) {
  if (this.paused) throw(new Error("libsword paused, setCipherKey inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.sck)
    this.fdata.sck = this.Libsword.declare("SetCipherKey", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.bool);
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
  if (this.paused) throw(new Error("libsword paused, getModuleList inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gml)
    this.fdata.gml = this.Libsword.declare("GetModuleList", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t));
  var cdata = this.fdata.gml(this.inst);
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
},

// getModuleInformation
//Paramname can be anything that is in the module's .conf file.
//Returns Paramname from conf file of module Mod.
//Returns NOTFOUND if the Paramname does not exist in the conf file.
//Returns empty string if the module Mod does not exist.
//Returns val1<nx>val2<nx>val3 if there is more than one entry of type infotype (eg. GlobalOptionFilter)
getModuleInformation: function(modname, paramname) {
  if (this.paused) throw(new Error("libsword paused, getModuleInformation inaccessible."));
  if (!this.Libsword) this.initLibsword();
  if (!this.fdata.gmi)
    this.fdata.gmi = this.Libsword.declare("GetModuleInformation", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.voidptr_t), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.fdata.gmi(this.inst, ctypes.char.array()(modname), ctypes.char.array()(paramname));
  this.checkerror();
  try {var str = cdata.readString();} catch(er) {str = "";}
  this.free(cdata);
  return str;
}
}; 

