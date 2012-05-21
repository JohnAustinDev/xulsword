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

// VARIABLES AND FUNCTIONS FOR THE SCRIPT.HTML FRAMES

/************************************************************************
 * Global Declarations
 ***********************************************************************/
var ChooserGap;
var TabBarMargin;             
var MarginEnd;
var MarginStartWhenNoChooser;
var ShX, ShY;
var ScriptBoxMarginTop;
var BottomMargin;
var ConnectorIndent;
var ChooserMinTopBorder;
var ChooserMinBottomBorder;
var ChooserOffsetFromCenter;
var HoleMarginV;
var HoleMarginH;
var ScriptBoxElement;
var ScriptBoxTextElement;
var NoteBoxElement;
var ConnectorElement;
var BoundaryBarElement;
var BoundaryBarShadowElement;
var NoteBoxSizerElement;
var Frame;
var OwnerDocument;
var FootnoteWinH;
var Mtext;
var FrameDocumentHavingNoteBox;
var ClientX;
var ClientY;
var BoundaryClicked;
var StartMouseY;
var NoteBoxEmpty;
var DesiredFrameWidth;
var LargeTabSize;
var ScriptWidth;
var ScriptHeight;
var ScriptBoxHeight;
var FrameWidth;
var MarginStartOfScriptBox;
var BoundaryBarGap;
var EffectiveWinH;
var PreviousT;
var PinnedAndLinked;
var MinScriptHeight;
var MinScriptWidth;
var LastVersion;
var MyFootnotes = {};
var Pin = {number:null, display:{}, isPinned:null, elem:null, updatePin:null, updateLink:null};

/************************************************************************
 * Initialization after HTML has loaded
 ***********************************************************************/
function initializeScript() {
  updateCSSBasedOnCurrentLocale([".chooser", ".testamentchooser", ".languageTabs", ".tabs"]);
  createVersionClasses();
  initializeStyleGlobals();
  pullFontSizesFromCSS();

  ScriptBoxElement          = document.getElementById("scriptBox");
  ScriptBoxTextElement      = document.getElementById("scriptBoxText");
  NoteBoxElement            = document.getElementById("noteBox");
  ConnectorElement          = document.getElementById("connector");
  BoundaryBarElement        = document.getElementById("boundary");
  BoundaryBarShadowElement  = document.getElementById("boundaryHi");
  NoteBoxSizerElement       = document.getElementById("nbsizer");
  
//********************************
//*
  //Style like params for horizontal layout 
  ChooserGap=10;                //Gap between chooser and text
  TabBarMargin=44;              //Margin left+right of Tab Bar              
  MarginEnd=30;               //Margin end of ScriptBox
  MarginStartWhenNoChooser=30;   //Start window margin when chooser is closed
  ShX=(guiDirection()=="rtl" ? -14:14);
  ShY=12;               //Shadow offset for popups
  MinScriptWidth = 270;         //Miniumum width script box will go
  ChooserStartMargin = 14;

  //Style like params for vertical layout
  ScriptBoxMarginTop=32;        //Margin above ScriptBox
  BottomMargin=20;              //Bottom Margin
  ConnectorIndent = 6;          //Page connector indent height
  MinScriptHeight = 400         //Minimum height ScriptBox can go

  //Style like params for Chooser
  ChooserMinTopBorder = ScriptBoxMarginTop;
  ChooserMinBottomBorder = BottomMargin; 
  ChooserOffsetFromCenter=0;    //Chooser floats up this amount from center if space provides)
  HoleMarginV = 5;              //Margin around chooser to "hole" edge vertical
  HoleMarginH = 5;              //Margin around chooser to "hole" edge horizontal
  
//*
//********************************/

  Frame = window.frameElement;  //Parent frame located in XUL doc
  OwnerDocument = Frame.ownerDocument; //XUL document itslef
  
  document.getElementById("langTabs").setAttribute("chromedir", guiDirection());
  document.getElementById("pin").setAttribute("chromedir", guiDirection());
  document.getElementById("connector").setAttribute("chromedir", guiDirection());
  FrameDocumentHavingNoteBox = window.document;      //Global for saving the document object of Frame which will display footnotes
  BoundaryClicked=false;
  NoteBoxEmpty = true;
  BoundaryBarGap = 10 + 1 + 4 + 1 + 10 + 2 + 2 + 10 + 6; //Only the 6 is unaccounted for
  Win.number = Number(Frame.id.substr(5,1));
  FootnoteWinH = prefs.getIntPref("NoteboxHeight" + Win.number);
  LastVersion="";

  Pin.number = Win.number;
  Pin.isPinned = false;
  Pin.elem = document.getElementById("pin");
  Pin.updateLink = function() {
    if (!MainWindow.Link.isLink[this.number]) return;
    for (var w=1; w<=3; w++) {
      if (!MainWindow.Link.isLink[w] || w==this.number) continue;
      MainWindow.FrameDocument[w].defaultView.Pin.display = this.display;
    }
  }
  Pin.updatePin = function(book, chapter, verse) {
    this.display.shortName = book;
    this.display.chapter = chapter;
    this.display.verse = verse;
  }

  adjustFontSizes(prefs.getIntPref('FontSize'));

  if (window.screen.width <= 800) {
    ScriptBoxTextCSS.style.paddingLeft="20px";
    ScriptBoxTextCSS.style.paddingRight="20px";
  }
  
  // Add mouse wheel lister to chooser
  if (Win.number == 1) {
    for (var b=0; b<NumBooks; b++) {
      document.getElementById("book." + String(b)).addEventListener("DOMMouseScroll",wheel,false);
    }
    document.getElementById("chooserNT").addEventListener("DOMMouseScroll",wheel,false);
    document.getElementById("chooserOT").addEventListener("DOMMouseScroll",wheel,false);
  }
  // Add mouse wheel listener to scriptbox
  ScriptBoxTextElement.addEventListener("DOMMouseScroll",scrollwheel,false);
   
  // Initialize size of Chooser and Frames. NOTE: During initialization, prefs 
  // are used to read window height and width. This allows us to completely build 
  // the frames and chooser before the main window opens, allowing the main 
  // window to open already sized (no flashing while frames resize again).
  // updateTabLabelsAndStyles must be run before setBibleWidth.
  if (Win.number == 1) {
    initChooser(true); //true -> initializing
    MainWindow.updateTabLabelsAndStyles(true); //true => initializing  
  }
  if (Win.number <= prefs.getIntPref("NumDisplayedWindows")) {
    setBibleWidth(true);  //true -> initializing
    setBibleHeight(true); //true -> initializing
  }
}


