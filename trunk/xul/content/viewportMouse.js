/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

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

/************************************************************************
 * TEXT TABS MOUSE FUNCTIONS
 ***********************************************************************/  
function tabMouse(e) {
  var elem = e.target;
  
  // get the tab id
  while(elem && (!elem.id || !(/^w\d\.tab\./).test(elem.id))) {elem = elem.parentNode;}
  if (!elem) return;
  
  var p = elem.id.split(".");
  var w = Number(p[0].substr(1));
  
  // handle wn.tab.tsel differently
  if (p[2] == "tsel") {
    e.preventDefault();
    var ts = document.getElementById("w" + w + ".tabselect");
    elem = ts.firstChild;
    while(!elem.selected) {elem = elem.nextSibling;}
    p = elem.id.split(".");
  }
  else if (p[2] == "orig") {
    if (e.type != "click") return;
    prefs.setBoolPref("ShowOriginal" + w, !prefs.getBoolPref("ShowOriginal" + w));
    Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
    return;
  }
  
  var t = Number(p[3]);
  
  switch (e.type) {
  case "mouseover":
    openTabToolTip(t, w, e.clientX, e.clientY);
    break;
  case "mouseout":
    closeTabToolTip();
    break;
  case "click":
    closeTabToolTip();
    if (prefs.getBoolPref("IsPinned" + w)) return;
    MainWindow.selectTab(w, Tabs[t].modName);
    MainWindow.updateNavigator();
    Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);    
    break;
  }
  
}

//Tabs are html and not XUL, but we want XUL tool tips to appear above them (for
//consistency). These routines allow that...
var ShowTabToolTip, HideTabToolTip;
function openTabToolTip(t, w, cX, cY) {
  var tt = MainWindow.document.getElementById("tabTT");
  if (!tt) return;
  
  tt.hidePopup();
  var modName = Tabs[t].modName;
  if (t == -1) modName = resolveOriginalVersion(Location.getBookName());
  if (!modName) return;
  
  var desc = Bible.getModuleInformation(modName, "Description");
  if (!desc || desc==NOTFOUND) return;
  desc = desc.substr(0, TOOLTIP_LEN);
  if (desc.length==TOOLTIP_LEN) desc += "...";
  
  tt.firstChild.setAttribute("class", "cs-" + modName);
  tt.firstChild.setAttribute("value", desc);
  
  if (ShowTabToolTip) window.clearTimeout(ShowTabToolTip);
  if (HideTabToolTip) window.clearTimeout(HideTabToolTip);
  
  cX += MainWindow.document.getElementById("xulviewport").boxObject.x;
  ShowTabToolTip = window.setTimeout("MainWindow.document.getElementById('tabTT').openPopup(MainWindow.document.getElementById('xulviewport'), 'after_pointer', " + cX + ", " + cY + ");", 500);
  HideTabToolTip = window.setTimeout("MainWindow.document.getElementById('tabTT').hidePopup();", 5000);
}

function closeTabToolTip() {
  window.clearTimeout(ShowTabToolTip);
  window.clearTimeout(HideTabToolTip);
  var tabtt = MainWindow.document.getElementById('tabTT');
  if (tabtt) tabtt.hidePopup();
}


/************************************************************************
 * TEXT SCRIPT BOX MOUSE FUNCTIONS
 ***********************************************************************/  
