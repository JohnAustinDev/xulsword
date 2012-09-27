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


/************************************************************************
 * XULSWORD INITIALIZATION
 ***********************************************************************/
var SavedWindowWithFocus;
var NewModuleInfo;
var AboutScrollTo;
var AudioDirs = null;
var CopyPopup;
var ViewPortWindow, ViewPort, Texts, BibleTexts;
const NOMODULES="0000", NOLOCALES="0001", NEEDRESTART="0002";

function loadedXUL() {
  ViewPortWindow = document.getElementById("xulviewport").contentDocument.defaultView;
  ViewPort = ViewPortWindow.ViewPort;
  Texts = ViewPortWindow.Texts;
  BibleTexts = ViewPortWindow.BibleTexts;
  
  updateCSSBasedOnCurrentLocale(["#xulsword-window", "input, button, menu, menuitem"]);
  createVersionClasses(); // needed for tooltips
  pullFontSizesFromCSS();
  adjustFontSizes(prefs.getIntPref('FontSize'));
  document.title = SBundle.getString("Title");
  window.name="xulsword-window";
  
  
  //To make the program window draw cleaner and faster, size initialization 
  //routines use prefs to size the frames since window size is not available during 
  //initialization. However, the first time the program is run, there are no size prefs 
  //as yet. The solution in this case is to init everything using a timeout so that 
  //window size is then available and can be stored into the size prefs before the frames 
  //are initialized.
  try {prefs.getIntPref("ViewPortHeight");}
  catch (er) {
    window.setTimeout("loadedXULReal()",0);
    return;
  }
  loadedXULReal();
}

function loadedXULReal() {
  // check for newly installed modules and reset mods if necessary
  var resetUserPrefs = false;
  var pfile = getSpecialDirectory("xsResD");
  pfile.append(NEWINSTALLFILE);
  if (Bible) NewModuleInfo = (pfile.exists() ? readNewInstallsFile(pfile):null);
  if (pfile.exists()) removeFile(pfile, false);
  if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
    resetUserPrefs = true;
    for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
      resetSearchIndex(NewModuleInfo.NewModules[m]);
    }
  }
  else resetUserPrefs=false;

  if (Bible && HaveValidLocale) {
    for (var cmd in GlobalToggleCommands) {
      if (GlobalToggleCommands[cmd] == "User Notes") continue;
      Bible.setGlobalOption(GlobalToggleCommands[cmd], getPrefOrCreate(GlobalToggleCommands[cmd], "Char", "On"));
    }
  }
  
  // Adjust some prefs for host computer screen size
  getPrefOrCreate("ShowChooser","Bool",true);
  if (window.screen.width <= 800) {
    //in script.js initializeScript(), ScriptBox padding is also decreased in this case
    getPrefOrCreate("NumDisplayedWindows","Int",2);
    getPrefOrCreate("NoteboxHeight1","Int",70);
    getPrefOrCreate("NoteboxHeight2","Int",70);
    getPrefOrCreate("NoteboxHeight3","Int",70);
    getPrefOrCreate("FontSize","Int",-4);
  }
  else if (window.screen.width <= 1024) {
    getPrefOrCreate("NumDisplayedWindows","Int",2);
    getPrefOrCreate("NoteboxHeight1","Int",100);
    getPrefOrCreate("NoteboxHeight2","Int",100);
    getPrefOrCreate("NoteboxHeight3","Int",100);
    getPrefOrCreate("FontSize","Int",-2);
  } 
  else {
    getPrefOrCreate("NumDisplayedWindows","Int",2);
    getPrefOrCreate("NoteboxHeight1","Int",200);
    getPrefOrCreate("NoteboxHeight2","Int",200);
    getPrefOrCreate("NoteboxHeight3","Int",200);
    getPrefOrCreate("FontSize","Int",0);
  }
  
  //Initialize xulsword module choices
  for (var w=1; w<=3; w++) {
    if (!Tab[getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"))])
    prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
  }
  
  History.init();
  
  var st = "";;
  try {st = getUnicodePref("SearchText");} catch(er) {}
  document.getElementById("searchText").value = st;
  
  identifyModuleFeatures(resetUserPrefs);
  if (HaveValidLocale) createLanguageMenu();
  if (Bible) fillModuleMenuLists();
  
  //Some "hard-wired" access keys...
  document.getElementById("w1").setAttribute("accesskey", dString("1"));
  document.getElementById("w2").setAttribute("accesskey", dString("2"));
  document.getElementById("w3").setAttribute("accesskey", dString("3"));
  document.getElementById("f0").setAttribute("accesskey", dString("1"));
  document.getElementById("f1").setAttribute("accesskey", dString("2"));
  document.getElementById("f2").setAttribute("accesskey", dString("3"));
  document.getElementById("f3").setAttribute("accesskey", dString("4"));
  document.getElementById("f4").setAttribute("accesskey", dString("5"));
  
  
  //Listen for keypresses on search textbox (for return key)
  document.getElementById("searchText").addEventListener("keypress", 
      function(event) {if ((e.target.id=="searchText") && (e.keyCode==13)) {goDoCommand("cmd_xs_searchFromTextBox");}}, 
      false);

  //BookmarksMenuController must be appended to window since no element is necessarily 
  //focused during bookmark menu pulldown operations and so commandDispatcher doesn't help any
  window.controllers.appendController(XulswordController);
  window.controllers.appendController(BookmarksMenuController);

  //Initialize global options buttons and checkboxes
  if (!Bible || !HaveValidLocale || !Tabs.length) hideGUI();
  else updateXulswordButtons();
   
  BookmarkFuns.initTemplateDataSource(document.getElementById("bookmarks-menu"), BMDS); 
  
  // Cludge to get history button the right height, must happen after updating locale configuration
  document.getElementById("historymenu").style.height = String(document.getElementById("back").boxObject.height) + "px";
  
  if (Bible && HaveValidLocale) {
    if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
      var w=1;
      for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
        Tab[NewModuleInfo.NewModules[m]]["w" + w + ".hidden"] = false;
        while (w <= prefs.getIntPref("NumDisplayedWindows")) {
          prefs.setCharPref("Version" + w, NewModuleInfo.NewModules[m]);
          w++;
          if (Tab[NewModuleInfo.NewModules[m]].modType != BIBLE) break;
        }
      }
    }
    updateModuleMenuCheckmarks(); 
    window.setTimeout("checkCipherKeys()",0);
  }
  
  if (Bible) window.onresize = resizeWatch;
  if (window.opener && window.opener.document && window.opener.document.title=="Splash")
      window.opener.close(); //Close splash and opener window
  
  //handle error states...
  if (HaveValidLocale && (!Bible || !Tabs.length)) window.setTimeout("errorHandler(NOMODULES)",0);
  else if (!HaveValidLocale && !RestartToChangeLocale) window.setTimeout("errorHandler(NOLOCALES)",0);
  else if (RestartToChangeLocale) window.setTimeout("errorHandler(NEEDRESTART)",0);
  else if (prefs.getCharPref("DefaultVersion")=="none") window.setTimeout("errorHandler(NOMODULES)",0);
  
  //we're ok!
  // User pref DefaultVersion is guaranteed to exist and to be an installed Bible version
  else if (Bible) {
    Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
    window.setTimeout("postWindowInit()", 1000); 
  }
  jsdump("Initilization Complete\n");
}
    
function hideGUI() {
  var ids=["edit-menu", "view-menu", "options-menu", "bookmarks-menu", "window-menu", "help-menu", "main-controlbar", "xulviewport"];
  for (var i=0; i<ids.length; i++) {document.getElementById(ids[i]).style.display="none";}
  
  var filemenu = document.getElementById("file-popup").firstChild;
  while (filemenu) {
    if (!filemenu.id || filemenu.id.search("keep")==-1) filemenu.style.display="none";
    filemenu = filemenu.nextSibling;
  }
}

var TreeStyleRules = [];

//This function is run after the MK window is built and displayed. Init functions
//which can wait until now should do so, so that the MK window can appear faster.
function postWindowInit() {
  // Create TreeStyleRules used by BookmarkManager
  var modules = Bible.getModuleList().split("<nx>");
  for (var v=0; v<modules.length; v++) {
    var info = modules[v].split(";");
    if (info[1].search("Biblical Texts") == -1) continue;
    var versionConfig = VersionConfigs[info[0]];
    var font = "font-family:\"" + (versionConfig && versionConfig.font ? versionConfig.font:DefaultFont) + "\" !important; ";
    var direction = "direction:" + (versionConfig && versionConfig.direction ? versionConfig.direction:"ltr") + " !important; ";
    TreeStyleRules.push("treechildren::-moz-tree-cell-text(" + info[0] + ") { " + direction + font + "}");
  }
  for (var v=0; v<LocaleList.length; v++) {
    var localeConfig = LocaleConfigs[LocaleList[v]];
    var font = "font-family:\"" + (localeConfig && localeConfig.font ? localeConfig.font:DefaultFont) + "\" !important; ";
    var direction = "direction:" + (localeConfig && localeConfig.direction ? localeConfig.direction:"ltr") + " !important; ";
    TreeStyleRules.push("treechildren::-moz-tree-cell-text(" + LocaleList[v] + ") { " + direction + font + "}");
  }
  
  // Hide disabled books on chooser
  useFirstAvailableBookIf();
  disableMissingBooks(getPrefOrCreate("HideDisabledBooks", "Bool", false));
  
  if (NewModuleInfo && NewModuleInfo.NewLocales && NewModuleInfo.NewLocales[0] && !document.getElementById("sub-lang").disabled) {
    var opmenu = document.getElementById("menu.options").childNodes[0].nodeValue;
    var lamenu = document.getElementById("menu.options.language").childNodes[0].nodeValue;
    var result={};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        fixWindowTitle(document.getElementById("menu.options.language").childNodes[0].nodeValue),
        SBundle.getFormattedString("LangSelectMsg", [opmenu, lamenu]), 
        DLGINFO,
        DLGOK);
    openLanguageMenu();
  }
  prefs.setBoolPref("PreviousRestart", false)
  
  // Enable help email address
  var email = null;
  try {email = prefs.getCharPref("HelpEmailAddress");}
  catch (er) {}
  if (email) {
    var menu = document.getElementById("emailus");
    menu.setAttribute("label", email);
    menu.removeAttribute("hidden");
    document.getElementById("emailus-sep").removeAttribute("hidden");
  }
  
  createHelpVideoMenu();

}

