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
function scriptMouseOver(e) {
  
  // Bail if another mouse operation is already happening...
  var mainContextMenu = MainWindow.document.getElementById("contextScriptBox");
  if (BoundaryClicked || 
      (mainContextMenu && mainContextMenu.getAttribute("value") == "open")
      ) return;

  // Get the text window of this event
  var w = getWindow(e.target);
  if (!w) return; // this also excludes Popup which is w==0
  
  // Filter out events without mousover functionality
  var handledClasses = /(^|\s)(cr|fn|sr|dt|dtl|sn|un|introlink|noticelink)(\-|\s|$)/;
  var elem = e.target;
  while (elem && (!elem.className || !handledClasses.test(elem.className))) {
    elem = elem.parentNode;
  }
  if (!elem) return;
  
  var type = elem.className.match(handledClasses)[2];

//jsdump("type:" + type + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (type) {
  case "cr":
    if (prefs.getBoolPref("ShowCrossrefsAtBottom")) {
      BibleTexts.scroll2Note(w, "w" + w + ".footnote." + elem.id);
    }
    else if (!Popup.activate(type, elem)) elem.style.cursor = "default";
    break;
     
  case "fn":
    if (prefs.getBoolPref("ShowFootnotesAtBottom")) {
      BibleTexts.scroll2Note(w, "w" + w + ".footnote." + elem.id);
    }
    else if (!Popup.activate(type, elem)) elem.style.cursor = "default";
    break;
    
  case "un":
    var modType = Tab[prefs.getCharPref("Version" + w)].modType;
    if (prefs.getBoolPref("ShowUserNotesAtBottom") && 
          (modType == BIBLE || modType == COMMENTARY)) {
      BibleTexts.scroll2Note(w, "w" + w + ".footnote." + elem.id);
    }
    else if (!Popup.activate(type, elem)) elem.style.cursor = "default";
    break;

  case "sr":
  case "dt":
  case "dtl":
  case "introlink":
  case "noticelink":
    if (!Popup.activate(type, elem)) elem.style.cursor = "default";
    break;
    
  case "sn":
    if (!Popup.activate(type, elem)) elem.style.cursor = "default";
    
    if (!prefs.getBoolPref("ShowOriginal" + w)) return;
    
    // Add elem's strong's classes to stylesheet for highlighting
    var classes = elem.className.split(/\s*/);
    classes.shift(); // remove sn base class
    
    for (var i=0; i<classes.length(); i++) {
      var sheet = document.styleSheets[document.styleSheets.length-1];
      if (!sheet) return;
      var sheetLength = sheet.cssRules.length;
      sheet.insertRule(MatchingStrongs.rule.cssText.replace("matchingStrongs", classes[i]), sheetLength);
      AddedRules.push( { sheet:sheet, index:sheetLength } );
    }
    break;
}


var MatchingStrongs = getCSS(".matchingStrongs {"); // Read from CSS stylesheet
function scriptMouseOut(e) {
  
  if (Popup.showPopupID) window.clearTimeout(Popup.showPopupID);
  
  if (!prefs.getBoolPref("ShowOriginal" + w)) return;
  
  // Remove any CSS stylesheet Strong's classes
  removeAddedRules();

}

var AddedRules = [];
function removeAddedRules() {
  
  for (var i = (AddedRules.length-1); i>=0; i--) {
    document.styleSheets[AddedRules[i].sheet].deleteRule(AddedRules[i].index);
  }
  
  AddedRules = [];
  
}

