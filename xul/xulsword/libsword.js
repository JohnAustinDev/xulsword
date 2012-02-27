Components.utils.import("resource://gre/modules/ctypes.jsm");

function test () {
  window.alert(Bible.getModuleList());
  window.alert(Bible.setBiblesReference("RSP", "Exod.5.2-3"));
  window.alert(Bible.getChapterText("RSP"));
}

/*******************************************************************************
 * Global variables and functions
 ******************************************************************************/ 
var Libsword;

function initSword() {
  Libsword = ctypes.open("xulsword.dll");

  var resource = getSpecialDirectory("xsResD");
  var funcTypeUpperCasePtr = ctypes.FunctionType(ctypes.default_abi, ctypes.PointerType(ctypes.char), [ctypes.ArrayType(ctypes.char)]).ptr;
  UpperCasePtr = funcTypeUpperCasePtr(UpperCase);

  var initSword = Libsword.declare("InitSwordEngine", ctypes.default_abi, ctypes.void_t, ctypes.PointerType(ctypes.char), funcTypeUpperCasePtr);
  initSword(ctypes.char.array()(resource.path), UpperCasePtr);
  
  Bible.free = Libsword.declare("FreeMemory", ctypes.default_abi, ctypes.void_t, ctypes.voidptr_t);
  
  test();
}

function quitSword() {
  var quitSword = Libsword.declare("QuitSwordEngine", ctypes.default_abi, ctypes.void_t);
  quitSword();

  Libsword.close();
}


/*******************************************************************************
 * Callback functions available to libsword binary
 ******************************************************************************/ 
var UpperCasePtr; 
function UpperCase(charPtr) {
  var aString = charPtr.readString();
  if (aString) {
    return ctypes.char.array()(aString.toUpperCase());
  }
  else return null;
}


/*******************************************************************************
 * Bible object
 ******************************************************************************/ 
/*
The following is the list of functions to use with Bible objects.
IMPORTANT NOTE: Bibles may have different verse systems. Therefore, when
setting the Book, Chapter and Verse variables, the Version (and thereby the
verse system) must also be provided. Psalm 10 in Synodal is not the same text
as Psalm 10 in KJV for instance.


SPECIAL MODULE CONFIGURATION PARAMETERS (OPTIONAL):
Valid for all modules:
  "TabLabel" - Label to use on the module's tab (of not specified by the locale)
  "Font" - The font to use for the module
  "FontSizeAdjust" - The relative size of the module's font
  "LineHeight" - The relative line height of the module's font

Valid for Bible modules:
  "OriginalTabTestament" - If set to "OT" or "NT", an ORIG tab will be available,
      and this module will be shown (in interlinear format) when it is activated.
  "DictionaryModule" - Associate a dictionary with the module. There may be
      more than one DictionaryModule entry.
  "ProducedFor" - DEPRECATED. versions <2.7  set it to "xulsword" for all MK's native Bible modules.
      It allows us to know if we should use xulsword's security features or not.
  "AudioCode" - Audio files located in this directory (within the Audio dir) will
      be avaialble in this Bible module.

Valid for Dictionary modules:
  "LangSortOrder" - Allows to sort entries alphabetically
  "ReferenceBible" - Bible module to use for Scripture references.


DEFINITION OF A "XULSWORD REFERENCE":
  "xulsword reference"s never cross chapter boundaries. The smallest reference
  is to a single verse, and the largest is to a whole chapter. "xulsword reference"s
  must take one of the following forms:

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
                          can never cross chapter boundaries).
*/

var Bible = {

free:null,

// getModuleList
//Returns a string of form: name1;type1<nx>name2;type2<nx> etc...
//Returns "No Modules" if there are no modules available.
getModuleList: function() {
  if (!this.gml)
    this.gml = Libsword.declare("GetModuleList", ctypes.default_abi, ctypes.PointerType(ctypes.char));
  var cdata = this.gml();
  var str = cdata.readString();
  this.free(cdata);
  return str;
},

// setBiblesReference
//Choose the Bible reference for all ixulsword instances to work with (it sets
//  the static Book, Chapter, Verse, Lastverse variables as desribed using
//  the verse system of Mod).
//Vkeytext is a "xulsword reference" (see definition above).
//returns versification of Mod.
setBiblesReference: function(modname, xsref) {
  if (!this.sbr)
    this.sbr = Libsword.declare("SetBiblesReference", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.sbr(ctypes.char.array()(modname), ctypes.char.array()(xsref));
  var str = cdata.readString();
  this.free(cdata);
  return str;
},

// getChapterText
//Will return a chapter of text with footnote markers from module Vkeymod.
//Vkeymod must be a module having a key type of versekey (Bibles & commentaries),
//  otherwise null is returned.
getChapterText: function(modname) {
  if (!this.gct)
    this.gct = Libsword.declare("GetChapterText", ctypes.default_abi, ctypes.PointerType(ctypes.char), ctypes.PointerType(ctypes.char));
  var cdata = this.gct(ctypes.char.array()(modname));
  var str = cdata.readString();
  this.free(cdata);
  return str;
}

}; 

