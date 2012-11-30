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

  initCSS(true);
  
  // This is a windowed popup, so copy the original popup
  Popup = new PopupObj(MainWindow.ViewPortWindow.Popup);
  
  // Close the original popup
  MainWindow.ViewPortWindow.Popup.close();

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
//jsdump("Activating Popup in " + window.name + ":" + elem.className + ", " + e.type);    

    // completely ignore further activations if this popup is pinned
    if (this.npopup.getAttribute("pinned") == "true") return false;
    
    // get our event element's type
    try {var type = elem.className.match(/^([^\-\s]+)/)[1];}
    catch (er) {type = null;}
    
    this.crnote = null; // for module select feature
    this.srnote = null; // for module select feature
    
    // see if a module is associated with this event's element
    var mod = elem;
    while (mod) {
      if (mod.className) {
        var cs = mod.className.match(/(^|\s)cs-(\S+)/);
        if (cs && Tab.hasOwnProperty(cs[2])) {
          mod = cs[2];
          break;
        }
      }
      mod = mod.parentNode;
    }
   
    // did this event originate from inside this popup?
    var updatingPopup = elem;
    while (updatingPopup && updatingPopup !== this.npopup) {updatingPopup = updatingPopup.parentNode;}
    
    // Begin building HTML for the popup
    var html = "";
    html += "<div class=\"popupheader cs-Program\">";
    html +=   "<div class=\"popuppin\" pinned=\"" + (this.npopup.getAttribute("pinned")) + "\" ";
    html +=       "onclick=\"Popup.clickpin(" + this.npopup.getAttribute("pinned") + ");\"></div>";
    html +=   "<a class=\"" + (updatingPopup ? "popupBackLink":"popupCloseLink") + "\">";
    html +=     MainWindow.SBundle.getString(updatingPopup ? "back":"close");
    html +=   "</a>";
    
    html +=   "<select class=\"popup-mod-select\" onchange=\"Popup.select(this.value);\" >";
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
    html += "<div class=\"prevhtml\">" + (updatingPopup ? this.npopupTX.innerHTML:"") + "</div>";

    html += "<div class=\"popup-text cs-Program\">";
    
    switch (type) {
    
    case "popupBackLink":
      this.npopupTX.innerHTML = this.npopup.getElementsByClassName("prevhtml")[0].innerHTML;
      this.checkPopupPosition(e);
      return true;
      break;
      
    case "cr":
    case "fn":
    case "un":
      if (mod) {
        var w = getWindow(elem);
        if (w) {
          var n = new RegExp("<div title=\"src\\." + type + "\\." + elem.title + "\">.*?<\\/div>");
          this.crnote = Texts.footnotes[w].match(n)[0];
          html += BibleTexts.getNotesHTML(this.crnote, mod, true, true, true, true, 1);
        }
      }
      break;

    case "sr":
      if (mod) {
        var entry = elem.innerHTML;
        // elem may have npopup as an appended child! So we need to remove it to get real innerHTML.
        // Note: A RegExp does not seem to be able to match innerHTML for some reason.
        var i = entry.indexOf("id=\"npopup\"");
        if (i != -1) {
          i = entry.lastIndexOf("<", i);
          entry = entry.substring(0, i);
        }
        var mtitle = elem.title.replace(/\.[^\.]+$/, "");
        this.srnote = Texts.getScriptureReferences((mtitle != "unavailable" ? mtitle:entry), mod);
        this.srnote = "<div title=\"src.cr.1.0.0.0." + mod + "\">" + this.srnote + "</div>"
        html += BibleTexts.getNotesHTML(this.srnote, mod, true, true, true, true, 1);
      }
      break;
    
    case "dtl":
    case "dt":
      if (elem.title) {
        var mdata = elem.title.replace(/\.[^\.]+$/, "");
        
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
      var entry = elem.innerHTML;
      // elem may have npopup as an appended child! So we need to remove it to get real innerHTML.
      // Note: A RegExp does not seem to be able to match innerHTML for some reason.
      var i = entry.indexOf("id=\"npopup\"");
      if (i != -1) {
        i = entry.lastIndexOf("<", i);
        entry = entry.substring(0, i);
      }
      if (snlist) html += DictTexts.getLemmaHTML(snlist, entry);
      break;
      
    case "introlink":
      if (mod) html += BibleTexts.getBookIntroduction(mod, Location.getBookName());
      break;
      
    case "noticelink":
      if (mod) html += Bible.getModuleInformation(mod, "NoticeText");
      break;
      
    default:
      jsdump("Unhandled popup type \"" + type + "\".\n");
    }
    
    html += "</div>";
    
    this.npopup.setAttribute("puptype", type);
    this.npopupTX.innerHTML = html;
  
    // Windowed popup...
    if (window.name == "npopup") return true;
    
    // Normal popup updating itself...
    if (updatingPopup) {
      // move popup to insure it's under the mouse
      this.npopup.style.top = this.YmouseDelta + e.clientY + "px";
      this.checkPopupPosition(e);
      return true;
    }
    
    // Normal popup opening anew...
    this.elem = elem;
    this.e = e;
    this.showPopupID = window.setTimeout("Popup.open();", POPUPDELAY);
    return true;
    
  };
  
  this.open = function() {

    // set max height of popup
    this.npopup.style.maxHeight = (window.innerHeight/2) + "px";
    
    // make popup appear (via CSS)
    if (this.npopup.parentNode !== this.elem)
        this.elem.appendChild(this.npopup);
  
    // store current location relative to mouse
    this.npopup.style.top = ""; // reset so that CSS always controls initial location!
    this.YmouseDelta = (Number(window.getComputedStyle(this.npopup).top.replace("px", "")) - this.e.clientY);
    
    this.checkPopupPosition(this.e);

//jsdump(this.npopupTX.innerHTML);
//window.setTimeout("debugStyle(document.getElementById('npopup'))", 1000);

  };
  
  // if popup is overflowing bottom of window, then move it up
  this.checkPopupPosition = function(e) {
    var pupbot = e.clientY + this.npopupTX.offsetTop + this.npopupTX.offsetHeight;
    if (pupbot > window.innerHeight) {
      var currentTop = Number(window.getComputedStyle(this.npopup).top.replace("px", ""));
      if (isNaN(currentTop)) return;
      var newTop = currentTop - pupbot + window.innerHeight - 30;
      if (newTop < 0) newTop = 0;
      this.npopup.style.top = newTop + "px";
    }
  };

  this.close = function() {
  
    // If we're a windowed popup, close the window
    if (window.name == "npopup") {
      window.frameElement.ownerDocument.defaultView.close();
      return;
    }
    
    // Moving the Popup will cause CSS to hide it
    document.getElementsByTagName("body")[0].appendChild(this.npopup);
  };
  
  this.select = function(mod) {
    var pt = this.npopupTX.getElementsByClassName("popup-text");
    if (!pt) return;
    pt = pt[0];
    
    if (this.crnote) pt.innerHTML = BibleTexts.getNotesHTML(this.crnote, mod, true, true, true, true, 1);
    else if (this.srnote) pt.innerHTML = BibleTexts.getNotesHTML(this.srnote, mod, true, true, true, true, 1);
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
