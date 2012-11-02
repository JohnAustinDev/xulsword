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

var Texts = {
  
  scrollTypeFlag:null,
  hilightFlag:null,
  
  display:[null, null, null, null],
  
  pinnedDisplay:[null, null, null, null],
  
  footnotes:[null, null, null, null],

  update: function(scrollTypeFlag, hilightFlag, force) {

    if (scrollTypeFlag === undefined) scrollTypeFlag = SCROLLTYPETOP;
    if (hilightFlag === undefined) hilightFlag = HILIGHTNONE;
    if (force === undefined) force = false;
   
    this.scrollTypeFlag = scrollTypeFlag;
    this.hilightFlag = hilightFlag;

    if (this.scrollTypeFlag == SCROLLTYPETOP) Location.setVerse(prefs.getCharPref("DefaultVersion"), 1, 1);
    
    updateCSSBasedOnVersion(firstDisplayBible(false), [".chapsubtable"]);
    
    ViewPort.update(false);
    
    for (var w=1; w<=NW; w++) {
      
      if (document.getElementById("text" + w).getAttribute("columns") == "hide") continue;
      if (w > prefs.getIntPref("NumDisplayedWindows")) continue;
   
      switch(Tab[prefs.getCharPref("Version" + w)].modType) {
        
      case BIBLE:
        this.updateBible(w, force);
        break;
        
      case COMMENTARY:
        this.updateCommentary(w, force);
        break;
      
      case DICTIONARY:
        this.updateDictionary(w);
        break;
        
      case GENBOOK:
        this.updateGenBook(w);
        break;
        
      }
      
      this.pinnedDisplay[w] = copyObj(this.display[w]);
    }
        
    MainWindow.goUpdateTargetLocation();
    
    MainWindow.updateNavigator();
    
    MainWindow.document.getElementById("cmd_xs_startHistoryTimer").doCommand();

  },
  
  updateBible: function(w, force) {
    
    var scrollTypeFlag = this.scrollTypeFlag;
    var hilightFlag = this.hilightFlag;
    var loc = Location.getLocation(prefs.getCharPref("Version" + w));
    
    // get current display params
    var display = this.getDisplay(prefs.getCharPref("Version" + w), loc, w);
    
    // overwrite display and location with any pinned values
    if (!this.pinnedDisplay[w]) prefs.setBoolPref("IsPinned" + w, false);
    if (getPrefOrCreate("IsPinned" + w, "Bool", false)) {
      // then keep pinned params (which could have been changed since last display)
      display.mod = this.pinnedDisplay[w].mod;
      display.bk  = this.pinnedDisplay[w].bk;
      display.ch  = this.pinnedDisplay[w].ch;
      display.vs  = this.pinnedDisplay[w].vs;
      loc = display.bk + "." + display.ch + "." + display.vs;
      hilightFlag = HILIGHTNONE;
    }
  
    // overwrite display and location with any scroll values
    if (typeof(this.scrollTypeFlag) == "object") {
      if (this.scrollTypeFlag[w]) {
        if (!(/\./).test(this.scrollTypeFlag[w])) {
          scrollTypeFlag = this.scrollTypeFlag[w];
          hilightFlag = HILIGHTNONE;
        }
        else {
          var lt = this.scrollTypeFlag[w].split(".");
            if (lt && lt.length==3) {
            display.bk  = lt[0];
            display.ch  = lt[1];
            display.vs  = lt[2];
            loc = lt[0] + "." + lt[1] + "." + lt[2];
            scrollTypeFlag = Number(lt[3]);
            hilightFlag = HILIGHTNONE;
          }
        }
      }
      else {scrollTypeFlag = SCROLLTYPENONE;}
    }
  
    // don't read new text if the results will be identical to the last displayed text
    var check = ["mod", "bk", "ch", "globalOptions", "ShowOriginal", "ShowFootnotesAtBottom", 
                "ShowCrossrefsAtBottom", "ShowUserNotesAtBottom", "columns"];
                
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
//jsdump("Reading text from libsword w" + w);
      var t = document.getElementById("text" + w);
      var sb = t.getElementsByClassName("sb")[0];
      var prev = {htmlText:"", htmlNotes:"", footnotes:""};
      var next = {htmlText:"", htmlNotes:"", footnotes:""};

      // Get any additional chapters needed to fill multi-column Bible displays.
      // Any verse in the display chapter should be scrollable (top, center, or bottom)
      // while still resulting in a filled multi-column display, if possible.
      if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {
        
        var d2 = copyObj(display);
  
        // collect previous chapter(s)
        var c = Number(display.ch) - 1;
        while (c > 0) {
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          prev.htmlText = (tip.htmlText.length > 64 ? tip.htmlText:"") + prev.htmlText;
          prev.htmlNotes = tip.htmlNotes + prev.htmlNotes;
          prev.footnotes = tip.footnotes + prev.footnotes;
          sb.innerHTML = prev.htmlText;
          if (sb.lastChild.offsetLeft >= sb.offsetWidth) break;
          c--;
        }
      
        // collect next chapter(s)
        var c = Number(display.ch) + 1;
        while (c <= Bible.getMaxChapter(d2.mod, d2.bk + "." + d2.ch)) {
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          next.htmlText = next.htmlText + (tip.htmlText.length > 64 ? tip.htmlText:"");
          next.htmlNotes = next.htmlNotes + tip.htmlNotes;
          next.footnotes = next.footnotes + tip.footnotes;
          sb.innerHTML = next.htmlText;
          if (sb.lastChild.offsetLeft >= sb.offsetWidth) break;
          c++;
        }
        
      }
      
      var ti = BibleTexts.read(w, display);
        
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = prev.htmlText + (ti.htmlText.length > 64 ? ti.htmlText:"") + next.htmlText;

      var nb = t.getElementsByClassName("nb")[0];
      this.footnotes[w] = prev.footnotes + ti.footnotes + next.footnotes;
      nb.innerHTML = prev.htmlNotes + ti.htmlNotes + next.htmlNotes;

    }
    
    // handle scroll
    this.scroll2Verse(w, loc, scrollTypeFlag);
    
    // handle highlights
    this.hilightVerses(w, loc, hilightFlag);
    
    // set audio icons
    if (BibleTexts.updateAudioLinksTO) window.clearTimeout(BibleTexts.updateAudioLinksTO);
    BibleTexts.updateAudioLinksTO = window.setTimeout("BibleTexts.updateAudioLinks(" + w + ");", 0);
    
    // remove notes which aren't in window, or hide notebox entirely if empty
    BibleTexts.checkNoteBox(w);
    
    // save display objects for this window
    this.display[w] = copyObj(display);
    
  },
  
  updateCommentary: function(w, force) {
    
    var scrollTypeFlag = this.scrollTypeFlag;
    var hilightFlag = this.hilightFlag;
    var loc = Location.getLocation(prefs.getCharPref("Version" + w));
        
    // get current display params
    var display = this.getDisplay(prefs.getCharPref("Version" + w), loc, w);
    
    // overwrite display and loc with any pinned values
    if (!this.pinnedDisplay[w]) prefs.setBoolPref("IsPinned" + w, false);
    if (getPrefOrCreate("IsPinned" + w, "Bool", false)) {
      // then keep pinned params (which could have been changed since last display)
      display.mod = this.pinnedDisplay[w].mod;
      display.bk  = this.pinnedDisplay[w].bk;
      display.ch  = this.pinnedDisplay[w].ch;
      display.vs  = this.pinnedDisplay[w].vs;
      loc = display.bk + "." + display.ch + "." + display.vs;
      hilightFlag = HILIGHTNONE;
    }
    
    // overwrite display and loc with any scroll values
    if (typeof(this.scrollTypeFlag) == "object") {
      if (this.scrollTypeFlag[w]) {
        if (!(/\./).test(this.scrollTypeFlag[w])) {
          scrollTypeFlag = this.scrollTypeFlag[w];
          hilightFlag = HILIGHTNONE;
        }
        else {
          var lt = this.scrollTypeFlag[w].split(".");
          if (lt && lt.length==3) {
            display.bk  = lt[0];
            display.ch  = lt[1];
            display.vs  = lt[2];
            loc = lt[0] + "." + lt[1] + "." + lt[2];
            scrollTypeFlag = Number(lt[3]);
            hilightFlag = HILIGHTNONE;
          }
        }
      }
      else {scrollTypeFlag = SCROLLTYPENONE;}
    }
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "bk", "ch", "globalOptions"];
     
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = CommTexts.read(w, display);

      this.footnotes[w] = ti.footnotes;

      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = (ti.htmlText.length > 64 ? ti.htmlText:"");

    }
    
    // handle scroll
    this.scroll2Verse(w, loc, scrollTypeFlag);
    
    // handle highlights
    this.hilightVerses(w, loc, hilightFlag); 
    
    // save display object for this window
    this.display[w] = copyObj(display);
      
  },
  
  updateGenBook: function(w, force) {

    prefs.setBoolPref("ShowOriginal" + w, false);
    prefs.setBoolPref("MaximizeNoteBox" + w, false);
    
    // get current display params
    var display = this.getDisplay(prefs.getCharPref("Version" + w), Location.getLocation(prefs.getCharPref("Version" + w)), w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "GenBookKey", "globalOptions"];
    
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = GenBookTexts.read(w, display);
     
      this.footnotes[w] = ti.footnotes;
      
      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = ti.htmlText;
    }
    
    // handle scroll
    var scrollTypeFlag = SCROLLTYPENONE;
    var delta = 0;
    if (typeof(this.scrollTypeFlag) == "object" && this.scrollTypeFlag[w]) {
      var lt = this.scrollTypeFlag[w].split(".");
      if (lt && lt.length == 2) {
        delta = lt[0];
        scrollTypeFlag = lt[1];
      }
    }  
    if (scrollTypeFlag == SCROLLTYPEDELTA) GenBookTexts.scrollDelta(w, delta);
    
    // save display object for this window
    this.display[w] = copyObj(display);
    
  },
  
  updateDictionary: function(w, force) {

    prefs.setBoolPref("IsPinned" + w, false);
    prefs.setBoolPref("ShowOriginal" + w, false);
    prefs.setBoolPref("MaximizeNoteBox" + w, false);
    
    // get current display params
    var display = this.getDisplay(prefs.getCharPref("Version" + w), Location.getLocation(prefs.getCharPref("Version" + w)), w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "DictKey", "globalOptions"];
    
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = DictTexts.read(w, display);
      
      this.footnotes[w] = ti.footnotes;
      
      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = ti.htmlEntry;
      
      var nb = t.getElementsByClassName("nb")[0];
      nb.innerHTML = ti.htmlList;
    }
    
    // highlight the selected key
    var k = document.getElementById("note" + w).getElementsByClassName("dictselectkey");
    while (k.length) {k[0].className = "";}
    k = document.getElementById("w" + w + "." + encodeUTF8(display.DictKey));
    if (k) {
      k.className = "dictselectkey";
      k.scrollIntoView();
      document.getElementById("viewportbody").scrollTop = 0;
    }
    
    document.getElementById("w" + w + ".keytextbox").value = display.DictKey;
    setUnicodePref("DictKey_" + display.mod + "_" + w, display.DictKey);
    
    // save display object for this window
    this.display[w] = copyObj(display);
  },


  //////////////////////////////////////////////////////////////////////
  // Texts Utility functions
  //////////////////////////////////////////////////////////////////////
  
  // Adjusts font-size of first passed HTML element,
  // stopping at given overall offset width.
  fitHTML: function(html, w, maxfs) {
    var elem = document.getElementById("sizetester");
    elem.innerHTML = html;
    
    var fs = (maxfs ? maxfs:20);
    elem.firstChild.style.fontSize = fs + "px";
//jsdump("A-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    while (fs > 8 && elem.offsetWidth > w) {
      fs -= 4;
      elem.firstChild.style.fontSize = fs + "px";
//jsdump("B-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    }
    
    return elem.innerHTML;
  },

  getPageLinks: function() {
    var config = LocaleConfigs[getLocale()];
    var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
    var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));

    var html = "";
    html += "<div class=\"navlink cs-Program\">";
    html +=   "&lrm;<span>" + charPrev + "</span> " + "<a class=\"prevchaplink\">" + SBundle.getString('PrevChaptext') + "</a>";
    html +=   " / ";
    html +=   "<a class=\"nextchaplink\">&lrm;" + SBundle.getString('NextChaptext') + "</a>" + " <span>" + charNext + "</span>";
    html += "</div>";
    
    return html;
  },
  
  getUserNotes: function(bk, ch, mod, text, w) {
    var usernotes = {html:text, notes:""};
      
    var usesVerseKey = (Tab[mod].modType == BIBLE || Tab[mod].modType == COMMENTARY);
    
    // Search User Data for notes with this book, chapter, and version
    var recs = BMDS.GetAllResources();
    while (recs.hasMoreElements()) {
      var res = recs.getNext();
      var note = BMDS.GetTarget(res, BM.gBmProperties[NOTE], true);
      if (!note) continue;
      note = note.QueryInterface(Components.interfaces.nsIRDFLiteral);
      if (!note) continue;
      note=note.Value;
      if (!note) {continue;}
      if (BM.RDFCU.IsContainer(BMDS, res)) {continue;}
       
      try {var module = BMDS.GetTarget(res, BM.gBmProperties[MODULE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (module != mod) continue;
      try {var chapter = BMDS.GetTarget(res, BM.gBmProperties[CHAPTER], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}      
      if (usesVerseKey) {
        if (chapter != String(ch)) continue;
        try {var book = BMDS.GetTarget(res, BM.gBmProperties[BOOK], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
        if (book != bk) continue;
      }
      else {
        if (chapter != getUnicodePref((Tab[mod].modType == DICTIONARY ? "DictKey_":"GenBookKey_") + mod + "_" + w)) continue;
        book = "na";
        chapter = "1";
      }
      try {var verse = BMDS.GetTarget(res, BM.gBmProperties[VERSE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (!BookmarkFuns.isItemChildOf(res, BM.AllBookmarksRes, BMDS)) continue;
       
      // We have a keeper, lets save the note and show it in the text!
      // Encode ID
      var encodedResVal = encodeUTF8(res.QueryInterface(BM.kRDFRSCIID).Value);
      var myid = "un." + encodedResVal + "." + bk + "." + ch + "." + verse + "." + mod;
      var newNoteHTML = "<span id=\"" + myid + "\" class=\"un\" title=\"un\"></span>";
      
      // if this is a selected verse, place usernote inside the hilighted element (more like regular notes)
      var idname = (usesVerseKey ? "vs." + bk + "." + ch + ".":"par.");
      var re = new RegExp("id=\"" + idname + verse + "\"[^>]*>(\\s*<span.*?>)?", "im");
      usernotes.html = usernotes.html.replace(re, "$&" + newNoteHTML);
      usernotes.notes += "<div id=\"src." + myid + "\">" + note + "</div>";
    }
    
    return usernotes;
  },
 
  getDisplay: function(mod, loc, w) {
    loc = loc.split(".");
    var display = {globalOptions:{}};
    display.mod = mod;
    display.bk = loc[0];
    display.ch = Number((loc[1] ? loc[1]:1));
    display.vs = Number((loc[2] ? loc[2]:1));
    display.lv = Number((loc[3] ? loc[3]:1));
    display.GenBookKey = getPrefOrCreate("GenBookKey_" + mod + "_" + w, "Unicode", "/" + mod);
    display.DictKey = getPrefOrCreate("DictKey_" + mod + "_" + w, "Unicode", "<none>");
    display.ShowOriginal = getPrefOrCreate("ShowOriginal" + w, "Bool", false);
    display.MaximizeNoteBox = getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
    display.ShowFootnotesAtBottom = getPrefOrCreate("ShowFootnotesAtBottom", "Bool", true);
    display.ShowCrossrefsAtBottom = getPrefOrCreate("ShowCrossrefsAtBottom", "Bool", false);
    display.ShowUserNotesAtBottom = getPrefOrCreate("ShowUserNotesAtBottom", "Bool", true);
    display.columns = document.getElementById("text" + w).getAttribute("columns");

    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") 
        display.globalOptions[GlobalToggleCommands[cmd]] = prefs.getCharPref(GlobalToggleCommands[cmd]);
      else display.globalOptions[GlobalToggleCommands[cmd]] = Bible.getGlobalOption(GlobalToggleCommands[cmd]);
    }
    
    return display;
  },
  
  isChanged: function(check, display1, display2) {
    for (var i=0; i<check.length; i++) {
      if (check[i] == "globalOptions") {
        for (var cmd in GlobalToggleCommands) {
          if (display1.globalOptions[GlobalToggleCommands[cmd]] != 
              display2.globalOptions[GlobalToggleCommands[cmd]]) {
//jsdump("changed=" + GlobalToggleCommands[cmd]);
            return true;
          }
        } 
      }
      else if (display1[check[i]] != display2[check[i]]) {
//jsdump("changed=" + check[i]);
        return true;
      }
    }
//jsdump("no change");
    return false;
  },

  scroll2Verse: function(w, l, scrollTypeFlag) {
    if (!l) return true;
    
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var mod = prefs.getCharPref("Version" + w);
    
    l = l.split(".");
    l[1] = (l[1] ? Number(l[1]):1);
    l[2] = (l[2] ? Number(l[2]):1);
    l[3] = (l[3] ? Number(l[3]):l[2]);
    
    // find the element to scroll to
    var av = sb.firstChild;
    var v = null;
    var vf = null;
    while (av && !v) {

      var re;
      re = new RegExp("^vs" + "\\." + l[0] + "\\." + l[1] + "\\.");
      if (!vf && av.id && re.test(av.id)) vf = av;
      
      re = new RegExp("^vs" + "\\." + l[0] + "\\." + l[1] + "\\." + l[2] + "$");
      if (av.id && re.test(av.id)) v = av;
      
      av = av.nextSibling;
      
    }
    
    // if not found, use first verse in current chapter
    if (!v) v = vf;
    
    // if neither verse nor chapter has been found, return false
    if (!v) return false;

    // perform appropriate scroll action
//jsdump("SCROLLING w" + w + " " + v.id + ": " + scrollTypeFlag);

    var vOffsetTop = v.offsetTop;
    var vt = v;
    while (vt && vt.parentNode !== v.offsetParent) {
      vt = vt.parentNode; 
      if (vt && vt.offsetTop) vOffsetTop -= vt.offsetTop;
    }
    
    // if part of commentary element is already visible, don't rescroll
    if (Tab[mod].modType==COMMENTARY &&
        (vOffsetTop < sb.scrollTop) &&
        (vOffsetTop + v.offsetHeight > sb.scrollTop + 20)) return true;
      
    // if this is verse 1 then SCROLLTYPEBEG and SCROLLTYPECENTER both become SCROLLTYPETOP
    if (l[2]==1 && (scrollTypeFlag==SCROLLTYPEBEG || scrollTypeFlag==SCROLLTYPECENTER)) {
      scrollTypeFlag = SCROLLTYPETOP;
    }
  
    // scroll single column windows...
    if (t.getAttribute("columns") == "show1") {
      
      switch (scrollTypeFlag) {
      case SCROLLTYPENONE:         // don't scroll (for links this becomes SCROLLTYPECENTER)
        break;
      case SCROLLTYPETOP:          // scroll to top
        sb.scrollTop = 0;
        break;
      case SCROLLTYPEBEG:          // put selected verse at the top of the window or link
        sb.scrollTop = vOffsetTop;
        break;
      case SCROLLTYPECENTER:       // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
        if (l[2] != 1 && ((vOffsetTop + v.offsetHeight) > (sb.scrollTop + sb.offsetHeight) || vOffsetTop < sb.scrollTop)) {
          var middle = Math.round(vOffsetTop - (sb.offsetHeight/2) + (v.offsetHeight/2));
          // if beginning of verse is not showing then make it show
          if (vOffsetTop < middle) {sb.scrollTop = vOffsetTop;}
          else {sb.scrollTop = middle;}
        }
        break;
      case SCROLLTYPECENTERALWAYS: // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
          var middle = Math.round(vOffsetTop - (sb.offsetHeight/2) + (v.offsetHeight/2));
          if (vOffsetTop < middle) {sb.scrollTop = vOffsetTop;}
          else {sb.scrollTop = middle;}
        break;
      case SCROLLTYPEEND:          // put selected verse at the end of the window or link, and don't change selection
      case SCROLLTYPEENDSELECT:    // put selected verse at the end of the window or link, then select first verse of link or verse 1
        sb.scrollTop = vOffsetTop + v.offsetHeight - sb.offsetHeight;
        break;
      case SCROLLTYPECUSTOM:       // scroll by running CustomScrollFunction
        break;
      }
    }
    
    // or scroll multi-column windows...
    else {
      
      switch (scrollTypeFlag) {

      case SCROLLTYPETOP:          // scroll to top
        // hide all verses previous to scroll verse's chapter
        var vs = sb.lastChild;
        var show = true;
        var re = new RegExp("^vs\\.[^\\.]+\\." + (Number(l[1])-1) + "\\.");
        while(vs) {
          if (vs.id && re.test(vs.id)) show = false;
          vs.style.display = (show ? "":"none");
          vs = vs.previousSibling;
        }
        break;
      case SCROLLTYPEBEG:          // put selected verse at the top of the window or link
        // Hide all verses before the scroll verse. If the scroll verse is emediately preceded by
        // consecutive non-verse (heading) elements, then show them.
        var vs = sb.lastChild;
        var show = true;
        var showhead = true;
        while(vs) {
          if (!show && showhead) {
            var isverse = (vs.id && (/^vs\./).test(vs.id));
            vs.style.display = (isverse  ? "none":"");
            if (isverse) showhead = false;
          }
          else {
            vs.style.display = (show ? "":"none");
            if (vs == v) show = false;
          }
          vs = vs.previousSibling;
        }
        break;
      case SCROLLTYPENONE:         // don't scroll (for links this becomes SCROLLTYPECENTER)
      case SCROLLTYPECENTER:       // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
        if (l[2] == 1 || (v.style.display != "none" && v.offsetLeft < sb.offsetWidth)) break;
      case SCROLLTYPECENTERALWAYS: // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
        // hide all elements before verse
        var vs = sb.firstChild;
        var show = false;
        while (vs) {
          if (vs == v) show = true;
          vs.style.display = (show ? "":"none"); 
          vs = vs.nextSibling;
        }
        // show verse near middle of first column
        vs = v.previousSibling;
        if (vs) {
          var h = 0;
          do {
            vs.style.display = "";
            h += vs.offsetHeight;
            vs = vs.previousSibling;
          }
          while (vs && h < (sb.offsetHeight/2 - 20));
          if (vs) vs.style.display = "none";
        }
        break;
      case SCROLLTYPEEND:          // put selected verse at the end of the window or link, and don't change selection
      case SCROLLTYPEENDSELECT:    // put selected verse at the end of the window or link, then select first verse of link or verse 1
        // show all verses
        var vs = sb.lastChild;
        while (vs) {
          vs.style.display = "";
          vs = vs.previousSibling;
        }
        // hide verses until last verse appears in last column
        vs = sb.firstChild;
        while (vs && v.offsetLeft >= sb.offsetWidth) {
          vs.style.display = "none";
          vs = vs.nextSibling;
        }
        // hide verses until last verse appears above footnotebox
        var nb = document.getElementById("note" + w);
        while (vs && 
              (v.offsetLeft > sb.offsetWidth-(1.5*nb.offsetWidth) && v.offsetTop+v.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight)) {
          vs.style.display = "none";
          vs = vs.nextSibling;
        }
        
        if (scrollTypeFlag == SCROLLTYPEENDSELECT) {
          var vs = sb.firstChild;
          while(vs && (vs.style.display == "none" || !vs.id || !(/^vs\./).test(vs.id))) {vs = vs.nextSibling;}
          if (vs) {
            var id = vs.id.replace(/^(vs\.)/, "");
            Location.setLocation(prefs.getCharPref("Version" + w), id);
          }
        }
    
        break;
      case SCROLLTYPECUSTOM:       // scroll by running CustomScrollFunction
        break;    
      }
      
    }
  
    return true;
  },
  
  scroll2Element: function(outerElement, element2Scroll, offsetParentId, dontScrollIfVisible, margin) {
    //dump ("outerElement:" + outerElement.id + "\nelement2Scroll:" + element2Scroll.id + "\noffsetParentId:" + offsetParentId + "\ndontScrollIfVisible:" + dontScrollIfVisible + "\nmargin:" + margin + "\n");
    if (!element2Scroll || !element2Scroll.offsetParent) return;
    //jsdump("offsetParentId:" + offsetParentId + "\n");
    while (element2Scroll && element2Scroll.offsetParent && element2Scroll.offsetParent.id != offsetParentId) {element2Scroll = element2Scroll.parentNode;}
    
    var elemOffsetTop = element2Scroll.offsetTop;
    var boxScrollHeight = outerElement.scrollHeight;
    var boxOffsetHeight = outerElement.offsetHeight;
    
    //jsdump("id:" + element2Scroll.id + " outElemScrollTop: " + outerElement.scrollTop + " boxOffsetHeight:" + boxOffsetHeight + " boxScrollHeight:" + boxScrollHeight + " elemOffsetTop:" + elemOffsetTop + "\n");
    var scrollmargin=10;
    if (dontScrollIfVisible && elemOffsetTop > outerElement.scrollTop+scrollmargin && elemOffsetTop < outerElement.scrollTop+boxOffsetHeight-scrollmargin) return;
    
    // If element is near bottom then shift to element (which will be max shift)
    if (elemOffsetTop > (boxScrollHeight - boxOffsetHeight + margin)) {outerElement.scrollTop = elemOffsetTop;}
    // Otherwise shift to element and add a little margin above
    else {outerElement.scrollTop = elemOffsetTop - margin;}
  },
  
  hilightVerses: function(w, l, hilightFlag) {
    if (!l) return;
    
    if (hilightFlag == HILIGHTSAME) return;
    if (Tab[prefs.getCharPref("Version" + w)].modType == COMMENTARY) hilightFlag = HILIGHTNONE;
 
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var mod = prefs.getCharPref("Version" + w);
    
    l = l.split(".");
    l[1] = (l[1] ? Number(l[1]):1);
    l[2] = (l[2] ? Number(l[2]):1);
    l[3] = (l[3] ? Number(l[3]):l[2]);
  
    // unhilight everything
    var hl = sb.getElementsByClassName("hl");
    while (hl.length) {hl[0].className = "";}
  
    // find the verse element(s) to hilight
    var av = sb.firstChild;
    while (av) {
      var id = av.id;
      if (id && (/^vs\./).test(id)) {
        
        id = id.split(".");
        id.shift();
        id[1] = Number(id[1]);
        id[2] = Number(id[2]);
                
        var hi = (id[0] == l[0] && id[1] == l[1]);
        if (hilightFlag==HILIGHTNONE) hi = false;
        if (hilightFlag==HILIGHT_IFNOTV1 && 
            (l[2] == 1 || id[2] < l[2] || id[2] > l[3])) hi = false;
        if (hilightFlag==HILIGHTVERSE && 
            (id[2] < l[2] || id[2] > l[3])) hi = false;
     
        if (hi) av.className = "hl";
        
      }
      
      av = av.nextSibling;
    }
    
  },

  
////////////////////////////////////////////////////////////////////////
// Paragraphs

// These functions should not be changed, to maintain compatibility of
// bookmarks. HTML id's are no longer necessarily unique, because all 
// windows are now in one document, but id is only located using 
// String.indexOf so this should not pose a problem.
  addParagraphIDs: function(text) {
    text = text.replace("<P>", "<p>","g");
    text = text.replace(/<BR/g, "<br");
    var p=1;
    
    var myParType;
    var pars = ["<br />", "<br>", "<p>"];
    for (var i=0; i<pars.length; i++) {
      if (text.indexOf(pars[i]) != -1) {
        myParType = pars[i];
        break;
      }
    }
    if (!myParType) myParType="<br>";
    var r = text.indexOf(myParType);
  //jsdump("myParType=" + myParType + ", r=" + r + "\n");
    
    if (myParType != "<p>") {
      text = "<div id=\"par.1\">" + text;
      p++;
      r = text.indexOf(myParType);
      while (r != -1) {
        var ins = myParType + "</div><div id=\"par." + p++ + "\">";
        text = text.substring(0, r) + ins + text.substring(r + myParType.length);
        r = text.indexOf(myParType, r+ins.length);
      }
      text += "</div>";
    }
    else {
      while (r != -1) {
        ins = " id=\"par." + p++ + "\"";
        r += 2;
        text = text.substring(0, r) + ins + text.substr(r);
        r = text.indexOf(myParType, r+ins.length);
      }
    }

    return text;
  },

  getParagraphWithID: function (p, text) {
    if (p==null || !text) return text;
    var origtext = text;
    var ins = "id=\"par." + p + "\">";
    var s = text.indexOf(ins);
  //jsdump("Looking for:" + ins + "\n" + p + " " + s + "\norigtext:" + origtext.substr(0,128) + "\n");
    if (s == -1) return -1;
    s += ins.length;
    
    p++;
    ins = "id=\"par." + p + "\">";
    var e = text.indexOf(ins, s);
    if (e == -1) e = text.length;
    else {e = text.lastIndexOf("<", e);}
    text = text.substring(s, e);
    text = this.HTML2text(text);

    return text;
  },

  getParagraphWithIDTry: function(p, text) {
    var par = this.getParagraphWithID(p, text);
    if (par == -1) {
      for (var tp=1; tp<=4; tp++) {
        par = this.getParagraphWithID(tp, text);
        if (par != -1) return par;
      }
    }
    else {return par;}
    
    jsdump("WARNING: Paragraph not found: " + p + ", " + text.substr(0,128) + "\n");
    return this.HTML2text(text);
  },

  HTML2text: function(html) {
    var text = html;
    text = text.replace(/(<[^>]+>)/g,"");
    text = text.replace("&nbsp;", " ", "gim");
    return text;
  }

};


////////////////////////////////////////////////////////////////////////
// BibleTexts
////////////////////////////////////////////////////////////////////////

var BibleTexts = {
  
  read: function(w, d) {
    var ret = { htmlText:"", htmlNotes:"", htmlHead:Texts.getPageLinks(), footnotes:null };

    // For Pin feature, set "global" SWORD options for local context
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      Bible.setGlobalOption(GlobalToggleCommands[cmd], d.globalOptions[GlobalToggleCommands[cmd]]);
    }
    
    // get Bible chapter's text
    var un;
    if (d["ShowOriginal"]) {
      Bible.setGlobalOption("Strong's Numbers", "On");
      Bible.setGlobalOption("Morphological Tags", "On");
      var mod2 = (findBookNum(d.bk) < NumOT ? OrigModuleOT:OrigModuleNT);
      ret.htmlText = Bible.getChapterTextMulti(d.mod + "," + mod2, d.bk + "." + d.ch + ".1.1").replace("interV2", "cs-" + mod2, "gm");
      Bible.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      Bible.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      ret.htmlText = Bible.getChapterText(d.mod, d.bk + "." + d.ch + ".1.1");
      
      ret.footnotes = Bible.getNotes();
      
      if (d.globalOptions["User Notes"] == "On") {
        un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText, w);
        ret.htmlText = un.html; // has user notes added to text
        ret.footnotes += un.notes;
      }
      
      // handle footnotes
        
      var gfn = (d.globalOptions["Footnotes"] == "On" && d["ShowFootnotesAtBottom"]);
      var gcr = (d.globalOptions["Cross-references"] == "On" && d["ShowCrossrefsAtBottom"]);
      var gun = (d.globalOptions["User Notes"] == "On" && d["ShowUserNotesAtBottom"]);
        
      if (gfn || gcr || gun) ret.htmlNotes = this.getNotesHTML(ret.footnotes, d.mod, gfn, gcr, gun, false, w);

    }
   
    // localize verse numbers
    var tl = getLocaleOfModule(d.mod);
    if (!tl) {tl = getLocale();}
    if (!DisplayNumeral[tl]) getDisplayNumerals(tl);
    if (DisplayNumeral[tl][10]) {
      var verseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
      ret.htmlText = ret.htmlText.replace(verseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});
    }

    // add headers
    var showHeader = (d.globalOptions["Headings"]=="On");
    if (showHeader && ret.htmlText) {
      ret.htmlText = this.getChapterHeading(d.bk, d.ch, d.mod, w, false, d["ShowOriginal"]) + ret.htmlText;
    }
    
    // highlight user notes
    if (un) BibleTexts.hilightUserNotes(un.notes, w); // uses window.setTimout()
    
    
    // put "global" SWORD options back to their global context values
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      Bible.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
    }
    
    return ret;
  },
  
  checkNoteBox: function(w) {
   
    var havefn = false;
    
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var nb = document.getElementById("note" + w);
      
    if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {

      // get first chapter/verse
      var vf = sb.firstChild;
      while (vf && (vf.style.display == "none" || !vf.id || !(/^vs\./).test(vf.id))) {
        vf = vf.nextSibling;
      }
      if (vf) vf = vf.id.split(".");
      
      // get last chapter/verse
      var vl = sb.lastChild;
      while (vl && (vl.offsetLeft >= sb.offsetWidth || !vl.id || !(/^vs\./).test(vl.id))) {
        vl = vl.previousSibling;
      }
      if (vl) vl = vl.id.split(".");
      
      // hide footnotes whose references are scrolled off the window
      if (nb.innerHTML) {
        // vf and vl id has form: vs.Gen.1.1
        // note id has form: w1.body.fn.1.Gen.1.1.KJV
        var nt = nb.getElementsByClassName("fncol5");
        for (var i=0; i<nt.length; i++) {
          
          var dispattr = "";
          var inf = nt[i].id.split(".");
          
          if (vf && 
             (Number(inf[5]) < Number(vf[2]) ||
             (Number(inf[5]) == Number(vf[2]) && Number(inf[6]) < Number(vf[3])))) {
            dispattr = "none";
          }
            
          if (vl &&
             (Number(inf[5]) > Number(vl[2]) ||
             (Number(inf[5]) == Number(vl[2]) && Number(inf[6]) > Number(vl[3])))) {
            dispattr = "none";
          }
          
          nt[i].parentNode.parentNode.style.display = dispattr;
          if (!dispattr) havefn = true;
        }
      }
    }
    else if (nb.innerHTML) havefn = true;
    
    // hide entire notebox if it's empty
    if (!havefn) {
      document.getElementById("text" + w).setAttribute("foot", "hide");
      prefs.setBoolPref("MaximizeNoteBox" + w, false);
    }

  },
  
  // This function is only for versekey modules (BIBLE, COMMENTARY)
  getChapterHeading: function(bk, ch, mod, w) {
    var l = getLocaleOfModule(mod);
    if (!l) {l = getLocale();}
    var b = getLocaleBundle(l, "books.properties");
    var c = LocaleConfigs[l];

    var font = (c && c.font ? c.font:DefaultFont);
    var size = (c && c.fontSizeAdjust ? c.fontSizeAdjust:DefaultFontSizeAdjust);
    
    var intro = (ch != 1 ? "":BibleTexts.getBookIntroduction(mod, bk));
    // Remove empty intros that may be generated by paratext2Osis.pl
    if (intro && !intro.replace(/<[^>]+>/g,"").match(/\S/)) intro=null;
    
    var lt = Bible.getModuleInformation(mod, "NoticeLink");
    if (lt == NOTFOUND) lt = "";
    else lt = lt.replace("<a>", "<a id=\"w" + w + ".noticelink\">");
    
    var fs = getCSS(".chapnum {");
    fs = Number(fs.style.fontSize.match(/([\-\d]+)px/)[1]);
    var size = "";
     
    // book and chapter heading
    var html, size;
    html  = "<div class=\"chapterhead" + (ch==1 ? " chapterfirst":"") + "\" dirmod=\"" + ((c && c.direction && c.direction=="rtl") ? "rtl":"ltr") + "\">";
    
    html +=   "<div class=\"noticelink cs-" + mod + "\" empty=\"" + (lt ? "false":"true") + "\">" + lt;
    html +=     "<div class=\"headbr\"></div>";
    html +=   "</div>";

    size +=   "<div class=\"chapnum\" style=\"font-family:'" + font + "';\">";
    size +=     "<div class=\"chapbk\">" + b.GetStringFromName(bk) + "</div>";
    size +=     "<div class=\"chapch\">" + getLocalizedChapterTerm(bk, ch, b, l) + "</div>";
    size +=   "</div>";
    html += Texts.fitHTML(size, 170, fs);

    html +=   "<div class=\"chapinfo\">";
    html +=     "<div class=\"listenlink\"></div>";
    html +=     "<div class=\"introlink\" empty=\"" + (intro ? "false":"true") + "\">" + b.GetStringFromName("IntroLink") + "</div>";
    html +=   "</div>";
    
    html += "</div>";
    html += "<div class=\"headbr\"></div>";
    
    return html;
  },

  getNotesHTML: function(notes, mod, gfn, gcr, gun, openCRs, w) {
    if (!notes) return "";
    
    //Start building notebox contents
    var haveNotes=false;
    var versionDirectionEntity = (VersionConfigs[mod] && VersionConfigs[mod].direction == "rtl" ? "&rlm;":"&lrm;");
    var orient = (VersionConfigs[mod] && VersionConfigs[mod].direction == "rtl" ? "fncol3RTL":"fncol3LTR");
    var t = "<div id=\"w" + w + ".maintable.\" class=\"fntable\">";
    var note = notes.split(/(<div [^>]*>.*?<\/div>)/);
    note = note.sort(this.ascendingVerse);
    if (note) {
      var te = "";
      var thiscv="";

      // Now parse each note in the chapter separately
      for (var n=0; n < note.length; n++) {
        if (!note[n]) continue;
        var p = note[n].match(/<div id="src\.([^"]+)">(.*?)<\/div>/);
        var noteid = p[1];
        var body = p[2];
        if (noteid && noteid != "undefined") {    // sometimes this is "undefined" - why?
          // Check if this note should be displayed at bottom, and if not then get next note
          var noteType = noteid.substr(0,2);
          var fn = ((noteType == "fn") && gfn);
          var cr = ((noteType == "cr") && gcr);
          var un = ((noteType == "un") && gun);
          if (!(fn||cr||un)) {continue;}
          haveNotes = true;
          
          // Now display this note as a row in the main table
          t += "<div class=\"" + (openCRs ? "cropened":"crclosed") + "\">";
          
          // Write cell #1: an expander link for cross references only
          t += "<div class=\"fncol1\">";
          if (cr) {t += "<div id=\"w" + w + ".exp." + noteid + "\" class=\"crtwisty\"></div>";}
          t += "</div>";
          // These are the lines for showing expanded verse refs
          t += "<div class=\"fncol2\"><div class=\"fndash\"></div></div>";
          t += "<div class=\"fncol3 " + orient + "\" >&nbsp</div>";
          
          // This makes the following cells part of the highlight
          t += "<div id=\"w" + w + ".ntr." + noteid + "\" class=\"normalNote\">";
          
          // Write cell #4: chapter and verse
          var xsn = new RegExp("^" + XSNOTE + "$");
          var tmp = noteid.match(xsn);
          var lov = getLocaleOfModule(mod);
          var myc = dString(tmp[4], lov);
          var myv = dString(tmp[5], lov);
          t += "<a id=\"w" + w + ".notl." + noteid + "\" class=\"fncol4 cs-" + mod + "\" >" + "<i>" + myc + ":" + versionDirectionEntity + myv + "</i>" + " -" + "</a>";
          
          // Write cell #5: note body
          t += "<div id=\"w" + w + ".body." + noteid + "\" class=\"fncol5\">";
          
          // If this is a cross reference, then parse the note body for references and display them
          if (cr) t += this.getRefHTML(w, mod, noteid, body, "nb", "<br>");
          
          // If this is a footnote, then just write the body
          else if (fn) {t += body;}
          
          // If this is a usernote, then add direction entities  & style
          else if (un) {
            var unclass = "noteBoxUserNote";
            var de = "&lrm;";
            try {
              var unmod = BMDS.GetTarget(BM.RDF.GetResource(decodeUTF8(noteid.match(/un\.(.*?)\./)[1])), BM.gBmProperties[NOTELOCALE], true);
              unmod = unmod.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
              unclass += " cs-" + unmod;
            }
            catch (er) {}
            try {
              if (LocaleConfigs[unmod].direction == "rtl") de = "&rlm;";
            }
            catch (er) {}
   
            body = "<span class=\"" + unclass + "\">" + de + body + de + "</span>";
            t += body;
          }
          
          // Finish this body and this row
          t += "</div></div></div>";
        }
      }
      // End the main table
      t += "</div>";
    }
    
    if (!haveNotes) return "";
    return t
  },
  
  ascendingVerse: function(a,b) {
    var res=null;
    var t1="un"; 
    var t2="fn"; 
    var t3="cr";
    if (a==null || a=="") return 1;
    if (b==null || b=="") return -1;
    var xsn = new RegExp("id=\"src\." + XSNOTE + "\"");
    var av = Number(a.match(xsn)[5]);
    var bv = Number(b.match(xsn)[5]);
    var ac = Number(a.match(xsn)[4]);
    var bc = Number(b.match(xsn)[4]);
    if (ac == bc) {
      if (av == bv) {
        var at = a.match(/id="src\.(\w\w)/)[1];
        var bt = b.match(/id="src\.(\w\w)/)[1];
        if (at == bt) return 0;
        if (at == t1) return -1;
        if (at == t2 && bt == t3) return -1;
        else return 1
      }
      return av > bv ? 1:-1
    }
    else if (ac < bc) return -1;
    return 1;
  },

  // Turns headings on before reading introductions
  getBookIntroduction: function(mod, bk) {
    if (!Tab[mod] || (Tab[mod].modType != BIBLE && Tab[mod].modType != COMMENTARY)) return "";
    Bible.setGlobalOption("Headings", "On");
    var intro = Bible.getBookIntroduction(mod, bk);
    Bible.setGlobalOption("Headings", prefs.getCharPref("Headings"));
    return intro;
  },
  
  getNoticeLink: function(mod, inner, w) {
    if (!inner) {
      var lt = Bible.getModuleInformation(mod, "NoticeLink");
      if (lt == NOTFOUND) {return "";}
      return "<span class=\"cs-" + mod + " noticelink\">" + lt.replace("<a>", "<a id=\"w" + w + ".noticelink\">") + "</span>";
    }
    else
      return Bible.getModuleInformation(mod, "NoticeText");
  },

  getRefHTML: function(w, mod, id, body, xsid, sepclass) {
    var ref = body.split(";");
    var html = "<div class=\"cs-" + mod + "\">";
    var sep = "";
    for (var i=0; i<ref.length; i++) {
      if (!ref[i]) continue;
      var r = normalizeOsisReference(ref[i], mod);
      if (!r) continue;
      
      var aVerse = findAVerseText(mod, r, w);
      if ((/^\s*$/).test(aVerse.text)) aVerse.text = "-----";
      
      var rmod = Tabs[aVerse.tabNum].modName;
      html += sep;
      html += "<a class=\"crref cs-Program\" id=\"w" + w + "." + id + "l." + xsid + "\" title=\"" + rmod + "." + aVerse.location + "\">";
      html += ref2ProgramLocaleText(aVerse.location);
      html += "</a>";
      html += "<span id=\"w" + w + "." + id + "t." + xsid + "\" title=\"" + rmod + "." + aVerse.location + "\" class=\"crtext cs-" + rmod + "\">";
      html += aVerse.text + (rmod != mod ? " (" + Tab[rmod].label + ")":"");
      html += "</span>";
      
      sep = "<span class=\"crsep" + (sepclass ? " " + sepclass:"") + "\"></span>";
    }
    
    html += "</div>";
    
    return html;
  },
  
  scroll2Note: function(w, id) {
    //jsdump("scrolling to:" + id + "\n");

    //Return previous highlighted note to normal if it can be found
    var oldNoteElem = null;
    try {oldNoteElem = document.getElementById(prefs.getCharPref("SelectedNote"));} catch(e) {}
    if (oldNoteElem != null) {oldNoteElem.className = "normalNote";}
    
    //Now highlight the current note
    var theNote = document.getElementById(id);
    if (!theNote) return;
    
    theNote.className = "selectedNote";
    prefs.setCharPref("SelectedNote", id);
    
    //Now set up the counters such that the note remains highlighted for at least a second
    window.setTimeout("unhilightNote()",1000);

    var nb = document.getElementById("note" + w);
    var note = document.getElementById(id);
    
    Texts.scroll2Element(nb, note, "w" + w + ".maintable.", true, 4);
  },

  hilightUserNotes:function (notes, w) {
    if (!notes) return;
    notes = notes.split("<nx>"); //UserNotes + myid + "<bg>" + note + "<nx>";
    notes.pop();
    for (var i=0; i<notes.length; i++) {
      var n = notes[i].split("<bg>");
      if (n && n[0]) {
        window.setTimeout("BibleTexts.hilightUserNotes2(" + w + ", '" + n[0] + "');", 0);
      }
    }
  },
  
  //after user notes are collected and page is drawn, go add highlight to all usernote verses
  hilightUserNotes2: function(w, id) {
    var verse = id.match(/un\..*?\.([^\.]*\.\d+\.\d+)\.[^\.]+$/);
    if (!verse) return;
    var el = document.getElementById("vs." + verse[1]);
    if (el) el.className += " unverse";
  },
  

  updateAudioLinksTO:null,
  updateAudioLinks: function(w) {
    var icons = document.getElementById("text" + w).getElementsByClassName("listenlink");
    for (var i = 0; i < icons.length; ++i) {
      var icon = icons[i];
//icon.style.visibility = "visible"; continue;
      if (MainWindow.AudioDirs === null) MainWindow.AudioDirs = MainWindow.getAudioDirs();
      if (MainWindow.getAudioForChapter(Texts.display[w].mod, Texts.display[w].bk, Texts.display[w].ch, MainWindow.AudioDirs))
          icon.style.visibility = "visible";
    }
  }

};


////////////////////////////////////////////////////////////////////////
// CommTexts
////////////////////////////////////////////////////////////////////////

var CommTexts = {
  
  read: function(w, d) {
    var ret = { htmlText:"", htmlHead:Texts.getPageLinks(), footnotes:null };

    // For Pin feature, set "global" SWORD options for local context
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      Bible.setGlobalOption(GlobalToggleCommands[cmd], d.globalOptions[GlobalToggleCommands[cmd]]);
    }
    
    // get Commentary chapter's text
    ret.htmlText = Bible.getChapterText(d.mod, d.bk + "." + d.ch + ".1.1");   
    ret.footnotes = Bible.getNotes();
     
    var un;
    if (d.globalOptions["User Notes"] == "On") {
      un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText, w);
      ret.htmlText = un.html; // has user notes added to text
      ret.footnotes += un.notes;
    }
    
    // localize verse numbers
    var tl = getLocaleOfModule(d.mod);
    if (!tl) {tl = getLocale();}
    if (!DisplayNumeral[tl]) getDisplayNumerals(tl);
    if (DisplayNumeral[tl][10]) {
      var verseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
      ret.htmlText = ret.htmlText.replace(verseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});
    }

    // add headers
    var showHeader = (d.globalOptions["Headings"] == "On");
    if (showHeader && ret.htmlText) {
      ret.htmlText = BibleTexts.getChapterHeading(d.bk, d.ch, d.mod, w, false, false) + ret.htmlText;
    }
    
    // put "global" SWORD options back to their global context values
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      Bible.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
    }
    
    return ret;
  }
  
};




