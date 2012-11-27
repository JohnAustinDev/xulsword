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
const POPUPDELAY = 250;

var Popup;

function initWindowedPopup() {
  createDynamicClasses();
  adjustFontSizes(prefs.getIntPref('FontSize'));
  
  document.getElementsByTagName("body")[0].setAttribute("chromedir", ProgramConfig.direction);
  
  initPopup();
}
    
// During initPopup, a new Popup object will be created to handle Popup  
// functions in this context. If this popup is a separate window, it 
// needs to be initialized with all the settings and data of the regular 
// popup from which it came.
function initPopup() {
  
  if (window.name == "npopup") {
  
    // This is a windowed popup, so copy the original popup
    Popup = new PopupObj(MainWindow.ViewPortWindow.Popup);
    
    // Close the original popup
    MainWindow.ViewPortWindow.Popup.close();
    
  }
  else {Popup = new PopupObj();}

}
    
function PopupObj(popupobj) {

  this.npopup = document.getElementById("npopup");
  this.npopupTX = document.getElementById("npopupTX");
  this.showPopupID = null;
    
  if (popupobj) {
    this.npopup.setAttribute("puptype", popupobj.npopup.getAttribute("puptype"));
    this.npopupTX.innerHTML = popupobj.npopupTX.innerHTML;
    this.crnote = popupobj.crnote;
    this.srnote = popupobj.srnote;
  }

  this.activate = function(elem, e) {
    
    // completely ignore further activations if this popup is pinned
    if (this.npopup.getAttribute("pinned") == "true") return false;
    
    // if popup is already assigned to this element, do nothing
    if (this.npopup.parentNode === elem) return true;
    
    this.crnote = null; // for module select feature
    this.srnote = null; // for module select feature
    
    var w = getWindow(elem);
    var mod = (w ? prefs.getCharPref("Version" + w):null);
    try {var type = elem.className.match(/^([^\-\s]+)/)[1];}
    catch (er) {type = null;}
   
    var keepHistory = (w == 0); // means our target is in an existing popup
    
    // Begin building HTML for the popup
    var html = "";
    html += "<div class=\"popupheader cs-Program\">";
    html +=   "<div class=\"popuppin\" pinned=\"" + (this.npopup.getAttribute("pinned")) + "\" ";
    html +=       "onclick=\"Popup.clickpin(" + this.npopup.getAttribute("pinned") + ");\"></div>";
    html +=   "<a class=\"" + (keepHistory ? "popupBackLink":"popupCloseLink") + "\">";
    html +=     MainWindow.SBundle.getString(keepHistory ? "back":"close");
    html +=   "</a>";
    
    html +=   "<select class=\"popup-mod-select\" onchange=\"Popup.select(this.value, " + (w ? w:1) + ");\" >";
    if (mod && (/^(cr|sr)$/).test(type)) {
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType != BIBLE) continue;
        var selected = (Tabs[t].modName == mod ? "selected=\"selected\" ":"");
        html += "<option value=\"" + Tabs[t].modName + "\" class=\"cs-" + Tabs[t].locName + "\" " + selected + ">" + Tabs[t].label + "</option>";
      }
    }
    html +=   "</select>";
    
    html += "</div>";
    
    // If popup is already open, then save the current popup inside the "back" link of this new popup...
    html += "<div class=\"prevhtml\">" + (keepHistory ? this.npopupTX.innerHTML:"") + "</div>";

    html += "<div class=\"popup-text cs-Program\">";
    
    switch (type) {
    
    case "popupBackLink":
      this.npopupTX.innerHTML = this.npopup.getElementsByClassName("prevhtml")[0].innerHTML;
      return true;
      break;
      
    case "cr":
    case "fn":
    case "un":
      if (mod && w) {
        var n = new RegExp("<div id=\"src\\." + type + "\\." + elem.title + "\\.[^\.]+\">.*?<\\/div>");
        this.crnote = Texts.footnotes[w].match(n)[0];
        html += BibleTexts.getNotesHTML(this.crnote, mod, true, true, true, true, w);
      }
      break;

    case "sr":
      if (mod && w) {
        this.srnote = Texts.getScriptureReferences(elem.title != "unavailable" ? elem.title:elem.innerHTML, mod);
        this.srnote = "<div id=\"src.cr.1.0.0.0." + mod + "\">" + this.srnote + "</div>"
        html += BibleTexts.getNotesHTML(this.srnote, mod, true, true, true, true, w);
      }
      break;
    
    case "dtl":
    case "dt":
      if (elem.title) {
        var mdata = elem.title;
        
        // Backward Compatibility to < 2.23
        if (mdata.indexOf(":") == -1) {
          mdata = mdata.replace(" ", "_32_", "g");
          mdata = mdata.replace(";", " ", "g");
          mdata = mdata.replace(/((^|\s)\w+)\./g, "$1:");
        }
        
        var t = mdata.split(" ");
        if (!t || !t[0]) break;
        var dnames="", dword="", sep="";
        for (var i=0; i<t.length; i++) {
          if (!t[i]) continue;
          dnames += sep + t[i].split(":")[0];
          if (!dword) dword = t[i].split(":")[1];
          sep = ";"
        }
      
        html += DictTexts.getEntryHTML(dword, dnames, true);
      }
      break;
      
    case "sn":
      var snlist = elem.className.split(" ");
      if (snlist) snlist.shift(); // remove base class: sn
      if (snlist) html += DictTexts.getLemmaHTML(snlist, elem.innerHTML);
      break;
      
    case "introlink":
      if (mod) html += BibleTexts.getBookIntroduction(mod, Location.getBookName());
      break;
      
    case "noticelink":
      if (mod) html += BibleTexts.getNoticeLink(mod, 1);
      break;
      
    default:
      jsdump("Unhandled popup type \"" + type + "\".\n");
    }
    
    html += "</div>";
    
