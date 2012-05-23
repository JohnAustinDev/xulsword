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

function drawOTbooks() {for (var b=0; b<=NumOT-1; b++) {drawBook(b);}}

function drawNTbooks() {for (var b=NumOT; b<=NumBooks-1; b++) {drawBook(b);}}

function drawBook(b) {
  document.write("<div id=\"book_" + b + "\" class=\"bookname\">");
  document.write("<div>");
  document.write("<div>");
  document.write(Book[b].bName);
  document.write("<div class=\"charrow\"></div>");
  writeChapterMenu(b);
  document.write("</div>");
  document.write("</div>");
  document.write("</div>");
}

function writeChapterMenu(bk) {
  document.write("<div id=\"chmenu_" + bk + "\" headingmenu=\"hide\" class=\"chaptermenu\">");
  var dend;
  var row=1; 
  var col=1;
  for (var ch=1; ch<=Book[bk].numChaps;ch++) {
    if (col == 1) {
      document.write("<div class=\"chaptermenurow\">");
      dend="</div>";
    }
    document.write("<div id=\"chmenucell_" + bk + "_" + ch + "\" class=\"vstyleprogram\">");
    document.write(dString(ch));
    document.write("</div>");
    col++; 
    if (col == 11) {col=1; row++; document.write(dend); dend="";}
  }
  for (col; col<11; col++) { document.write("<div class=\"emptych\"></div>");}
  document.write(dend);
  
  //Chapter Heading menu
  document.write("<div id=\"headingmenu_" + bk + "\" class=\"headingmenu\"></div>");
  
  document.write("</div>");
}

function verticalWrite(txt) {
  var str=""
  for (var i=0; i<txt.length; i++) {
    str += txt.substr(i,1) + "<br>";
  }
  return str;
}

/************************************************************************
 * Interactive Mouse Response routines for chooser
 ***********************************************************************/  
var ShowChooserTO, ShowHeadingTO;
function chooserMouse(e) {
  var p;
  if (ShowHeadingTO) window.clearTimeout(ShowHeadingTO);
  if (e.type == "mouseout" && e.target.id && e.target.id.substr(0,12) == "headingmenu_") {
    p = e.relatedTarget;
    while(p && (!p.id || (p.id && p.id != e.target.id))) {p = p.parentNode;}
    if (!p || p.id != e.target.id) {
      document.getElementById(e.target.id.replace("headingmenu_", "chmenu_")).setAttribute("headingmenu", "hide");
    }
  }
  
  p = e.target;
  while(p && !p.id) {p = p.parentNode;}
  
  if (p) p = p.id.split("_");
  else return;

  switch(p[0]) {
  
  // Testament selector of the Bible Navigator
  case "testament":
    switch (e.type) {
    case "mouseover":
      if (ShowChooserTO) window.clearTimeout(ShowChooserTO);
      ShowChooserTO = window.setTimeout("showChooser('" +  p[1] + "',false)", 100);
      break;
    
    case "mouseout":
      if (ShowChooserTO) window.clearTimeout(ShowChooserTO);
      break;
      
    case "click":
      Location.setLocation(firstDisplayBible(), Book[(p[1]=="ot" ? 0:NumOT)].sName + ".1.1");
      MainWindow.updateFrameScriptBoxes(MainWindow.getUnpinnedVerseKeyWindows(), SCROLLTYPECENTER, HILIGHTNONE, UPDATELOCATORS);
      break;
    }
    break;
    
  // Book selector of the Bible Navigator
  case "book":
    switch (e.type) {      
    case "click":
      Location.setLocation(firstDisplayBible(), Book[p[1]].sName + ".1.1");
      MainWindow.updateFrameScriptBoxes(MainWindow.getUnpinnedVerseKeyWindows(), SCROLLTYPECENTER, HILIGHTNONE, UPDATELOCATORS);
      break;
    }
    break;
    
  // Chapter menu of the Bible Navigator
  case "chmenucell":
    switch(e.type) {
    case "mouseover":
      document.getElementById("chmenu_" + p[1]).setAttribute("headingmenu", "hide");
      if (ShowHeadingTO) window.clearTimeout(ShowHeadingTO);
      ShowHeadingTO = window.setTimeout("showHeadings('" + e.target.id + "','" + e.clientY + "')", 500);
      break;
        
    case "click":
      Location.setLocation(firstDisplayBible(), Book[p[1]].sName + "." + p[2] + "." + p[3]);
      MainWindow.updateFrameScriptBoxes(MainWindow.getUnpinnedVerseKeyWindows(), SCROLLTYPECENTER, HILIGHTNONE, UPDATELOCATORS);
      break
    }
    break;
    
  // Open/Close buttons on the Bible Navigator
  case "chbutton":
    if (e.type == "click") {
      prefs.setBoolPref("ShowChooser", (p[1]=="open"));
      updateViewPort();
    }
    break;
  }
}

