
function loadViewPort() {
  // set default prefs
  getPrefOrCreate("NumDisplayedWindows", "Int", 2);
  
  getPrefOrCreate("ShowChooser", "Bool", true);
  
  for (var w=1; w<=3; w++) {
    getPrefOrCreate("ShowOriginal" + w, "Bool", false);
    getPrefOrCreate("IsPinned" + w, "Bool", false);
    getPrefOrCreate("ShowNoteBox" + w, "Bool", false);
    getPrefOrCreate("NoteBoxHeight" + w, "Int", 200);
    getPrefOrCreate("MaximizeNoteBox" + w, "Bool", false);
    if (!Tab[getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"))])
        prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
  }

  // draw tabs
  for (w=1; w<=NW; w++) {Win[w].selTab = Tab[prefs.getCharPref("Version" + w)];}
  
  for (w=1; w<=NW; w++) {drawTabs(w);}
  
  var hidden = "";
  for (w=1; w<=NW; w++) {
    for (var type in SupportedModuleTypes) {
      hidden += getPrefOrCreate("Hidden" + type + w, "Char", "");
    } 
  }
  for (var t=0; t<Tabs.length; t++) {
    var inhide = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
    if (inhide.test(Tabs[t].modName)) Tabs[t].hidden = true;
    else Tabs[t].hidden = false;
  }
  
  // update the viewport now
  updateViewPort();
  window.onresize = updateViewPort;
}

// This function updates the viewport based on all previously set global
// user settings. It does not set/change any global paramters, but only
// implements them in the viewport. Ideally, these should be CSS changes.
function updateViewPort() {
  // Read CSS constant rules
  var css = getCSS(".tab {");
  var tabheight = Number(css.style.height.match(/^(\d+)\s*px/)[1]);
  css = getCSS("#tabrow {");
  tabheight += Number(css.style.paddingTop.match(/^(\d+)\s*px/)[1]);
  css = getCSS("#viewportbody {");
  var padtop = Number(css.style.paddingTop.match(/^(\d+)\s*px/)[1]);
  var padbot = Number(css.style.paddingBottom.match(/^(\d+)\s*px/)[1]);
  css = getCSS(".hd {");
  var headheight = Number(css.style.height.match(/^(\d+)\s*px/)[1]);
  
  // Reset CSS rules which depend on window height
  var sbh = window.innerHeight - padtop - tabheight - headheight - padbot;
  if (sbh < 100) sbh = 100;

  var rule;
  rule = getCSS(".sb {");
  rule.style.height = sbh + "px";
  
  rule = getCSS("#biblechooser, #bookchooser {");
  rule.style.height = (window.innerHeight - padtop - padbot) + "px";
  
  for (var w=1; w<=NW; w++) {
    var nbh = prefs.getIntPref("NoteBoxHeight" + w);
    if (nbh > sbh) nbh = sbh;
    
    rule = getCSS("#note" + w + " {");
    rule.style.height = nbh + "px";
  
    rule = getCSS("#text" + w + "[value=\"show1\"][foot^=\"show\"] .sb {");
    rule.style.marginBottom = nbh + "px";
    rule.style.height = Number(sbh - nbh) + "px";
  }
  
  rule = getCSS(".text[foot=\"showmax\"]:not([value=\"show1\"]) .nb {");
  rule.style.height = sbh + "px";
    
  // Bible chooser
  var value = (needBookChooser() ? "book":(prefs.getBoolPref("ShowChooser") ? "bible":"hide"));
  document.getElementById("chooser").setAttribute("value", value);
  
  // Tab row
  var dw = prefs.getIntPref("NumDisplayedWindows");
  document.getElementById("tabrow").setAttribute("value", "show" + dw);
  
  // Windows
  for (var w=1; w<=NW; w++) {
    value = "show1";
    if (w > dw) value = "hide";
    else {
      if ((w+1)<=dw && prefs.getCharPref("Version" + w) == prefs.getCharPref("Version" + Number(w+1)))
          value = "show2";
      if (value == "show2" && w+2<=dw && prefs.getCharPref("Version" + Number(w+1)) == prefs.getCharPref("Version" + Number(w+2)))
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
  
  // Window pins
  for (w=1; w<=NW; w++) {
    document.getElementById("text" + w).setAttribute("pin", (prefs.getBoolPref("IsPinned" + w) ? "pinned":"unpinned"));
  }
  
  // Footnote boxes
  for (w=1; w<=NW; w++) {
    value = "hide";
    if (prefs.getBoolPref("ShowNoteBox" + w)) value = "show";
    if (value == "show" && prefs.getBoolPref("MaximizeNoteBox" + w)) value = "showmax";
    document.getElementById("text" + w).setAttribute("foot", value);
  }
  
  // Individual tabs
  // start with all tabs showing in the multi-tab (except ORIG tab)
  for (w=1; w<=NW; w++) {
    document.getElementById("multitab" + w).style.display = "";
    document.getElementById("multitab" + w).style.visibility = "";
    var pinattrib = (prefs.getBoolPref("IsPinned" + w) ? "true":"false");
    for (var t=0; t<Tabs.length; t++) {
      var normtab = document.getElementById("tab" + t + "w" + w);
      var multtab = document.getElementById("seltab" + t + "w" + w);
      
      normtab.setAttribute("pinned", pinattrib);
      multtab.setAttribute("pinned", pinattrib);
      
      var selattrib = (prefs.getCharPref("Version" + w) == Tabs[t].modName ? "true":"false");
      normtab.setAttribute("selected", selattrib);
      multtab.setAttribute("selected", selattrib);
      
      if (Tabs[t].isOrigTab) {
        normtab.style.display = "";
        multtab.style.display = "none";
        normtab.setAttribute("selected", (prefs.getBoolPref("ShowOriginal" + w) ? "true":"false"));
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
      document.getElementById("tab" + t + "w" + w).style.display = "";
      document.getElementById("seltab" + t + "w" + w).style.display = "none";
      if (document.getElementById("tabs" + w).offsetWidth > trw) break;
    }
    if (t >= Tabs.length-1) document.getElementById("multitab" + w).style.display = "none";
    else {
      document.getElementById("tab" + t + "w" + w).style.display = "none";
      document.getElementById("seltab" + t + "w" + w).style.display = "";
      document.getElementById("multitabbut" + w).className = "tab tab" + Tabs[t].tabType;
    }
  }
  

  //var d="Ndis=" + dw; for (w=1; w<=NW; w++) {d+=", text" + w + "=" + document.getElementById("text" + w).getAttribute("value");} jsdump(d);

}

function drawTabs(w) {
  var html = "";
  for (var t=0; t<Tabs.length; t++) {
    html += "<input type=\"button\" class=\"tab tab" + Tabs[t].tabType + "\" id=\"tab" + t + "w" + w + "\" value=\"" + Tabs[t].label + "\" title=\"" + Tabs[t].description + "\" onclick=\"tabMouse(event);\"></button>";
  }
  // "more tabs" tab is a pulldown to hold all tabs which don't fit. An element
  // is also needed to capture tab selection clicks without activating pulldown menu
  html += "<div id = \"multitab" + w +"\" class=\"multitab\">"; // to stack two buttons...
  html += "<select id=\"multitabbut" + w + "\" class=\"tab\" onmouseover=\"tabMouse(event);\" onmouseout=\"tabMouse(event);\">";
  
  for (t=0; t<Tabs.length; t++) {
    html += "<option id=\"seltab" + t + "w" + w + "\" class=\"tab tab" + Tabs[t].tabType + "\" ";
    html += (Tabs[t].modName==Win[w].selTab.modName ? " selected=\"selected\"":"");
    html += "onclick=\"tabMouse(event);\" onmouseover=\"tabMouse(event);\" onmouseout=\"tabMouse(event);\">"
    html += Tabs[t].label + "</option>";
  }
    
  html += "</select>";
  html += "<div id=\"seltab.tab\" onclick=\"tabMouse(event)\" onmouseover=\"tabMouse(event);\" onmouseout=\"tabMouse(event);\"></div>";
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

function tabMouse() {

}

function unloadViewPort() {

  // save hidden tab prefs
  for (var w=1; w<=NW; w++) {
    for (var type in SupportedModuleTypes) {
      var hide = "";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].hidden) hide += Tabs[t].modName + ";";
      }
      prefs.setCharPref("Hidden" + type + w, hide);
    } 
  }
  
}
