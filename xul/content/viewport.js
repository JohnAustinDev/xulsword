const NW = 3; // number of horizontal text windows xulsword supports

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
  
  updateViewPort();
  window.onresize = updateViewPort;
}

function updateViewPort() {
  var tabheight = getCSS(".tabs {");
  tabheight = tabheight.style.height.match(/^(\d+)\s*px/)[1];
  
  // Reset CSS rules which depend on window height
  var wh = window.innerHeight - tabheight;
  if (wh < 100) wh = 100;

  var rule;
  rule = getCSS(".sb {");
  rule.style.height = wh + "px";
  
  rule = getCSS("#biblechooser, #bookchooser {");
  rule.style.height = Number(wh + tabheight) + "px";
  
  for (var w=1; w<=NW; w++) {
    var nbh = prefs.getIntPref("NoteBoxHeight" + w);
    if (nbh > wh) nbh = wh;
    
    rule = getCSS("#note" + w + " {");
    rule.style.height = nbh + "px";
  
    rule = getCSS("#text" + w + "[value=\"show1\"][foot^=\"show\"] .sb {");
    rule.style.marginBottom = nbh + "px";
    rule.style.height = Number(wh - nbh) + "px";
  }
  
  rule = getCSS(".text[foot=\"showmax\"]:not([value=\"show1\"]) .nb {");
  rule.style.height = wh + "px";
    
  // Bible chooser
  var value = (needBookChooser() ? "book":(prefs.getBoolPref("ShowChooser") ? "bible":"hide"));
  document.getElementById("chooser").setAttribute("value", value);
  
  // Tabs
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
  
  //var d="Ndis=" + dw; for (w=1; w<=NW; w++) {d+=", text" + w + "=" + document.getElementById("text" + w).getAttribute("value");} jsdump(d);

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

