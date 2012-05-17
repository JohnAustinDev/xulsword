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

// ScriptBox mouse events

var HaveLeftTarget = false;
var ImmediateUnhighlight = false;
var HighlightElement1 = null;
var HighlightElement2 = null;
var IgnoreMouseOvers = false; // Used to block mouseoverse while popup is switching
function scriptMouseOver(e) {
  if (IgnoreMouseOvers || Popup.ispinned) return;
  if (OwnerDocument.getElementById("contextScriptBox") &&
      OwnerDocument.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}
  if (typeof(BoundaryClicked)!="undefined" && BoundaryClicked) return;

  //If target has no id, find first parent that does
  ClientX = Number(e.clientX);
  ClientY = Number(e.clientY);
  
  var elem = e.target;
  while (elem && elem.id=="" && elem.title=="") {elem=elem.parentNode;}
  if (!elem) return;

  var edata = getElemType(elem);
//jsdump("edata:" + edata + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (edata) {
  case "cr":
    if (prefs.getBoolPref("ShowCrossrefsAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhighlight=false;
      scroll2Note("ntr." + elem.id);
    }
    else if (!Popup.activate(edata, elem.id)) {elem.style.cursor = "default";}
    break;
     
  case "fn":
    if (prefs.getBoolPref("ShowFootnotesAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhighlight=false;
      scroll2Note("ntr." + elem.id);
    }
    else Popup.activate("fn", elem.id);
    break;

  case "sr":
    if (Popup.npopup.style.display != "none") return;
//jsdump((elem.title=="unavailable" ? elem.innerHTML:elem.title) + "\n");
    if (!Popup.activate("sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title)))
      elem.style.cursor = "default";
    break;
    
  case "dt":
    if (Popup.npopup.style.display != "none") return;
    Popup.activate("dt", elem.title);
    break;
    
  case "dtl":
    if (Popup.npopup.style.display != "none") return;
    Popup.activate("dtl", elem.title);
    break;
    
  case "sn":
    // See if interlinear display and if so process...
    var aVerse = elem;
    while (aVerse.parentNode && (!aVerse.parentNode.className || aVerse.parentNode.className!="interB" && aVerse.parentNode.className!="hl")) {aVerse = aVerse.parentNode;}
    var isShowingOrig = (prefs.getBoolPref("ShowOriginal" + Win.number) && aVerse.parentNode);
    if (prefs.getCharPref("Strong's Numbers")=="On")
        Popup.activate("sn", elem.innerHTML.replace(/<.*?>/g, "") + "]-[" + elem.title, POPUPDELAY, (isShowingOrig ? aVerse.parentNode.offsetHeight+10:40));
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
    else Popup.activate("un", elem.id);
    break;
    
  case "introlink":
    if (getPrefOrCreate("ShowIntrosBeforeText", "Bool", false)) return;
    Popup.activate("introlink", elem.title);
    break;

  case "noticelink":
    Popup.activate("noticelink", elem.title);
    break;
  }
}

function scriptClick(e) {
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
    var ok = expandCrossRefs(elem.id, MyFootnotes, Win, FrameDocumentHavingNoteBox);
    if (ok) scroll2Note("ntr." + elem.id);
    break;
    
  case "pul":
    goToCrossReference(elem.title, false);
    break;

  case "sr":
    Popup.activate("sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title), 0, -40);
    break;
    
  case "dt":
  case "dtl":
    Popup.activate("dt", elem.title, 0, -40);
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
    MainWindow.updateFrameScriptBoxes(MainWindow.getUpdatesNeededArray(Win.number), SCROLLTYPETOP, HILIGHTNONE, showIntro, NOUPDATELOCATOR);
    break;
    
  case "listenlink":
    MainWindow.Player.isPinned = Pin.isPinned;
    MainWindow.Player.version = Win.modName;
    MainWindow.Player.chapter = Number(elem.id.split(".")[1]);
    if (Pin.isPinned) MainWindow.Player.book = Pin.display.shortName;
    else MainWindow.Player.book = Location.getBookName();

    MainWindow.beginAudioPlayer();
    break;
    
  case "pin":
    if (Pin.isPinned) unpinScript();
    else pinScript();
    break;
    
  case "popupBackLink":
    Popup.activate("html", document.getElementsByClassName("prevhtml")[0].innerHTML);
    break;
    
  case "popupCloseLink":
    if (Popup.ispinned) Popup.pinup(true);
    else Popup.close();
    break;
  }
}

function scriptDblClick(e) {
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

function scriptMouseOut(e) {
  if (OwnerDocument.getElementById("contextScriptBox") &&
      OwnerDocument.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}
  if (Popup.selectOpen || Popup.ispinned) {return;}
  if (Popup.showPopupID) {
    window.clearTimeout(Popup.showPopupID);
    IgnoreMouseOvers = false;
  }
  if (HighlightElement1) MainWindow.unhighlightStrongs(HighlightElement1, "matchingStrongs");
  if (HighlightElement2) MainWindow.unhighlightStrongs(HighlightElement2, "matchingStrongs");
  HighlightElement1=null;
  HighlightElement2=null;
  HaveLeftTarget=true;
  if (ImmediateUnhighlight) {unhighlightNote();}

  var currentlyOver = e.relatedTarget;
  while (currentlyOver) {
    if (currentlyOver.id && currentlyOver.id == "npopupTX") return;
    currentlyOver = currentlyOver.parentNode;
  }
  Popup.close();
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

// Called after  short delay so that a note will be highlighted for at least a certain amount of time
function unhighlightNote() {
  if (HaveLeftTarget)  {try {FrameDocumentHavingNoteBox.getElementById(prefs.getCharPref("SelectedNote")).className = "normalNote";} catch(er){}}
  else {ImmediateUnhighlight=true;}
}