var HaveLeftTarget = false;
var ImmediateUnhilight = false;
var HighlightElement1 = null;
var HighlightElement2 = null;
var IgnoreMouseOvers = false; // Used to block mouseoverse while popup is switching
function scriptMouseOver(e) {
  if (IgnoreMouseOvers || Popup.ispinned || BoundaryClicked) return;
  if (MainWindow.document.getElementById("contextScriptBox") &&
      MainWindow.document.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}

  var w = getWindow(e.target);
  if (!w) return; // this also excludes Popup
  
  var x = Number(e.clientX);
  var y = Number(e.clientY);
  
  var elem = e.target;
  while (elem && !elem.className) {elem = elem.parentNode;}
  if (!elem) return;

//jsdump("type:" + elem.className.split(/\s+/)[0] + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (elem.className.split(/\s+/)[0]) {
  case "cr":
    if (prefs.getBoolPref("ShowCrossrefsAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhilight=false;
      BibleTexts.scroll2Note(w, "w" + w + ".ntr." + elem.id);
    }
    else if (!Popup.activate(x, y, w, "cr", elem.id)) {elem.style.cursor = "default";}
    break;
     
  case "fn":
    if (prefs.getBoolPref("ShowFootnotesAtBottom")) {
      HaveLeftTarget=false;
      ImmediateUnhilight=false;
      BibleTexts.scroll2Note(w, "w" + w + ".ntr." + elem.id);
    }
    else Popup.activate(x, y, w, "fn", elem.id);
    break;

  case "sr":
    if (Popup.npopup.style.display != "none") return;
//jsdump((elem.title=="unavailable" ? elem.innerHTML:elem.title) + "\n");
    if (!Popup.activate(x, y, w, "sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title)))
      elem.style.cursor = "default";
    break;
    
  case "dt":
    if (Popup.npopup.style.display != "none") return;
    Popup.activate(x, y, w, "dt", elem.title);
    break;
    
  case "dtl":
    if (Popup.npopup.style.display != "none") return;
    Popup.activate(x, y, w, "dtl", elem.title);
    break;
    
  case "sn":
    // See if interlinear display and if so process...
    var aVerse = elem;
    while (aVerse.parentNode && (!aVerse.parentNode.className || 
            aVerse.parentNode.className!="interB" && aVerse.parentNode.className!="hl")) {
      aVerse = aVerse.parentNode;
    }
    var isShowingOrig = (prefs.getBoolPref("ShowOriginal" + w) && aVerse.parentNode);
    if (prefs.getCharPref("Strong's Numbers")=="On")
        Popup.activate(x, y, w, "sn", elem.innerHTML.replace(/<.*?>/g, "") + "]-[" + elem.title, POPUPDELAY, (isShowingOrig ? aVerse.parentNode.offsetHeight+10:40));
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
      if (HighlightElement1) unhighlightStrongs(HighlightElement1, "matchingStrongs");
      if (HighlightElement2) unhighlightStrongs(HighlightElement2, "matchingStrongs");
      if (aVerse) {
        highlightStrongs(aVerse, elem.title.split("."), "matchingStrongs");
        HighlightElement1 = aVerse;
      }
      if (aVerse2) {
        highlightStrongs(aVerse2, elem.title.split("."), "matchingStrongs");
        HighlightElement2 = aVerse2;
      }
    }
    break;
            
  case "un":
    if (prefs.getBoolPref("ShowUserNotesAtBottom") && 
          (Tab[prefs.getCharPref("Version" + w)].modType == BIBLE || 
           Tab[prefs.getCharPref("Version" + w)].modType == COMMENTARY)) {
      HaveLeftTarget=false;
      ImmediateUnhilight=false;
      BibleTexts.scroll2Note(w, "w" + w + ".ntr." + elem.id);
    }
    else Popup.activate(x, y, w, "un", elem.id);
    break;
    
  case "introlink":
    Popup.activate(x, y, w, "introlink");
    break;

  case "noticelink":
    Popup.activate(x, y, w, "noticelink");
    break;
  }
}

function scriptMouseOut(e) {
  if (Popup.selectOpen || Popup.ispinned) {return;}
  if (MainWindow.document.getElementById("contextScriptBox") &&
      MainWindow.document.getElementById("contextScriptBox").getAttribute("value") == "open") {return;}
  
  if (Popup.showPopupID) {
    window.clearTimeout(Popup.showPopupID);
    IgnoreMouseOvers = false;
  }
  
  if (HighlightElement1) unhighlightStrongs(HighlightElement1, "matchingStrongs");
  if (HighlightElement2) unhighlightStrongs(HighlightElement2, "matchingStrongs");
  HighlightElement1=null;
  HighlightElement2=null;
  
  HaveLeftTarget=true;
  if (ImmediateUnhilight) {unhilightNote();}

  var currentlyOver = e.relatedTarget;
  while (currentlyOver) {
    if (currentlyOver.id && currentlyOver.id == "npopupTX") return;
    currentlyOver = currentlyOver.parentNode;
  }
  
  Popup.close();
}

function scriptClick(e) {
  var w = getWindow(e.target);
  if (w === null) return; // w=0 means popup!!

  // when an unpinned GenBook window is clicked, select its chapter in the navigator
  if (w && !prefs.getBoolPref("IsPinned" + w) && 
      Tab[prefs.getCharPref("Version" + w)].modType == GENBOOK) {
    var key = getPrefOrCreate("GenBookKey_" + prefs.getCharPref("Version" + w) + "_" + w, "Unicode", "/" + prefs.getCharPref("Version" + w));
    if (!GenBookTexts.isSelectedGenBook(key)) GenBookTexts.navigatorSelect(key);
  }
  
  var elem = e.target;
  while (elem && !elem.className) {elem=elem.parentNode;}
  if (!elem) return;
  
  var mod = (w ? prefs.getCharPref("Version" + w):Popup.mod);
  var x = elem.offsetLeft;
  var y = elem.offsetTop;
  
//jsdump("type:" + elem.className + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (elem.className) {
    case "cr":
    var ok = toggleRefText(document.getElementById("w" + w + ".exp." + elem.id));
    if (ok) BibleTexts.scroll2Note(x, y, w, "w" + w + ".ntr." + elem.id);
    break;

  case "sr":
    Popup.activate(x, y, w, "sr", (elem.title=="unavailable" ? elem.innerHTML:elem.title), 0, -40);
    break;
    
  case "dt":
  case "dtl":
    Popup.activate(x, y, w, "dt", elem.title, 0, -40);
    break;
    
  case "prevchaplink":
    switch (Tab[mod].modType) {
    case BIBLE:
    case COMMENTARY:
      if (!w) break;
      if ((/^show(2|3)$/).test(document.getElementById("text" + w).getAttribute("columns"))) 
          previousPage(w);
      else if (prefs.getBoolPref("IsPinned" + w))
          previousChapterPinned(w);
      else MainWindow.goDoCommand('cmd_xs_previousChapter');
      break;
    case DICTIONARY:
      var currentKey = getPrefOrCreate("DictKey_" + mod + "_" + w, "Unicode", "<none>");
      for (var k=0; k<DictTexts.keyList[w][mod].length; k++) {
        if (DictTexts.keyList[w][mod][k] == currentKey) break;
      }
      k--;
      if (DictTexts.keyList[w][mod][k]) {
        setUnicodePref("DictKey_" + mod + "_" + w, DictTexts.keyList[w][mod][k]);
        Texts.updateDictionary(w);
      }
      break;
    case GENBOOK:
      // first see if we can scroll the window
      var t = document.getElementById("text" + w);
      var sb = t.getElementsByClassName("sb")[0];
      if (sb.scrollLeft > 0) {
        var wwin = (t.clientWidth - 4); // 4 = 2 x border-width
        var twin = wwin*Math.floor(sb.scrollLeft/wwin);
        if (twin >= sb.scrollLeft) twin -= wwin;
        sb.scrollLeft = twin;
        if (sb.scrollLeft < 0) sb.scrollLeft = 0;
      }
      // if not, then load previous chapter
      else {
        var prevchap = GenBookTexts.previousChapter(prefs.getCharPref("GenBookKey_" + mod + "_" + w));
        if (!prevchap) return;
        
        if (prefs.getBoolPref("IsPinned" + w)) {
          prefs.setCharPref("GenBookKey_" + mod + "_" + w, prevchap);
          Texts.update();
        }
        else GenBookTexts.navigatorSelect(prevchap);
        // scroll to end if possible
        sb.scrollLeft = sb.scrollWidth;
        break;
      }
    }
    break;
    
  case "nextchaplink":
    switch (Tab[mod].modType) {
    case BIBLE:
    case COMMENTARY:
      if (!w) break;
      if ((/^show(2|3)$/).test(document.getElementById("text" + w).getAttribute("columns")))
          nextPage(w);
      else if (prefs.getBoolPref("IsPinned" + w)) 
          nextChapterPinned(w);
      else MainWindow.goDoCommand('cmd_xs_nextChapter');
      break;
    case DICTIONARY:
      var currentKey = getPrefOrCreate("DictKey_" + mod + "_" + w, "Unicode", "<none>");
      for (var k=0; k<DictTexts.keyList[w][mod].length; k++) {
        if (DictTexts.keyList[w][mod][k] == currentKey) break;
      }
      k++;
      if (DictTexts.keyList[w][mod][k]) {
        setUnicodePref("DictKey_" + mod + "_" + w, DictTexts.keyList[w][mod][k]);
        Texts.updateDictionary(w);
      }
      break;
    case GENBOOK:
      // first see if we can scroll the window
      var t = document.getElementById("text" + w);
      var sb = t.getElementsByClassName("sb")[0];
      var scrollmax = sb.scrollWidth-sb.clientWidth;
      var wwin = (t.clientWidth - 4); // 4 = 2 x border-width
      var next = wwin*Math.floor(sb.scrollLeft/wwin) + wwin;
      var prev = sb.scrollLeft;
      sb.scrollLeft = next;
      // if not, then load next chapter
      if (sb.scrollLeft == prev) {
        var nextchap = GenBookTexts.nextChapter(prefs.getCharPref("GenBookKey_" + mod + "_" + w));
        if (!nextchap) return;
        
        if (prefs.getBoolPref("IsPinned" + w)) {
          prefs.setCharPref("GenBookKey_" + mod + "_" + w, nextchap);
          Texts.update();
        }
        else GenBookTexts.navigatorSelect(nextchap);
      }
      break;
    }
    break;
    
  case "listenlink":
    MainWindow.Player.w = w;
    MainWindow.Player.version = mod;
    MainWindow.Player.chapter = Number(elem.id.split(".")[1]);
    MainWindow.Player.book = Texts.display[w].mod;
    MainWindow.beginAudioPlayer();
    break;
    
  case "sbpin":
    prefs.setBoolPref("IsPinned" + w, !prefs.getBoolPref("IsPinned" + w));
    Texts.update((prefs.getBoolPref("IsPinned" + w) ? SCROLLTYPENONE:SCROLLTYPECENTER), HILIGHTNONE);
    break;
    
  case "popupBackLink":
    Popup.activate(x, y, w, "html", document.getElementsByClassName("prevhtml")[0].innerHTML);
    break;
    
  case "popupCloseLink":
    if (Popup.ispinned) Popup.pinup(true);
    else Popup.close();
    break;
  }
}