/************************************************************************
 * Script Box
 ***********************************************************************/

function updateScriptBox(scrollTypeFlag) {
//jsdump("Updating:" + Win.number + "\n");
  
  var versionHasChanged=false;
  if (LastVersion != Win.modName) {
    versionHasChanged=true;
    ScriptBoxTextElement.className = "scriptboxtext vstyle" + Win.modName;
    NoteBoxElement.className = "notebox vstyle" + Win.modName;
    Popup.npopup.className = "npopup vstyle" + Win.modName;
    if (Win.number == 1) updateCSSBasedOnVersion(Win.modName, [".chapsubtable", ".hpopup"]);
    LastVersion = Win.modName;
  }
  
  switch (Win.modType) {
  case BIBLE:
  case COMMENTARY:
    updateBibleOrCommentary(scrollTypeFlag);
    break;
  case DICTIONARY:
    FrameDocumentHavingNoteBox = window.document;
    if (!versionHasChanged && ScriptBoxTextElement.innerHTML.length && NoteBoxElement.innerHTML.length) {
      updateDictionary();
    }
    else {
      MainWindow.TextCache[Win.number].text = null;
      ConnectorElement.style.visibility = "hidden";
      FrameDocumentHavingNoteBox = Win.number;
      SelectedKey=null;
      var written = writeDictionaryList(versionHasChanged);
      if (written) updateDictionary();
      else {
        //If module is empty or not loaded correctly
        ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
        ScriptBoxTextElement.innerHTML="";
        NoteBoxElement.scrollTop = 0; // prevents window from flashing white
        NoteBoxElement.innerHTML=""
      }
    }
    break;
  case GENBOOK:
    FrameDocumentHavingNoteBox = window.document;
    updateGenBook();
    break;
  default:
    jsdump("Tried to update unsupported module type:" + Win.modType + " (updateScriptBox)\n");
    break;
  }
  Popup.close(); // Needed so that popup closes even if context menu was open
}

function updateBibleOrCommentary(scrollTypeFlag) {
  var savedWindow = {};
  
  if (Pin.isPinned) {
    // Global location is saved and replaced at end of this routine. This means that
    // OTHER BIBLES SHOULD NOT BE ACCESSED WHILE THIS ROUTINE IS EXECUTING OR THEIR LOCATION
    // WILL BE INCORRECT
    savedWindow = MainWindow.saveWindowDisplay(Win);
    MainWindow.setWindowDisplay(Win, Pin.display);
  }
  else Pin.display = MainWindow.saveWindowDisplay(Win);

  if (!MainWindow.Link.isLink[Win.number] || Win.number == MainWindow.Link.startWin)
      MainWindow.writeToScriptBoxes(Win, Pin.isPinned, Pin.display, scrollTypeFlag);
  
  if (Pin.isPinned) MainWindow.setWindowDisplay(Win, savedWindow);
}