function scriptClick(e) {
  
  // Get the text window of this event
  var w = getWindow(e.target);
  if (w === null) return; // w=0 means popup!!
  var mod = prefs.getCharPref("Version" + (w == 0 ? getWindow(Popup.elem):w));
  
  // when an unpinned GenBook window is clicked, select its chapter in the navigator
  if (w && !prefs.getBoolPref("IsPinned" + w) && 
      Tab[prefs.getCharPref("Version" + w)].modType == GENBOOK) {
    var key = getPrefOrCreate("GenBookKey_" + prefs.getCharPref("Version" + w) + "_" + w, "Unicode", "/" + prefs.getCharPref("Version" + w));
    if (!GenBookTexts.isSelectedGenBook(key)) GenBookTexts.navigatorSelect(key);
  }
  
  // Filter out events without click functionality
  var handledClasses = /(^|\s)(sr|dt|dtl|cr|sbpin|crtwisty|fnlink|nbsizer|crref|listenlink|prevchaplink|nextchaplink|popupBackLink|popupCloseLink)(\-|\s|$)/;
  var elem = e.target;
  while (elem && (!elem.className || !handledClasses.test(elem.className))) {
    elem = elem.parentNode;
  }
  if (!elem) return;
  
  var type = elem.className.match(handledClasses)[2];
  
//jsdump("type:" + type + " id:" + elem.id + " title:" + elem.title + " class:" + elem.className + "\n");
  switch (type) {
    
  // Text box clicks
  case "sr":
  case "dt":
  case "dtl":
  case "popupBackLink":
    Popup.activate(type, elem);
    break;
    
  case "popupCloseLink":
    if (Popup.isPopupPinned) Popup.pinup();
    Popup.close();
    break;
    
  case "cr":
    var ok = toggleRefText(document.getElementById("w" + w + ".footnote." + elem.id));
    if (ok) BibleTexts.scroll2Note(w, "w" + w + ".footnote." + elem.id);
    break;
    
  case "listenlink":
    MainWindow.Player.w = w;
    MainWindow.Player.version = Texts.display[w].mod;
    MainWindow.Player.chapter = Texts.display[w].ch;
    MainWindow.Player.book = Texts.display[w].bk;
    MainWindow.beginAudioPlayer();
    break;
    
  case "sbpin":
    prefs.setBoolPref("IsPinned" + w, !prefs.getBoolPref("IsPinned" + w));
    Texts.update((prefs.getBoolPref("IsPinned" + w) ? SCROLLTYPENONE:SCROLLTYPECENTER), HILIGHTNONE);
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
    

  // Note box and Popup clicks
  case "crtwisty":
    toggleRefText(elem);
    break;

  case "fnlink": //Note reference link
    switch (Tab[t[0]].modType) {
    case BIBLE:
    case COMMENTARY:
      Location.setLocation(t.shift(), t.join("."));
      Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
      break;
     case DICTIONARY:
     case GENBOOK:
      scrollScriptBox(w, SCROLLTYPECENTER, "par." + t[2]);
      break;
    } 
    break;
    
  case "nbsizer":
    prefs.setBoolPref("MaximizeNoteBox" + w, !prefs.getBoolPref("MaximizeNoteBox" + w));
    ViewPort.update(false);
    break;
    
  case "crref":
    if (t && t.length >= 2 ) {
      Location.setLocation(t.shift(), t.join("."));
      Texts.update();
    }
    break;
    
  }
  
}

// Will search parents for cr(opened|closed) class and toggle it if found
function toggleRefText(elem) {
  while(elem && (!elem.className || !(/(^|\s+)(cropened|crclosed)(\s+|$)/).test(elem.className))) {
    elem = elem.parentNode;
  }
  if (!elem || !elem.className) return;
  
  if ((/cropened/).test(elem.className)) elem.className = elem.className.replace(/cropened/, "crclosed");
  else elem.className = elem.className.replace(/crclosed/, "cropened");
}



/************************************************************************
 * TEXT DOUBLE CLICK
 ***********************************************************************/  
function scriptDblClick(e) {
  var w = getWindow(e.target);
  if (w === null) return; // w=0 means popup!!
  var mod = prefs.getCharPref("Version" + (w == 0 ? getWindow(Popup.elem):w));
  
  var selob = window.getSelection();
  var sel = selob.toString();
  
  sel = cleanDoubleClickSelection(sel);
  if (!sel || sel.search(/^\s*$/)!=-1) return; //return of nothing or white-space
  
  // If this is interlinear, we need to see which version was clicked.
  if (w && prefs.getBoolPref("ShowOriginal" + w)) {
    var targ = e.target.parentNode;
    while (targ) {
      if (targ.className) {
        if (Tab.ORIG_NT && targ.className.search("cs-" + Tab.ORIG_NT.modName) != -1) {
          mod = Tab.ORIG_NT.modName;
          break;
        }
        else if (Tab.ORIG_OT && targ.className.search("cs-" + Tab.ORIG_OT.modName) != -1) {
          mod = Tab.ORIG_OT.modName;
          break;
        }
      }
      
      targ = targ.parentNode;
    }
  }

  setUnicodePref("SearchText", sel);
  prefs.setCharPref("SearchVersion", mod);
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
    prefs.setIntPref("NoteBoxHeight" + w, rule.rule.style.height.match(/([\-\d]+)px/)[1]);
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
  
  if (chn < Bible.getMaxChapter("KJV", Texts.display[w].bk)) {chn++;}
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