//jsdump(html); 
//window.setTimeout("debugStyle(document.getElementById('npopup'))", 1000);

    this.npopupTX.innerHTML = html;
    if (w) {
      this.elem = elem;
      this.e = e;
      this.showPopupID = window.setTimeout("Popup.open('" + type + "');", POPUPDELAY);
    }
    
    return true;
  };
  
  this.open = function(type) {
    
    // set max height of popup
    this.npopup.style.maxHeight = (window.innerHeight/2) + "px";
    
    // assign type to popup for CSS
    this.npopup.setAttribute("puptype", type);
    
    // make popup appear (via CSS)
    this.elem.appendChild(this.npopup);
  
    // if popup is overflowing bottom of window, style it differently
    var pupbot = this.e.clientY + this.npopupTX.offsetTop + this.npopupTX.offsetHeight;
    this.npopup.setAttribute("nearBottom", (pupbot > window.innerHeight ? "true":"false"));
  };

  this.close = function() {
    if (window.name == "npopup") {
      window.frameElement.ownerDocument.defaultView.close();
      return;
    }
    
    // Moving the Popup will cause CSS to hide it
    document.getElementsByTagName("body")[0].appendChild(this.npopup);
  };
  
  this.select = function(mod, w) {
    var pt = this.npopupTX.getElementsByClassName("popup-text");
    if (!pt) return;
    pt = pt[0];
    
    if (this.crnote) pt.innerHTML = BibleTexts.getNotesHTML(this.crnote, mod, true, true, true, true, w);
    else if (this.srnote) pt.innerHTML = BibleTexts.getNotesHTML(this.srnote, mod, true, true, true, true, w);
  };
  
  this.clickpin = function(pinned) {
    
    // If we just clicked to pin the Popup...
    if (!pinned) {
      
      // Open a pinned Popup as a separate xul window
      // Get X and Y coordinates for where to create the new xul window
      var X,Y;
      if (window.name == "npopup") {X=1; Y=1;}
      else {
        // on Linux, window.innerHeight = outerHeight = height of entire window viewport, NOT including the operating system frame
        var f = MainWindow.document.getElementById("xulviewport");
        var offset = getOffset(this.npopup);
        X = Number(f.boxObject.x + offset.left + 8);
        Y = Number(f.boxObject.y + offset.top - 8);
        //jsdump("INFO:" + f.boxObject.y + "-" + MainWindow.outerHeight + "+" + v.height + "=" + Y);
      }
      
      // Open the new xul Popup window.
      var p = "chrome,resizable,dependant";
      p += ",left=" + Number(MainWindow.screenX + X);
      p += ",top=" + Number(MainWindow.screenY + Y);
      p += ",width=" + this.npopupTX.offsetWidth;
      p += ",height=" + this.npopupTX.offsetHeight;
      AllWindows.push(MainWindow.open("chrome://xulsword/content/popup.xul", "popup" + String(Math.random()), p));
    }
    
    else if (window.name == "npopup") this.close();
    
    else this.pinup();
  };
  
  this.keydown = function(e) {
    if (e.keyCode != 16) return;
    this.pindown();
  };
  
  this.keyup = function(e) {
    if (e.keyCode != 16) return;
    this.pinup();
  };
  
  this.pindown = function() {
    this.npopup.setAttribute("pinned", true);
  };
  
  this.pinup = function() {
    this.npopup.setAttribute("pinned", false);
  };
  
}

/*
function debugStyle(elem) {
  var s = window.getComputedStyle(elem);
  for (var m in s) {
    jsdump(m + " = " + s[m]);
  }
}
*/
