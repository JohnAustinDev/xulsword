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
var MarginRight;
var MarginLeftWhenNoChooser;
var ShX, ShY;
var ScriptBoxMarginTop;
var BottomMargin;
var ConnectorIndent;
var ChooserMinTopBorder;
var ChooserMinBottomBorder;
var ChooserOffsetFromCenter;
var HoleMarginV;
var HoleMarginH;
var PopupElement;
var PopupShadowElement;
var ScriptBoxElement;
var ScriptBoxTextElement;
var NoteBoxElement;
var ConnectorElement;
var BoundaryBarElement;
var BoundaryBarShadowElement;
var NoteBoxSizerElement;
var LanguageTabsElement;
var Frame;
var OwnerDocument;
var FootnoteWinH;
var EmptyH;
var BMDS;
var Mtext;
var FrameDocumentHavingNoteBox;
var HaveLeftTarget;
var ImmediateUnhighlight;
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
var MarginLeftOfScriptBox;
var BoundaryBarGap;
var EffectiveWinH;
var PreviousT;
var PinnedAndLinked;
var MinScriptHeight;
var MinScriptWidth;
var LastVersion;
var MyFootnotes;
var Win = {number:null, modName:null, modType:null, isRTL:null, isLinkedToRight:null};
var Pin = {number:null, shortName:null, chapter:null, verse:null, key:null, isPinned:null, elem:null, updatePin:null, updateLink:null};

/************************************************************************
 * Initialization after HTML has loaded
 ***********************************************************************/
function initializeScript() {
  updateCSSBasedOnCurrentLocale([".chooser", ".testamentchooser", ".languageTabs", ".tabs"]);
  createVersionClasses(0);
  initializeStyleGlobals(0);
  pullFontSizesFromCSS(0);

  PopupElement              = document.getElementById("npopup");
  PopupShadowElement        = document.getElementById("npopupSH");
  ScriptBoxElement          = document.getElementById("scriptBox");
  ScriptBoxTextElement      = document.getElementById("scriptBoxText");
  NoteBoxElement            = document.getElementById("noteBox");
  ConnectorElement          = document.getElementById("connector");
  BoundaryBarElement        = document.getElementById("boundary");
  BoundaryBarShadowElement  = document.getElementById("boundaryHi");
  NoteBoxSizerElement       = document.getElementById("nbsizer");
  LanguageTabsElement       = document.getElementById("langTabs");
  
//********************************
//*
  //Style like params for horizontal layout 
  ChooserGap=10;                //Gap between chooser and text
  TabBarMargin=44;              //Margin left+right of Tab Bar              
  MarginRight=30;               //Margin right of ScriptBox
  MarginLeftWhenNoChooser=30;   //Left window margin when chooser is closed
  ShX=(guiDirection()=="rtl" ? -14:14); 
  ShY=12;               //Shadow offset for popups
  MinScriptWidth = 270;         //Miniumum width script box will go

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
  
  FrameDocumentHavingNoteBox = window.document;      //Global for saving the document object of Frame which will display footnotes
  HaveLeftTarget=false;
  ImmediateUnhighlight=false;
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
    var ud = ["shortName", "chapter", "verse"];
    for (var u=0; u<ud.length; u++) {
      for (var w=1; w<=3; w++) {
        if (!MainWindow.Link.isLink[w] || w==this.number) continue;
        MainWindow.FrameDocument[w].defaultView.Pin[ud[u]] = this[ud[u]];
      }
    }
  }
  Pin.updatePin = function(book, chapter, verse) {
    this.shortName = book;
    this.chapter = chapter;
    this.verse = verse;
  }

  adjustFontSizes(0, prefs.getIntPref('FontSize'));

  if (window.screen.width <= 800) {
    ScriptBoxTextCSS.style.paddingLeft="20px";
    ScriptBoxTextCSS.style.paddingRight="20px";
  }
  
  PopupElement.innerHTML = "Empty";
  EmptyH = Number(PopupElement.offsetHeight);
  
  BMDS = initBMServices(); 
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
    Frame.style.visibility="visible";
  }
}


/************************************************************************
 * Script Box
 ***********************************************************************/

function updateScriptBox(scrollTypeFlag, highlightFlag, showIntroduction) {
//jsdump("Updating:" + Win.number + "\n");
  
  var versionHasChanged=false;
  if (LastVersion != Win.modName) {
    versionHasChanged=true;
    ScriptBoxTextElement.className = "scriptboxtext vstyle" + Win.modName;
    NoteBoxElement.className = "notebox vstyle" + Win.modName;
    PopupElement.className = "npopup vstyle" + Win.modName;
    if (Win.number == 1) updateCSSBasedOnVersion(Win.modName, [".chapsubtable", ".hpopup"]);
    LastVersion = Win.modName;
  }
  
  switch (Win.modType) {
  case BIBLE:
  case COMMENTARY:
    updateBibleOrCommentary(scrollTypeFlag, highlightFlag, showIntroduction);
    break;
  case DICTIONARY:
    FrameDocumentHavingNoteBox = window.document;
    if (!versionHasChanged && ScriptBoxTextElement.innerHTML.length && NoteBoxElement.innerHTML.length) {
      updateDictionary();
    }
    else {
      ConnectorElement.style.visibility = "hidden";
      SelectedKey=null;
      var written = writeDictionaryList(versionHasChanged);
      if (written) updateDictionary();
      else {
        //If module is empty or not loaded correctly
        ScriptBoxTextElement.innerHTML="";
        NoteBoxElement.innerHTML=""
      }
    }
    break;
  case GENBOOK:
    FrameDocumentHavingNoteBox = window.document;
    updateGenBook(showIntroduction);
    break;
  default:
    jsdump("Tried to update unsupported module type:" + Win.modType + " (updateScriptBox)\n");
    break;
  }
  closePopup(); // Needed so that popup closes even if context menu was open
}