//Various types of elements are identified in different ways: some by their id, 
//others by their title and others by their className. This function identifies the
//element type.
function getElemType(elem) {
  var id = null;
  
  // if id begins with window number, remove that
  if (elem.id) {
    if ((/^w\d\./).test(elem.id)) {id = elem.id.substr(3);}
    else id = elem.id;
  }
  
  var aType=null;
  if (id) {
    aType = id.match(/^([^\.]+)\./);
    if (aType) aType = aType[1];
    if (aType && (aType.substr(0,2)=="pu" || aType.substr(0,2)=="nb")) return aType;
  }
  if (!aType && id) aType = id; 
  aType = (elem.title ? elem.className.split("-")[0]:aType);
  return aType;
}

// Called after  short delay so that a note will be highlighted for at least a certain amount of time
function unhilightNote() {
  if (HaveLeftTarget)  {
    try {document.getElementById(prefs.getCharPref("SelectedNote")).className = "normalNote";} catch(er){}
  }
  else {ImmediateUnhilight = true;}
}

function highlightStrongs(elem, strongsArray, aClass) {
  for (var i=0; i<strongsArray.length; i++) {
    if (strongsArray[i].split(":")[0] != "S") continue;
    var aStrongs = new RegExp(strongsArray[i] + "(\\D|$)", "i");
    if (elem.title && elem.title.search(aStrongs) != -1 && (!elem.className || elem.className.search(aClass)==-1)) 
        elem.className = elem.className + " " + aClass;
  }
  elem = elem.firstChild;
  while (elem) {
    highlightStrongs(elem, strongsArray, aClass);
    elem = elem.nextSibling;
  }
}

