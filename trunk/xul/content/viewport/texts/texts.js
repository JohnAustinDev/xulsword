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

Texts = {
  
  scrollTypeFlag:null,
  hilightFlag:null,
  scrollDelta:null,
  
  display:[null, null, null, null],
  
  pinnedDisplay:[null, null, null, null],
  
  footnotes:[null, null, null, null],

  // The force parameter is an array of values, one for each window, 
  // beginning with index 1 (0 is null). Each value has the following
  // possibilities:
  // -1 means don't update
  // 0 means update if a watched value has changed
  // 1 means update always
  update: function(scrollTypeFlag, hilightFlag, force) {
    var save = { p1:scrollTypeFlag, p2:hilightFlag, p3:force };

    if (scrollTypeFlag === undefined) scrollTypeFlag = SCROLLTYPEPREVIOUS;
    if (hilightFlag === undefined) hilightFlag = HILIGHTPREVIOUS;
    if (force === undefined) force = [null, 0, 0, 0];
    
    if (scrollTypeFlag == SCROLLTYPEPREVIOUS) scrollTypeFlag = this.scrollTypeFlag;
    else {this.scrollTypeFlag = scrollTypeFlag;}
    
    if (hilightFlag == HILIGHTPREVIOUS) hilightFlag = this.hilightFlag;
    else {this.hilightFlag = hilightFlag;}
    
//jsdump("scrollTypeFlag=" + scrollTypeFlag + ", hilightFlag=" + hilightFlag + ", force=" + force);
   
    if (this.scrollTypeFlag == SCROLLTYPETOP) Location.setVerse(prefs.getCharPref("DefaultVersion"), 1, 1);
    
    Popup.close();
    
    ViewPort.update(false, force);
    
    for (var w=1; w<=NW; w++) {
      
      if (document.getElementById("text" + w).getAttribute("columns") == "hide") continue;
      if (document.getElementById("text" + w).style.display == "none") continue; // used in windowed viewports
      if (w > ViewPort.NumDisplayedWindows) continue;
      if (force[w] == -1) continue;
   
      switch(Tab[ViewPort.Module[w]].modType) {
        
      case BIBLE:
        this.updateBible(w, force[w]);
        break;
        
      case COMMENTARY:
        this.updateCommentary(w, force[w]);
        break;
      
      case DICTIONARY:
        this.updateDictionary(w, force[w]);
        break;
        
      case GENBOOK:
        this.updateGenBook(w, force[w]);
        break;
        
      }
      
      this.pinnedDisplay[w] = copyObj(this.display[w]);
    }
    
    // If scrollTypeFlag is SCROLLTYPEENDSELECT, then the selection has been changed to the
    // the first visible verse. To maintain subsequent SCROLLTYPEPREVIOUS functionality, we
    // need to also change our current scrollTypeFlag to SCROLLTYPEBEG
    if (this.scrollTypeFlag == SCROLLTYPEENDSELECT) this.scrollTypeFlag = SCROLLTYPEBEG;
    
    // If this is the MainWindow.Text object that we're updating, then go and update any
    // other viewport.xul Text objects as well.
    if (this === MainWindow.Texts) {
      for (var w=0; w<MainWindow.AllWindows.length; w++) {
        if (!(/^viewport/).test(MainWindow.AllWindows[w].name)) continue;
        MainWindow.AllWindows[w].Texts.update(save.p1, save.p2, save.p3);
      }
      
      MainWindow.updateNavigator();
    
      MainWindow.document.getElementById("cmd_xs_startHistoryTimer").doCommand();
    
    }

  },
  
  updateBible: function(w, force) {
    
    var scrollTypeFlag = this.scrollTypeFlag;
    var hilightFlag = this.hilightFlag;
    var loc = Location.getLocation(ViewPort.Module[w]);
    
    // get current display params
    var display = this.getDisplay(ViewPort.Module[w], loc, w);
    
    // overwrite display and location with any pinned values
    if (!this.pinnedDisplay[w]) ViewPort.IsPinned[w] = false;
    if (ViewPort.IsPinned[w]) {
      // then keep pinned params (which could have been changed since last display)
      display.mod = this.pinnedDisplay[w].mod;
      display.bk  = this.pinnedDisplay[w].bk;
      display.ch  = this.pinnedDisplay[w].ch;
      display.vs  = this.pinnedDisplay[w].vs;
      loc = display.bk + "." + display.ch + "." + display.vs;
      hilightFlag = HILIGHTNONE;
    }
  
    var t = document.getElementById("text" + w);
    var ltr = (ModuleConfigs[display.mod].direction == "ltr");
    var sb = t.getElementsByClassName("sb")[0];

    // don't read new text if the results will be identical to the last displayed text
    var textUpdated = false;
    var check = ["mod", "bk", "ch", "globalOptions", "ShowOriginal", "ShowFootnotesAtBottom", 
                "ShowCrossrefsAtBottom", "ShowUserNotesAtBottom", "columns"];
                
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      textUpdated = true;
//jsdump("Reading text from libsword w" + w);
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
//jsdump("reading w" + w + ": " + c);
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          if (tip.htmlText.length <= 32) break; // stop if chapter is missing
          prev.htmlText = tip.htmlText + prev.htmlText;
          prev.htmlNotes = tip.htmlNotes + prev.htmlNotes;
          prev.footnotes = tip.footnotes + prev.footnotes;
          sb.innerHTML = prev.htmlText;
          if ( (ltr && sb.lastChild.offsetLeft >= sb.offsetWidth) || 
               (!ltr && sb.firstChild.offsetLeft >= sb.offsetWidth) ) break;
          c--;
        }
      
        // collect next chapter(s)
        var c = Number(display.ch) + 1;
        while (c <= LibSword.getMaxChapter(d2.mod, d2.bk + "." + d2.ch)) {
//jsdump("reading w" + w + ": " + c);
          d2.ch = c;
          var tip = BibleTexts.read(w, d2);
          if (tip.htmlText.length <= 32) break; // stop if chapter is missing
          next.htmlText = next.htmlText + tip.htmlText;
          next.htmlNotes = next.htmlNotes + tip.htmlNotes;
          next.footnotes = next.footnotes + tip.footnotes;
          sb.innerHTML = next.htmlText;
          if ( (ltr && sb.lastChild.offsetLeft >= sb.offsetWidth) || 
               (!ltr && sb.firstChild.offsetLeft >= sb.offsetWidth) ) break;
          c++;
        }
        
      }