function showChooser(tsmt, resetchooser) {
  document.getElementById("biblechooser").setAttribute("showing", tsmt);
  if (resetchooser) document.getElementById("biblebooks_" + tsmt).style.top = "8px";
  updateViewPort(true);
}

function showHeadings(myid, screenY) {
  var biblemod = firstDisplayBible();
  if (!biblemod) return;
  
  //Set Bible params and read chapter
  var p = myid.split("_");
  Bible.setGlobalOption("Headings", "On");
  Bible.setGlobalOption("Verse Numbers", "On");

  var chtxt = Bible.getChapterText(biblemod, Book[p[1]].sName + "." + p[2]);
  
  // Find all headings and their following verses
  var hdplus = /class="head1".*?>.*?<\/div>.*?<sup.*?>\d+<\/sup>/gim; // Get Array of head + next verse's
  var hd = /class="head1".*?>(.*?)<\/div>/i;                          // Get heading from above
  var vs = /<sup.*?>(\d+)<\/sup>/i;                                   // Get verse from above
  var re = /(<.+?>)/gim;                                              // Used to remove all tags
  
  //  Find each heading and write it and its link to HTML
  var head = chtxt.match(hdplus);
  var html = "";
  var hr="";
  if (head != null) {
    for (var h=0; h < head.length; h++) {
      var heading=head[h].match(hd)[1].replace(re, "");
      var verse=head[h].match(vs)[1];
      if (heading != "") {
        html += hr + "<a id=\"lnk." + Book[p[1]].sName + "." + p[2] + "." + verse + "\" class=\"vstyle" + biblemod + "\" >" + heading + "</a>" + "<br>"; 
        hr="<hr>";
      }
    }
  }
  
  // If headings were found, then display them inside the popup
  if (html) {
    var cm = document.getElementById("chmenu_" + p[1]);
    var hm = document.getElementById("headingmenu_" + p[1]);
    hm.style.top = Number((1 + Math.floor((p[2]-1)/10)) * cm.firstChild.offsetHeight) + "px";
    hm.innerHTML = html;
    cm.setAttribute("headingmenu", "show");
  }
  
  //Return Bible to original state
  Bible.setGlobalOption("Headings", prefs.getCharPref("Headings"));
  Bible.setGlobalOption("Verse Numbers", prefs.getCharPref("Verse Numbers"));
}


/************************************************************************
 * Chooser Mouse wheel functions
 ***********************************************************************/  
var Delta=0;
function wheel(event) {
  if (Delta == 0) {window.setTimeout('scrollChooser()',50);}
  Delta = Delta + event.detail;
} 

