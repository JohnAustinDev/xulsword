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
    if (e.type != "click" || ViewPort.IsPinned[w] || Tab[ViewPort.Module[w]].modType != BIBLE) return;
    ViewPort.ShowOriginal[w] = !ViewPort.ShowOriginal[w];
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
    if (ViewPort.IsPinned[w]) return;
    ViewPort.selectTab(w, Tabs[t].modName);
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
  if (!modName) return;
  
  var desc = Tabs[t].description;
  if (!desc) return;
  
  desc = desc.substr(0, TOOLTIP_LEN);
  if (desc.length==TOOLTIP_LEN) desc += "...";
  
  tt.firstChild.setAttribute("class", "cs-" + Tab[modName].locName);
  tt.firstChild.setAttribute("value", desc);
  
  if (ShowTabToolTip) window.clearTimeout(ShowTabToolTip);
  if (HideTabToolTip) window.clearTimeout(HideTabToolTip);
  
  cX += MainWindow.document.getElementById("main-viewport").boxObject.x;
  ShowTabToolTip = window.setTimeout("MainWindow.document.getElementById('tabTT').openPopup(MainWindow.document.getElementById('main-viewport'), 'after_pointer', " + cX + ", " + cY + ");", 500);
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
var scriptMouseOverClasses = /^(cr|fn|sr|dt|dtl|sn|un|introlink|noticelink)(\-|\s|$)/;
function scriptMouseOver(e) {
  
  // Bail if another mouse operation is already happening...
  var mainContextMenu = MainWindow.document.getElementById("contextScriptBox");
  if (BoundaryClicked || 
      (mainContextMenu && mainContextMenu.getAttribute("value") == "open")
      ) return;
      
  // Filter out events without mousover functionality, but move up the
  // DOM tree to catch mousovers inside interesting elements.
  var elem = e.target;
  var type;
  while(elem) {
    if (elem.id && (/^(npopup|text\d)$/).test(elem.id)) break; // don't go higher than certain containers
    if (elem.className) {
      type = elem.className.match(scriptMouseOverClasses);
      if (type) break;
    }
    elem = elem.parentNode;
  }
  if (!elem || !type) return;
  type = type[1];

  // Get the text window of this event
  var w = getContextWindow(elem);
  if (!w) return; // this also excludes Popup which is w==0

  var p = getElementInfo(elem);
  
//jsdump("type:" + type + " title:" + elem.title + " class:" + elem.className + "\n");
  var okay = false;
  switch (type) {
  case "cr":
    if (p && prefs.getBoolPref("ShowCrossrefsAtBottom")) {
      okay = BibleTexts.scroll2Note("w" + w + ".footnote." + p.type + "." + p.nid + "." + p.osisref + "." + p.mod);
    }
    else okay = Popup.activate(elem, e);
    break;
     
  case "fn":
    if (w && Tab[ViewPort.Module[w]].modType == GENBOOK) okay = null; // genbk fn are embedded in text
    else if (p && prefs.getBoolPref("ShowFootnotesAtBottom")) {
      okay = BibleTexts.scroll2Note("w" + w + ".footnote." + p.type + "." + p.nid + "." + p.osisref + "." + p.mod);
    }
    else okay = Popup.activate(elem, e);
    break;
    
  case "un":
    var modType = Tab[ViewPort.Module[w]].modType;
    if (p && prefs.getBoolPref("ShowUserNotesAtBottom") && 
          (modType == BIBLE || modType == COMMENTARY)) {
      okay = BibleTexts.scroll2Note("w" + w + ".footnote." + p.type + "." + p.nid + "." + p.osisref + "." + p.mod);
    }
    else okay = Popup.activate(elem, e);
    break;

  case "sr":
  case "dt":
  case "dtl":
  case "introlink":
  case "noticelink":
    okay = Popup.activate(elem, e);
    break;
    
  case "sn":
    if (prefs.getCharPref("Strong's Numbers") == "On") {
      okay = Popup.activate(elem, e);
    }
   
    // Add elem's strong's classes to stylesheet for highlighting
    var classes = elem.className.split(" ");
    classes.shift(); // remove sn base class
    
    for (var i=0; i<classes.length; i++) {
      if (!(/^S_\w*\d+$/).test(classes[i])) continue;
      var sheet = document.styleSheets[document.styleSheets.length-1];
      var index = sheet.cssRules.length;
      sheet.insertRule(MatchingStrongs.rule.cssText.replace("matchingStrongs", classes[i]), index);
      AddedRules.push( { sheet:sheet, index:index } );
    }
    break;
  }
  if (!okay) {
    // report the problem for debugging
    if (okay === false) {var t = "w=" + (w !== null ? w:"null") + "\nclass=" + elem.className; for (var m in p) {t += "\n" + m + "=" + (p[m] ? p[m]:"null");} jsdump(t);}
    elem.style.cursor = (okay === false ? "help":"default");
  }
  
  e.stopPropagation(); // block any higher handlers
}