function unhighlightStrongs(elem, aClass) {
  if (elem.className) elem.className = elem.className.replace(" " + aClass, "");
  elem = elem.firstChild;
  while (elem) {
    unhighlightStrongs(elem, aClass);
    elem = elem.nextSibling;
  }
}

/************************************************************************
 * TEXT DOUBLE CLICK
 ***********************************************************************/  
function scriptDblClick(e) {
  var w = getWindow(e.target);
  if (w === null) return;
  
  var selob = window.getSelection();
  var sel = selob.toString();
  
  sel = cleanDoubleClickSelection(sel);
  
  var myv = null;
  var targ = e.target.parentNode;
  while (targ) {
    if (targ.className) {
      if      (Tab.ORIG_NT && targ.className.search("cs-" + Tab.ORIG_NT.modName) != -1) {
        myv = Tab.ORIG_NT.modName;
        break;
      }
      else if (Tab.ORIG_OT && targ.className.search("cs-" + Tab.ORIG_OT.modName) != -1) {
        myv = Tab.ORIG_OT.modName;
        break;
      }
    }
    targ = targ.parentNode;
  }
  if (!myv) myv = prefs.getCharPref("Version" + w);

  if (!sel || sel.search(/^\s*$/)!=-1) return; //return of nothing or white-space
  
  setUnicodePref("SearchText", sel);
  prefs.setCharPref("SearchVersion", myv);
  MainWindow.document.getElementById("cmd_xs_search").doCommand();
}

