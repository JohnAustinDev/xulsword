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
  
    var ret = { htmlText:"", htmlNotes:"", htmlHead:Texts.getPageLinks(), footnotes:null };

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
      
      ret.htmlText = LibSword.getChapterTextMulti(d.mod + "," + mod2, d.bk + "." + d.ch + ".1.1").replace("interV2", "cs-" + mod2, "gm");
      
      LibSword.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      LibSword.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      ret.htmlText = LibSword.getChapterText(d.mod, d.bk + "." + d.ch + ".1.1");
      
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
        
      if (gfn || gcr || gun) ret.htmlNotes = this.getNotesHTML(ret.footnotes, d.mod, gfn, gcr, gun, false, w);
    }
   
    // localize verse numbers
    var tl = ModuleConfigs[d.mod].AssociatedLocale;
    if (tl == NOTFOUND) {tl = getLocale();}
    var verseNm = new RegExp("(<sup class=\"versenum\">)(\\d+)(</sup>)", "g");
    ret.htmlText = ret.htmlText.replace(verseNm, function(str, p1, p2, p3) {return p1 + dString(p2, tl) + p3;});

    // add headers
    var showHeader = (d.globalOptions["Headings"]=="On");
    if (showHeader && ret.htmlText) {
      ret.htmlText = this.getChapterHeading(d.bk, d.ch, d.mod) + ret.htmlText;
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
      
    // single column displays always show notes for the whole chapter.
    if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {

      // get first chapter/verse
      var vf = sb.firstChild;
      while (vf && (vf.style.display == "none" || !vf.className || !(/^vs(\s|$)/).test(vf.className))) {
        vf = vf.nextSibling;
      }
      
      // get last chapter/verse
      var vl = sb.lastChild;
      while (vl && (vl.offsetLeft >= sb.offsetWidth || !vl.className || !(/^vs(\s|$)/).test(vl.className))) {
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
  getChapterHeading: function(bk, ch, mod) {
    var l = ModuleConfigs[mod].AssociatedLocale;
    if (l == NOTFOUND) {l = getLocale();} // otherwise use current program locale
    var b = getLocaleBundle(l, "common/books.properties");

    var intro = (ch != 1 ? "":BibleTexts.getBookIntroduction(mod, bk));
    
    // Remove empty intros that may be generated by old paratext2Osis.pl
    if (intro && !intro.replace(/<[^>]+>/g,"").match(/\S/)) intro=null;
    
    var lt = LibSword.getModuleInformation(mod, "NoticeLink");
    if (lt == NOTFOUND) lt = "";
    else lt = lt.replace("<a>", "<a class='noticelink'>");
    
    // Chapter heading has style of the locale associated with the module, or else
    // current program locale if no associated locale is installed. But notice-link 
    // is always cs-module style.
    var html = "";
    html  = "<div class=\"chapterhead" + (ch==1 ? " chapterfirst":"") + " cs-" + l + "\" headdir=\"" + (LocaleConfigs[l].direction) + "\">";
    
    html +=   "<div class=\"chapnotice cs-" + mod + "\" empty=\"" + (lt ? "false":"true") + "\">";
    html +=     "<div class=\"noticelink-c\">" + (lt ? lt:"") + "</div>";
    html +=     "<div class=\"noticetext\">" + (lt ? LibSword.getModuleInformation(mod, "NoticeText"):"") + "</div>";
    html +=     "<div class=\"head-line-break\"></div>";
    html +=   "</div>";

    html +=   "<div class=\"chaptitle\" >";
    html +=     "<div class=\"chapbk\">" + b.GetStringFromName(bk) + "</div>";
    html +=     "<div class=\"chapch\">" + getLocalizedChapterTerm(bk, ch, b, l) + "</div>";
    html +=   "</div>";

    html +=   "<div class=\"chapinfo\">";
    html +=     "<div class=\"listenlink\"></div>";
    html +=     "<div class=\"introlink\" empty=\"" + (intro ? "false":"true") + "\">" + b.GetStringFromName("IntroLink") + "</div>";
    html +=   "</div>";
    
    html += "</div>";
    
    html += "<div class=\"head-line-break\"></div>";
    
    html += "<div class=\"introtext\" empty=\"" + (intro ? "false":"true") + "\">" + (intro ? intro :"") + "</div>";
    
    return html;
  },

  getNotesHTML: function(notes, mod, gfn, gcr, gun, openCRs, w) {
    if (!notes) return "";
    
    if (!w) w = 0; // w is only needed for unique id creation 
    
    var note = notes.split(/(<div class="nlist" [^>]*>.*?<\/div>)/);
    note = note.sort(this.ascendingVerse);
    
    // Start building our html
    var t = ""; 
    
    if (note) {

      // Now parse each note in the chapter separately
      for (var n=0; n < note.length; n++) {
        if (!note[n]) continue;

        var m = note[n].match(/(<div class="nlist" [^>]*>(.*?)<\/div>)/);
        var body = m[2];
        
        var p = getElementInfo(note[n]);
        
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
        t += "<div id=\"w" + w + ".footnote." + p.ntype + "." + p.nid + "." + p.osisref + "." + p.mod + "\" ";
        t += "title=\"" + p.nid + "." + p.osisref + "." + p.mod + "\" ";
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
          t +=   "<a class=\"fnlink\" title=\"" + p.nid + "." + p.osisref + "." + p.mod + "\">";
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
          t += this.getRefHTML(w, mod, body);
          break;
        
        case "fn":
          // If this is a footnote, then just write the body
          t += "<span class=\"fntext cs-" + mod + (ModuleConfigs[mod].direction != ProgramConfig.direction ? " opposing-program-direction":"") + "\">" + body + "</span>";
          break;
        
        case "un":
          // If this is a usernote, then add direction entities and style
          var unmod = null;
          try {
            unmod = BMDS.GetTarget(BM.RDF.GetResource(decodeUTF8(p.nid)), BM.gBmProperties[NOTELOCALE], true);
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
  
  getRefHTML: function(w, mod, body) {
    var ref = body.split(";");
    var html = "";
    var sep = "";
    
    for (var i=0; i<ref.length; i++) {
      if (!ref[i]) continue;
      
      var r = normalizeOsisReference(ref[i], mod);
      if (!r) continue;
      
      var aVerse = findAVerseText(mod, r, w);
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
  
  ascendingVerse: function(a,b) {
    var t1 = "un"; 
    var t2 = "fn"; 
    var t3 = "cr";
    if (!a) return 1;
    if (!b) return -1;
    
    var pa = getElementInfo(a);
    var pb = getElementInfo(b);

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
  getBookIntroduction: function(mod, bk) {
    if (!Tab[mod] || (Tab[mod].modType != BIBLE && Tab[mod].modType != COMMENTARY)) return "";
    LibSword.setGlobalOption("Headings", "On");
    var intro = LibSword.getBookIntroduction(mod, bk);
    LibSword.setGlobalOption("Headings", prefs.getCharPref("Headings"));
    return intro;
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
      var icon = icons[i];
//icon.style.visibility = "visible"; continue;
      if (MainWindow.getAudioForChapter(Texts.display[w].mod, Texts.display[w].bk, Texts.display[w].ch, AudioDirs))
          icon.style.visibility = "visible";
    }
  }

};

