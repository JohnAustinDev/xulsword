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
const POPUPDELAY_STRONGS = 1000;

var Popup;

function initWindowedPopup() {

  initCSS();
  
  // This is a windowed popup, so copy the original popup
  Popup = new PopupObj(XS_window.Popup);
  
  // eventListeners are not copied by DOM manipulation, so add them now
  var selects = document.getElementsByClassName("popup-mod-select");
  for (var i=0; i<selects.length; i++) {Popup.addSelectEventListener(selects[i]);}
  var towindows = document.getElementsByClassName("towindow");
  for (var i=0; i<towindows.length; i++) {
		towindows[i].addEventListener("click", function () {Popup.towindow();});
	}
  
  // Close the original popup
  XS_window.Popup.close();

}
    
function PopupObj(popupobj) {

  this.npopup = document.getElementById("npopup");
  this.npopupRL = document.getElementById("npopupRL");
  this.npopupBOX = document.getElementById("npopupBOX");
  this.npopupTX = document.getElementById("npopupTX");
  this.showPopupID = null;
  this.selectRef = {};
    
  if (popupobj) {
    this.npopup.setAttribute("puptype", popupobj.npopup.getAttribute("puptype"));
    
    while (this.npopupTX.firstChild) {this.npopupTX.removeChild(this.npopupTX.firstChild);}
    for (var i=0; i<popupobj.npopupTX.childNodes.length; i++) {
			this.npopupTX.appendChild(document.importNode(popupobj.npopupTX.childNodes[i], true));
		}

    // copy popupobj additional members (excluding functions) to the new object
    for (var p in popupobj) {
      if ((/(npopup|npopupRL|npopupBOX|npopupTX|showPopupID)/).test(p)) continue;
      if (typeof(popupobj[p]) == "function") continue;
      this[p] = deepClone(popupobj[p]);
    }
  }

  // returns false if popup cannot open for any reason
  this.activate = function(elem, e) {
//jsdump("Activating Popup in " + window.name + ":" + elem.className + ", " + e.type);    

    // get our event element's type and mod etc.
    var type = elem.className.match(/^([^\s\-]+)?/)[0];
    var p = getElementInfo(elem); // p may be null because not all handled elements are in TextClasses
   
    // did this event originate from inside this popup?
    var updatingPopup = elem;
    while (updatingPopup && updatingPopup !== this.npopup) {updatingPopup = updatingPopup.parentNode;}
    
    // dictionary modules may have a "ReferenceBible" conf entry
    var referenceBible;
    if (p && p.mod && this.selectRef.hasOwnProperty(p.mod)) {
			referenceBible = this.selectRef[p.mod];
		}
		else {
			referenceBible = (p && p.mod ? p.mod:null);
			if (referenceBible && Tab.hasOwnProperty(referenceBible) && Tab[referenceBible].modType == DICTIONARY) {
				var aref = LibSword.getModuleInformation(referenceBible, "ReferenceBible");
				if (aref && aref != NOTFOUND && Tab.hasOwnProperty(aref)) referenceBible = aref;
			}
		}

    var res = "";
    switch (type) {
    
    case "popupBackLink":
      var old = this.npopup.getElementsByClassName("prevhtml")[0];
      this.npopup.setAttribute("puptype", old.getAttribute("title"));
      var oldchildren = [];
      while (old.firstChild) {oldchildren.push(old.removeChild(old.firstChild));}
      while (this.npopupTX.firstChild) {this.npopupTX.removeChild(this.npopupTX.firstChild);}
      for (var i=0; i<oldchildren.length; i++) {
				this.npopupTX.appendChild(oldchildren[i]);
			}
      this.setTitle();
      this.checkPopupPosition(e);
      return true;
      break;
      
    case "cr":
    case "fn":
    case "un":
      if (!p || !p.mod) return false;
      var w = getContextWindow(elem);
      if (w === null) return false;
      if (w == 0) {
        // must read the entire chapter text before any notes can be read
        LibSword.getChapterText(p.mod, p.bk + " " + p.ch);
        Texts.footnotes[w] = LibSword.getNotes();
      }
      if (!Texts.footnotes[w]) return false;
      var re = "<div class=\"nlist\" title=\"" + type + "." + escapeRE(p.title) + "\">.*?<\\/div>";
      re = new RegExp(re);
      
      var myNote = Texts.footnotes[w].match(re);
      if (!myNote) return false;
      myNote = myNote[0];
      
      res = BibleTexts.getNotesHTML(myNote, (referenceBible ? referenceBible:p.mod), true, true, true, true, 1, false);
      res += "<div class=\"popup-noteAddress is_" + type + "\">" + myNote + "</div>";
      break;

    case "sr":
      if ((!p || !p.mod) && !referenceBible) return false;
      referenceBible = (referenceBible ? referenceBible:p.mod);
      var entry = elem.innerHTML;
      // elem may have npopup as an appended child! So we need to remove it to get real innerHTML.
      // Note: A RegExp does not seem to be able to match innerHTML for some reason (needed escapeRE!?).
      var i = entry.indexOf("id=\"npopup\"");
      if (i != -1) {
        i = entry.lastIndexOf("<", i);
        entry = entry.substring(0, i);
      }
      var myNote = "<div class=\"nlist\" title=\"cr.1.0.0.0." + referenceBible + "\">" + (p.reflist[0] != "unavailable" ? p.reflist.join(";"):entry) + "</div>";
      
      res = BibleTexts.getNotesHTML(myNote, referenceBible, true, true, true, true, 1, true);
      res += "<div class=\"popup-noteAddress is_" + type + "\">" + myNote + "</div>";
      break;
    
    case "dtl":
    case "dt":
      if (!p || !p.reflist) return false;
      
      var dnames="", dword="", sep="";
      for (var i=0; i<p.reflist.length; i++) {
        if (!p.reflist[i]) continue;
        dnames += sep + p.reflist[i].split(":")[0];
        if (!dword) dword = p.reflist[i].split(":")[1];
        sep = ";"
      }
    
      res = DictTexts.getEntryHTML(dword, dnames);
      break;
      
    case "sn":
      var mod = getContextModule(elem);
      if (!mod) return false;

      var snlist = elem.className.split(" ");
      if (snlist && snlist.length > 1) snlist.shift(); // remove base class: sn
      else return false;
      
      var entry = elem.innerHTML;
      // elem may have npopup as an appended child! So we need to remove it to get real innerHTML.
      // Note: A RegExp does not seem to be able to match innerHTML for some reason.
      var i = entry.indexOf("id=\"npopup\"");
      if (i != -1) {
        i = entry.lastIndexOf("<", i);
        entry = entry.substring(0, i);
      }
      this.lemmaInfo = { snlist:snlist, entry:entry, mod:mod };
      res = DictTexts.getLemmaHTML(snlist, entry, mod);
      break;
      
    case "introlink":
      var w = getContextWindow(elem);
      if (!w) return false;
      var intros = document.getElementById("text" + w).getElementsByClassName("introtext");
      for (var i=0; i<intros.length; i++) {if (intros[i].title == elem.title) {break;}}
      if (i < intros.length) res = intros[i].innerHTML;
      break;
      
    case "noticelink":
      var w = getContextWindow(elem);
      if (!w) return false;
      res = document.getElementById("text" + w).getElementsByClassName("noticetext")[0].innerHTML;
      break;
      
    default:
      jsdump("Unhandled popup type \"" + type + "\".\n");
      return false;
    }
    if (!res) return false;
    
    this.npopup.setAttribute("puptype", type);

		// save old popup
		var oldChildren = [];
		while(this.npopupTX.firstChild) {
			oldChildren.push(this.npopupTX.removeChild(this.npopupTX.firstChild));
		}
		
		// build the new popup's DOM
		var popupheader = this.npopupTX.appendChild(document.createElement("div"));
		popupheader.className = "popupheader cs-Program";
		var towindow = popupheader.appendChild(document.createElement("div"));
		towindow.className = "towindow";
		towindow.addEventListener("click", function () {Popup.towindow();});
		var backlink = popupheader.appendChild(document.createElement("a"));
		backlink.className = (updatingPopup ? "popupBackLink":"popupCloseLink");
		backlink.textContent = XSBundle.getString(updatingPopup ? "back":"close");
		var draghandle = popupheader.appendChild(document.createElement("div"));
		draghandle.className = "draghandle";

    // append select drop-down for cr and sr
    if (p && p.mod && (/^(cr|sr)$/).test(type)) {
      var bmods = [];
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType == BIBLE) bmods.push(Tabs[t].modName);
      }
      this.appendModSelect(popupheader, bmods, referenceBible, false, p.mod);
    }
    
    // append select drop-down(s) for sn
    if ((/^(sn)$/).test(type)) {
      for (var sls in SpecialModules.LanguageStudy) {
        if (SpecialModules.LanguageStudy[sls].length < 2) continue; // need no button if only one choice
        if (sls=="HebrewDef" & !(/S_H/).test(elem.className)) continue; // need no button if nothing applicable in popup
        if (sls=="GreekDef" & !(/S_G/).test(elem.className)) continue;
        if (sls=="GreekParse" & !(/SM_G/).test(elem.className)) continue;
        this.appendModSelect(
					popupheader,
          SpecialModules.LanguageStudy[sls], 
          prefs.getCharPref("Selected" + sls), 
          true, sls
        );
      }
    }
    
    // If popup is already open, then save the current popup inside the "back" link of this new popup...
    var prevcontent = this.npopupTX.appendChild(document.createElement("div"));
    prevcontent.className = "prevhtml";
    prevcontent.setAttribute("title", this.npopup.getAttribute("puptype"));
    if (updatingPopup) {
			for (var i=0; i<oldChildren.length; i++) {
				prevcontent.appendChild(oldChildren[i]);
			}
		}

		// finally add our new popup results
		var newcontent = this.npopupTX.appendChild(document.createElement("div"));
		newcontent.className = "popup-text cs-Program";
		setInnerHTML(newcontent, res);

    // Windowed popup...
    if ((/windowedPopup$/).test(window.name)) {
      this.setTitle();
      return true;
    }
    
    // Normal popup updating itself...
    if (updatingPopup) {
      this.npopupBOX.scrollTop = 0;
      
      // move popup to insure it's under the current mouse position
      this.npopupBOX.style.top = Number(e.clientY - this.parentY - 20) + "px";
      this.checkPopupPosition(e);
      return true;
    }
    
    // Normal popup opening anew...
    this.elem = elem;
    this.e = e;
    this.showPopupID = window.setTimeout(function () {Popup.open();}, (type == "sn" ? POPUPDELAY_STRONGS:POPUPDELAY));
    return true;
    
  };
  
  this.appendModSelect = function(parent, mods, selectMod, isFeature, arg2) {
		var select = parent.appendChild(document.createElement("select"));
		select.className = "popup-mod-select";
		select.setAttribute("title", isFeature + "," + arg2);
		this.addSelectEventListener(select);
		
    for (var m=0; m<mods.length; m++) {
      if (!Tab[mods[m]]) continue;
      var option = select.appendChild(document.createElement("option"));
      option.className = "cs-" + Tab[mods[m]].locName;
      option.setAttribute("value", mods[m]);
      if (mods[m] == selectMod) option.setAttribute("selected", "selected");
      option.textContent = Tab[mods[m]].label;
    }
    
  };
  
  this.addSelectEventListener = function (selectElem) {
		var title = selectElem.getAttribute("title");
		if (!title) return;
		title = title.split(",");
		if (!title.length || title.length != 2) return;
		var isFeature = (title[0] == "true");
		var arg2 = title[1];
		if (!isFeature) selectElem.addEventListener("change", function (event) {Popup.select(event, arg2);});
		else selectElem.addEventListener("change", function (event) {Popup.selectFeature(event, arg2);});
	};
  
  this.setTitle = function() {
    if (!(/windowedPopup$/).test(window.name)) return; // only windowed popups need titles
    var title = "";
    
    var pt = this.npopupTX.getElementsByClassName("popup-text");
    if (!pt || !pt.length) return;
    pt = pt[pt.length-1]; // the pt we want is the last in the tree
  
    var html = pt.innerHTML.replace(/(\s*&nbsp;\s*)+/g, " ");
    html = html.replace(/^.*?class=\"cs-[^>]*>/, ""); // find module text
    html = html.replace(/<[^>]*>/g, ""); // remove all tags
    title = html.substring(0, html.indexOf(" ", 24)) + "…"; //shorten it
  
    frameElement.ownerDocument.title = fixWindowTitle(title);
  };
  
  this.open = function() {

    // set max height of popup
    this.npopup.style.maxHeight = (window.innerHeight/2) + "px";
    
    // make popup appear (via CSS)
    if (this.npopup.parentNode !== this.elem)
        this.elem.insertBefore(this.npopup, this.elem.firstChild);
  
    // reset Javascript pupTXtop and store initial location relative to mouse
    this.npopupBOX.style.top = ""; // reset so that CSS always controls initial location!
    this.npopupBOX.style.left = "";

    // getting parentY is tricky. Using offsetTop is difficult and must 
    // also take scrollTop into account. Using e.clientY is not exact,
    // but it's very close and very easy.
    this.parentY = this.e.clientY;
    
    this.checkPopupPosition(this.e);

//jsdump(this.npopupTX.innerHTML);
//window.setTimeout(function () {debugStyle(document.getElementById('npopup'));}, 1000);

  };
  
  // if popup is overflowing the bottom of the window, then move it up
  this.checkPopupPosition = function(e) {
    const margin = 30; // allow margin between bottom of window
    
    var pupRLtop = Number(window.getComputedStyle(this.npopupRL).top.replace("px", ""));
    var pupBOXtop = Number(window.getComputedStyle(this.npopupBOX).top.replace("px", ""));
    if (isNaN(pupRLtop)) pupRLtop = 0;
    if (isNaN(pupBOXtop)) pupBOXtop = 0;

    var pupbot = this.parentY + pupRLtop + pupBOXtop + this.npopupBOX.offsetHeight;

    if (pupbot > window.innerHeight) {
      pupBOXtop = window.innerHeight - this.parentY - pupRLtop - this.npopupBOX.offsetHeight;
      this.npopupBOX.style.top = Number(pupBOXtop - margin) + "px";
    }
  };

  this.close = function() {
  
    // If we're a windowed popup, just close the window
    if ((/windowedPopup$/).test(window.name)) {
      closeWindowXS(window.frameElement.ownerDocument.defaultView);
      return;
    }
    
    // Moving the Popup will cause CSS to hide it
    document.getElementsByTagName("body")[0].appendChild(this.npopup);
  };
  
  this.select = function(e, msrc) {
		var mod = e.target.value;
    var pt = this.npopupTX.getElementsByClassName("popup-text");
    if (!pt) return;
    pt = pt[pt.length-1]; // the pt we want is the last in the tree
    
    var n = pt.getElementsByClassName("popup-noteAddress");
    if (!n) return;
    n = n[0];

    var h = BibleTexts.getNotesHTML(n.innerHTML, mod, true, true, true, true, 1, (/(^|\s+)is_sr(\s+|$)/).test(n.className));
    h += "<div class=\"" + n.className + "\" style=\"display:none;\">" + n.innerHTML + "</div>";
    setInnerHTML(pt, h);
    Popup.setTitle();
    this.selectRef[msrc] = mod;
    this.setSelectAttribute(e.target, mod);
  };
  
  this.selectFeature = function(e, feature) {
		var mod = e.target.value;
    var pt = this.npopupTX.getElementsByClassName("popup-text");
    if (!pt) return;
    pt = pt[pt.length-1]; // the pt we want is the last in the tree
    
    prefs.setCharPref("Selected" + feature, mod);
    setInnerHTML(pt, DictTexts.getLemmaHTML(this.lemmaInfo.snlist, this.lemmaInfo.entry, this.lemmaInfo.mod));
    Popup.setTitle();
    this.setSelectAttribute(e.target, mod);
  };
  
  // this is only needed so that when selects are copied using DOM
  // manipulation functions, the selection will be copied as well
  this.setSelectAttribute = function(selectElem, mod) {
		for (var i=0; i<selectElem.childNodes.length; i++) {
			if (selectElem.childNodes[i].value == mod) {
				selectElem.childNodes[i].setAttribute("selected", "selected");
			}
			else selectElem.childNodes[i].removeAttribute("selected");
		}
	};
  
  this.towindow = function() {
    
    // Open a pinned Popup as a separate xul window
    // Get X and Y coordinates for where to create the new xul window
    var X,Y;
    // on Linux, window.innerHeight = outerHeight = height of entire window viewport, NOT including the operating system frame
    var f = window.frameElement;
    var wintop = f.ownerDocument.defaultView;
    var offset = getOffset(this.npopupBOX);
    X = Number(f.boxObject.x + offset.left);
    Y = Number(f.boxObject.y + offset.top);
    //jsdump("INFO:" + f.boxObject.y + "-" + XS_window.outerHeight + "+" + v.height + "=" + Y);
  
		// save this Popup so new window can copy it
		XS_window.Popup = this;
		
    // Open the new xul Popup window.
    var p = "chrome,resizable,dependant";
    p += ",left=" + Number(wintop.screenX + X);
    p += ",top=" + Number(wintop.screenY + Y);
    p += ",width=" + this.npopupBOX.offsetWidth;
    p += ",height=" + this.npopupBOX.offsetHeight;
    openWindowXS("chrome://xulsword/content/viewport/popup/popup.xul", "popup", p, null, wintop);

  };

	this.PopupY = 0;
	this.PopupX = 0;
	
	this.drag = function(type, e) {
		var popupTX = document.getElementById("npopupTX");
		var popupBOX = document.getElementById("npopupBOX");

		switch (type) {
			
		case "down":
			if (e.target.className == 'draghandle' || e.target === popupTX) {
				this.PopupY = e.clientY + 40; // the 20 helps quick upward drags to not inadvertently leave the popup
				this.PopupX = e.clientX;
				popupTX.style.cursor = "move";
				e.stopPropagation();
				e.preventDefault();
			}
			break;
			
		case "move":
			if (!this.PopupY) return;
			
			var puptop = Number(window.getComputedStyle(popupBOX).top.replace("px", ""));
			if (isNaN(puptop)) return;
			
			popupBOX.style.top = Number(puptop + e.clientY - this.PopupY) + "px";
			this.PopupY = e.clientY;
			
			var isSearch = e.target;
			while(isSearch && (!isSearch.id || isSearch.id != "search-content")) {
				isSearch = isSearch.parentNode;
			}
		
			if (isSearch) {
				
				var pupleft = Number(window.getComputedStyle(popupBOX).left.replace("px", ""));
				if (!isNaN(pupleft)) {		
						
				popupBOX.style.left = Number(pupleft + e.clientX - this.PopupX) + "px";
				this.PopupX = e.clientX;
				}
			}
			
			e.stopPropagation();
			e.preventDefault();
			break;
			
		case "up":
			this.PopupY = 0;
			this.PopupX = 0;
			popupTX.style.cursor = "";
			break;
			
		}
	};
	
	
	this.setTitle();
}