/************************************************************************
 * MOVABLE BOUNDARY BAR
 ***********************************************************************/  
var MouseIsOver = false;
var BoundaryClicked = null;
var StartMouseY;

function bbMouseDown(e) {

  BoundaryClicked = e.target;
  StartMouseY = e.clientY;
  
  e.preventDefault(); //So we don't select while we're dragging the boundary bar
  
  var w = BoundaryClicked;
  while (w && (!w.id || !(/^text\d+$/).test(w.id))) {w = w.parentNode;}
  w = Number(w.id.substr(4));
  
  BoundaryClicked.setAttribute("moving", "true");
  
  // If maximize is on, turn it off
  if (prefs.getBoolPref("MaximizeNoteBox" + w)) {
    var rule = getCSS(".sb {");
    prefs.setIntPref("NoteBoxHeight" + w, rule.style.height.match(/([\-\d]+)px/)[1]);
    prefs.setBoolPref("MaximizeNoteBox" + w, false);
    ViewPort.update(false);
  }
  
}

function bbMouseMove(e) {
  MouseIsOver = e.target;
  
  if (BoundaryClicked) {
    var w = BoundaryClicked;
    while (w && (!w.id || !(/^text\d+$/).test(w.id))) {w = w.parentNode;}
    w = Number(w.id.substr(4));
    
    var top = (e.clientY - StartMouseY);
    var text = document.getElementById("text" + w);
   
    if (top < 70 - text.getElementsByClassName("sb")[0].offsetHeight || 
        top > text.getElementsByClassName("nb")[0].offsetHeight - 40) {
      bbMouseUp(e);
    }
    else  BoundaryClicked.style.top = top + "px";
  }
  
}

function bbMouseUp(e) {
  
  if (BoundaryClicked) {
    var w = BoundaryClicked;
    while (w && (!w.id || !(/^text\d+$/).test(w.id))) {w = w.parentNode;}
    w = Number(w.id.substr(4));
    
    BoundaryClicked.setAttribute("moving", "false");
    
    var top = BoundaryClicked.style.top.match(/([\-\d]+)px/);
    if (top) top = Number(top[1]);
    else top = 0;
    
    BoundaryClicked.style.top = "";
    prefs.setIntPref("NoteBoxHeight" + w, prefs.getIntPref("NoteBoxHeight" + w) - top);
    ViewPort.update();
    
    BoundaryClicked = null;
  }
  
}


/************************************************************************
 * FOOTNOTE BOX MOUSE FUNCTIONS
 ***********************************************************************/  
function noteboxClick(e) {
  
  // find relavent target id
  var id = null;
  var idpart = null;
  var elem = e.target;
  if (elem.className && (/^nbsizer$/).test(elem.className)) {
    id = "nbsizer";
  }
  else {
    while (!elem.id) {elem = elem.parentNode;}
  }
  if (!elem) return;
  
  if (!id) {
    id = elem.id
    idpart = elem.id.split(".");
    idpart.shift(); // drop w
    id = idpart.shift(); // get relevant id
  }

  var w = getWindow(e.target);
  if (!w) return; // this also excludes Popup
  
  var mod = prefs.getCharPref("Version" + w);
  
  switch (id) {
  case "exp":
    toggleRefText(elem);
    break;
    
  case "nbl": //Cross reference link
    goToCrossReference(elem.title, false);
    break;

  case "notl": //Note reference link
    var v = Number(idpart[4]);
    switch (Tab[mod].modType) {
    case BIBLE:
    case COMMENTARY:
      Location.setLocation(mod, idpart[2] + "." + idpart[3] + "." + idpart[4]);
      Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
      break;
     case DICTIONARY:
     case GENBOOK:
      scrollScriptBox(w, SCROLLTYPECENTER, "par." + v);
      break;
    } 
    break;
    
  case "nbsizer":
    prefs.setBoolPref("MaximizeNoteBox" + w, !prefs.getBoolPref("MaximizeNoteBox" + w));
    ViewPort.update(false);
    break;
  }
}

