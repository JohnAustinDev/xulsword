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

  showing: function(e, menupopup) {
  //jsdump((menupopup.triggerNode.id ? menupopup.triggerNode.id:"noid"));

    // init our target info
    this.target = {bk:null, ch:null, vs:null, lv:null, mod:null, w:null, lemma:null, bookmark:null};
    
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
   
    // Is mouse over a word with strong's numbers? Then add Strong's search possibility.
    var selem = menupopup.triggerNode;
    var strongsNum;
    var canHaveLemma = false;
    while (selem && !strongsNum) {
      strongsNum = (selem.className && selem.className.search(/(^|\s)sn($|\s)/)!=-1 ? selem.title:"");
      selem = selem.parentNode;
    }
    if (strongsNum) {
      this.target.lemma = ""; 
      var nums = strongsNum.split(".");
      for (var i=0; i<nums.length; i++) {
        var parts = nums[i].split(":");
        if (parts[0] != "S") continue;
        // SWORD filters these out- not valid it says
        if (parts[1].substr(0,1)=="G" && Number(parts[1].substr(1)) >= 5627) continue;
        this.target.lemma += "lemma:" + parts[1] + " ";
      }
      if (this.target.lemma) {
        if (!this.lemmaLabel) this.lemmaLabel = document.getElementById("ctx_xs_searchForLemma").label;
        canHaveLemma = true;
        document.getElementById("ctx_xs_searchForLemma").label = this.lemmaLabel + " - " + this.target.lemma;
      }
    }
    
    // Get targets from mouse pointer or selection
    var isSelection=false;
    var contextTargs = this.getTargetsFromElement(menupopup.triggerNode);
    if (contextTargs==null) {e.preventDefault(); return;}
    var selob = menupopup.triggerNode.ownerDocument.defaultView.getSelection();
    if (selob && !selob.isCollapsed) {
      contextTargs = this.getTargetsFromSelection(selob);
      if (contextTargs==null) {e.preventDefault(); return;}
      isSelection=true;
      this.target.selection = replaceASCIIcontrolChars(selob.toString());
    }
    
  //jsdump(contextTargs.shortName + " " + contextTargs.chapter + ":" + contextTargs.verse + "-" + contextTargs.lastVerse + ", res=" + contextTargs.resource);
     
    // Set our target 
    var myModuleName = (this.target.w ? prefs.getCharPref("Version" + this.target.w):prefs.getCharPref("DefaultVersion"));
    this.target.mod = contextTargs.version ? contextTargs.version:myModuleName;
    switch (getModuleLongType(myModuleName)) {
    case BIBLE:
    case COMMENTARY:
      this.target.bk = (contextTargs.shortName ? contextTargs.shortName:(this.target.w ? Texts.display[this.target.w].bk:null));
      this.target.ch = (contextTargs.chapter ? contextTargs.chapter:(this.target.w  ? Texts.display[this.target.w].chapter:null));
      this.target.vs = contextTargs.verse;
      this.target.lv = contextTargs.lastVerse;
      break;
    case DICTIONARY:
      this.target.bk = null;
      this.target.ch = getPrefOrCreate("DictKey_" + myModuleName + "_" + this.target.w, "Unicode", "");
      this.target.vs = contextTargs.paragraph;
      this.target.lv = contextTargs.paragraph;
      break;
    case GENBOOK:
      this.target.bk = null;
      this.target.ch = getPrefOrCreate("GenBookKey_" + myModuleName + "_" + this.target.w, "Unicode", "");
      this.target.vs = contextTargs.paragraph;
      this.target.lv = contextTargs.paragraph;
      break;
    }
    
    if (contextTargs.resource) {
      var aItem = BM.RDF.GetResource(contextTargs.resource);
      var aParent = BookmarkFuns.getParentOfResource(aItem, BMDS);
      if (aParent) {
        this.target.bookmark = BookmarksUtils.getSelectionFromResource(aItem, aParent);
      }
    }
    
    this.build(canHaveLemma, (this.target.w ? true:false), true, true, true, true);
    
//var t=""; for (var m in this.target) {t += m + "=" + (this.target[m] ? this.target[m]:"NULL") + ", ";} jsdump(t);
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

  getTargetsFromSelection: function(selob) {
    var retval = {window:null, shortName:null, chapter:null, version:null, verse:null, lastVerse:null, resource:null, paragraph:null, isCrossReference:false};
    var targs1 = this.getTargetsFromElement(selob.focusNode);
    if (targs1 == null) return null;
    var targs2 = this.getTargetsFromElement(selob.anchorNode);
    if (targs2 == null) return null;
    
    if (targs1.shortName!=targs2.shortName || targs1.chapter!=targs2.chapter) return retval;
    
    // Only return a value for these if targs1 matches targs2
    if (targs1.window==targs2.window) retval.window=targs1.window;
    if (targs1.version==targs2.version) retval.version=targs1.version;
    if (targs1.shortName==targs2.shortName) retval.shortName=targs1.shortName;
    if (targs1.chapter==targs2.chapter) retval.chapter=targs1.chapter;
    if (targs1.verse==targs2.verse && targs1.paragraph==targs2.paragraph) retval.resource = targs1.resource ? targs1.resource:targs2.resource;
    if (targs1.paragraph==targs2.paragraph) retval.paragraph=targs1.paragraph;
    
    // If this is a cross-reference
    if (targs1.isCrossReference) {
      retval.shortName=targs1.shortName;
      retval.chapter=targs1.chapter;
      retval.verse=targs1.verse;
      retval.lastVerse=targs1.lastVerse;
      retval.version=targs1.version;
      retval.isCrossReference = true;
      return retval;
    }
    // Return smaller verse number as "verse" and larger verse number as "lastVerse"
    if (targs2.verse > targs1.verse) {
      retval.verse = targs1.verse;
      retval.lastVerse = targs2.verse;
    }
    else {
      retval.verse = targs2.verse;
      retval.lastVerse = targs1.verse;
    }
    
    return retval;
  },

  // Searches for information associated with an element or its parents, 
  // and searches for a resource attached to an element by searching children
  // If the element is not a child of "scriptBox" or "npopup" then null is returned
  getTargetsFromElement: function(element) {
  //jsdump("ID:" + element.id + ", CLASS:" + element.className + ", TITLE:" + element.className + "\n");
    var targs = {window:null, shortName:null, chapter:null, version:null, verse:null, lastVerse:null, resource:null, paragraph:null, isCrossReference:false};
    
    targs.window = getWindow(element);
   
    //If we're in interlinear original mode, return correct version of this element
    if (targs.window && prefs.getBoolPref("ShowOriginal" + targs.window)) {
      var elem = element.parentNode;
      while (elem) {
        if (elem.className) {
          var styleMod = elem.className.match(/cs-(\w+)/);
          if (styleMod) {
            targs.version = styleMod[1];
            break;
          }
        }
        elem = elem.parentNode;
      }
    }
    
    while (element) {
  //jsdump("Context searching id=" + element.id);

      if (element.className && (/(^|\s)text(\s|$)/).test(element.className) && !targs.version && targs.window) targs.version = prefs.getCharPref("Version" + targs.window);
      
      if (element.id) {
        // Are we over a cross reference?
        if (targs.verse == null && element.title) {
          // First get location data
          var crloc = element.title.match(CROSSREFTITLE);
          if (crloc) {
            targs.version = crloc[1];
            targs.shortName = crloc[3];
            targs.chapter = Number(crloc[4]);
            targs.verse = Number(crloc[5]);
            if (crloc[7]) targs.lastVerse = Number(crloc[7]);
            else if (crloc[8]) targs.lastVerse = Number(crloc[8]);
            else targs.lastVerse = targs.verse;
            targs.isCrossReference = true;
          }
        }
        // Are we over a verse?
        if (targs.verse == null) {try {var loc = element.id.match(/vs\.([^\.]*)\.(\d+)\.(\d+)/); targs.shortName = loc[1]; targs.chapter=Number(loc[2]); targs.verse = Number(loc[3]);} catch (er) {}}
        // Are we over a note body?
        if (targs.verse == null) {try {loc = element.id.match(/body\..*([^\.]*)\.(\d+)\.(\d+)\.([^\.])+$/); targs.shortName = loc[1]; targs.chapter=Number(loc[2]); targs.verse = Number(loc[3]); targs.paragraph=targs.verse;} catch (er) {}}
        // Are we over a user note?
        if (targs.resource == null) {try {targs.resource = decodeUTF8(element.id.match(/(^|\.)un\.(.*?)\./)[2]);} catch (er) {}}
        // Are we over a paragraph?
        if (targs.paragraph == null) {try {targs.paragraph = Number(element.id.match(/par\.(\d+)/)[1]);} catch (er) {}}
        // If we don't have a resource, search applicable children...
        if (targs.resource == null && element.hasChildNodes() && element.id.match(/^(vs|sv|npopup)/)) {
          var child = element.firstChild;
          while (child) {
  //jsdump("Context searching child=" + child.id);
            if (targs.resource == null) {
              if (child.id) {
                var resname = child.id.match(/\un\.(.*?)\./);
                if (resname) {targs.resource = decodeUTF8(resname[1]);}
              }
            }
            child = child.nextSibling;
          }
        }
      }
      element = element.parentNode;
    }
    if (targs.verse != null && targs.lastVerse == null) targs.lastVerse=targs.verse;
    return targs;
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
        if (!ContextMenu.target.hasOwnProperty("bookmark")) return false;
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

MainWindow.controllers.appendController(ContextMenuController);