function updateBibleOrCommentary(scrollTypeFlag, highlightFlag, showIntroduction) {
  var savedLocation;
  
  if (Pin.isPinned) {
    // Global location is saved and replaced at end of this routine. This means that
    // OTHER BIBLES SHOULD NOT BE ACCESSED WHILE THIS ROUTINE IS EXECUTING OR THEIR LOCATION
    // WILL BE INCORRECT
    savedLocation = Bible.getLocation(Win.modName);
    Bible.setBiblesReference(Win.modName, Pin.shortName + "." + Pin.chapter + "." + Pin.verse);
  }
  else {
    Pin.shortName = Bible.getBookName();
    Pin.chapter = Bible.getChapterNumber(Win.modName);
    Pin.verse = Bible.getVerseNumber(Win.modName);
  }
  if (highlightFlag &&
      (highlightFlag==HILIGHTVERSE || (highlightFlag==HILIGHT_IFNOTV1 && Bible.getVerseNumber(Win.modName)!=1)) &&
      !Pin.isPinned && Win.modType==BIBLE) {SelectedVerseCSS.style.color=SelectedVerseColor;}
  else {SelectedVerseCSS.style.color=ScriptBoxFontColor;}
  
  if (!MainWindow.Link.isLink[Win.number] || Win.number == MainWindow.Link.leftWin) {
    if (!MainWindow.Link.isLink[Win.number]) {
      var showIntroForThisLink = ((showIntroduction && showIntroduction==Win.number) ? true:false);
    }
    else {
      showIntroForThisLink = ((showIntroduction && (showIntroduction>=MainWindow.Link.leftWin && showIntroduction<=MainWindow.Link.rightWin)) ? true:false);
    }
    MainWindow.writeToScriptBoxes(Win, Pin.isPinned, showIntroForThisLink, scrollTypeFlag);
  }
  if (Pin.isPinned) {
    Bible.setBiblesReference(Win.modName, savedLocation);
  }
}

function updateGenBook(showIntroduction) {
  var savedKey;

  if (Pin.isPinned) {
    // Global key is saved and replaced at end of this routine. This means that
    // OTHER WINDOWS SHOWING THIS BOOK SHOULD NOT BE ACCESSED WHILE THIS ROUTINE IS EXECUTING OR THEIR LOCATION
    // WILL BE INCORRECT
    savedKey = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
    setUnicodePref("ShowingKey" + Win.modName, Pin.key);
  }
  else Pin.key = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");

  var showIntroForThisLink = (showIntroduction && showIntroduction==Win.number);
  MainWindow.writeToScriptBoxes(Win, Pin.isPinned, showIntroForThisLink, SCROLLTYPENONE);
  
  if (Pin.isPinned) {
    setUnicodePref("ShowingKey" + Win.modName, savedKey);
  }
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
  while (ca && LangSortSkipChars.search(ca)!=-1) {ca = a.charAt(++xa);}
  var cb = b.charAt(xb);
  while (cb && LangSortSkipChars.search(cb)!=-1) {cb = b.charAt(++xb);}
  while (ca || cb) {
    if (!ca) return -1;
    if (!cb) return 1;
    if (SortOrder.indexOf(ca) < SortOrder.indexOf(cb)) return -1;
    if (SortOrder.indexOf(ca) > SortOrder.indexOf(cb)) return 1;
    ca = a.charAt(++xa);
    while (ca && LangSortSkipChars.search(ca)!=-1) {ca = a.charAt(++xa);}
    cb = b.charAt(++xb);
    while (cb && LangSortSkipChars.search(cb)!=-1) {cb = b.charAt(++xb);}
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
  var config = LocaleConfigs[rootprefs.getCharPref("general.useragent.locale")];
  var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
  var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));
  charNext = "<span style=\"font-family:ariel;\">" + charNext + "</span>"; // Because 'UKIJ Tuz Basma' improperly implements this char!
  charPrev = "<span style=\"font-family:ariel;\">" + charPrev + "</span>"; // Because 'UKIJ Tuz Basma' improperly implements this char!

  //var mytype = win.modType;
  var prevDisabled = false; //mytype==BIBLE && Pin.chapter==1 && Pin.shortName=="Gen";
  var nextDisabled = false; //mytype==BIBLE && Pin.chapter==22 && Pin.shortName=="Rev";
  
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

