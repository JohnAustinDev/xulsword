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
function buildChooserGraphics() {
  if (window.frameElement.id=="bible1Frame") {
    document.write("<img id=\"chbutClose\" class=\"chbut\" src=\"chrome://xulsword/skin/images/close0.bmp\" onMouseOver=\"chooserControlButton(event)\" onMouseOut=\"chooserControlButton(event)\" onClick=\"chooserControlButton(event)\">");
    document.write("<div id=\"fadetop\" class=\"fader\" style=\"background-image:url(chrome://xulsword/skin/images/9.gif); top:0px;\">");
    document.write("</div>");
    document.write("<div id=\"fadebot\" class=\"fader\"  style=\"background-image:url(chrome://xulsword/skin/images/9.gif);\">");
    document.write("</div>");
    document.write("<div id=\"chooserholet\" class=\"chooserholet\">");
    document.write("</div>");
    document.write("<div id=\"chooserholeb\" class=\"chooserholeb\" style=\"background-image:url(chrome://xulsword/skin/images/9.gif);\">");
    document.write("</div>");
    document.write("<div id=\"chooserhole\" class=\"chooserhole\">");
    document.write("</div>");
  }
  if (window.frameElement.id=="bible1Frame") {
    document.write("<img id=\"chbutOpen\" style=\"top:30px; left:8px;\"class=\"chbut\" src=\"chrome://xulsword/skin/images/open0.bmp\" onMouseOver=\"chooserControlButton(event)\" onMouseOut=\"chooserControlButton(event)\" onClick=\"chooserControlButton(event)\">");
  }
}

function buildTestChooser() {
  if (window.frameElement.id=="bible1Frame") {
    //Testament chooser div and table (only table allows proper vertical centering!)
    document.write("<div id=\"testamentChooser\" class=\"testamentchooser\" onClick=\"chooserMouseHandler(event);\" onMouseOver=\"chooserMouseHandler(event);\" onMouseOut=\"chooserMouseHandler(event);\">");
    document.write("<table><tbody>");
    document.write("<tr>");
    document.write("<td id=\"chooseOT.\" class=\"testheading\" style=\"-moz-border-radius-topleft:8px;\"><br><br>");
    var text = SBundle.getString('OTtext');
    if (!text.match(/^\s*$/)) document.write(verticalWrite(text));
    else document.write("<img id=\"OTtestimg\" src=\"chrome://localeskin/skin/OT.png\">");
    document.write("<br></td>");
    document.write("</tr>");
    document.write("<tr>");
    document.write("<td id=\"chooseNT.\" class=\"testheading\" style=\"-moz-border-radius-bottomleft:8px\"><br>");
    text = SBundle.getString('NTtext');
    if (!text.match(/^\s*$/)) document.write(verticalWrite(text));
    else document.write("<img id=\"NTtestimg\" src=\"chrome://localeskin/skin/NT.png\">");
    document.write("<br></td>");
    document.write("</tr>");
    document.write("</tbody></table>");
    document.write("</div>");
  }
}

function buildBookChooser(tsmt) {
  if (window.frameElement.id=="bible1Frame") {
    var bstart, bend;
    if (tsmt=="NT") {
      bstart=NumOT; 
      bend=NumBooks-1;
      document.write("<div id=\"chooserNT\" class=\"chooser\">");
    }
    else {
      bstart=0; 
      bend=NumOT-1;
      document.write("<div id=\"chooserOT\" class=\"chooser\">");
    }
    
    for (var b=bstart; b <= bend; b++) {
      document.write("<div id=\"book." + b + "\" class=\"bookname\" onClick=\"chooserMouseHandler(event);\" onMouseOver=\"chooserMouseHandler(event);\" onMouseOut=\"chooserMouseHandler(event);\">");
      document.write(Book[b].bName);
      document.write("<div style=\"position:relative;\"><img id=\"arrow." + b + "\" class=\"chapterarrow\" src=\"chrome://xulsword/skin/images/arrow.png\"></div>");
      writeChapterMenu(b);
      document.write("</div>");
    }
    document.write("</div>");
  }
}

