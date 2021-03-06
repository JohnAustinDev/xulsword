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

var ContextMenu = {
  
  target: {},
  
  lemmaLabel:null,
  
  NEWTARGET:{ bk:null, ch:null, vs:null, lv:null, mod:null, w:null, bookmark:null, selection:null, search:{mod:null, searchtext:null, type:null, window:null } },

  showing: function(e, menupopup) {
//var p=""; for (var m in menupopup.triggerNode) {p += m + "=" + menupopup.triggerNode[m] + " ";} jsdump(p);

    // init our target info
    this.target = deepClone(this.NEWTARGET);
    
    this.target.window = window;
    this.target.w = getContextWindow(menupopup.triggerNode);
    
    // Do some viewport specific cleanup
    if (typeof(ViewPort) != "undefined") {
      
      ViewPort.ownerDocument.defaultView.closeTabToolTip();
      
      // Close Script Popup if we're not over it
      var elem = menupopup.triggerNode;
      while (elem && (!elem.id || elem.id != "npopup")) {elem = elem.parentNode;}
      if (!elem) ViewPort.ownerDocument.defaultView.Popup.close();
      
    }
    
    // Open tab context menu if over a tab
    if (typeof(Tab) != "undefined" && menupopup.triggerNode.id) {
      
      // Is this a select tab menu?
      if ((/\.tab\.tsel/).test(menupopup.triggerNode.id)) {
        var label = menupopup.triggerNode.previousSibling.value;
        for (var t=0; t<Tabs.length; t++) {if (Tabs[t].label == label) break;}
        if (t < Tabs.length) {
          this.target.mod = Tabs[t].modName;
          this.build(false, true, false, false, false, false);
        }
        return;
      }
      // Is this a select tab tab?
      else if ((/\.tab\.mult/).test(menupopup.triggerNode.id)) {
        this.target.mod = Tabs[menupopup.triggerNode.id.match(/tab\.mult\.(\d+)/)[1]].modName;
        this.build(false, true, false, false, false, false);
        return;
      }
      // Is this a version tab?
      else if (menupopup.triggerNode.id.search(/tab\.norm\.\d+/) != -1) {
        this.target.mod = Tabs[menupopup.triggerNode.id.match(/tab\.norm\.(\d+)/)[1]].modName;
        this.build(false, true, false, false, false, false);
        return;
      }
      
    }
   
    // lemma label is dynamic, so always start with original value
    if (this.lemmaLabel) document.getElementById("ctx_xs_searchForLemma").label = this.lemmaLabel;
    else this.lemmaLabel = document.getElementById("ctx_xs_searchForLemma").label;
    
    // Is mouse over a word with strong's numbers? Then get lemma information.
    // Strong's numbers are encoded in an elements class, not its title. For this
    // reason getElementInfo is not used here.
    var canHaveLemma = false;
    var selem = menupopup.triggerNode;
    var strongsNum;
    while (selem && !strongsNum) {
      if (!strongsNum) strongsNum = (selem.className && selem.className.search(/(^|\s)sn($|\s)/) != -1 ? selem.className:"");
      selem = selem.parentNode;
    }
    if (selem) {
      var strongsMod = getContextModule(menupopup.triggerNode);
      if (strongsMod) {
        var lemma = ""; 
        var nums = strongsNum.split(" ");
        nums.shift(); // remove base style
        for (var i=0; i<nums.length; i++) {
          var parts = nums[i].split("_");
          if (parts[0] != "S") continue;
          // SWORD filters these out- not valid it says
          if (parts[1].substr(0,1)=="G" && Number(parts[1].substr(1)) >= 5627) continue;
          lemma += "lemma: " + parts[1] + " ";
        }
        if (lemma) {
          canHaveLemma = true;
          document.getElementById("ctx_xs_searchForLemma").label += " - " + lemma;
          this.target.search.searchtext = lemma;
          this.target.search.mod = strongsMod;
          this.target.search.type = "SearchAdvanced";
        }
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
    if (!this.target.w) this.target.w = 0;
    
    if (!this.target.mod) {
      if (this.target.w) this.target.mod = ViewPort.Module[this.target.w];
      else this.target.mod = prefs.getCharPref("DefaultVersion"); 
    }
  
    var defTexts = {bk:Location.getBookName(), 
            ch:Location.getChapterNumber(this.target.mod), 
            vs:Location.getVerseNumber(this.target.mod), 
            lv:Location.getLastVerseNumber(this.target.mod)};
    var defDicts = {bk:null, 
            ch:ViewPort.Key[this.target.w], 
            vs:1, lv:1};
    var defGenbks = {bk:null, 
            ch:ViewPort.Key[this.target.w], 
            vs:1, lv:1};
    
    var defaults = {Texts:defTexts, Comms:defTexts, Dicts:defDicts, Genbks:defGenbks};
    
    // If target module is not installed, force target to defaults
    if (!Tab.hasOwnProperty(this.target.mod)) {
      this.target.mod = prefs.getCharPref("DefaultVersion");
      for (var p in defaults[Tab[this.target.mod].tabType]) {
        this.target[p] = defaults[Tab[this.target.mod].tabType][p];
      }
    }
    
    // Fill in any remaining missing target props with defaults
    for (var p in defaults[Tab[this.target.mod].tabType]) {
      if (this.target[p] === null || this.target[p] == NOTFOUND) {
        this.target[p] = defaults[Tab[this.target.mod].tabType][p];
      }
    }
    
    this.build(canHaveLemma, (this.target.w ? true:false), true, true, true, true);
    
//var t=""; for (var m in contextTargs) {t += m + "=" + (contextTargs[m] ? contextTargs[m]:"NULL") + ", ";} jsdump(t);

  },

  build: function(canHaveLemma, canHaveTab, canSelect, canHaveVerse, canHaveParagraph, canHaveBookmark) {

    // Enable command controller
    document.getElementById("contextScriptBox").setAttribute("value", "open");
    
    // Enable/disable menu options accordingly
    goUpdateCommand("cmd_xs_searchForLemma");
    goUpdateCommand("cmd_xs_aboutModule");
    goUpdateCommand("cmd_xs_chooseFont");
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
    document.getElementById("ctx_xs_chooseFont").hidden                        = !canHaveTab;
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
  
    var targs1 = deepClone(this.NEWTARGET);
    if (!this.getTargetsFromElement(targs1, selob.focusNode)) return false;
    
    var targs2 = deepClone(this.NEWTARGET);
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
    for (var p in this.NEWTARGET) {
      if (target[p] === null && targs1[p] !== null) target[p] = targs1[p];
    }
    
    return true;
  },

  // Read target info from an element and its parents.
  getTargetsFromElement: function(targs, element) {
//{ bk:null, ch:null, vs:null, lv:null, mod:null, w:null, lemma:null, bookmark:null, selection:null }

    if (targs.w === null) targs.w = getContextWindow(element);
    
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
  
  // Returns target information associated with an element.
  // NOTE: bk, ch, vs, and lv may be interpreted differently depending
  // on the module type of "mod".
  readDataFromElement: function(targs, element) {

    var info = getElementInfo(element);
    if (!info) return false;
    
try{jsdump("readDataFromElement:" + uneval(info));} catch(er) {}
    
    for (var p in info) {
      
      // first come, first served- don't overwrite existing data
      if (p != "nid" && (!targs.hasOwnProperty(p) || targs[p] !== null)) continue; 
      
      // some params use "0" as a placeholder which should not be propagated
      if ((/^(bk|ch|vs|lv)$/).test(p) && (info[p] == "0" || info[p] == 0)) continue;
        
      if (info[p] === null) {
        targs[p] = NOTFOUND;
        continue;
      }
      
     var val = info[p];
      
      // report any "", 0 etc. data fields
      if (!val) {
        jsdump("Context menu: skipping element field \"" + p + "\" with invalid data: class=" + element.className + ", title=" +  element.title);
        continue;
      }
      
      // handle special cases where raw data is processed or handled
      // contextually.
      switch(p) {
      case "nid":
        if (!targs.bookmark && BM && typeof(BookmarkFuns) != "undefined") {
          var aItem = BM.RDF.GetResource(decodeURIComponent(val));
          var aParent = ResourceFuns.getParentOfResource(aItem, BMDS);
          if (aParent) {
            targs.bookmark = XS_window.BookmarksUtils.getSelectionFromResource(aItem, aParent);
          }
        }
        val = null;
        break;
      }
      
      if (val) targs[p] = val; // got it!

    }
    
//jsdump("targs:" + uneval(targs)); 
     
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
        XS_window.BookmarksController.doCommand(cmd, ContextMenu.target.bookmark);
        break;
        
      default:
        XS_window.XulswordController.doCommand(cmd, ContextMenu.target);
    }
  },
  
  isCommandEnabled: function(cmd) {

    switch(cmd) {
      case "cmd_bm_properties":
      case "cmd_bm_delete":
        if (!ContextMenu.target.bookmark) return false;
        return XS_window.BookmarksController.isCommandEnabled(cmd, ContextMenu.target.bookmark);
        break;
    }

    return (XS_window.XulswordController ? XS_window.XulswordController.isCommandEnabled(cmd, ContextMenu.target):false);
  },
  
  supportsCommand: function(cmd) {
  
    // Only handle commands when context menu is open
    if (document.getElementById("contextScriptBox").getAttribute("value") == "closed") 
        return false;
   
    switch(cmd) {
      case "cmd_xs_searchForLemma":
      case "cmd_xs_aboutModule":
      case "cmd_xs_chooseFont":
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

window.controllers.insertControllerAt(0, ContextMenuController);