var MatchingStrongs = getCSS(".matchingStrongs {"); // Read from CSS stylesheet
var AddedRules = [];
function scriptMouseOut(e) {
 
  if (Popup && Popup.showPopupID) window.clearTimeout(Popup.showPopupID);
  
  // Remove any footnote hilighting
  if (BibleTexts.SelectedNote) BibleTexts.SelectedNote.className = BibleTexts.SelectedNote.className.replace(" fnselected", "");
  
  // Remove any dynamically added Strong's classes from CSS stylesheet,
  // unless we're now over npopup
  var over = e.relatedTarget;
  while(over && (!over.id || !(/^npopup$/).test(over.id))) {over = over.parentNode;}
  if (over) return;
  
  for (var i = (AddedRules.length-1); i>=0; i--) {
    AddedRules[i].sheet.deleteRule(AddedRules[i].index);
  }
  
  AddedRules = [];

}

const scriptClickClasses = /^(sn|sr|dt|dtl|cr|fn|sbpin|sbwin|crtwisty|fnlink|nbsizer|crref|snbut|listenlink|prevchaplink|nextchaplink|popupBackLink|popupCloseLink)(\-|\s|$)/;
function scriptClick(e) {

  // Get the text window of this event
  var w = getContextWindow(e.target);
  if (w === null) return; // w=0 means popup!!
  
  // when an unpinned GenBook window is clicked, select its chapter in the navigator
  if (w && !ViewPort.IsPinned[w] && Tab[ViewPort.Module[w]].modType == GENBOOK) {
    var key = ViewPort.Key[w];
    if (GenBookNavigator.selectedChapter() != "rdf:#/" + ViewPort.Module[w] + key) {
			GenBookNavigator.select("rdf:#/" + ViewPort.Module[w] + key);
		}
  }
  
  // Only proceed for events with click functionality, but move up the
  // DOM tree to catch clicks inside interesting elements.
  var elem = e.target;
  var type;
  while(elem) {
    if (elem.id && (/^(npopup|text\d)$/).test(elem.id)) break; // don't go higher than certain containers
    if (elem.className) {
      type = elem.className.match(scriptClickClasses);
      if (type) break;
    }
    elem = elem.parentNode;
  }
  if (!elem || !type) return;
  type = type[1];
  
  var p = getElementInfo(elem);
//jsdump("w:" + w + " type:" + type + " p:" + uneval(p) + ", elem_cn=" + elem.className + ", elem_t=" + elem.title);

  switch (type) {
    
  // Text box and Popup clicks
  case "sr":
  case "dt":
  case "dtl":
  case "popupBackLink":
    Popup.activate(elem, e);
    break;
    
  case "popupCloseLink":
    Popup.close();
    break;
    
  case "cr":
    if (w==0) Popup.activate(elem, e);
    else {
      var ok = toggleRefText(document.getElementById("w" + w + ".footnote."  + p.type + "." + p.nid + "." + p.osisref + "." + p.mod));
      if (ok) BibleTexts.scroll2Note("w" + w + ".footnote."  + p.type + "." + p.nid + "." + p.osisref + "." + p.mod);
    }
    break;
    
  case "fn":
    if (w==0) Popup.activate(elem, e);
    break;
    
  case "sn":
    if (w==0) Popup.activate(elem, e);
    break;
    
  case "snbut":
    MainWindow.XulswordController.doCommand("cmd_xs_search", { search:{ mod:p.mod, searchtext:"lemma: " + p.ch, type:"SearchAdvanced" }});
    break;
    
  case "listenlink":
    MainWindow.Player.w = w;
    MainWindow.Player.version = p.mod;
    MainWindow.Player.chapter = p.ch;
    MainWindow.Player.book = p.bk;
    MainWindow.beginAudioPlayer();
    break;
    
  case "sbpin":
    var ws = document.getElementById("text" + w).getAttribute("columns").match(/^show(\d)$/);
    if (!ws) return;
    ws = Number(ws[1]);
    for (var wp=w; wp<(w+ws); wp++) {ViewPort.IsPinned[wp] = !ViewPort.IsPinned[wp];}
    Texts.update((ViewPort.IsPinned[w] ? SCROLLTYPENONE:SCROLLTYPECENTER), HILIGHTNONE);
    break;
    
  case "sbwin":
    ViewPort.towindow = w;
    var t = document.getElementById("text" + w);
    var chromeH = 40;
    
    // Open the new xul viewport window.
    var X = 0;
    var Y = 0;
    var f = window.frameElement;
    var wintop = f.ownerDocument.defaultView;
    var offset = getOffset(t);
    X = Number(f.boxObject.x + offset.left);
    Y = Number(f.boxObject.y + offset.top - chromeH);
    
    var p = "chrome,resizable,dependant";
    p += ",left=" + Number(wintop.screenX + X);
    p += ",top=" + Number(wintop.screenY + Y);
    p += ",width=" + t.offsetWidth;
    p += ",height=" + (t.offsetHeight + chromeH);
    AllWindows.push(wintop.open("chrome://xulsword/content/viewport/viewport.xul", "viewport" + String(Math.random()), p));
    break;

  case "prevchaplink":
    if (!w) break;
    var mod = ViewPort.Module[w];
    switch (Tab[mod].modType) {
    case BIBLE:
      if ((/^show(2|3)$/).test(document.getElementById("text" + w).getAttribute("columns"))) 
          previousPage(w);
      else if (ViewPort.IsPinned[w]) previousChapterPinned(w);
      else MainWindow.goDoCommand('cmd_xs_previousChapter');
      break;
    case DICTIONARY:
      var currentKey = ViewPort.Key[w];
      for (var k=0; k<DictTexts.keyList[mod].length; k++) {
        if (DictTexts.keyList[mod][k] == currentKey) break;
      }
      k--;
      if (DictTexts.keyList[mod][k]) {
        ViewPort.Key[w] = DictTexts.keyList[mod][k];
        Texts.updateDictionary(w, Texts.getWindowDisplay(w), false);
      }
      break;
    case COMMENTARY:
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
      else if (ViewPort.IsPinned[w]) previousChapterPinned(w);
      else MainWindow.goDoCommand('cmd_xs_previousChapter');
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
        var prevchap = GenBookTexts.previousChapter("rdf:#/" + mod + (ViewPort.IsPinned[w] ? Texts.pinnedDisplay[w].Key:ViewPort.Key[w]));
        if (!prevchap) return;
        
        if (ViewPort.IsPinned[w]) {
          Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPETOP;
          Texts.pinnedDisplay[w].Key = prevchap.match(GenBookNavigator.RDFCHAPTER)[2];
          Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
        }
        else GenBookNavigator.select(prevchap);
        // scroll to end if possible
        sb.scrollLeft = sb.scrollWidth;
        break;
      }
    }
    break;
    
  case "nextchaplink":
    if (!w) break;
    var mod = ViewPort.Module[w];
    switch (Tab[mod].modType) {
    case BIBLE:
      if ((/^show(2|3)$/).test(document.getElementById("text" + w).getAttribute("columns")))
          nextPage(w);
      else if (ViewPort.IsPinned[w]) nextChapterPinned(w);
      else MainWindow.goDoCommand('cmd_xs_nextChapter');
      break;
    case COMMENTARY:
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
        if (ViewPort.IsPinned[w])  nextChapterPinned(w);
        else MainWindow.goDoCommand('cmd_xs_nextChapter');
      }
      break;
    case DICTIONARY:
      var currentKey = ViewPort.Key[w];
      for (var k=0; k<DictTexts.keyList[mod].length; k++) {
        if (DictTexts.keyList[mod][k] == currentKey) break;
      }
      k++;
      if (DictTexts.keyList[mod][k]) {
        ViewPort.Key[w] = DictTexts.keyList[mod][k];
        Texts.updateDictionary(w, Texts.getWindowDisplay(w), false);
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
        var nextchap = GenBookTexts.nextChapter("rdf:#/" + mod + (ViewPort.IsPinned[w] ? Texts.pinnedDisplay[w].Key:ViewPort.Key[w]));
        if (!nextchap) return;
        
        if (ViewPort.IsPinned[w]) {
          Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPETOP;
          Texts.pinnedDisplay[w].Key = nextchap.match(GenBookNavigator.RDFCHAPTER)[2];
          Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
        }
        else GenBookNavigator.select(nextchap);
      }
      break;
    }
    break;
    

  // Note box clicks
  case "crtwisty":
    toggleRefText(elem);
    break;

  case "fnlink": //Note reference link
    switch (Tab[p.mod].modType) {
    case BIBLE:
    case COMMENTARY:
      Location.setLocation(p.mod, p.bk + "." + p.ch + "." + p.vs);
      MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHTVERSE);
      break;
     case DICTIONARY:
     case GENBOOK:
      //scrollScriptBox(w, SCROLLTYPECENTER, "par." + t.vs);
      break;
    } 
    break;
    
  case "nbsizer":
    ViewPort.MaximizeNoteBox[w] = !(ViewPort.MaximizeNoteBox[w]);
    ViewPort.update(false);
    break;
    
  case "crref":
    Location.setLocation(p.mod, p.bk + "." + p.ch + "." + p.vs + "." + p.lv);
    MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
    break;
    
  }
  
  e.stopPropagation(); // block any higher handlers
}

