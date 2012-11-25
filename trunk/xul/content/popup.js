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
  
  // Create our Popup
  if (window.name == "npopup") {
  
    // This is a windowed popup, so copy the original popup
    Popup = new PopupObj(MainWindow.ViewPortWindow.Popup);
    document.getElementById("npopupTX").innerHTML = MainWindow.ViewPortWindow.Popup.npopupTX.innerHTML;
    
    // Close the original popup and pin the new one
    MainWindow.ViewPortWindow.Popup.close();
    Popup.pindown();
  }
  else {Popup = new PopupObj();}

}
    
function PopupObj(popupobj) {
  this.npopup = document.getElementById("npopup");
  this.npopupTX = document.getElementById("npopupTX");
  
  // copy the calling popupobj
  if (popupobj) {
    for (var m in popupobj) {
      this[m] = popupobj[m];
    }
  }

  // or else initialize a fresh popup object
  else {
    this.type = null;
    this.elem = null;
    this.mod = null;
    
    this.showPopupID = null;
    this.isPopupPinned = false;
  }

  this.activate = function(type, elem, mod) {
    var w = getWindow(elem);
    if (w === null) return false;
   
    if (type) this.type = type;
    if (elem) this.elem = elem;
    if (mod) this.mod = mod;
    else if (w) this.mod = prefs.getCharPref("Version" + w);
    //else the elem came from this popup, so keep old mod...
    
    // Begin building HTML for the popup
    var html = "";
    
    var alreadyInPopup = (w == 0);

    var headlink = MainWindow.SBundle.getString(alreadyInPopup ? "back":"close");
    var headlinkclass = (alreadyInPopup ? "popupBackLink":"popupCloseLink");
    
    html += "<div class=\"popupheader cs-Program\">";
    html +=   "<div class=\"popuppin\" pinned=\"" + (this.isPopupPinned ? "true":"false") + "\" onclick=\"Popup.clickpin(this);\"></div>";
    html +=   "<a class=\"" + headlinkclass + "\">" + headlink + "</a>";
    
    html +=   "<select class=\"popup-mod-select\" onchange=\"Popup.select(this.value);\" >";
    if ((/^(cr|sr)$/).test(type)) {
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[0].modType != BIBLE) continue;
        var selected = (Tabs[t].modName == this.mod ? "selected=\"selected\" ":"");
        html += "<option value=\"" + Tabs[t].modName + "\" class=\"cs-" + Tabs[t].modName + "\" " + selected + ">" + Tabs[t].label + "</option>";
      }
    }
    html +=   "</select>";
    
    html += "</div>";
    
    // If popup is already open, then save the current popup inside the "back" link of this new popup...
    html += "<div class=\"prevhtml\">" + (alreadyInPopup ? this.npopupTX.innerHTML:"") + "</div>";

    html += "<div class=\"popup-text\" textdir=\"" + ModuleConfigs[this.mod].direction + "\" moduleType=\"" + Tab[this.mod].tabType + "\">";
    
    switch (this.type) {
    
    case "popupBackLink":
      this.npopupTX.innerHTML = this.npopup.getElementsByClassName("prevhtml")[0].innerHTML;
      return true;
      break;
      
    case "cr":
    case "fn":
    case "un":
      var n = new RegExp("<div id=\"src\\." + this.type + "\\." + this.elem.title + "\\.[^\.]+\">.*?<\\/div>");
      html += BibleTexts.getNotesHTML(Texts.footnotes[w].match(n)[0], this.mod, true, true, true, true, w);
      break;

    case "sr":
      var reflist = Texts.getScriptureReferences(this.elem.title != "unavailable" ? this.elem.title:this.elem.innerHTML, this.mod);
      html += BibleTexts.getNotesHTML("<div id=\"src.cr.1.0.0.0." + this.mod + "\">" + reflist + "</div>", this.mod, true, true, true, true, w);
      break;
    
    case "dtl":
    case "dt":
      var mdata = this.elem.title;
      
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
      break;
      
    case "sn":
      var snlist = this.elem.className.split(" ");
      snlist.shift(); // remove base class: sn
      html += DictTexts.getLemmaHTML(snlist, this.elem.innerHTML);
      break;
      
    case "introlink":
      html += BibleTexts.getBookIntroduction(this.mod, Location.getBookName());
      break;
      
    case "noticelink":
      html += BibleTexts.getNoticeLink(this.mod, 1);
      break;
      
    default:
      jsdump("Unhandled popup type \"" + this.type + "\".\n");
    }
    
    html += "</div>";
    
//jsdump(html); 
//window.setTimeout("debugStyle(document.getElementById('npopup'))", 1000);

    this.npopupTX.innerHTML = html;
    if (!alreadyInPopup) {
      this.showPopupID = window.setTimeout("Popup.elem.appendChild(Popup.npopup)", POPUPDELAY);
    }
    
    return true;
  };

  this.close = function() {
    if (window.name == "npopup") {
      window.frameElement.ownerDocument.defaultView.close();
      return;
    }
    
    // Moving the Popup will cause CSS to hide it
    document.getElementsByTagName("body")[0].appendChild(this.npopup);
  };
  
  this.select = function(mod) {
    Popup.activate(Popup.type, Popup.elem, mod);
  };
  
  this.clickpin = function(pin) {
    
    // If we just clicked to pin the Popup...
    if (pin.getAttribute("pinned") == "false") {
      
      // Open a pinned Popup as a separate xul window
      // Get X and Y coordinates for where to create the new xul window
      var X,Y;
      if (window.name == "npopup") {X=1; Y=1;}
      else {
        // on Linux, window.innerHeight = outerHeight = height of entire window viewport, NOT including the operating system frame
        var f = MainWindow.document.getElementById("xulviewport");
        var offset = getOffset(this.npopup);
        X = Number(f.boxObject.x + offset.left);
        Y = Number(f.boxObject.y + offset.top - 16);
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
    this.npopup.getElementsByClassName("popuppin")[0].setAttribute("pinned", "true");
    this.isPopupPinned = true;
  };
  
  this.pinup = function() {
    this.npopup.getElementsByClassName("popuppin")[0].setAttribute("pinned", "false");
    this.isPopupPinned = false;
  };
  
}

function debugStyle(elem) {
  var s = window.getComputedStyle(elem);
  for (var m in s) {
    jsdump(m + " = " + s[m]);
  }
}
