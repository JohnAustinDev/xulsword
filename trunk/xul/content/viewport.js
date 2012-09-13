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

var ViewPort = {
  
  load: function() {
    // set default prefs
    getPrefOrCreate("NumDisplayedWindows", "Int", 2);
    
    getPrefOrCreate("ShowChooser", "Bool", true);
    
    for (var w=1; w<=3; w++) {
      getPrefOrCreate("ShowOriginal" + w, "Bool", false);
      getPrefOrCreate("IsPinned" + w, "Bool", false);
      getPrefOrCreate("NoteBoxHeight" + w, "Int", 200);
      getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
      if (!Tab[getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"))])
          prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
    }
    
    // set font sizes
    pullFontSizesFromCSS();
    this.adjustFont(getPrefOrCreate('FontSize', "Int", 0));

    // draw tabs
    for (w=1; w<=NW; w++) {this.drawTabs(w);}
    
    for (w=1; w<=NW; w++) {
      for (var t=0; t<Tabs.length; t++) {
        var inhide = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
        if (inhide.test(getPrefOrCreate("w" + w + ".hidden", "char", ""))) Tabs[t]["w" + w + ".hidden"] = true;
        else Tabs[t]["w" + w + ".hidden"] = false;
      }
    }
    
    // set mouse wheel listeners
    document.getElementById("biblebooks_nt").addEventListener("DOMMouseScroll", wheel, false);
    document.getElementById("biblebooks_ot").addEventListener("DOMMouseScroll", wheel, false);
    var sb = document.getElementsByClassName("sb");
    for (var i=0; i<sb.length; i++) {
      sb[i].addEventListener("DOMMouseScroll", MainWindow.scrollwheel, false);
    }

  },

  // This function updates the viewport based on all previously set global
  // user settings. It does not set/change any global paramters, but only
  // implements them in the viewport. Ideally, updates should be implemented
  // with CSS.
  update: function(skipBibleChooserTest) {
    var winh = getPrefOrCreate("ViewPortHeight", "Int", window.innerHeight);
    
  jsdump("UPDATING VIEW PORT h=" + winh);
    // Read CSS constant rules
    var rule = getCSS(".tab {");
    var tabheight = Number(rule.style.height.match(/^(\d+)\s*px/)[1]);
    rule = getCSS("#tabrow {");
    tabheight += Number(rule.style.paddingTop.match(/^(\d+)\s*px/)[1]);
    rule = getCSS("#viewportbody {");
    var padtop = Number(rule.style.paddingTop.match(/^(\d+)\s*px/)[1]);
    var padbot = Number(rule.style.paddingBottom.match(/^(\d+)\s*px/)[1]);
    rule = getCSS(".hd {");
    var headheight = Number(rule.style.height.match(/^(\d+)\s*px/)[1]);
    rule = getCSS(".fr {");
    var footheight = Number(rule.style.height.match(/^(\d+)\s*px/)[1]);

    // Reset those CSS rules which depend on window height
    var betc = 10; //borders n stuff
    var sbh = winh - padtop - tabheight - headheight - padbot - betc - footheight;
    if (sbh < 100) sbh = 100;

    rule = getCSS(".sb {");
    rule.style.height = sbh + "px";

    var bbh = 18; // boundary bar's height+borders+margin
    for (var w=1; w<=NW; w++) {
      var nbh = prefs.getIntPref("NoteBoxHeight" + w);
      if (nbh > sbh) nbh = sbh;
      
      rule = getCSS("#text" + w + "[columns=\"show1\"][foot^=\"show\"] .sb {");
      rule.style.marginBottom = Number(nbh) + "px";
      rule.style.height = Number(sbh - nbh) + "px";
      
      rule = getCSS("#text" + w + " .nbc > div {");
      rule.style.height = nbh + "px";
      
      rule = getCSS("#text" + w + " .nb {");
      var margt = Number(rule.style.marginTop.match(/^(\d+)\s*px/)[1]);
      var margb = Number(rule.style.marginBottom.match(/^(\d+)\s*px/)[1]);
      rule.style.height = Number(nbh - margt - margb - bbh) + "px";
    }

    rule = getCSS("#text1[foot=\"showmax\"]:not([columns=\"show1\"]) .nbc > div,");
    rule.style.height = sbh + "px";
    rule = getCSS("#text1[foot=\"showmax\"]:not([columns=\"show1\"]) .nb,");
    rule.style.height = Number(sbh - margt - margb - bbh) + "px"; // margt & margb set above (all windows are same)

    // this is not so important, but line up CA background pattern:
    rule = getCSS("#fadebot {");
    rule.style.backgroundPosition = "0px " + Number((document.getElementById("biblechooser").offsetHeight + document.getElementById("fadetop").offsetHeight) % 55) + "px";
    
    // Bible chooser
    var chooser = (this.needBookChooser() ? "book":(prefs.getBoolPref("ShowChooser") ? "bible":"hide"));
    document.getElementById("viewportbody").setAttribute("chooser", chooser);
    MainWindow.document.getElementById("genBookChooser").setAttribute("hidden", (chooser == "book" ? "false":"true"));

    var lbn = findBookNum(Location.getBookName());
    if (!skipBibleChooserTest) document.getElementById("biblechooser").setAttribute("showing", (lbn >= NumOT ? "nt":"ot"));

    for (var b=0; b<NumBooks; b++) {
      var chel = document.getElementById("book_" + b);
      if (chel) chel.setAttribute("selected", (b==lbn ? "true":"false"));
    }
    
    if (chooser != "hide") {
      var faderheight = padtop + tabheight;
      var chooserheight = document.getElementById("biblebooks_nt").offsetHeight;
      if (chooserheight > sbh) chooserheight = sbh;
      else faderheight += Math.floor(0.3*(sbh - chooserheight));
      var rulef = getCSS("#fadetop, #fadebot {");
      rulef.style.height = faderheight + "px";

      var rulec = getCSS("#biblechooser {");
      if (rulec.style.height != chooserheight + "px") 
          document.getElementById("biblebooks_nt").style.top = "8px";
      rulec.style.height = chooserheight + "px";

      document.getElementById("fadebot").style.height = Number(winh - faderheight - chooserheight) + "px";

      var ntw = document.getElementById("biblebooks_nt");
      var otw = document.getElementById("biblebooks_ot");
      otw.style.width = "";
      ntw.style.width = "";
      if (ntw.offsetWidth > otw.offsetWidth) otw.style.width = Number(ntw.offsetWidth - 2) + "px";
      else ntw.style.width = Number(otw.offsetWidth - 2) + "px";
      rulef.style.width = Number(otw.offsetLeft + otw.offsetWidth + 20) + "px";
      rulec.style.width = Number(otw.offsetLeft + otw.offsetWidth - 6) + "px";
    }
    
    // Tab row
    document.getElementById("tabrow").setAttribute("windows", "show" + prefs.getIntPref("NumDisplayedWindows"));
   
    // Windows
    var dw = prefs.getIntPref("NumDisplayedWindows");
    
    for (var w=1; w<=NW; w++) {
      var value = "show1";
      if (w > dw) value = "hide";
      else {
        if ((w+1) <= dw && 
            Tab[prefs.getCharPref("Version" + w)].modType==BIBLE &&
            !prefs.getBoolPref("ShowOriginal" + w) && !prefs.getBoolPref("ShowOriginal" + (w+1)) &&
            prefs.getCharPref("Version" + w) == prefs.getCharPref("Version" + Number(w+1)))
            value = "show2";
        if (value == "show2" && w+2 <= dw && 
            !prefs.getBoolPref("ShowOriginal" + (w+2)) &&
            prefs.getCharPref("Version" + Number(w+1)) == prefs.getCharPref("Version" + Number(w+2)))
            value = "show3";
      }
      
      document.getElementById("text" + w).setAttribute("columns", value);
       
      if (value == "show2") {
        w++;
        document.getElementById("text" + w).setAttribute("columns", "hide");
      }
      if (value == "show3") {
        w++;
        document.getElementById("text" + w).setAttribute("columns", "hide");
        w++;
        document.getElementById("text" + w).setAttribute("columns", "hide");
      }
    }
  //for (w=1; w<=NW; w++) {jsdump("w=" + w + ", value=" + document.getElementById("text" + w).getAttribute("columns"));}
   
    // Window pins
    for (w=1; w<=NW; w++) {
      var type = Tab[prefs.getCharPref("Version" + w)].modType;
      if (type == BIBLE || type == COMMENTARY) {
        document.getElementById("text" + w).setAttribute("pin", (prefs.getBoolPref("IsPinned" + w) ? "pinned":"unpinned"));
      }
      else document.getElementById("text" + w).setAttribute("pin", "hide");
    }
    
    // Footnote boxes
    for (w=1; w<=NW; w++) {
      value = "hide";
      var type = Tab[prefs.getCharPref("Version" + w)].modType;
      
      if (type == DICTIONARY) value = "show";
      
      if (type == BIBLE) {
        
        var gfn = (prefs.getCharPref("Footnotes") == "On" && prefs.getBoolPref("ShowFootnotesAtBottom"));
        var gcr = (prefs.getCharPref("Cross-references") == "On" && prefs.getBoolPref("ShowCrossrefsAtBottom"));
        var gun = (prefs.getCharPref("User Notes") == "On" && prefs.getBoolPref("ShowUserNotesAtBottom"));
        
        if ((gfn || gcr || gun)) value = "show";
        
      }
      
      if (value == "show" && prefs.getBoolPref("MaximizeNoteBox" + w)) value = "showmax";
      document.getElementById("text" + w).setAttribute("foot", value);

    }
    
    // Individual tabs
    // start with all chosen tabs showing in the multi-tab (except ORIG tab)
    var oldmts = [null, null, null, null];
    for (w=1; w<=NW; w++) {
      
      // orig tab
      if (prefs.getBoolPref("ShowOriginal" + w)) 
          document.getElementById("w" + w + ".tab.orig").setAttribute("active", "true");
      else
          document.getElementById("w" + w + ".tab.orig").setAttribute("active", "false");
       
      // all other tabs
      document.getElementById("w" + w + ".multitab").style.display = "";
      document.getElementById("w" + w + ".multitab").style.visibility = "";
      var pinattrib = (prefs.getBoolPref("IsPinned" + w) ? "true":"false");
      for (var t=0; t<Tabs.length; t++) {
        var normtab = document.getElementById("w" + w + ".tab.norm." + t);
        var multtab = document.getElementById("w" + w + ".tab.mult." + t);
     
        if (multtab.selected) oldmts[w] = t;
        multtab.selected = false;
        
        normtab.setAttribute("pinned", pinattrib);
        multtab.setAttribute("pinned", pinattrib);
        
        if (Tabs[t].modName == prefs.getCharPref("Version" + w)) {
          normtab.setAttribute("active", "true");
        }
        else {
          normtab.setAttribute("active", "false");
        }
        
        if (Tabs[t]["w" + w + ".hidden"]) {
          normtab.style.display = "none";
          multtab.style.display = "none";
        }
        else {
          normtab.style.display = "none";
          multtab.style.display = "";
        }

      }
    }

    // move tabs into the tab row until it is full
    for (w=1; w<=NW; w++) {
      
      var trw = document.getElementById("tabs" + w).offsetWidth;
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t]["w" + w + ".hidden"]) continue;
        document.getElementById("w" + w + ".tab.norm." + t).style.display = "";
        document.getElementById("w" + w + ".tab.mult." + t).style.display = "none";
        if (document.getElementById("tabs" + w).offsetWidth > trw) break;
      }
      
      if (t >= Tabs.length-1) document.getElementById("w" + w + ".multitab").style.display = "none";
      else {
        // then turn on the multi-tab
        document.getElementById("w" + w + ".tab.norm." + t).style.display = "none";
        document.getElementById("w" + w + ".tab.mult." + t).style.display = "";
        
        // select milti-tab text and style etc.
        var st = null;
        for (t=0; t<Tabs.length; t++) {
          var tt = document.getElementById("w" + w + ".tab.mult." + t);
          if (tt.style.display == "none") continue;
          if (!st) st = tt;
          if (oldmts[w] && t == oldmts[w]) st = tt;
          if (Tabs[t].modName == prefs.getCharPref("Version" + w)) {
            st = tt;
            break;
          }
        }
        st.selected = true; // always select a tab
        st.style.display = "none"; // don't need selected tab in list because it's showing in tab now
        document.getElementById("w" + w + ".tabselect").className = st.className; // so milti-tab looks like selected tab
        if (t == Tabs.length) document.getElementById("w" + w + ".tabselect").setAttribute("active", "false");
        else document.getElementById("w" + w + ".tabselect").setAttribute("active", "true");
      }
      
    }

//var d="Ndis=" + dw; for (w=1; w<=NW; w++) {d+=", text" + w + "=" + document.getElementById("text" + w).getAttribute("foot");} jsdump(d);

  },

  drawTabs: function(w) {
    
    // special ORIG tab
    var orig = "";
    orig += "<input type=\"button\" class=\"tab tabTexts\" ";
    orig += "id=\"w" + w + ".tab.orig\" value=\"" + SBundle.getString("ORIGLabelTab") + "\" ";
    orig += "title=\"\"" + (!MainWindow.HaveOriginalTab ? " style=\"display:none;\"":"") + "></button>";

    var html = "";
    for (var t=0; t<Tabs.length; t++) {
      
      // insert ORIG tab after BIBLEs
      if (Tabs[t].modType != BIBLE && orig) {
        html += orig;
        orig = null;
      }
      
      html += "<input type=\"button\" class=\"tab tab" + Tabs[t].tabType + "\" ";
      html += "id=\"w" + w + ".tab.norm." + t + "\" value=\"" + Tabs[t].label + "\" ";
      html += "title=\"" + Tabs[t].description + "\"></button>";
    }
    
    // The multi-tab tab is a pulldown to hold all tabs which don't fit.
    html += "<div id = \"w" + w + ".multitab\" class=\"multitab\">"; // to stack two buttons...
    
    html +=   "<select id=\"w" + w + ".tabselect\" class=\"tab\">";
    for (t=0; t<Tabs.length; t++) {
      html +=   "<option id=\"w" + w + ".tab.mult." + t + "\" class=\"tab tab" + Tabs[t].tabType + "\">";
      html +=   Tabs[t].label + "</option>";
    }
    html +=   "</select>";
    
    // a div is needed to capture tab selection clicks and prevent activation of pulldown menu
    html +=   "<div id=\"w" + w + ".tab.tsel\"></div>";
    
    html += "</div>";
    
    document.getElementById("tabs" + w).innerHTML = html;
  },

  needBookChooser: function() {
    try {
      for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
        var m = prefs.getCharPref("Version" + w);
        if (Tab[m].modType == GENBOOK) return true;     
      }
    } catch(er) {}
    
    return false;
  },

  adjustFont: function(f) {
    adjustFontSizes(f, [".tab {"]);
  },

  unload: function() {
    
    // save hidden tab prefs
    for (var w=1; w<=NW; w++) {
      var hide = "";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t]["w" + w + ".hidden"]) hide += Tabs[t].modName + ";";
      }
      prefs.setCharPref("w" + w + ".hidden", hide);
    }
    
  }

}