function updateGenBook() {
  ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
  ConnectorElement.style.visibility = "hidden";
  FrameDocumentHavingNoteBox = Win.number;
  MainWindow.TextCache[Win.number].text = null;
  
  var savedWindow = {};
  if (Pin.isPinned) {
    // Global key is saved and replaced at end of this routine. This means that
    // OTHER WINDOWS SHOWING THIS BOOK SHOULD NOT BE ACCESSED WHILE THIS ROUTINE IS EXECUTING OR THEIR LOCATION
    // WILL BE INCORRECT
    savedWindow = MainWindow.saveWindowDisplay(Win);
    MainWindow.setWindowDisplay(Win, Pin.display);
  }
  else Pin.display = MainWindow.saveWindowDisplay(Win);

  var navlinks = getPageLinks();
  var myFootnotes = {};
  var text = getGenBookChapterText(getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", ""), Bible, myFootnotes);
  for (var m in myFootnotes) {MyFootnotes[m] = myFootnotes[m];}
  ScriptBoxTextElement.innerHTML = (MainWindow.ScriptBoxIsEmpty[Win.number] ? "":navlinks + text + navlinks);
  setBibleHeight(false, true);
  
  if (Pin.isPinned) MainWindow.setWindowDisplay(Win, savedWindow);
}

var DictionaryList;
var LangSortSkipChars;
function writeDictionaryList(refreshKeys) {
  if (refreshKeys) {
    DictionaryList = Bible.getAllDictionaryKeys(Win.modName).split("<nx>");
    if (!DictionaryList) return false;
    DictionaryList.pop();
    SortOrder = Bible.getModuleInformation(Win.modName, "LangSortOrder");
    if (SortOrder != NOTFOUND) {
      SortOrder += "0123456789";
      LangSortSkipChars = Bible.getModuleInformation(Win.modName, "LangSortSkipChars");
      if (LangSortSkipChars==NOTFOUND) LangSortSkipChars="";
      DictionaryList.sort(DictSort);
    }
  }
  
  var nbHTML = "";
  if (!MainWindow.ScriptBoxIsEmpty[Win.number]) {
    nbHTML += "<div style=\"position:relative; height:100%;\">"
    nbHTML += "<div id=\"textboxparent\" style=\"position:absolute; margin-right:20px; -moz-padding-start:20px; left:0px; right:0px; top:0px; height:3em;\">";
    nbHTML += "<input id=\"keytextbox\" name=\"keytextbox\" class=\"vstyle" + Win.modName + "\" onfocus=\"this.select()\" ondblclick=\"this.select()\" onkeypress=\"dictionaryKeyPress(event)\" style=\"width:100%; margin-top:1em;\"/>";
    nbHTML += "</div>";
    nbHTML += "<div id=\"keylist\" onclick=\"selKey(event.target.id)\" class=\"dictionarylist\">";
    for (var e=0; e<DictionaryList.length; e++) {
      nbHTML += "<div id=\"" + DictionaryList[e] + "\" >" + DictionaryList[e] + "</div>";
    }
    nbHTML += "</div></div>";
  }
  NoteBoxElement.scrollTop = 0; // prevents window from flashing white
  NoteBoxElement.innerHTML = nbHTML;
  NoteBoxEmpty = false;
  MainWindow.setNoteBoxSizer(Win.number, false);
  return true;
}

var SortOrder;
var DictSort = function(a,b) {
  var xa=0;
  var xb=0;
  var ca = a.charAt(xa);
  while (ca && LangSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
  var cb = b.charAt(xb);
  while (cb && LangSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
  while (ca || cb) {
    if (!ca) return -1;
    if (!cb) return 1;
    if (SortOrder.indexOf(ca) < SortOrder.indexOf(cb)) return -1;
    if (SortOrder.indexOf(ca) > SortOrder.indexOf(cb)) return 1;
    ca = a.charAt(++xa);
    while (ca && LangSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
    cb = b.charAt(++xb);
    while (cb && LangSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
  }
  return 0;
}


//The timeout below was necessary so that textbox.value included the pressed key...
function dictionaryKeyPress(e) {window.setTimeout("dictionaryKeyPressR(" + e.which + ")", 0);}
function dictionaryKeyPressR(charCode) {
  var textbox = document.getElementById("keytextbox");
  var text = textbox.value;
  if (!text) {
    textbox.style.color="";
    return;
  }
  var matchtext = new RegExp("(^|<nx>)(" + escapeRE(text) + "[^<]*)<nx>", "i");
  var firstMatch = matchtext(DictionaryList.join("<nx>") + "<nx>");
  if (!firstMatch) {
    if (charCode!=8) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    textbox.style.color="red";
  }
  else {
    textbox.style.color="";
    setUnicodePref("ShowingKey" + Win.modName, firstMatch[2]);
    updateDictionary(charCode!=13);
  }
}

var SelectedKey;
function updateDictionary(dontUpdateText) {
  if (!dontUpdateText) {
    var defKey = DictionaryList[0];
    for (var k=1; k<DictionaryList.length; k++) {if (!defKey) {defKey=DictionaryList[k];} else break;}
    var mychap = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", defKey);
    if (!mychap) mychap = defKey; //since pref may have previously been set to ""!
    if (mychap == "DailyDevotionToday") {
      var today = new Date();
      mychap = (today.getMonth()<9 ? "0":"") + String(today.getMonth()+1) + "." + (today.getDate()<10 ? "0":"") + today.getDate();
      prefs.setCharPref("ShowingKey" + Win.modName, mychap);
    }
    var entryHTML = MainWindow.getDictionaryHTML(mychap, Win.modName);
    entryHTML = insertUserNotes("na", mychap, Win.modName, entryHTML).html;
    var sbHTML = "";
    sbHTML += "<div style='display:table; height:100%; width:100%;'>";
    sbHTML += "<div style='display:table-row; height:1em;'>";
    sbHTML += "<div style='display:table-cell;'>" + getPageLinks() + "</div></div>";
    sbHTML += "<div style='display:table-row;'>";
    sbHTML += "<div style='display:table-cell; vertical-align:middle;'>" + entryHTML + "</div></div></div>";
    ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
    ScriptBoxTextElement.innerHTML = sbHTML;
  }
  
  if (SelectedKey) {try {document.getElementById(SelectedKey).className="";} catch (er) {}}
  SelectedKey = getUnicodePref("ShowingKey" + Win.modName);
  if (SelectedKey) {
    var keyElement = document.getElementById(SelectedKey);
    if (keyElement) keyElement.className="selectedkey";
  }
  setBibleHeight(false, false);
  document.getElementById("keytextbox").style.color="";
  window.setTimeout("updateDictionaryTimeout(" + dontUpdateText + ")", 0);
}

function updateDictionaryTimeout (dontUpdateText) {
jsdump("Scrolling to top w:" + Win.number);
  scrollScriptBox(SCROLLTYPETOP);
  if (!dontUpdateText) {
    var textbox = document.getElementById("keytextbox");
    if (textbox) {
      textbox.value = SelectedKey;
    }
  }
  var keyElement = document.getElementById(SelectedKey);
  if (keyElement) {
    var scrollTopMargin = keyElement.offsetHeight*(Math.round(0.5*document.getElementById("keylist").offsetHeight/keyElement.offsetHeight)-2);
    scroll2(document.getElementById("keylist"), keyElement, "keylist", true, scrollTopMargin);
  }
}

function selKey(aKey) {
  if (aKey == "keylist") return;
  setUnicodePref("ShowingKey" + Win.modName, aKey);
  updateDictionary();
  window.setTimeout("document.getElementById('keytextbox').focus()", 0);
}

function getPageLinks() {
  var config = LocaleConfigs[getLocale()];
  var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
  var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));
  charNext = "<span style=\"font-family:ariel;\">" + charNext + "</span>"; // Because 'UKIJ Tuz Basma' improperly implements this char!
  charPrev = "<span style=\"font-family:ariel;\">" + charPrev + "</span>"; // Because 'UKIJ Tuz Basma' improperly implements this char!

  //var mytype = win.modType;
  var prevDisabled = false; //mytype==BIBLE && Pin.display.chapter==1 && Pin.display.shortName=="Gen";
  var nextDisabled = false; //mytype==BIBLE && Pin.display.chapter==22 && Pin.display.shortName=="Rev";

  var chapterNavigationLink = "<div  class=\"navlink vstyleProgram\">";
  if (prevDisabled) {
    chapterNavigationLink += "<span class=\"navlinkDisabled\">" + charPrev + " " + SBundle.getString('PrevChaptext') + "</span>" + " / ";
  }
  else chapterNavigationLink += "&lrm;<span style=\"color:blue;\">" + charPrev + " " + "<a id=\"prevchaplink\">" + SBundle.getString('PrevChaptext') + "</a>" + " / ";

  if (nextDisabled) {
    chapterNavigationLink += "<span class=\"navlinkDisabled\">" + SBundle.getString('NextChaptext') + " " + charNext + "</span>";
  }
  else chapterNavigationLink += "<a id=\"nextchaplink\">&lrm;" + SBundle.getString('NextChaptext') + "</a>" + " <span style=\"color:blue;\">" + charNext + "</span>";
  chapterNavigationLink += "</div>";
  return chapterNavigationLink;
}

// This function is only for versekey modules (BIBLE, COMMENTARY)
function getChapterWithNotes(fn, ch, chapOffset) {
  if (!chapOffset) chapOffset = 0;
  var bch = Location.getChapterNumber(Win.modName);
  var needDifferentChap = (chapOffset != 0 || bch != ch);
  switch (Win.modType) {
  case BIBLE:
    if (needDifferentChap) {
      var savedloc = Location.getLocation(Win.modName);
      var bkn = findBookNum(Location.getBookName());
      var chn = ch + chapOffset;
      if (chn > 0 && chn <= Book[bkn].numChaps) {
        Location.setLocation(Win.modName, Book[bkn].sName + "." + chn + ".1");
        Location.setVerse(Win.modName, 0, 0);
      }
      else return "";
    }
    var text = getChapterText(Bible, Location, fn, Win.modName, (chapOffset!=0));
    if (needDifferentChap) Location.setLocation(Win.modName, savedloc);
    break;
  case COMMENTARY:
    var text = getChapterText(Bible, Location, fn, Win.modName);
    break;
  }

  return text;
}

//after user notes are collected and page is drawn, go add highlight to all usernote verses
function markUserNoteVerse(id) {
  var verse = id.match(/un\..*?\.([^\.]*\.\d+\.\d+)\.[^\.]+$/);
  if (!verse) return;
  var userNoteElement = document.getElementById("vs." + verse[1]);
  if (userNoteElement) userNoteElement.className += " unverse";
}

//This routine will scroll this window accordingly. NOTE: This routine is only
//needed for unlinked windows, link scrolling is handled by "writeToScriptBoxes"
function scrollScriptBox(scrollTypeFlag, elemID) {
  if (Win.number > prefs.getIntPref("NumDisplayedWindows")) return;
  if (MainWindow.Link.isTextLink[Win.number]) return;
  if (!scrollTypeFlag) return;
  if (scrollTypeFlag == SCROLLTYPETOP) {
    ScriptBoxTextElement.scrollTop = 0;
    return;
  }
  
  if (!elemID && Pin.isPinned) elemID = "vs." + Pin.display.shortName + "." + Pin.display.chapter + "." + Pin.display.verse;
  var intid = "";
  if (!elemID) {
    if (!prefs.getBoolPref("ShowOriginal" + Win.number))
      elemID = "vs." + Location.getBookName() + "." + Location.getChapterNumber(Win.modName) + "." + Location.getVerseNumber(Win.modName);
    else {
      intid = ".1";
      elemID = "vs." + Location.getBookName() + "." + Location.getChapterNumber(Win.modName) + "." + Location.getVerseNumber(Win.modName) + intid;
    }
  }
  var elem = document.getElementById(elemID);
  if (!elem) {
    // verse may be missing, try looking for a previous verse
    var re = new RegExp("vs\\.([^\\.]+)\\.(\\d+)\\.(\\d+)");
    var id = elemID.match(re);
    if (!id) return;
    var v = Number(id[3]);
    while (!elem && v > 1) {
      v--;
      elem = document.getElementById("vs." + id[1] + "." + id[2] + "." + v + intid);
    }
    if (!elem) return;
  }
  
  var boxOffsetHeight = ScriptBoxTextElement.offsetHeight;
  var verseOffsetTop = elem.offsetTop;
  var verseOffsetHeight = elem.offsetHeight;
  var boxScrollTop = ScriptBoxTextElement.scrollTop;
  
  // if part of commentary element is already visible, don't rescroll
  if (Win.modType==COMMENTARY &&
      (verseOffsetTop < boxScrollTop) &&
      (verseOffsetTop + verseOffsetHeight > boxScrollTop + 20)) return;
    
  // if this is verse 1 then SCROLLTYPEBEG and SCROLLTYPECENTER both become SCROLLTYPETOP
  var v = elem.id.split(".");
  if (v && v.length && v.length>=4) v = v[3];
  else v="";
  if (v && v==1 && (scrollTypeFlag==SCROLLTYPEBEG || scrollTypeFlag==SCROLLTYPECENTER)) {
    ScriptBoxTextElement.scrollTop = 0;
    return;
  }

  switch (scrollTypeFlag) {
  case SCROLLTYPEBEG:
    ScriptBoxTextElement.scrollTop = verseOffsetTop - 20;
    break;
  case SCROLLTYPECENTERALWAYS:
  case SCROLLTYPECENTER:
    //dump(Win.number + " boxOffsetHeight:" + boxOffsetHeight + " boxScrollTop:" + boxScrollTop + " verseOffsetHeight:" + verseOffsetHeight + " verseOffsetTop:" + verseOffsetTop + "\n");
    // Dont scroll if the verse is already completely visible
    if (scrollTypeFlag==SCROLLTYPECENTERALWAYS ||
       ((verseOffsetTop + verseOffsetHeight > boxScrollTop + boxOffsetHeight)||(verseOffsetTop < boxScrollTop))) {
      //Put the middle of the verse in the middle of the ScriptBox
      var middle = Math.round(verseOffsetTop - (boxOffsetHeight/2) + (verseOffsetHeight/2));
      // but if beginning of verse is not showing then make it show
      if (verseOffsetTop < middle) {ScriptBoxTextElement.scrollTop = verseOffsetTop;}
      else {ScriptBoxTextElement.scrollTop = middle;}
    }
    break;
  case SCROLLTYPEENDSELECT:
    ScriptBoxTextElement.scrollTop = verseOffsetTop + verseOffsetHeight - boxOffsetHeight;
    break;
  case SCROLLTYPEEND:
    // do nothing
    break;
  }
}
  
function pinScript() {
  Pin.isPinned = true;
  var preChangeLink = MainWindow.copyLinkArray();
  setFramePinStyle(true);
  if (Win.modType == BIBLE || Win.modType == COMMENTARY) {
    // window texts should not change when pinned
    var loc = MainWindow.getPassageFromWindow(MainWindow.FIRSTPASSAGE, Pin.number);
    if (loc) loc = loc.substring(0, loc.lastIndexOf(".")).split(".");
    else loc = [Location.getBookName(), Location.getChapterNumber(Win.modName), Location.getVerseNumber(Win.modName)];
    Pin.updatePin(loc[0], loc[1], loc[2]);
  }
  else if (Win.modType == GENBOOK) Pin.display.key = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
  MainWindow.updateLinkInfo();
  Pin.updateLink();
  MainWindow.updatePinVisibility();
  MainWindow.updateTabLabelsAndStyles();
  MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number, preChangeLink), SCROLLTYPEBEG, HILIGHTNONE, UPDATELOCATORS);
}

function unpinScript() {
  Pin.isPinned = false;
  var preChangeLink = MainWindow.copyLinkArray();
  setFramePinStyle(false);
  if (Win.modType == BIBLE || Win.modType == COMMENTARY) {
    // make the unpinned win show what the pinned win show
    var loc = MainWindow.getPassageFromWindow(MainWindow.FIRSTPASSAGE, Pin.number);
    if (loc) loc = loc.substring(0, loc.lastIndexOf("."));
    else loc = Pin.display.shortName + "." + Pin.display.chapter + "." + Pin.display.verse;
    Location.setLocation(Win.modName, loc);
    var p = loc.split(".");
    Pin.updatePin(p[0], p[1], p[2]);
  }
  MainWindow.updateLinkInfo();
  Pin.updateLink();
  MainWindow.updatePinVisibility();
  MainWindow.updateTabLabelsAndStyles();
  if (Win.modType == BIBLE || Win.modType == COMMENTARY) {
    var update = MainWindow.getUpdatesNeededArray(Win.number, preChangeLink);
    var update2 = MainWindow.getUnpinnedVerseKeyWindows();
    for (var w=1; w<=3; w++) {update[w] |= update2[w];}
    MainWindow.updateFrameScriptBoxes(update, SCROLLTYPEBEG, HILIGHTNONE, UPDATELOCATORS);
  }
  else if (Win.modType == GENBOOK) {
    MainWindow.SkipGenBookWindow = Win.number; // don't update or scroll text of this window
    MainWindow.selectGenBook(Pin.display.key);
  }
}

function setFramePinStyle(isPinned) {
  ScriptBoxTextElement.className = appendOrRemoveClass("scriptboxPinned", ScriptBoxTextElement, isPinned);
  ScriptBoxElement.className = appendOrRemoveClass("scriptboxPinned", ScriptBoxElement, isPinned);
  NoteBoxElement.className = appendOrRemoveClass("scriptboxPinnedNB", NoteBoxElement, isPinned);
  ConnectorElement.className = isPinned ? "connector scriptboxPinnedCN":"connector";
  BoundaryBarElement.className = isPinned ? "boundary scriptboxPinnedBB":"boundary";
}


function appendOrRemoveClass(className, element, append) {
  var myClass = element.className;
  if (!myClass) myClass = "";
  var hasClass = (myClass.search(className) != -1);
  if (append && !hasClass) myClass += " " + className;
  else if (!append && hasClass) myClass = myClass.replace(className,"");
  return myClass;
}

function scrollwheel(event) {MainWindow.scrollwheel(event, Win.number);}


/************************************************************************
 * The Boundary Bar
 ***********************************************************************/  
var MouseIsOver;
function boundaryMouseMove(evt) {
  MouseIsOver = evt.target;
  if (BoundaryClicked) {
    var newWinH = FootnoteWinH + (StartMouseY - evt.clientY);
    if ((newWinH < 0)||(evt.clientY<ScriptBoxMarginTop)) {
      BoundaryClicked = false; 
      BoundaryBarShadowElement.style.visibility = "hidden";
      BoundaryBarElement.style.visibility = "visible";
      setBibleHeight();
    }
    else {
      BoundaryBarShadowElement.style.top = evt.clientY;
    }
  }
}

function boundaryMouseDown(evt) {
  BoundaryClicked=true;
  BoundaryBarShadowElement.style.left = String(BoundaryBarElement.offsetLeft + MarginStartOfScriptBox) + "px";
  BoundaryBarShadowElement.style.width = String(BoundaryBarElement.offsetWidth) + "px";
  evt.preventDefault(); //So we don't select while we're dragging the boundary bar
  
  // If maximize is on, we must save maximized size and turn off maximize
  if (prefs.getBoolPref("MaximizeNoteBox" + String(Win.number))) {
    MainWindow.setNoteBoxSizer(Win.number, false);
    FootnoteWinH = EffectiveWinH - ScriptBoxMarginTop - BottomMargin - BoundaryBarGap;
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPENONE, HILIGHT_IFNOTV1, NOUPDATELOCATOR);
  }
  StartMouseY = evt.clientY;
  BoundaryBarShadowElement.style.top = String(evt.clientY) + "px";
  BoundaryBarShadowElement.style.visibility = "visible";
  BoundaryBarElement.style.visibility = "hidden";
}