function useFirstAvailableBookIf() {
  var vers = firstDisplayBible();
  var availableBooks = getAvailableBooks(vers);
  if (!availableBooks || !availableBooks.length) return;
  var book = Location.getBookName();
  for (var b=0; b<availableBooks.length; b++) {if (availableBooks[b]==book) break;}
  if (b<availableBooks.length) return;
  Location.setLocation(vers, availableBooks[0] + ".1.1.1");
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

function readNewInstallsFile(aFile) {
  var filedata = readFile(aFile);
//jsdump("NewInstall=" + filedata);
  // Filedata example: NewLocales;uz;NewModules;uzv;uzdot;uzdnt;NewFonts;Arial.ttf
  filedata = filedata.split(";");
  var modInfo = {};
  var reading = "unknown";
  if (filedata && filedata.length) {
    for (var n=0; n<filedata.length; n++) {
      if (!filedata[n]) continue
      filedata[n] = filedata[n].replace(/(^\s+|\s+$)/g, "");
      if (filedata[n]=="NewLocales" || filedata[n]=="NewModules" || filedata[n]=="NewFonts") {
        reading = filedata[n];
        modInfo[reading] = [];
        continue;
      }
      switch(reading) {
      case "NewLocales":
        for (var m=0; m<LocaleList.length; m++) {
          // check that we have a valid locale before saving it
          if (filedata[n] == DEFAULTLOCALE || LocaleList[m] == filedata[n]) {
            modInfo[reading].push(filedata[n]);
            break;
          }
        }
        break;
      case "NewModules":
        var modules = Bible.getModuleList();
        if (modules) {
          modules = modules.split("<nx>");
          if (modules && modules.length) {
            for (var m=0; m<modules.length; m++) {
              var mod = modules[m].split(";");
              // check that we have a valid module before saving it
              if (mod && mod[0] && mod[0] == filedata[n]) {
                modInfo[reading].push(filedata[n]);
                break;
              }
            }
          }
        }
        break;
      case "NewFonts":
        modInfo[reading].push(filedata[n]);
        break;
      }
    }
  }
  return modInfo;
}

function openLanguageMenu(selectLocale) {
  document.getElementById('options-popup').showPopup(); 
  window.setTimeout("document.getElementById('sub-lang-pup').showPopup()", 100);
}

function resetSearchIndex(modName) {
  try {Bible.searchIndexDelete(modName);} catch(er) {return false;}
  prefs.setBoolPref("dontAskAboutSearchIndex" + modName, false);
  return true;
}

function errorHandler(error) {
  switch (error) {
  case NOMODULES:
    jsdump ("No modules to load. Please add valid config file to mods.d directory.\n");
    return; //allow user to install some modules
    break;
  case NOLOCALES:
    jsdump("No locale to load. Please install a valid locale.\n");
    break;
  case NEEDRESTART:
    jsdump("Program restart is needed.\n");
    var pr = getPrefOrCreate("PreviousRestart", "Bool", false);
    if (!pr) {
      prefs.setBoolPref("PreviousRestart", true);
      restartApplication(false);
    }
    error = SBundle.getString("RestartMsg");
    break;
  }
  var result={};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      fixWindowTitle(SBundle.getString("Title")),
      error, 
      DLGALERT,
      DLGOK);
  window.close();
}

function identifyModuleFeatures(resetUserPrefs) {
  var f = getModuleFeatures();
  if (Bible) {
    for (var i=0; i<Tabs.length; i++) {
      var fthis = getModuleFeatures(Tabs[i].modName);
      for (var t in fthis) f[t] |= fthis[t];
    }
  }
  
  var hide = getPrefOrCreate("HideDisabledViewMenuItems", "Bool", false);
  var infos = [];
  infos.push({n:"haveDictionary",   e:"cmd_xs_toggleDictionary",          b:"dtbutton", s:null});
  infos.push({n:"haveHeadings",     e:"cmd_xs_toggleHeadings",            b:"hdbutton", s:null});
  infos.push({n:"haveFootnotes",    e:"cmd_xs_toggleFootnotes",           b:"fnbutton", s:"sub-fn"});
  infos.push({n:"haveCrossRefs",    e:"cmd_xs_toggleCrossRefs",           b:"crbutton", s:"sub-cr"});
  infos.push({n:"haveHebrewVowels", e:"cmd_xs_toggleHebrewVowelPoints",   b:null,       s:null});
  infos.push({n:"haveHebrewCant",   e:"cmd_xs_toggleHebrewCantillation",  b:null,       s:null});
  infos.push({n:"haveRedWords",     e:"cmd_xs_toggleRedWords",            b:null,       s:null});
  infos.push({n:"haveStrongs",      e:"cmd_xs_toggleStrongsTags",         b:null,       s:null});
  for (var i=0; i<infos.length; i++) {updateFeature(infos[i], f, resetUserPrefs, hide);}
  
  if (!f.isStrongs) prefs.setCharPref("Strong's Numbers", "Off");
  prefs.setCharPref("Morphological Tags", prefs.getCharPref("Strong's Numbers"));
  
  var thv = document.getElementById("cmd_xs_toggleHebrewVowelPoints");
  var thc = document.getElementById("cmd_xs_toggleHebrewCantillation");
  if (getPrefOrCreate("HideHebrewOptions", "Bool", false) || ((thv.hidden || thv.getAttribute("disabled")=="true") && (thc.hidden || thc.getAttribute("disabled")=="true")))
    document.getElementById("sub-heb").hidden = true;
}

function updateFeature(info, f, resetUserPrefs, hideDisabledItems) {
  if (!f[info.n]) {
    if (info.e) prefs.setCharPref(GlobalToggleCommands[info.e], "Off");
    if (info.e) document.getElementById(info.e).setAttribute("disabled", "true");
    if (hideDisabledItems && info.e) document.getElementById(info.e).hidden = true;
    if (info.b) document.getElementById(info.b).hidden = true;
    if (info.s) document.getElementById(info.s).setAttribute("disabled", "true");
  }
  else if (resetUserPrefs && info.e) prefs.setCharPref(GlobalToggleCommands[info.e], "On");
}

function getModuleFeatures(module) {
  var features = {
    haveDictionary:false,
    haveHeadings:false,
    haveFootnotes:false,
    haveCrossRefs:false,
    haveHebrewCant:false,
    haveHebrewVowels:false,
    haveRedWords:false,
    haveStrongs:false,
    haveMorph:false,
    isStrongs:false
  };
  if (!module) return features;
  
  var globalOptionFilters = Bible.getModuleInformation(module, "GlobalOptionFilter");
  features.haveHeadings      = (globalOptionFilters.search("Headings")  != -1);
  features.haveFootnotes     = (globalOptionFilters.search("Footnotes") != -1);
  features.haveCrossRefs     = (globalOptionFilters.search("Scripref")  != -1);
  features.haveHebrewCant    = (globalOptionFilters.search("UTF8Cantillation")  != -1);
  features.haveHebrewVowels  = (globalOptionFilters.search("UTF8HebrewPoints")  != -1);
  features.haveRedWords      = (globalOptionFilters.search("RedLetterWords")  != -1);
  features.haveStrongs       = (globalOptionFilters.search("Strongs")  != -1);
  features.haveMorph         = (globalOptionFilters.search("Morph")  != -1);
  
  var feature = Bible.getModuleInformation(module, "Feature");
  features.isStrongs         = (feature.search("GreekDef")!=-1 || feature.search("HebrewDef")!=-1);
      
  if (globalOptionFilters.search("Dictionary")!= -1) {
    features.haveDictionary = false;
    var dmods = Bible.getModuleInformation(module, "DictionaryModule");
    dmods = dmods.split("<nx>");
    for (var m=0; m<dmods.length && !features.haveDictionary; m++) {
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modName==dmods[m]) features.haveDictionary=true;
      }
    }
  }
  return features;
}

function checkCipherKeys() {
  var gotKey = false;
  for (var t=0; t<CheckTexts.length; t++) {
    if (Bible.getVerseText(CheckTexts[t], "Gen 1:1").length < 2 && 
        Bible.getVerseText(CheckTexts[t], "Matt 1:1").length < 2 &&
        !getAvailableBooks(CheckTexts[t])[0]) {
      var retVals = {gotKey: false};
      AllWindows.push(window.openDialog("chrome://xulsword/content/getkey.xul","getkey","chrome, dependent, alwaysRaised, centerscreen, modal", CheckTexts[t], retVals));
      gotKey |= retVals.gotKey;
    }
  }
  if (gotKey) windowLocationReload();
}

function createLanguageMenu() {
  if (LocaleList.length <= 1) {
    document.getElementById("sub-lang").setAttribute("disabled", "true");
    return;
  }
  var menuItems = [];
  for (var lc=0; lc<LocaleList.length; lc++) {
    var xulElement = document.createElement("menuitem");
    xulElement = writeLocaleElem(xulElement, lc, "", false);
    if (!xulElement) continue;
    xulElement.setAttribute("type", "radio");
    xulElement.setAttribute("name", "lng");
    xulElement.setAttribute("oncommand", "handleOptions(this)");
    menuItems.push(xulElement);
  }
  menuItems.sort(localeElemSort);
  var menu = document.getElementById("sub-lang-pup");
  for (var e=0; e<menuItems.length; e++) {menu.appendChild(menuItems[e]);}
}

function localeElemSort(a,b) {
  var la = a.getAttribute("label").charCodeAt();
  var lb = b.getAttribute("label").charCodeAt();
  if (la < lb) return -1;
  if (la > lb) return 1;
  return 0;
}

function writeLocaleElem(elem, lc, id, noAccessKey) {
  var myID = LocaleList[lc];
  if (id) myID = id + "." + myID;

  var bundle = getLocaleBundle(LocaleList[lc], "xulsword.properties");
  if (!bundle) return null;
  var myLabel = bundle.GetStringFromName("LanguageMenuLabel");
  var myAccKey = bundle.GetStringFromName("LanguageMenuAccKey");
  var myLocale = LocaleList[lc];

  elem.setAttribute("label", myLabel);
  if (!noAccessKey) elem.setAttribute("accesskey", myAccKey);
  elem.setAttribute("id", myID);
  if (LocaleConfigs[myLocale]) addConfigStyleToElem(LocaleConfigs[myLocale], elem, myLabel);
  return elem;
}


var AllVideos = [];
function createHelpVideoMenu() {
  var olditems = [];
  var olditem = document.getElementById("help-popup").firstChild;
  while (olditem && olditem.id && olditem.id != "help-popup-sep1") {
    olditems.push(olditem);
    olditem = olditem.nextSibling;
  }
  while(olditems.length) {
    olditems[0].parentNode.removeChild(olditems[0]);
    olditems.shift();
  }
  while(AllVideos.length) {AllVideos.shift();}


  if (!readVideos(AllVideos)) {
    document.getElementById("help-popup-sep1").setAttribute("hidden", "true");
    return;
  }
  
  document.getElementById("help-popup-sep1").removeAttribute("hidden");
  for (var v=0; v<AllVideos.length; v++) {
    if (!AllVideos[v].type || AllVideos[v].type != "help" || !AllVideos[v].file.leafName.match(XSVIDEOEXT)) continue;
    var xulElement = document.createElement("menuitem");
    xulElement = writeHelpVideoElem(xulElement, AllVideos[v]);
    document.getElementById("help-popup").insertBefore(xulElement, document.getElementById("help-popup-sep1"));
  }
}

function readVideos(vArray) {
  var vdirs = [getSpecialDirectory("xsVideo")];
  for (var i=0; i<vdirs.length; i++) {
    if (!vdirs[i].exists()) continue;
    getVideosInDir(vdirs[i], vArray, null, null);
  }
  return vArray.length;
}

function getVideosInDir(dir, vArray, type, locale) {
  if (!dir || !dir.isDirectory() || !dir.directoryEntries) return;
  var subs = dir.directoryEntries;
  while (subs && subs.hasMoreElements()) {
    var v = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
    if (!v) continue;
    if (v.isDirectory()) getVideosInDir(v, vArray, (!type ? v.leafName:type), (type && !locale ? v.leafName:null));
    if (!v.leafName.match(XSVIDEOEXT)) continue;
    else {
      var obj = {file:v, type:type, locale:locale, label:getLabelOfVideo(v), index:vArray.length, id:"video.help." + vArray.length};
      vArray.push(obj);
    }
  }
}

var VideoInfoFiles = {};
function getLabelOfVideo(file) {
  var info = file.parent.clone();
  info.append(file.leafName.replace(/\d\d\..*$/, "00.txt"));
  if (!VideoInfoFiles[info.leafName]) VideoInfoFiles[info.leafName] = readFile(info);
  if (!VideoInfoFiles[info.leafName]) return file.leafName;
  var labels = VideoInfoFiles[info.leafName];
  var re = new RegExp("^\\s*" + escapeRE(file.leafName) + "\\s*=\\s*(.*)\\s*$", "im");
  var label = labels.match(re);
  return (label ? label[1]:file.leafName);
}

