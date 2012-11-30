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
      
      // Get the appropriate original language module
      var mod2 = prefs.getCharPref("DefaultVersion");
      if (findBookNum(d.bk) < NumOT && Tab.ORIG_OT) {
        mod2 = Tab.ORIG_OT.modName;
      }
      else if (findBookNum(d.bk) >= NumOT && Tab.ORIG_NT) {
        mod2 = Tab.ORIG_NT.modName;
      }
      
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
    var tl = ModuleConfigs[d.mod].AssociatedLocale;
    if (tl == NOTFOUND) {tl = getLocale();}
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
      while (vf && (vf.style.display == "none" || !vf.title || !(/^vs\./).test(vf.title))) {
        vf = vf.nextSibling;
      }
      
      // get last chapter/verse
      var vl = sb.lastChild;
      while (vl && (vl.offsetLeft >= sb.offsetWidth || !vl.title || !(/^vs\./).test(vl.title))) {
        vl = vl.previousSibling;
      }

      if (vf) vf = vf.title.split(".");
      if (vl) vl = vl.title.split(".");
      
      // hide footnotes whose references are scrolled off the window
      if (nb.innerHTML) {
        // vf and vl id has form: vs.Gen.1.1
        // note id has form: w1.body.fn.1.Gen.1.1.KJV
        var nt = nb.getElementsByClassName("fnrow");
        for (var i=0; i<nt.length; i++) {
          
          var value = "";
          var inf = nt[i].id.split(".");
    
          if (vf && 
             (Number(inf[5]) < Number(vf[2]) ||
             (Number(inf[5]) == Number(vf[2]) && Number(inf[6]) < Number(vf[3])))) {
            value = "none";
          }
            
          if (vl &&
             (Number(inf[5]) > Number(vl[2]) ||
             (Number(inf[5]) == Number(vl[2]) && Number(inf[6]) > Number(vl[3])))) {
            value = "none";
          }
         
          nt[i].style.display = value;
          if (!value) havefn = true;
        }
      }
    }
    else if (nb.innerHTML) havefn = true;
  
    return havefn;
  },
  
  // This function is only for versekey modules (BIBLE, COMMENTARY)
  getChapterHeading: function(bk, ch, mod, w) {
    var l = ModuleConfigs[mod].AssociatedLocale;
    if (l == NOTFOUND) {l = getLocale();} // otherwise use current program locale
    var b = getLocaleBundle(l, "books.properties");

    var intro = (ch != 1 ? "":BibleTexts.getBookIntroduction(mod, bk));
    
    // Remove empty intros that may be generated by old paratext2Osis.pl
    if (intro && !intro.replace(/<[^>]+>/g,"").match(/\S/)) intro=null;
    
    var lt = Bible.getModuleInformation(mod, "NoticeLink");
    if (lt == NOTFOUND) lt = "";
    else lt = lt.replace("<a>", "<a class='noticelink'>");
    
    // Chapter heading has style of the locale associated with the module, or else
    // current program locale if no associated locale is installed. But notice-link 
    // is always cs-module style.
    var html = "";
    html  = "<div class=\"chapterhead" + (ch==1 ? " chapterfirst":"") + " cs-" + l + "\" headdir=\"" + (LocaleConfigs[l].direction) + "\">";
    
    html +=   "<div class=\"noticelink-c cs-" + mod + "\" empty=\"" + (lt ? "false":"true") + "\">" + lt;
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
    
    return html;
  },

  getNotesHTML: function(notes, mod, gfn, gcr, gun, openCRs, w) {
    if (!notes) return "";
    
    if (!w) w = 0;
    
    var note = notes.split(/(<div [^>]*>.*?<\/div>)/);
    note = note.sort(this.ascendingVerse);
    
    // Start building our html
    var t = ""; 
    
    if (note) {

      // Now parse each note in the chapter separately
      for (var n=0; n < note.length; n++) {
        if (!note[n]) continue;

        var p = note[n].match(/<div title="(src\.[^"]+)">(.*?)<\/div>/);
        var body = p[2];
        var noteid = p[1].match(XSNOTE);
        
        // Check if this note should be displayed here, and if not then continue
        var noteType = noteid[1];
        switch (noteType) {
        case "fn":
          if (!gfn) noteType = null;
          break;
        case "cr":
          if (!gcr) noteType = null;
          break;
        case "un":
          if (!gun) noteType = null;
        }
        if (!noteType) {continue;}
        
        // Now display this note as a row in the main table
        t += "<div id=\"w" + w + ".footnote." + noteid[1] + "." + noteid[2] + "\" class=\"fnrow " + (openCRs ? "cropened":"crclosed") + "\">";
        
        // Write cell #1: an expander link for cross references only
        t +=   "<div class=\"fncol1\">";
        if (noteType == "cr") {
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
        if (Number(noteid[5]) && Number(noteid[6])) {
          t +=   "<a class=\"fnlink\" title=\"" + noteid[2] + "\">";
          t +=     "<i>" + dString(noteid[5], lov) + ":" + modDirectionEntity + dString(noteid[6], lov) + "</i>";
          t +=   "</a>";
          t +=   " -";
        }
        t +=   "</div>";
        
        // Write cell #5: note body
        t +=   "<div class=\"fncol5\">";
        
        switch(noteType) {
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
            unmod = BMDS.GetTarget(BM.RDF.GetResource(decodeUTF8(noteid.match(/un\.(.*?)\./)[1])), BM.gBmProperties[NOTELOCALE], true);
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
    var res=null;
    var t1="un"; 
    var t2="fn"; 
    var t3="cr";
    if (a==null || a=="") return 1;
    if (b==null || b=="") return -1;

    var av = Number(a.match(XSNOTE)[6]);
    var bv = Number(b.match(XSNOTE)[6]);
    var ac = Number(a.match(XSNOTE)[5]);
    var bc = Number(b.match(XSNOTE)[5]);
    if (ac == bc) {
      if (av == bv) {
        var at = a.match(/title="src\.(\w\w)/)[1];
        var bt = b.match(/title="src\.(\w\w)/)[1];
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
  
  SelectedNote:null,
  
  scroll2Note: function(id) {
    // unhilight any hilighted note
    if (BibleTexts.SelectedNote) BibleTexts.SelectedNote.className = BibleTexts.SelectedNote.className.replace(" fnselected", "");
    
    // hilight new note
    this.SelectedNote = document.getElementById(id);
    if (!this.SelectedNote) return;
    this.SelectedNote.className += " fnselected";
    
    // scroll to new note
    document.getElementById(id).scrollIntoView();
    document.getElementsByTagName("body")[0].scrollTop = 0; // prevent scrollIntoView from scrolling body too!
  },
  
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

// Make sure MainWindow has access to our objects
if (MainWindow) {
  if (typeof(MainWindow.BibleTexts) == "undefined") MainWindow.BibleTexts = BibleTexts;
}
