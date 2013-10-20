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

function initViewPort() {
  initCSS();
  
  // If this is the main xulsword ViewPort, use prefs as initial settings
  if (document === MainWindow.document.getElementById("main-viewport").contentDocument) {
    
    ViewPort = new ViewPortObj(); // uses prefs
    
    // this context's text objects here become program-wide globals.
    MainWindow.ViewPort = ViewPort;
    MainWindow.Texts = Texts;
    MainWindow.BibleTexts = BibleTexts;
    MainWindow.DictTexts = DictTexts;
    MainWindow.CommTexts = CommTexts;
    MainWindow.GenBookTexts = GenBookTexts;
    
  }
  
  // Else if this is the printing viewport
  else if (document === MainWindow.document.getElementById("printBrowser").contentDocument) {
  
    document.getElementsByTagName("body")[0].setAttribute("print", "true");
  
    ViewPort = new ViewPortObj(MainWindow.ViewPort);
      
    Texts.update(SCROLLTYPETOP, HILIGHTNONE, [null, 1, 1, 1]);
    
    MainWindow.printBrowserLoaded();
    
  }
  
  // Otherwise it's a windowed viewport
  else {
 
    // for windowed viewport, use settings of MainWindow.ViewPort, but
    // show only the window whose towindow button was clicked
    
    document.getElementsByTagName("body")[0].setAttribute("isWindow", "true");
    
    ViewPort = new ViewPortObj(MainWindow.ViewPort);
    
    // here we copy MainWindow viewportbody html directly (and use only 
    // ViewPort.update rather than Texts.update below), because although
    // a usual Texts.update would re-create the exact window most of the 
    // time, it would not do so for certain hilighted-verse windows. 
    document.getElementById("viewportbody").innerHTML = MainWindow.ViewPort.ownerDocument.getElementById("viewportbody").innerHTML;
    
    // this copied viewport should have only one text window showing: towindow...
    // This window should be pinned if it's pinable, and all other windows should 
    // have their moduleType set to "none".
    var towindow;
    if (!MainWindow.ViewPort.hasOwnProperty("towindow") || !MainWindow.ViewPort.towindow)
        towindow = 1;
    else towindow = MainWindow.ViewPort.towindow;

    for (var w=1; w<=NW; w++) {
      if (w == towindow) {
        // pinning is not supported for Dict modules, but others should 
        // be pinned (at least to start with, though user may unpin it)
        if (Tab[ViewPort.Module[w]].modType != DICTIONARY) {
					// the following method of getting wl only works because we copied  
					// MainWindow viewportbody html (this ViewPort has not been updated yet).
          var wl = MainWindow.ViewPort.ownerDocument.getElementById("text" + w).getAttribute("columns").match(/^show(\d+)$/);
          wl = towindow + Number(wl[1]) - 1;
          while (w <= wl) {
						ViewPort.IsPinned[w] = true;
						w++;
					}
					w--; // sit on last handled w because it will be incremented in above "for"
        }
      }
      else {
				document.getElementById("tabs" + w).setAttribute("moduleType", "none");
				document.getElementById("text" + w).setAttribute("moduleType", "none");
			}
    }

		document.getElementById("viewportbody").setAttribute("chooser", "hide");
    ViewPort.update(false);
    
  }
  
}