function getChapterWithNotes(fn, ch, chapOffset) {
  if (!chapOffset) chapOffset = 0;
  var bch = Bible.getChapterNumber(Win.modName);
  var needDifferentChap = (chapOffset != 0 || bch != ch);
  switch (Win.modType) {
  case BIBLE:
    if (needDifferentChap) {
      var savedloc = Bible.getLocation(Win.modName);
      var bkn = findBookNum(Bible.getBookName());
      var chn = ch + chapOffset;
      if (chn > 0 && chn <= Book[bkn].numChaps) {
        Bible.setBiblesReference(Win.modName, Book[bkn].sName + "." + chn + ".1");
        Bible.setVerse(Win.modName, 0, 0);
      }
      else return "";
    }
    var text = getChapterText(Bible, fn, Win.modName, (chapOffset!=0));
    if (needDifferentChap) Bible.setBiblesReference(Win.modName, savedloc);
    break;
  case COMMENTARY:
    var text = getChapterText(Bible, fn, Win.modName);
    break;
  case GENBOOK:
    text = getGenBookChapterText(getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", ""), Bible, fn);
//if (text.search("<note") != -1) window.alert(getUnicodePref("ShowingKey" + vers));
    break;
  }

  return text;
}

//after user notes are collected and page is drawn, go add highlight to all usernote verses
function markUserNoteVerse(id) {
  var verse = id.match(/un\..*?\.([^\.]*\.\d+\.\d+)$/);
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
  
  if (!elemID && Pin.isPinned) elemID = "vs." + Pin.shortName + "." + Pin.chapter + "." + Pin.verse;
  var intid = "";
  if (!elemID) {
    if (!prefs.getBoolPref("ShowOriginal" + Win.number))
      elemID = "vs." + Bible.getBookName() + "." + Bible.getChapterNumber(Win.modName) + "." + Bible.getVerseNumber(Win.modName);
    else {
      intid = ".1";
      elemID = "vs." + Bible.getBookName() + "." + Bible.getChapterNumber(Win.modName) + "." + Bible.getVerseNumber(Win.modName) + intid;
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

/************************************************************************
 * ScriptBox mouse events
 ***********************************************************************/ 

var HighlightElement1=null;
var HighlightElement2=null;
var IgnoreMouseOvers=false; // Used to block mouseoverse while popup is switching
function scriptboxMouseOver(e) {
  if (IgnoreMouseOvers) return;
  if (OwnerDocument.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}
  if (BoundaryClicked) return;

  //If target has no id, find first parent that does
  ClientX = Number(e.clientX);
  ClientY = Number(e.clientY);
  
  var elem = e.target;
  while (elem && elem.id=="" && elem.title=="") {elem=elem.parentNode;}
  if (!elem) return;
  
/*  // Get some position cues...
  var overPopup=false;
  var overScriptBox=false;
  var overNoteBox=false;
  var telem = elem;
  while (telem) {
    if (telem.id) {
      overPopup |= telem.id==PopupElement.id;
      overScriptBox |= telem.id==ScriptBoxTextElement.id;
      overNoteBox |= telem.id==NoteBoxElement.id;
    }
    telem = telem.parentNode;
  }
*/

  var edata = getElemType(elem);
//jsdump("edata:" + edata + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (edata) {
  case "cr":
    if (prefs.getBoolPref("ShowCrossrefsAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhighlight=false;
      scroll2Note("ntr." + edata + "." + elem.title);
    }
    else if (!activatePopup(edata, elem.title)) {elem.style.cursor = "default";}
    break;
     
  case "fn":
    if (prefs.getBoolPref("ShowFootnotesAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhighlight=false;
      scroll2Note("ntr.fn." + elem.title);
    }
    else activatePopup("fn", elem.title);
    break;

  case "sr":
    if (PopupElement.style.display != "none") return;
//jsdump((elem.title=="unavailable" ? elem.innerHTML:elem.title) + "\n");
    if (!activatePopup("sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title)))
      elem.style.cursor = "default";
    break;
    
  case "dt":
    if (PopupElement.style.display != "none") return;
    activatePopup("dt", elem.title);
    break;
    
  case "dtl":
    if (PopupElement.style.display != "none") return;
    activatePopup("dtl", elem.title);
    break;
    
  case "sn":
    // See if interlinear display and if so process...
    var aVerse = elem;
    while (aVerse.parentNode && (!aVerse.parentNode.className || aVerse.parentNode.className!="interB" && aVerse.parentNode.className!="hl")) {aVerse = aVerse.parentNode;}
    var isShowingOrig = (prefs.getBoolPref("ShowOriginal" + Win.number) && aVerse.parentNode);
    if (prefs.getCharPref("Strong's Numbers")=="On")
        activatePopup("sn", elem.innerHTML.replace(/<.*?>/g, "") + "]-[" + elem.title, POPUPDELAY, (isShowingOrig ? aVerse.parentNode.offsetHeight+10:40));
    if (isShowingOrig) {
      var aVerse2 = aVerse;
      if (aVerse && aVerse.nextSibling) {
        aVerse = aVerse.nextSibling;
        if (aVerse.className == "interS") aVerse = aVerse.nextSibling;
      }
      else if (aVerse && aVerse.previousSibling) {
        aVerse = aVerse.previousSibling;
        if (aVerse.className == "interS") aVerse = aVerse.previousSibling;
      }
      if (HighlightElement1) MainWindow.unhighlightStrongs(HighlightElement1, "matchingStrongs");
      if (HighlightElement2) MainWindow.unhighlightStrongs(HighlightElement2, "matchingStrongs");
      if (aVerse) {
        MainWindow.highlightStrongs(aVerse, elem.title.split("."), "matchingStrongs");
        HighlightElement1 = aVerse;
      }
      if (aVerse2) {
        MainWindow.highlightStrongs(aVerse2, elem.title.split("."), "matchingStrongs");
        HighlightElement2 = aVerse2;
      }
    }
    break;
            
  case "un":
    if (prefs.getBoolPref("ShowUserNotesAtBottom") && (Win.modType==BIBLE || Win.modType==COMMENTARY)) {
      HaveLeftTarget=false;
      ImmediateUnhighlight=false;
      scroll2Note("ntr." + elem.id);
    }
    else activatePopup("un", elem.id);
    break;
    
  case "listenlink":
    elem.src="chrome://xulsword/skin/images/listen1.gif";
    break;
    
  case "pin":
    elem.src="chrome://xulsword/skin/images/pushpin2.png";
    break;
    
  case "introlink":
    if (getPrefOrCreate("ShowIntrosBeforeText", "Bool", false)) return;
    activatePopup("introlink", elem.title);
    break;
  }
}

function scriptboxClick(e) {
  if (Win.modType==GENBOOK) {
    var key = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
    if (!MainWindow.isSelectedGenBook(key)) {
      MainWindow.openGenBookKey(key);
      MainWindow.selectGenBook(key);
    }
  }
  var elem = e.target;
  while (elem && elem.id=="" && elem.title=="") {elem=elem.parentNode;}
  if (!elem) return;
  
  var edata = getElemType(elem);
//jsdump("edata:" + edata + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (edata) {
    case "cr":
    var ok = expandCrossRefs(edata + "." + elem.title);
    if (ok) scroll2Note("ntr." + edata + "." + elem.title);
    break;
    
  case "pul":
    goToCrossReference(elem.title, false);
    break;

  case "sr":
    activatePopup("sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title), 0, -40);
    break;
    
  case "dt":
  case "dtl":
    activatePopup("dt", elem.title, 0, -40);
    break;
    
  case "prevchaplink":
    switch (Win.modType) {
    case BIBLE:
    case COMMENTARY:
      if (MainWindow.Link.isTextLink[Win.number]) MainWindow.previousPage(HILIGHTNONE, SCROLLTYPEEND, (Pin.isPinned ? Pin:null));
      else MainWindow.previousChapter(HILIGHTNONE, SCROLLTYPEBEG, (Pin.isPinned ? Pin:null));
      break;
    case DICTIONARY:
      var currentKey = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
      for (var k=0; k<DictionaryList.length; k++) {if (DictionaryList[k]==currentKey) break;}
      k--;
      if (DictionaryList[k]) {
        setUnicodePref("ShowingKey" + Win.modName, DictionaryList[k]);
        updateDictionary();
      }
      break;
    case GENBOOK:
      if (!Pin.isPinned) MainWindow.bumpSelectedIndex(true);
      else MainWindow.bumpPinnedIndex(Pin, true);
      break;
    }
    break;
    
  case "nextchaplink":
    switch (Win.modType) {
    case BIBLE:
    case COMMENTARY:
      if (MainWindow.Link.isTextLink[Win.number]) MainWindow.nextPage(HILIGHTNONE, (Pin.isPinned ? Pin:null));
      else MainWindow.nextChapter(HILIGHTNONE, SCROLLTYPEBEG, (Pin.isPinned ? Pin:null));
      break;
    case DICTIONARY:
      var currentKey = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
      for (var k=0; k<DictionaryList.length; k++) {if (DictionaryList[k]==currentKey) break;}
      k++;
      if (DictionaryList[k]) {
        setUnicodePref("ShowingKey" + Win.modName, DictionaryList[k]);
        updateDictionary();
      }
      break;
    case GENBOOK:
      if (!Pin.isPinned) MainWindow.bumpSelectedIndex(false);
      else MainWindow.bumpPinnedIndex(Pin, false);
      break;
    }
    break;
    
  case "introlink":
    if (!getPrefOrCreate("ShowIntrosBeforeText", "Bool", false)) return;
    var showIntro = elem.title=="hide" ? null:Win.number;
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPETOP, HILIGHTNONE, showIntro);
    break;
    
  case "listenlink":
    MainWindow.Player.isPinned = Pin.isPinned;
    MainWindow.Player.version = Win.modName;
    MainWindow.Player.chapter = Number(elem.id.split(".")[1]);
    if (Pin.isPinned) MainWindow.Player.book = Pin.shortName;
    else MainWindow.Player.book = Bible.getBookName();

    MainWindow.beginAudioPlayer();
    break;
    
  case "pin":
    if (Pin.isPinned) unpinThis();
    else pinThis();
    break;
    
  case "popupBackLink":
    elem = elem.nextSibling;
    var yoffset = Number(elem.innerHTML)- ClientY;
    if (yoffset > 0) yoffset=0;
    activatePopup("html", elem.nextSibling.innerHTML, 0, yoffset);
    break;
  }
}

function pinThis() {
  Pin.isPinned = true;
  var preChangeLink = MainWindow.copyLinkArray();
  setFramePinStyle(true);
  if (Win.modType == BIBLE || Win.modType == COMMENTARY) {
    // window texts should not change when pinned
    var loc = MainWindow.getPassageFromWindow(MainWindow.FIRSTPASSAGE, Pin.number);
    if (loc) loc = loc.substring(0, loc.lastIndexOf(".")).split(".");
    else loc = [Bible.getBookName(), Bible.getChapterNumber(Win.modName), Bible.getVerseNumber(Win.modName)];
    Pin.updatePin(loc[0], loc[1], loc[2]);
  }
  else if (Win.modType == GENBOOK) Pin.key = getPrefOrCreate("ShowingKey" + Win.modName, "Unicode", "");
  MainWindow.updateLinkInfo();
  Pin.updateLink();
  MainWindow.updatePinVisibility();
  MainWindow.updateTabLabelsAndStyles();
  MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number, preChangeLink), SCROLLTYPEBEG, HILIGHTNONE);
  MainWindow.updateLocators(false);
}

function unpinThis() {
  Pin.isPinned = false;
  var preChangeLink = MainWindow.copyLinkArray();
  setFramePinStyle(false);
  if (Win.modType == BIBLE || Win.modType == COMMENTARY) {
    // make the unpinned win show what the pinned win show
    var loc = MainWindow.getPassageFromWindow(MainWindow.FIRSTPASSAGE, Pin.number);
    if (loc) loc = loc.substring(0, loc.lastIndexOf("."));
    else loc = Pin.shortName + "." + Pin.chapter + "." + Pin.verse;
    Bible.setBiblesReference(Win.modName, loc);
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
    MainWindow.updateFrameScriptBoxes(update, SCROLLTYPEBEG, HILIGHTNONE);
    MainWindow.updateLocators(false);
  }
  else if (Win.modType == GENBOOK) {
    MainWindow.SkipGenBookWindow = Win.number; // don't update or scroll text of this window
    MainWindow.selectGenBook(Pin.key);
  }
}

function setFramePinStyle(isPinned) {
  Pin.elem.src = isPinned ? "chrome://xulsword/skin/images/pushpin1.png":"chrome://xulsword/skin/images/pushpin0.png";
  ScriptBoxTextElement.className = appendOrRemoveClass("scriptboxPinned", ScriptBoxTextElement, isPinned);
  ScriptBoxElement.className = appendOrRemoveClass("scriptboxPinned", ScriptBoxElement, isPinned);
  NoteBoxElement.className = appendOrRemoveClass("scriptboxPinnedNB", NoteBoxElement, isPinned);
  ConnectorElement.className = isPinned ? "connector scriptboxPinnedCN":"connector";
  BoundaryBarElement.className = isPinned ? "boundary scriptboxPinnedBB":"boundary";
}

function scriptboxDblClick(e) {
  var selob = window.getSelection();
  var sel = selob.toString();
  
  sel = cleanDoubleClickSelection(sel);
  
  var myv = null;
  var targ = e.target.parentNode;
  while (targ) {
    if (targ.className) {
      if      (targ.className.search("vstyle" + OrigModuleNT)!=-1) {
        myv = OrigModuleNT;
        break;
      }
      else if (targ.className.search("vstyle" + OrigModuleOT)!=-1) {
        myv = OrigModuleOT;
        break;
      }
    }
    targ = targ.parentNode;
  }
  if (!myv) myv = Win.modName;

  if (!sel || sel.search(/^\s*$/)!=-1) return; //return of nothing or white-space
  setUnicodePref("SearchText",sel);
  prefs.setCharPref("SearchVersion", myv);
  OwnerDocument.getElementById("cmd_xs_search").doCommand();
}

function scriptboxMouseOut(e) {
  if (OwnerDocument.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}
  if (ShowPopupID) {
    window.clearTimeout(ShowPopupID);
    IgnoreMouseOvers = false;
  }
  if (HighlightElement1) MainWindow.unhighlightStrongs(HighlightElement1, "matchingStrongs");
  if (HighlightElement2) MainWindow.unhighlightStrongs(HighlightElement2, "matchingStrongs");
  HighlightElement1=null;
  HighlightElement2=null;
  HaveLeftTarget=true;
  if (ImmediateUnhighlight) {unhighlightNote();}
  switch (getElemType(e.target)) {
  case "listenlink":
    e.target.src = "chrome://xulsword/skin/images/listen0.png";
    break;
    
  case "pin":
    e.target.src = (Pin.isPinned ? "chrome://xulsword/skin/images/pushpin1.png":"chrome://xulsword/skin/images/pushpin0.png");
    break;
  }
  var currentlyOver = e.relatedTarget;
  while (currentlyOver) {
    if (currentlyOver.id == "npopup") return;
    currentlyOver = currentlyOver.parentNode;
  }
  closePopup();
}

var ShowPopupID;
function activatePopup(datatype, data, delay, yoffset) {
//jsdump("datatype:" + datatype + " data:" + data + "\n");
  if (delay==null) {delay = POPUPDELAY;}
  if (!yoffset) {yoffset = 0;}
  
  var html = "";
  var hrule = "";
  var fromMod = Win.modName;
  var versionDirectionEntity = (VersionConfigs[fromMod] && VersionConfigs[fromMod].direction == "rtl" ? "&rlm;":"&lrm;");
  
  // If popup is already open, save the current popup in the "back" link of the new one...
  var pupAlreadyOpened=false;
  if (PopupElement.style.display != "none") {
    pupAlreadyOpened=true;
    html += "<div style=\"margin-bottom:20px;\">";
    html += "<a title=\"popupBackLink\" class=\"popupBackLink\">" + OwnerDocument.getElementById("history.back.label").childNodes[0].nodeValue + "</a>";
    html += "<div style=\"display:none;\">" + PopupElement.offsetTop + "</div>"; // Save current top, so that when going back, we can go to old position
    html += "<div style=\"display:none;\">" + PopupElement.innerHTML + "</div>";
    html += "</div>";
    closePopup();
  }
  IgnoreMouseOvers = true; // This should happen after "closePopup()" because closePopup() changes it to false!
  
  // Popup text and style:
  //  Popup Scripture reference links should appear in program's language and style
  //  Popup Scripture reference text and style should be determined correctly
  //    according to the results of findAVerseText
  //  Popup body text should appear in fromMod's style as inherited from ScriptBox
  
  // Get fromMod for scripture references, and style.
  var fromMod = Win.modName;
  var scripRefLinkStyle = "vstyleProgram";
  
  switch (datatype) {
  
  case "html":
    html = data;
    break;
  
  // Cross Reference: data is elem.title
  //    data form: cr#.bk.c.v
  case "cr":
    if (!pupAlreadyOpened) html += twistyButton(datatype, data, yoffset, versionDirectionEntity);
    var hideEmptyCrossReferences = getPrefOrCreate("HideUnavailableCrossReferences", "Bool", false);
    var chapRefs = MyFootnotes.CrossRefs.split("<nx/>");
    for (var i=0; i<chapRefs.length; i++) {
      var thisid = chapRefs[i].split("<bg/>")[0];
      var reflist = chapRefs[i].split("<bg/>")[1];
      // if we've found the note which matches the id under the mouse pointer
      if (thisid == datatype + "." + data) {
        html += getCRNoteHTML(fromMod, "pu", thisid, reflist, "<hr>", getPrefOrCreate("OpenCrossRefPopups", "Bool", true), Win.number);
        break;
      }
    }
    if (html) html = "<div class=\"vstyle" + fromMod + "\">" + html + "</div>";
    break;

  // Footnote: data is elem.title
  //    data form: fn#.bk.c.v
  case "fn":
    var footnote = MyFootnotes.Footnotes.split("<nx/>");
    for (var i=0; i<footnote.length; i++) {
      var fnpart = footnote[i].split("<bg/>");
      // if we've found the note which matches the id under the mouse pointer
      if (fnpart[0] == "fn." + data) {
        // Replace OSIS tags with HTML tags, such as <hi> tags with <i> or <b>.
        fnpart[1]=fnpart[1].replace(/<hi.*?type="italic".*?>(.*?)<\/hi>/g,"<i>$&</i>").replace(/<hi.*?type="bold".*?>(.*?)<\/hi>/g,"<b>$&</b>");
        html += fnpart[1];
        break;
      }
    }
    break;

  // Scripture Reference: data is elem.title unless it's "unavailable" then it's elem.innerHTML
  //    data form: reference1; reference2    
  case "sr":
    if (!pupAlreadyOpened) html += twistyButton(datatype, data, yoffset, versionDirectionEntity);
    // Split up data into individual passages
    data += ";";
    data = data.split(";");
    data.pop();
    var cnt = 1;
    // If subreferences exist which are separated by "," then split them out as well
    for (var i=0; i<data.length; i++) {
      var verses = data[i].split(",");
      if (verses.length == 1) continue;
      var r = 1;
      for (var v=0; v<verses.length; v++) {
        data.splice(i+1-r, r, verses[v]);
        i++;
        i -= r;
        r = 0;
      }
    }
    // Parse each reference into a normalized reference, convert verse system and get verse text
    var book = Bible.getBookName();
    var chapter = Bible.getChapterNumber(fromMod);
    var verse = 1;
    var hideEmptyCrossReferences = getPrefOrCreate("HideUnavailableCrossReferences", "Bool", false);
    var reflist = "";
    var failhtml = "";
    for (i=0; i<data.length; i++) {
      var failed = false;
      var saveref = data[i];
//jsdump(data[i]);
      data[i] = normalizeOsisReference(data[i], fromMod);
//jsdump(data[i] + ", ");
      if (!data[i]) {
        var thisloc = parseLocation(saveref);
        if (thisloc) {
          book = thisloc.shortName ? thisloc.shortName:book;
          chapter = thisloc.chapter ? thisloc.chapter:chapter;
          verse = thisloc.verse ? thisloc.verse:verse;
          data[i] = book + "." + chapter + "." + verse;
          if (thisloc.lastVerse) {data[i] += "-" + book + "." + chapter + "." + thisloc.lastVerse;}
          data[i] = normalizeOsisReference(data[i], fromMod);
          if (!data[i]) failed = true;
        }
        else failed = true;
      }
      if (failed) {
        book = null;
        chapter = null;
        verse = null;
        failhtml += "<hr>" + saveref + ": <b>????</b><br>";
        continue;
      }
//jsdump(data[i]);
      reflist += data[i] + ";";
    }
    html += getCRNoteHTML(fromMod, "pu", "cr." + cnt++ + ".Gen.1.1", reflist, "<hr>", getPrefOrCreate("OpenCrossRefPopups", "Bool", true), Win.number);
    html += failhtml;
    if (html) html = "<div class=\"vstyle" + fromMod + "\">" + html + "</div>";
    break;
  
  // Glossary Word: data is elem.title
  //    data form: mod.wrd; mod.wrd
  case "dtl":
  case "dt":
    var t = data + ";";
    t = t.split(";");
    t.pop();
    var dword = t[0].substring(t[0].indexOf(".")+1); // use substring, not split, to get everything after first "."
    var dnames="";
    var sep = "";
    for (var i=0; i<t.length; i++) {
      dnames += sep + t[i].split(".")[0];
      sep = ";"
    }
    // Returns with style of dnames[0]
    html += MainWindow.getDictionaryHTML(dword, dnames, true);
    //html = insertUserNotes("na", dword, dict, html);
    break;
    
  // User Note: data is elem.id
  //    data form: un.encodedResVal.bk.c.v
  case "un":
    try {
      var resVal = decodeUTF8(data.split(".")[1]);
      html += BMDS.GetTarget(RDF.GetResource(resVal), gBmProperties[NOTE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      var unclass = "vstyleProgram";
      try {
        unclass = "vstyle" + BMDS.GetTarget(RDF.GetResource(resVal), gBmProperties[NOTELOCALE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
      } 
      catch (er) {}
      html = "<div id=\"unp." + data + "\" class=\"" + unclass + "\"><i>" + html + "</i></div>"; // Add an id so that context menu can find resource
    }
    catch (er) {html = "";}
    break;
    
  // Strongs Number or Morphology: data is elem.title
  //    data form: (S|WT|SM|RM):(G|H)#.(S|WT|SM|RM):(G|H)#
  case "sn":
    // Pass data array as param1 and match-word as param2
    // Returns with style of module for data array [0]
    html += MainWindow.getLemmaHTML(data.split("]-[")[1].split("."), data.split("]-[")[0]);
    break;
    
  case "introlink":
    html += getBookIntroduction(Win.modName, Bible.getBookName(), Bible) + "<br><br>";
    break;
    
  default:
    jsdump("Unhandled popup datatype \"" + datatype + "\".\n");
  }
  
  if (html) {
    PopupElement.innerHTML = html;
    ShowPopupID = window.setTimeout("showPopup(" + yoffset + ")", delay);
  }
  else {
    IgnoreMouseOvers = false;
  }
  return html ? true:false;
}

// showPopup() must be called AFTER the popup content has been written to popup.
function showPopup(yOffset) {
  if (!yOffset) yOffset=0;
  // Display was set to "none" and this must be cleared before setting (or reading for sure) other style parameters
  PopupElement.style.display = ""; 
  PopupElement.style.height=""; //Start with no forced height, etc
  PopupElement.style.left="";
  PopupElement.style.right="";
  PopupElement.style.top="";
  PopupShadowElement.style.display = "";

  // Look at width:
  var right0 = 0;
  var left0 = ScriptBoxElement.offsetLeft + 4 + 20; //4 is borders?, 20 comes from scripbox CSS padding-left
  PopupElement.style.left = String(left0) + "px";
  // If single line note, then center under mouse
  if (Number(PopupElement.offsetHeight) <= EmptyH) {
    PopupElement.style.left = String(ClientX - (PopupElement.offsetWidth/2)) + "px";
    // If off of right edge, force right edge to right margin
    if (Number(PopupElement.offsetHeight) > EmptyH) {
      PopupElement.style.left="";
      PopupElement.style.right=String(right0) + "px";
    }
    // Else if off left side, then force left edge to left margin
    else if (PopupElement.offsetLeft < left0) {PopupElement.style.left=String(left0) + "px";}
  }
  // Otherwise, multiline popups get full width of ScripBox
  else {PopupElement.style.right = String(right0) + "px";}
  
  // Look at Height: try placing the popup window top just above mouse cursor, then massage if bottom edge doesn't fit
  var top = ClientY - 10 + yOffset;
  var fittop = ScriptBoxElement.offsetTop + ScriptBoxElement.offsetHeight - PopupElement.offsetHeight;
  var mintop = ScriptBoxElement.offsetTop + 20; // 20 margin from top, and below 62 incorporates this plus the difference between offsetHeight and height (42)
  if (fittop < mintop) {top = mintop; PopupElement.style.height=String(ScriptBoxElement.offsetHeight-62-ShY-8)+"px";}
  else if (top > fittop) {
    top = fittop;
    /*
    if (yOffset == 0) top = fittop;
    else {
      top = ClientY - PopupElement.offsetHeight - yOffset;
      if (top < mintop - 10) {
        top = mintop - 10;
        if (mintop + PopupElement.offsetHeight > ClientY - yOffset - ShY - 10)
          var mh = ClientY-yOffset-mintop - ShY - 10;
          if (mh < 20) mh = 20;
          PopupElement.style.height=String(mh)+"px";
      }
    }
    */
  }
  PopupElement.style.top = String(top) + "px";
  
  // Now place box shadow
  PopupShadowElement.style.width  = String(PopupElement.offsetWidth) + "px";
  PopupShadowElement.style.left   = String(PopupElement.offsetLeft + ShX) + "px";
  PopupShadowElement.style.top    = String(PopupElement.offsetTop + ShY) + "px";
  PopupShadowElement.style.height = String(PopupElement.offsetHeight) + "px";
  
  IgnoreMouseOvers=false;
}

function closePopup() {
  PopupElement.scrollTop = 0;
  // Stops if preparing to open
  if (ShowPopupID) {
    window.clearTimeout(ShowPopupID);
    IgnoreMouseOvers = false;
  }
  // Clear any note popup
  PopupElement.innerHTML="Empty";
  // This prevents the ScriptBox scroll smoothness from being messed up
  PopupElement.style.display = "none";
  PopupShadowElement.style.display = "none";
}

//Various types of elements are identified in different ways: some by their id, 
//others by their title and others by their className. This function identifies the
//type based on an element info.
function getElemType(elem) {
  var aType=null;
  if (elem.id) {
    aType = elem.id.match(/^([^\.]+)\./);
    if (aType) aType = aType[1];
    if (aType && (aType.substr(0,2)=="pu" || aType.substr(0,2)=="nb")) return aType;
  }
  if (!aType && elem.id) aType = elem.id; 
  aType = (elem.title ? elem.className.split("-")[0]:aType);
  return aType;
}

function openCloseCRs(datatype, data, yoffset) {
  closePopup();
  prefs.setBoolPref("OpenCrossRefPopups", !prefs.getBoolPref("OpenCrossRefPopups"));
  activatePopup(datatype, data, 0, yoffset);
}

function twistyButton(datatype, data, yoffset, dirEntity) {
  var html = "";
  html += "<img onclick=\"openCloseCRs('" + datatype + "', '" + data + "', " + yoffset + ");\" ";
  html += "src=\"chrome://xulsword/skin/images/" + (getPrefOrCreate("OpenCrossRefPopups", "Bool", true) ? "twisty-open.png":"twisty-clsd.png") + "\" ";
  html += "style=\"position:absolute; top:7px; " + (dirEntity=="&rlm;" ? "right":"left") + ":8px; -moz-margin-start:0px;\">";
  return html;
}

function appendOrRemoveClass(className, element, append) {
  var myClass = element.className;
  if (!myClass) myClass = "";
  var hasClass = (myClass.search(className) != -1);
  if (append && !hasClass) myClass += " " + className;
  else if (!append && hasClass) myClass = myClass.replace(className,"");
  return myClass;
}

// Reads verse references including from-to type, it sets first verse as selected verse and any following verses are also highlighted
function goToCrossReference(crTitle, noHighlight) {
  if (!crTitle) return;
  var t = crTitle.match(CROSSREFTARGET);
  if (!t) return;
  // Needed when chapter was clicked from chapmenu popup
  closePopup();
  Bible.setBiblesReference(t[1], t[2]);
  MainWindow.updateFrameScriptBoxes(MainWindow.getUnpinnedVerseKeyWindows(), SCROLLTYPECENTER, (noHighlight ? HILIGHTNONE:HILIGHT_IFNOTV1));
  MainWindow.updateLocators(false); 
}

function scrollwheel(event) {MainWindow.scrollwheel(event, Win.number);}

function scroll2Note(id) {
//jsdump("scrolling to:" + id + "\n");
  //Return previous highlighted note to normal if it can be found
  var oldNoteElem = null;
  try {oldNoteElem = FrameDocumentHavingNoteBox.getElementById(prefs.getCharPref("SelectedNote"));} catch(e) {}
  if (oldNoteElem != null) {oldNoteElem.className = "normalNote";}
  //Now highlight the current note
  var theNote = FrameDocumentHavingNoteBox.getElementById(id);
  if (!theNote) return;
  theNote.className = "selectedNote";
  prefs.setCharPref("SelectedNote",id);
  //Now set up the counters such that the note remains highlighted for at least a second
  window.setTimeout("unhighlightNote()",1000);
  
  var activeNoteBoxElement = FrameDocumentHavingNoteBox.getElementById("noteBox");
  var note = FrameDocumentHavingNoteBox.getElementById(id);
  scroll2(FrameDocumentHavingNoteBox.getElementById("noteBox"), FrameDocumentHavingNoteBox.getElementById(id), "maintable.", true, 4);
}

function scroll2(outerElement, element2Scroll, offsetParentId, dontScrollIfVisible, margin) {
  //dump ("outerElement:" + outerElement.id + "\nelement2Scroll:" + element2Scroll.id + "\noffsetParentId:" + offsetParentId + "\ndontScrollIfVisible:" + dontScrollIfVisible + "\nmargin:" + margin + "\n");
  if (!element2Scroll || !element2Scroll.offsetParent) return;
  //jsdump("offsetParentId:" + offsetParentId + "\n");
  while (element2Scroll && element2Scroll.offsetParent && element2Scroll.offsetParent.id != offsetParentId) {element2Scroll = element2Scroll.parentNode;}
  
  var noteOffsetTop = element2Scroll.offsetTop;
  var boxScrollHeight = outerElement.scrollHeight;
  var boxOffsetHeight = outerElement.offsetHeight;
  
  //jsdump("id:" + element2Scroll.id + " outElemScrollTop: " + outerElement.scrollTop + " boxOffsetHeight:" + boxOffsetHeight + " boxScrollHeight:" + boxScrollHeight + " noteOffsetTop:" + noteOffsetTop + "\n");
  var scrollmargin=10;
  if (dontScrollIfVisible && noteOffsetTop > outerElement.scrollTop+scrollmargin && noteOffsetTop < outerElement.scrollTop+boxOffsetHeight-scrollmargin) return;
  
  // If note is near bottom then shift to note (which will be max shift)
  if (noteOffsetTop > (boxScrollHeight - boxOffsetHeight + margin)) {outerElement.scrollTop = noteOffsetTop;}
  // Otherwise shift to note and add a little margin above note
  else {outerElement.scrollTop = noteOffsetTop - margin;}
}

// Called after  short delay so that a note will be highlighted for at least a certain amount of time
function unhighlightNote() {
  if (HaveLeftTarget)  {try {FrameDocumentHavingNoteBox.getElementById(prefs.getCharPref("SelectedNote")).className = "normalNote";} catch(er){}}
  else {ImmediateUnhighlight=true;}
}

function expandCrossRefs(noteid) {
  // Find out whether we're expanding or closing
  var exp = FrameDocumentHavingNoteBox.getElementById("exp." + noteid);
  var exp2 = FrameDocumentHavingNoteBox.getElementById("exp2." + noteid);
  var exp3 = FrameDocumentHavingNoteBox.getElementById("exp3." + noteid);
  var expand;
  if (exp==null||exp2==null||exp3==null) {return false;}
  if (exp.src.search(/twisty-clsd/) != -1) {
    exp.src="chrome://xulsword/skin/images/twisty-open.png"; 
    exp2.style.visibility="visible"; 
    exp3.style.visibility="visible"; 
    expand = true;
  }
  else {
    exp.src="chrome://xulsword/skin/images/twisty-clsd.png"; 
    exp2.style.visibility="hidden"; 
    exp3.style.visibility="hidden"; 
    expand = false;
  }
  
  var html = "";
  var chapRefs = MyFootnotes.CrossRefs.split("<nx/>");
  for (var i=0; i<chapRefs.length; i++) {
    var part = chapRefs[i].split("<bg/>");
    // if we've found the note which matches the id under the mouse pointer
    if (part[0] == noteid) html = getCRNoteHTML(Win.modName, "nb", noteid, part[1], "<br>", expand, Win.number);
  }
  FrameDocumentHavingNoteBox.getElementById("body." + noteid).innerHTML = html;
  return true;
}

/************************************************************************
 * The Boundary Bar
 ***********************************************************************/  

function boundaryMouseMove(evt) {
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
  BoundaryBarShadowElement.style.left = String(BoundaryBarElement.offsetLeft + MarginLeftOfScriptBox) + "px";
  BoundaryBarShadowElement.style.width = String(BoundaryBarElement.offsetWidth) + "px";
  evt.preventDefault(); //So we don't select while we're dragging the boundary bar
  
  // If maximize is on, we must save maximized size and turn off maximize
  if (prefs.getBoolPref("MaximizeNoteBox" + String(Win.number))) {
    MainWindow.setNoteBoxSizer(Win.number, false);
    FootnoteWinH = EffectiveWinH - ScriptBoxMarginTop - BottomMargin - BoundaryBarGap;
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPENONE, HILIGHT_IFNOTV1);
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
  var gfn = ((prefs.getCharPref("Footnotes") == "On")&&(prefs.getBoolPref("ShowFootnotesAtBottom")));
  var gcr = ((prefs.getCharPref("Cross-references") == "On")&&(prefs.getBoolPref("ShowCrossrefsAtBottom")));
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
    expandCrossRefs(idpart.join("."));
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
      //OwnerDocument.getElementById("verse").value = v;
      var updateNeeded = MainWindow.getUnpinnedVerseKeyWindows();
      if (Pin.isPinned) {
        Bible.setBiblesReference(Win.modName, idpart[2] + "." + idpart[3] + "." + idpart[4]);
        MainWindow.updateFrameScriptBoxes(updateNeeded, SCROLLTYPECENTER, HILIGHT_IFNOTV1);
      }
      else {MainWindow.quickSelectVerse(Win.modName, null, Number(idpart[3]), v, Number(idpart[5]), HILIGHT_IFNOTV1, SCROLLTYPECENTER);}
      MainWindow.updateLocators(false);
      break;
     case DICTIONARY:
     case GENBOOK:
      scrollScriptBox(SCROLLTYPECENTER, "par." + v);
      break;
    } 
    break;
  case "nbsizer":
    MainWindow.setNoteBoxSizer(Win.number, !prefs.getBoolPref("MaximizeNoteBox" + Win.number));
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPECENTER, HILIGHT_IFNOTV1);
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
    MainWindow.UpdateTabs = window.setTimeout("{MainWindow.updatePinVisibility(); MainWindow.updateTabLabelsAndStyles(); MainWindow.updateFrameScriptBoxes([" + updatesNeeded + "]," + SCROLLTYPECENTER + "," + HILIGHT_IFNOTV1 + ");}",0);
    if (e.target.id) {
      var blur = null;
      if (e.target.id.substr(0,6)=="seltab") blur = "seltab.menu";
      else blur = e.target.id;
      window.setTimeout("document.getElementById('" + blur + "').blur();", 0);
    }    break;
  }
}

function setFontSize(className,sz) {
  for (var i=0; i<document.styleSheets[0].cssRules.length; i++) {
    var thisText = document.styleSheets[0].cssRules[i].cssText;
    if (thisText.match(/^(.*?) /)[1]  == className) {document.styleSheets[0].cssRules[i].style.fontSize = String(sz) + "px"}
  }
}

/************************************************************************
 * Sizing and placing Scripture, notes, and the boundary bar
 ***********************************************************************/  
function resizeBibles(dontChangeContents, hideNoteBox) {
  if (!dontChangeContents) ScriptBoxTextElement.innerHTML="";
  if ((window.frameElement.id=="bible1Frame")&&prefs.getBoolPref("ShowChooser")) {placeChooser();}
  if (Win.number <= prefs.getIntPref("NumDisplayedWindows")) {
    setBibleWidth();
    setBibleHeight(null, hideNoteBox);
  }
}

function setBibleWidth(initializing) {
  var winW, chooserWidth;
  winW = initializing ? prefs.getIntPref("WindowWidth"):OwnerDocument.width;
  //jsdump("Frame Width Pref:" + prefs.getIntPref("WindowWidth") + ", Measured:" + OwnerDocument.width + "\n");
  
  var effectiveWindowPaddingLeft;
  if (prefs.getBoolPref("ShowChooser") || prefs.getBoolPref("ShowGenBookChooser")) {
    var chooserInnerWidth = OwnerDocument.getElementById("bible1Frame").contentDocument.getElementById("chooserhole").offsetWidth;
    effectiveWindowPaddingLeft = chooserInnerWidth + ChooserLeftMargin + ChooserGap;
  }
  else effectiveWindowPaddingLeft = MarginLeftWhenNoChooser;

  DesiredFrameWidth = (winW - effectiveWindowPaddingLeft)/prefs.getIntPref("NumDisplayedWindows");
  var actualFrameWidth = DesiredFrameWidth;

  // Shrink tabs if neccessary, don't let window get narrower than shrunken tabs
/*  var myLocale = rootprefs.getCharPref("general.useragent.locale");
  LargeTabSize=true;
  if (myLocale=="ko") {
    setFontSize(".tabs",TABTEXTLG-1);  
  }
  else {
    setFontSize(".tabs",TABTEXTLG); 
  }
  if (DesiredFrameWidth - MarginRight - TabBarMargin < LanguageTabsElement.offsetWidth) {
    setFontSize(".tabs",TABTEXTSM);
    LargeTabSize=false;
    if (DesiredFrameWidth - MarginRight - TabBarMargin < LanguageTabsElement.offsetWidth) {
      actualFrameWidth = LanguageTabsElement.offsetWidth + MarginRight + TabBarMargin + 6;
    }
  }*/
  if (actualFrameWidth < MinScriptWidth) actualFrameWidth=MinScriptWidth;
  
  // Assign FrameWidth and MarginLeftOfScriptBox to this particular frame:
  if (Win.number == 1) {
    var genBookChooserElement = OwnerDocument.getElementById("genBookChooser");
    if (prefs.getBoolPref("ShowGenBookChooser")) {
      genBookChooserElement.style.width = effectiveWindowPaddingLeft + "px";
      FrameWidth = actualFrameWidth;
      MarginLeftOfScriptBox = 0;
    }
    else {
      FrameWidth = actualFrameWidth + effectiveWindowPaddingLeft;
      MarginLeftOfScriptBox = effectiveWindowPaddingLeft;
    }
  }
  else if (Win.number > prefs.getIntPref("NumDisplayedWindows")) 
      FrameWidth=0;
  else {
    FrameWidth = actualFrameWidth;
    MarginLeftOfScriptBox = 0;
  }

  ScriptWidth = FrameWidth - MarginRight;

  ScriptBoxElement.style.left  = String(MarginLeftOfScriptBox) + "px";
  ScriptBoxElement.style.right = String(MarginRight) + "px";
  ConnectorElement.style.width  = String(MarginRight)+ "px";
  Frame.style.minWidth = String(FrameWidth) + "px";
  
  NoteBoxSizerElement.style.right = "43px";
  Pin.elem.style.left = String(MarginLeftOfScriptBox + 3) + "px";
  LanguageTabsElement.style.marginLeft = String(MarginLeftOfScriptBox + 20) + "px"; //Effects only rtl locales!
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
  adjustFontSizes(0, prefs.getIntPref('FontSize'));
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