// Reads verse references including from-to type, it sets first verse as selected verse and any following verses are also highlighted
function goToCrossReference(crTitle, noHighlight) {
  if (!crTitle) return;
  var t = crTitle.match(CROSSREFTARGET);
  if (!t) return;
  // Needed when chapter was clicked from chapmenu popup
  if (Popup && typeof(Popup )!= "undefined") Popup.close();
  Location.setLocation(t[1], t[2]);
  Texts.update(SCROLLTYPECENTER, (noHighlight ? HILIGHTNONE:HILIGHT_IFNOTV1)); 
}

function toggleRefText(elem) {
  while(elem && (!elem.className || !(/(^|\s+)(cropened|crclosed)(\s+|$)/).test(elem.className))) {
    elem = elem.parentNode;
  }
  if (!elem || !elem.className) return;
  
  if ((/cropened/).test(elem.className)) elem.className = elem.className.replace(/cropened/, "crclosed");
  else elem.className = elem.className.replace(/crclosed/, "cropened");
}


/************************************************************************
 * Scroll Wheel functions...
 ***********************************************************************/

var MouseWheel = {
  SWcount:0,
  SWwin:null,
  SWTO:null,

  // scroll wheel does synchronized scrolling of all visible versekey windows
  scroll: function(event) {
    
    // find window in which event occurred
    var w = event.target;
    while (w && (!w.id || !(/^text\d+$/).test(w.id))) {w = w.parentNode;}
    if (!w) return;
    MouseWheel.SWwin = Number(w.id.replace("text", ""));

    // dictionaries don't do flow columns and don't sync to other windows
    // so no special scrollwheel response is needed
    if (Tab[prefs.getCharPref("Version" + MouseWheel.SWwin)].modType == DICTIONARY) return;
        
    var vd = Math.round(event.detail/3);
    MouseWheel.SWcount = (MouseWheel.SWcount + vd);

    if (MouseWheel.SWTO) window.clearTimeout(MouseWheel.SWTO);
    MouseWheel.SWTO = window.setTimeout("MouseWheel.scroll2();", 250);
  },

  scroll2: function() {

    // get number of verses by which to scroll
    var dv = 2*MouseWheel.SWcount-(Math.abs(MouseWheel.SWcount)/MouseWheel.SWcount);
    MouseWheel.SWcount = 0;
    if (!dv) return;
    
    var t = document.getElementById("text" + MouseWheel.SWwin);
    var sb = t.getElementsByClassName("sb")[0];
    var v;
    var scrollType;
    
    // GenBook scrolls differently that versekey modules
    if (Tab[prefs.getCharPref("Version" + MouseWheel.SWwin)].modType == GENBOOK) {
      scrollType = SCROLLTYPEDELTA;
      Texts.scrollDelta = dv*20; // scroll delta in pixels
    }
  
    // else scroll versekey modules
    else {
      scrollType = SCROLLTYPEBEG;
      
      // get first verse which begins in window
      v = sb.firstChild;
      if (t.getAttribute("columns") == "show1") {
        while (v && (!v.id || !(/^vs\./).test(v.id) || (v.offsetTop - sb.offsetTop < sb.scrollTop))) {v = v.nextSibling;}
      }
      else {
        while (v && (!v.id || !(/^vs\./).test(v.id) || v.style.display == "none")) {v = v.nextSibling;}
      }
      if (!v) return;
     
      // if this is a multi-column versekey window, shift the verse according to scroll wheel delta
      if (t.getAttribute("columns") != "show1") {
        var nv = v;
        while (dv > 0) {
          if (nv) nv = nv.nextSibling;
          while (nv && (!nv.id || !(/^vs\./).test(nv.id))) {nv = nv.nextSibling;}
          dv--;
          if (nv && nv.id && (/^vs\./).test(nv.id)) v = nv;
        }
        while (dv < 0) {
          if (nv) nv = nv.previousSibling;
          while (nv && (!nv.id || !(/^vs\./).test(nv.id))) {
            nv = nv.previousSibling;
          }
          dv++;
          if (nv && nv.id && (/^vs\./).test(nv.id)) v = nv;
        }
      }
     
      var v = v.id.split(".");
      v.shift();
      v = v.join(".");
      
      Location.setLocation(prefs.getCharPref("Version" + MouseWheel.SWwin), v);
    }
      
    // decide which windows to scroll and which to leave alone
    var force = [null];
    for (var w=1; w<=NW; w++) {
      var s = 0;
      if (w == MouseWheel.SWwin && t.getAttribute("columns") == "show1") {
        s = -1; // no need to scroll since UI will handle it
      }
      force.push(s);
    }

    Texts.update(scrollType, HILIGHTSAME, force);
  }

}