function boundaryMouseUp(evt) {
  if (BoundaryClicked) {
    BoundaryBarShadowElement.style.visibility = "hidden";
    var newWinH = FootnoteWinH + (StartMouseY - evt.clientY);
    if (newWinH <= 2) {FootnoteWinH = 0;}
    else if (newWinH > ScriptBoxHeight - BoundaryBarGap) {FootnoteWinH = ScriptBoxHeight - BoundaryBarGap;}
    else FootnoteWinH = newWinH;
    if      (Win.number == 1) {prefs.setIntPref("NoteboxHeight1",FootnoteWinH);}
    else if (Win.number == 2) {prefs.setIntPref("NoteboxHeight2",FootnoteWinH);}
    else if (Win.number == 3) {prefs.setIntPref("NoteboxHeight3",FootnoteWinH);}
    setBibleHeight();
    BoundaryBarElement.style.visibility = "visible";
  }
  BoundaryClicked = false;
}


/************************************************************************
 * Creating Footnotes
 ***********************************************************************/ 

function copyNotes2Notebox(bibleNotes, userNotes) {
  //getChapterText() must be called before this
  var gfn = ((Bible.getGlobalOption("Footnotes") == "On")&&(prefs.getBoolPref("ShowFootnotesAtBottom")));
  var gcr = ((Bible.getGlobalOption("Cross-references") == "On")&&(prefs.getBoolPref("ShowCrossrefsAtBottom")));
  var gun = ((prefs.getCharPref("User Notes") == "On")&&(prefs.getBoolPref("ShowUserNotesAtBottom")));
  var t = "";
  
  NoteBoxEmpty = true;
  if (!(gfn||gcr||gun)) {
    // If we aren't showing footnotes in box, then turn maximize off
    MainWindow.setNoteBoxSizer(Win.number, false);
    PreviousT = t;
    return;
  }
  //  Get all notes for this chapter
  var allNotes="";
  if ((Win.modType==BIBLE || Win.modType==COMMENTARY) && bibleNotes!=NOTFOUND) allNotes = bibleNotes;
  if (userNotes!=NOTFOUND) allNotes += userNotes;

  var html = getNotesHTML(allNotes, Win.modName, gfn, gcr, gun, false, Win.number);
  if (html) NoteBoxEmpty = false;
  t += html

  // Global is set by mouse routines to prevent the scriptbox from changing when desired
  if (t != PreviousT) {
    NoteBoxElement.scrollTop = 0; // prevents window from flashing white
    NoteBoxElement.innerHTML = t;
  }
  PreviousT = t;
}

