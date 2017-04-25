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

////////////////////////////////////////////////////////////////////////
// BibleTexts
////////////////////////////////////////////////////////////////////////

BibleTexts = {
  
  read: function(w, d) {
    // w is only needed for creating unique ids
  
    var ret = { htmlText:"", htmlNotes:"", htmlHead:Texts.getPageLinks(), footnotes:null, introFootnotes:null };

    // For Pin feature, set "global" SWORD options for local context
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      LibSword.setGlobalOption(GlobalToggleCommands[cmd], d.globalOptions[GlobalToggleCommands[cmd]]);
    }
    
    // get Bible chapter's text
    var un;
    if (d["ShowOriginal"]) {
      LibSword.setGlobalOption("Strong's Numbers", "On");
      LibSword.setGlobalOption("Morphological Tags", "On");
      
      // Get the appropriate original language module
      var mod2 = prefs.getCharPref("DefaultVersion");
      if (findBookNum(d.bk) < NumOT && Tab.ORIG_OT) {
        mod2 = Tab.ORIG_OT.modName;
      }
      else if (findBookNum(d.bk) >= NumOT && Tab.ORIG_NT) {
        mod2 = Tab.ORIG_NT.modName;
      }
      
      ret.htmlText = LibSword.getChapterTextMulti(d.mod + "," + mod2, d.bk + "." + d.ch + ".1.1").replace(/interV2/gm, "cs-" + mod2);
      
      LibSword.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      LibSword.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      ret.htmlText = LibSword.getChapterText(d.mod, d.bk + "." + d.ch + ".1.1");
//jsdump(ret.htmlText);
      ret.footnotes = LibSword.getNotes();
     
      if (d.globalOptions["User Notes"] == "On") {
        un = Texts.getUserNotes(d.bk, d.ch, d.mod, ret.htmlText);
        ret.htmlText = un.html; // has user notes added to text
        ret.footnotes += un.notes;
      }
      
      // handle footnotes
      var gfn = (d.globalOptions["Footnotes"] == "On" && d["ShowFootnotesAtBottom"]);
      var gcr = (d.globalOptions["Cross-references"] == "On" && d["ShowCrossrefsAtBottom"]);
      var gun = (d.globalOptions["User Notes"] == "On" && d["ShowUserNotesAtBottom"]);
        
      if (gfn || gcr || gun) ret.htmlNotes = this.getNotesHTML(ret.footnotes, d.mod, gfn, gcr, gun, false, w, false);
    }
   
    // localize verse numbers
    var tl = ModuleConfigs[d.mod].AssociatedLocale;
    if (tl == NOTFOUND) {tl = getLocale();}
    var verseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
    ret.htmlText = ret.htmlText.replace(verseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});

    // add headers
    var showHeader = (d.globalOptions["Headings"]=="On");
    if (showHeader && ret.htmlText) {
      var headInfo = this.getChapterHeading(d);
      ret.htmlText = headInfo.text + ret.htmlText;
      ret.introFootnotes = headInfo.notes;
    }
    
    // put "global" SWORD options back to their global context values
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      LibSword.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
    }
    
    return ret;
  },
  
  checkNoteBox: function(w) {
 
    var havefn = false;
    
    var t = document.getElementById("text" + w);
    var sb = t.getElementsByClassName("sb")[0];
    var nb = document.getElementById("note" + w);
    
    if (t.getAttribute("moduleType") != "Texts")
      return (nb.innerHTML ? true:false);
      
    // single column displays always show notes for the whole chapter.
    if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {

      // get first chapter/verse
      var vf = sb.firstChild;
      while (vf && !Texts.isVisibleVerse(vf, w)) {
        vf = vf.nextSibling;
      }
      
      // get last chapter/verse
      var vl = sb.lastChild;
      while (vl && !Texts.isVisibleVerse(vl, w)) {
        vl = vl.previousSibling;
      }
      
      if (vf) vf = getElementInfo(vf);
      if (vl) vl = getElementInfo(vl);
      
      // hide footnotes whose references are scrolled off the window
      if (nb.innerHTML) {
      
        var nt = nb.getElementsByClassName("fnrow");
        for (var i=0; i<nt.length; i++) {
        
          var v = getElementInfo(nt[i]);
          if (!v) continue;
          
          var display = "";
          if (vf && (v.ch < vf.ch || (v.ch == vf.ch && v.vs < vf.vs)))
              display = "none";
            
          if (vl && (v.ch > vl.ch || (v.ch == vl.ch && v.vs > vl.vs)))
              display = "none";
         
          nt[i].style.display = display;
          if (!display) havefn = true;
          
        }
      }
    }
    else if (nb.innerHTML) havefn = true;
  
    return havefn;
  },
  
  // This function is only for versekey modules (BIBLE, COMMENTARY)
  getChapterHeading: function(d) {
    var l = ModuleConfigs[d.mod].AssociatedLocale;
    if (l == NOTFOUND) {l = getLocale();} // otherwise use current program locale
    var b = getLocaleBundle(l, "common/books.properties");

    var intro = BibleTexts.getIntroductions(d.mod, d.bk + " " + d.ch);
    if (!intro.text || (intro.text.length < 10 || (/^\s*$/).test(intro.text.replace(/<[^>]*>/g, "")))) intro.text = "";
    
    // MAJOR CLUDGE! All this string processing should be replaced by DOM instructions. As it is now,
    // if any portion of HTML returned by LibSword is not well-formed, then the entire page is broken.
    // Setting intro (which is not well-formed for all RusVZh chapters) to an element and reading again 
    // insures HTML string is well formed at least.
    if (intro.text) {
      var tmp = document.createElement("div");
      sanitizeHTML(tmp, intro.text);
      intro.text = tmp.innerHTML;
    }
  
    var lt = LibSword.getModuleInformation(d.mod, "NoticeLink");
    if (lt == NOTFOUND) lt = "";
    else lt = lt.replace("<a>", "<a class='noticelink'>");
    
    // Chapter heading has style of the locale associated with the module, or else
    // current program locale if no associated locale is installed. But notice-link 
    // is always cs-module style.
    var html = "";
    html  = "<div class=\"chapterhead" + (d.ch==1 ? " chapterfirst":"") + " cs-" + l + ((/rtl/i).test(LocaleConfigs[l].direction) ? " RTL":"") + "\">";
    
    html +=   "<div class=\"chapnotice cs-" + d.mod + (!lt ? " empty":"") + "\">";
    html +=     "<div class=\"noticelink-c\">" + (lt ? lt:"") + "</div>";
    html +=     "<div class=\"noticetext\">"; // contains a span with class cs-mod because LibSword.getModuleInformation doesn't supply the class
    html +=       "<div class=\"cs-" + d.mod + "\">" + (lt ? LibSword.getModuleInformation(d.mod, "NoticeText"):"") + "</div>";
    html +=     "</div>";
    html +=     "<div class=\"head-line-break\"></div>";
    html +=   "</div>";

    html +=   "<div class=\"chaptitle\" >";
    html +=     "<div class=\"chapbk\">" + b.GetStringFromName(d.bk) + "</div>";
    html +=     "<div class=\"chapch\">" + getLocalizedChapterTerm(d.bk, d.ch, b, l) + "</div>";
    html +=   "</div>";

    html +=   "<div class=\"chapinfo\">";
    html +=     "<div class=\"listenlink\" title=\"" + [d.bk, d.ch, 1, d.mod].join(".") + "\"></div>";
    html +=     "<div class=\"introlink" + (!intro.text ? " empty":"") + "\" title=\"" + [d.bk, d.ch, 1, d.mod].join(".") + "\">" + b.GetStringFromName("IntroLink") + "</div>";
    if (d["ShowOriginal"]) {
      var origs = SpecialModules.OriginalLanguages.Greek.concat(SpecialModules.OriginalLanguages.Hebrew);
      if (origs.length) {
        html += "<div class=\"origselect\">";
        html +=   "<select>";
        for (var i=0; i<origs.length; i++) {
          try {var selected = origs[i] == (findBookNum(d.bk) < NumOT ? Tab.ORIG_OT.modName:Tab.ORIG_NT.modName);}
          catch (er) {selected = false;}
          html +=   "<option class=\"origoption cs-" + Tab[origs[i]].locName + "\" value=\"" + d.bk + ".1.1." + origs[i] + "\"" + (selected ? " selected=\"selected\"":"") + ">" + Tab[origs[i]].label + "</option>";
        } 
        html +=   "</select>";
        html += "</div>";
      }
    }
    html +=   "</div>";
    
    html += "</div>";
    
    html += "<div class=\"head-line-break\"></div>";
    
    html += "<div class=\"introtext" + (!intro.text ? " empty":"") + "\" title=\"" + [d.bk, d.ch, 1, d.mod].join(".") + "\">" + (intro.text ? intro.text :"") + "</div>";
 
    return { text:html, notes:intro.notes };
  },

  // The 'notes' argument can be HTML or a DOM element which is either a single
  // note or a container with note child/children
  getNotesHTML: function(notes, mod, gfn, gcr, gun, openCRs, w, keepTextNotes) {
    if (!notes) return "";
    
    if (!w) w = 0; // w is only needed for unique id creation
    
    var noteContainer;
    if (typeof(notes) == "string") {
      noteContainer = document.createElement("div");
      sanitizeHTML(noteContainer, notes);
    }
    else if (notes.className == "nlist") {
      noteContainer = document.createElement("div");
      noteContainer.appendChild(notes);
    }
    else noteContainer = notes;
      
    var note = [];
    var nodelist = noteContainer.getElementsByClassName("nlist");
    for (var n=0; n < nodelist.length; n++) {
      note.push(nodelist[n]);
    }
    note = note.sort(this.ascendingVerse);
    
    // Start building our html
    var t = ""; 
    
    if (note) {

      // Now parse each note in the chapter separately
      for (var n=0; n < note.length; n++) {
        
        var p = getElementInfo(note[n]);
        if (!p) continue;
        var body = note[n].innerHTML;
        
        // Check if this note should be displayed here, and if not then continue
        switch (p.ntype) {
        case "fn":
          if (!gfn) p.ntype = null;
          break;
        case "cr":
          if (!gcr) p.ntype = null;
          break;
        case "un":
          if (!gun) p.ntype = null;
        }
        if (!p.ntype) continue;
        
        // Now display this note as a row in the main table
        t += "<div id=\"w" + w + ".footnote." + p.title + "\" ";
        t += "title=\"" + p.nid + "." + p.bk + "." + p.ch + "." + p.vs + "." + p.mod + "\" ";
        t += "class=\"fnrow " + (openCRs ? "cropened":"crclosed") + "\">";
        
        // Write cell #1: an expander link for cross references only
        t +=   "<div class=\"fncol1\">";
        if (p.ntype == "cr") {
          t +=   "<div class=\"crtwisty\"></div>";
        }
        t +=   "</div>";
        // These are the lines for showing expanded verse refs
        t +=   "<div class=\"fncol2\"><div class=\"fndash\"></div></div>";
        t +=   "<div class=\"fncol3\">&nbsp;</div>";
        
        // Write cell #4: chapter and verse
        var lov = ModuleConfigs[mod].AssociatedLocale;
        if (lov == NOTFOUND) lov = getLocale();
        var modDirectionEntity = (ModuleConfigs[mod] && ModuleConfigs[mod].direction == "rtl" ? "&rlm;":"&lrm;");
        t +=   "<div class=\"fncol4\">";
        if (p.ch && p.vs) {
          t +=   "<a class=\"fnlink\" title=\"" + p.nid + "." + p.bk + "." + p.ch + "." + p.vs + "." + p.mod + "\">";
          t +=     "<i>" + dString(p.ch, lov) + ":" + modDirectionEntity + dString(p.vs, lov) + "</i>";
          t +=   "</a>";
          t +=   " -";
        }
        t +=   "</div>";
        
        // Write cell #5: note body
        t +=   "<div class=\"fncol5\">";
        
        switch(p.ntype) {
        case "cr":
          // If this is a cross reference, then parse the note body for references and display them
          t += this.getRefHTML(w, mod, body, keepTextNotes);
          break;
        
        case "fn":
          // If this is a footnote, then just write the body
          t += "<span class=\"fntext cs-" + (isASCII(body) ? DEFAULTLOCALE:mod) + (ModuleConfigs[mod].direction != ProgramConfig.direction ? " opposing-program-direction":"") + "\">" + body + "</span>";
          break;
        
        case "un":
          // If this is a usernote, then add direction entities and style
          var unmod = null;
          try {
            unmod = BMDS.GetTarget(BM.RDF.GetResource(decodeURIComponent(p.nid)), BM.gBmProperties[NOTELOCALE], true);
            unmod = unmod.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
          }
          catch (er) {}
          var de = (unmod && ModuleConfigs[unmod] && ModuleConfigs[unmod].direction == "rtl" ? "&rlm;":"&lrm;");
          body = "<span class=\"noteBoxUserNote" + (unmod ? " cs-" + unmod:"") + "\">" + de + body + de + "</span>";
          t += body;
          break;
        }
        
        // Finish this body and this row
        t +=   "</div>";
        t += "</div>";
      
      }
      
      // Finish html
      if (t) t = "<div class=\"fntable\">" + t + "</div>";
      
    }
  
    return t
  },
    
  // This function tries to read a ";" separated list of Scripture
  // references and return HTML which describes the references and their
  // texts. It looks for OSIS type references as well as free
  // hand references which may include ","s. It will supply missing
  // book, chapter, and verse information using context and/or
  // previously read information (as is often the case after a ",").
  // This function also may look through multiple Bible texts until it
  // finds the passage. It also takes care of verse system
  // conversions (KJV and Synodal only, right now).
  getRefHTML: function(w, mod, body, keepTextNotes) {
    if (!keepTextNotes) keepTextNotes = false;

    var ref = body.split(/\s*;\s*/);
    
    // are there any commas? then add the sub refs to the list...
    for (var i=0; i<ref.length; i++) {
      var verses = ref[i].split(/\s*,\s*/);
      if (verses.length == 1) continue;
      
      var r = 1;
      for (var v=0; v<verses.length; v++) {
        ref.splice(i+1-r, r, verses[v]);
        i++;
        i -= r;
        r = 0;
      }
    }
    
    // set default starting values, which may be used to fill in missing 
    // values which were intended to be assumed from context
    var bk = Location.getBookName();
    var ch = Location.getChapterNumber(mod);
    var vs = 1;
    
    var html = "";
    var sep = "";
    for (var i=0; i<ref.length; i++) {
      if (!ref[i]) continue;
      var failed = false;
      
      // is this a reference to a footnote?
      if (ref[i].indexOf("!") != -1) {
        var footnote = "-----";
        
        var m = ref[i].match(/^\s*(([^\:]+)\:)?([^\!\:]+)(\!.*?)\s*$/);
        if (m) {
          var rmod = (m[1] ? m[2]:mod);
          var rref = m[3];
          var ext = m[4];
          
          // find the footnote which is being referenced
          LibSword.getChapterText(rmod, rref);
          var noteContainer = document.createElement("div");
          sanitizeHTML(noteContainer, LibSword.getNotes());
          var notes = noteContainer.getElementsByClassName("nlist");
          
          for (var note of notes) {
            var osisID = note.getAttribute('data-osisID');
            if (osisID && osisID == (rref + ext)) {footnote = note.innerHTML; break;}
          }
        }
        
        html += sep;
        // the following html was copied from bibleTexts.getNotesHTML()
        html += "<span class=\"fntext cs-" + (isASCII(footnote) ? DEFAULTLOCALE:mod) + (ModuleConfigs[mod].direction != ProgramConfig.direction ? " opposing-program-direction":"") + "\">" + footnote + "</span>"
        sep = "<span class=\"cr-sep\"></span>";
        
        continue;
      }
      
      // is this ref an osisRef type reference?
      var r = this.normalizeOsisReference(ref[i], mod);
      
      // if not, then parse it and fill in any missing values from context
      if (!r.ref) {
        var loc = parseLocation(ref[i]);
        if (loc) {
          bk = loc.shortName ? loc.shortName:bk;
          ch = loc.chapter ? loc.chapter:ch;
          vs = loc.verse ? loc.verse:vs;
          
          r.ref = bk + "." + ch + "." + vs;
          
          if (loc.lastVerse) {r.ref += "-" + bk + "." + ch + "." + loc.lastVerse;}
          
          r = this.normalizeOsisReference(r.ref, mod);
          
          if (!r.ref) failed = true;
        }
        else failed = true;
      }
      if (failed) {
        // then reset our context, since we may have missed something along the way
        bk = null;
        ch = null;
        vs = null;
        continue;
      }
      
      var aVerse = findAVerseText(r.mod, r.ref, w, keepTextNotes);
      if (!aVerse) aVerse = { text:"(" + ref[i] + " ??)", location:r.ref, tabNum:Tab[mod].index };
      if ((/^\s*$/).test(aVerse.text)) aVerse.text = "-----";
      
      var rmod = Tabs[aVerse.tabNum].modName;
      html += sep;
      html += "<a class=\"crref\" title=\"" + aVerse.location + "." + rmod + "\">";
      html += ref2ProgramLocaleText(aVerse.location);
      html += "</a>";
      html += "<span class=\"crtext cs-" + rmod + (ModuleConfigs[rmod].direction != ProgramConfig.direction ? " opposing-program-direction":"") + "\">";
      html += aVerse.text + (rmod != mod ? " (" + Tab[rmod].label + ")":"");
      html += "</span>";
      
      sep = "<span class=\"cr-sep\"></span>";
    }
    
    return html;
  },
  
  // Looks for a "." delineated OSIS Scripture reference, checks, and normalizes it.
  // Reads any osisRef target:ref and returns mod=null if it's not installed.
  // Returns null if this is not an OSIS type reference.
  // Converts book.c to book.c.vfirst-book.c.vlast
  // And returns one of the following forms:
  // a)   book.c.v
  // b)   book.c.v-book.c.v
  normalizeOsisReference: function(ref, bibleMod) {
  //dump(ref + "\n");
    var ret = {mod:bibleMod, ref:null};
    if (ref.search("null")!=-1) return ret;
    
    ref = ref.replace(/^\s+/,""); // remove beginning white space
    ref = ref.replace(/\s+$/,""); // remove trailing white space
    
    // does osisRef have a target?
    var m = ref.match(/^(\w+)\:/);
    if (m) {
      ref = ref.replace(/^\w+\:/, "");
      
      if (!(/Bible/i).test(m[1])) {
        if (Tab.hasOwnProperty(ret.mod) && Tab.hasOwnProperty(m[1])) {
          ref = LibSword.convertLocation(LibSword.getVerseSystem(m[1]), ref, LibSword.getVerseSystem(ret.mod));
        }
        else if (Tab.hasOwnProperty(m[1])) ret.mod = m[1];
        else {
          ret.mod = null;
          jsdump("WARN: Target module is not installed!");
        }
      }
    }
    
    if ((/^[^\.]+\.\d+$/).test(ref)) {                            // bk.c
      if (ret.mod) ret.ref =  ref + ".1-" + ref + "." + LibSword.getMaxVerse(ret.mod, ref);
      else ret.ref = ref;
    }
      
    if ((/^[^\.]+\.\d+\.\d+$/).test(ref))                         // bk.c.v
      ret.ref = ref;
      
    if ((/^[^\.]+\.\d+\.\d+\.\d+$/).test(ref)) {                  // bk.c.v1.v2
      var p = ref.match(/^(([^\.]+\.\d+)\.\d+)\.(\d+)$/);
      ret.ref = p[1] + "-" + p[2] + "." + p[3];
    }
    
    if ((/^[^\.]+\.\d+\.\d+-\d+$/).test(ref)) {                   // bk.c.v1-v2
      var p = ref.match(/(^[^\.]+\.\d+\.)(\d+)-(\d+)$/);
      ret.ref = p[1] + p[2] + "-" + p[1] + p[3];
    }
    
    if ((/^[^\.]+\.\d+\.\d+-[^\.]+\.\d+\.\d+$/).test(ref))        // bk.c.v-bk.c.v
      ret.ref = ref; 
      
    return ret;
  },
  
  ascendingVerse: function(a,b) {
    var t1 = "un"; 
    var t2 = "fn"; 
    var t3 = "cr";
    
    var pa = getElementInfo(a);
    var pb = getElementInfo(b);
    
    if (!pa) return 1;
    if (!pb) return -1;

    if (pa.ch == pb.ch) {
      if (pa.vs == pb.vs) {
        if (pa.ntype == pb.ntype) return 0;
        if (pa.ntype == t1) return -1;
        if (pa.ntype == t2 && pb.ntype == t3) return -1;
        else return 1
      }
      return pa.vs > pb.vs ? 1:-1
    }
    else if (pa.ch < pb.ch) return -1;
    
    return 1;
  },

  // Turns headings on before reading introductions
  getIntroductions: function(mod, vkeytext) {
    if (!Tab[mod] || (Tab[mod].modType != BIBLE && Tab[mod].modType != COMMENTARY)) return { text:'', notes:'' };
    
    LibSword.setGlobalOption("Headings", "On");
    
    var intro = LibSword.getIntroductions(mod, vkeytext);
    var notes = LibSword.getNotes();
  
    LibSword.setGlobalOption("Headings", prefs.getCharPref("Headings"));
    return { text:intro, notes:notes };
  },
  
  SelectedNote:null,
  
  // returns false if element does not exist
  scroll2Note: function(id) {
    // unhilight any hilighted note
    if (BibleTexts.SelectedNote) BibleTexts.SelectedNote.className = BibleTexts.SelectedNote.className.replace(" fnselected", "");
    
    // hilight new note
    this.SelectedNote = document.getElementById(id);
    if (!this.SelectedNote) return false;
    this.SelectedNote.className += " fnselected";
    
    // scroll to new note
    document.getElementById(id).scrollIntoView();
    document.getElementsByTagName("body")[0].scrollTop = 0; // prevent scrollIntoView from scrolling body too!
    return true;
  },
  
  updateAudioLinks: function(w) {
    var icons = document.getElementById("text" + w).getElementsByClassName("listenlink");
    for (var i = 0; i < icons.length; ++i) {
      var p = getElementInfo(icons[i]);
      icons[i].className = icons[i].className.replace(/\s*hasAudio/, "");
      if (AudioDirs.length && XS_window.getAudioForChapter(p.mod, p.bk, p.ch)) icons[i].className += " hasAudio";
    }
  }

};