function writeHelpVideoElem(elem, v) {
  elem.setAttribute("id", v.id);
  elem.setAttribute("label", v.label);
  elem.setAttribute("oncommand", "AllVideos[" + v.index + "].file.launch()");
  elem.setAttribute("class", "menuitem-iconic videoHelpMenuItem");
  var localeConfig = (!v.locale || !LocaleConfigs[v.locale] ? LocaleConfigs[getLocale()]:LocaleConfigs[v.locale]);
  if (localeConfig) addConfigStyleToElem(localeConfig, elem, v.label);
  return elem;
}

function addConfigStyleToElem(config, elem, label) {
  var myfont = (config && config.font && (!label || !isASCII(label)) ? config.font:DefaultFont);
  var myfontSizeAdjust = (config && config.fontSizeAdjust && (!label || !isASCII(label)) ? config.fontSizeAdjust:DefaultFontSizeAdjust);
  var mylineHeight = (config && config.lineHeight ? config.lineHeight:DefaultLocaleLineHeight);
  elem.style.fontFamily = "\"" + myfont + "\"";
  elem.style.fontSizeAdjust = myfontSizeAdjust;
  elem.style.lineHeight = mylineHeight;
}

function fillModuleMenuLists() {
  var moduleTypeCounts = {}
  for (var t=0; t<Tabs.length; t++) {
    var xulElement = document.createElement("menuitem");
    xulElement = writeModuleElem(xulElement, t, "label", "modulemenu", false, false, false)
    if (!xulElement) continue;
    xulElement.setAttribute("type", "checkbox");
    xulElement.setAttribute("oncommand", "holdMenuAndHandleOptions(this)");
    xulElement.setAttribute("autocheck","false");
    
    for (var type in SupportedModuleTypes) {
      if (Tabs[t].modType!=SupportedModuleTypes[type]) continue;
      var sub = "sub-" + type;
      var subPup = "sub-" + type + "-pup";
      var sepShowAll = "sepShowAll-" + type;
      if (!moduleTypeCounts[type]) moduleTypeCounts[type]=1;
      else moduleTypeCounts[type]++;
      //if (moduleTypeCounts[type]<10) xulElement.setAttribute("accesskey", String(moduleTypeCounts[type]));
      document.getElementById(subPup).insertBefore(xulElement, document.getElementById(sepShowAll));
    }
  }
    
  for (var type in SupportedModuleTypes) {
    sub = "sub-" + type;
    subPup = "sub-" + type + "-pup";
    sepShowAll = "sepShowAll-" + type;
    var showAllTabs = "showAllTabs." + type;
    var showNoTabs = "showNoTabs." + type;
    if (!moduleTypeCounts[type]) {
      if (getPrefOrCreate("HideDisabledViewMenuItems", "Bool", false)) document.getElementById(sub).hidden=true;
      else document.getElementById(sub).disabled=true;
    }
    else if (moduleTypeCounts[type]==1) {
      document.getElementById(sepShowAll).hidden=true;
      document.getElementById(showAllTabs).hidden=true;
      document.getElementById(showNoTabs).hidden=true;
    }
  }
}