function scrollChooser() {
  Delta = Delta/6;
  if (document.getElementById("chooserNT").style.visibility == "visible") {
    if ((Delta>0)&&(Need2UpShiftNT)) {
      Need2DownShiftNT=true; 
      if (shiftChooserUp("chooserNT",Delta*(NTRowHeight))) Need2UpShiftNT=false;
    }
    else if ((Delta<0)&&(Need2DownShiftNT)) {
      Need2UpShiftNT=true;
      if (shiftChooserDown("chooserNT",-1*Delta*(NTRowHeight))) Need2DownShiftNT=false;
    }
  }
  else {
    if ((Delta>0)&&(Need2UpShiftOT)) {
      Need2DownShiftOT=true; 
      if (shiftChooserUp("chooserOT",Delta*(OTRowHeight))) Need2UpShiftOT=false;
    }
    else if ((Delta<0)&&(Need2DownShiftOT)) {
      Need2UpShiftOT=true; 
      if (shiftChooserDown("chooserOT",-1*Delta*(OTRowHeight))) Need2DownShiftOT=false;
    }
  }
  Delta=0;
}

function shiftChooserUp(myID,delta) {
  var topS = document.getElementById(myID).style.top;
  var top = Number(topS.substring(0,topS.length-2));
  top = top - delta;
  var finished = false;
  if (top < (window.innerHeight - ChooserMinBottomBorder - document.getElementById(myID).offsetHeight)) {
    top  =   window.innerHeight - ChooserMinBottomBorder - document.getElementById(myID).offsetHeight; 
    finished = true;
  }
  document.getElementById(myID).style.top = String(top) + "px";
  return finished;
}

function shiftChooserDown(myID,delta) {
  var topS = document.getElementById(myID).style.top;
  var top = Number(topS.substring(0,topS.length-2));
  top = top + delta;
  var finished = false;
  if (top > ChooserMinTopBorder) {finished=true; top=ChooserMinTopBorder;}
  document.getElementById(myID).style.top = String(top) + "px";
  return finished;
}

function needAutoScroll(e, dontLeaveChapMenu) {
  var fromTedge = e.clientY - ChooserMinTopBorder;
  var fromBedge = window.innerHeight - ChooserMinBottomBorder - e.clientY;
  var chapMenuBottom = 0;
  var chapMenuTop = 0;
  if (dontLeaveChapMenu) {
    //Find our chapter menu
    var elem = e.target;
    while (elem && !(elem.id && elem.id.search("chapPD.")!=-1)) {elem = elem.parentNode;}
    if (elem) {
      var top = elem.parentNode.parentNode.style.top;
      top = Number(top.substring(0,top.length-2));
      chapMenuTop = top + elem.offsetTop;
      chapMenuBottom = chapMenuTop + elem.offsetHeight;
    }
  }
  var scrolled = true;
  if (document.getElementById("chooserNT").style.visibility == "visible") {
    if (fromBedge<3*NTRowHeight && Need2UpShiftNT &&
        (!dontLeaveChapMenu || window.innerHeight-chapMenuBottom<0)) {
      Need2DownShiftNT=true;
      if (shiftChooserUp("chooserNT",NTRowHeight)) Need2UpShiftNT=false;
    }
    else if (fromTedge<3*NTRowHeight && Need2DownShiftNT &&
        (!dontLeaveChapMenu || chapMenuTop+NTRowHeight<e.clientY)) {
      Need2UpShiftNT=true;
      if (shiftChooserDown("chooserNT",NTRowHeight)) Need2DownShiftNT=false;
    }
    else scrolled=false;
  }
  else {
    if (fromBedge<3*OTRowHeight && Need2UpShiftOT &&
        (!dontLeaveChapMenu || window.innerHeight-chapMenuBottom<0)) {
      Need2DownShiftOT=true;
      if (shiftChooserUp("chooserOT",2*OTRowHeight)) Need2UpShiftOT=false;
    }
    else if (fromTedge<3*OTRowHeight && Need2DownShiftOT &&
        (!dontLeaveChapMenu || chapMenuTop+2*OTRowHeight<e.clientY)) {
      Need2UpShiftOT=true;
      if (shiftChooserDown("chooserOT",2*OTRowHeight)) Need2DownShiftOT=false;
    }
    else scrolled=false;
  }
  return scrolled;
}