// Will search element and parents for cr(opened|closed) class and toggle it if found
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
  
  // Get module this event occurred in
  var mod = getContextModule(e.target);
  
  // Get selected text
  var selob = window.getSelection();
  var sel = selob.toString();
  sel = cleanDoubleClickSelection(sel);
  if (!sel || sel.search(/^\s*$/)!=-1) return; //return of nothing or white-space

  // Do a search for selected word in mod. Use cmd_xs_search because 
  // its much faster than cmd_xs_searchForSelection and can be used
  // because our selection is only a single word.
  MainWindow.XulswordController.doCommand("cmd_xs_search", { search:{ mod:mod, searchtext:sel, type:"SearchAnyWord" }});
  
  e.stopPropagation(); // block any higher handlers
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
  if (ViewPort.MaximizeNoteBox[w]) {
    var rule = getCSS(".sb {");
    ViewPort.NoteBoxHeight[w] = rule.rule.style.height.match(/([\-\d]+)px/)[1];
    ViewPort.MaximizeNoteBox[w] = false;
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
    ViewPort.NoteBoxHeight[w] = ViewPort.NoteBoxHeight[w] - top;
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
    var w = getContextWindow(event.target);
    if (!w) return; // if we're over a popup don't do anything

    // dictionaries don't do flow columns and don't sync to other windows
    // so no special scrollwheel response is needed
    if (Tab[ViewPort.Module[w]].modType == DICTIONARY) return;
        
    // if we're over a notebox, do nothing
    var el = event.target;
    while(el) {
      if (el.id && (/^note\d+$/).test(el.id)) return;
      el = el.parentNode;
    }
       
    // then initiate a window scroll...
    MouseWheel.SWwin = w;
    
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
    if (Tab[ViewPort.Module[MouseWheel.SWwin]].modType == GENBOOK) {
      scrollType = SCROLLTYPEDELTA;
      Texts.scrollDelta = dv*20; // scroll delta in pixels
    }
  
    // else scrolling versekey modules
    else {
      scrollType = SCROLLTYPEBEG;
      
      // get first verse which begins in window
      v = sb.firstChild;
      while (v && !Texts.isVisibleVerse(v, MouseWheel.SWwin)) {v = v.nextSibling;}
      if (!v) return;
     
      // if this is a multi-column versekey window, shift the verse according to scroll wheel delta
      if (t.getAttribute("columns") != "show1") {
        var nv = v;
        while (dv > 0) {
          if (nv) nv = nv.nextSibling;
          while (nv && (!nv.className || !(/(^|\s)vs(\s|$)/).test(nv.className))) {nv = nv.nextSibling;}
          dv--;
          if (nv && nv.className && (/(^|\s)vs(\s|$)/).test(nv.className)) v = nv;
        }
        while (dv < 0) {
          if (nv) nv = nv.previousSibling;
          while (nv && (!nv.className || !(/(^|\s)vs(\s|$)/).test(nv.className))) {
            nv = nv.previousSibling;
          }
          dv++;
          if (nv && nv.className && (/(^|\s)vs(\s|$)/).test(nv.className)) v = nv;
        }
      }
     
      var p = getElementInfo(v);
      
      if (ViewPort.IsPinned[MouseWheel.SWwin]) {
        scrollType = SCROLLTYPEPREVIOUS;
        Texts.pinnedDisplay[MouseWheel.SWwin].scrollTypeFlag = SCROLLTYPEBEG;
        Texts.pinnedDisplay[MouseWheel.SWwin].location = [p.bk,p.ch,p.vs,p.vs].join(".");
        Texts.pinnedDisplay[MouseWheel.SWwin].mod = p.mod;
        Texts.pinnedDisplay[MouseWheel.SWwin].bk = p.bk;
        Texts.pinnedDisplay[MouseWheel.SWwin].ch = p.ch;
        Texts.pinnedDisplay[MouseWheel.SWwin].vs = p.vs;
        Texts.pinnedDisplay[MouseWheel.SWwin].lv = p.vs;
      }
      else Location.setLocation(p.mod, p.bk + "." + p.ch + "." + p.vs);
    }
      
    // decide which windows to scroll and which to leave alone
    var force = [null];
    for (var w=1; w<=NW; w++) {
      var s = 0;
      if (w == MouseWheel.SWwin) {
        if (t.getAttribute("columns") == "show1") s = -1; // no need to scroll since UI will handle it
      }
      else {
        if (ViewPort.IsPinned[MouseWheel.SWwin]) s = -1;
      }
      force.push(s);
    }

    Texts.update(scrollType, HILIGHTSKIP, force);
  }

}