function ViewPortObj(viewPortObj) {

  // set mouse wheel listeners
  document.getElementById("biblebooks_nt").addEventListener("DOMMouseScroll", BibleNavigator.wheel, false);
  document.getElementById("biblebooks_ot").addEventListener("DOMMouseScroll", BibleNavigator.wheel, false);
  document.getElementById("textrow").addEventListener("DOMMouseScroll", MouseWheel.scroll, false);

  this.drawTabs = function(w) {

    // special ORIG tab
    var orig = "";
    orig += "<input type=\"button\" class=\"tab tabTexts tabOrig\" ";
    orig += "id=\"w" + w + ".tab.orig\" value=\"" + XSBundle.getString("ORIGLabelTab") + "\" ";
    orig += "title=\"\"" + (!Tab.ORIG_NT && !Tab.ORIG_OT ? " style=\"display:none;\"":"") + "></button>";

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
    html +=   "<div class=\"multitab-clicker\" id=\"w" + w + ".tab.tsel\"></div>";

    html += "</div>";

    document.getElementById("tabs" + w).innerHTML = html;
  };

  // draw tabs
  for (w=1; w<=NW; w++) {this.drawTabs(w);}

  // If we have a passed viewPortObj, then copy it. Otherwise create 
  // a ViewPortObj from global preferences.
  if (viewPortObj) {

    // copy viewPortObj members (excluding functions) to our ViewPort
    for (var p in viewPortObj) {
      if (typeof(viewPortObj[p]) == "function") continue;
      this[p] = eval(uneval(viewPortObj[p]));
    }

    // copy MainWindow.Texts members (excluding functions) to our Texts
    var objTexts = viewPortObj.ownerDocument.defaultView.Texts;
    for (var p in objTexts) {
      if (typeof(objTexts[p]) == "function") continue;
      Texts[p] = eval(uneval(objTexts[p]));
    }
    
    this.ownerDocument = document;
  }
  
  else {
    this.ownerDocument = document;
    this.ShowOriginal = [];
    this.IsPinned = [];
    this.NoteBoxHeight = [];
    this.MaximizeNoteBox = [];
    this.Module = [];
    this.Key = [];

    // Insure we have first time startup defaults in prefs:
    getPrefOrCreate("ShowChooser","Bool",true);
    if (window.screen.width <= 800) {
      //in script.js initializeScript(), ScriptBox padding is also decreased in this case
      getPrefOrCreate("NumDisplayedWindows","Int",2);
      getPrefOrCreate("NoteBoxHeight1","Int",70);
      getPrefOrCreate("NoteBoxHeight2","Int",70);
      getPrefOrCreate("NoteBoxHeight3","Int",70);
      getPrefOrCreate("FontSize","Int",-4);
    }
    else if (window.screen.width <= 1024) {
      getPrefOrCreate("NumDisplayedWindows","Int",2);
      getPrefOrCreate("NoteBoxHeight1","Int",100);
      getPrefOrCreate("NoteBoxHeight2","Int",100);
      getPrefOrCreate("NoteBoxHeight3","Int",100);
      getPrefOrCreate("FontSize","Int",-2);
    } 
    else {
      getPrefOrCreate("NumDisplayedWindows","Int",2);
      getPrefOrCreate("NoteBoxHeight1","Int",200);
      getPrefOrCreate("NoteBoxHeight2","Int",200);
      getPrefOrCreate("NoteBoxHeight3","Int",200);
      getPrefOrCreate("FontSize","Int",0);
    }
    
    this.NumDisplayedWindows = prefs.getIntPref("NumDisplayedWindows");
    this.ShowChooser = prefs.getBoolPref("ShowChooser");
    
    for (var w=1; w<=3; w++) {
      this.ShowOriginal[w] = getPrefOrCreate("ShowOriginal" + w, "Bool", false);
      this.IsPinned[w] = false;
      this.NoteBoxHeight[w] = getPrefOrCreate("NoteBoxHeight" + w, "Int", 200);
      this.MaximizeNoteBox[w] = getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
      this.Module[w] = getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"));
      this.Key[w] = getPrefOrCreate("Key" + w, "Unicode", "");
    }
    
    //Check xulsword module choices
    for (var w=1; w<=NW; w++) {
      // modules may have been manually uninstalled since xulsword's last 
      // shutdown, so "Version" prefs must always be checked on startup
      if (!Tab.hasOwnProperty(this.Module[w])) this.Module[w] = prefs.getCharPref("DefaultVersion");
      
      if (SpecialModules.DailyDevotion.hasOwnProperty(this.Module[w])) this.Key[w] = "DailyDevotionToday";
      
      if (!Tab.ORIG_NT && !Tab.ORIG_OT) this.ShowOriginal[w] = false;
      
    }
    
    // show/hide global tabs based on prefs
    for (w=1; w<=NW; w++) {
      for (var t=0; t<Tabs.length; t++) {
        var inhide = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
        if (inhide.test(getPrefOrCreate("w" + w + ".hidden", "Char", ""))) Tabs[t]["w" + w + ".hidden"] = true;
        else Tabs[t]["w" + w + ".hidden"] = false;
      }
    }

  }

  // This function updates the viewport based on all previously set ViewPort
  // user settings. It does not set/change any such paramters, but only
  // implements them in the viewport. Ideally, all presentation code
  // should be done using CSS, and here we only set applicable attributes
  // classes, values etc.
  this.update = function(skipBibleChooserTest) {
  
    if (this != MainWindow.ViewPort) {
      for (var w=1; w<=NW; w++) {
        if (document.getElementById("tabs" + w).getAttribute("moduleType") != "none" && window.frameElement) {
          window.frameElement.ownerDocument.title = fixWindowTitle(Tab[this.Module[w]].label) + 
              (Tab[this.Module[w]].description ? ": " + Tab[this.Module[w]].description:"");
          break;
        }
      }
    }

    // Tab row attribute
    document.getElementById("textarea").setAttribute("windows", "show" + this.NumDisplayedWindows);
    
    // Windows
    for (var w=1; w<=NW; w++) {
      var value = "show1";
      if (w > this.NumDisplayedWindows || 
					document.getElementById("text" + w).getAttribute("moduleType") == "none") {
				value = "hide";
			}
      else {
				   
        if ((w+1) <= this.NumDisplayedWindows && 
						document.getElementById("text" + (w+1)).getAttribute("moduleType") != "none" &&
            Tab[this.Module[w]].modType == BIBLE &&
            !this.ShowOriginal[w] && 
            !this.ShowOriginal[(w+1)] &&
            this.IsPinned[w] == this.IsPinned[(w+1)] && 
            this.Module[w] == this.Module[Number(w+1)])
            value = "show2";
            
        else if ((w+1) <= this.NumDisplayedWindows && 
						document.getElementById("text" + (w+1)).getAttribute("moduleType") != "none" &&
            (Tab[this.Module[w]].modType == COMMENTARY || Tab[this.Module[w]].modType == GENBOOK) &&
            this.IsPinned[w] == this.IsPinned[(w+1)] && 
            this.Module[w] == this.Module[Number(w+1)])
            value = "show2";

        if (value == "show2" && w+2 <= this.NumDisplayedWindows && 
						document.getElementById("text" + (w+2)).getAttribute("moduleType") != "none" &&
            !this.ShowOriginal[(w+2)] &&
            this.IsPinned[Number(w+1)] == this.IsPinned[Number(w+2)] &&
            this.Module[Number(w+1)] == this.Module[Number(w+2)])
            value = "show3";
      }
    
      // Firefox 16 has a bug where RTL column CSS does not scroll. The work
      // around at this time is to prohibit RTL multi-columns.
      //if ((ModuleConfigs[this.Module[w]].direction == "rtl" || ProgramConfig.direction == "rtl" )&& (/^show(2|3)$/).test(value)) value = "show1";
      
      // As of Firefox 17, CSS columns are not supported in print. For this
      // reason a WYSIWYG print routine is impossible. The workaround is to
      // change all multi-column windows into single column windows for print.
      var valueThis = value;
      var wThis = w;
      if ((/^show(2|3)$/).test(value) && document.getElementsByTagName("body")[0].getAttribute("print") == "true") {
        var n = Number(value.match(/\d+/)[0]);
        valueThis = "show1";
        var sw = Number(document.getElementById("textarea").getAttribute("windows").match(/\d+/)[0]);
        document.getElementById("textarea").setAttribute("windows", "show" + (sw - n + 1));
      }
      
      // Set this window's number of columns
      var t = document.getElementById("text" + wThis);
      t.setAttribute("columns", valueThis);
      
      // Set linked windows to hide
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
      
      // Set this window's and tab's type
      var mtype = getShortTypeFromLong(Tab[this.Module[wThis]].modType);
      if (t.getAttribute("moduleType") != "none") {
				t.setAttribute("moduleType", mtype);
			}
			var tabs = document.getElementById("tabs" + wThis);
			if (tabs.getAttribute("moduleType") != "none") {
				tabs.setAttribute("moduleType", mtype);
			}
      
      // Set this window's next/prev links
      var prev = true;
      var next = true;
      switch(Tab[this.Module[wThis]].modType) {
        case BIBLE:
        case COMMENTARY:
          if ((/^show1$/).test(t.getAttribute("columns"))) {
            prev = MainWindow.XulswordController.isCommandEnabled("cmd_xs_previousChapter");
            next = MainWindow.XulswordController.isCommandEnabled("cmd_xs_nextChapter");
          }
          break
        case DICTIONARY:
        case GENBOOK:
          prev = true;
          next = true;
          break;
      }
      t.setAttribute("CanDoNextPage", next);
      t.setAttribute("CanDoPreviousPage", prev);
      
      // Set this window's textdir
      t.setAttribute("textdir", ModuleConfigs[this.Module[wThis]].direction);

    }
//for (w=1; w<=NW; w++) {jsdump("w=" + w + ", value=" + document.getElementById("text" + w).getAttribute("columns"));}
    
    // Pins
    for (w=1; w<=NW; w++) {
      document.getElementById("text" + w).setAttribute("pinned", (this.IsPinned[w] ? "true":"false"));
      document.getElementById("tabs" + w).setAttribute("pinned", (this.IsPinned[w] ? "true":"false"));
    }
    
    // Footnote boxes
    for (w=1; w<=NW; w++) {
      var nb = document.getElementById("note" + w);
      document.getElementById("text" + w).setAttribute("footnotesEmpty", !BibleTexts.checkNoteBox(w));
      document.getElementById("text" + w).setAttribute("footnotesMaximized", this.MaximizeNoteBox[w]);
    }
    
    // Size layout and Graphical Bible Navigator (chooser) correctly. This routine
    // may require that certain ViewPort attributes be already updated (done above).
    this.hackedResizing(skipBibleChooserTest);
    
    // Individual tabs
    // start with all chosen tabs showing in the multi-tab (except ORIG tab)
    var oldmts = [null, null, null, null];
    for (w=1; w<=NW; w++) {
      
      // orig tab
      if (this.ShowOriginal[w]) 
          try {document.getElementById("w" + w + ".tab.orig").setAttribute("active", "true");} catch (er) {}
      else
          try {document.getElementById("w" + w + ".tab.orig").setAttribute("active", "false");} catch (er) {}
       
      // all other tabs
      document.getElementById("w" + w + ".multitab").style.display = "";
      document.getElementById("w" + w + ".multitab").style.visibility = "";
      var noBibleTabs = true;
      for (var t=0; t<Tabs.length; t++) {
        var normtab = document.getElementById("w" + w + ".tab.norm." + t);
        var multtab = document.getElementById("w" + w + ".tab.mult." + t);
     
        if (multtab.selected) oldmts[w] = t;
        multtab.selected = false;
        
        if (Tabs[t].modName == this.Module[w]) {
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
          if (Tabs[t].modType == BIBLE) noBibleTabs = false;
        }

      }
      
      document.getElementById("tabs" + w).setAttribute("noBibleTabs", noBibleTabs);
      
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
        
        // select multi-tab text and style etc.
        var st = null;
        for (t=0; t<Tabs.length; t++) {
          var tt = document.getElementById("w" + w + ".tab.mult." + t);
          if (tt.style.display == "none") continue;
          if (!st) st = tt;
          if (oldmts[w] && t == oldmts[w]) st = tt;
          if (Tabs[t].modName == this.Module[w]) {
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

//var d="NumDisplayedWindows=" + document.getElementById("textarea").getAttribute("windows"); for (w=1; w<=NW; w++) {d+=", text" + w + "=" + document.getElementById("text" + w).getAttribute("columns");} jsdump(d);

  };
  
  // Some layouts, like the Navigator dimensions and variable height
  // footnote boxes, are too complex for HTML/CSS to implement without 
  // some Javascript help. So that is all done here.
  this.padtop = 0;
  this.tabheight = 38;
  this.headheight = 30;
  this.footheight = 30;
  this.padbot = 24;
  this.bbheight = 18;
  this.hackedResizing = function(skipBibleChooserTest) {
    
    try {
      var winh = prefs.getIntPref("ViewPortHeight");
      var winw = prefs.getIntPref("ViewPortWidth");
      prefs.clearUserPref("ViewPortHeight");
      prefs.clearUserPref("ViewPortWidth");
    }
    catch (er) {
      winh = window.innerHeight;
      winw = null;
    }
//jsdump("UPDATING VIEW PORT h=" + winh);

    // Get max height of script box
    var sb_maxH = winh - this.padtop - this.tabheight - this.headheight - this.footheight - this.padbot;
    if (sb_maxH < 100) sb_maxH = 100;
    
    // Set CSS rules for script-box and note-box heights
    var r = getCSS(".sb {");
    r.rule.style.height = sb_maxH + "px";

    for (var w=1; w<=NW; w++) {
      var nbf_H = this.NoteBoxHeight[w];
      if (nbf_H > sb_maxH) nbf_H = sb_maxH;
      
      r = getCSS("#text" + w + "[moduleType=\"Texts\"][columns=\"show1\"][footnotesEmpty=\"false\"] .sb");
      r.rule.style.marginBottom = Number(nbf_H) + "px";
      r.rule.style.height = Number(sb_maxH - nbf_H) + "px";
      
      r = getCSS("#text" + w + " .nbf {");
      r.rule.style.height = nbf_H + "px";
      
      r = getCSS("#text" + w + " .nb {");
      var margt = Number(r.rule.style.marginTop.match(/^(\d+)\s*px/)[1]);
      var margb = Number(r.rule.style.marginBottom.match(/^(\d+)\s*px/)[1]);
      r.rule.style.height = Number(nbf_H - margt - margb - this.bbheight + this.footheight) + "px";
    }

    r = getCSS("#text1[footnotesMaximized=\"true\"]:not([columns=\"show1\"]) .nbf,");
    r.rule.style.height = sb_maxH + "px";
    r = getCSS("#text1[footnotesMaximized=\"true\"]:not([columns=\"show1\"]) .nb,");
    r.rule.style.height = Number(sb_maxH - margt - margb - this.bbheight + this.footheight) + "px"; // margt & margb set above (all windows are same)
    
    GenBookTexts.validateKeys();
    
    // General-Book Chooser (part of xulsword.xul but treated as part of MainWindow.ViewPort)
    var genbkinfo = GenBookNavigator.getGenBookInfo();
		
		// Bible chooser
    var chooser = (genbkinfo.unPinnedGenbkArray.length ? "book":(this.ShowChooser ? "bible":"hide"));
    MainWindow.ViewPort.ownerDocument.getElementById("viewportbody").setAttribute("chooser", chooser);
    MainWindow.document.getElementById("frameset").setAttribute("chooser", chooser);
    GenBookNavigator.update(genbkinfo); // must be done after chooser is made visible!
    
    // If this is not MainWindow.ViewPort, then we're done hacking...
    if (this !== MainWindow.ViewPort) return;
  
    var lbn = findBookNum(Location.getBookName());
    if (!skipBibleChooserTest) document.getElementById("biblechooser").setAttribute("showing", (lbn >= NumOT ? "nt":"ot"));

    for (var b=0; b<Book.length; b++) {
      var chel = document.getElementById("book_" + b);
      if (chel) chel.setAttribute("selected", (b==lbn ? "true":"false"));
    }
    
    if (chooser == "bible") {
      
      // set fader height
      var faderheight = this.padtop + this.tabheight;
      var chooserheight = document.getElementById("biblebooks_nt").offsetHeight;
      if (chooserheight > sb_maxH) chooserheight = sb_maxH;
      else faderheight += Math.floor(0.3*(sb_maxH - chooserheight));
      
      var rf = getCSS("#fadetop, #fadebot {");
      rf.rule.style.height = faderheight + "px";

      // set navigation chooser height
      var rc = getCSS("#biblechooser {");
      if (rc.rule.style.height != chooserheight + "px") 
          document.getElementById("biblebooks_nt").style.top = "8px";
      rc.rule.style.height = chooserheight + "px";

      document.getElementById("fadebot").style.height = Number(winh - faderheight - chooserheight) + "px";

      // set navigation chooser width
      var ntw = document.getElementById("biblebooks_nt");
      var otw = document.getElementById("biblebooks_ot");
      otw.style.width = "";
      ntw.style.width = "";
      if (ntw.offsetWidth > otw.offsetWidth) otw.style.width = Number(ntw.offsetWidth - 2) + "px";
      else ntw.style.width = (Number(otw.offsetWidth - 2) > 0 ? Number(otw.offsetWidth - 2):0) + "px";
      var offset = (guiDirection() == "ltr" ? otw.offsetLeft:(otw.offsetParent.offsetWidth - otw.offsetLeft - otw.offsetWidth));
      rf.rule.style.width = (Number(offset + otw.offsetWidth + 20) > 0 ? 
          Number(offset + otw.offsetWidth + 20):0) + "px";
      rc.rule.style.width = (Number(offset + otw.offsetWidth - 6) > 0 ? 
          Number(offset + otw.offsetWidth - 6):0) + "px";
    }
    
    // this is not so important, but line up CA background pattern:
    r = getCSS("#fadebot {");
    var os = getOffset(document.getElementById("fadebot"));
    r.rule.style.backgroundPosition = "0px " + (40 - os.top) + "px";

    // fix main-viewport width to fill parent with no overflow
    if (window.frameElement && window.frameElement.id == "main-viewport") {
      var width = (winw ? winw:MainWindow.innerWidth - MainWindow.document.getElementById("genBookChooser").boxObject.width) + "px";
      document.getElementById("viewportbody").style.width = width;
    }

  };
  
  this.selectTab = function(w, version) {
		document.getElementById("text" + w).setAttribute("versePerLine", "false");
		
    var fdb = this.firstDisplayBible(true); // capture before changing prefs...
    
    if (this === MainWindow.ViewPort) {
			// update this window
			this.ShowOriginal[w] = false;
			this.Module[w] = version;
			
			// if the firstDisplayBible has changed, update the navigator
			if ((w == fdb || fdb != this.firstDisplayBible(true)))
					window.setTimeout(function() {ViewPort.disableMissingBooks(getPrefOrCreate("HideDisabledBooks", "Bool", false));}, 200);
					
			MainWindow.updateBibleNavigatorAudio();
		}
    
    // windowed ViewPorts only show a single text, so if this is a windowed 
    // ViewPort, update all the texts in its link.
    else {
			for (var x=1; x<=NW; x++) {
				if (document.getElementById("text" + x).getAttribute("moduleType")=="none") continue;
				this.ShowOriginal[x] = false;
				this.Module[x] = version;	
			}
		}
		
  };

  this.disableMissingBooks = function(hide) {
    var books = getAvailableBooks(this.firstDisplayBible());
    for (var b=0; b<Book.length; b++) {
      var have = false;
      for (var a=0; books && a<books.length; a++) {
        if (books[a] == Book[b].sName) {have=true; break;}
      }
      document.getElementById("book_" + b).setAttribute("missing", (have ? "false":(hide ? "hide":"disable")));
    }

    if (hide) this.update(false);
  };
  
  this.firstDisplayBible = function(returnNumber) {
    try {var ret = prefs.getCharPref("DefaultVersion");}
    catch (er) {ret = null;}
    
    var wn = this.NumDisplayedWindows;
    for (var w=1; w<=wn; w++) {
      var amod = this.Module[w];
      if (Tab[amod].modType == BIBLE) {
        ret = amod;
        break;
      }
    }
    if (!returnNumber) return ret;
    else {
      if (!ret || w>wn) w=1;
      return w;
    }
  };

  this.firstDisplayModule = function() {
    return {mod:this.Module[1], w:1};
  };
  
  
  this.resizeTimer = null;
  this.resize = function() {
    if (window.innerHeight < 100) return;
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(function() {ViewPort.update();}, 300);
  };


  this.unload = function() {
    
    // no unload stuff is necessary except for main-viewport
    if (document !== MainWindow.document.getElementById("main-viewport").contentDocument) return;

    // save hidden tab prefs
    for (var w=1; w<=NW; w++) {
      var hide = "";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t]["w" + w + ".hidden"]) hide += Tabs[t].modName + ";";
      }
      prefs.setCharPref("w" + w + ".hidden", hide);
    }
    
    // save other ViewPort params
    prefs.setIntPref("NumDisplayedWindows", this.NumDisplayedWindows);
    prefs.setBoolPref("ShowChooser", this.ShowChooser);
    
    for (var w=1; w<=NW; w++) {
      prefs.setBoolPref("ShowOriginal" + w, this.ShowOriginal[w]);
      prefs.setIntPref("NoteBoxHeight" + w, this.NoteBoxHeight[w]);
      prefs.setBoolPref("MaximizeNoteBox" + w, this.MaximizeNoteBox[w]);
      prefs.setCharPref("Version" + w, this.Module[w]);
      setUnicodePref("Key" + w, this.Key[w]);
    }
  };
  
};