function writeModuleElem(elem, t, attrib, id, skipORIG, noDescription, forceDefaultFormatting) {
  if (!forceDefaultFormatting) forceDefaultFormatting=false;
  var desc = "";
  if (t == -1) {
    if (skipORIG) return null;
  }
  else if (!noDescription) {
    desc = Bible.getModuleInformation(Tabs[t].modName, "Description");
    if (desc==NOTFOUND) desc="";
    else desc = " --- " + desc;
  }
  
  var dirChar=String.fromCharCode(8206);
  if (!forceDefaultFormatting) {
    var versionConfig = VersionConfigs[Tabs[t].modName];
    var myfont = (versionConfig && versionConfig.font && !isASCII(Tabs[t].label) ? versionConfig.font:DefaultFont);
    var myfontSizeAdjust = (versionConfig && versionConfig.fontSizeAdjust && !isASCII(Tabs[t].label) ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust);
    dirChar = (versionConfig && versionConfig.direction && versionConfig.direction == "rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));
  }
  else {
    myfont = DefaultFont;
    myfontSizeAdjust = DefaultFontSizeAdjust;
    dirChar = String.fromCharCode(8206);  
  }
  elem.style.fontFamily = "\"" + myfont + "\"";
  elem.style.fontSizeAdjust = myfontSizeAdjust;
  
  elem.setAttribute(attrib, Tabs[t].label + desc + dirChar);
  elem.setAttribute("id", id + "." + String(t));
  
  return elem;
}


/************************************************************************
 * History
 ***********************************************************************/ 
 
var History = {
  list:null,
  index:0,
  depth:30,
  timer:null,
  delay:3500,
  delim:"<nx>",
  
  init: function() {
    this.list = getPrefOrCreate("History", "Char", this.delim).split(this.delim);
    this.index = getPrefOrCreate("HistoryIndex", "Int", 0);
    this.list.pop(); // History pref should always end with HistoryDelimeter
    if (Bible && HaveValidLocale && prefs.getCharPref("DefaultVersion") != "none") {
      var aVersion = prefs.getCharPref("DefaultVersion");
      var loc = Location.convertLocation(Bible.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
      this.list[this.index] = loc[0] + "." + loc[1] + "." + loc[2];
    } 
  },
  
  save: function() {
    var newhist="";
    for (var i=0; i<this.list.length; i++) {
      newhist += this.list[i] + this.delim;
    }
    prefs.setCharPref("History", newhist);
    prefs.setIntPref("HistoryIndex", this.index);
  },
  
  back: function() {
    if (this.index <= 0) return;
    // If we've clicked back, make sure the current location has been added to history first!
    try {window.clearTimeout(this.timer);} catch(er){}
    this.add();
    this.index--;
    this.toHistory(this.index);
  },

  forward: function() {
    if (this.index >= this.depth) return;
    this.index++;
    this.toHistory(this.index);
  },

  toHistory: function (index) {
    var refBible = firstDisplayBible();
    var loc = Location.convertLocation(WESTERNVS, this.list[index] + ".1", Bible.getVerseSystem(refBible));
    Location.setLocation(refBible, loc);
    document.getElementById("book").book = Location.getBookName();
    document.getElementById("book").version = refBible;
    document.getElementById("chapter").value = dString(Location.getChapterNumber(refBible));
    document.getElementById("verse").value = dString(Location.getVerseNumber(refBible));
    updateFromNavigator();
    goUpdateCommand("cmd_xs_forward");
    goUpdateCommand("cmd_xs_back");
  },

  //When something is selected from the menulist, this routine processes the selection
  toSelection: function(index) {
      this.index = index;
      var toFront = this.list[this.index];  // save chosen entry
      this.list.splice(this.index, 1);   // delete chosen entry
      this.list.push(toFront);        // append chosen entry to front
      this.index = this.list.length-1;  // update Historyi to point to moved entry
      
      this.toHistory(this.index);
  },

  createMenu: function(aEvent) {
    var popup = aEvent.target;
    // clear out the old context menu contents (if any)
    while (popup.hasChildNodes()) 
      popup.removeChild(popup.firstChild);
    // Show history in verse system of firstDisplayBible(), save current Bible location and restore it after creating menu
    var vers = firstDisplayBible();
    for (var i=0; i<History.length; i++) {
      var xulElement = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
      xulElement.setAttribute("oncommand", "History.toSelection('" + i + "')");
      var aref = Location.convertLocation(WESTERNVS, this.list[i], Bible.getVerseSystem(vers));
      xulElement.setAttribute("label", ref2ProgramLocaleText(aref, true));
      //if (i == this.index) {xulElement.style.background="rgb(230,200,255)";}
      popup.appendChild(xulElement);  
    }
  },
    
  add: function() {
    var bcvH = this.list[this.index].split(".");
    var bcvN = new Array(3);
    // Always store as SAME versification!
    var aVersion = prefs.getCharPref("DefaultVersion");
    var loc = Location.convertLocation(Bible.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
    bcvN[0] = loc[0];
    bcvN[1] = loc[1];
    bcvN[2] = loc[2];
    // Check to see if book or chapter is different than last saved history
    if ((bcvN[0] != bcvH[0]) || (bcvN[1] != bcvH[1])) {
      // If so, then record this as a new history entry
      this.index++;
      if (this.index == this.depth) {
        this.list.shift(); 
        this.index--;
      }
      this.list.splice(this.index, (this.depth-this.index), bcvN.join("."));
        
      //update buttons
      goUpdateCommand("cmd_xs_forward");
      goUpdateCommand("cmd_xs_back");
    }
    // If book/chap is same as history, but verse is different, then update verse number in current history, but don't create new history entry
    else if ((bcvN[2] != bcvH[2])) {this.list[this.index] = bcvN.join(".");}
  }
  
};


/************************************************************************
 * Bible Navagator...
 ***********************************************************************/ 
 function updateNavigator() {
  if (!Bible) return;
  
  var myvers = firstDisplayBible();

  document.getElementById("book").book = Location.getBookName();
  document.getElementById("book").version = myvers;
  document.getElementById("chapter").value = dString(Location.getChapterNumber(myvers));
  document.getElementById("verse").value = dString(Location.getVerseNumber(myvers));
}

function onRefUserUpdate(event, location, version) {
  location = location.split(".");
  var newloc = {shortName:location[0], chapter:location[1], verse:location[2], lastVerse:location[3]}
  updateToReference(newloc);
}
 
function updateToReference(loc) {
  if (loc==null) {return;}
  var numberOfSelectedVerses=1;
  if (loc.shortName) {
    document.getElementById("book").book = loc.shortName;
    document.getElementById("book").version = firstDisplayBible();
  }
  if (loc.chapter)   {document.getElementById("chapter").value = dString(loc.chapter);}
  if (loc.verse)     {document.getElementById("verse").value = dString(loc.verse);}
  if (loc.lastVerse) {numberOfSelectedVerses = loc.lastVerse - loc.verse + 1;}
  updateFromNavigator(numberOfSelectedVerses);
}

function updateFromNavigator(numberOfSelectedVerses) {
  var fail=false;
  if (numberOfSelectedVerses == null) {numberOfSelectedVerses = 1;}
  
  var myb = document.getElementById("book").book;
  var myversion = document.getElementById("book").version;
  var myc = Number(iString(document.getElementById("chapter").value));
  if (isNaN(myc)) {myc=1; document.getElementById("chapter").value=dString(myc);}
  var myv = Number(iString(document.getElementById("verse").value));
  if (isNaN(myv)) {myv=1; document.getElementById("verse").value=dString(myv);}
  
  //check book
  var mybn = findBookNum(myb);
  if (mybn == null) {fail=true;}
  
  //force chapter to boundary if over in either direction
  if (myc < 1) {myc=1;}
  if (myc > Book[mybn].numChaps) {myc=Book[mybn].numChaps;}
  
  if (!fail) {Location.setLocation(myversion, Book[mybn].sName + "." + myc);}

  //check verse is not necessary since sending Location an illegal verse number will result in return of the appropriate boundary (1 or max verse)
  Location.setVerse(myversion, myv, myv+numberOfSelectedVerses-1);
  Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
}


/************************************************************************
 * Navigation functions...
 ***********************************************************************/ 
 
function previousBook() {
  var bkn = findBookNum(Location.getBookName());
  bkn--;
  if (bkn < 0) return;
  Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

// if pin info is given, apply changes to pin window only
function previousChapter(highlightFlag, scrollType, wpin) {
  if (!wpin || !prefs.getBoolPref("IsPinned" + wpin)) wpin = null;
  
  var vers = (wpin ? prefs.getCharPref("Version" + wpin):firstDisplayBible());
  var bkn = findBookNum(wpin ? Texts.display[wpin].bk:Location.getBookName());
  var chn = (wpin ? Texts.display[wpin].ch:Location.getChapterNumber(vers));
  
  if (chn > 1) {chn--;}
  else return;
  
  if (wpin) {Texts.pinnedDisplay[wpin].ch = chn;}
  else {Location.setLocation(vers, Location.getBookName() + "." + chn);}
  
  Texts.update(getScrollArray(wpin, Book[bkn].sName + "." + chn + ".1." + scrollType), highlightFlag);
}

// if pin info is given, apply changes to pin window(s) only
function previousPage(highlightFlag, wpin) {
  if (!wpin || !prefs.getBoolPref("IsPinned" + wpin)) wpin = null;
  
  // if a multi-column windows is visible, get its first verse
  var vf = null;
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var t = ViewPortWindow.document.getElementById("text" + w);
    if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {
      var sb = t.getElementsByClassName("sb")[0];
      var v = sb.firstChild;
      while (v && (v.style.display == "none" || !v.id || !(/^vs\./).test(v.id))) {v = v.nextSibling;}
      if (v) {
        vf = v.id.split(".");
        vf.shift();
      }
      if (vf) break;
    }
  }
  
  // if no multi-column window is visible, just do previousChapter
  if (!vf) {
    previousChapter(highlightFlag, SCROLLTYPEBEG, wpin);
    return;
  }

  Texts.update(getScrollArray(wpin, vf.join(".") + "." + (wpin ? SCROLLTYPEEND:SCROLLTYPEENDSELECT)), highlightFlag);
}

function previousVerse(scrollType) {
  var vers = firstDisplayBible();
  var l = Location.getLocation(vers).split(".");
  l[1] = Number(l[1]);
  l[2] = Number(l[2]);
  
  l[2]--;
  if (l[2] == 0) {
    l[1]--;
    if (l[1] == 0) return;
    l[2] = Bible.getMaxVerse(vers, l[0] + "." + l[1]);
  }
  l[3] = l[2];

  Location.setLocation(vers, l.join("."));
  Texts.update(scrollType, HILIGHTVERSE);
}

function nextBook() {
  var bkn = findBookNum(Location.getBookName());
  bkn++;
  if (bkn >= NumBooks) return;
  Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

// if pin info is given, apply changes to pin window(s) only
function nextChapter(highlightFlag, scrollType, wpin) {
  if (!wpin || !prefs.getBoolPref("IsPinned" + wpin)) wpin = null;
  
  var vers = (wpin ? Texts.display[wpin].mod:firstDisplayBible());
  var bkn = findBookNum(wpin ? Texts.display[wpin].bk:Location.getBookName());
  var chn = (wpin ? Texts.display[wpin].ch:Location.getChapterNumber(vers));
  
  if (chn < Book[bkn].numChaps) {chn++;}
  else return;
  
  if (wpin) {Texts.pinnedDisplay[wpin].ch = chn;}
  else {Location.setLocation(vers, Location.getBookName() + "." + chn);}
  
  Texts.update(getScrollArray(wpin, Book[bkn].sName + "." + chn + ".1." + scrollType), highlightFlag);
}

// if pin info is given, apply changes to pin window(s) only
function nextPage(highlightFlag, wpin) {
  if (!wpin || !prefs.getBoolPref("IsPinned" + wpin)) wpin = null;
  
  // if a multi-column windows is visible, get its last verse
  var vl = null;
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var t = ViewPortWindow.document.getElementById("text" + w);
    if ((/^show(2|3)$/).test(t.getAttribute("columns"))) {
      var sb = t.getElementsByClassName("sb")[0];
      var nb = ViewPortWindow.document.getElementById("note" + w);
      var v = sb.lastChild;
      while (v && (
             !v.id || !(/^vs\./).test(v.id) || 
             v.offsetLeft >= sb.offsetWidth || 
             (v.offsetLeft > sb.offsetWidth-(1.5*nb.offsetWidth) && v.offsetTop+v.offsetHeight > t.offsetHeight-nb.parentNode.offsetHeight))
             ) {
        v = v.previousSibling;
      }
      if (v) {
        vl = v.id.split(".");
        vl.shift();
      }
      if (vl) break;
    }
  }
  
  // if no multi-column window is visible, just do previousChapter
  if (!vl) {
    nextChapter(highlightFlag, SCROLLTYPEBEG, wpin);
    return;
  }

  if (wpin) {
    Texts.pinnedDisplay[wpin].bk = vl[0];
    Texts.pinnedDisplay[wpin].ch = vl[1];
    Texts.pinnedDisplay[wpin].vs = vl[2];
  }
  else {Location.setLocation(prefs.getCharPref("Version" + w), vl.join("."));}
    
  Texts.update(getScrollArray(wpin, vl.join(".") + "." + SCROLLTYPEBEG), highlightFlag);
}

function nextVerse(scrollType) {
  var vers = firstDisplayBible();
  var l = Location.getLocation(vers).split(".");
  l[1] = Number(l[1]);
  l[2] = Number(l[2]);
  
  l[2]++;
  if (l[2] > Bible.getMaxVerse(vers, l[0] + "." + l[1])) {
    l[1]++;
    if (l[1] > Bible.getMaxChapter(vers, l[0])) return;
    l[2] = 1;
  }
  l[3] = l[2];

  Location.setLocation(vers, l.join("."));
  Texts.update(scrollType, HILIGHTVERSE);
}

function getScrollArray(wpin, scrollMember) {
  var scroll = [null];
  for (var w=1; w<=NW; w++) {
    if (wpin) {
      if (w == wpin) scroll.push(scrollMember);
      else scroll.push(null);
    }
    else {
      scroll.push(prefs.getBoolPref("IsPinned" + w) ? null:scrollMember);
    }
  }
  
  return scroll; 
}

/************************************************************************
 * Scroll Wheel functions...
 ***********************************************************************/

var SWcount = 0;
var SWwin;
var SWTO;

// scroll wheel does synchronized scrolling of all visible versekey windows
function scrollwheel(event) {
  
  // find window in which event occurred
  var w = event.target;
  while (w && (!w.id || !(/^text\d+$/).test(w.id))) {w = w.parentNode;}
  if (!w) return;
  SWwin = Number(w.id.replace("text", ""));

  if (Tab[prefs.getCharPref("Version" + SWwin)].modType != BIBLE && 
      Tab[prefs.getCharPref("Version" + SWwin)].modType != COMMENTARY) return;
      
  var vd = Math.round(event.detail/3);
  SWcount = (SWcount + vd);

  if (SWTO) window.clearTimeout(SWTO);
  SWTO = window.setTimeout("scrollwheel2();", 250);
}

function scrollwheel2() {

  // get number of verses by which to scroll
  var dv = 2*SWcount-(Math.abs(SWcount)/SWcount);
  SWcount = 0;
  if (!dv) return;

  // get first verse which begins in window
  var t = ViewPortWindow.document.getElementById("text" + SWwin);
  var sb = t.getElementsByClassName("sb")[0];
  var v = sb.firstChild;
  if (t.getAttribute("columns") == "show1") {
    while (v && (!v.id || !(/^vs\./).test(v.id) || (v.offsetTop - sb.offsetTop < sb.scrollTop))) {v = v.nextSibling;}
  }
  else {
    while (v && (!v.id || !(/^vs\./).test(v.id) || v.style.display == "none")) {v = v.nextSibling;}
  }
  if (!v) return;
 
  // if this is a multi-column window, shift the verse according to scroll wheel delta
  if (t.getAttribute("columns") != "show1") {
    var nv = v;
    while (dv > 0) {
      if (nv) nv = nv.nextSibling;
      while (nv && (!nv.id || !(/^vs\./).test(nv.id))) {nv = nv.nextSibling;}
      dv--;
      if (nv && nv.id && (/^vs\./).test(nv.id)) v = nv;
    }
    while (dv < 0) {
      if (nv) nv = nv.previousSibling;
      while (nv && (!nv.id || !(/^vs\./).test(nv.id))) {
        nv = nv.previousSibling;
      }
      dv++;
      if (nv && nv.id && (/^vs\./).test(nv.id)) v = nv;
    }
  }
 
  var v = v.id.split(".");
  v.shift();
  v = v.join(".");
  
  // decide which windows to scroll and which to leave alone
  var scroll = [null];
  for (var w=1; w<=NW; w++) {
    var s;
    if (w == SWwin) {
      if (t.getAttribute("columns") == "show1") s = null; // no need to scroll since UI will handle it
      else s = v + "." + SCROLLTYPEBEG;
    }
    else {
      if (prefs.getBoolPref("IsPinned" + SWwin)) s = null;
      else if (prefs.getBoolPref("IsPinned" + w)) s = null;
      else s = v + "." + SCROLLTYPEBEG;
    }
    scroll.push(s);
  }

  Texts.update(scroll, HILIGHTSAME);
}


/************************************************************************
 * Main Command Controller...
 ***********************************************************************/
var XulswordController = {
  parsedLocation: {},
 
  doCommand: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
      BookmarksCommand.undoBookmarkTransaction();
      break;
    case "cmd_redo":
      BookmarksCommand.redoBookmarkTransaction();
      break;
    case "cmd_xs_toggleHeadings":
    case "cmd_xs_toggleFootnotes":
    case "cmd_xs_toggleCrossRefs":
    case "cmd_xs_toggleDictionary":
    case "cmd_xs_toggleStrongsTags":
    case "cmd_xs_toggleMorphTags":
    case "cmd_xs_toggleVerseNums":
    case "cmd_xs_toggleUserNotes":
    case "cmd_xs_toggleRedWords":
    case "cmd_xs_toggleHebrewCantillation":
    case "cmd_xs_toggleHebrewVowelPoints":
      prefs.setCharPref(GlobalToggleCommands[aCommand],(prefs.getCharPref(GlobalToggleCommands[aCommand])=="Off") ? "On":"Off");
      updateXulswordButtons();
      Texts.update(SCROLLTYPECENTER, HILIGHTNONE);
      break;
    case "cmd_xs_allTogglesOn":
    case "cmd_xs_allTogglesOff":
      for (var tcmd in GlobalToggleCommands) {
        if (tcmd!="cmd_xs_toggleHebrewVowelPoints" && tcmd!="cmd_xs_toggleHebrewCantillation") {
          var elem = document.getElementById(tcmd);
          if (!elem || elem.getAttribute("disabled") != "true")
            prefs.setCharPref(GlobalToggleCommands[tcmd], aCommand.substring(17));
        }
      }
      updateXulswordButtons();
      Texts.update(SCROLLTYPETOP, HILIGHTNONE);
      break;
    case "cmd_xs_search":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", CONTAINS_THE_WORDS) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):CONTAINS_THE_WORDS);
      prefs.setIntPref("InitialSearchType", tp);
      AllWindows.push(window.open("chrome://xulsword/content/search.xul","_blank","chrome,resizable,centerscreen"));
      break;
    case "cmd_xs_searchFromTextBox":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", CONTAINS_THE_WORDS) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):CONTAINS_THE_WORDS);
      openSearchDialog(document.getElementById('searchText').value, firstDisplayModule().mod, tp);
      break;
    case "cmd_xs_searchForSelection":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", EXACT_TEXT) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):EXACT_TEXT);
      openSearchDialog(getMainWindowSelection(), CurrentTarget.version, tp);
      break;
    case "cmd_xs_openFromSelection":
      updateToReference(this.parsedLocation);
      break;
    case "cmd_xs_newBookmark":
      BookmarkFuns.addBookmarkAs(CurrentTarget, false);
      break;
    case "cmd_xs_newUserNote":
      BookmarkFuns.addBookmarkAs(CurrentTarget, true);
      break;
    case "cmd_xs_selectVerse":
      document.getElementById("verse").value = dString(CurrentTarget.verse);
      Location.setLocation(CurrentTarget.version, CurrentTarget.shortName + "." + CurrentTarget.chapter + "." + CurrentTarget.verse + "." + CurrentTarget.lastVerse);
      Texts.update(SCROLLTYPECENTER, HILIGHTVERSE);
      break;
    case "cmd_xs_back":
      History.back();
      break;
    case "cmd_xs_forward":
      History.forward();
      break;
    case "cmd_xs_navigatorUpdate":
      updateFromNavigator();
      break;
    case "cmd_xs_openManager":
      AllWindows.push(window.open("chrome://xulsword/content/bookmarks/bookmarksManager.xul", "_blank", "chrome,resizable,centerscreen"));
      break;
    case "cmd_xs_toggleTab":
      Tabs[CurrentTarget.tabNum]["w" + CurrentTarget.windowNum + ".hidden"] = !Tabs[CurrentTarget.tabNum]["w" + CurrentTarget.windowNum + ".hidden"];
      updateModuleMenuCheckmarks();
      Texts.update(SCROLLTYPETOP, HILIGHTNONE);
      break;
    case "cmd_xs_aboutModule":
      AboutScrollTo = Tabs[CurrentTarget.tabNum].modName;
      AllWindows.push(window.open("chrome://xulsword/content/about.xul","splash","chrome,modal,centerscreen"));
      break;
    case "cmd_xs_addNewModule":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!addNewModule()) ModuleCopyMutex=false;
      break;
    case "cmd_xs_removeModule":
      AllWindows.push(window.open("chrome://xulsword/content/removeModule.xul",document.getElementById("menu.removeModule.label").childNodes[0].nodeValue,"chrome,resizable,centerscreen"));
      break;
    case "cmd_xs_exportAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!exportAudio(AUDIOFILELOC)) ModuleCopyMutex=false;
      break;
    case "cmd_xs_importAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!importAudio(null, null, false)) ModuleCopyMutex=false;
      break;
    }
  },
  
  isCommandEnabled: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
      return (BM.gTxnSvc.numberOfUndoItems > 0);
    case "cmd_redo":
      return (BM.gTxnSvc.numberOfRedoItems > 0);
    case "cmd_xs_searchFromTextBox":
      var ct = document.getElementById('searchText').value
      return (ct.length > 0);
    case "cmd_xs_searchForSelection":
      return (getMainWindowSelection()!="" && CurrentTarget.version!="");
    case "cmd_xs_forward":
      return (History.index < History.list.length-1);
    case "cmd_xs_back":
      return (History.index > 0);
    case "cmd_xs_openFromSelection":
      var selt = getMainWindowSelection();
      this.parsedLocation = parseLocation(selt.substr(0,64));
      return this.parsedLocation ? true:false;
    case "cmd_xs_toggleTab":
      if (CurrentTarget.windowNum && prefs.getBoolPref("IsPinned" + CurrentTarget.windowNum)) return false;
      return true;
    case "cmd_xs_aboutModule":
      break;
    case "cmd_xs_exportAudio":
      if (ModuleCopyMutex) return false;
      if (AudioDirs === null) AudioDirs = getAudioDirs();
      if (!AudioDirs.length) return false;
      for (var i=0; i<AudioDirs.length; i++) {
        if (AudioDirs[i].isExportable && AudioDirs[i].dir.exists()) {
          var subs = AudioDirs[i].dir.directoryEntries;
          while (subs && subs.hasMoreElements()) {
            var sub = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
            if (!sub || !sub.isDirectory() || sub.equals(getSpecialDirectory("xsAudioPI"))) continue;
            return true;
          }
        }
      }
      return false;
      break;
    case "cmd_xs_addNewModule":
    case "cmd_xs_removeModule":
    case "cmd_xs_importAudio":
      if (ModuleCopyMutex) return false;
      break;
    }
    return true;
  },
      
  supportsCommand: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
    case "cmd_redo":
    case "cmd_xs_toggleHeadings":
    case "cmd_xs_toggleFootnotes":
    case "cmd_xs_toggleCrossRefs":
    case "cmd_xs_toggleDictionary":
    case "cmd_xs_toggleStrongsTags":
    case "cmd_xs_toggleMorphTags":
    case "cmd_xs_toggleVerseNums":
    case "cmd_xs_toggleUserNotes":
    case "cmd_xs_toggleRedWords":
    case "cmd_xs_toggleHebrewCantillation":
    case "cmd_xs_toggleHebrewVowelPoints":
    case "cmd_xs_allTogglesOn":
    case "cmd_xs_allTogglesOff":
    case "cmd_xs_search":
    case "cmd_xs_searchFromTextBox":
    case "cmd_xs_searchForSelection":
    case "cmd_xs_newBookmark":
    case "cmd_xs_newUserNote":
    case "cmd_xs_selectVerse":
    case "cmd_xs_back":
    case "cmd_xs_forward":
    case "cmd_xs_navigatorUpdate":
    case "cmd_xs_openManager":
    case "cmd_xs_openFromSelection":
    case "cmd_xs_toggleTab":
    case "cmd_xs_aboutModule":
    case "cmd_xs_addNewModule":
    case "cmd_xs_removeModule":
    case "cmd_xs_exportAudio":
    case "cmd_xs_importAudio":
      return true;
    default:
      return false;
    }
  }
}
      