/************************************************************************
 * Navigation click functions...
 ***********************************************************************/ 
 
function previousChapterPinned(w) {
  try {if (!ViewPort.IsPinned[w]) return;}
  catch(er) {return;}
  
  var chn = Texts.pinnedDisplay[w].ch;
  
  if (chn > 1) {chn--;}
  else return;
  
  Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPEBEG;
  var loc = Texts.pinnedDisplay[w].location.split(".");
  loc[1] = chn;
  Texts.pinnedDisplay[w].location = loc.join(".");
  Texts.pinnedDisplay[w].ch = chn;
  Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
}

// window w may be pinned or unpinned
function previousPage(w) {
  if (!w) return;
  
  // get first verse
  var t = document.getElementById("text" + w);
  if (!(/^show(2|3)$/).test(t.getAttribute("columns"))) return;
  
  var sb = t.getElementsByClassName("sb")[0];
  var v = sb.firstChild;
  while (v && (v.style.display == "none" || !v.className || !(/^vs(\s|$)/).test(v.className))) {
    v = v.nextSibling;
  }
  if (!v) return;
  
  v = getElementInfo(v);
  
  if (ViewPort.IsPinned[w]) {
    Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPEEND;
    Texts.pinnedDisplay[w].location = [v.bk,v.ch,v.vs,v.vs].join(".");
    Texts.pinnedDisplay[w].bk = v.bk;
    Texts.pinnedDisplay[w].ch = v.ch;
    Texts.pinnedDisplay[w].vs = v.vs;
    Texts.pinnedDisplay[w].lv = v.vs;
    Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
  }
  else {
    Location.setLocation(v.mod, v.bk + "." + v.ch + "." + v.vs);
    MainWindow.Texts.update(SCROLLTYPEENDSELECT, HILIGHTNONE);
  }

}

