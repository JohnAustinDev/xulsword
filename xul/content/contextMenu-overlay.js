/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

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

const NEWTARGET = { bk:null, ch:null, vs:null, lv:null, mod:null, w:null, lemma:null, bookmark:null, selection:null };

var ContextMenu = {
  
  target: {},
  
  lemmaLabel:null,

  showing: function(e, menupopup) {
  //jsdump((menupopup.triggerNode.id ? menupopup.triggerNode.id:"noid"));

    // init our target info
    this.target = copyObj(NEWTARGET);
    
    this.target.w = getWindow(menupopup.triggerNode);
    
    // Do some viewport specific cleanup
    if (typeof(ViewPortWindow) != "undefined") {
      
      ViewPortWindow.closeTabToolTip();
      
      // Close Script Popup if we're not over it
      var elem = menupopup.triggerNode;
      while (elem && (!elem.id || elem.id != "npopup")) {elem = elem.parentNode;}
      if (!elem) ViewPortWindow.Popup.close();
      
    }
    
    // Open tab context menu if over a tab
    if (typeof(Tab) != "undefined" && menupopup.triggerNode.id) {
      
      // Is this a select tab menu?
      if ((/\.tab\.tsel/).test(menupopup.triggerNode.id)) {
        this.target.mod = menupopup.triggerNode.previousSibling.value;
        this.build(false, true, false, false, false, false);
        return;
      }
      // Is this a select tab tab?
      else if ((/\.tab\.mult/).test(menupopup.triggerNode.id)) {
        this.target.mod = menupopup.triggerNode.value;
        this.build(false, true, false, false, false, false);
        return;
      }
      // Is this a version tab?
      else if (menupopup.triggerNode.id.search(/tab\.norm\.\d+/)!=-1) {
        this.target.mod = Tab[menupopup.triggerNode.id.match(/tab\.norm\.(\d+)/)[1]].modName;
        this.build(false, true, false, false, false, false);
        return;
      }
      
    }
   
    // lemma label is dynamic, so always start with original value
    if (this.lemmaLabel) document.getElementById("ctx_xs_searchForLemma").label = this.lemmaLabel;
    else this.lemmaLabel = document.getElementById("ctx_xs_searchForLemma").label;
    
    // Is mouse over a word with strong's numbers? Then get lemma information.
    var selem = menupopup.triggerNode;
    var strongsNum;
    var canHaveLemma = false;
    while (selem && !strongsNum) {
      strongsNum = (selem.className && selem.className.search(/(^|\s)sn($|\s)/)!=-1 ? selem.className:"");
      selem = selem.parentNode;
    }
    if (strongsNum) {
      this.target.lemma = ""; 
      var nums = strongsNum.split(" ");
      nums.shift(); // remove base style
      for (var i=0; i<nums.length; i++) {
        var parts = nums[i].split("_");
        if (parts[0] != "S") continue;
        // SWORD filters these out- not valid it says
        if (parts[1].substr(0,1)=="G" && Number(parts[1].substr(1)) >= 5627) continue;
        this.target.lemma += "lemma:" + parts[1] + " ";
      }
      if (this.target.lemma) {
        canHaveLemma = true;
        document.getElementById("ctx_xs_searchForLemma").label += " - " + this.target.lemma;
      }
    }
    
    // Get targets from mouse pointer or selection
    var selob = menupopup.triggerNode.ownerDocument.defaultView.getSelection();
    if (selob && !selob.isCollapsed && !(/^\s*$/).test(selob.toString())) {
      if (!this.getTargetsFromSelection(this.target, selob)) {
        e.preventDefault(); 
        return;
      }
      
      this.target.selection = replaceASCIIcontrolChars(selob.toString());
    }
    else {
      if (!this.getTargetsFromElement(this.target, menupopup.triggerNode)) {
        e.preventDefault(); 
        return;
      }
    }
    
    // Finish by filling in any null or NOTFOUND values with local context
    if (!this.target.w) this.target.w = 1;
    
    if (!this.target.mod) {
      this.target.mod = prefs.getCharPref("Version", this.target.w); 
    }
    
    var defTexts = {bk:Location.getBookName(), 
            ch:Location.getChapterNumber(this.target.mod), 
            vs:Location.getVerseNumber(this.target.mod), 
            lv:Location.getLastVerseNumber(this.target.mod)};
    var defDicts = {bk:null, 
            ch:getPrefOrCreate("DictKey_" + this.target.mod + "_" + this.target.w, "Unicode", ""), 
            vs:1, lv:1};
    var defGenbks = {bk:null, 
            ch:getPrefOrCreate("GenBookKey_" + this.target.mod + "_" + this.target.w, "Unicode", ""), 
            vs:1, lv:1};
    
    var defaults = {Texts:defTexts, Comms:defTexts, Dicts:defDicts, Genbks:defGenbks};
    
    for (var p in defaults[Tab[this.target.mod].tabType]) {
      if (this.target[p] === null || this.target[p] == NOTFOUND) {
        this.target[p] = defaults[Tab[this.target.mod].tabType][p];
      }
    }
    
    this.build(canHaveLemma, (this.target.w ? true:false), true, true, true, true);
    
var t=""; for (var m in this.target) {t += m + "=" + (this.target[m] ? this.target[m]:"NULL") + ", ";} jsdump(t);
//var t=""; for (var m in contextTargs) {t += m + "=" + (contextTargs[m] ? contextTargs[m]:"NULL") + ", ";} jsdump(t);

  },

  build: function(canHaveLemma, canHaveTab, canSelect, canHaveVerse, canHaveParagraph, canHaveBookmark) {
    
    // Enable command controller
    document.getElementById("contextScriptBox").setAttribute("value", "open");
    
    // Enable/disable menu options accordingly
    goUpdateCommand("cmd_xs_searchForLemma");
    goUpdateCommand("cmd_xs_aboutModule");
    goUpdateCommand("cmd_xs_toggleTab");
    goUpdateCommand("cmd_copy");
    goUpdateCommand("cmd_xs_searchForSelection");
    goUpdateCommand("cmd_xs_openFromSelection");
    goUpdateCommand("cmd_xs_selectVerse");
    goUpdateCommand("cmd_xs_newBookmark");
    goUpdateCommand("cmd_xs_newUserNote");
    goUpdateCommand("cmd_bm_properties");
    goUpdateCommand("cmd_bm_delete");
    
    // Hide menu options accordingly
    document.getElementById("ctx_xs_searchForLemma").hidden                    = !canHaveLemma;
    
    document.getElementById("ctx_xs_aboutModule").previousSibling.hidden       = (!canHaveTab || !canHaveLemma);
    document.getElementById("ctx_xs_aboutModule").hidden                       = !canHaveTab;
    document.getElementById("ctx_xs_toggleTab").hidden                         = !canHaveTab;
    
    document.getElementById("cMenu_copy").previousSibling.hidden               = (!canSelect || !canHaveTab);
    document.getElementById("cMenu_copy").hidden                               = !canSelect;
    document.getElementById("ctx_xs_searchForSelection").hidden                = !canSelect;
    
    document.getElementById("ctx_xs_openFromSelection").previousSibling.hidden = !canSelect;
    document.getElementById("ctx_xs_openFromSelection").hidden                 = !canSelect;
    
    document.getElementById("ctx_xs_selectVerse").previousSibling.hidden       = (!canHaveVerse || !canSelect);
    document.getElementById("ctx_xs_selectVerse").hidden                       = !canHaveVerse;
    
    document.getElementById("ctx_xs_newBookmark").previousSibling.hidden       = ((!canHaveVerse && !canHaveParagraph) || !canHaveVerse);
    document.getElementById("ctx_xs_newBookmark").hidden                       = (!canHaveVerse && !canHaveParagraph);
    document.getElementById("ctx_xs_newUserNote").hidden                       = (!canHaveVerse && !canHaveParagraph);
    
    document.getElementById("ctx_bm_properties").previousSibling.hidden        = (!canHaveBookmark || (!canHaveVerse && !canHaveParagraph));
    document.getElementById("ctx_bm_properties").hidden                        = !canHaveBookmark;
    document.getElementById("ctx_bm_delete").hidden                            = !canHaveBookmark;
    
  },

  // Read two targets, one from each end of the selection, merge the two and return the results.
  getTargetsFromSelection: function(target, selob) {
  
    var targs1 = copyObj(NEWTARGET);
    if (!this.getTargetsFromElement(targs1, selob.focusNode)) return false;
    
    var targs2 = copyObj(NEWTARGET);
    if (!this.getTargetsFromElement(targs2, selob.anchorNode)) return false;
    
    // merge bookmarks
    if (!targs1.bookmark && targs2.bookmark) targs1.bookmark = targs2.bookmark;
    
    // merge targ2 into targ1 if mod, bk and ch are the same (otherwise ignore targ2)
    if (targs1.mod == targs2.mod && targs1.bk == targs2.bk && targs1.ch == targs2.ch) {
    
      var vs = (targs2.vs && (!targs1.vs || targs2.vs < targs1.vs) ? targs2.vs:targs1.vs);
      var lv = (targs2.lv && (!targs1.lv || targs2.lv > targs1.lv) ? targs2.lv:targs1.lv);
      
      if (lv && !vs) vs = lv;
      if (vs && !lv || lv < vs) lv = vs;
      
      targs1.vs = vs;
      targs1.lv = lv;
      
    }
    
    // save merged targ1 to target
    for (var p in NEWTARGET) {
      if (target[p] === null && targs1[p] !== null) target[p] = targs1[p];
    }
    
    return true;
  },

  getTargetsFromElement: function(targs, element) {
//{ bk:null, ch:null, vs:null, lv:null, mod:null, w:null, lemma:null, bookmark:null, selection:null }

    if (targs.w === null) targs.w = getWindow(element);
    
    while (element) {
      
      // if this is a user-note hilight verse, get un info from inside it
      if (element.className && element.className.match(/(^|\s)un-hilight(\s|$)/)) {
        var child = element.getElementsByClassName("un");
        if (child && child.length) this.readDataFromElement(targs, child[0]);
      }
      
      this.readDataFromElement(targs, element);
      
      element = element.parentNode;
    }

    return targs;
  },
  
  // Returns target information associated with an element or its parents.
  // NOTE: bk, ch, vs, and lv may be interpreted differently depending
  // on the module type of "mod". If "mod" is specified, these same four 
  // params should be set to something non null.
  readDataFromElement: function(targs, element) {
    if (!element.className || !element.title) return false;

jsdump("readDataFromElement: class=" + element.className + ", title=" + element.title);

    var type = element.className.match(/^([^\-\s]*)/)[1];
    
    if (!TextClasses.hasOwnProperty(type)) return false;
    
    // we have a TextClasses element, so now get its data
    for (var i=0; i<TextClasses[type].length; i++) {
      var m = element.title.match(TextClasses[type][i].re);
      if (!m) continue;
      
      // we've matched some data so save what we found in our return object
      for (var p in TextClasses[type][i]) {
        if (p == "re") continue;
      
        // first come, first served- don't overwrite existing data
        if (!targs.hasOwnProperty(p) || targs[p] !== null) continue; 
        
        var val = m[TextClasses[type][i][p]];
        
        // report any missing data fields
        if (!val) {
          jsdump("Context menu: skipping element field \"" + p + "\" with invalid data: class=" + element.className + ", title=" +  element.title);
          continue;
        }
        
        // handle some special cases where raw data is processed or handled
        // contextually.
        switch(p) {
        case "res":
          if (!targs.bookmark) {
            var aItem = BM.RDF.GetResource(decodeUTF8(val));
            var aParent = BookmarkFuns.getParentOfResource(aItem, BMDS);
            if (aParent) {
              targs.bookmark = BookmarksUtils.getSelectionFromResource(aItem, aParent);
            }
          }
          val = null;
          break;
        
        // Some matches do not return a full compliment of values
        // for bk, ch, vs, and lv. Setting missing params to NOTFOUND 
        // allows us to complete them contextually at the end of the 
        // whole process.
      
        // references to other non-bible OSIS texts
        case "osistext":
          if (targs.ch === null) {
            val = val.replace(/^(\S+).*?$/, "$1"); // drop all but first osisRef
            val = val.split(":"); // split osis-word and reference
            
            // handles only osisRef's to dictionary modules right now
            if ((!targs.mod || targs.mod == val[0]) && 
                Tab.hasOwnProperty(val[0]) && Tab[val[0]].modType == DICTIONARY) {
              targs.mod = val[0];
              targs.bk = NOTFOUND;
              targs.ch = val[1];
              targs.vs = NOTFOUND;
              targs.lv = NOTFOUND;
            }
          }
          val = null;
          break;
          
        case "par":
          if (targs.vs === null) {
            targs.bk = NOTFOUND;
            targs.ch = NOTFOUND;
            targs.vs = val;
            targs.lv = val;
          } 
          val = null;
          break;
        }
        
        if (val) targs[p] = val; // got it!
      }
      
      break;
    }
    
    // if we didn't match expected data then we have a problem, so report it
    if (i == TextClasses[type].length) {
      jsdump("Context menu unhandled text-class element: class=" +  element.className + ", title=" +  element.title);
      return false;
    }
      
    return true;
  },

  hidden: function(e, elem) {
    document.getElementById("contextScriptBox").setAttribute("value", "closed");
  }
  
};