function handleNextPrev(id) {
  if (!id || !isNextPrevEnabled()) return;
  id = id.split(".");
  if (id[0] == "next") {
    //NEXT
    switch(id[1]) {
    case "verse":
      nextVerse(id[2] && id[2]=="button" ? SCROLLTYPECENTERALWAYS:SCROLLTYPECENTER);
      break;
    case "chapter":
      nextChapter(HILIGHTNONE, SCROLLTYPEBEG);
      break;
    case "book":
      nextBook(false);
      break;
    default:
      return;
    }
  }
  else {
    //PREVIOUS
    switch(id[1]) {
    case "verse":
      previousVerse(id[2] && id[2]=="button" ? SCROLLTYPECENTERALWAYS:SCROLLTYPECENTER);
      break;
    case "chapter":
      previousChapter(HILIGHTNONE, SCROLLTYPEBEG);
      break;
    case "book":
      previousBook();
      break;
    default:
      return;
    }
  }
}

function isNextPrevEnabled() {
  // disable if genbook-tree is focused (it has its own handler)
  var cd = document.commandDispatcher;
  if (cd && cd.focusedElement && cd.focusedElement.id && cd.focusedElement.id=="genbook-tree") return false;
  // disable if no Bibles or commentaries
  var haveVK = false;
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (Tab[prefs.getCharPref("Version" + w)].modType==BIBLE || Tab[prefs.getCharPref("Version" + w)].modType==COMMENTARY) haveVK=true;
  }
  return haveVK;
}

function getFocusedElemID() {
  var f = document.commandDispatcher;
  if (!f) return null;
  f = f.focusedElement;
  while(f && !f.id) {f = f.parentNode;}
  if (!f) return null;
  return f.id;
}

function goUpdateFileMenu () {
  goUpdateCommand('cmd_xs_exportAudio');
  goUpdateCommand('cmd_xs_removeModule');
  goUpdateCommand('cmd_xs_exportAudio');
  goUpdateCommand('cmd_xs_importAudio');
}

function getMainWindowSelection() {
  var selectedText="";
  var selectionObject = getMainWindowSelectionObject();
  if (selectionObject) {selectedText = replaceASCIIcontrolChars(selectionObject.toString());}
  return selectedText;
}

function getMainWindowSelectionObject() {
  var selob=null;
  for (var w=1; w<=3; w++) {
    selob = ViewPortWindow.getSelection();
    if (!selob.isCollapsed) {return selob;}
  }
  return null;
}

function openSearchDialog(text, version, type) {
  if (!text) text = "";
  if (!version) version = firstDisplayModule().mod;
  if (type!=0 && !type) type = CONTAINS_THE_WORDS;
  
  prefs.setIntPref("InitialSearchType", type);
  prefs.setCharPref("SearchVersion", version);
  setUnicodePref("SearchText", text);
  AllWindows.push(window.open("chrome://xulsword/content/search.xul","_blank","chrome,resizable,centerscreen"));
}


/************************************************************************
 * XULSWORD Window click handlers
 ***********************************************************************/

//Sets view->Show... prefs
function handleViewPopup(elem) {
  var val=elem.getAttribute('value');
  var vals=val.split("_");
  prefs.setBoolPref(vals[0],(vals[1]=="1" ? true:false));
  Texts.update(SCROLLTYPECENTER, HILIGHT_IFNOTV1);
}

var OptionsElement;
function holdMenuAndHandleOptions(elem) {
  preventMenuFromHiding();
  OptionsElement = elem;
  window.setTimeout("handleOptions();", 0);
}

function handleOptions(elem) {
  if (!elem) elem = OptionsElement;
  var id = String(elem.id + ".").split(".");
  id.pop();
  switch (id[0]) {
    case "w1":
    case "w2":
    case "w3":
      prefs.setIntPref("NumDisplayedWindows", Number(elem.id.substr(1,1)));
      Texts.update();
      break;
        
    case "f0":
    case "f1":
    case "f2":
    case "f3":
    case "f4":
      prefs.setIntPref("FontSize", 2*(Number(elem.id.substr(1,1)) - 2));
      adjustFontSizes(prefs.getIntPref('FontSize'));
      ViewPort.adjustFont(prefs.getIntPref('FontSize'));
      Texts.update(SCROLLTYPETOP, HILIGHTNONE);
      break;
    
    case "about":
      AllWindows.push(window.open("chrome://xulsword/content/about.xul","splash","chrome,modal,centerscreen"));
      break;
      
    case "modulemenu":
      var oldCheckedValue = (elem.getAttribute("checked") == "true");
      elem.setAttribute("checked", (oldCheckedValue ? "false":"true"));
    case "showAllTabs":
    case "showNoTabs":
      var subPupId = elem.parentNode.id.match(/sub-([^-]+)-pup/)[1];
      MainWindow.setTimeout("moduleMenuClick1('" + id[0] + "', '" + id[1] + "', '" + subPupId + "', " + oldCheckedValue + ")", 0);
      break;

    case "winRadio":
      var wins = ["1","2","3","all"];
      for (var shortType in SupportedModuleTypes) {
        for (var i=0; i<wins.length; i++){
          if (wins[i] == id[1]) {
            document.getElementById("winRadio." + id[1] + "." + shortType).setAttribute("checked", "true");
          }
          else document.getElementById("winRadio." + wins[i] + "." + shortType).removeAttribute("checked");
        }
      }
      updateModuleMenuCheckmarks();
      break;

    case "emailus":
      var email = null;
      try {email = prefs.getCharPref("HelpEmailAddress");}
      catch (er) {}
      if (email) {
        var aURI = "mailto:" + email;
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
        aURI = ios.newURI(aURI, null, null);
        aURI = aURI.asciiSpec;
        window.location = aURI;
        jsdump("Launched mailto URI of " + aURI.length + " chars.");
      }
      break;
      
    case "allTabs":
      var w = id[1].match(/^w(\d)$/);
      if (w) setAllTabs(true, w[1]);
      else setAllTabs(true);
      break;
      
    case "noTabs":
      var w = id[1].match(/^w(\d)$/);
      if (w) setAllTabs(false, w[1]);
      else setAllTabs(false);
      break;
      
    default:
      for (var lc=0; lc<LocaleList.length; lc++) {
        if (elem.id == LocaleList[lc]) {
          changeLocaleTo(elem.id);
          return;
        }
      }
      jsdump("WARNING: No handler found for: " + elem.parentNode.id + " " + elem.id + "\n");
      break;
  }
}

