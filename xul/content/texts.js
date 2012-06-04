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
  highlightFlag:null,
  
  showNoteBox:[false, false, false, false],
  
  display:[null, null, null, null],
  
  footnotes:[null, null, null, null],

  update: function(scrollTypeFlag, highlightFlag, force) {
    if (scrollTypeFlag === null) scrollTypeFlag = SCROLLTYPETOP;
    if (highlightFlag === null) highlightFlag = HILIGHTNONE;
    if (force === null) force = false;
    
    this.scrollTypeFlag = scrollTypeFlag;
    this.highlightFlag = highlightFlag;

    if (this.scrollTypeFlag == SCROLLTYPETOP) Location.setVerse(mod, 1, 1);

    for (var w=1; w<=NW; w++) {

      switch(Tab[prefs.getCharPref("Version" + w)].modType) {
        
      case BIBLE:
        this.updateBible(w);
        break;
        
      case COMMENTARY:
        this.updateCommentary(w);
        break;
      
      case DICTIONARY:
        this.updateDictionary(w);
        break;
        
      case GENBOOK:
        this.updateGenBook(w);
        break;
        
      }
    }
    
    updateCSSBasedOnVersion(firstDisplayBible(false), [".chapsubtable"]);
    
    MainWindow.document.getElementById("cmd_xs_startHistoryTimer").doCommand();
    
    MainWindow.goUpdateTargetLocation();
    
    MainWindow.updateNavigator();
    
    updateViewPort(false);
  },
  
  updateBible: function(w, force) {
    var lastDisp = (this.display[w] ? copyObj(this.display[w]):null);
    
    if (!this.display[w] || !getPrefOrCreate("IsPinned" + w, "Bool", false)) 
        this.display[w] = this.getDisplay(prefs.getCharPref("Version" + w), Location, w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "bk", "ch", "globalOptions", "IsPinned", "ShowOriginal", "ShowFootnotesAtBottom", 
                "ShowCrossrefsAtBottom", "ShowUserNotesAtBottom"];
                
    if (force || !lastDisp || this.isChanged(check, this.display[w], lastDisp)) {
      var ti = BibleTexts.read(w, this.display[w]);

      this.footnotes[w] = ti.footnotes;

      var t = document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = ti.htmlText;
      
      var nb = t.getElementsByClassName("nb")[0];
      nb.innerHTML = ti.htmlNotes;
    }
    
    // set audio icons
    if (BibleTexts.updateAudioLinksTO) window.clearTimeout();
    BibleTexts.updateAudioLinksTO = window.setTimeout("BibleTexts.updateAudioLinks(" + w + ");", 0);
  
    // handle scrolls and highlights
  },
  
  updateCommentary: function(w, force) {
    Texts.showNoteBox[w] = false;
    
    var lastDisp = (this.display[w] ? copyObj(this.display[w]):null);
    
    if (!this.display[w] || !getPrefOrCreate("IsPinned" + w, "Bool", false)) 
        this.display[w] = this.getDisplay(prefs.getCharPref("Version" + w), Location, w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "bk", "ch", "globalOptions", "IsPinned"];
     
    if (force || !lastDisp || this.isChanged(check, this.display[w], lastDisp)) {
      var ti = CommTexts.read(w, this.display[w]);

      this.footnotes[w] = ti.footnotes;

      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = ti.htmlText;
    }
    
    // handle scrolls and highlights    
  },
  
  updateDictionary: function(w, force) {
    Texts.showNoteBox[w] = true;
    prefs.setBoolPref("IsPinned" + w, false);
    prefs.setBoolPref("ShowOriginal" + w, false);
    prefs.setBoolPref("MaximizeNoteBox" + w, false);
    
    var lastDisp = (this.display[w] ? copyObj(this.display[w]):null);
    this.display[w] = this.getDisplay(prefs.getCharPref("Version" + w), Location, w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "DictKey", "globalOptions"];
    
    if (force || !lastDisp || this.isChanged(check, this.display[w], lastDisp)) {
      var ti = DictTexts.read(w, this.display[w]);
      
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
    for (var i=0; i < DictTexts.keyList[this.display[w].mod]; i++) {
      var el = document.getElementById(DictTexts.keyList[this.display[w].mod][i]);
      if (!el) continue;
      el.className = (el.id == key ? "dictselectkey":"");
    }
  
    document.getElementById("w" + w + ".keytextbox").value = ti.key;
    setUnicodePref("DictKey_" + this.display[w].mod + "_" + w, ti.key);
   
    // handle scrolls and highlights
  },
  
  updateGenBook: function(w, force) {
    Texts.showNoteBox[w] = false;
    prefs.setBoolPref("IsPinned" + w, false);
    prefs.setBoolPref("ShowOriginal" + w, false);
    prefs.setBoolPref("MaximizeNoteBox" + w, false);
    
    var lastDisp = (this.display[w] ? copyObj(this.display[w]):null);
    this.display[w] = this.getDisplay(prefs.getCharPref("Version" + w), Location, w);
    
    // don't read new text if the results will be identical to last displayed text
    var check = ["mod", "GenBookKey", "globalOptions"];
    
    if (force || !lastDisp || this.isChanged(check, this.display[w], lastDisp)) {
      var ti = GenBookTexts.read(w, this.display[w]);
      
      this.footnotes[w] = ti.footnotes;
      
      var t =  document.getElementById("text" + w);
      var hd = t.getElementsByClassName("hd")[0];
      hd.innerHTML = ti.htmlHead;
      
      var sb = t.getElementsByClassName("sb")[0];
      sb.innerHTML = ti.htmlText;
    }
    
    // handle scrolls and highlights    
  },


  //////////////////////////////////////////////////////////////////////
  // Texts Utility functions
  //////////////////////////////////////////////////////////////////////
  
  getPageLinks: function() {
    var config = LocaleConfigs[getLocale()];
    var charNext = (config.direction && config.direction == "rtl" ? String.fromCharCode(8592):String.fromCharCode(8594));
    var charPrev = (config.direction && config.direction == "rtl" ? String.fromCharCode(8594):String.fromCharCode(8592));

    var html = "";
    html += "<div class=\"navlink vstyleProgram\">";
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
        if (chapter != getUnicodePref("ShowingKey" + mod)) continue;
        book = "na";
        chapter = "1";
      }
      try {var verse = BMDS.GetTarget(res, BM.gBmProperties[VERSE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;} catch (er) {continue;}
      if (!BookmarkFuns.isItemChildOf(res, BM.AllBookmarksRes, BMDS)) continue;
        
      // We have a keeper, lets save the note and show it in the text!
      // Encode ID
//dump ("FOUND ONE!:" + book + " " + chapter + " " + verse + " " + aModule + "\n");
      var encodedResVal = encodeUTF8(res.QueryInterface(BM.kRDFRSCIID).Value);
      var myid = "un." + encodedResVal + "." + bk + "." + ch + "." + verse + "." + mod;
      var newNoteHTML = "<span id=\"w" + w + "." + myid + "\" class=\"un\" title=\"un\"></span>";
      
      // if this is a selected verse, place usernote inside the hilighted element (more like regular notes, so highlightSelectedVerses works right)
      var idname = (usesVerseKey ? "vs." + bk + "." + ch + ".":"par.");
      var re = new RegExp("id=\"w" + w + "." + idname + verse + "\">(\\s*<span.*?>)?", "im");
      usernotes.html = usernotes.html.replace(re, "$&" + newNoteHTML);
      usernotes.notes += myid + "<bg>" + note + "<nx>";
    }
    
    return usernotes;
  },
 
  getDisplay: function(mod, loc, w) {
    var display = {globalOptions:{}};
    display.mod = mod;
    display.bk = loc.getBookName();
    display.ch = loc.getChapterNumber(mod);
    display.vs = loc.getVerseNumber(mod);
    display.lv = loc.getLastVerseNumber(mod);
    display.DictKey = getPrefOrCreate("DictKey_" + mod + "_" + w, "Unicode", "<none>");
    display.GenBookKey = getPrefOrCreate("GenBookKey_" + mod + "_" + w, "Unicode", "/");
    display.IsPinned = getPrefOrCreate("IsPinned" + w, "Bool", false);
    display.ShowOriginal = getPrefOrCreate("ShowOriginal" + w, "Bool", false);
    display.MaximizeNoteBox = getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
    display.ShowFootnotesAtBottom = getPrefOrCreate("ShowFootnotesAtBottom", "Bool", true);
    display.ShowCrossrefsAtBottom = getPrefOrCreate("ShowCrossrefsAtBottom", "Bool", false);
    display.ShowUserNotesAtBottom = getPrefOrCreate("ShowUserNotesAtBottom", "Bool", true);

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
          if (display1.globalOptions[GlobalToggleCommands[cmd]] != display2.globalOptions[GlobalToggleCommands[cmd]]) return true;
        } 
      }
      else if (display1[check[i]] != display2[check[i]]) return true;
    }

    return false;
  },

  scroll2: function(outerElement, element2Scroll, offsetParentId, dontScrollIfVisible, margin) {
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
    var pars = ["<p>", "<br>", "<br />"];
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
      ret.htmlText = Bible.getChapterTextMulti(d.mod + "," + mod2, d.bk + " " + d.ch).replace("interV2", "vstyle" + mod2, "gm");
      Bible.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      Bible.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      ret.htmlText = Bible.getChapterText(d.mod, d.bk + " " + d.ch);
      
      if (d.globalOptions["User Notes"] == "On") {
        un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText, w);
        ret.htmlText = un.html;
      }
      
      // handle footnotes
      var gfn = (d.globalOptions["Footnotes"] == "On" && d["ShowFootnotesAtBottom"]);
      var gcr = (d.globalOptions["Cross-references"] == "On" && d["ShowCrossrefsAtBottom"]);
      var gun = (d.globalOptions["User Notes"] == "On" && d["ShowUserNotesAtBottom"]);
    
      if (!(gfn || gcr || gun)) {
        // we aren't showing footnotes in box, so turn maximize off
        prefs.setBoolPref("MaximizeNoteBox" + w, false);
      }
      else {
        ret.footnotes = Bible.getNotes();
        if (gun) ret.footnotes += un.notes;

        ret.htmlNotes = this.getNotesHTML(ret.footnotes, d.mod, gfn, gcr, gun, false, w);
      }
    }
    
    Texts.showNoteBox[w] = (ret.htmlnotes ? true:false);
    
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
      var showBook = (d["IsPinned"] || d.ch == 1);
      ret.htmlText = this.getChapterHeading(d.bk, d.ch, d.mod, w, showBook, false, d["ShowOriginal"]) + ret.htmlText;
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
  
  // This function is only for versekey modules (BIBLE, COMMENTARY)
  getChapterHeading: function(bk, ch, mod, w, showBookName, showIntroduction, showOriginal) {
    var myVersionsLocale = getLocaleOfModule(mod);
    if (!myVersionsLocale) {myVersionsLocale = getLocale();}
    var myVersionsBundle = getLocaleBundle(myVersionsLocale, "books.properties");
    var myConfig = LocaleConfigs[myVersionsLocale];

    var chapterHeadingFont = (myConfig && myConfig.font ? myConfig.font:DefaultFont);
    var chapterHeadingSize = (myConfig && myConfig.fontSizeAdjust ? myConfig.fontSizeAdjust:DefaultFontSizeAdjust);
    
    // book and chapter heading
    var mtext = "<div class=\"chapterhead\" dirmod=\"" + ((myConfig && myConfig.direction && myConfig.direction=="rtl") ? "rtl":"ltr") + "\">";
    mtext += "<div class=\"chapnum\" style=\"font-family:'" + chapterHeadingFont + "'; \">";
    if (showBookName) {
      mtext += "<span>" + myVersionsBundle.GetStringFromName(bk) + "</span>";
      mtext += "<br>";
    }
    mtext += "<span>" + getLocalizedChapterTerm(bk, ch, myVersionsBundle, myVersionsLocale) + "</span>";
    mtext += "</div>";

    var intro = "";
    if (!showOriginal) {
      mtext += "<div class=\"chapinfo\">";
      mtext +=  this.getNoticeLink(mod, false, w);
      mtext += "<div class=\"audiolink\">";
      mtext += "<div class=\"listenlink\" id=\"w" + w + ".listenlink." + ch + "\"></div>";
      mtext += "</div>";

      // introduction link and introduction
      if (ch == 1) {
        intro = BibleTexts.getBookIntroduction(mod, bk); 
        var test = intro.replace(/<[^>]+>/g,"").match(/\S/); // Remove empty intros that may be generated by paratext2Osis.pl
        if (!test) intro=null;
        if (intro) {
          var linkt = showIntroduction ? myVersionsBundle.GetStringFromName("HideIntroLink"):myVersionsBundle.GetStringFromName("IntroLink");
          var links = showIntroduction ? "hide":"show";
          mtext += "<a class=\"introlink\" title=\"" + links + "\" id=\"w" + w + ".introlink." + ch + "\">" + linkt + "</a>";
          mtext += "</div>";
          if (showIntroduction) {
            mtext += "<div class=\"textbr1\"></div><span class=\"vstyle" + mod + "\">" + intro + "</span><div class=\"textbr1\"></div>";
          }
        }
        else {mtext += "</div>";}
      }
      else {mtext += "</div>";}
    }
    mtext += "</div>";

    mtext += "<div class=\"textbr0\"></div>";
    
    return mtext;
  },

  getNotesHTML: function(notes, mod, gfn, gcr, gun, openCRs, w) {
    if (!notes) return "";
    
    //Start building notebox contents
    var haveNotes=false;
    var versionDirectionEntity = (VersionConfigs[mod] && VersionConfigs[mod].direction == "rtl" ? "&rlm;":"&lrm;");
    var orient = (VersionConfigs[mod] && VersionConfigs[mod].direction == "rtl" ? "fncol3RTL":"fncol3LTR");
    var t = "<div id=\"w" + w + ".maintable.\" class=\"fntable\">";
    var note = notes.split("<nx>");
    note = note.sort(this.ascendingVerse);
    if (note[0] != "") {
      var te = "";
      var thiscv="";

      // Now parse each note in the chapter separately
      for (var n=0; n < note.length; n++) {
        // note format is tp.n.Book.c.v<bg>body
        var noteid = note[n].split("<bg>")[0];
        var body   = note[n].split("<bg>")[1];
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
          t += "<a id=\"w" + w + ".notl." + noteid + "\" class=\"fncol4 vstyle" + mod + "\" >" + "<i>" + myc + ":" + versionDirectionEntity + myv + "</i>" + " -" + "</a>";
          
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
              unclass += " vstyle" + unmod;
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
    var xsn = new RegExp("^" + XSNOTE + "<bg>");
    var av = Number(a.match(xsn)[5]);
    var bv = Number(b.match(xsn)[5]);
    var ac = Number(a.match(xsn)[4]);
    var bc = Number(b.match(xsn)[4]);
    if (ac == bc) {
      if (av == bv) {
        var at = a.match(/^(\w\w)/)[1];
        var bt = b.match(/^(\w\w)/)[1];
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
      return "<span class=\"vstyle" + mod + " noticelink\">" + lt.replace("<a>", "<a id=\"w" + w + ".noticelink\">") + "</span>";
    }
    else
      return Bible.getModuleInformation(mod, "NoticeText");
  },

  getRefHTML: function(w, mod, id, body, xsid, sepclass) {
    var ref = body.split(";");
    var html = "<div class=\"vstyle" + mod + "\">";
    var sep = "";
    for (var i=0; i<ref.length; i++) {
      if (!ref[i]) continue;
      var r = normalizeOsisReference(ref[i], mod);
      if (!r) continue;
      
      var aVerse = findAVerseText(mod, r, w);
      if ((/^\s*$/).test(aVerse.text)) aVerse.text = "-----";
      
      var rmod = Tabs[aVerse.tabNum].modName;
      html += sep;
      html += "<a class=\"crref vstyleprogram\" id=\"w" + w + "." + id + "l." + xsid + "\" title=\"" + rmod + "." + aVerse.location + "\">";
      html += ref2ProgramLocaleText(aVerse.location);
      html += "</a>";
      html += "<span id=\"w" + w + "." + id + "t." + xsid + "\" title=\"" + rmod + "." + aVerse.location + "\" class=\"crtext vstyle" + rmod + "\">";
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
    window.setTimeout("unhighlightNote()",1000);

    var nb = document.getElementById("note" + w);
    var note = document.getElementById(id);
    
    Texts.scroll2(nb, note, "w" + w + ".maintable.", true, 4);
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
      if (MainWindow.getAudioForChapter(Texts.display[w].mod, Texts.display[w].bk, Number(icon.id.split(".")[1]), MainWindow.AudioDirs)) 
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
    ret.htmlText = Bible.getChapterText(d.mod, d.bk + " " + d.ch);
    
    ret.footnotes = Bible.getNotes();
      
    var un;
    if (d.globalOptions["User Notes"] == "On") {
      un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText, w);
      ret.htmlText = un.html;
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
      var showBook = (d["IsPinned"] || d.ch == 1);
      ret.htmlText = BibleText.getChapterHeading(d.bk, d.ch, d.mod, w, showBook, false, false) + ret.htmlText;
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
// DictTexts
////////////////////////////////////////////////////////////////////////

var DictTexts = {
  keyList: {},
  keysHTML: {},
  
  read: function(w, d) {
    var ret = { htmlList:"", htmlHead:Texts.getPageLinks(), htmlEntry:"", footnotes:null };
    
    // get key list (is cached)
    if (!this.keyList[d.mod]) {
      this.keyList[d.mod] = Bible.getAllDictionaryKeys(d.mod).split("<nx>");
      this.keyList[d.mod].pop();
      this.sortOrder = Bible.getModuleInformation(d.mod, "LangSortOrder");
      if (this.sortOrder != NOTFOUND) {
        this.sortOrder += "0123456789";
        this.langSortSkipChars = Bible.getModuleInformation(d.mod, "LangSortSkipChars");
        if (this.langSortSkipChars == NOTFOUND) this.langSortSkipChars = "";
        this.keyList[d.mod].sort(this.dictSort);
      }
    }
    
    // get html for list of keys (is cached)
    if (!this.keysHTML[d.mod]) {
      this.keysHTML[d.mod] = this.getDictListHTML(this.keyList[d.mod], d.mod, w);
    }
    ret.htmlList = this.keysHTML[d.mod];

    // get actual key
    if (d.DictKey == "<none>") d.DictKey = this.keyList[d.mod][0];
    if (d.DictKey == "DailyDevotionToday") {
      var today = new Date();
      d.DictKey = (today.getMonth()<9 ? "0":"") + String(today.getMonth()+1) + "." + (today.getDate()<10 ? "0":"") + today.getDate();
    }
    
    // get htmlEntry
    var de = this.getDictEntryHTML(d.DictKey, d.mod);
    var un = Texts.getUserNotes("na", d.DictKey, d.mod, de, w);
    de = un.html;
    ret.footnotes = un.notes;
    
    ret.htmlEntry += "<div class=\"dictentry\">";
    ret.htmlEntry +=  "<div>" + de + "</div>";
    ret.htmlEntry += "</div>";
  
    ret.key = d.DictKey;
  
    return ret;
  },
  
  getDictListHTML: function(list, mod, w) {
    var html = "";
    html += "<div class=\"dictlist\">"
    html +=   "<div id=\"w" + w + ".textboxparent\">";
    html +=     "<input id=\"w" + w + ".keytextbox\" name=\"keytextbox\" class=\"vstyle" + mod + "\" onfocus=\"this.select()\" ondblclick=\"this.select()\" ";
    html +=     "onkeypress=\"DictTexts.dictionaryKeyPress('" + mod + "', " + w + ", event)\"/>";
    html +=   "</div>";
    html +=   "<div id=\"w" + w + ".keylist\" onclick=\"DictTexts.selKey('" + mod + "', " + w + ", event.target.id)\">";
    for (var e=0; e < list.length; e++) {
      html += "<div id=\"w" + w + "." + list[e] + "\" >" + list[e] + "</div>";
    }
    html +=   "</div>";
    html += "</div>";
    
    return html;
  },
  
  getDictEntryHTML: function(key, mods, dontAddParagraphIDs) {
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
          dictHTML += "<br><br>" + dictTitle + dictEntry;
        }
      }
    }
    
    if (!html) return "";

    html = "<b>" + key + ":</b> " + html + "<br>";
    if (!dontAddParagraphIDs) html = Texts.addParagraphIDs(html);
    html = "<div class=\"vstyle" + mods[0] + "\">" + html + "</div>";
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
      html = "<div class=\"vstyle" + module + "\">" + html + "</div>";
    }
    return html;
  },

  //The timeout below was necessary so that textbox.value included the pressed key...
  dictionaryKeyPress: function(mod, w, e) {
    window.setTimeout("DictTexts.dictionaryKeyPressR('" + mod + "', " + w + ", " + e.which + ")", 0);
  },

  dictionaryKeyPressR: function(mod, w, charCode) {
    var textbox = document.getElementById("w" + w + ".keytextbox");
    var text = textbox.value;
    if (!text) {
      textbox.style.color="";
      return;
    }
    
    var matchtext = new RegExp("(^|<nx>)(" + escapeRE(text) + "[^<]*)<nx>", "i");
    var firstMatch = matchtext(DictTexts.keyList[mod].join("<nx>") + "<nx>");
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

  selKey: function (mod, w, aKey) {
    if (aKey == "keylist") return;
    setUnicodePref("DictKey_" + mod + "_" + w, aKey);
    Texts.updateDictionary(w);
    window.setTimeout("document.getElementById('w" + w + ".keytextbox').focus()", 1);
  }

};


////////////////////////////////////////////////////////////////////////
// GenBookTexts
////////////////////////////////////////////////////////////////////////

var GenBookTexts = {
  
  read: function(w, d) {
    var ret = { htmlHead:Texts.getPageLinks(), htmlText:"", footnotes:null };

    ret.htmlText = Bible.getGenBookChapterText(d.mod, d.GenBookKey);
    ret.htmlText = Texts.addParagraphIDs(ret.htmlText);
    
    var un = Texts.getUserNotes("na", 1, d.mod, ret.htmlText, w);
    ret.htmlText = un.html;
    footnotes = un.notes;
    
    return ret;
  }
  
};