function nextChapterPinned(w) {
  try {if (!ViewPort.IsPinned[w]) return;}
  catch(er) {return;}
  
  var chn = Texts.pinnedDisplay[w].ch;
  
  if (chn < LibSword.getMaxChapter(Texts.pinnedDisplay[w].mod, Texts.pinnedDisplay[w].bk)) {
    chn++;
  }
  else return;
  
  Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPEBEG;
  var loc = Texts.pinnedDisplay[w].location.split(".");
  loc[1] = chn;
  Texts.pinnedDisplay[w].location = loc.join(".");
  Texts.pinnedDisplay[w].ch = chn;
  Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
}

// window w may be pinned or unpinned
function nextPage(w) {
  if (!w) return;
  
  // get last verse
  var vl = null;
  var t = document.getElementById("text" + w);
  if (!(/^show(2|3)$/).test(t.getAttribute("columns"))) return;
  
  var sb = t.getElementsByClassName("sb")[0];
  var v = sb.lastChild;
  while (v && !Texts.isVisibleVerse(v, w)) {
    v = v.previousSibling;
  }
  if (!v) return;

  v = getElementInfo(v);

  if (ViewPort.IsPinned[w]) {
    Texts.pinnedDisplay[w].scrollTypeFlag = SCROLLTYPEBEG;
    Texts.pinnedDisplay[w].location = [v.bk,v.ch,v.vs,v.vs].join(".");
    Texts.pinnedDisplay[w].bk = v.bk;
    Texts.pinnedDisplay[w].ch = v.ch;
    Texts.pinnedDisplay[w].vs = v.vs;
    Texts.pinnedDisplay[w].lv = v.vs;
    Texts.update(SCROLLTYPEPREVIOUS, HILIGHTSKIP);
  }
  else {
    Location.setLocation(v.mod, v.bk + "." + v.ch + "." + v.vs);
    MainWindow.Texts.update(SCROLLTYPEBEG, HILIGHTNONE);
  }
}