/************************************************************************
 * Footnote Mouse handlers
 ***********************************************************************/ 
function noteboxClick(e) {
  //If target has no id, find first parent that does
  var elem = e.target; 
  while (elem.id == "") {elem=elem.parentNode;}
  //jsdump("noteboxClick: " + elem.id + "\n");
  var idpart = elem.id.split(".");
  var id = idpart.shift();
  
  switch (id) {
  case "exp":
    expandCrossRefs(idpart.join("."), MyFootnotes, Win, FrameDocumentHavingNoteBox);
    break;
    
  case "nbl": //Cross reference link
    goToCrossReference(elem.title, false);
    break;

  case "notl": //Note reference link
//  case "body":
//  case "ntr":
    var v = Number(idpart[4]);
    switch (Win.modType) {
    case BIBLE:
    case COMMENTARY:
      var updateNeeded = MainWindow.getUnpinnedVerseKeyWindows();
      if (Pin.isPinned) {
        Location.setLocation(Win.modName, idpart[2] + "." + idpart[3] + "." + idpart[4]);
        MainWindow.updateFrameScriptBoxes(updateNeeded, SCROLLTYPECENTER, HILIGHT_IFNOTV1, UPDATELOCATORS);
      }
      else {MainWindow.quickSelectVerse(Win.modName, null, Number(idpart[3]), v, Number(idpart[5]), HILIGHT_IFNOTV1, SCROLLTYPECENTER);}
      break;
     case DICTIONARY:
     case GENBOOK:
      scrollScriptBox(SCROLLTYPECENTER, "par." + v);
      break;
    } 
    break;
  case "nbsizer":
    MainWindow.setNoteBoxSizer(Win.number, !prefs.getBoolPref("MaximizeNoteBox" + Win.number));
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPECENTER, HILIGHT_IFNOTV1, NOUPDATELOCATOR);
    break;
  }
}