function holdPopupAndDo(cmd) {
  preventMenuFromHiding();
  if (cmd == "cmd_xs_toggleStrongsTags") window.setTimeout("goDoCommand('cmd_xs_toggleStrongsTags'); goDoCommand('cmd_xs_toggleMorphTags');", 0);
  else window.setTimeout("goDoCommand('" + cmd + "');", 0);
}

var PreventMenuHide = false;
function preventMenuFromHiding() {
  PreventMenuHide = true;
  window.setTimeout("PreventMenuHide = false; Pups = null;", 0);
}

var Pups;
function checkMenuHide(elem, e) {
  if (!PreventMenuHide) {Pups = null; return;}

  if (!Pups) Pups = [];
  Pups.push(e.target);
  
  if (elem == e.target) {
    for (var i=Pups.length-1; i>=0; i--) {
      Pups[i].parentNode.open = true;
    }
  }
}

// Shows or hides all tabs for: if w is passed then window w, otherwise all windows
function setAllTabs(toShowing, w) {
  if (w) {var s=w; var e=w;}
  else {s=1; e=3;}
  for (var i=s; i<=e; i++) {
    for (var t=0; t<Tabs.length; t++) {
      var toggleMe = (toShowing ? Tabs[t]["w" + i + ".hidden"]:!Tabs[t]["w" + i + ".hidden"]);
      if (toggleMe) Tabs[t]["w" + i + ".hidden"] = !Tabs[t]["w" + i + ".hidden"];
    }
  }
  
  updateModuleMenuCheckmarks();
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
}

function moduleMenuClick1(id, tabNum, subPupId, oldCheckedValue) {
  var rs = getRadioSelection(subPupId);
  var aWindowNum = rs;
  if (aWindowNum <= 3) var sw=aWindowNum;
  else {sw=1; aWindowNum=3;}
  
  for (var i=sw; i<=aWindowNum; i++) {
    switch (id) {
    case "modulemenu":
      if (oldCheckedValue != Tabs[tabNum]["w" + i + ".hidden"]) {
        Tabs[tabNum]["w" + i + ".hidden"] = !Tabs[tabNum]["w" + i + ".hidden"] ;
        updateModuleMenuCheckmarks();
      }
      break;
    case "showAllTabs":
    case "showNoTabs":
      var moduletype = SupportedModuleTypes[subPupId];
      if (!moduletype) return;
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType != moduletype) continue;
        var toggleMe = (id=="showNoTabs" ? !Tabs[t]["w" + i + ".hidden"]:Tabs[t]["w" + i + ".hidden"]);
        if (toggleMe) Tabs[t]["w" + i + ".hidden"] = !Tabs[t]["w" + i + ".hidden"];
      }
      updateModuleMenuCheckmarks();
      break;
    }
  }
  
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);

//jsdump("Texts:" + prefs.getCharPref("HiddenTexts1") + "\n");
}

function getRadioSelection(type) {
  var radios = ["1", "2", "3", "all"];
  for (var r=0; r<radios.length; r++) {
    var elem = document.getElementById("winRadio." + radios[r] + "." + type);
    if (elem.getAttribute("checked") == "true") return r+1;
  }
  return 4;
}

function changeLocaleTo(newLocale) {
  var rootPrefBranch = Components.classes["@mozilla.org/preferences-service;1"].
                      getService(Components.interfaces.nsIPrefBranch);
  if (newLocale == getLocale()) return;
  rootPrefBranch.setCharPref("general.useragent.locale",newLocale);
  
  setGlobalDirectionPrefs();
  
  restartApplication();
}

function updateXulswordButtons() {

  var checkboxes = ["cmd_xs_toggleHebrewCantillation", "cmd_xs_toggleHebrewVowelPoints"];
  for (var cmd in GlobalToggleCommands) {
    var checkbox=false;
    for (var cb=0; cb<checkboxes.length; cb++) {checkbox |= (cmd==checkboxes[cb]);}
    if (checkbox) document.getElementById(cmd).setAttribute("checked",(prefs.getCharPref(GlobalToggleCommands[cmd])=="On") ? true:false);
    else {
      try {document.getElementById(cmd).setAttribute("value",(prefs.getCharPref(GlobalToggleCommands[cmd])=="On") ? true:false);}
      catch (er) {}
    }
    if (GlobalToggleCommands[cmd] != "User Notes")
      Bible.setGlobalOption(GlobalToggleCommands[cmd], prefs.getCharPref(GlobalToggleCommands[cmd]));
  }
  
  // Menu Checkboxes
  var myLocale = getLocale();
  if (document.getElementById("sub-lang").getAttribute("disabled") != "true") {
    for (var lc=0; lc<LocaleList.length; lc++) {
      document.getElementById(LocaleList[lc]).setAttribute("checked",(LocaleList[lc] == myLocale ? true:false));
    }
  }
  document.getElementById("f0").setAttribute("checked",(prefs.getIntPref("FontSize")==-4 ? true:false));
  document.getElementById("f1").setAttribute("checked",(prefs.getIntPref("FontSize")==-2 ? true:false));
  document.getElementById("f2").setAttribute("checked",(prefs.getIntPref("FontSize")==0 ? true:false));
  document.getElementById("f3").setAttribute("checked",(prefs.getIntPref("FontSize")==2 ? true:false));
  document.getElementById("f4").setAttribute("checked",(prefs.getIntPref("FontSize")==4 ? true:false));
  document.getElementById("note0").setAttribute("checked",(prefs.getBoolPref("ShowFootnotesAtBottom") ? false:true));
  document.getElementById("note1").setAttribute("checked",(prefs.getBoolPref("ShowFootnotesAtBottom") ? true:false));
  document.getElementById("note2").setAttribute("checked",(prefs.getBoolPref("ShowCrossrefsAtBottom") ? false:true));
  document.getElementById("note3").setAttribute("checked",(prefs.getBoolPref("ShowCrossrefsAtBottom") ? true:false));
  document.getElementById("note4").setAttribute("checked",(prefs.getBoolPref("ShowUserNotesAtBottom") ? false:true));
  document.getElementById("note5").setAttribute("checked",(prefs.getBoolPref("ShowUserNotesAtBottom") ? true:false));
  document.getElementById("w1").setAttribute("checked",(prefs.getIntPref("NumDisplayedWindows")==1 ? true:false));
  document.getElementById("w2").setAttribute("checked",(prefs.getIntPref("NumDisplayedWindows")==2 ? true:false));
  document.getElementById("w3").setAttribute("checked",(prefs.getIntPref("NumDisplayedWindows")==3 ? true:false));
  
  for (var shortType in SupportedModuleTypes) {
    document.getElementById("winRadio." + getPrefOrCreate("ModuleMenuRadioSetting", "Char", "all") + "." + shortType).setAttribute("checked", true);
   } 
  
  // Enabled/Disable some menus based on settings
  if (Bible.getGlobalOption("Footnotes") == "On") {document.getElementById("sub-fn").setAttribute("disabled",false);}
  else {document.getElementById("sub-fn").setAttribute("disabled",true);}
  if (Bible.getGlobalOption("Cross-references") == "On")  {document.getElementById("sub-cr").setAttribute("disabled",false);}
  else {document.getElementById("sub-cr").setAttribute("disabled",true);}
  if (prefs.getCharPref("User Notes") == "On")  {document.getElementById("sub-un").setAttribute("disabled",false);}
  else {document.getElementById("sub-un").setAttribute("disabled",true);}

  window.setTimeout("updateXulswordCommands();", 0); // timeout insures commandDispatcher is ready during xulSword init
}

function updateXulswordCommands() {
  goUpdateCommand("cmd_xs_forward");
  goUpdateCommand("cmd_xs_back");
  goUpdateCommand("cmd_bm_properties");
  goUpdateCommand("cmd_xs_searchFromTextBox");
  goUpdateCommand("cmd_xs_searchForSelection");
  goUpdateTargetLocation();
}


/************************************************************************
 * Context Menu functions
 ***********************************************************************/ 
var ContextMenuShowing = false;
var CurrentTarget = {shortName:null, chapter:null, verse:null, lastVerse:null, tabNum:null, windowNum:null};
var PopupNode;
//var TargParagraph;

function ScriptContextMenuShowing(e, winnum, popupnode) {
//jsdump ("ScriptContextMenuShowing id:" + document.popupNode.id + ", title:" + document.popupNode.title + "\n");
  PopupNode = popupnode;
  
  closeTabToolTip()
  CurrentTarget.windowNum = winnum;

  // Close Script Popup if we're not over it
  var elem = PopupNode;
  while (elem && (!elem.id || elem.id != "npopup")) {elem = elem.parentNode;}
  if (!elem) {
    ViewPortWindow.Popup.close();
  }
  
  // Is this the select tab menu?
  if (PopupNode.id == "seltab.menu") {
    CurrentTarget.tabNum = Tab[PopupNode.value].index;
    buildPopup(e, false, false, false, true, true);
    return;
  }
  // Is this the select tab tab?
  if (PopupNode.id == "seltab.tab") {
    CurrentTarget.tabNum = Tab[PopupNode.nextSibling.value].index;
    buildPopup(e, false, false, false, true, true);
    return;
  }
  // Is this a version tab?
  if (PopupNode.id.search(/tab\d+/)!=-1) {
    CurrentTarget.tabNum = PopupNode.id.match(/tab(\d+)/)[1];
    buildPopup(e, false, false, false, true, true);
    return;
  }
  
  // Is mouse over a word with strong's numbers?
  var selem = PopupNode;
  var strongsNum;
  while (selem && !strongsNum) {
    strongsNum = (selem.className && selem.className.search(/(^|\s)sn($|\s)/)!=-1 ? selem.title:"");
    selem = selem.parentNode;
  }
  if (strongsNum) {
    var pup = document.getElementById("contextScriptBox");
    var insertBefore = pup.firstChild;
    var nums = strongsNum.split(".");
    for (var i=0; i<nums.length; i++) {
      var parts = nums[i].split(":");
      if (parts[0] != "S") continue;
      // SWORD filters these out- not valid it says
      if (parts[1].substr(0,1)=="G" && Number(parts[1].substr(1)) >= 5627) continue;
      nums[i] = parts[1];
      var contextItem = document.createElement("menuitem");
      contextItem.setAttribute("id", "strongs." + i);
      contextItem.setAttribute("label", SBundle.getString("Search") + ":" + nums[i]);
      contextItem.setAttribute("onclick", "searchForLemma('" + nums[i] + "')");
      pup.insertBefore(contextItem, insertBefore);
    }
    if (nums.length) {
      contextItem = document.createElement("menuseparator");
      contextItem.setAttribute("id", "strongs.sep");
      pup.insertBefore(contextItem, insertBefore);
    }
  }
  
  // First get targets from mouse pointer or selection
  var isSelection=false;
  var contextTargs = getTargetsFromElement(PopupNode);
  if (contextTargs==null) {e.preventDefault(); return;}
  var selob = getMainWindowSelectionObject();
  if (selob) {
    contextTargs = getTargetsFromSelection(selob);
    if (contextTargs==null) {e.preventDefault(); return;}
    isSelection=true;
  }
  
//jsdump(contextTargs.shortName + " " + contextTargs.chapter + ":" + contextTargs.verse + "-" + contextTargs.lastVerse + ", res=" + contextTargs.resource);
   
  // Set Global Target variables
  var myModuleName = prefs.getCharPref("Version" + winnum);
  CurrentTarget.version = contextTargs.version ? contextTargs.version:myModuleName;
  CurrentTarget.tabNum = (Tab[CurrentTarget.version] ? Tab[CurrentTarget.version].index:null);
  switch (getModuleLongType(myModuleName)) {
  case BIBLE:
  case COMMENTARY:
    CurrentTarget.shortName = (contextTargs.shortName ? contextTargs.shortName:PopupNode.ownerDocument.defaultView.Pin.display.shortName);
    CurrentTarget.chapter = (contextTargs.chapter ? contextTargs.chapter:PopupNode.ownerDocument.defaultView.Pin.display.chapter);
    CurrentTarget.verse = contextTargs.verse;
    CurrentTarget.lastVerse = contextTargs.lastVerse;
    break;
  case DICTIONARY:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("DictKey_" + myModuleName + "_" + CurrentTarget.windowNum, "Unicode", "");
    CurrentTarget.verse = contextTargs.paragraph;
    CurrentTarget.lastVerse = contextTargs.paragraph;
  case GENBOOK:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("GenBookKey_" + myModuleName + "_" + CurrentTarget.windowNum, "Unicode", "");
    CurrentTarget.verse = contextTargs.paragraph;
    CurrentTarget.lastVerse = contextTargs.paragraph;
    break;
  }
  
  BookmarksMenu._selection = null;
  if (contextTargs.resource) {
    var aItem = BM.RDF.GetResource(contextTargs.resource);
    var aParent = BookmarkFuns.getParentOfResource(aItem, BMDS);
    if (aParent) {
      BookmarksMenu._selection = BookmarksUtils.getSelectionFromResource(aItem, aParent);
    }
  }
    
  // Set some flags
  var haveVerse = (CurrentTarget.verse!=null && contextTargs.paragraph==null);
  var overScriptboxVerse = (haveVerse && !contextTargs.isCrossReference);
  var overSelectedVerse = (overScriptboxVerse && CurrentTarget.verse==Location.getVerseNumber(prefs.getCharPref("Version" + CurrentTarget.windowNum)) && CurrentTarget.verse!=1);
  var frameIsPinned = PopupNode.ownerDocument.defaultView.Pin.isPinned;
  var overPopup = isOverPopup();
  var overResource = (BookmarksMenu._selection != null);
  var overParagraph = (contextTargs.paragraph != null);
  var isTab = (!(haveVerse||overPopup||overParagraph||isSelection));
  buildPopup(e, haveVerse, overParagraph, overResource, overSelectedVerse||!overScriptboxVerse||frameIsPinned, isTab);
}