//jsdump("reading w" + w + ": " + display.ch);     
      var ti = BibleTexts.read(w, display);
        
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;
      sb.innerHTML = prev.htmlText + (ti.htmlText.length > 64 ? ti.htmlText:"") + next.htmlText;

      var nb = t.getElementsByClassName("nb")[0];
      this.footnotes[w] = prev.footnotes + ti.footnotes + next.footnotes;
      nb.innerHTML = prev.htmlNotes + ti.htmlNotes + next.htmlNotes;
    }
    
    if (textUpdated || this.isChanged(['vs', 'scrollTypeFlag'], display, this.display[w])) {
      // handle scroll
      this.scroll2Verse(w, loc, scrollTypeFlag);
      
      // handle highlights
      this.hilightVerses(w, loc, hilightFlag);
      
      // remove notes which aren't in window, or hide notebox entirely if empty
      t.setAttribute("footnotesEmpty", !BibleTexts.checkNoteBox(w))
    }
    
    // set audio icons
    window.setTimeout("BibleTexts.updateAudioLinks(" + w + ");", 0);
  
    // save display objects for this window
    this.display[w] = copyObj(display);
    
  },
  
  updateCommentary: function(w, force) {
    
    var scrollTypeFlag = this.scrollTypeFlag;
    var hilightFlag = this.hilightFlag;
    var loc = Location.getLocation(ViewPort.Module[w]);
        
    // get current display params
    var display = this.getDisplay(ViewPort.Module[w], loc, w);
    
    // overwrite display and loc with any pinned values
    if (!this.pinnedDisplay[w]) ViewPort.IsPinned[w] = false;
    if (ViewPort.IsPinned[w]) {
      // then keep pinned params (which could have been changed since last display)
      display.mod = this.pinnedDisplay[w].mod;
      display.bk  = this.pinnedDisplay[w].bk;
      display.ch  = this.pinnedDisplay[w].ch;
      display.vs  = this.pinnedDisplay[w].vs;
      loc = display.bk + "." + display.ch + "." + display.vs;
      hilightFlag = HILIGHTNONE;
    }

    // don't read new text if the results will be identical to last displayed text
    var textUpdated = false;
    var check = ["mod", "bk", "ch", "globalOptions"];
     
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      textUpdated = true;
      var ti = CommTexts.read(w, display);

      this.footnotes[w] = ti.footnotes;

      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;
      sb.innerHTML = (ti.htmlText.length > 64 ? ti.htmlText:"");
    }
    
    if (textUpdated || this.isChanged(['vs', 'scrollTypeFlag'], display, this.display[w])) {
      // handle scroll
      this.scroll2Verse(w, loc, scrollTypeFlag);
      
      // handle highlights
      this.hilightVerses(w, loc, hilightFlag);
    }
  
    // save display object for this window
    this.display[w] = copyObj(display);
      
  },
  
  updateGenBook: function(w, force) {

    ViewPort.ShowOriginal[w] = false;
    ViewPort.MaximizeNoteBox[w] = false;
    
    var t =  document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    
    // get current display params
    var display = this.getDisplay(ViewPort.Module[w], Location.getLocation(ViewPort.Module[w]), w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "Key", "globalOptions"];
    
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = GenBookTexts.read(w, display);
     
      this.footnotes[w] = ti.footnotes;
      
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;
      sb.innerHTML = ti.htmlText;
      
      // insure navigator shows correct chapter (even though this will 
      // sometimes initiate a second call to Text.update)
      GenBookTexts.navigatorSelect(display.Key);
    }
    
    // handle scroll
    if (this.scrollTypeFlag != SCROLLTYPENONE) {
      if (this.scrollTypeFlag == SCROLLTYPEDELTA) GenBookTexts.scrollDelta(w, this.scrollDelta);
      else {
        sb.scrollTop = 0;
        sb.scrollLeft = 0;
      }
    }
      
    // save display object for this window
    this.display[w] = copyObj(display);

  },
  
  updateDictionary: function(w, force) {

    ViewPort.IsPinned[w] = false;
    ViewPort.ShowOriginal[w] = false;
    ViewPort.MaximizeNoteBox[w] = false;
    
    var t =  document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    
    // get current display params
    var display = this.getDisplay(ViewPort.Module[w], Location.getLocation(ViewPort.Module[w]), w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "Key", "globalOptions"];
    
    if (force || !this.display[w] || this.isChanged(check, display, this.display[w])) {
      var ti = DictTexts.read(w, display);
      
      this.footnotes[w] = ti.footnotes;
      
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      sb.className = sb.className.replace(/\s*cs\-\S+/, "") + " cs-" + display.mod;
      sb.innerHTML = ti.htmlEntry;
      
      var nb = t.getElementsByClassName("nb")[0];
      nb.innerHTML = ti.htmlList;
    
      // highlight the selected key
      var k = document.getElementById("note" + w).getElementsByClassName("dictselectkey");
      while (k.length) {k[0].className = "";}
      k = document.getElementById("w" + w + "." + encodeUTF8(display.Key));
      if (k) {
        k.className = "dictselectkey";
        k.scrollIntoView();
        document.getElementById("viewportbody").scrollTop = 0;
      }
      
      document.getElementById("w" + w + ".keytextbox").value = display.Key;
      ViewPort.Key[w] = display.Key;
      
    }
    
    // handle scroll
    if (this.scrollTypeFlag != SCROLLTYPENONE) {
      sb.scrollTop = 0;
      sb.scrollLeft = 0;
    }
  
    // save display object for this window
    this.display[w] = copyObj(display);
  },


  //////////////////////////////////////////////////////////////////////
  // Texts Utility functions
  //////////////////////////////////////////////////////////////////////

  // Dynamically resize the chapter heading, starting from stylesheet's value
  //var chaptitle = sb.getElementsByClassName("chaptitle")[0];
  //Texts.fitHTML(chaptitle, sb.offsetWidth/2, this.ChapTitleFontSize);
  //ChapTitleFontSize: getCSS(".chaptitle {").style.fontSize.match(/([\-\d]+)px/)[1],
  
  // Adjusts font-size of passed HTML element,
  // stopping at given overall offset width.
  fitHTML: function(elem, w, maxfs) {
    var fs = (maxfs ? maxfs:20);
    elem.style.fontSize = fs + "px";
//jsdump("A-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    while (fs > 8 && elem.offsetWidth > w) {
      fs -= 2;
      elem.style.fontSize = fs + "px";
//jsdump("B-" + w + ":" + fs + ", " + elem.offsetWidth + ", " + w);
    }
  
  },

  getPageLinks: function() {
    var config = LocaleConfigs[getLocale()];
    var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
    var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));

    var html = "";
    html += "<div class=\"navlink\">";
    html +=   "&lrm;<span class=\"navlink-span\">" + charPrev + "</span> " + "<a class=\"prevchaplink\">" + SBundle.getString('PrevChaptext') + "</a>";
    html +=   " / ";
    html +=   "<a class=\"nextchaplink\">&lrm;" + SBundle.getString('NextChaptext') + "</a>" + " <span class=\"navlink-span\">" + charNext + "</span>";
    html += "</div>";
    
    return html;
  },
  
  getUserNotes: function(bk, ch, mod, text) {
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
        if (chapter != ch) continue;
        book = "na";
        chapter = "1";
      }
      try {var verse = BMDS.GetTarget(res, BM.gBmProperties[VERSE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (!BookmarkFuns.isItemChildOf(res, BM.AllBookmarksRes, BMDS)) continue;
       
      // We have a keeper, lets save the note and show it in the text!
      // Encode ID
      var encodedResVal = encodeUTF8(res.QueryInterface(BM.kRDFRSCIID).Value);
      var newNoteHTML = "<span class=\"un\" title=\"" + encodedResVal + "." + bk + "." + ch + "." + verse + "." + mod + "\" ></span>";
      
      // if this is a selected verse, place usernote inside the hilighted element (more like regular notes)
      var re = new RegExp("(title=\"" + (usesVerseKey ? bk + "." + ch + ".":"") + verse + "." + mod + "\" class=\"(vs|par))([^>]*>)(\\s*<span.*?>)?", "im");
      usernotes.html = usernotes.html.replace(re, "$1 un-hilight$3$4" + newNoteHTML);
      usernotes.notes += "<div class=\"nlist\" title=\"un." + encodedResVal + "." + bk + "." + ch + "." + verse + "." + mod + "\">" + note + "</div>";
    }
    
    return usernotes;
  },
  
  getScriptureReferences: function(scripRefList, mod) {
    
    // Split up data into individual passages
    scripRefList += ";"
    var mdata = scripRefList.split(";");
    mdata.pop();

    // If subreferences exist which are separated by "," then split them out as well
    for (var i=0; i<mdata.length; i++) {
      var verses = mdata[i].split(",");
      if (verses.length == 1) continue;
      var r = 1;
      for (var v=0; v<verses.length; v++) {
        mdata.splice(i+1-r, r, verses[v]);
        i++;
        i -= r;
        r = 0;
      }
    }

    // Parse each reference into a normalized reference in a list
    var reflist = "";
    var failhtml = "";
    
    var book = Location.getBookName();
    var chapter = Location.getChapterNumber(mod);
    var verse = 1;
    
    for (i=0; i<mdata.length; i++) {
      var failed = false;
      var saveref = mdata[i];

      mdata[i] = normalizeOsisReference(mdata[i], mod);

      if (!mdata[i]) {
        var thisloc = parseLocation(saveref);
        if (thisloc) {
          book = thisloc.shortName ? thisloc.shortName:book;
          chapter = thisloc.chapter ? thisloc.chapter:chapter;
          verse = thisloc.verse ? thisloc.verse:verse;
          mdata[i] = book + "." + chapter + "." + verse;
          if (thisloc.lastVerse) {mdata[i] += "-" + book + "." + chapter + "." + thisloc.lastVerse;}
          mdata[i] = normalizeOsisReference(mdata[i], mod);
          if (!mdata[i]) failed = true;
        }
        else failed = true;
      }
      if (failed) {
        book = null;
        chapter = null;
        verse = null;
        //failhtml += "<hr>" + saveref + ": <b>????</b><br>";
        continue;
      }

      reflist += mdata[i] + ";";
    }
    
    return reflist;
  },
 
  getDisplay: function(mod, loc, w) {
    loc = loc.split(".");
    var display = {globalOptions:{}};
    display.mod = mod;
    display.bk = loc[0];
    display.ch = Number((loc[1] ? loc[1]:1));
    display.vs = Number((loc[2] ? loc[2]:1));
    display.lv = Number((loc[3] ? loc[3]:1));
    display.scrollTypeFlag = this.scrollTypeFlag;
    display.Key = ViewPort.Key[w];
    display.ShowOriginal = ViewPort.ShowOriginal[w];
    display.MaximizeNoteBox = ViewPort.MaximizeNoteBox[w];
    display.ShowFootnotesAtBottom = getPrefOrCreate("ShowFootnotesAtBottom", "Bool", true);
    display.ShowCrossrefsAtBottom = getPrefOrCreate("ShowCrossrefsAtBottom", "Bool", false);
    display.ShowUserNotesAtBottom = getPrefOrCreate("ShowUserNotesAtBottom", "Bool", true);
    var c = document.getElementById("text" + w);
    display.columns = (c ? c.getAttribute("columns"):null);

    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") 
        display.globalOptions[GlobalToggleCommands[cmd]] = prefs.getCharPref(GlobalToggleCommands[cmd]);
      else display.globalOptions[GlobalToggleCommands[cmd]] = LibSword.getGlobalOption(GlobalToggleCommands[cmd]);
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
//jsdump("SCROLLING w=" + w + ", l=" + l +", type=" + scrollTypeFlag);    
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var mod = ViewPort.Module[w];
    
    l = l.split(".");
    var bk = l[0];
    var ch = (l[1] ? Number(l[1]):1);
    var vs = (l[2] ? Number(l[2]):1);
    var lv = (l[3] ? Number(l[3]):l[2]);
    
    // find the element to scroll to
    var av = sb.firstChild;
    var v = null;
    var vf = null;
    while (av && !v) {
      var p = getElementInfo(av);
      if (p && p.type == "vs") {
        if (!vf && p.bk == bk && p.ch == ch) vf = av;
          
        if (p.bk == bk && p.ch == ch && p.vs == vs) v = av;
      }
      av = av.nextSibling;
    }
    
    // if not found, use first verse in current chapter
    if (!v) v = vf;
  
    // if neither verse nor chapter has been found, return false
    if (!v) return false;

    // perform appropriate scroll action
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
    if (vs == 1 && (scrollTypeFlag == SCROLLTYPEBEG || scrollTypeFlag == SCROLLTYPECENTER)) {
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
        if (vs != 1 && ((vOffsetTop + v.offsetHeight) > (sb.scrollTop + sb.offsetHeight) || vOffsetTop < sb.scrollTop)) {
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
        while(vs) {
          var p = getElementInfo(vs);
          if (p && p.type == "vs" && p.ch == (ch-1)) show = false;
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
            var p = getElementInfo(vs);
            var isverse = (p && p.type == "vs");
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
        var ltr = (ModuleConfigs[mod].direction == "ltr");
        var rtl_pageOffsetLeft;
        var tv = sb.firstChild;
        if(!ltr && tv) {
          rtl_pageOffsetLeft= tv.offsetLeft + tv.offsetWidth - sb.offsetWidth;
        }
        if (vs == 1 || (v.style.display != "none" && 
            ( (ltr && v.offsetLeft < sb.offsetWidth) || 
              (!ltr && v.offsetLeft >= rtl_pageOffsetLeft) ))) break;
      case SCROLLTYPECENTERALWAYS: // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
        // hide all elements before verse
        var vs = sb.firstChild;
        var show = false;
        while (vs) {
          if (vs === v) show = true;
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
              ((v.offsetLeft > sb.offsetWidth-(1.5*nb.offsetWidth)) && 
              v.offsetTop+v.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight)) {
          vs.style.display = "none";
          vs = vs.nextSibling;
        }
        
        if (scrollTypeFlag == SCROLLTYPEENDSELECT) {
          var vs = sb.firstChild;
          while(vs) {
            var p = getElementInfo(vs);
            if (p && p.type == "vs" && vs.style.display != "none") {
              Location.setLocation(p.mod, p.bk + "." + p.ch + "." + p.vs);
              break;
            }
            vs = vs.nextSibling;
          }
        }
    
        break;
      case SCROLLTYPECUSTOM:       // scroll by running CustomScrollFunction
        break;    
      }
    }
  
    return true;
  },
  
  hilightVerses: function(w, l, hilightFlag) {
    if (!l || hilightFlag == HILIGHTSKIP) return;
    
    if (Tab[ViewPort.Module[w]].modType == COMMENTARY) hilightFlag = HILIGHTNONE;
 
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var mod = ViewPort.Module[w];
    
    l = l.split(".");
    var bk = l[0];
    var ch = (l[1] ? Number(l[1]):1);
    var vs = (l[2] ? Number(l[2]):1);
    var lv = (l[3] ? Number(l[3]):l[2]);
  
    // unhilight everything
    var hl = sb.getElementsByClassName("hl");
    while (hl.length) {hl[0].className = hl[0].className.replace(/\s?hl/, "");}
  
    // find the verse element(s) to hilight
    var av = sb.firstChild;
    while (av) {
      var v = getElementInfo(av);
      if (v && v.type == "vs") {
        var hi = (v.bk == bk && v.ch == ch);
        if (hilightFlag == HILIGHTNONE) hi = false;
        if (hilightFlag == HILIGHT_IFNOTV1 && 
            (vs == 1 || v.vs < vs || v.vs > lv)) hi = false;
        if (hilightFlag == HILIGHTVERSE && 
            (v.vs < vs || v.vs > lv)) hi = false;
     
        if (hi) av.className = (av.className ? av.className + " hl":"hl");
        
      }
      
      av = av.nextSibling;
    }
    
  },

  
////////////////////////////////////////////////////////////////////////
// Paragraphs

// The behaviour of these functions should not be changed, to maintain 
// compatibility of bookmarks.
  addParagraphIDs: function(text, mod) {
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
      text = "<div title=\"1." + mod + "\" class=\"par\">" + text;
      p++;
      r = text.indexOf(myParType);
      while (r != -1) {
        var ins = myParType + "</div><div title=\"" + p++ + "." + mod + "\" class=\"par\">";
        text = text.substring(0, r) + ins + text.substring(r + myParType.length);
        r = text.indexOf(myParType, r+ins.length);
      }
      text += "</div>";
    }
    else {
      while (r != -1) {
        ins = " title=\"" + p++ + "." + mod + "\" class=\"par\"";
        r += 2;
        text = text.substring(0, r) + ins + text.substr(r);
        r = text.indexOf(myParType, r+ins.length);
      }
    }

    return text;
  },

  getParagraphWithID: function (p, text, mod) {
    if (p==null || !text) return text;
    var origtext = text;
    var ins = "title=\"" + p + "." + mod + "\" class=\"par";
    var s = text.indexOf(ins);
  //jsdump("Looking for:" + ins + "\n" + p + " " + s + "\norigtext:" + origtext.substr(0,128) + "\n");
    if (s == -1) return -1;
    s = text.indexOf(">", s) + 1;
    
    p++;
    ins = "title=\"" + p + "." + mod + "\" class=\"par";
    var e = text.indexOf(ins, s);
    if (e == -1) e = text.length;
    else {e = text.lastIndexOf("<", e);}
    text = text.substring(s, e);
    text = this.HTML2text(text);

    return text;
  },

  getParagraphWithIDTry: function(p, text, mod) {
    var par = this.getParagraphWithID(p, text, mod);
    if (par == -1) {
      for (var tp=1; tp<=4; tp++) {
        par = this.getParagraphWithID(tp, text, mod);
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