/************************************************************************
 * Bible Version routines
 ***********************************************************************/  
// There are four types of tabs:
//    1) regular- created once for each module, visibility and style is controlled .(id: tabn)
//    2) select tab- created once, but is only drawn when needed, and it's menu entries are created as needed. (id seltab)
//    3) select tab item- created for each display configuration. (id: seltabn)
//    4) ORIG tab- always treated specially. 
function placeTabs() {
  for (var i=0; i<Tabs.length; i++) {
    document.write("<input type=\"button\" class=\"tabs\" id=\"tab" + i + "\" value=\"" + Tabs[i].label + "\" onmouseover=\"tabHandler(event);\" onmouseout=\"tabHandler(event);\" onclick=\"tabHandler(event);\"></button>");
  }
  // "more tabs" tab is a pulldown to hold all tabs which don't fit
  // seltab.button is needed to capture tab selection clicks without activating pulldown menu
  document.write("<div style=\"position:relative; display:inline; border:1px solid transparent;\">"); // to stack two buttons...
  document.write("<div id=\"seltab.tab\" onclick=\"tabHandler(event)\" onmouseover=\"tabHandler(event);\" onmouseout=\"tabHandler(event);\" style=\"position:absolute; top:-8px; height:22px;\"></div>");
  document.write("<select class=\"tabs\" id=\"seltab.menu\" onmouseover=\"tabHandler(event);\" onmouseout=\"tabHandler(event);\" style=\"text-align:center; padding-top:2px;\" ></select>");
  document.write("</div>");
}