function buildPopup(e, haveVerse, overParagraph, overResource, disableVerseSelect, isTab) {
  // Enable/disable menu options accordingly
  document.getElementById("cmd_xs_selectVerse").setAttribute("disabled", disableVerseSelect);
  goUpdateCommand("cmd_copy");
  goUpdateCommand("cmd_xs_searchForSelection");
  goUpdateCommand("cmd_xs_openFromSelection");
  goUpdateCommand("cmd_bm_properties");
  goUpdateCommand("cmd_bm_delete");
  goUpdateCommand("cmd_xs_toggleTab");
  goUpdateCommand("cmd_xs_aboutModule");
    
  // Hide menu options accordingly
  document.getElementById("cMenu_copy").hidden  = isTab;
  document.getElementById("contsep00").hidden   = isTab;
  document.getElementById("conSearch").hidden   = isTab;
  document.getElementById("contsep0").hidden    = isTab;
  document.getElementById("conGotoSel").hidden  = isTab;
  document.getElementById("contsep1").hidden    = !haveVerse;
  document.getElementById("conSelect").hidden   = !haveVerse;
  document.getElementById("contsep2").hidden    = (!haveVerse && !overParagraph);
  document.getElementById("conBookmark").hidden = (!haveVerse && !overParagraph);
  document.getElementById("conUserNote").hidden = (!haveVerse && !overParagraph);
  document.getElementById("contsep3").hidden    = (!haveVerse && !overParagraph && !overResource);
  document.getElementById("conProps").hidden    = (!haveVerse && !overParagraph && !overResource);
  document.getElementById("delUserNote").hidden = (!haveVerse && !overParagraph && !overResource);
  //document.getElementById("closeTab").hidden    = !isTab;
  e.target.setAttribute("value","open");
}

function isOverPopup() {
  var parent = PopupNode;
  var overPopup = false;
  while (parent) {
    if (parent.id && parent.id == "npopup") {overPopup = true;}
    parent = parent.parentNode;
  }
  return overPopup;
}

function getTargetsFromSelection(selob) {
  var retval = {window:null, shortName:null, chapter:null, version:null, verse:null, lastVerse:null, resource:null, paragraph:null, isCrossReference:false};
  var targs1 = getTargetsFromElement(selob.focusNode);
  if (targs1 == null) return null;
  var targs2 = getTargetsFromElement(selob.anchorNode);
  if (targs2 == null) return null;
  
  if (targs1.shortName!=targs2.shortName || targs1.chapter!=targs2.chapter) return retval;
  
  // Only return a value for these if targs1 matches targs2
  if (targs1.window==targs2.window) retval.window=targs1.window;
  if (targs1.version==targs2.version) retval.version=targs1.version;
  if (targs1.shortName==targs2.shortName) retval.shortName=targs1.shortName;
  if (targs1.chapter==targs2.chapter) retval.chapter=targs1.chapter;
  if (targs1.verse==targs2.verse && targs1.paragraph==targs2.paragraph) retval.resource = targs1.resource ? targs1.resource:targs2.resource;
  if (targs1.paragraph==targs2.paragraph) retval.paragraph=targs1.paragraph;
  
  // If this is a cross-reference
  if (targs1.isCrossReference) {
    retval.shortName=targs1.shortName;
    retval.chapter=targs1.chapter;
    retval.verse=targs1.verse;
    retval.lastVerse=targs1.lastVerse;
    retval.version=targs1.version;
    retval.isCrossReference = true;
    return retval;
  }
  // Return smaller verse number as "verse" and larger verse number as "lastVerse"
  if (targs2.verse > targs1.verse) {
    retval.verse = targs1.verse;
    retval.lastVerse = targs2.verse;
  }
  else {
    retval.verse = targs2.verse;
    retval.lastVerse = targs1.verse;
  }
  
  return retval;
}

// Searches for information associated with an element or its parents, 
// and searches for a resource attached to an element by searching children
// If the element is not a child of "scriptBox" or "npopup" then null is returned
function getTargetsFromElement(element) {
//jsdump("ID:" + element.id + ", CLASS:" + element.className + ", TITLE:" + element.className + "\n");
  var targs = {window:null, shortName:null, chapter:null, version:null, verse:null, lastVerse:null, resource:null, paragraph:null, isCrossReference:false};
  var inScriptBox=false;
  
  try {targs.window = Number(element.ownerDocument.defaultView.frameElement.id.substr(5,1));} catch (er) {}
  //If we're in interlinear  original mode, return correct version of this element
  if (targs.window && prefs.getBoolPref("ShowOriginal" + targs.window)) {
    var elem = element.parentNode;
    while (elem) {
      if (elem.className) {
        var styleMod = elem.className.match(/vstyle(\w+)/);
        if (styleMod) {
          targs.version = styleMod[1];
          break;
        }
      }
      elem = elem.parentNode;
    }
  }
  
  while (element) {
//jsdump("Context searching id=" + element.id);
    if (element.id) {
      if (element.id=="scriptBox" || element.id=="npopup") {inScriptBox=true;}
      if (element.id=="scriptBox" && !targs.version) targs.version = prefs.getCharPref("Version" + element.ownerDocument.defaultView.frameElement.id.substr(5,1));
      // Are we over a cross reference?
      if (targs.verse == null && element.title) {
        // First get location data
        var crloc = element.title.match(CROSSREFTARGET);
        if (crloc) {
          targs.version = crloc[1];
          targs.shortName = crloc[3];
          targs.chapter = Number(crloc[4]);
          targs.verse = Number(crloc[5]);
          if (crloc[7]) targs.lastVerse = Number(crloc[7]);
          else if (crloc[8]) targs.lastVerse = Number(crloc[8]);
          else targs.lastVerse = targs.verse;
          targs.isCrossReference = true;
        }
      }
      // Are we over a verse?
      if (targs.verse == null) {try {var loc = element.id.match(/vs\.([^\.]*)\.(\d+)\.(\d+)/); targs.shortName = loc[1]; targs.chapter=Number(loc[2]); targs.verse = Number(loc[3]);} catch (er) {}}
      // Are we over a note body?
      if (targs.verse == null) {try {loc = element.id.match(/body\..*([^\.]*)\.(\d+)\.(\d+)$/); targs.shortName = loc[1]; targs.chapter=Number(loc[2]); targs.verse = Number(loc[3]); targs.paragraph=targs.verse;} catch (er) {}}
      // Are we over a user note?
      if (targs.resource == null) {try {targs.resource = decodeUTF8(element.id.match(/(^|\.)un\.(.*?)\./)[2]);} catch (er) {}}
      // Are we over a paragraph?
      if (targs.paragraph == null) {try {targs.paragraph = Number(element.id.match(/par\.(\d+)/)[1]);} catch (er) {}}
      // If we don't have a resource, search applicable children...
      if (targs.resource == null && element.hasChildNodes() && element.id.match(/^(vs|sv|npopup)/)) {
        var child = element.firstChild;
        while (child) {
//jsdump("Context searching child=" + child.id);
          if (targs.resource == null) {
            if (child.id) {
              var resname = child.id.match(/\un\.(.*?)\./);
              if (resname) {targs.resource = decodeUTF8(resname[1]);}
            }
          }
          child = child.nextSibling;
        }
      }
    }
    element = element.parentNode;
  }
  if (targs.verse!=null && targs.lastVerse==null) targs.lastVerse=targs.verse;
  if (!inScriptBox) return null;
  return targs;
}

function ScriptContextMenuHidden(aEvent) {
  var item = aEvent.target.firstChild;
  while (item.id && item.id.substr(0,8)=="strongs.") {
    var remove = item;
    item = item.nextSibling;
    item.parentNode.removeChild(remove);
  }
  // Close popup if open, otherwise if both popup and context were open, popup
  // may remain open after context closes
  ViewPortWindow.Popup.close();
  aEvent.target.setAttribute("value", "closed");
  goUpdateTargetLocation();
  goUpdateCommand("cmd_bm_properties");
}

function goUpdateTargetLocation() {
  CurrentTarget.version = firstDisplayModule().mod;
  switch (getModuleLongType(CurrentTarget.version)) {
  case BIBLE:
  case COMMENTARY:
    CurrentTarget.shortName = Location.getBookName();
    CurrentTarget.chapter = Location.getChapterNumber(CurrentTarget.version);
    CurrentTarget.verse = Location.getVerseNumber(CurrentTarget.version);
    CurrentTarget.lastVerse = Location.getLastVerseNumber(CurrentTarget.version);
    break;
  case DICTIONARY:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("DictKey_" + CurrentTarget.version + "_" + CurrentTarget.windowNum , "Unicode", "/");
    CurrentTarget.verse = 1;
    CurrentTarget.lastVerse = 1;
  case GENBOOK:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("GenBookKey_" + CurrentTarget.version + "_" + CurrentTarget.windowNum , "Unicode", "/" + CurrentTarget.version);
    CurrentTarget.verse = 1;
    CurrentTarget.lastVerse = 1;
    break;
  }
  CurrentTarget.tabNum=null;
  CurrentTarget.windowNum=1;
}

