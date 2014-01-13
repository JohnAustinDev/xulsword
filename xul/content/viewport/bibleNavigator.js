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

// VARIABLES AND FUNCTIONS FOR THE CHOOSER, USED IN SCRIPT.HTML FRAME #1

/************************************************************************
 * Create the Bible Navigator (chooser)
 ***********************************************************************/  

BibleNavigator = {
  doc: function() {return ViewPort.ownerDocument;},
  
  drawOTbooks: function() {
    var html = "";
    for (var b=0; b<=NumOT-1; b++) {html += this.drawBook(b);}
    return html;
  },

  drawNTbooks: function() {
    var html = "";
    for (var b=NumOT; b<=Book.length-1; b++) {html += this.drawBook(b);}
    return html;
  },

  drawBook: function(b) {
    var html = "";
    html += "<div id=\"book_" + b + "\" class=\"bookname\">";
    html += "<div class=\"bookname-div1\">";
    html += "<div class=\"bookname-div2\">";
    html += Book[b].bName;
    html += "<div class=\"charrow\"></div>";
    html += this.writeChapterMenu(b);
    html += "</div>";
    html += "</div>";
    html += "</div>";
    return html;
  },

  writeChapterMenu: function(bk) {
    var html = "";
    html += "<div id=\"chmenu_" + bk + "\" headingmenu=\"hide\" class=\"chaptermenu\">";
    var dend;
    var row=1; 
    var col=1;
    for (var ch=1; ch<=LibSword.getMaxChapter("KJV", Book[bk].sName); ch++) {
      if (col == 1) {
        html += "<div class=\"chaptermenurow\">";
        dend="</div>";
      }
      html += "<div id=\"chmenucell_" + bk + "_" + ch + "\" class=\"chaptermenucell cs-Program\">";
      html += dString(ch);
      html += "</div>";
      col++; 
      if (col == 11) {col=1; row++; html += dend; dend="";}
    }
    for (col; col<11; col++) { html += "<div class=\"emptych\"></div>";}
    html += dend;
    
    //Chapter Heading menu
    html += "<div id=\"headingmenu_" + bk + "\" class=\"headingmenu\"></div>";
    
    html += "</div>";
    
    return html;
  },

  verticalWrite: function(txt) {
    var str=""
    for (var i=0; i<txt.length; i++) {
      str += txt.substr(i,1) + "<br>";
    }
    return str;
  },

/************************************************************************
 * Interactive Mouse Response routines for chooser
 ***********************************************************************/  
  ShowChooserTO:null,
  ShowHeadingTO:null,
  MouseScrollTO:null,

  mouseHandler: function(e) {
    var t;
    if (this.ShowHeadingTO) window.clearTimeout(this.ShowHeadingTO);
    if (e.type == "mouseout" && e.target.id && e.target.id.substr(0,12) == "headingmenu_") {
      t = e.relatedTarget;
      while(t && (!t.id || (t.id && t.id != e.target.id))) {t = t.parentNode;}
      if (!t || t.id != e.target.id) {
        this.doc().getElementById(e.target.id.replace("headingmenu_", "chmenu_")).setAttribute("headingmenu", "hide");
      }
    }
    
    t = e.target;
    while(t && !t.id) {t = t.parentNode;}
    
    if (t) var p = t.id.split("_");
    else return;

    switch(p[0]) {
    
    // Testament selector of the Bible Navigator
    case "testament":
      switch (e.type) {
      case "mouseover":
        if (this.ShowChooserTO) window.clearTimeout(this.ShowChooserTO);
        this.ShowChooserTO = window.setTimeout(function () {BibleNavigator.showChooser(p[1], false);}, 100);
        break;
      
      case "mouseout":
        if (this.ShowChooserTO) window.clearTimeout(this.ShowChooserTO);
        break;
        
      case "click":
        Location.setLocation(ViewPort.firstDisplayBible(), Book[(p[1]=="ot" ? 0:NumOT)].sName + ".1.1");
        XSNS_MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHTNONE);
        break;
      }
      break;
      
    // Book selector of the Bible Navigator
    case "book":
      switch (e.type) {  
      case "mouseover":
        if (!this.MouseScrollTO) {
          this.MouseScrollTO = window.setTimeout(function () {BibleNavigator.mouseScroll(t.parentNode.id, t.offsetTop);}, 100);
        }
        break;
      case "click":
        Location.setLocation(ViewPort.firstDisplayBible(), Book[p[1]].sName + ".1.1");
        XSNS_MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHTNONE);
        break;
      }
      break;
      
    // Chapter menu of the Bible Navigator
    case "chmenucell":
      switch(e.type) {
      case "mouseover":
        this.doc().getElementById("chmenu_" + p[1]).setAttribute("headingmenu", "hide");
        if (this.ShowHeadingTO) window.clearTimeout(this.ShowHeadingTO);
        this.ShowHeadingTO = window.setTimeout(function () {BibleNavigator.showHeadings(e.target.id, e.clientY);}, 500);
        if (!this.MouseScrollTO && 
            (e.target.parentNode.parentNode.offsetHeight - e.target.offsetTop > 
            this.doc().getElementById("book_1").offsetTop - this.doc().getElementById("book_0").offsetTop)) {
          var offsetTop = 0;
          var m = e.target;
          while(m && (!m.id || !(/^book_\d+$/).test(m.id))) {
            if (m.id) offsetTop += m.offsetTop; // ok- this just happens to work :)
            m = m.parentNode;
          }
          offsetTop += m.offsetTop;
          this.MouseScrollTO = window.setTimeout(function () {BibleNavigator.mouseScroll(m.parentNode.id, offsetTop);}, 100);
        }
        break;
          
      case "click":
        Location.setLocation(ViewPort.firstDisplayBible(), Book[p[1]].sName + "." + p[2] + ".1.1");
        XSNS_MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHTNONE);
        break
      }
      break;
      
    // Open/Close buttons on the Bible Navigator
    case "chbutton":
      if (e.type == "click") {
        ViewPort.ShowChooser = (p[1] == "open");
        ViewPort.update();
      }
      break;
      
    case "headlink":
      if (e.type == "click") {
        Location.setLocation(p[4], p[1] + "." + p[2] + "." + p[3]);
        XSNS_MainWindow.Texts.update(SCROLLTYPECENTER, HILIGHTNONE);
      }
      break;
      
    }
  },

  showChooser: function(tsmt, resetchooser) {
    this.doc().getElementById("biblechooser").setAttribute("showing", tsmt);
    if (resetchooser) this.doc().getElementById("biblebooks_" + tsmt).style.top = "8px";
    ViewPort.update(true);
  },

  showHeadings: function(myid, screenY) {
    var biblemod = ViewPort.firstDisplayBible();
    if (!biblemod) return;
    
    //Set Bible params and read chapter
    var p = myid.split("_");
    LibSword.setGlobalOption("Headings", "On");
    LibSword.setGlobalOption("Verse Numbers", "On");

    var chtxt = LibSword.getChapterText(biblemod, Book[p[1]].sName + "." + p[2] + ".1.1");
    
    // Find all headings and their following verses
    var hdplus = /<div[^>]*class="head1[^"]*"[^>]*>.*?<\/div>.*?<sup[^>]*>\d+<\/sup>/gim; // Get Array of head + next verse's
    var hd = /(<div[^>]*class="head1[^"]*"[^>]*>)(.*?)<\/div>/i;                          // Get heading from above
    var vs = /<sup[^>]*>(\d+)<\/sup>/i;                                                   // Get verse from above
    
    //  Find each heading and write it and its link to HTML
    var head = chtxt.match(hdplus);
    var html = "";
    var hr="";
    if (head != null) {
      for (var h=0; h < head.length; h++) {
        var heading = head[h].match(hd)[1].replace(/head1/, "nohead") + head[h].match(hd)[2].replace(/<[^>]*>/g, "") + "</div>";
        var verse = head[h].match(vs)[1];
        if (!(/^<div[^>]*>\s*<\/div>$/).test(heading)) {
          html += hr + "<a class=\"heading-link cs-" + biblemod + "\" id=\"headlink_" + Book[p[1]].sName + "_" + p[2] + "_" + verse + "_" + biblemod + "\" >" + heading + "</a>"; 
          hr="<hr>";
        }
      }
    }
    
    // If headings were found, then display them inside the popup
    if (html) {
      var cm = this.doc().getElementById("chmenu_" + p[1]);
      var hm = this.doc().getElementById("headingmenu_" + p[1]);
      hm.style.top = Number(-2 + (1 + Math.floor((p[2]-1)/10)) * cm.firstChild.offsetHeight) + "px";
      hm.innerHTML = html;
      cm.setAttribute("headingmenu", "show");
    }
    
    //Return Bible to original state
    LibSword.setGlobalOption("Headings", prefs.getCharPref("Headings"));
    LibSword.setGlobalOption("Verse Numbers", prefs.getCharPref("Verse Numbers"));
  },