////////////////////////////////////////////////////////////////////////
// GenBookTexts
////////////////////////////////////////////////////////////////////////

var GenBookTexts = {
  
  read: function(w, d) {
    var ret = { htmlHead:Texts.getPageLinks(), htmlText:"", footnotes:null };
    // the GenBookKey value always begins with /mod/ so that values can be directly
    // compared to the genbook-tree's resource values.
    ret.htmlText = Bible.getGenBookChapterText(d.mod, d.GenBookKey.replace(/^\/[^\/]+/, ""));
    ret.htmlText = Texts.addParagraphIDs(ret.htmlText);
    
    var un = Texts.getUserNotes("na", 1, d.mod, ret.htmlText, w);
    ret.htmlText = un.html; // has user notes added to text
    ret.footnotes = un.notes;
    
    return ret;
  },
  
  // return information about displayed genBooks
  getGenBookInfo: function() {
    var numUniqueGenBooks = 0;
    var firstGenBook = null;
    var genBookList = "";
    var modsAtRoot = [];
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      if (Tab[prefs.getCharPref("Version" + w)].modType == GENBOOK) {
        var mymodRE = new RegExp("(^|;)(" + escapeRE(prefs.getCharPref("Version" + w)) + ");");
        if (!genBookList.match(mymodRE)) numUniqueGenBooks++;
        else continue;
        // Insure genbook has a showingkey pref!
        var key = getPrefOrCreate("GenBookKey_" + prefs.getCharPref("Version" + w) + "_" + w, "Unicode", "/" + prefs.getCharPref("Version" + w));
        if (key == "/" + prefs.getCharPref("Version" + w)) modsAtRoot.push(prefs.getCharPref("Version" + w));
        if (!firstGenBook) firstGenBook=prefs.getCharPref("Version" + w);
        genBookList += prefs.getCharPref("Version" + w) + ";";
      }
    }
    var ret = {};
    ret.numUniqueGenBooks = numUniqueGenBooks;
    ret.genBookList = genBookList;
    ret.modsAtRoot = modsAtRoot;
    ret.firstGenBook = firstGenBook;
    return ret;
  },

  RDFChecked: {},
  
  // update genBookChooser based on genBook info
  updateGenBookNavigator: function(gbks) {  

    var elem = MainWindow.document.getElementById("genbook-tree");
    var GBs = gbks.genBookList.split(";");
    GBs.pop();
    
    // remove data sources which are being displayed but are no longer needed
    var DSs = elem.database.GetDataSources();
    var needToRebuild=false;
    while (DSs.hasMoreElements()) {
      var myDS = DSs.getNext();
      var mymod = myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+)\.rdf/);
      if (!mymod) continue;
      mymod = mymod[1];
      var keepDS=false;
      for (var i=0; i<GBs.length; i++) {
        if (GBs[i] == mymod) {
          GBs.splice(i, 1);
          keepDS=true;
        }
      }
      if (!keepDS) {
        //jsdump("Removing: " + window.unescape(myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+\.rdf)/)[1]) + "\n");
        elem.database.RemoveDataSource(myDS);
        needToRebuild=true;
      }
    }
    
    // add data sources which are not already being displayed but need to be
    for (i=0; i<GBs.length; i++) {
      needToRebuild=true; 
      var moduleRDF = getSpecialDirectory("xsResD");
      moduleRDF.append(GBs[i] + ".rdf");
      if (!moduleRDF.exists() || !this.RDFChecked[GBs[i]]) writeFile(moduleRDF, Bible.getGenBookTableOfContents(GBs[i]));
      this.RDFChecked[GBs[i]] = true;
    
      var myURI = encodeURI("File://" + moduleRDF.path.replace("\\","/","g"));
      //jsdump("Adding: " + myURI.match(/\/([^\/]+\.rdf)/)[1] + "\n");
      elem.database.AddDataSource(BM.RDF.GetDataSourceBlocking(myURI));
    }
    
    // rebuild the tree if necessary
    if (needToRebuild) {
      if (gbks.numUniqueGenBooks>1)  elem.ref = "rdf:#http://www.xulsword.com/tableofcontents/ContentsRoot";
      if (gbks.numUniqueGenBooks==1) elem.ref = "rdf:#/" + gbks.firstGenBook;
      elem.builder.rebuild();
    }

    if (gbks.numUniqueGenBooks>0 && elem.currentIndex==-1) {
      for (var w=1; w<=NW; w++) {
        if (prefs.getCharPref("Version" + w) != gbks.firstGenBook) continue;
        this.navigatorSelect(getPrefOrCreate("GenBookKey_" + gbks.firstGenBook + "_" + w, "Unicode", "/" + gbks.firstGenBook));
        break;
      }
    }

    //Now that databases are loaded, set any root key prefs
    for (i=0; i<gbks.modsAtRoot.length; i++) {this.setPrefToRoot(gbks.modsAtRoot[i]);}
    
    return gbks.numUniqueGenBooks>0;
  },

  // sets the pref of unpinned GenBooks showing the module to the first chapter
  setPrefToRoot: function(module) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var root = BM.RDF.GetResource("rdf:#" + "/" + module);
    var notFound=false;
    try {var child1 = elem.database.GetTarget(root, BM.RDFCU.IndexToOrdinalResource(1), true);}
    catch (er) {notFound=true;}
    if (!child1 || notFound) {jsdump("Resource " + root.Value + " not found.\n"); return;}
    var chapter = elem.database.GetTarget(child1, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true)
                  .QueryInterface(Components.interfaces.nsIRDFLiteral);
    for (var w=1; w<=NW; w++) {
      if (module != prefs.getCharPref("Version" + w) ||
          prefs.getBoolPref("IsPinned" + w)) continue;
      setUnicodePref("GenBookKey_" + module + "_" + w, chapter.Value.replace("rdf:#",""));
    }
  },
  
  previousChapter: function(key) {
    var previous = null;
    
    var res = this.getResource(key);
    if (!res.node || !res.ds) return null;
    
    var parent = this.getParentOfNode(res.node);
    if (!parent.node || !parent.ds) return null;
 
    // try previous node
    BM.RDFC.Init(parent.ds, parent.node);
    var siblings = BM.RDFC.GetElements();
    if (siblings.hasMoreElements()) {
      var prev = siblings.getNext();
      while (siblings.hasMoreElements()) {
        var next = siblings.getNext();
        if (next == res.node) {
            previous = prev;
            break;
        }
        else prev = next;
      }
    }
    
    // if previous node is a folder, open it and get last child
    if (previous && BM.RDFCU.IsContainer(parent.ds, previous)) {
      BM.RDFC.Init(parent.ds, previous);
      var chldrn = BM.RDFC.GetElements();
      var last = null;
      while(chldrn.hasMoreElements()) {last = chldrn.getNext();}
      if (last) previous = last;
    }
    
    // if there is no previous node, go to parent
    if (!previous) previous = parent.node;
    
    return previous.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, "");
  },
  
  nextChapter: function(key, skipChildren) {
    var next = null;
    
    var res = this.getResource(key);
    if (!res.node || !res.ds) return null;
    
    var parent = this.getParentOfNode(res.node);
 
    // try first child...
    if (!skipChildren && BM.RDFCU.IsContainer(res.ds, res.node)) {
      BM.RDFC.Init(res.ds, res.node);
      var chldrn = BM.RDFC.GetElements();
      if (chldrn.hasMoreElements()) next = chldrn.getNext();
    }

    // or else try next sibling...
    if (!next && parent.node) {
      BM.RDFC.Init(parent.ds, parent.node);
      chldrn = BM.RDFC.GetElements();
      while(chldrn.hasMoreElements()) {
        var child = chldrn.getNext();
        if (child == res.node && chldrn.hasMoreElements()) {
          next = chldrn.getNext();
          break;
        }
      }
    }

    // or else try parent's next sibling...
    if (!next && parent.node) {
      next = this.nextChapter(parent.node.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, ""), true);
    }
    else if (next) next = next.QueryInterface(BM.kRDFRSCIID).Value.replace(/^rdf\:\#/, "");

    return next;
  },
  
  getResource: function(key) {
    // get our resource
    var r = {node:null, ds:null};
    var dss = MainWindow.document.getElementById("genbook-tree").database.GetDataSources();
    GETNODE:
    while (dss.hasMoreElements()) {
      r.ds = dss.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
      var es = r.ds.GetAllResources();
      while (es.hasMoreElements()) {
        var e = es.getNext();
        if (e.QueryInterface(BM.kRDFRSCIID).Value == "rdf:#" + key) {
          r.node = e;
          // if not a container, keep looking. A container resource appears also as description resource.
          if (BM.RDFCU.IsContainer(r.ds, r.node)) break GETNODE;
        }
      }
    }
    
    return r;
  },
  
  getParentOfNode: function(res) {
    var r = {node:null, ds:null};
    
    // get our resource's parent (if there is one)
    var dss = MainWindow.document.getElementById("genbook-tree").database.GetDataSources();
    
    GETPARENT:
    while (dss.hasMoreElements()) {
      r.ds = dss.getNext().QueryInterface(Components.interfaces.nsIRDFDataSource);
      var es = r.ds.GetAllResources();
      while (es.hasMoreElements()) {
        var e = es.getNext();
        if (!BM.RDFCU.IsContainer(r.ds, e)) continue;
        BM.RDFC.Init(r.ds, e);
        var chds = BM.RDFC.GetElements();
        while(chds.hasMoreElements()) {
          var chd = chds.getNext();
          if (chd == res) {
            r.node = e;
            break GETPARENT;
          }
        }
      }
    }
    
    return r;
  },

  isSelectedGenBook: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
    try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
    catch (er) {return false;}
    var chapter = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
    chapter = chapter.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
    
    return key==chapter;
  },
  
  // opens and selects key in GenBook navigator. The selection triggers an update event.
  navigatorSelect: function(key) {
    
    this.openGenBookKey(key);
    
    var elem = MainWindow.document.getElementById("genbook-tree");

    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var selRes = BM.RDF.GetResource("rdf:#" + key);
    try {
      var i = elemTB.getIndexOfResource(selRes);
      elem.view.selection.select(i);
    }
    catch (er) {elem.view.selection.select(0);}    
  },

  //Recursively opens key and scrolls there, but does not select...
  openGenBookKey: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var t = (key + "/").indexOf("/", 1);
    var checkedFirstLevel = false;
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
    
    while (t != -1) {
      var resvalue = "rdf:#" + key.substring(0,t);
      var res = BM.RDF.GetResource(resvalue);
      try {var index = elemTB.getIndexOfResource(res);}
      catch (er) {return;}
      if (index == -1) {
        if (checkedFirstLevel) return;
        checkedFirstLevel=true;
      }
      else {
        if (elemTV.isContainer(index) && !elemTV.isContainerOpen(index)) elemTV.toggleOpenState(index);
      }
      
      t = (key + "/").indexOf("/", t+1); 
    }
    
    this.scrollGenBookTo(key);
  },

  // update corresponding unpinned GenBook prefs according to navigator selection, and update texts.
  onSelectGenBook: function() {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    try {var selRes = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(elem.currentIndex);}
    catch (er) {}
    if (!selRes) return;
   
    var key = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
    key = key.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");

    var mod = key.match(/^\/([^\/]+)/);
    if (!mod)  return;
    mod = mod[1];
    
    for (var w=1; w<=NW; w++) {
      if (prefs.getBoolPref("IsPinned" + w)) continue;
      prefs.setCharPref("GenBookKey_" + mod + "_" + w, key);
      // scroll corresponding genbook to beginning of chapter
      if (prefs.getCharPref("Version" + w) == mod) {
        var t = document.getElementById("text" + w);
        var sb = t.getElementsByClassName("sb")[0];
        sb.scrollLeft = 0;
      }
    }

    Texts.update();

  },

  //NOTE: Does not open row first!
  scrollGenBookTo: function(key) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    
    var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
    
    var res = BM.RDF.GetResource("rdf:#" + key);
    try {var index = elemTB.getIndexOfResource(res);}
    catch (er) {return;}
    
    var parentres = BM.RDF.GetResource("rdf:#" + key.replace(/\/[^\/]+$/,""));
    try {var parentindex = elemTB.getIndexOfResource(parentres);}
    catch (er) {return;}
    
    if (parentindex == -1 || index == -1) return;
    window.setTimeout("GenBookTexts.scrollTreeNow(" + parentindex + ", " + index + ")", 0);
  },

  scrollTreeNow: function(pi, i) {
    var elem = MainWindow.document.getElementById("genbook-tree");
    //elem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).scrollToRow(pi);
    elem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(i);
  },
  
  scrollDelta: function(w, delta) {
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    sb.scrollLeft += Number(delta);
  }

};


