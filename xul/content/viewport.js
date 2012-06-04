/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

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

function loadViewPort() {
  // set default prefs
  getPrefOrCreate("NumDisplayedWindows", "Int", 2);
  
  getPrefOrCreate("ShowChooser", "Bool", true);
  
  for (var w=1; w<=3; w++) {
    getPrefOrCreate("ShowOriginal" + w, "Bool", false);
    getPrefOrCreate("IsPinned" + w, "Bool", false);
    getPrefOrCreate("NoteBoxHeight" + w, "Int", 200);
    getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
    if (!Tab[getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"))])
        prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
  }
  
  // set font sizes
  pullFontSizesFromCSS();
  adjustFontSizes(getPrefOrCreate('FontSize', "Int", 0));

  // draw tabs
  for (w=1; w<=NW; w++) {drawTabs(w);}
  
  for (w=1; w<=NW; w++) {
    var hidden = "";
    for (var type in SupportedModuleTypes) {
      hidden += getPrefOrCreate("Hidden" + type + w, "Char", "");
    } 
    for (var t=0; t<Tabs.length; t++) {
      var inhide = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
      if (inhide.test(Tabs[t].modName)) Tabs[t]["w" + w + ".hidden"] = true;
      else Tabs[t]["w" + w + ".hidden"] = false;
    }
  }
  
  // set mouse wheel listeners
  document.getElementById("biblebooks_nt").addEventListener("DOMMouseScroll", wheel, false);
  document.getElementById("biblebooks_ot").addEventListener("DOMMouseScroll", wheel, false);
  //document.getElementById("textrow").addEventListener("DOMMouseScroll", scrollwheel, false);

}

// This function updates the viewport based on all previously set global
// user settings. It does not set/change any global paramters, but only
// implements them in the viewport. Ideally, updates should be implemented
// with CSS.
function updateViewPort(skipBibleChooserTest) {
//return;
jsdump("UPDATING VIEW PORT");
  // Read CSS constant rules
  var rule = getCSS(".tab {");
  var tabheight = Number(rule.style.height.match(/^(\d+)\s*px/)[1]);
  rule = getCSS("#tabrow {");
  tabheight += Number(rule.style.paddingTop.match(/^(\d+)\s*px/)[1]);
  rule = getCSS("#viewportbody {");
  var padtop = Number(rule.style.paddingTop.match(/^(\d+)\s*px/)[1]);
  var padbot = Number(rule.style.paddingBottom.match(/^(\d+)\s*px/)[1]);
  rule = getCSS(".hd {");
  var headheight = Number(rule.style.height.match(/^(\d+)\s*px/)[1]);
  
  // Reset those CSS rules which depend on window height
  var sbh = window.innerHeight - padtop - tabheight - headheight - padbot;
  if (sbh < 100) sbh = 100;

  rule = getCSS(".sb {");
  rule.style.height = sbh + "px";

  var bbh = 4;
  for (var w=1; w<=NW; w++) {
    var nbh = prefs.getIntPref("NoteBoxHeight" + w);
    if (nbh > sbh-bbh) nbh = sbh-bbh;
    
    rule = getCSS("#note" + w + " {");
    rule.style.height = nbh + "px";
  
    rule = getCSS("#text" + w + "[value=\"show1\"][foot^=\"show\"] .sb {");
    rule.style.marginBottom = Number(nbh + bbh) + "px";
    rule.style.height = Number(sbh - nbh - bbh) + "px";
  }

  rule = getCSS(".text[foot=\"showmax\"]:not([value=\"show1\"]) .nb {");
  rule.style.height = sbh + "px";

  // Bible chooser
  var chooser = (needBookChooser() ? "book":(prefs.getBoolPref("ShowChooser") ? "bible":"hide"));
  document.getElementById("viewportbody").setAttribute("chooser", chooser);
  MainWindow.document.getElementById("genBookChooser").setAttribute("hidden", (chooser == "book" ? "false":"true"));

  var lbn = findBookNum(Location.getBookName());
  if (!skipBibleChooserTest) document.getElementById("biblechooser").setAttribute("showing", (lbn >= NumOT ? "nt":"ot"));

  for (var b=0; b<NumBooks; b++) {
    var chel = document.getElementById("book_" + b);
    if (chel) chel.setAttribute("selected", (b==lbn ? "true":"false"));
  }
  
  if (chooser != "hide") {
    var faderheight = padtop + tabheight;
    var chooserheight = document.getElementById("biblebooks_nt").offsetHeight;
    if (chooserheight > sbh) chooserheight = sbh;
    else faderheight += Math.floor(0.3*(sbh - chooserheight));
    var rulef = getCSS("#fadetop, #fadebot {");
    rulef.style.height = faderheight + "px";

    var rulec = getCSS("#biblechooser {");
    if (rulec.style.height != chooserheight + "px") 
        document.getElementById("biblebooks_nt").style.top = "8px";
    rulec.style.height = chooserheight + "px";

    document.getElementById("fadebot").style.height = Number(window.innerHeight - faderheight - chooserheight) + "px";

    var ntw = document.getElementById("biblebooks_nt");
    var otw = document.getElementById("biblebooks_ot");
    otw.style.width = "";
    ntw.style.width = "";
    if (ntw.offsetWidth > otw.offsetWidth) otw.style.width = Number(ntw.offsetWidth - 2) + "px";
    else ntw.style.width = Number(otw.offsetWidth - 2) + "px";
    rulef.style.width = Number(otw.offsetLeft + otw.offsetWidth + 20) + "px";
    rulec.style.width = Number(otw.offsetLeft + otw.offsetWidth - 6) + "px";
  }
  
  // Tab row
  var dw = prefs.getIntPref("NumDisplayedWindows");
  document.getElementById("tabrow").setAttribute("value", "show" + dw);
 
  // Windows
  for (var w=1; w<=NW; w++) {
    var value = "show1";
    if (w > dw) value = "hide";
    else {
      if ((w+1) <= dw && 
          Tab[prefs.getCharPref("Version" + w)].modType==BIBLE &&
          !prefs.getBoolPref("ShowOriginal" + w) && !prefs.getBoolPref("ShowOriginal" + (w+1)) &&
          prefs.getCharPref("Version" + w) == prefs.getCharPref("Version" + Number(w+1)))
          value = "show2";
      if (value == "show2" && w+2 <= dw && 
          !prefs.getBoolPref("ShowOriginal" + (w+2)) &&
          prefs.getCharPref("Version" + Number(w+1)) == prefs.getCharPref("Version" + Number(w+2)))
          value = "show3";
    }
    
    document.getElementById("text" + w).setAttribute("value", value);
     
    if (value == "show2") {
      w++;
      document.getElementById("text" + w).setAttribute("value", "hide");
    }
    if (value == "show3") {
      w++;
      document.getElementById("text" + w).setAttribute("value", "hide");
      w++;
      document.getElementById("text" + w).setAttribute("value", "hide");
    }
  }
//for (w=1; w<=NW; w++) {jsdump("w=" + w + ", value=" + document.getElementById("text" + w).getAttribute("value"));}
 
  // Window pins
  for (w=1; w<=NW; w++) {
    var type = Tab[prefs.getCharPref("Version" + w)].modType;
    if (type == BIBLE || type == COMMENTARY) {
      document.getElementById("text" + w).setAttribute("pin", (prefs.getBoolPref("IsPinned" + w) ? "pinned":"unpinned"));
    }
    else document.getElementById("text" + w).setAttribute("pin", "hide");
  }
  
  // Footnote boxes
  for (w=1; w<=NW; w++) {
    value = "hide";
    if (Texts && Texts.showNoteBox[w]) value = "show";
    if (value == "show" && prefs.getBoolPref("MaximizeNoteBox" + w)) value = "showmax";
    document.getElementById("text" + w).setAttribute("foot", value);
  }
  
  // Individual tabs
  // start with all tabs showing in the multi-tab (except ORIG tab)
  for (w=1; w<=NW; w++) {
    document.getElementById("w" + w + ".multitab").style.display = "";
    document.getElementById("w" + w + ".multitab").style.visibility = "";
    var pinattrib = (prefs.getBoolPref("IsPinned" + w) ? "true":"false");
    for (var t=0; t<Tabs.length; t++) {
      var normtab = document.getElementById("w" + w + ".tab.norm." + t);
      var multtab = document.getElementById("w" + w + ".tab.mult." + t);
      
      normtab.setAttribute("pinned", pinattrib);
      multtab.setAttribute("pinned", pinattrib);
      
      if (prefs.getCharPref("Version" + w) == Tabs[t].modName) {
        normtab.setAttribute("selected", "selected");
        multtab.setAttribute("selected", "selected");
      }
      else {
        normtab.removeAttribute("selected"); 
        multtab.removeAttribute("selected");   
      }
      
      if (Tabs[t].isOrigTab) {
        normtab.style.display = "";
        multtab.style.display = "none";
        if (prefs.getBoolPref("ShowOriginal" + w)) normtab.setAttribute("selected", "selected");
        else normtab.removeAttribute("selected"); 
      }
      else {
        if (Tabs[t].hidden) {
          normtab.style.display = "none";
          multtab.style.display = "none";
        }
        else {
          normtab.style.display = "none";
          multtab.style.display = "";
        }
      }
    }
  }

  // move tabs into the tab row until it is full
  for (w=1; w<=NW; w++) {
    var trw = document.getElementById("tabs" + w).offsetWidth;
    for (var t=0; t<Tabs.length; t++) {
      document.getElementById("w" + w + ".tab.norm." + t ).style.display = "";
      document.getElementById("w" + w + ".tab.mult." + t).style.display = "none";
      if (document.getElementById("tabs" + w).offsetWidth > trw) break;
    }
    if (t >= Tabs.length-1) document.getElementById("w" + w + ".multitab").style.display = "none";
    else {
      document.getElementById("w" + w + ".tab.norm." + t).style.display = "none";
      document.getElementById("w" + w + ".tab.mult." + t).style.display = "";
      document.getElementById("w" + w + ".tabselect").className = "tab tab" + Tabs[t].tabType;
      
      // set multi-tab's text & style too
      var mtabs = document.getElementById("w" + w + ".tabselect").getElementsByClassName("tab");
      for (t=0; t<mtabs.length; t++) {
        if (mtabs[t].style.display != "none" && mtabs[t].getAttribute("selected")) break;
      }
      document.getElementById("w" + w + ".tabselect").setAttribute("selected", (t < mtabs.length ? "selected":""));
    }
  }

//var d="Ndis=" + dw; for (w=1; w<=NW; w++) {d+=", text" + w + "=" + document.getElementById("text" + w).getAttribute("value");} jsdump(d);

}

function drawTabs(w) {
  var html = "";
  
  for (var t=0; t<Tabs.length; t++) {
    html += "<input type=\"button\" class=\"tab tab" + Tabs[t].tabType + "\" ";
    html += "id=\"w" + w + ".tab.norm." + t + "\" value=\"" + Tabs[t].label + "\" ";
    html += "title=\"" + Tabs[t].description + "\"></button>";
  }
  
  // The multi-tab tab is a pulldown to hold all tabs which don't fit.
  html += "<div id = \"w" + w + ".multitab\" class=\"multitab\">"; // to stack two buttons...
  
  html +=   "<select id=\"w" + w + ".tabselect\" class=\"tab\">";
  for (t=0; t<Tabs.length; t++) {
    html +=   "<option id=\"w" + w + ".tab.mult." + t + "\" class=\"tab tab" + Tabs[t].tabType + "\" ";
    html +=   (Tabs[t].modName==prefs.getCharPref("Version" + w) ? " selected=\"selected\"":"") + ">";
    html +=   Tabs[t].label + "</option>";
  }
  html +=   "</select>";
  
  // a div is needed to capture tab selection clicks and prevent activation of pulldown menu
  html +=   "<div id=\"w" + w + ".tab.tsel\"></div>";
  
  html += "</div>";
  
  document.getElementById("tabs" + w).innerHTML = html;
}

function needBookChooser() {
  try {
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      var m = prefs.getCharPref("Version" + w);
      if (Tab[m].modType == GENBOOK) return true;     
    }
  } catch(er) {}
  
  return false;
}

function unloadViewPort() {

  // save hidden tab prefs
  for (var w=1; w<=NW; w++) {
    for (var type in SupportedModuleTypes) {
      var hide = "";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t]["w" + w + ".hidden"]) hide += Tabs[t].modName + ";";
      }
      prefs.setCharPref("Hidden" + type + w, hide);
    } 
  }
  
}
