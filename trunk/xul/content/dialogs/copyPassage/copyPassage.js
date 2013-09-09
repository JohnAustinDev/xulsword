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
 

var PassageChooser, PassageTextBox;
const STYLES = new RegExp(/^[^\{]*\{([^\}]*)\}/);

function onLoad() {
  initCSS();
  
  document.title = fixWindowTitle(document.title);
  
  PassageChooser = document.getElementById("passage");
  PassageTextBox = document.getAnonymousElementByAttribute(PassageChooser, "anonid", "book");
  
  // Set passage to selection if there is one
  var sel = false;  
  var selob = MainWindow.document.getElementById("main-viewport").contentDocument.defaultView.getSelection();
  if (selob && !selob.isCollapsed && !(/^\s*$/).test(selob.toString())) {
    var t = eval(uneval(MainWindow.ContextMenu.NEWTARGET));
    sel = MainWindow.ContextMenu.getTargetsFromSelection(t, selob);
  }
  if (sel && t.mod && t.bk && t.ch && t.vs && t.lv) {
    PassageChooser.version = t.mod;
    PassageChooser.location = t.bk + "." + t.ch + "." + t.vs + "." + t.lv;
  }
  
  // otherwise use the global location
  else {
    PassageChooser.version = ViewPort.firstDisplayBible();
    PassageChooser.location = MainWindow.Location.getLocation(ViewPort.firstDisplayBible());
  }
  
  PassageTextBox.focus();
  PassageTextBox.select();
  
  // Allow return key to copy and close the window
  PassageTextBox.setAttribute("onkeyup", "if (event.which==13) { document.getElementById('copy').click(); }");
}

function copyPassage(e) {
  
  // Get display from current settings
  var d = Texts.getDisplay(PassageChooser.version, PassageChooser.location);
  
  // Overwrite our display with desired values
  for (var tcmd in GlobalToggleCommands) {
    var m = tcmd.match(/^(cmd_xs_toggleVerseNums|cmd_xs_toggleHeadings|cmd_xs_toggleRedWords)$/);
    
    if (!m) d.globalOptions[GlobalToggleCommands[tcmd]] = "Off";
    else d.globalOptions[GlobalToggleCommands[tcmd]] = (document.getElementById(m[1]).checked ? "On":"Off");
  }
  d.ShowOriginal = false;
  
  // Get our text...
  var html = BibleTexts.read(1, d).htmlText;
//jsdump(html); 
   
  // Create the html and plain-text versions of our text for the clipboard
  var t_html = htmlVerses(d, html, false); // keeps verses and headings
  var t_text = html2text(htmlVerses(d, html, true)); // keeps only verses
  
//jsdump(t_html);
//jsdump(t_text);
  
  // Write our text to the clipboard
  var textstr = Components.classes["@mozilla.org/supports-string;1"].
      createInstance(Components.interfaces.nsISupportsString);  
  textstr.data = t_text;

  var htmlstring = Components.classes["@mozilla.org/supports-string;1"].  
      createInstance(Components.interfaces.nsISupportsString);  
  htmlstring.data = t_html;           

  var trans = Components.classes["@mozilla.org/widget/transferable;1"].  
      createInstance(Components.interfaces.nsITransferable);
  
  trans.addDataFlavor("text/unicode");  
  trans.setTransferData("text/unicode", textstr, t_text.length * 2); // *2 because it's unicode  
    
  trans.addDataFlavor("text/html");  
  trans.setTransferData("text/html", htmlstring, t_html.length * 2); // *2 because it's unicode   

  var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].  
      getService(Components.interfaces.nsIClipboard);  
  clipboard.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
    
  window.close();
}

// Loads html text into a temporary DOM element where it can be manipulated 
// with DOM functions to remove un-needed verses etc.
function htmlVerses(d, html, versesOnly) {
  var parent = document.getElementById("chaptertext").contentDocument.body;
  parent.innerHTML = html;

  var elem = parent.lastChild;
  
  // Remove children which are outside of the requested verses
  var remove = true;
  while(elem) {
    var p = getElementInfo(elem);

    if (p && p.type == "vs") remove = (p.vs >= d.vs && p.vs <= d.lv ? false:true);

    var r = (remove ? elem:null);

    // keep only if its a verse or possibly a heading
    if (!(/(^|\s)(vs|head\d|canonical)/).test(elem.className)) r = elem;
    if (versesOnly && (!p || p.type != "vs")) r = elem;
    
    elem = elem.previousSibling;
    
    if (r) parent.removeChild(r);
  }

  // replace class attributes by inline styles and remove all other attributes.
  html = parent.innerHTML.replace(/<(\w+)\s[^>]*class\s*=\s*[\"\']([^\"\']*)[\"\'][^>]*>/g, classToStyle);
  
  html = html.replace(/<\![^>]*>/g, "");
  
  // add reference designation
  html += "<br><span style=\"" + ProgramConfig.StyleRule.match(STYLES)[1] + "\">";
  html += "(" + ref2ProgramLocaleText(d.bk + "." + d.ch + "." + d.vs + "." + d.lv) + ")";
  html += "</span>";
  
  // wrap everything in a container so headings are centered correctly
  html = "<div>" + html + "</div>";
  
  return html;
}

function classToStyle(match, p1, p2, offset, string) {
  var style = "";
 
  var modloc = p2.match(/(^|\s)cs-(.*?)(\s|$)/);
  if (modloc) modloc = modloc[2];
  
  // titles
  if ((/(^|\s)canonical(\s|$)/).test(p2)) style += "font-weight:bold; font-style:italic; ";
  if ((/(^|\s)head1(\s|$)/).test(p2)) style += "font-size:20px; font-weight:bold; text-align:center; ";
  if ((/(^|\s)head2(\s|$)/).test(p2)) style += "font-weight:bold; ";
  if ((/(^|\s)wordsOfJesus(\s|$)/).test(p2)) style += "color:red ";
  
  // module and locale styles
  if (modloc && ModuleConfigs.hasOwnProperty(modloc)) 
      style += ModuleConfigs[modloc].StyleRule.match(STYLES)[1];
      
  else if (modloc && LocaleConfigs.hasOwnProperty(modloc)) 
      style += LocaleConfigs[modloc].StyleRule.match(STYLES)[1];
      
  else if (modloc == "Program") 
      style += ProgramConfig.StyleRule.match(STYLES)[1];
  
  return "<" + p1 + (style ? " style=\"" + style + "\"":"") + ">";
}

function html2text(html) {
  html = html.replace(/(<sup>)(\d+)(<\/sup>)/ig, "$1[$2]$3"); // class was removed by classToStyle
  html = html.replace(/<br>/gi, NEWLINE);
  html = html.replace(/<\/div>/gi, NEWLINE);
  html = html.replace(/<[^>]+>/g,"");
  html = html.replace("&nbsp;", " ", "gi");
  html = html.replace(/(\&rlm\;|\&lrm\;)/g, "");
  return html
}