////////////////////////////////////////////////////////////////////////
// DictTexts
////////////////////////////////////////////////////////////////////////

var DictTexts = {
  keyList: [null, {}, {}, {}],
  keysHTML: [null, {}, {}, {}],
  
  read: function(w, d) {
    var ret = { htmlList:"", htmlHead:Texts.getPageLinks(), htmlEntry:"", footnotes:null };
    
    // get key list (is cached)
    if (!this.keyList[w][d.mod]) {
      this.keyList[w][d.mod] = Bible.getAllDictionaryKeys(d.mod).split("<nx>");
      this.keyList[w][d.mod].pop();
      this.sortOrder = Bible.getModuleInformation(d.mod, "LangSortOrder");
      if (this.sortOrder != NOTFOUND) {
        this.sortOrder += "0123456789";
        this.langSortSkipChars = Bible.getModuleInformation(d.mod, "LangSortSkipChars");
        if (this.langSortSkipChars == NOTFOUND) this.langSortSkipChars = "";
        this.keyList[w][d.mod].sort(this.dictSort);
      }
    }
    
    // get html for list of keys (is cached)
    if (!this.keysHTML[w][d.mod]) {
      this.keysHTML[w][d.mod] = this.getListHTML(this.keyList[w][d.mod], d.mod, w);
    }
    ret.htmlList = this.keysHTML[w][d.mod];

    // get actual key
    if (d.DictKey == "<none>") d.DictKey = this.keyList[w][d.mod][0];
    if (d.DictKey == "DailyDevotionToday") {
      var today = new Date();
      d.DictKey = (today.getMonth()<9 ? "0":"") + String(today.getMonth()+1) + "." + (today.getDate()<10 ? "0":"") + today.getDate();
    }
    
    // get htmlEntry
    var de = this.getEntryHTML(d.DictKey, d.mod);
    de = Texts.addParagraphIDs(de);
    var un = Texts.getUserNotes("na", d.DictKey, d.mod, de, w);
    de = un.html; // has user notes added to text
    ret.footnotes = un.notes;
    
    ret.htmlEntry += "<div class=\"dictentry\">";
    ret.htmlEntry +=  "<div>" + de + "</div>";
    ret.htmlEntry += "</div>";
  
    ret.key = d.DictKey;
  
    return ret;
  },
  
  getListHTML: function(list, mod, w) {
    var html = "";
    html += "<div class=\"dictlist\">"
    html +=   "<div class=\"textboxparent\" id=\"w" + w + ".textboxparent\">";
    html +=     "<input id=\"w" + w + ".keytextbox\" class=\"cs-" + mod + "\" onfocus=\"this.select()\" ondblclick=\"this.select()\" ";
    html +=     "onkeypress=\"DictTexts.keyPress('" + mod + "', " + w + ", event)\" />";
    html +=   "</div>";
    html +=   "<div class=\"keylist\" id=\"w" + w + ".keylist\" onclick=\"DictTexts.selKey('" + mod + "', " + w + ", event)\">";
    for (var e=0; e < list.length; e++) {
      html += "<div class=\"key\" id=\"w" + w + "." + encodeUTF8(list[e]) + "\" >" + list[e] + "</div>";
    }
    html +=   "</div>";
    html += "</div>";

    return html;
  },
  
  getEntryHTML: function(key, mods, dontAddParagraphIDs) {
    if (!key || !mods) return "";
    key = this.decodeOSISRef(key);
    
    mods += ";";
    mods = mods.split(";");
    mods.pop();
    
    var html = "";
    if (mods.length == 1) {
      try {html = Bible.getDictionaryEntry(mods[0], key);}
      catch (er) {html = "";}
    }
    else if (mods.length > 1) {
      for (var dw=0; dw<mods.length; dw++) {
        var dictEntry="";
        try {dictEntry = Bible.getDictionaryEntry(mods[dw], key);}
        catch (er) {dictEntry = "";}
        if (dictEntry) {
          dictEntry = dictEntry.replace(/^(<br>)+/,"");
          var dictTitle = Bible.getModuleInformation(mods[dw], "Description");
          dictTitle = (dictTitle != NOTFOUND ? "<b>" + dictTitle + "</b><br>":"");
          html += "<br><br>" + dictTitle + dictEntry;
        }
      }
    }
    
    if (!html) return "";

    html = "<b>" + key + ":</b> " + html + "<br>";
    if (!dontAddParagraphIDs) html = Texts.addParagraphIDs(html);
    return html;
  },
  
  decodeOSISRef: function(aRef) {
    var re = new RegExp(/_(\d+)_/);
    var m = aRef.match(re);
    while(m) {
      var r = String.fromCharCode(Number(m[1]));
      aRef = aRef.replace(m[0], r, "g");
      m = aRef.match(re);
    }
    return aRef;
  },
  
  sortOrder:"",
  langSortSkipChars:"",
  dictSort: function(a,b) {
    var xa=0;
    var xb=0;
    var ca = a.charAt(xa);
    while (ca && DictTexts.langSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
    var cb = b.charAt(xb);
    while (cb && DictTexts.langSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
    while (ca || cb) {
      if (!ca) return -1;
      if (!cb) return 1;
      if (DictTexts.sortOrder.indexOf(ca) < DictTexts.sortOrder.indexOf(cb)) return -1;
      if (DictTexts.sortOrder.indexOf(ca) > DictTexts.sortOrder.indexOf(cb)) return 1;
      ca = a.charAt(++xa);
      while (ca && DictTexts.langSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
      cb = b.charAt(++xb);
      while (cb && DictTexts.langSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
    }
    return 0;
  },
  
  // Builds HTML text which displays lemma information from numberList
  //    numberList form: (S|WT|SM|RM):(G|H)#
  getLemmaHTML: function(numberList, matchingPhrase) {
  //dump ("numberList:" + numberList + "\n");
    const pad="00000";
    var styleModule = "Program";
    var defaultBibleLanguage = Bible.getModuleInformation(prefs.getCharPref("DefaultVersion"), "Lang");
    if (defaultBibleLanguage == NOTFOUND) defaultBibleLanguage="";
    var defaultBibleLangBase = (defaultBibleLanguage ? defaultBibleLanguage.replace(/-.*$/, ""):"");
    var html = "<b>" + matchingPhrase + "</b><br>";
    var sep = "";
    for (var i=0; i<numberList.length; i++) {
      var parts = numberList[i].split(":");
      if (!parts || !parts[1]) continue;
      var module = null;
      var key = parts[1];
      key = key.replace(" ", "", "g");
      var saveKey = key;
      switch (parts[0]) {
      case "S":
        if (key.charAt(0)=="H") {
          if (LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage])
            module = LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage];
          else if (LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase])
            module = LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase];
          else if (LanguageStudyModules["StrongsHebrew"])
            module = LanguageStudyModules["StrongsHebrew"];
        }
        else if (key.charAt(0)=="G") {
          if (Number(key.substr(1)) >= 5627) continue; // SWORD filters these out- not valid it says
          if (LanguageStudyModules["StrongsGreek" + defaultBibleLanguage])
            module = LanguageStudyModules["StrongsGreek" + defaultBibleLanguage];
          else if (LanguageStudyModules["StrongsGreek" + defaultBibleLangBase])
            module = LanguageStudyModules["StrongsGreek" + defaultBibleLangBase];
          else if (LanguageStudyModules["StrongsGreek"])
            module = LanguageStudyModules["StrongsGreek"];
        }
        key = pad.substr(0,5-(key.length-1)) + key.substr(1);
        break;
      case "RM":
        if (LanguageStudyModules["GreekParse" + defaultBibleLanguage])
          module = LanguageStudyModules["GreekParse" + defaultBibleLanguage];
        else if (LanguageStudyModules["GreekParse" + defaultBibleLangBase])
          module = LanguageStudyModules["GreekParse" + defaultBibleLangBase];
        else if (LanguageStudyModules["GreekParse"])
          module = LanguageStudyModules["GreekParse"];
        break;
      case "SM":
        saveKey = "SM" + key;
        break;
      case "WT":
        saveKey = "WT" + key;
        break;     
      }
      if (module) {
        if (styleModule == "Program") styleModule = module;
        if (key == pad) continue; // G tags with no number
        var entry = Bible.getDictionaryEntry(module, key);
        if (entry) html += sep + entry;
        else html += sep + key;
      }
      else html += sep + saveKey;
      sep = "<hr>";
      if (html && module)
    }
    return html;
  },

  //The timeout below was necessary so that textbox.value included the pressed key...
  keypressOT:null,
  keyPress: function(mod, w, e) {
    if (this.keypressOT) window.clearTimeout(this.keypressOT);
    this.keypressOT = window.setTimeout("DictTexts.keyPressR('" + mod + "', " + w + ", " + e.which + ")", 1000);
  },

  keyPressR: function(mod, w, charCode) {
    var textbox = document.getElementById("w" + w + ".keytextbox");
    var text = textbox.value;
    if (!text) {
      textbox.style.color="";
      return;
    }
    
    var matchtext = new RegExp("(^|<nx>)(" + escapeRE(text) + "[^<]*)<nx>", "i");
    var firstMatch = (DictTexts.keyList[w][mod].join("<nx>") + "<nx>").match(matchtext);
    if (!firstMatch) {
      if (charCode!=8) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      textbox.style.color="red";
    }
    else {
      textbox.style.color="";
      setUnicodePref("DictKey_" + mod + "_" + w, firstMatch[2]);
      Texts.updateDictionary(w);
    }
  },

  selKey: function (mod, w, e) {
    if (!e.target.id || (e.target.id && (/^w\d\.keylist$/).test(e.target.id))) return;
    setUnicodePref("DictKey_" + mod + "_" + w, decodeUTF8(e.target.id.substr(3)));
    Texts.updateDictionary(w);
    window.setTimeout("document.getElementById('w" + w + ".keytextbox').focus()", 1);
  }

};

// Make sure MainWindow has access to our objects
if (MainWindow) {
  if (typeof(MainWindow.Texts) == "undefined") MainWindow.Texts = Texts;
  if (typeof(MainWindow.BibleTexts) == "undefined") MainWindow.BibleTexts = BibleTexts;
  if (typeof(MainWindow.DictTexts) == "undefined") MainWindow.DictTexts = DictTexts;
  if (typeof(MainWindow.CommTexts) == "undefined") MainWindow.CommTexts = CommTexts;
  if (typeof(MainWindow.GenBookTexts) == "undefined") MainWindow.GenBookTexts = GenBookTexts;
}