/************************************************************************
 * Navigation click functions...
 ***********************************************************************/ 
 
function previousChapterPinned(w) {
  try {if (!prefs.getBoolPref("IsPinned" + w)) return;}
  catch(er) {return;}
  
  var vers = prefs.getCharPref("Version" + w);
  var bkn = findBookNum(Texts.display[w].bk);
  var chn = Texts.display[w].ch;
  
  if (chn > 1) {chn--;}
  else return;
  
  Texts.pinnedDisplay[w].ch = chn;
  Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
}

// window w may be pinned or unpinned
function previousPage(w) {
  if (!w) return;
  
  // get first verse
  var t = document.getElementById("text" + w);
  if (!(/^show(2|3)$/).test(t.getAttribute("columns"))) return;
  var sb = t.getElementsByClassName("sb")[0];
  var v = sb.firstChild;
  while (v && (v.style.display == "none" || !v.id || !(/^vs\./).test(v.id))) {
    v = v.nextSibling;
  }
  if (!v) return;
  
  var vf = v.id.split(".");
  vf.shift();
  
  if (prefs.getBoolPref("IsPinned" + w)) {
    Texts.pinnedDisplay[w].bk = vf[0];
    Texts.pinnedDisplay[w].ch = vf[1];
    Texts.pinnedDisplay[w].vs = vf[2];
    Texts.update(SCROLLTYPEEND, HILIGHTNONE);
  }
  else {
    Location.setLocation(prefs.getCharPref("Version" + w), vf.join("."));
    Texts.update(SCROLLTYPEENDSELECT, HILIGHTNONE);
  }

}

function nextChapterPinned(w) {
  try {if (!prefs.getBoolPref("IsPinned" + w)) return;}
  catch(er) {return;}
  
  var vers = Texts.display[w].mod;
  var bkn = findBookNum(Texts.display[w].bk);
  var chn = Texts.display[w].ch;
  
  if (chn < Book[bkn].numChaps) {chn++;}
  else return;
  
  Texts.pinnedDisplay[w].ch = chn;
  Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
}

// window w may be pinned or unpinned
function nextPage(w) {
  if (!w) return;
  
  // get last verse
  var vl = null;
  var t = document.getElementById("text" + w);
  if (!(/^show(2|3)$/).test(t.getAttribute("columns"))) return;
  var sb = t.getElementsByClassName("sb")[0];
  var nb = document.getElementById("note" + w);
  var v = sb.lastChild;
  while (v && (
         !v.id || !(/^vs\./).test(v.id) || 
         v.offsetLeft >= sb.offsetWidth || 
         (v.offsetLeft > sb.offsetWidth-(1.5*nb.offsetWidth) && v.offsetTop+v.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight))
         ) {
    v = v.previousSibling;
  }
  if (!v) return;

  vl = v.id.split(".");
  vl.shift();

  if (prefs.getBoolPref("IsPinned" + w)) {
    Texts.pinnedDisplay[wpin].bk = vl[0];
    Texts.pinnedDisplay[wpin].ch = vl[1];
    Texts.pinnedDisplay[wpin].vs = vl[2];
  }
  else {Location.setLocation(prefs.getCharPref("Version" + w), vl.join("."));}
    
  Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
}