function setSelTabDirection() {
  var st = document.getElementById("seltab.tab");
  if (!st || !st.nextSibling.value) return;
  var modName = Tab[st.nextSibling.value].modName;
  var isOrig = ((OrigModuleNT && modName==OrigModuleNT) || (OrigModuleOT && modName==OrigModuleOT));
  if (!isOrig && VersionConfigs[modName] && VersionConfigs[modName].direction == "rtl") {
    st.style.left = "24px";
    st.style.right = "4px";
  }
  else {
    st.style.left = "4px";
    st.style.right = "24px";
  }
}

function tabHandler(e) {
  if (!MainWindow.openTabToolTip) return;
  var tabnum = null;
  try {
    if (e.target.id == "seltab.tab") tabnum = Tab[e.target.nextSibling.value].index;
    else if (e.target.id.substr(0,6)=="seltab") {
      tabnum = e.target.id.match(/seltab(\d+)/)[1];
    }
    else tabnum = e.target.id.substr(3);
  }
  catch (er) {tabnum=null;}
  if (!tabnum && tabnum!=0) return;
  switch (e.type) {
  case "mouseover":
    MainWindow.openTabToolTip(tabnum, Win.number, e.clientX, e.clientY);
    break;
  case "mouseout":
    MainWindow.closeTabToolTip();
    break;
  case "click":
    MainWindow.closeTabToolTip();
    if (e.target.className.search("tabDisabled")!=-1 || Pin.isPinned) {
      if (e.target.id.substr(0,6)=="seltab") MainWindow.updateTabLabelsAndStyles();
      return;
    }
    var preChangeLinkArray = MainWindow.copyLinkArray();
    MainWindow.setVersionTo(Win.number, Tabs[tabnum].modName);
    MainWindow.updateLocators(false);
    if (MainWindow.UpdateTabs) window.clearTimeout(MainWindow.UpdateTabs);
    var updatesNeeded = MainWindow.getUpdatesNeededArray(Win.number, preChangeLinkArray);
    if (e.target.id) {
      var blur = null;
      if (e.target.id.substr(0,6)=="seltab") blur = "seltab.menu";
      else blur = e.target.id;
      window.setTimeout("document.getElementById('" + blur + "').blur();", 0);
    }
    MainWindow.UpdateTabs = window.setTimeout("{MainWindow.updatePinVisibility(); MainWindow.updateTabLabelsAndStyles(); MainWindow.updateFrameScriptBoxes([" + updatesNeeded + "]," + SCROLLTYPECENTER + "," + HILIGHT_IFNOTV1 + "," + NOUPDATELOCATOR + ");}",0);    
    break;
  }
}

function setFontSize(className,sz) {
  for (var i=0; i<document.styleSheets[0].cssRules.length; i++) {
    var thisText = document.styleSheets[0].cssRules[i].cssText;
    if (thisText.match(/^(.*?) /)[1]  == className) {document.styleSheets[0].cssRules[i].style.fontSize = String(sz) + "px";}
  }
}

/************************************************************************
 * Sizing and placing Scripture, notes, and the boundary bar
 ***********************************************************************/  
function resizeBibles(dontChangeContents, hideNoteBox) {
  if (!dontChangeContents) {
    ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
    ScriptBoxTextElement.innerHTML="";
  }
  if ((window.frameElement.id=="bible1Frame") && (prefs.getBoolPref("ShowChooser") || prefs.getBoolPref("ShowGenBookChooser"))) {placeChooser();}
  if (Win.number <= prefs.getIntPref("NumDisplayedWindows")) {
    setBibleWidth();
    setBibleHeight(null, hideNoteBox);
  }
}

function setBibleWidth(initializing) {
  var winW, chooserWidth;
  winW = initializing ? prefs.getIntPref("WindowWidth"):OwnerDocument.width;
  // Cludge
  if (guiDirection() == "rtl" && winW < OwnerDocument.getElementById("main-controlbar").boxObject.width) winW = OwnerDocument.getElementById("main-controlbar").boxObject.width;
  //jsdump("Frame Width Pref:" + prefs.getIntPref("WindowWidth") + ", Measured:" + OwnerDocument.width + "\n");
  
  var effectiveWindowPaddingStart;
  if (prefs.getBoolPref("ShowChooser") || prefs.getBoolPref("ShowGenBookChooser")) {
    var chooserInnerWidth = OwnerDocument.getElementById("bible1Frame").contentDocument.getElementById("chooserhole").offsetWidth;
    effectiveWindowPaddingStart = chooserInnerWidth + ChooserStartMargin + ChooserGap;
  }
  else effectiveWindowPaddingStart = MarginStartWhenNoChooser;

  DesiredFrameWidth = (winW - effectiveWindowPaddingStart)/prefs.getIntPref("NumDisplayedWindows");
  var actualFrameWidth = DesiredFrameWidth;

  if (actualFrameWidth < MinScriptWidth) actualFrameWidth=MinScriptWidth;
  
  // Assign FrameWidth and MarginStartOfScriptBox to this particular frame:
  if (Win.number == 1) {
    var genBookChooserElement = OwnerDocument.getElementById("genBookChooser");
    if (prefs.getBoolPref("ShowGenBookChooser")) {
      genBookChooserElement.style.width = effectiveWindowPaddingStart + "px";
      FrameWidth = actualFrameWidth;
      MarginStartOfScriptBox = 0;
    }
    else {
      FrameWidth = actualFrameWidth + effectiveWindowPaddingStart;
      MarginStartOfScriptBox = effectiveWindowPaddingStart;
    }
  }
  else if (Win.number > prefs.getIntPref("NumDisplayedWindows")) 
      FrameWidth=0;
  else {
    FrameWidth = actualFrameWidth;
    MarginStartOfScriptBox = 0;
  }

  ScriptWidth = FrameWidth - MarginEnd;

  ScriptBoxElement.style.left  = (guiDirection() == "rtl" ? String(MarginEnd) + "px":String(MarginStartOfScriptBox) + "px");
  ScriptBoxElement.style.right = (guiDirection() == "rtl" ? String(MarginStartOfScriptBox) + "px":String(MarginEnd) + "px");
  ConnectorElement.style.width  = String(MarginEnd)+ "px";
  Frame.style.minWidth = String(FrameWidth) + "px";
  
  if (guiDirection() == "rtl") {
    NoteBoxSizerElement.style.left = "43px";
    Pin.elem.style.right = String(MarginStartOfScriptBox + 3) + "px";
  }
  else {
    NoteBoxSizerElement.style.right = "43px";
    Pin.elem.style.left = String(MarginStartOfScriptBox + 3) + "px";
  }
}

