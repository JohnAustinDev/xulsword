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

// Interactive popup window for use in the text box

var Popup;
function initPopup() {
  if (window.name == "npopup") {
    Popup = new PopupObj(MainWindow.CopyPopup);
    document.getElementById("npopupTX").innerHTML = MainWindow.CopyPopup.npopupTX.innerHTML;
    MainWindow.CopyPopup.close();
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
    this.x = null;
    this.y = null;
    this.w = null;
    this.datatype = null;
    this.data = null;
    this.delay = null;
    this.yoffset = null;
    this.mod = null;
    this.selectOpen = null;
    this.showPopupID = null;
  }

  this.activate = function(x, y, w, datatype, data, delay, yoffset, mod) {
    if (x        !== null) this.x = x;
    if (y        !== null) this.y = y;
    if (w        !== null) this.w = w;
    if (datatype !== null) this.datatype = datatype;
    if (data     !== null) this.data = data;
    if (delay    !== null) this.delay = delay;
    if (yoffset  !== null) this.yoffset = yoffset;
    if (mod      !== null) this.mod = mod;
    
    if (this.delay==null) {this.delay = POPUPDELAY;}
    if (!this.yoffset) {this.yoffset = 0;}
    if (!this.mod) {this.mod = prefs.getCharPref("Version" + this.w);}

//jsdump("x=" + this.x + ", y=" + this.y + ", w=" + this.w + ", datatype=" + this.datatype + ", data=" + this.data + ", delay=" + this.delay + ", yoffset=" + this.yoffset + ", mod=" + this.mod);
    
    this.footnotes = Texts.footnotes[w];
    
    // Popup text and style:
    //  Popup Scripture reference links should appear in program's language and style
    //  Popup Scripture reference text and style should be determined correctly
    //    according to the results of findAVerseText (using default = mod)
    //  Popup body text should appear in Win.modname's style as inherited from ScriptBox
    
    // Get fromMod for scripture references, and style.
    var hrule = "";
    var pupAlreadyOpened = (this.npopup.style.display != "none");
    var headlink = MainWindow.SBundle.getString(pupAlreadyOpened ? "back":"close");
    var headlinkclass = (pupAlreadyOpened ? "popupBackLink":"popupCloseLink");
    
    var html = "";
    html += "<div class=\"popupheader cs-Program\">";
    html += "<div class=\"popuppin\" value=\"" + (this.ispinned ? "pinned":"unpinned") + "\" onclick=\"Popup.clickpin(this);\"></div>";
    html += "<a title=\"" + headlinkclass + "\" class=\"" + headlinkclass + "\">" + headlink + "</a>";
    html += "<div onclick=\"Popup.selectOpen=true;\" ><select onchange=\"Popup.select(event);\"></select></div>";
    // If popup is already open, save the current popup in the "back" link of the new one...
    if (pupAlreadyOpened) {
      html += "<div class=\"prevhtml\">" + this.npopupTX.innerHTML + "</div>";
      this.close();
    }
    html += "</div>";

    IgnoreMouseOvers = true; // This should happen after "close()" because close() changes it to false!
    
    switch (this.datatype) {
    
    case "html":
      html = this.data;
      break;
    
    // Cross Reference: data is elem.title
    //    data form: cr#.bk.c.v
    case "cr":
      var dir = (ModuleConfigs[this.mod] && ModuleConfigs[this.mod].direction == "rtl" ? "rtl":"ltr");
      html += "<div class=\"popupbody cs-" + this.mod + " ";
      html += (getPrefOrCreate("OpenCrossRefPopups", "Bool", true) ? "cropened":"crclosed") + "\">";
      html += "<div class=\"twisty twisty-" + dir + "\" onclick=\"Popup.openCloseCRs();\" ></div>";
      
      var re = new RegExp("<div id=\"src\\." + escapeRE(this.data) + "\">(.*?)<\\/div>");
      var p = this.footnotes.match(re);
      if (p && p[1]) {
        html += BibleTexts.getRefHTML(this.w, this.mod, this.data, p[1], "pu", "crhr");
      }
      html += "</div>";
      window.setTimeout("Popup.initModuleSelect('bibles', '" + this.mod + "');", 1);
      break;

    // Footnote: data is elem.title
    //    data form: fn#.bk.c.v
    case "fn":
      var re = new RegExp("<div id=\"src\\." + escapeRE(this.data) + "\">(.*?)<\\/div>");
      var p = this.footnotes.match(re);
      if (p && p[1]) html += p[1];
      break;

    // Scripture Reference: data is elem.title unless it's "unavailable" then it's elem.innerHTML
    //    data form: reference1; reference2    
    case "sr":
      var dir = (ModuleConfigs[this.mod] && ModuleConfigs[this.mod].direction == "rtl" ? "rtl":"ltr");
      html += "<div class=\"popupbody cs-" + this.mod + " ";
      html += (getPrefOrCreate("OpenCrossRefPopups", "Bool", true) ? "cropened":"crclosed") + "\">";
      html += "<div class=\"twisty twisty-" + dir + "\" onclick=\"Popup.openCloseCRs();\" ></div>";
          
      // Split up data into individual passages
      var mdata = this.data + ";";
      mdata = mdata.split(";");
      mdata.pop();
      var cnt = 1;
      // If subreferences exist which are separated by "," then split them out as well
      for (var i=0; i<mdata.length; i++) {
        var verses = mdata[i].split(",");
        if (verses.length == 1) continue;
        var r = 1;
        for (var v=0; v<verses.length; v++) {
          mdata.splice(i+1-r, r, verses[v]);
          i++;
          i -= r;
          r = 0;
        }
      }
      // Parse each reference into a normalized reference, convert verse system and get verse text
      var book = Location.getBookName();
      var chapter = Location.getChapterNumber(this.mod);
      var verse = 1;
      var reflist = "";
      var failhtml = "";
      for (i=0; i<mdata.length; i++) {
        var failed = false;
        var saveref = mdata[i];
  //jsdump(data[i]);
        mdata[i] = normalizeOsisReference(data[i], this.mod);
  //jsdump(data[i] + ", ");
        if (!mdata[i]) {
          var thisloc = parseLocation(saveref);
          if (thisloc) {
            book = thisloc.shortName ? thisloc.shortName:book;
            chapter = thisloc.chapter ? thisloc.chapter:chapter;
            verse = thisloc.verse ? thisloc.verse:verse;
            mdata[i] = book + "." + chapter + "." + verse;
            if (thisloc.lastVerse) {mdata[i] += "-" + book + "." + chapter + "." + thisloc.lastVerse;}
            mdata[i] = normalizeOsisReference(data[i], this.mod);
            if (!mdata[i]) failed = true;
          }
          else failed = true;
        }
        if (failed) {
          book = null;
          chapter = null;
          verse = null;
          failhtml += "<hr>" + saveref + ": <b>????</b><br>";
          continue;
        }
  //jsdump(mdata[i]);
        reflist += mdata[i] + ";";
      }
      html += BibleTexts.getRefHTML(this.w, this.mod, "cr." + cnt++ + ".Gen.1.1", reflist, "pu", "crhr");
      html += failhtml;
      html += "</div>";
      break;
    
    // Glossary Word: data is elem.title
    //    data form: mod1.wrd; mod2.wrd (Backward Compatibility to <2.23)
    //      or form: mod1:wrd mod2:wrd
    case "dtl":
    case "dt":
      // Backward Compatibility to < 2.23
      var mdata = this.data;
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
      // Returns with style of dnames[0]
      html += DictTexts.getEntryHTML(dword, dnames, true);
      //html = insertUserNotes("na", dword, dict, html);
      break;
      
    // User Note: data is elem.id
    //    data form: un.encodedResVal.bk.c.v
    case "un":
      try {
        var resVal = decodeUTF8(this.data.split(".")[1]);
        html += BMDS.GetTarget(BM.RDF.GetResource(resVal), BM.gBmProperties[NOTE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        var unclass = "cs-Program";
        try {
          unclass = "cs-" + BMDS.GetTarget(BM.RDF.GetResource(resVal), BM.gBmProperties[NOTELOCALE], true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
        } 
        catch (er) {}
        html = "<div id=\"unp." + this.data + "\" class=\"" + unclass + "\"><i>" + html + "</i></div>"; // Add an id so that context menu can find resource
      }
      catch (er) {html = "";}
      break;
      
    // Strongs Number or Morphology: data is elem.title
    //    data form: (S|WT|SM|RM):(G|H)#.(S|WT|SM|RM):(G|H)#
    case "sn":
      // Pass data array as param1 and match-word as param2
      // Returns with style of module for data array [0]
      html += DictTexts.getLemmaHTML(this.data.split("]-[")[1].split("."), this.data.split("]-[")[0]);
      break;
      
    case "introlink":
      html += BibleTexts.getBookIntroduction(this.mod, Location.getBookName()) + "<br><br>";
      break;
      
    case "noticelink":
      html += BibleTexts.getNoticeLink(this.mod, 1) + "<br>";
      break;
      
    default:
      jsdump("Unhandled popup datatype \"" + this.datatype + "\".\n");
    }
    
    if (html) {
      this.npopupTX.innerHTML = html;
      this.showPopupID = window.setTimeout("Popup.show(" + this.yoffset + ")", this.delay);
    }
    else {
      IgnoreMouseOvers = false;
    }
    
    return html ? true:false;
  }


  // show() must be called AFTER the popup content has been written to popup.
  this.show = function(yOffset) {
    if (!yOffset) yOffset=0;
    
    IgnoreMouseOvers=false;
    
    // Display was set to "none" and this must be cleared before setting (or reading for sure) other style parameters
    this.npopup.style.display = "block";
    if ((/^popup/).test(window.name)) return;
    
    var top = this.y - 10 + yOffset; 
    if (top + this.npopup.offsetHeight > window.innerHeight) 
        top = (window.innerHeight - this.npopup.offsetHeight);
    if (top < 0) top = 0; 
    
    var left = this.x - (this.npopup.offsetWidth/2);
    if (left + this.npopup.offsetWidth > document.getElementById("viewportbody").offsetWidth)
        left = (document.getElementById("viewportbody").offsetWidth - this.npopup.offsetWidth);
    if (left < 0) left = 0;
    
    this.npopup.style.top = String(top) + "px";
    this.npopup.style.left = String(left) + "px";
    
  };

  this.close = function() {
    if (window.name == "npopup") PopupWindow.close();
    
    this.npopupTX.scrollTop = 0;
    // Stops if preparing to open
    if (this.showPopupID) {
      window.clearTimeout(this.showPopupID);
      IgnoreMouseOvers = false;
    }
    // Clear any note popup
    this.npopupTX.innerHTML="Empty";
    // This prevents the ScriptBox scroll smoothness from being messed up
    this.npopup.style.display = "none";
  };

  this.openCloseCRs = function() {
    this.close();
    prefs.setBoolPref("OpenCrossRefPopups", !prefs.getBoolPref("OpenCrossRefPopups"));
    this.activate(this.x, this.y, this.w, null, null, 0);
  };
  
  this.initModuleSelect = function(type, selmod) {
    var sel = this.npopupTX.getElementsByTagName("select")[0];
    var html = "";
    for (var t=0; t<Tabs.length; t++) {
      switch (type) {
      case "bibles":
        if (Tabs[t].modType == BIBLE) {
          var selected = (Tabs[t].modName == selmod ? "selected=\"selected\" ":"");
          html += "<option value=\"" + Tabs[t].modName + "\" class=\"cs-" + Tabs[t].modName + "\" " + selected + ">" + Tabs[t].label + "</option>";
        }
        break;
      }
    }
    if (html && sel) {
      sel.innerHTML = html;
      sel.style.visibility = "visible";
    }
  };
  
  this.select = function(e) {
    this.selectOpen=false;
    this.activate(this.x, this.y, this.w, null, null, null, null, e.target.value);
  };
  
  this.clickpin = function(pin) {
    if (pin.getAttribute("value") == "unpinned") {
      MainWindow.CopyPopup = this;
      var X,Y;
      if (window.name=="npopup") {X=1; Y=1;}
      else {
        // on Linux, window.innerHeight = outerHeight = height of entire window viewport, NOT including the operating system frame
        var f = MainWindow.document.getElementById("xulviewport");
        X = Number(f.boxObject.x + this.npopup.offsetLeft);
        Y = Number(f.boxObject.y + this.npopup.offsetTop + 30);
        //jsdump("INFO:" + f.boxObject.y + "-" + MainWindow.outerHeight + "+" + v.height + "=" + Y);
      }
      var p = "chrome,resizable,dependant";
      p += ",left=" + Number(MainWindow.screenX + X);
      p += ",top=" + Number(MainWindow.screenY + Y);
      p += ",width=" + this.npopup.offsetWidth;
      p += ",height=" + this.npopup.offsetHeight;
      AllWindows.push(MainWindow.open("chrome://xulsword/content/popup.xul", "popup" + String(Math.random()), p));
    }
    else if (window.name == "npopup") this.close();
    else pinup();
  };
  
  this.keydown = function(e) {
    if (e.keyCode == 16) {
      this.pindown();
      IgnoreMouseOvers = true;
    }
  };
  
  this.keyup = function(e) {
    if (e.keyCode != 16) return;
    var elem = MouseIsOver;
    while(elem) {
      if (elem.id && elem.id == "npopup") break; 
      elem = elem.parentNode;
    }
    this.pinup(!elem || !elem.id || (elem.id && elem.id != "npopup"));
    IgnoreMouseOvers = false;
  };
  
  this.pindown = function() {
    var pin = document.getElementsByClassName("popuppin");
    if (pin.length) pin[0].setAttribute("value", "pinned");
    this.npopup.setAttribute("value", "pinned");
    this.ispinned = true;
  };
  
  this.pinup = function(thenclose) {
    var pin = document.getElementsByClassName("popuppin");
    if (pin.length) pin[0].setAttribute("value", "unpinned");
    this.npopup.setAttribute("value", "unpinned");
    this.ispinned = false;
    if (thenclose) Popup.close();
  };
  
}


/*
  this.mouseisdown = false;
  this.mouseX = null;
  this.mouseY = null;
  
  this.mousedown = function(e) {
    this.mouseisdown = true;
    this.mouseX = e.screenX - e.screenX;
    this.mouseY = e.screenY - e.screenY;
  }

  this.mousemove = function(e) {
    //if (!this.mouseisdown || !this.ispinned) return;
    //PopupWindow.moveTo(e.screenX-this.mouseX, e.screenY-this.mouseY);
  }
    
  this.mouseup = function(e) {this.mouseisdown = false;}
*/