function writeChapterMenu(bk) {
  document.write("<div id=\"chapPD." + bk + "\" class=\"chapterpopuph\">");
  var dend;
  var row=1; 
  var col=1;
  for (var ch=1; ch<=Book[bk].numChaps;ch++) {
    if (col == 1) {
      document.write("<div id=\"ST." + bk + "." + row + "\" class=\"chapsubtable\" >");
      dend="</div>";
    }
    document.write("<div id=\"ID." + bk + "." + ch + "\" class=\"chapmenucell\">");
    document.write(dString(ch));
    document.write("</div>");
    col++; 
    if (col == 11) {col=1; row++; document.write(dend); dend="";}
  }
  document.write(dend);
  
  //Chapter Heading menu
  document.write("<div id=\"hpopupSH." + bk + "\" class=\"hpopupSH\" style=\"visibility:hidden;\">");
  document.write("</div>");
  document.write("<div id=\"hpopup." + bk + "\"   class=\"hpopup\"   style=\"visibility:hidden;\">");
  document.write("</div>");
  
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
//Handles all mouseover/out events for book/chapter chooser. All elements on mouseout events create a book specific timeout
//which will close the specific menu. All elements on mouseover events delete the book specific timeout if it exists. Beyond
//this, each elements also responds however else it is supposed to according to the event/element.
var SaveCellId="";
var ShowHeadingID;
var ShowChooserID;
function chooserMouseHandler(e) {  
  //If target has no id, find first parent that does
  var elem = e.target; 
  while (elem.id == "") {elem=elem.parentNode;}
  var val = elem.id.split(".");
  var myid = val[0] ? val[0]:null; 
  var bk = val[1] ? Number(val[1]):0;
  var refBible = firstDisplayBible();
  
  var bookDisabled = false;
  if (myid=="book" && elem.className.search("disabledBook")!=-1) {bookDisabled = true;}
        
  if (e.type == "mouseover") {
    if (CloseChapMenuID[bk]) {window.clearTimeout(CloseChapMenuID[bk]);}
    switch (myid) {
    case "book":
    case "arrow":
      if (!needAutoScroll(e)) document.getElementById("book." + val[1]).style.background = PointedBookBackground;
      if (!bookDisabled) OpenChapMenuID = window.setTimeout("openChapMenu(" + bk + ")",300);
      break;

    case "ID":
      // First try and unhighlight last saved cell, in case it's still highlighted
      if (e.target.id != SaveCellId) {try {document.getElementById(SaveCellId).className = "chapmenucell";} catch(er) {}}
      //Always turn off popup when entering a cell
      document.getElementById("hpopup." + bk).style.visibility = "hidden";
      document.getElementById("hpopupSH." + bk).style.visibility = "hidden";
      try {window.clearTimeout(ShowHeadingID);} catch(er){}
      if (!needAutoScroll(e, true)) {
        document.getElementById(e.target.id).className = "chapmenucellhigh";
        SaveCellId = e.target.id; //Save cell id to re-highlight if we go onto a popup next
        var showHeadings = false;
        for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {showHeadings |= (Win.modName==refBible);}
        if (showHeadings)
          ShowHeadingID = window.setTimeout("showHeadings('" + e.target.id + "','" + e.clientY + "')",500);
      }
      break;
      
    case "hpopup":
      document.getElementById(SaveCellId).className = "chapmenucellhigh";
      break;
      
    case "hpopupSH":
      document.getElementById(SaveCellId).className = "chapmenucellhigh";
      break;

    case "chooseNT":
      ShowChooserID = window.setTimeout("showChooser('NT',false)",100);
      break;
      
    case "chooseOT":
      ShowChooserID = window.setTimeout("showChooser('OT',false)",100);
      break;
      
    default:
    }
  }
  else if (e.type == "mouseout") {
    switch (myid) {
    case "book":
      if (bookDisabled) return;
      var mycolor = (bk == findBookNum(Bible.getBookName())) ? SelectedBookBackground:NormalBookBackground;
      document.getElementById("book." + bk).style.background = mycolor;
      break;
      
    case "ID":
      try {window.clearTimeout(ShowHeadingID);} catch(er){}  //try is needed since ID may not be valid!
      document.getElementById(elem.id).className = "chapmenucell";
      break;
      
    case "chooseNT":
      try {window.clearTimeout(ShowChooserID);} catch(er){}
      break;
      
    case "chooseOT":
      try {window.clearTimeout(ShowChooserID);} catch(er){}
      break;
    }
    if (bk>=0 && bk<NumBooks) {closeChapMenu(bk);}
  }
  
  else if (e.type == "click") {
    // First clean up any open(ing) menus
    if (ShowHeadingID) {window.clearTimeout(ShowHeadingID);}
    if (bk>=0 && bk<NumBooks) {closeChapMenuNow(bk);}
    var newbk, newch;
    var verse = 1;
    // Now load in new location
    switch (myid) {
    case "book":
      if (bookDisabled) return;
      newbk=bk; newch=1;
      break;
      
    case "chooseNT":
      newbk=NumOT; newch=1;
      break;
      
    case "chooseOT":
      newbk=0; newch=1;
      break;
      
    case "ID":
      newbk=bk; newch=val[2];
      break;
      
    case "lnk":
      newbk=bk; newch=val[2]; verse=val[3];
      break;
      
    case "arrow":
      newbk=bk; newch=1;
      break;
      
    default:
      newbk=0; newch=1;
    }
    
    Bible.setBiblesReference(refBible, Book[newbk].sName + "." + newch + "." + verse);
    
    //Update everything
    MainWindow.updateFrameScriptBoxes(MainWindow.getUnpinnedVerseKeyWindows(), SCROLLTYPECENTER, HILIGHTNONE);
    MainWindow.updateLocators(false); 
  }
  else {jsdump("WARNING: chooserMouseHandler, Unhandled event type: " + e.type + "\n");}
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

//Open the chapter/heading selection menu
function openChapMenu(bk) {
  document.getElementById("book." + bk).style.background = PointedBookBackground;
  document.getElementById("chapPD." + bk).style.left = String(document.getElementById("book." + bk).offsetWidth) + "px";
  document.getElementById("chapPD." + bk).style.width = String(document.getElementById("scriptBox").offsetWidth) + "px";
  document.getElementById("chapPD." + bk).className = "chapterpopup";
  document.getElementById("arrow." + bk).src="chrome://xulsword/skin/images/arrow2.png";
}

//Close the chapter/heading selection menu. Have delayed or instant versions...
var CloseChapMenuID = new Array(NumBooks);
var OpenChapMenuID;
function closeChapMenu(bk) {
  try {window.clearTimeout(OpenChapMenuID);} catch (e) {}
  CloseChapMenuID[bk] = window.setTimeout("closeChapMenuNow(" + bk + ")",1);
}
function closeChapMenuNow(bk) {
  var mycolor = (bk == findBookNum(Bible.getBookName())) ? SelectedBookBackground:NormalBookBackground;
  document.getElementById("arrow." + bk).src="chrome://xulsword/skin/images/arrow.png";
  document.getElementById("book." + bk).style.background = mycolor;
  document.getElementById("chapPD." + bk).className = "chapterpopuph";
  document.getElementById("hpopup." + bk).style.visibility = "hidden";
  document.getElementById("hpopupSH." + bk).style.visibility = "hidden";
}

//Load and Open popup window showing headings for given chapter
function showHeadings(myid,screenY) {
  //Set Bible params and read chapter
  var vers = firstDisplayBible();
  var bkch = myid.split(".");
  var mybk = bkch[1]; 
  var mych = bkch[2];
  var saveLocation=Bible.getLocation(vers);
  Bible.setGlobalOption("Headings", "On");
  Bible.setGlobalOption("Verse Numbers", "On");
  Bible.setBiblesReference(vers, Book[mybk].sName + "." + String(mych) + ".1");
  var alltxt = Bible.getChapterText(vers);
  
  // Find all headings and their following verses
  var hdplus = /class="head1".*?>.*?<\/div>.*?<sup.*?>\d+<\/sup>/gim; // Get Array of head + next verse's
  var hd = /class="head1".*?>(.*?)<\/div>/i;                          // Get heading from above
  var vs = /<sup.*?>(\d+)<\/sup>/i;                                   // Get verse from above
  var re = /(<.+?>)/gim;                                              // Used to remove all tags
  
  //  Find each heading and write it and it's link to HTML
  var head = alltxt.match(hdplus);
  var headingtxt = "";
  var hr="";
  if (head != null) {
    for (var h=0; h < head.length; h++) {
      var heading=head[h].match(hd)[1].replace(re, "");
      var verse=head[h].match(vs)[1];
      if (heading != "") {headingtxt = headingtxt + hr + "<a id=\"lnk." + mybk + "." + mych + "." + verse + "\" class=\"vstyle" + vers + "\" >" + heading + "</a>" + "<br>"; hr="<hr>";}
    }
  }
  // If headings were found, then display them inside the popup
  if (headingtxt != "") {
    var shell = document.getElementById("chapPD." + mybk);
    var pop = document.getElementById("hpopup." + mybk);
    var popsh = document.getElementById("hpopupSH." + mybk);
    var cell = document.getElementById("ID." + mybk + "." + mych);
    pop.innerHTML = headingtxt;;
    
    //Starting layout values
    var row  = 1 + Math.round((mych-5.5)/10);  // Calculate row from chapter number
    row = document.getElementById("ST." + mybk + "." + row);
    var top = row.offsetTop + row.offsetHeight - 2;
    var left = cell.offsetLeft+(cell.offsetWidth-pop.offsetWidth)/2;
    
    //Now see if popup needs to be shifted left or right (so that doesn't go beyond scriptbox)
    if (left < 0) {left=0;}
    else {
      var maxleft = shell.offsetWidth - pop.offsetWidth; 
      if (left > maxleft) {left=maxleft;}
    }

    //Now see if popup needs to be shifted up (so that it's not extending below the screen)
    if (Number(screenY) + pop.offsetHeight > window.innerHeight) {top = row.offsetTop - pop.offsetHeight;}
    
    //Place the popups and turn 'em on
    pop.style.left = String(left) + "px";
    pop.style.top  = String(top) + "px";
    popsh.style.left = String(left + ShX) + "px";
    popsh.style.top  = String(top + ShY) + "px";
    popsh.style.width = String(pop.offsetWidth) + "px";
    popsh.style.height = String(pop.offsetHeight) + "px";
    pop.style.visibility = "visible";
    popsh.style.visibility = "visible";
  }
  
  //Return Bible to original state
  Bible.setGlobalOption("Headings", prefs.getCharPref("Headings"));
  Bible.setGlobalOption("Verse Numbers", prefs.getCharPref("Verse Numbers"));
  Bible.setBiblesReference(vers, saveLocation);
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

function chooserControlButton(e) {
  var myimg = e.target;
  var olds = myimg.src;
  
  //CLICK
  if (e.type == "click") {
    OwnerDocument.getElementById("cmd_xs_toggleChooser").doCommand();
  }
  //MOUSE OUT
  else if (e.type == "mouseout") {
    myimg.src = olds.substr(0,olds.length-5) + "0.bmp";
  }
  //MOUSE OVER
  else {
    myimg.src = olds.substr(0,olds.length-5) + "1.bmp";
  }
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
    if ((Delta>0)&&(Need2UpShiftNT)) {Need2DownShiftNT=true; if (shiftChooserUp("chooserNT",Delta*(NTRowHeight))) {Need2UpShiftNT=false;}}
    else if ((Delta<0)&&(Need2DownShiftNT)) {Need2UpShiftNT=true; if (shiftChooserDown("chooserNT",-1*Delta*(NTRowHeight))) {Need2DownShiftNT=false;}}
  }
  else {
    if ((Delta>0)&&(Need2UpShiftOT)) {Need2DownShiftOT=true; if (shiftChooserUp("chooserOT",Delta*(OTRowHeight))) {Need2UpShiftOT=false;}}
    else if ((Delta<0)&&(Need2DownShiftOT)) {Need2UpShiftOT=true; if (shiftChooserDown("chooserOT",-1*Delta*(OTRowHeight))) {Need2DownShiftOT=false;}}
  }
  Delta=0;
}


/************************************************************************
 * Initialization and update routines for chooser
 ***********************************************************************/  

//Size, update and place the chooser
function initChooser(firstInit) {
  var bookButCSS = getCSS(".bookname", 0);
  if (bookButCSS) {
    var fa = prefs.getIntPref('FontSize');
    var nh = ChooserBookButtonHeight + fa; // isolate number so following string is unambiguous
    bookButCSS.style.height = nh + "px";
    //if (fa>0) bookButCSS.style.paddingTop = fa + "px";
  }
  resizeChooser();
  placeChooser(firstInit);
  MainWindow.updateLocators(true);
}

var OTRowHeight=0;
var NTRowHeight=0;
function resizeChooser() {
  OTRowHeight = document.getElementById("book.1").offsetTop - document.getElementById("book.0").offsetTop;
  NTRowHeight = document.getElementById("book." + String(NumOT+1)).offsetTop - document.getElementById("book." + NumOT).offsetTop;
  
  // Now place each and every chapter button
  var row=0;
  for(var idx=0; idx < NumOT; idx++) {
    document.getElementById("chapPD." + idx).style.top = String(document.getElementById("book." + idx).offsetTop) + "px"; 
    row++;
  }
  row=0;
  for(idx=NumOT; idx < NumBooks; idx++) {
    document.getElementById("chapPD." + idx).style.top = String(document.getElementById("book." + idx).offsetTop) + "px"; 
    row++;
  }
  
  // Set fixed widths of Chooser graphics (heights are changed dynamically later on)
  var FDT = document.getElementById("fadetop");
  var FDB = document.getElementById("fadebot");
  var CH  = document.getElementById("chooserhole");
  var CHT = document.getElementById("chooserholet");
  var CHB = document.getElementById("chooserholeb");
  var TST = document.getElementById("testamentChooser");
  var CSR = document.getElementById("chooserOT");
  var CSN = document.getElementById("chooserNT");
  
  CSR.style.left = TST.offsetLeft + TST.offsetWidth + "px";
  CSN.style.left = TST.offsetLeft + TST.offsetWidth + "px";

  CSR.style.width = "";  
  CSN.style.width = "";
  if (CSN.offsetWidth < CSR.offsetWidth) CSN.style.width = CSR.offsetWidth + "px";
  else CSR.style.width = CSN.offsetWidth + "px";
  
  var holeWidth = CSR.offsetLeft - TST.offsetLeft + CSR.offsetWidth + (2*HoleMarginH);
   
  CH.style.left   = String(TST.offsetLeft - HoleMarginH) + "px";
  CH.style.width  = String(holeWidth) + "px";
  FDT.style.width = String(ChooserLeftMargin + holeWidth) + "px";
  FDB.style.width = FDT.style.width;
  CHT.style.width = CH.style.width;
  CHT.style.left  = String(TST.offsetLeft - HoleMarginH + 2) + "px";
  CHB.style.width = CH.style.width;
  CHB.style.left  = String(TST.offsetLeft - HoleMarginH + 2) + "px";
  
  OwnerDocument.getElementById("genBookTree").style.width = holeWidth + "px";
}

var Need2DownShiftNT = false;
var Need2UpShiftNT =   false;
var Need2DownShiftOT = false;
var Need2UpShiftOT =   false;
var NOriginalNUS =     false;
var OOriginalNUS =     false;
var NOriginalTop=0;
var OOriginalTop=0;
var MarginTopNT = 0;
var MarginTopOT = 0;
var TestchNTh = 0;
var TestchOTh = 0;
// Vertically places the chooser and prepares the chooser for shifting if needed
function placeChooser(initializing) {
  //This pref is used at initialization because the main window has not been drawn (because it
  //looks much better if the window opens after everything inside has been sized). Since its
  //dimensions are unknown we use a pref.
  var fh = initializing ? prefs.getIntPref("BibleFrameHeight"):window.innerHeight;

//  var nh = ((document.getElementById("book." + NumOT).offsetHeight+2)*(NumBooks-NumOT));
//  var oh = ((document.getElementById("book.1").offsetHeight+2)*(NumOT));

  // minH of chooser is two times the height of the tallest testament button when they are unconstrained
  var eOT = document.getElementById("chooseOT.");
  var eNT = document.getElementById("chooseNT.");
  eOT.style.height = "";
  eNT.style.height = "";
  var minH = (eOT.offsetHeight > eNT.offsetHeight ? 2*eOT.offsetHeight:2*eNT.offsetHeight);
  
  // maxH of chooser is window height minus top and bottom borders
  var maxH = fh - ChooserMinTopBorder - ChooserMinBottomBorder - 6;
  
  var nh = document.getElementById("chooserNT").offsetHeight+2;
  nh = (nh < minH ? minH:nh);
  var oh = document.getElementById("chooserOT").offsetHeight+2;
  oh = (oh < minH ? minH:oh);

  // Decide if the chooser may be shifted or not
  Need2UpShiftNT =  false;
  Need2DownShiftNT= false;
  Need2UpShiftOT =  false;
  Need2DownShiftOT= false;
  NOriginalNUS =    false;
  OOriginalNUS =    false;
  if (fh-oh < ChooserMinTopBorder + ChooserMinBottomBorder) {OOriginalNUS = true; Need2UpShiftOT=true;}
  if (fh-nh < ChooserMinTopBorder + ChooserMinBottomBorder) {NOriginalNUS = true; Need2UpShiftNT=true;}

  // Set the top of both choosers...
  MarginTopNT = 0.5*(fh - nh - ChooserOffsetFromCenter);
  if (MarginTopNT < ChooserMinTopBorder) {MarginTopNT = ChooserMinTopBorder;}
  NOriginalTop = MarginTopNT;
  document.getElementById("chooserNT").style.top = String(MarginTopNT) + "px";
  
  MarginTopOT = 0.5*(fh - oh - ChooserOffsetFromCenter);
  if (MarginTopOT < ChooserMinTopBorder) {MarginTopOT = ChooserMinTopBorder;}
  OOriginalTop = MarginTopOT;
  document.getElementById("chooserOT").style.top = String(MarginTopOT) + "px";
  
//jsdump("MarginTopNT:" + MarginTopNT + " MarginTopOT:"+ MarginTopOT + "\n");

  // Set the height of both choosers...
  TestchNTh = document.getElementById("chooserNT").offsetHeight-2;
  if (TestchNTh > maxH) {TestchNTh = maxH;}
  if (TestchNTh < minH) {TestchNTh = minH;}
  TestchOTh = document.getElementById("chooserOT").offsetHeight-2;
  if (TestchOTh > maxH) {TestchOTh = maxH;}
  if (TestchOTh < minH) {TestchOTh = minH;}
  
  OwnerDocument.getElementById("genBookTree").style.height = fh - ChooserMinTopBorder - ChooserMinBottomBorder - 6 + "px";
}

var ChooserHeight=0;
function showChooser(tsmt,resetchooser) {
  if (resetchooser) {Need2DownShiftOT=false; Need2DownShiftNT=false;}
  if (tsmt == "NT") {
    document.getElementById("chooseNT.").style.background = SelectedBookBackground;
    document.getElementById("chooseOT.").style.background = "";
    document.getElementById("chooserNT").style.visibility = "visible";
    document.getElementById("chooserOT").style.visibility = "hidden";
    document.getElementById("chooseOT.").style.height = String(TestchNTh/2) + "px";
    document.getElementById("chooseNT.").style.height = String(TestchNTh/2) + "px";
    document.getElementById("testamentChooser").style.top = String(MarginTopNT-1) + "px";
    ChooserHeight = document.getElementById("chooserNT").offsetHeight;
    document.getElementById("chbutClose").style.top = String(MarginTopNT + 6) + "px";
    if (resetchooser) {
      document.getElementById("chooserNT").style.top = String(NOriginalTop) + "px";
      Need2UpShiftNT = NOriginalNUS;
    }
  }
  else {
    document.getElementById("chooseOT.").style.background = SelectedBookBackground;
    document.getElementById("chooseNT.").style.background = "";
    document.getElementById("chooserOT").style.visibility = "visible";
    document.getElementById("chooserNT").style.visibility = "hidden";
    document.getElementById("chooseOT.").style.height = String(TestchOTh/2) + "px";
    document.getElementById("chooseNT.").style.height = String(TestchOTh/2) + "px";
    document.getElementById("testamentChooser").style.top = String(MarginTopOT-1) + "px";
    ChooserHeight = document.getElementById("chooserOT").offsetHeight;
    document.getElementById("chbutClose").style.top = String(MarginTopOT + 6) + "px";
    if (resetchooser) {
      document.getElementById("chooserOT").style.top = String(OOriginalTop) + "px";
      Need2UpShiftOT = OOriginalNUS;
    }
  }
  // Vertically place the chooser graphics
  var FDT = document.getElementById("fadetop");
  var FDB = document.getElementById("fadebot");
  var CH  = document.getElementById("chooserhole");
  var CHT = document.getElementById("chooserholet");
  var CHB = document.getElementById("chooserholeb");

  var top = Number(document.getElementById("testamentChooser").style.top.split("px")[0]) - HoleMarginV;
  var bot = top + document.getElementById("testamentChooser").offsetHeight + (2*HoleMarginV);

  CH.style.top    = String(top) + "px";
  CH.style.height = String(bot-top) + "px";
  FDT.style.height= CH.style.top;
  FDB.style.top   = String(bot) + "px";
  var fdbH = ChooserHeight-bot+top+HoleMarginV;
  if (fdbH < 6) {fdbH=6;}
  FDB.style.height= String (fdbH) + "px";
  CHT.style.top   = CH.style.top;
  CHB.style.top   = String(bot-4) + "px";
}