/************************************************************************
 * Chooser Mouse wheel functions
 ***********************************************************************/  
  CanUpShift: {biblebooks_nt:true,  biblebooks_ot:true},
  CanDownShift: {biblebooks_nt:false, biblebooks_ot:false},
  Delta: Number(0),

  wheel: function(event) {
    if (BibleNavigator.Delta == 0)
        window.setTimeout(function () {BibleNavigator.wheelScroll("biblebooks_" + BibleNavigator.doc().getElementById("biblechooser").getAttribute("showing"));}, 50);
    BibleNavigator.Delta += event.detail;
  },

  wheelScroll: function(testid) {
    this.Delta = this.Delta/6;
    var rh = this.doc().getElementById("book_1").offsetTop - this.doc().getElementById("book_0").offsetTop;

    if (this.CanUpShift[testid] && this.Delta > 0) {
      this.CanDownShift[testid] = true; 
      this.CanUpShift[testid] = this.shiftChooserUp(testid, this.Delta*(rh));
    }
    else if (this.Delta < 0 && this.CanDownShift[testid]) {
      this.CanUpShift[testid] = true;
      this.CanDownShift[testid] = this.shiftChooserDown(testid, -1*this.Delta*(rh));
    }
    
    this.Delta=0;
  },

  mouseScroll: function(testid, offsetTop) {
    this.MouseScrollTO = null;
    var rh = this.doc().getElementById("book_1").offsetTop - this.doc().getElementById("book_0").offsetTop;
    var testel = this.doc().getElementById(testid);
    if (this.CanDownShift[testid] && offsetTop + testel.offsetTop < 3*rh) {
      this.CanUpShift[testid] = true;
      this.CanDownShift[testid] = this.shiftChooserDown(testid, rh);
    }
    else if (this.CanUpShift[testid] && (this.doc().getElementById("testaments").offsetHeight - (offsetTop + testel.offsetTop) < (3*rh))) {
      this.CanDownShift[testid] = true;
      this.CanUpShift[testid] = this.shiftChooserUp(testid, rh);
    }  
  },

  shiftChooserUp: function(myID, delta) {
    var topS = this.doc().getElementById(myID).style.top;
    if (!topS) topS = "0px";
    var top = Number(topS.substr(0, topS.length-2));
    top = top - delta;
    var canshift = true;
    var mintop = this.doc().getElementById("testaments").offsetHeight - 
                  this.doc().getElementById(myID).offsetHeight + 8;
    if (top < mintop) {canshift = false; top = mintop;}
    this.doc().getElementById(myID).style.top = top + "px";
    return canshift;
  },

  shiftChooserDown: function(myID, delta) {
    var topS = this.doc().getElementById(myID).style.top;
    if (!topS) topS = "0px";
    var top = Number(topS.substr(0, topS.length-2));
    top = top + delta;
    var canshift = true;
    if (top > 0) {canshift=false; top=8;}
    this.doc().getElementById(myID).style.top = top + "px";
    return canshift;
  }
}