function searchForLemma(strongsNumber) {
  prefs.setCharPref("SearchVersion", CurrentTarget.version);
  setUnicodePref("SearchText","lemma:" + strongsNumber);
  goDoCommand('cmd_xs_search');
}


/************************************************************************
 * Version and Tab Control Functions
 ***********************************************************************/ 
function selectTab(w, version) {
  var fdb = firstDisplayBible(true); // capture before changing prefs...
  if (version == ORIGINAL) {
    prefs.setBoolPref("ShowOriginal" + w,!prefs.getBoolPref("ShowOriginal" + w));
  }
  else {
    prefs.setBoolPref("ShowOriginal" + w, false);
    prefs.setCharPref("Version" + w, version);
    if (w == fdb || fdb != firstDisplayBible(true))
        window.setTimeout("disableMissingBooks(" + getPrefOrCreate("HideDisabledBooks", "Bool", false) + ")", 200);
  }
}

function disableMissingBooks(hide) {
  var books = getAvailableBooks(firstDisplayBible());
  for (var b=0; b<NumBooks; b++) {
    var have = false;
    for (var a=0; books && a<books.length; a++) {
      if (books[a] == Book[b].sName) {have=true; break;}
    }
    ViewPortWindow.document.getElementById("book_" + b).setAttribute("missing", (have ? "false":(hide ? "hide":"disable")));
  }

  if (hide) ViewPort.update(false);
}

function updateModuleMenuCheckmarks() {
//jsdump("RUNNING UPDATE MODULE MENU CHECKMARKS");
  for (var t=0; t<Tabs.length; t++) {
    var aWindowNum = getRadioSelection(Tabs[t].tabType);
    var checked = true;
    if (aWindowNum <= 3) var sw = aWindowNum;
    else {sw=1; aWindowNum=3;}
    for (var w=sw; w<=aWindowNum; w++) {
      checked &= !Tabs[t]["w" + w + ".hidden"];
    }
    checked = (checked ? "true":"false");
    document.getElementById("modulemenu." + t).setAttribute("checked", checked);
      
//jsdump(Tabs[t].modName + "=" + checked);
  }
  
  // insure each window has a selected tab
  for (var w=1; w<=NW; w++) {
    if (Tab[prefs.getCharPref("Version" + w)]["w" + w + ".hidden"]) {
      for (var t=1; t<Tabs.length; t++) {if (!Tabs[t]["w" + w + ".hidden"]) break;} 
      if (t<Tabs.length) selectTab(w, Tabs[t].modName);
    }
  }
}

//BIBLE/COMM: link="book.chapter.verse", DICT/GENBK: link="key"
//verse2 is lastVerse for versekeys and paragraph number for others
function gotoLink(link, version, verse2) {
  var frameNum = ensureModuleShowing(version);
  if (!frameNum) return;
  window.setTimeout("gotoLinkReal('" + link + "', '" + version + "', " + frameNum + (verse2 ? ", '" + verse2 + "'":"") + ")", 0);
}
function gotoLinkReal(link, version, frameNum, verse2) {
  if (!verse2) verse2=false;
  var link2 = link;
  link = decodeUTF8(link);
  switch (getModuleLongType(version)) {
  case BIBLE:
  case COMMENTARY:
    link += (verse2 ? "." + verse2:"");
    Location.setLocation(version, link);
    BookmarkFuns.updateMainWindow(true);
    break;
  case DICTIONARY:
    setUnicodePref("DictKey_" + version + "_" + frameNum, link);
    if (verse2) CustomScrollFunction = "Texts.scrollScriptBox(" + frameNum + ", " + SCROLLTYPECENTER + ", 'par." + verse2 + "');";
    else CustomScrollFunction = "Texts.scrollScriptBox(" + frameNum + ", " + SCROLLTYPETOP + ");";
    BookmarkFuns.updateMainWindow(true, SCROLLTYPECUSTOM);
    break;
  case GENBOOK:
    setUnicodePref("GenBookKey_" + version + "_" + frameNum, link);
    //This timeout is needed because RDF may not be ready until after updateScriptBoxes()
    CustomScrollFunction = "{ GenBookTexts.openGenBookKey(decodeUTF8('" + link2 + "')); GenBookTexts.selectGenBook(decodeUTF8('" + link2 + "'));";
    if (verse2) CustomScrollFunction += " Texts.scrollScriptBox(" + frameNum + ", " + SCROLLTYPECENTER + ", 'par." + verse2 + "'); }";
    else CustomScrollFunction += " Texts.scrollScriptBox(" + frameNum + ", " + SCROLLTYPETOP + "); }";
    BookmarkFuns.updateMainWindow(true, SCROLLTYPECUSTOM);
    break;
  }
}

// This routine returns the number of the first window which is showing the desired version.
// If no window is showing the version, it looks for the first unpinned window
// which has the version's tab showing, selects that tab, and returns that window's number.
// If no window even has the tab showing, the tab is added to the first unpinned
// window, and that tab is selected, and that window's number is returned.
// If no window can be made to show the desired version, then "0" is returned.
function ensureModuleShowing(version) {
  if (!Tab[version]) return 0;
  var aWindow = 0;
  var firstUnPinnedWin;
  for (var w=1; w <= prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (prefs.getBoolPref("IsPinned" + w)) continue;
    if (!firstUnPinnedWin) firstUnPinnedWin = w;
    if (prefs.getCharPref("Version" + w) == version) return w;
    if (!aWindow && !Tab[version]["w" + w + ".hidden"]) {aWindow = w;}
  }
  if (aWindow == 0) {
    if (!firstUnPinnedWin) return 0;
    aWindow = firstUnPinnedWin;
    Tab[version]["w" + aWindow + ".hidden"] = !Tab[version]["w" + aWindow + ".hidden"]
    updateModuleMenuCheckmarks();
  }

  selectTab(aWindow, version);
 
  return aWindow;
}
 

/************************************************************************
 * XUL Window Unload
 ***********************************************************************/ 

//Watch for window resize
var ResizeWatchTimer;
function resizeWatch() {
  if (ViewPortWindow.innerHeight < 100) return;
  if (ResizeWatchTimer) window.clearTimeout(ResizeWatchTimer);
  ResizeWatchTimer = window.setTimeout("ViewPort.update();", 300);
  prefs.setIntPref("ViewPortHeight", ViewPortWindow.innerHeight);
}

function unloadXUL() {
  try {window.controllers.removeController(XulswordController);} catch(er) {}
  try {window.controllers.removeController(BookmarksMenuController);} catch(er) {}
  
  //Close search windows and other windows
  for (var i=0; i<AllWindows.length; i++) {
    if (!AllWindows[i]) next;
    try {AllWindows[i].close();} catch(er) {}
  }
    
  //Clear Transactions
  BM.gTxnSvc.clear();
  
  if (Bible) {
    History.save();
    Bible.quitLibsword();
  }
  
  //Purge UserData data source
  if (BMDS) BookmarkFuns.purgeDataSource(BMDS);
  
  jsdump("Finished unloading xulsword.js");
}

/************************************************************************
 * Display Copy/Printing Functions
 ***********************************************************************/ 

function copyPassageDialog() {
  AllWindows.push(window.open("chrome://xulsword/content/copyPassage.xul",document.getElementById("menu.copypassage").childNodes[0].nodeValue,"chrome,resizable,centerscreen"));
}
 
var PrintPassageHTML;
function handlePrintCommand(command) {
  var topWindow = WindowWatcher.getWindowByName("xulsword-window",window);
  //Fixes a Gecko print preview bug where scroll bar was not appearing
  document.getElementById("printBrowser").style.overflow="auto";
  switch (command) {
  case "cmd_pageSetup":
    document.getElementById("cmd_pageSetup").doCommand();
    break;
  case "cmd_printPreview":
  case "cmd_print":
    document.getElementById('printBrowser').contentDocument.getElementById('printBox').innerHTML = getPrintHTML();
    var mymod = firstDisplayModule().mod;
    var myw = firstDisplayModule().w;
    var mytype = getModuleLongType(mymod);
    var printTitle;
    switch (mytype) {
    case DICTIONARY:
      printTitle = getPrefOrCreate("DictKey_" + mymod + "_" + myw, "Unicode", "/");
      break;
    case GENBOOK:
      printTitle = getPrefOrCreate("GenBookKey_" + mymod + "_" + myw, "Unicode", "/" + mymod);
      break;
    default:
      printTitle = Book[findBookNum(Location.getBookName())].bNameL
    }
    document.getElementById("printBrowser").contentDocument.title = SBundle.getString("Title") + ": " + printTitle;
    document.getElementById(command).doCommand();
    break;
  case "cmd_print_passage":
    AllWindows.push(window.open("chrome://xulsword/content/printPassage.xul",
        document.getElementById("print.printpassage").childNodes[0]
        .nodeValue,"chrome,resizable,centerscreen"));
    break;
  }
}

function getPrintHTML() {

}

function restoreFocus() {
  if (SavedWindowWithFocus) SavedWindowWithFocus.focus();
  SavedWindowWithFocus = null;
}

var PrintPreviewCallbacks = {
  onEnter: function() {
    document.getElementById("mainbar").hidden=true;
    document.getElementById("main-controlbar").hidden=true;
    document.getElementById("appcontent").selectedIndex=1;
  },
  
  onExit: function() {
    restoreFocus();
    document.getElementById("mainbar").hidden=false;
    document.getElementById("main-controlbar").hidden=false;
    document.getElementById("appcontent").selectedIndex=0;
  },
  
  getSourceBrowser: function() {
    return document.getElementById("printBrowser");
  },
  
  getPrintPreviewBrowser: function() {
    return document.getElementById("printPreviewBrowser");
  },
  
  getNavToolbox: function() {
    return document.getElementById("mainbar");
  }
}


/************************************************************************
 * Miscellaneous Functions
 ***********************************************************************/ 
 
function toOpenWindowByType(inType, uri, features)
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
  var topWindow = windowManagerInterface.getMostRecentWindow(inType);

  var thiswin;
  if (topWindow)
    topWindow.focus();
  else if (features) {
    thiswin = window.open(uri, "_blank", features);
  }
  else {
    thiswin = window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  }
  
  return thiswin;
}
  
/************************************************************************
 * Debugging Functions
 ***********************************************************************/ 
 
// This is for debugging purposes only
function saveHTML () {
  for (var i=1; i<=prefs.getIntPref("NumDisplayedWindows"); i++) {
    var data = "";

    try {
      var tmp = Bible.getChapterText(prefs.getCharPref("Version" + i), Location.getLocation(prefs.getCharPref("Version" + i)));
      data += "\n\nCROSSREFS\n" + Bible.getCrossRefs();
    }
    catch (er) {}
  
    var file = getSpecialDirectory("xsResD");
    file.append("ScriptBox" + i + ".txt");
  
    if (!file.exists()) {file.create(file.NORMAL_FILE_TYPE, FPERM);}
  
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, -1, 0);

    var charset = "UTF-16"; // Can be any character encoding name that Mozilla supports
    var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
    // This assumes that fos is the nsIOutputStream you want to write to
    os.init(foStream, charset, 0, 0x0000);
    os.writeString(data);
    os.close();

    foStream.close();
  }
  window.alert("ScriptBox HTML has been written to ScriptBox.txt files in C:");
}