var ContextMenuController = {
  
  doCommand: function(cmd) {
    switch(cmd) {
      case "cmd_bm_properties":
      case "cmd_bm_delete":
        MainWindow.BookmarksController.doCommand(cmd, ContextMenu.target.bookmark);
        break;
        
      default:
        MainWindow.XulswordController.doCommand(cmd, ContextMenu.target);
    }
  },
  
  isCommandEnabled: function(cmd) {
    switch(cmd) {
      case "cmd_bm_properties":
      case "cmd_bm_delete":
        if (!ContextMenu.target.bookmark) return false;
        return MainWindow.BookmarksController.isCommandEnabled(cmd, ContextMenu.target.bookmark);
        break;
    }

    return MainWindow.XulswordController.isCommandEnabled(cmd, ContextMenu.target);
  },
  
  supportsCommand: function(cmd) {
    
    // Only handle commands when context menu is open
    if (document.getElementById("contextScriptBox").getAttribute("value") == "closed") 
        return false;
    
    switch(cmd) {
      case "cmd_xs_searchForLemma":
      case "cmd_xs_aboutModule":
      case "cmd_xs_toggleTab":
      case "cmd_xs_searchForSelection":
      case "cmd_xs_openFromSelection":
      case "cmd_xs_selectVerse":
      case "cmd_xs_newBookmark":
      case "cmd_xs_newUserNote":
      case "cmd_bm_properties":
      case "cmd_bm_delete":
      return true;
    }
    
    return false;
  }
};

// Add our controller to MainWindow
MainWindow.controllers.appendController(ContextMenuController);

// Remove our controller from MainWindow when this window closes
var Oldonunload = window.onunload;
window.onunload = function () {
  if (Oldonunload) Oldonunload();
  MainWindow.controllers.removeController(ContextMenuController);
};