function setBibleHeight(initializing, hideNoteBox) {
  //Set the notebox resize image
  MainWindow.setNoteBoxSizer(Win.number, prefs.getBoolPref("MaximizeNoteBox" + Win.number));
  
  //This pref is used at initialization because the main window has not been drawn (because it
  //looks much better if the window opens after everything inside has been sized). Since its
  //dimensions are unknown we use a pref.
  EffectiveWinH = initializing ? prefs.getIntPref("BibleFrameHeight"):window.innerHeight;
  prefs.setIntPref("BibleFrameHeight",EffectiveWinH);
  //jsdump("Frame Height Pref:" + prefs.getIntPref("BibleFrameHeight") + ", Measured:" + window.innerHeight + "\n");
    
  var gfn = (Bible.getGlobalOption("Footnotes") == "On");
  var gcr = (Bible.getGlobalOption("Cross-references") == "On");
  var gun = (prefs.getCharPref("User Notes") == "On");
  
  var sfn = gfn && prefs.getBoolPref("ShowFootnotesAtBottom");
  var scr = gcr && prefs.getBoolPref("ShowCrossrefsAtBottom");
  var sun = gun && prefs.getBoolPref("ShowUserNotesAtBottom");
  var sdt = (Win.modType == DICTIONARY);
  
  var noteHeight, boundaryGap, adjustSBox, adjustNBox, noteBoxVisibility, boundaryBarVisibility;
  var adjust = -2;
  // If we're hiding the note box or it is not showing
  if (!sdt && !prefs.getBoolPref("MaximizeNoteBox" + Win.number) && ((!sfn && !scr && !sun) || hideNoteBox)) {
    MainWindow.setNoteBoxSizer(Win.number, false);
    noteBoxVisibility="hidden";
    boundaryBarVisibility="hidden";
    noteHeight=2;
    boundaryGap = 0;
    adjustSBox = adjust;
    adjustNBox = 0;
  }
  // Else if the note box is showing and it has something inside it
  else if (NoteBoxEmpty==false || sdt || prefs.getBoolPref("MaximizeNoteBox" + Win.number)) {
    noteBoxVisibility="visible";
    boundaryBarVisibility="visible";
    if (prefs.getBoolPref("MaximizeNoteBox" + String(Win.number))) {noteHeight = EffectiveWinH - ScriptBoxMarginTop - BottomMargin - BoundaryBarGap;}
    else {noteHeight=FootnoteWinH;}
    if (noteHeight < 2) {noteHeight = 2;}
    boundaryGap = BoundaryBarGap;
    adjustSBox = 0;
    adjustNBox = adjust;
  }
  // Else the note box is otherwise showing, but it is empty
  else {
    MainWindow.setNoteBoxSizer(Win.number, false);
    noteBoxVisibility="hidden";
    boundaryBarVisibility="hidden";
    noteHeight=2;
    boundaryGap = 0;
    adjustSBox = adjust;
    adjustNBox = 0;
  }
  
  // Check that window is not too short and if so, freeze everything at minimum
  if (EffectiveWinH < MinScriptHeight) {EffectiveWinH = MinScriptHeight;}
  ScriptBoxHeight = EffectiveWinH - ScriptBoxMarginTop - BottomMargin;
  ScriptHeight = ScriptBoxHeight - boundaryGap - noteHeight;

  // Check to make sure Script box isn't set too short
  var minScriptH = 0;
  if (ScriptHeight <= minScriptH) {
    ScriptHeight=minScriptH; 
    noteHeight = ScriptBoxHeight - boundaryGap - ScriptHeight;
    if (!prefs.getBoolPref("MaximizeNoteBox" + String(Win.number))) {FootnoteWinH = noteHeight;}
  }
  
  ScriptBoxElement.style.top    = String(ScriptBoxMarginTop)+ "px";
  ConnectorElement.style.top    = String(ScriptBoxMarginTop + ConnectorIndent) + "px";
 
  ScriptBoxElement.style.height = String(ScriptBoxHeight) + "px";
  NoteBoxElement.style.height = String(noteHeight) + "px";
  ConnectorElement.style.height = String(ScriptBoxElement.offsetHeight - (2*ConnectorIndent) - 2) + "px";
  ScriptBoxTextElement.style.height = String(ScriptHeight + adjustSBox) + "px";
  
  BoundaryBarElement.style.visibility = boundaryBarVisibility;
  NoteBoxElement.style.visibility = noteBoxVisibility;
  
  NoteBoxSizerElement.style.top = String(NoteBoxElement.offsetTop - 17) + "px";
}

/************************************************************************
 * Miscellanious
 ***********************************************************************/ 
 
//NOTE: THESE FUNCTIONS ARE ALSO CALLED BY CHOOSER.JS FUNCTIONS
function updateFontSizes() {
  adjustFontSizes(prefs.getIntPref('FontSize'));
  if (Win.number == 1) initChooser();
  if (Win.number <= prefs.getIntPref("NumDisplayedWindows")) {
    setBibleWidth();
    setBibleHeight();
  }
}

function clearSelections() {
  for (var w=1; w<=3; w++) {
    if (w != Win.number) {
      MainWindow.FrameDocument[w].defaultView.getSelection().removeAllRanges();
    }
  }
}

