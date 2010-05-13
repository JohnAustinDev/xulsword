/*  This file is part of Muqaddas Kitob.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    Muqaddas Kitob is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    Muqaddas Kitob is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Muqaddas Kitob.  If not, see <http://www.gnu.org/licenses/>.
*/

/************************************************************************
 * Initialize Static Bible Variables and some Globals
 ***********************************************************************/
var HistoryDepth;
var HistoryDelimeter;
var HistoryCaptureDelay;
var Historyi;
var History;
var FrameDocument = new Array(4);
var FrameElement = new Array(4);
var KeyWindow;
var UsingWaitCursor; 
var CheckPlayer;
var SavedWindowWithFocus;
var NewModuleInfo;
var AboutScrollTo;
var CrossReferences;
const NOMODULES="0000", NOLOCALES="0001", NEEDRESTART="0002";

function loadedXUL() {
  updateCSSBasedOnCurrentLocale(["#main-window", "input, button, menu, menuitem"]);
  createVersionClasses(0); // needed for tooltips
  document.title = fixWindowTitle(SBundle.getString("Title"));
  //window.alert(rootprefs.getIntPref("layout.scrollbar.side") + " " + rootprefs.getIntPref("bidi.direction"));

  //To make the program window draw cleaner and faster, size initialization 
  //routines use prefs to size the frames since window size is not available during 
  //initialization. However, the first time the program is run, there are no size prefs 
  //as yet. The solution in this case is to init everything using a timeout so that 
  //window size is then available and can be stored into the size prefs before the frames 
  //are initialized.
  try {prefs.getIntPref("BibleFrameHeight");}
  catch (er) {
    window.setTimeout("loadedXULReal()",0);
    return;
  }
  loadedXULReal();
}

function loadedXULReal() {
  window.name="main-window";
  document.getElementById("main-window").setAttribute("active", "true"); //overcomes bug in xulrunner1.9.1.3 where after reload (change locale etc.) window.active was false.
  ContextMenuShowing = false;
  CurrentTarget = {shortName:null, chapter:null, verse:null, lastVerse:null, tabNum:null, windowNum:null};

  FrameElement = [null, document.getElementById("bible1Frame"),
                        document.getElementById("bible2Frame"),
                        document.getElementById("bible3Frame")];
                        
  FrameDocument = [null, FrameElement[1].contentDocument, 
                         FrameElement[2].contentDocument, 
                         FrameElement[3].contentDocument];
  
  // check for newly installed modules and reset mods if necessary
  var resetUserPrefs = false;
  var pfile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("PrfDef", Components.interfaces.nsIFile);
  pfile.append(NEWINSTALLFILE);
  NewModuleInfo = (pfile.exists() ? readNewInstallsFile(pfile):null);
  if (pfile.exists()) pfile.remove(false);
  if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
    resetUserPrefs = true;
    for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
      resetSearchIndex(NewModuleInfo.NewModules[m]);
    }
  }
  else resetUserPrefs=false;

  if (Bible && HaveValidLocale) {
    Bible.setGlobalOption("Footnotes", prefs.getCharPref("Footnotes"));
    Bible.setGlobalOption("Headings", prefs.getCharPref("Headings"));
    Bible.setGlobalOption("Cross-references", prefs.getCharPref("Cross-references"));
    Bible.setGlobalOption("Dictionary", prefs.getCharPref("Dictionary"));
    Bible.setGlobalOption("Words of Christ in Red",getPrefOrCreate("Words of Christ in Red", "Char", "On"));
    Bible.setGlobalOption("Verse Numbers",prefs.getCharPref("Verse Numbers"));
    Bible.setGlobalOption("Hebrew Cantillation", prefs.getCharPref("Hebrew Cantillation"));
    Bible.setGlobalOption("Hebrew Vowel Points", prefs.getCharPref("Hebrew Vowel Points"));
    Bible.setGlobalOption("Strong's Numbers", getPrefOrCreate("Strong's Numbers", "Char", "On"));
    Bible.setGlobalOption("Morphological Tags", getPrefOrCreate("Morphological Tags", "Char", "On"));
    //Bible.setGlobalOption("Morpheme Segmentation", getPrefOrCreate("Morpheme Segmentation", "Char", "On"));
  }
  
  // Adjust some prefs for host computer screen size
  getPrefOrCreate("ShowChooser","Bool",true);
  getPrefOrCreate("ShowGenBookChooser","Bool",false);
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
  
  //Initialize xulsword static variables and other vars
  for (var w=1; w<=3; w++) {
    getPrefOrCreate("ShowOriginal" + w, "Bool", false);
    if (!moduleName2TabIndex(getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion")))) 
    prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
  }
  changeVersionPrefs(1, prefs.getCharPref("Version" + 1)); //to update other prefs
  
  //Initialize history globals
  HistoryDepth = 30;  //Number of saved pages in history
  HistoryDelimeter = "<nx>";
  HistoryCaptureDelay = 3500; //Delay in ms before new page is captured as history
  if (Bible) {
    var aVersion = prefs.getCharPref("DefaultVersion");
    if (aVersion != "none")
        Bible.setBiblesReference(aVersion, Bible.convertLocation(WESTERNVS, prefs.getCharPref("Location"), Bible.getVerseSystem(aVersion)));
  }
  History = getPrefOrCreate("History","Char",HistoryDelimeter).split(HistoryDelimeter);
  Historyi = getPrefOrCreate("HistoryIndex","Int",0);
  History.pop(); // History pref should always end with HistoryDelimeter
  if (Bible && HaveValidLocale && prefs.getCharPref("DefaultVersion")!="none") {
    var aVersion = prefs.getCharPref("DefaultVersion");
    var loc = Bible.convertLocation(Bible.getVerseSystem(aVersion), Bible.getLocation(aVersion), WESTERNVS).split(".");
    History[Historyi] = loc[0] + "." + loc[1] + "." + loc[2];
  }
  
  document.title = fixWindowTitle(document.title);
  document.getElementById("searchText").value = getUnicodePref("SearchText");
  
  identifyModuleFeatures(resetUserPrefs);
  if (HaveValidLocale) createLanguageMenu();
  fillModuleMenuLists();
  
  //For backward compatibility so older locales will work with v2.12+
  try {var newck = SBundle.getString("CopyPassageCommandKey");}
  catch (er) {newck = "";}
  if (newck) document.getElementById("copyPassageKb").setAttribute("key", newck);
    
  //Listen for keypresses on search textbox (for return key)
  document.getElementById("searchText").addEventListener("keypress",keypress,false);

  //BookmarksMenuController must be appended to window since no element is necessarily 
  //focused during bookmark menu pulldown operations and so commandDispatcher doesn't help any
  window.controllers.appendController(XulswordController);
  window.controllers.appendController(BookmarksMenuController);

  //Initialize audio directories and related menu items
  initAudioDirs();

  //Initialize global options buttons and checkboxes
  if (!Bible || !HaveValidLocale || !TabVers.length) {
    hideGUI();
  }
  else {
    document.getElementById("genbook-tree").style.display=""; //Was not drawn to prevent endless loop if no Bible object 
    updateXulswordButtons();
  }
   
  //If these window prefs don't yet exist and thus are to be created, the loadedXUL routine needs to 
  //have been called via a timeout in that case, so that they can be created with correct values.
  getPrefOrCreate("BibleFrameHeight","Int",document.getElementById("frameset").boxObject.height);
  getPrefOrCreate("WindowHeight","Int",window.innerHeight);
  getPrefOrCreate("WindowWidth","Int",window.innerWidth);
  
  BMDS = initBMServices();
  initTemplateDataSource(document.getElementById("bookmarks-menu"), BMDS); 
  // Cludge to get history button the right height, must happen after updating locale configuration
  document.getElementById("historymenu").style.height = String(document.getElementById("back").boxObject.height) + "px";
  //if (document.getElementById("historyButtons").getAttribute("chromedir")=="rtl") document.getElementById("historyButtons").dir = "reverse";
  
  // Order is 1,2,3 because Frame 1 has the chooser, and the chooser size must be
  // defined before any Frames can be properly sized
  // There are 3 frames, one for each Bible, and the first frame must also hold the chooser.
  // The chooser cannot be put into a separate frame, because the chooser's chapter popup menu
  // needs to extend outside the area of the chooser, over the top of the first Bible text.
  // This is impossible unless the chooser and first Bible are together in the same frame.
  if (Bible && HaveValidLocale) {
    initTabHiddenPrefs();
    var dontHideArray = [];
    if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
      dontHideArray = NewModuleInfo.NewModules;
      var w=0;
      for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
        if (w<prefs.getIntPref("NumDisplayedWindows")) w++;
        var type = getModuleLongType(NewModuleInfo.NewModules[m]);
        if (type==BIBLE) {
          for (var ww=1; ww<=prefs.getIntPref("NumDisplayedWindows"); ww++) {changeVersionPrefs(ww, NewModuleInfo.NewModules[m]);}
          break;
        }
        else changeVersionPrefs(w, NewModuleInfo.NewModules[m]);
      }
    }
    for (var i=1; i<=3; i++) {updateTabVisibility(i, dontHideArray, true);}
    FrameDocument[1].defaultView.initializeScript();
    FrameDocument[2].defaultView.initializeScript();
    FrameDocument[3].defaultView.initializeScript();
    for (var i=1; i<=3; i++) fitTabs(i);
    updateModuleMenuCheckmarks();
    updateLocators(true);
    updateChooserVisibility();
    updatePinVisibility();
    window.setTimeout("checkCipherKeys()",0);
  }
  
  if (Bible) window.setInterval(resizeWatch,1000);
  if (window.opener) {window.opener.close();} //Close splash and opener window
  
  //handle error states...
  if (HaveValidLocale && (!Bible || !TabVers.length)) window.setTimeout("errorHandler(NOMODULES)",0);
  else if (!HaveValidLocale && !RestartToChangeLocale) window.setTimeout("errorHandler(NOLOCALES)",0);
  else if (RestartToChangeLocale) window.setTimeout("errorHandler(NEEDRESTART)",0);
  else if (prefs.getCharPref("DefaultVersion")=="none") window.setTimeout("errorHandler(NOMODULES)",0);
  
  //we're ok!
  else if (Bible) window.setTimeout("updateAfterInit()", 500);
  jsdump("Initilization Complete\n");
}
    
function hideGUI() {
  var ids=["edit-menu", "view-menu", "options-menu", "bookmarks-menu", "window-menu", "help-menu", "main-controlbar", "bible1Frame", "bible2Frame", "bible3Frame"];
  for (var i=0; i<ids.length; i++) {document.getElementById(ids[i]).style.display="none";}
  
  var filemenu = document.getElementById("file-popup").firstChild;
  while (filemenu) {
    if (!filemenu.id || filemenu.id.search("keep")==-1) filemenu.style.display="none";
    filemenu = filemenu.nextSibling;
  }
}

var TreeStyleRules = [];
var BMManagerBible;
var SearchBibles = [];
var SearchBiblesOut = [];

function createSearchBible() {
  var searchBible = Components.classes["@xulsword.com/xulsword/xulsword;1"].createInstance(Components.interfaces.ixulsword);
  var mlist = Bible.getModuleList();
  if (mlist == "No Modules" || mlist.search(BIBLE)==-1) {
    searchBible=null;
    return false;
  }
  else unlockAllModules(searchBible);

  var createNewSlot = true;
  for (var i=0; i<SearchBibles.length; i++) {
    if (SearchBibles[i] == null) {
      SearchBibles[i] = searchBible;
      SearchBiblesOut[i] = false;
      createNewSlot = false;
      break;
    }
  }
  if (createNewSlot) {
    SearchBibles.push(searchBible);
    SearchBiblesOut.push(false);
  }
  return true;
}

function updateAfterInit() {
  updateFrameScriptBoxes();
  window.setTimeout("postWindowInit()", 1000);
}

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
    //var fontSizeAdjust = "font-size-adjust:" + (versionConfig && versionConfig.fontSizeAdjust ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust) + "; ";
    //var lineHeight = "line-height:" + (versionConfig && versionConfig.lineHeight ? versionConfig.lineHeight:DefaultVersionLineHeight) + "; ";
    TreeStyleRules.push("treechildren::-moz-tree-cell-text(" + info[0] + ") { " + direction + font + "}");
  }
  for (var v=0; v<LocaleList.length; v++) {
    var localeConfig = LocaleConfigs[LocaleList[v]];
    var font = "font-family:\"" + (localeConfig && localeConfig.font ? localeConfig.font:DefaultFont) + "\" !important; ";
    var direction = "direction:" + (localeConfig && localeConfig.direction ? localeConfig.direction:"ltr") + " !important; ";
    //var fontSizeAdjust = "font-size-adjust:" + (localeConfig && localeConfig.fontSizeAdjust ? localeConfig.fontSizeAdjust:DefaultFontSizeAdjust) + "; ";
    //var lineHeight = "line-height:" + (localeConfig && localeConfig.lineHeight ? localeConfig.lineHeight:DefaultVersionLineHeight) + "; ";
    TreeStyleRules.push("treechildren::-moz-tree-cell-text(" + LocaleList[v] + ") { " + direction + font + "}");
  }
  
  // Hide disabled books on chooser
  useFirstAvailableBookIf();
  disableMissingBooks(getPrefOrCreate("HideDisabledBooks", "Bool", false));
  
  BMManagerBible = Components.classes["@xulsword.com/xulsword/xulsword;1"].createInstance(Components.interfaces.ixulsword);
  var mlist = Bible.getModuleList();
  if (mlist == "No Modules" || mlist.search(BIBLE)==-1) BMManagerBible=null;
  else unlockAllModules(BMManagerBible);
  
  createSearchBible();
  
  if (NewModuleInfo && NewModuleInfo.NewLocales && NewModuleInfo.NewLocales[0]) {
    var opmenu = document.getElementById("menu.options").childNodes[0].nodeValue;
    var lamenu = document.getElementById("menu.options.language").childNodes[0].nodeValue;
    var result={};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        document.getElementById("menu.addNewModule.label").childNodes[0].nodeValue, 
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
}

function useFirstAvailableBookIf() {
  var vers = firstDisplayBible();
  var availableBooks = getAvailableBooks(vers);
  if (!availableBooks.length) return;
  var book = Bible.getBookName();
  for (var b=0; b<availableBooks.length; b++) {if (availableBooks[b]==book) break;}
  if (b<availableBooks.length) return;
  Bible.setBiblesReference(vers, availableBooks[0] + ".1.1.1");
  updateLocators(true);
  updateFrameScriptBoxes();
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
    jsdump("No locale to load. Please add a valid manifest (such as '" + DEFAULTLOCALE + ".locale.manifest') to chrome directory.\n");
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
      SBundle.getString("Title"), 
      error, 
      DLGALERT,
      DLGOK);
  window.close();
}

function identifyModuleFeatures(resetUserPrefs) {
  var f = getModuleFeatures();
  if (Bible) {
    for (var i=0; i<TabVers.length; i++) {
      if (TabVers[i]==ORIGINAL) continue;
      var fthis = getModuleFeatures(TabVers[i]);
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
      for (var t=0; t<TabVers.length; t++) {
        if (TabVers[t]==dmods[m]) features.haveDictionary=true;
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
      KeyWindow = window.openDialog("chrome://xulsword/content/getkey.xul","getkey","chrome, dependent, alwaysRaised, centerscreen, modal", CheckTexts[t], retVals);
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

function fillModuleMenuLists() {
  var moduleTypeCounts = {}
  for (var t=0; t<TabVers.length; t++) {
    var xulElement = document.createElement("menuitem");
    xulElement = writeModuleElem(xulElement, t, "label", "modulemenu", false, false, false)
    if (!xulElement) continue;
    xulElement.setAttribute("type", "checkbox");
    xulElement.setAttribute("oncommand", "handleOptions(this)");
    xulElement.setAttribute("autocheck","false");
    
    for (var type in SupportedModuleTypes) {
      if (TabLongType[t]!=SupportedModuleTypes[type]) continue;
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

function writeLocaleElem(elem, lc, id, noAccessKey) {
  var myID = LocaleList[lc];
  if (id) myID = id + "." + myID;
  // The following has been removed in v2.12 because it was deemed better to
  // always have each language menu item appear in it's language/font/etc. There
  // is no reason to translate language items since if the user cannot read
  // the label he/she should certainly not switch the program into that language.
  // Plus, if a user does open the program in a language he/she doesn't know and 
  // opens the language menu, the language items would also not be understood.
  // So, it is far better if the user can see each item in its own language! 
  /*
  try {
    var myLabel = SBundle.getString(LocaleList[lc] + "LanguageMenuLabel");
    var myAccKey = SBundle.getString(LocaleList[lc] + "LanguageMenuAccKey");
    var myLocale = rootprefs.getCharPref("general.useragent.locale");
  }
  catch (er) { 
    var bundle = getLocaleBundle(LocaleList[lc], "xulsword.properties");
    if (!bundle) return null;
    myLabel = bundle.GetStringFromName("LanguageMenuLabel");
    myAccKey = bundle.GetStringFromName("LanguageMenuAccKey");
    myLocale = LocaleList[lc];
  }
  */
  
  var bundle = getLocaleBundle(LocaleList[lc], "xulsword.properties");
  if (!bundle) return null;
  var myLabel = bundle.GetStringFromName("LanguageMenuLabel");
  var myAccKey = bundle.GetStringFromName("LanguageMenuAccKey");
  var myLocale = LocaleList[lc];
    
  elem.setAttribute("label", myLabel);
  if (!noAccessKey) elem.setAttribute("accesskey", myAccKey);
  elem.setAttribute("id", myID);
  var localeConfig = LocaleConfigs[myLocale];
  var myfont = (localeConfig && localeConfig.font && !isASCII(myLabel) ? localeConfig.font:DefaultFont);
  var myfontSizeAdjust = (localeConfig && localeConfig.fontSizeAdjust && !isASCII(myLabel) ? localeConfig.fontSizeAdjust:DefaultFontSizeAdjust);
  var mylineHeight = (localeConfig && localeConfig.lineHeight ? localeConfig.lineHeight:DefaultLocaleLineHeight);
  elem.style.fontFamily = "\"" + myfont + "\"";
  elem.style.fontSizeAdjust = myfontSizeAdjust;
  elem.style.lineHeight = mylineHeight;
  return elem;
}

function writeModuleElem(elem, t, attrib, id, skipORIG, noDescription, forceDefaultFormatting) {
  if (!forceDefaultFormatting) forceDefaultFormatting=false;
  var desc = "";
  if (TabVers[t]==ORIGINAL) {
    if (skipORIG) return null;
  }
  else if (!noDescription) {
    desc = Bible.getModuleInformation(TabVers[t], "Description");
    if (desc==NOTFOUND) desc="";
    else desc = " --- " + desc;
  }
  
  forceDefaultFormatting |= (Bible.getModuleInformation(TabVers[t], "OriginalTabTestament")!=NOTFOUND);
  
  var dirChar=String.fromCharCode(8206);
  if (!forceDefaultFormatting) {
    var versionConfig = VersionConfigs[TabVers[t]];
    var myfont = (versionConfig && versionConfig.font && !isASCII(TabLabel[t]) ? versionConfig.font:DefaultFont);
    var myfontSizeAdjust = (versionConfig && versionConfig.fontSizeAdjust && !isASCII(TabLabel[t]) ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust);
    dirChar = (versionConfig && versionConfig.direction && versionConfig.direction == "rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));
  }
  else {
    myfont = DefaultFont;
    myfontSizeAdjust = DefaultFontSizeAdjust;
    dirChar = String.fromCharCode(8206);  
  }
  elem.style.fontFamily = "\"" + myfont + "\"";
  elem.style.fontSizeAdjust = myfontSizeAdjust;
  
  elem.setAttribute(attrib, TabLabel[t] + desc + dirChar);
  elem.setAttribute("id", id + "." + String(t));
  
  return elem;
}
/************************************************************************
 * Hot keys...
 ***********************************************************************/  
function keypress(e) { // Watch for return key on search textbox, and search if pressed...
  if ((e.target.id=="searchText")&&(e.keyCode==13)) {goDoCommand("cmd_xs_searchFromTextBox");}
}

/************************************************************************
 * History Functions/Buttons
 ***********************************************************************/ 
function historyBack() {
  if (Historyi <= 0) return;
  // If we've clicked back, make sure the current location has been added to history first!
  try {window.clearTimeout(HistoryTimer);} catch(er){}
  addToHistory();
  Historyi--;
  updateScriptToHistory(Historyi);
}

function historyForward() {
  if (Historyi >= HistoryDepth) return;
  Historyi++;
  updateScriptToHistory(Historyi);
}

function updateScriptToHistory(index) {
  //setBibleToHistory(index);
  var refBible = firstDisplayBible();
  var loc = Bible.convertLocation(WESTERNVS, History[index] + ".1", Bible.getVerseSystem(refBible));
  Bible.setBiblesReference(refBible, loc);
  document.getElementById("book").book = Bible.getBookName();
  document.getElementById("book").version = refBible;
  document.getElementById("chapter").value = Bible.getChapterNumber(refBible);
  document.getElementById("verse").value = Bible.getVerseNumber(refBible);  
  updateFromNavigator();
  goUpdateCommand("cmd_xs_forward");
  goUpdateCommand("cmd_xs_back");
}

function createHistoryMenu(aEvent) {
  var popup = aEvent.target;
  // clear out the old context menu contents (if any)
  while (popup.hasChildNodes()) 
    popup.removeChild(popup.firstChild);
  // Show history in verse system of firstDisplayBible(), save current Bible location and restore it after creating menu
  var vers = firstDisplayBible();
  for (var i=0; i<History.length; i++) {
    var xulElement = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
    xulElement.setAttribute("oncommand", "goToHistoryIndex('" + i + "')");
    var aref = Bible.convertLocation(WESTERNVS, History[i], Bible.getVerseSystem(vers));
    aref = aref.split(".");
    xulElement.setAttribute("label", Book[findBookNum(aref[0])].bNameL + " " + aref[1] + ":" + LocaleDirectionChar + aref[2]);
    //if (i == Historyi) {xulElement.style.background="rgb(230,200,255)";}
    popup.appendChild(xulElement);  
  }
}

//When something is selected from the menulist, this routine processes the selection
function goToHistoryIndex(index) {
    Historyi = index;
    var toFront = History[Historyi];  // save chosen entry
    History.splice(Historyi,1);   // delete chosen entry
    History.push(toFront);        // append chosen entry to front
    Historyi = History.length-1;  // update Historyi to point to moved entry
    
    updateScriptToHistory(Historyi);
}

/************************************************************************
 * Bible Navagator...
 ***********************************************************************/ 
function onRefUserUpdate(event, location, version) {
  location = location.split(".");
  var newloc = {shortName:location[0], chapter:location[1], verse:location[2], lastVerse:location[3]}
  updateToNewLocation(newloc);
}
 
function updateToNewLocation(loc) {
  if (loc==null) {return;}
  var numberOfSelectedVerses=1;
  if (loc.shortName) {
    document.getElementById("book").book = loc.shortName;
    document.getElementById("book").version = firstDisplayBible();
  }
  if (loc.chapter)   {document.getElementById("chapter").value = String(loc.chapter);}
  if (loc.verse)     {document.getElementById("verse").value = String(loc.verse);}
  if (loc.lastVerse) {numberOfSelectedVerses = loc.lastVerse - loc.verse + 1;}
  updateFromNavigator(numberOfSelectedVerses);
}

function updateFromNavigator(numberOfSelectedVerses) {
  var fail=false;
  if (numberOfSelectedVerses == null) {numberOfSelectedVerses = 1;}
  
  var myb = document.getElementById("book").book;
  var myversion = document.getElementById("book").version;
  var myc = Number(document.getElementById("chapter").value);
  if (isNaN(myc)) {myc=1; document.getElementById("chapter").value=myc;}
  var myv = Number(document.getElementById("verse").value);
  if (isNaN(myv)) {myv=1; document.getElementById("verse").value=myv;}
  
  //check book
  var mybn = findBookNum(myb);
  if (mybn == null) {fail=true;}
  
  //force chapter to boundary if over in either direction
  if (myc < 1) {myc=1;}
  if (myc > Book[mybn].numChaps) {myc=Book[mybn].numChaps;}
  
  if (!fail) {Bible.setBiblesReference(myversion, Book[mybn].sName + "." + myc);}
  
  //check verse is not necessary since sending XPCOM Bible an illegal verse number will result in return of the appropriate boundary (1 or max verse)
  Bible.setVerse(myversion, myv, myv+numberOfSelectedVerses-1);
  
  // Update BIBLES and COMMENTARIES
  var updateNeeded = [false, false, false, false];
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var mytype =  getModuleLongType(prefs.getCharPref("Version" + w));
    if (mytype == BIBLE || mytype == COMMENTARY) updateNeeded[w] = true;
  }
  updateFrameScriptBoxes(updateNeeded,true,true);
  updateLocators(false);
}

function previousChapter(showLastVerseFlag, pin) {
  var vers = (pin ? pin.version:firstDisplayBible());
  var bkn = findBookNum(pin ? pin.shortName:Bible.getBookName());
  var chn = (pin ? pin.chapter:Bible.getChapterNumber(vers));
  
  if (chn > 1) {chn--;}
  else if (bkn > 0) {bkn--; chn = Book[bkn].numChaps;}
  
  if (!pin) {
    Bible.setBiblesReference(vers, Book[bkn].sName + " " + chn);
    if (showLastVerseFlag) {
      Bible.setVerse(vers, LAST_VERSE_IN_CHAPTER, LAST_VERSE_IN_CHAPTER);
      updateFrameScriptBoxes(getUnpinnedWindows(),true,true);
    }
    else {
      Bible.setVerse(vers, 1, 1);
      updateFrameScriptBoxes(getUnpinnedWindows(),true,false);
    }
    updateLocators(false);
  }
  else {
    pin.shortName = Book[bkn].sName;
    pin.chapter = chn
    pin.verse = Bible.getMaxVerse(vers, Book[bkn].sName + " " + chn);
    pin.version = vers;
  }
  
  return (pin ? pin:true);
}

function previousPage(showLastVerseFlag, pin) {
  var locNew = getPassageOfLink(false);
  if (!locNew) {
    if (!pin) {
      previousChapter(showLastVerseFlag);
      return true;
    }
    else {
      previousChapter(showLastVerseFlag, pin);
      return pin;
    }
  }
  locNew = locNew.split(".");
  var vers = locNew[4];
  var bk = locNew[0];
  var bkn = findBookNum(locNew[0]);
  var ch = Number(locNew[1]);
  var v = Number(locNew[2]);
  if (ch==1 && v==1) {
    if (!pin) {
      Bible.setBiblesReference(vers, bk + "." + ch + "." + v);
      previousChapter(showLastVerseFlag);
      return true;
    }
    else {
      pin.shortName = bk;
      pin.chapter = ch
      pin.verse = v;
      pin.version = vers;
      previousChapter(showLastVerseFlag, pin);
      return pin;
    }
  }

  v--;
  if (v < 1) {
    ch--;
    v = Bible.getMaxVerse(vers, bk + "." + ch);
  }

  if (!pin) {
    Bible.setBiblesReference(vers, bk + "." + ch + "." + v);
    updateFrameScriptBoxes(getUnpinnedWindows(),true,showLastVerseFlag,false,false,SCROLLTYPEEND);
    updateLocators(false);
  }
  else {
    pin.shortName = bk;
    pin.chapter = ch
    pin.verse = v;
    pin.version = vers;
  }
  
  return (pin ? pin:true);
}

/*
function getPassageOfLink(forNextPage) {
  var text = FrameDocument[2].defaultView.ScriptBoxTextElement.innerHTML;
  var vers = prefs.getCharPref("Version2");
  var passage;
  var verseID = new RegExp("id=\"vs\\.([^\\.]*)\\.(\\d+)\\.(\\d+)\"");
  if (forNextPage) passage = text.match(verseID);
  else {
    passage = text.lastIndexOf(Vtext1);
    passage = text.substr(passage).match(verseID);
  }

  if (!passage) return null;
  passage.push(passage[passage.length-1]);
  passage.push(vers);
  passage.shift();
  return passage.join(".");
}
*/

function getPassageOfLink(getLast) {
  var links = getLinkArray();
  var text = "";
  var last = false;
  for (var w=1; w<=3; w++) {
    if (links[w]==true || last) {
      if (prefs.getBoolPref("MaximizeNoteBox" + w)) continue;
      var vers = prefs.getCharPref("Version" + w);
      var vconfig = VersionConfigs[vers];
      if (vconfig && vconfig.direction && vconfig.direction=="rtl") text = FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML + text;
      else text = text + FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML;
    }
    last = links[w];
  }
  var passage;
  var verseID = new RegExp("id=\"vs\\.([^\\.]*)\\.(\\d+)\\.(\\d+)\"");
  if (!getLast) passage = text.match(verseID);
  else {
    passage = text.lastIndexOf(Vtext1);
    passage = text.substr(passage).match(verseID);
  }
  
  if (!passage) return null;
  passage.push(passage[passage.length-1]);
  passage.push(vers);
  passage.shift();
  return passage.join(".");
}

function nextChapter(showFirstVerseFlag, pin) {
  var vers = (pin ? pin.version:firstDisplayBible());
  var bkn = findBookNum(pin ? pin.shortName:Bible.getBookName());
  var chn = (pin ? pin.chapter:Bible.getChapterNumber(vers));
  
  if (chn < Book[bkn].numChaps) {chn++;}
  else if (bkn < (NumBooks-1)) {bkn++; chn=1;}
  
  if (!pin) {
    Bible.setBiblesReference(vers, Book[bkn].sName + "." + chn + ".1");
    updateFrameScriptBoxes(getUnpinnedWindows(),true,showFirstVerseFlag,showFirstVerseFlag);
    updateLocators(false);
  }
  else {
    pin.shortName = Book[bkn].sName;
    pin.chapter = chn
    pin.verse = 1;
    pin.version = vers;
  }

  return (pin ? pin:true);
}

function nextPage(showFirstVerseFlag, pin) {
  var locNew = getPassageOfLink(true);
  if (!locNew) {
    if (!pin) {
      nextChapter(showLastVerseFlag);
      return true;
    }
    else {
      nextChapter(showLastVerseFlag, pin);
      return pin;
    }
  }
    
  locNew = locNew.split(".");
  var vers = locNew[4];
  var bk = locNew[0];
  var bkn = findBookNum(locNew[0]);
  var ch = Number(locNew[1]);
  var v = Number(locNew[2]);
  var maxv = Bible.getMaxVerse(vers, bk + "." + ch);
  if (ch==Book[bkn].numChaps && v==maxv) {
    if (!pin) {
      Bible.setBiblesReference(vers, bk + "." + ch + "." + v);
      nextChapter(showFirstVerseFlag);
      return true;
    }
    else {
      pin.shortName = bk;
      pin.chapter = ch
      pin.verse = v;
      pin.version = vers;
      nextChapter(showFirstVerseFlag, pin);
      return pin;
    }
  }

  v++;
  if (v > maxv) {
    v = 1;
    ch++;
  }
  
  if (!pin) {
    Bible.setBiblesReference(vers, bk + "." + ch + "." + v);
    updateFrameScriptBoxes(getUnpinnedWindows(),true,showFirstVerseFlag,false,false,SCROLLTYPEBEG);
    updateLocators(false);
  }
  else {
    pin.shortName = bk;
    pin.chapter = ch
    pin.verse = v;
    pin.version = vers;
  }

  return (pin ? pin:true);
}

function nextVerse() {
 // Set Version/Chapter such that we get verse/versification of window1 set up correctly
  var vers = firstDisplayBible();
  var cv = Bible.getVerseNumber(vers);
  if (cv < Bible.getMaxVerse(vers, Bible.getLocation(vers))) {selectVerse(vers, cv+1);}
  else if (findBookNum(Bible.getBookName()) <= NumBooks-1) {
    Bible.setVerse(vers, 1, 1); 
    nextChapter(true);
  }
}

function previousVerse() {
 // Set Version/Chapter so that setVerse corresponds to the verse/versification of window1
  var vers = firstDisplayBible();
  var cv = Bible.getVerseNumber(vers);
  cv--;
  if ((cv==0)&&(findBookNum(Bible.getBookName()) >= 0)) {previousChapter(true);}
  else {selectVerse(vers, cv);}
}

function showNextBook() {
  var vers = firstDisplayBible();
  var bkn = findBookNum(Bible.getBookName());
  if (bkn < NumBooks-1) {
    bkn++;
    Bible.setBiblesReference(vers, Book[bkn].sName + ".1.1");
    updateFrameScriptBoxes(getUnpinnedWindows(),true,false);
    updateLocators(false); 
  }
}

function showPreviousBook() {
  var vers = firstDisplayBible();
  var bkn = findBookNum(Bible.getBookName());
  if (bkn > 0) {
    bkn--;
    Bible.setBiblesReference(vers, Book[bkn].sName + ".1.1");
    updateFrameScriptBoxes(getUnpinnedWindows(),true,false);
    updateLocators(false); 
  }
}

function selectVerse(version, vs, lastvs, chapter) {
  if (!chapter) chapter = Bible.getChapterNumber(version);
  var updateNeeded = getUnpinnedWindows();
  var redrawNeeded = changeVerseTo(version, vs, lastvs, updateNeeded);
  updateFrameScriptBoxes(redrawNeeded,true,true,true);
  highlightSelectedVerses(updateNeeded);
  updateLocators(false); 
}

function changeVerseTo(version, vs, lastvs, updateNeeded) {
  if (!lastvs) lastvs = vs;
  var fullDrawNeeded = [false, false, false, false];
  var chaps = [0,0,0,0];
  for (var w=1; w<=3; w++) {
    if (!updateNeeded[w]) continue;
    var wvers = prefs.getCharPref("Version" + w);
    if (getModuleLongType(wvers)!=BIBLE) continue;
    chaps[w] = Bible.getChapterNumber(wvers);
  }
  Bible.setVerse(version, vs, lastvs);
  for (w=1; w<=3; w++) {
    if (!updateNeeded[w]) continue;
    var wvers = prefs.getCharPref("Version" + w);
    if (getModuleLongType(wvers)!=BIBLE) continue;
    if (Bible.getChapterNumber(wvers)!=chaps[w]) fullDrawNeeded[w] = true;
    // full draw is needed if page has red-words-of-Christ because "highlightSelectedVerses" cannot overwrite RWOC.
    if (FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML.search(REDWORDS)!=-1) fullDrawNeeded[w] = true;
    // full draw is needed if window is in interlinear mode.
    if (prefs.getBoolPref("ShowOriginal" + w)) fullDrawNeeded[w] = true;
    if (fullDrawNeeded[w]==true) updateNeeded[w]=false;
  }
  return fullDrawNeeded;
}

function highlightSelectedVerses(updateNeededArray, dontScroll) {
  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  for (var w=1; w<updateNeededArray.length; w++) {
    if (!updateNeededArray[w]) continue;
    var myvers = prefs.getCharPref("Version" + w);
    FrameDocument[w].defaultView.SelectedVerseCSS.style.color="blue"; //FrameDocument[w].defaultView.SelectedVerseColor;
    var oldsel = FrameDocument[w].getElementById("sv");
    if (oldsel) oldsel.removeAttribute("id");
    var selem = FrameDocument[w].createElement("span");
    selem.className="hl";
    var fv = Bible.getVerseNumber(myvers);
    var lv = Bible.getLastVerseNumber(myvers);
    var mv = Bible.getMaxVerse(myvers, Bible.getLocation(myvers));
    for (var v=1; v<=mv; v++) {
      var velem = FrameDocument[w].getElementById("vs." + Bible.getBookName() + "." + Bible.getChapterNumber(myvers) + "." + v);
      if (!velem) continue;
      if (v<fv) removeHL(velem);
      else if (v==fv) {
        var nelem = selem.cloneNode(true);
        nelem.id="sv";
        addHL(velem, nelem);
      }
      else if (v>fv && v<=lv) addHL(velem, selem.cloneNode(true));
      else {removeHL(velem);}
    }
  }
  if (!dontScroll) window.setTimeout("scrollScriptBoxes(false, [" + updateNeededArray + "]);", 1);
}

function removeHL(velem) {
  var aSpan = velem.firstChild;
  if (!aSpan || !aSpan.className || aSpan.className.search(/(^|\s)hl(\s|$)/i)==-1) return;
  while (aSpan.firstChild) {
    var move = aSpan.removeChild(aSpan.firstChild);
    aSpan.parentNode.appendChild(move);
  }
  aSpan.parentNode.removeChild(aSpan);
}

function addHL(velem, aSpan) {
  if (!aSpan || !velem.firstChild) return;
  if (velem.firstChild.className && velem.firstChild.className.search(/(^|\s)hl(\s|$)/i)!=-1) return;
  velem.insertBefore(aSpan, velem.firstChild);
  while (velem.firstChild.nextSibling) {
    var move = velem.firstChild.nextSibling;
    aSpan.appendChild(move);
  }
}

/************************************************************************
 * Main Command Controller...
 ***********************************************************************/
var SearchWins = [];
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
      updateFrameScriptBoxes(null,false,true);
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
      updateFrameScriptBoxes(null,false,true);
      break;
    case "cmd_xs_search":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", CONTAINS_THE_WORDS) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):CONTAINS_THE_WORDS);
      prefs.setIntPref("InitialSearchType", tp);
      SearchWins.push(window.open("chrome://xulsword/content/search.xul","Swn"+SearchWins.length,"chrome,resizable"));
      break;
    case "cmd_xs_searchFromTextBox":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", CONTAINS_THE_WORDS) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):CONTAINS_THE_WORDS);
      prefs.setIntPref("InitialSearchType", tp);
      prefs.setCharPref("SearchVersion",firstDisplayModule());
      setUnicodePref("SearchText",document.getElementById('searchText').value);
      SearchWins.push(window.open("chrome://xulsword/content/search.xul","Swn"+SearchWins.length,"chrome,resizable"));
      break;
    case "cmd_xs_searchForSelection":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", EXACT_TEXT) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):EXACT_TEXT);
      prefs.setIntPref("InitialSearchType", tp);
      prefs.setCharPref("SearchVersion",CurrentTarget.version);
      setUnicodePref("SearchText",getMainWindowSelection());
      SearchWins.push(window.open("chrome://xulsword/content/search.xul","Swn"+SearchWins.length,"chrome,resizable"));
      break;
    case "cmd_xs_openFromSelection":
      updateToNewLocation(this.parsedLocation);
      break;
    case "cmd_xs_newBookmark":
      BookmarkFuns.addBookmarkAs(CurrentTarget, false);
      break;
    case "cmd_xs_newUserNote":
      BookmarkFuns.addBookmarkAs(CurrentTarget, true);
      break;
    case "cmd_xs_selectVerse":
      document.getElementById("verse").value = CurrentTarget.verse;
      selectVerse(CurrentTarget.version, CurrentTarget.verse, CurrentTarget.lastVerse, CurrentTarget.chapter);
      break;
    case "cmd_xs_back":
      historyBack();
      break;
    case "cmd_xs_forward":
      historyForward();
      break;
    case "cmd_xs_nextChapter":
      nextChapter(false);
      break;
    case "cmd_xs_previousChapter":
      previousChapter(false);
      break;
    case "cmd_xs_nextVerse":
      nextVerse();
      break;
    case "cmd_xs_previousVerse":
      previousVerse();
      break;
    case "cmd_xs_navigatorUpdate":
      updateFromNavigator();
      break;
    case "cmd_xs_openManager":
      ManagerWindow = toOpenWindowByType("bookmarks:manager", "chrome://xulsword/content/bookmarks/bookmarksManager.xul", "chrome,resizable");
      break;
    case "cmd_xs_toggleTab":
      var preChangeLinkArray = getLinkArray();
      var isNowVisible = toggleTabVisibility(CurrentTarget.tabNum, CurrentTarget.windowNum);
      if (updateTabVisibility(CurrentTarget.windowNum, (isNowVisible ? [TabVers[CurrentTarget.tabNum]]:null))) {
        updatePinVisibility();
        resizeScriptBoxes(getUpdatesNeededArray(CurrentTarget.windowNum, preChangeLinkArray));
      }
      break;
    case "cmd_xs_aboutModule":
      AboutScrollTo = TabVers[CurrentTarget.tabNum];
      AboutScreen = window.open("chrome://xulsword/content/about.xul","splash","chrome,modal,centerscreen");
      break;
    case "cmd_xs_addNewModule":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!addNewModule()) ModuleCopyMutex=false;
      break;
    case "cmd_xs_removeModule":
      window.open("chrome://xulsword/content/removeModule.xul",document.getElementById("menu.removeModule.label").childNodes[0].nodeValue,"chrome,modal");
      break;
    case "cmd_xs_exportAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!exportAudio()) ModuleCopyMutex=false;
      break;
    case "cmd_xs_importAudio":
      ModuleCopyMutex=true; //insures other module functions are blocked during this operation
      if (!importAudio()) ModuleCopyMutex=false;
      break;
    }
  },
  
  isCommandEnabled: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
      return (gTxnSvc.numberOfUndoItems > 0);
    case "cmd_redo":
      return (gTxnSvc.numberOfRedoItems > 0);
    case "cmd_xs_searchFromTextBox":
      var ct = document.getElementById('searchText').value
      return (ct.length > 0);
    case "cmd_xs_searchForSelection":
      return (getMainWindowSelection()!="" && CurrentTarget.version!="");
    case "cmd_xs_forward":
      return (Historyi < History.length-1);
    case "cmd_xs_back":
      return (Historyi > 0);
    case "cmd_xs_openFromSelection":
      var selt = getMainWindowSelection();
      this.parsedLocation = parseLocation(selt.substr(0,64));
      return this.parsedLocation ? true:false;
    case "cmd_xs_toggleTab":
      if (ScriptBoxIsEmpty[CurrentTarget.windowNum]) return false;
      if (CurrentTarget.windowNum && FrameDocument[CurrentTarget.windowNum].defaultView.FrameIsPinned) return false;
      return true;
    case "cmd_xs_aboutModule":
      if (ScriptBoxIsEmpty[CurrentTarget.windowNum]) return false;
      break;
    case "cmd_xs_exportAudio":
      if (ModuleCopyMutex) return false;
      if (!AudioDirs || !AudioDirs.length) return false;
      if (AudioDirs.length>1 || AudioRegKeyIndex==-1) return true;
      var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      aFile.initWithPath(AudioDirs[AudioRegKeyIndex]);
      return aFile.exists();
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
    case "cmd_xs_nextChapter":
    case "cmd_xs_previousChapter":
    case "cmd_xs_nextVerse":
    case "cmd_xs_previousVerse":
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
    selob = document.getElementById("bible" + String(w) + "Frame").contentDocument.defaultView.getSelection();
    if (!selob.isCollapsed) {return selob;}
  }
  return null;
}

//Sets view->Show... prefs
function handleViewPopup(elem) {
  var val=elem.getAttribute('value');
  var vals=val.split("_");
  prefs.setBoolPref(vals[0],(vals[1]=="1" ? true:false));
  updateFrameScriptBoxes(null,false,true);
}

var AboutScreen; 
function handleOptions(elem) {
  var id = String(elem.id + ".").split(".");
  id.pop();
  switch (id[0]) {
    case "w1":
    case "w2":
    case "w3":
      setPinOfLink(); // Unpin everything before changing windows
      var newval = Number(elem.id.substr(1,1));
      // If new window(s) are opening- tabs and version is same as left
      for (var w=prefs.getIntPref("NumDisplayedWindows")+1; w<=newval; w++) {
        for (var shortType in SupportedModuleTypes) {
          prefs.setCharPref("Hidden" + shortType + w, prefs.getCharPref("Hidden" + shortType + (w-1)));
        }
        changeVersionPrefs(w, prefs.getCharPref("Version" + (w-1)));
      }
      prefs.setIntPref("NumDisplayedWindows", Number(elem.id.substr(1,1)));
      for (w=1; w<=3; w++) {updateTabVisibility(w, [prefs.getCharPref("Version" + w)]);}
      updatePinVisibility();
      updateVersionTabs();
      resizeScriptBoxes(); //Will also display correct frames
      break;
        
    case "f0":
    case "f1":
    case "f2":
    case "f3":
    case "f4":
      prefs.setIntPref("FontSize",2*(Number(elem.id.substr(1,1)) - 2));
      FrameDocument[1].defaultView.updateFontSizes();
      FrameDocument[2].defaultView.updateFontSizes();
      FrameDocument[3].defaultView.updateFontSizes();
      updateFrameScriptBoxes();
      break;
    
    case "about":
      AboutScreen = window.open("chrome://xulsword/content/about.xul","splash","chrome,modal,centerscreen");
      break;
      
    case "modulemenu":
      var oldCheckedValue = (elem.getAttribute("checked") == "true");
      elem.setAttribute("checked", (oldCheckedValue ? "false":"true"));
    case "showAllTabs":
    case "showNoTabs":
      if (RedrawAfterModuleMenuSelect) MainWindow.clearTimeout(RedrawAfterModuleMenuSelect);
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
      MainWindow.setTimeout("document.getElementById('view-popup').showPopup(); document.getElementById('sub-" + id[2] + "-pup').showPopup()", 0);
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

var RedrawAfterModuleMenuSelect;
function moduleMenuClick1(id, tabNum, subPupId, oldCheckedValue) {
  var dontHideArray = [];
  document.getElementById("view-popup").showPopup();
  document.getElementById("sub-" + subPupId + "-pup").showPopup();
  var rs = getRadioSelection(subPupId);
  var aWindowNum = rs;
  if (aWindowNum <= 3) var sw=aWindowNum;
  else {sw=1; aWindowNum=prefs.getIntPref("NumDisplayedWindows");}
  for (var i=sw; i<=aWindowNum; i++) {
    switch (id) {
    case "modulemenu":
      var isTabVisible = isTabVersionVisible(tabNum, i);
      var doToggle = (isTabVisible == oldCheckedValue);
      if (doToggle && TabVers[tabNum] && !isTabVisible) dontHideArray.push(TabVers[tabNum]);
      if (doToggle) toggleTabVisibility(tabNum, i);
      break;
    case "showAllTabs":
    case "showNoTabs":
      var moduletype = SupportedModuleTypes[subPupId];
      if (!moduletype) return;
      for (var t=0; t<TabVers.length; t++) {
        if (TabLongType[t] != moduletype) continue;
        if (id=="showAllTabs") dontHideArray.push(TabVers[t]);
        var toggleMe = (id=="showNoTabs" ? isTabVersionVisible(t, i):!isTabVersionVisible(t, i));
        if (toggleMe) toggleTabVisibility(t, i);
      }
      break;
    }
  }
  updateModuleMenuCheckmarks();
  if (rs <= 3) var sw=aWindowNum;
  else {sw=1; rs=3;}
  var needRedraw = false;
  var wins = prefs.getIntPref("NumDisplayedWindows");
  for (var i=sw; i<=rs; i++) {
    if (i>wins) break; 
    needRedraw |= updateTabVisibility(i, dontHideArray);
  }
  if (needRedraw) {
    updatePinVisibility();
    resizeScriptBoxes();
  }

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
  if (newLocale == rootPrefBranch.getCharPref("general.useragent.locale")) return;
  rootPrefBranch.setCharPref("general.useragent.locale",newLocale);
  
  setGlobalDirectionPrefs();
  
  windowLocationReload();
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
    try {Bible.setGlobalOption(GlobalToggleCommands[cmd],prefs.getCharPref(GlobalToggleCommands[cmd]));} catch (er) {}
  }
  // Menu Checkboxes
  var myLocale = Components.classes["@mozilla.org/preferences-service;1"].
                 getService(Components.interfaces.nsIPrefBranch).
                 getCharPref("general.useragent.locale");
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

  goUpdateCommand("cmd_xs_forward");
  goUpdateCommand("cmd_xs_back");
  goUpdateCommand("cmd_bm_properties");
  goUpdateCommand("cmd_xs_searchFromTextBox");
  goUpdateCommand("cmd_xs_searchForSelection");
  goUpdateTargetLocation();
}

//Tabs are html and not XUL, but we want XUL tool tips to appear above them (for
//consistency). These routines allow that...
var ShowTabToolTip, HideTabToolTip;
function openTabToolTip(tabNum, frame, cX, cY) {
  if (!document.getElementById('tabTT')) return;
  document.getElementById('tabTT').hidePopup();
  var modName = TabVers[tabNum];
  if (modName == ORIGINAL) modName = resolveOriginalVersion(Bible.getBookName());
  if (!modName) return;
  
  var desc = Bible.getModuleInformation(modName, "Description");
  if (!desc || desc==NOTFOUND) return;
  desc = desc.substr(0, TOOLTIP_LEN);
  if (desc.length==TOOLTIP_LEN) desc += "...";
  var label = document.getElementById("tabTTL");
  label.setAttribute("class", "vstyle" + modName);
  label.setAttribute("value", desc);
  if (ShowTabToolTip) window.clearTimeout(ShowTabToolTip);
  if (HideTabToolTip) window.clearTimeout(HideTabToolTip);
  cX += document.getElementById("bible" + frame + "Frame").boxObject.x;
  ShowTabToolTip = window.setTimeout("document.getElementById('tabTT').openPopup(document.getElementById('frameset'), 'after_pointer', " + cX + ", " + cY + ");", 500);
  HideTabToolTip = window.setTimeout("document.getElementById('tabTT').hidePopup();", 5000);
}

function closeTabToolTip() {
  window.clearTimeout(ShowTabToolTip);
  window.clearTimeout(HideTabToolTip);
  document.getElementById('tabTT').hidePopup();
}


/************************************************************************
 * Repetative Functions...
 ***********************************************************************/ 
//Watch for new history entries
function addToHistory() {
  var bcvH = History[Historyi].split(".");
  var bcvN = new Array(3);
  // Always store as SAME versification!
  var aVersion = prefs.getCharPref("DefaultVersion");
  var loc = Bible.convertLocation(Bible.getVerseSystem(aVersion), Bible.getLocation(aVersion), WESTERNVS).split(".");
  bcvN[0] = loc[0];
  bcvN[1] = loc[1];
  bcvN[2] = loc[2];
  // Check to see if book or chapter is different than last saved history
  if ((bcvN[0] != bcvH[0]) || (bcvN[1] != bcvH[1])) {
    // If so, then record this as a new history entry
    Historyi++;
    if (Historyi == HistoryDepth) {
      History.shift(); 
      Historyi--;
    }
    History.splice(Historyi,(HistoryDepth-Historyi),bcvN.join("."));
      
    //update buttons
    goUpdateCommand("cmd_xs_forward");
    goUpdateCommand("cmd_xs_back");
  }
  // If book/chap is same as history, but verse is different, then update verse number in current history, but don't create new history entry
  else if ((bcvN[2] != bcvH[2])) {History[Historyi] = bcvN.join(".");}
}

//Watch for window resize
function resizeWatch() {
  if (window.innerHeight==0 && window.innerWidth==0) return; // This happens when window is minimized!!!
  // If window has been resized
  if (window.innerHeight!=prefs.getIntPref("WindowHeight") || window.innerWidth!=prefs.getIntPref("WindowWidth")) {
    prefs.setIntPref("WindowHeight",window.innerHeight);
    prefs.setIntPref("WindowWidth",window.innerWidth);
    resizeScriptBoxes();
  }
}

/************************************************************************
 * Context Menu functions
 ***********************************************************************/ 
var ContextMenuShowing;
var CurrentTarget = {};
//var TargParagraph;

function ScriptContextMenuShowing(e) {
jsdump ("ScriptContextMenuShowing id:" + document.popupNode.id + ", title:" + document.popupNode.title + "\n");
  closeTabToolTip()
  CurrentTarget.windowNum = Number(document.popupNode.ownerDocument.defaultView.frameElement.id.substr(5,1));

  // Close Script Popup if we're not over it
  var elem = document.popupNode;
  while (elem && elem.id != "npopup") {elem = elem.parentNode;}
  if (!elem) {
    FrameDocument[CurrentTarget.windowNum].defaultView.closePopup();
  }
  
  // Is this the select tab?
  if (document.popupNode.id == "seltab") {
    CurrentTarget.tabNum = moduleName2TabIndex(tabLabel2ModuleName(document.popupNode.value));
    buildPopup(e, false, false, false, true, true);
    return;
  }
  // Is this a version tab?
  if (document.popupNode.id.search(/tab\d+/)!=-1) {
    CurrentTarget.tabNum = document.popupNode.id.match(/tab(\d+)/)[1];
    buildPopup(e, false, false, false, true, true);
    return;
  }
  
  // Is mouse over a word with strong's numbers?
  var selem = document.popupNode;
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
  var contextTargs = getTargetsFromElement(document.popupNode);
  if (contextTargs==null) {e.preventDefault(); return;}
  var selob = getMainWindowSelectionObject();
  if (selob) {
    contextTargs = getTargetsFromSelection(selob);
    if (contextTargs==null) {e.preventDefault(); return;}
    isSelection=true;
  }
  
//jsdump(contextTargs.shortName + " " + contextTargs.chapter + ":" + contextTargs.verse + "-" + contextTargs.lastVerse + ", res=" + contextTargs.resource);
   
  // Set Global Target variables
  var myModuleName = prefs.getCharPref("Version" + document.popupNode.ownerDocument.defaultView.frameElement.id.substr(5,1));
  CurrentTarget.version = contextTargs.version ? contextTargs.version:myModuleName;
  CurrentTarget.tabNum = moduleName2TabIndex(CurrentTarget.version);
  switch (getModuleLongType(myModuleName)) {
  case BIBLE:
  case COMMENTARY:
    CurrentTarget.shortName = (contextTargs.shortName ? contextTargs.shortName:document.popupNode.ownerDocument.defaultView.BookOfFrame);
    CurrentTarget.chapter = (contextTargs.chapter ? contextTargs.chapter:document.popupNode.ownerDocument.defaultView.ChapterOfFrame);
    CurrentTarget.verse = contextTargs.verse;
    CurrentTarget.lastVerse = contextTargs.lastVerse;
    break;
  case DICTIONARY:
  case GENBOOK:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("ShowingKey" + myModuleName, "Unicode", "");
    CurrentTarget.verse = contextTargs.paragraph;
    CurrentTarget.lastVerse = contextTargs.paragraph;
    break;
  }
  
  BookmarksMenu._selection = null;
  if (contextTargs.resource) {
    var aItem = RDF.GetResource(contextTargs.resource);
    var aParent = BookmarkFuns.getParentOfResource(aItem, BMDS);
    if (aParent) {
      BookmarksMenu._selection = BookmarksUtils.getSelectionFromResource(aItem, aParent);
    }
  }
    
  // Set some flags
  var haveVerse = (CurrentTarget.verse!=null && contextTargs.paragraph==null);
  var overScriptboxVerse = (haveVerse && !contextTargs.isCrossReference);
  var overSelectedVerse = (overScriptboxVerse && CurrentTarget.verse==Bible.getVerseNumber(prefs.getCharPref("Version" + CurrentTarget.windowNum)) && CurrentTarget.verse!=1);
  var frameIsPinned = document.popupNode.ownerDocument.defaultView.FrameIsPinned;
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
  var parent = document.popupNode;
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
      if (targs.resource == null) {try {targs.resource = decodeUTF8(element.id.match(/\.un\.(.*?)\./)[1]);} catch (er) {}}
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
  FrameDocument[CurrentTarget.windowNum].defaultView.closePopup();
  aEvent.target.setAttribute("value","closed");
  goUpdateTargetLocation();
  goUpdateCommand("cmd_bm_properties");
}

function goUpdateTargetLocation() {
  CurrentTarget.version = firstDisplayModule();
  switch (getModuleLongType(CurrentTarget.version)) {
  case BIBLE:
  case COMMENTARY:
    CurrentTarget.shortName = Bible.getBookName();
    CurrentTarget.chapter = Bible.getChapterNumber(CurrentTarget.version);
    CurrentTarget.verse = Bible.getVerseNumber(CurrentTarget.version);
    CurrentTarget.lastVerse = Bible.getLastVerseNumber(CurrentTarget.version);
    break;
  case DICTIONARY:
  case GENBOOK:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("ShowingKey" + CurrentTarget.version, "Unicode", "");
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
 * Strongs Number Functions
 ***********************************************************************/ 
function highlightStrongs(elem, strongsArray, aClass) {
  for (var i=0; i<strongsArray.length; i++) {
    if (strongsArray[i].split(":")[0] != "S") continue;
    var aStrongs = new RegExp(strongsArray[i] + "(\\D|$)", "i");
    if (elem.title && elem.title.search(aStrongs) != -1 && (!elem.className || elem.className.search(aClass)==-1)) 
        elem.className = elem.className + " " + aClass;
  }
  elem = elem.firstChild;
  while (elem) {
    highlightStrongs(elem, strongsArray, aClass);
    elem = elem.nextSibling;
  }
}

function unhighlightStrongs(elem, aClass) {
  if (elem.className) elem.className = elem.className.replace(" " + aClass, "");
  elem = elem.firstChild;
  while (elem) {
    unhighlightStrongs(elem, aClass);
    elem = elem.nextSibling;
  }
}

/************************************************************************
 * GenBook Control Functions
 ***********************************************************************/ 
function getGenBookInfo() {
  // Adjust GenBook settings as needed...
  var numUniqueGenBooks = 0;
  var firstGenBook = null;
  var genBookList = "";
  var modsAtRoot = [];
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var mymod = prefs.getCharPref("Version" + w);
    var mytype = getModuleLongType(mymod);
    if (mytype == GENBOOK) {
      var mymodRE = new RegExp("(^|;)(" + escapeRE(mymod) + ");");
      if (!genBookList.match(mymodRE)) numUniqueGenBooks++;
      else continue;
      // Insure genbook has a showingkey pref!
      var key = getPrefOrCreate("ShowingKey" + mymod, "Unicode", "/" + mymod);
      if (key == "/" + mymod) modsAtRoot.push(mymod);
      if (!firstGenBook) firstGenBook=mymod;
      genBookList += mymod + ";";
    }
  }
  var ret = {};
  ret.numUniqueGenBooks = numUniqueGenBooks;
  ret.genBookList = genBookList;
  ret.modsAtRoot = modsAtRoot;
  ret.firstGenBook = firstGenBook;
  return ret;
}

var RDFChecked = {}; 
function updateGenBooks() {  
  var benbkinfo = getGenBookInfo();
  var numUniqueGenBooks = benbkinfo.numUniqueGenBooks;
  var genBookList = benbkinfo.genBookList;
  var modsAtRoot = benbkinfo.modsAtRoot;
  var firstGenBook = benbkinfo.firstGenBook;
  
  prefs.setBoolPref("ShowGenBookChooser", numUniqueGenBooks>0);
  if (!firstGenBook) return false;
  
  var elem = document.getElementById("genbook-tree");
  var GBs = genBookList.split(";");
  GBs.pop();
  var DSs = elem.database.GetDataSources();
  var needToRebuild=false;
  while (DSs.hasMoreElements()) {
    var myDS = DSs.getNext();
    var mymod = myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+)\.rdf/);
    if (!mymod) continue;
    mymod = mymod[1];
    var keepDS=false;
    for (var i=0; i<GBs.length; i++) {
      if (GBs[i] == mymod) {
        GBs.splice(i, 1);
        keepDS=true;
      }
    }
    if (!keepDS) {
      //jsdump("Removing: " + window.unescape(myDS.QueryInterface(Components.interfaces.nsIRDFDataSource).URI.match(/\/([^\/]+\.rdf)/)[1]) + "\n");
      elem.database.RemoveDataSource(myDS);
      needToRebuild=true;
    }
  }
  for (i=0; i<GBs.length; i++) {
    needToRebuild=true; 
    var moduleRDF = Components.classes["@mozilla.org/file/directory_service;1"].
                getService(Components.interfaces.nsIProperties).
                get("ProfD", Components.interfaces.nsIFile);
    moduleRDF.append(GBs[i] + ".rdf");
    if (!moduleRDF.exists() || !RDFChecked[GBs[i]]) writeFile(moduleRDF, Bible.getGenBookTableOfContents(GBs[i]));
    RDFChecked[GBs[i]] = true;
  
    var myURI = encodeURI("File://" + moduleRDF.path.replace("\\","/","g"));
    //jsdump("Adding: " + myURI.match(/\/([^\/]+\.rdf)/)[1] + "\n");
    elem.database.AddDataSource(RDF.GetDataSourceBlocking(myURI));
  }
  if (needToRebuild) {
    if (numUniqueGenBooks>1)  elem.ref = "rdf:#http://www.xulsword.com/tableofcontents/ContentsRoot";
    if (numUniqueGenBooks==1) elem.ref = "rdf:#/" + firstGenBook;
    elem.builder.rebuild();
  }

  if (numUniqueGenBooks>0 && elem.currentIndex==-1) selectGenBook(getPrefOrCreate("ShowingKey" + firstGenBook, "Unicode", ""));

  //Now that database is loaded, set any root key prefs
  for (i=0; i<modsAtRoot.length; i++) {setPrefToRoot(modsAtRoot[i]);}
  
  return numUniqueGenBooks>0;
}

function setPrefToRoot(module, elem) {
  if (!elem) elem = document.getElementById("genbook-tree");
  var root = RDF.GetResource("rdf:#" + "/" + module);
  var notFound=false;
  try {var child1 = elem.database.GetTarget(root, RDFCU.IndexToOrdinalResource(1), true);}
  catch (er) {notFound=true;}
  if (!child1 || notFound) {jsdump("Resource " + root.Value + " not found.\n"); return;}
  var chapter = elem.database.GetTarget(child1, RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true)
                .QueryInterface(Components.interfaces.nsIRDFLiteral);
  setUnicodePref("ShowingKey" + module, chapter.Value.replace("rdf:#",""));
}

//Opens and scrolls to key, but does not select...
function openGenBookKey(key, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var t=(key + "/").indexOf("/", 1);
  var checkedFirstLevel=false;
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
  
  while (t != -1) {
    var resvalue = "rdf:#" + key.substring(0,t);
    var res = RDF.GetResource(resvalue);
    try {var index = elemTB.getIndexOfResource(res);}
    catch (er) {return;}
    if (index == -1) {
      if (checkedFirstLevel) return;
      checkedFirstLevel=true;
    }
    else {
      if (elemTV.isContainer(index) && !elemTV.isContainerOpen(index)) elemTV.toggleOpenState(index);
    }
    
    t = (key + "/").indexOf("/", t+1); 
  }
  scrollGenBookTo(key, elem);
}

//Selects key, but does not open or scroll to it...
function selectGenBook(key, elem) {
  if (!elem) elem = document.getElementById("genbook-tree");
  if (!elem.view) return;
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var selRes = RDF.GetResource("rdf:#" + key);
  try {
    var i = elemTB.getIndexOfResource(selRes);
    elem.view.selection.select(i);
  }
  catch (er) {elem.view.selection.select(0);}
}

function isSelectedGenBook(key, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
  try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
  catch (er) {return false;}
  var chapter = elem.database.GetTarget(selRes, RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
  chapter = chapter.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
  return key==chapter;
}

function onSelectGenBook(elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  try {var selRes = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(elem.currentIndex);}
  catch (er) {}
  if (!selRes) return;
  
  var newkey = elem.database.GetTarget(selRes, RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
  newkey = newkey.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
  
  var newmod = newkey.match(/^\/([^\/]+)/);
  if (!newmod) return;
  newmod = newmod[1];
  
  try {var oldkey = getUnicodePref("ShowingKey" + newmod);}
  catch (er) {oldkey = "";}
  
  if (newkey != oldkey) {
    var updateNeeded = [false, false, false, false];
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      if (prefs.getCharPref("Version" + w) == newmod) updateNeeded[w] = true;
    }
    setUnicodePref("ShowingKey" + newmod, newkey);
    updateFrameScriptBoxes(updateNeeded, true, true);
  }
}

function bumpSelectedIndex(previousNotNext, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
  var index = elem.currentIndex;
  var newindex = index;
  newindex = (previousNotNext ? --newindex:++newindex);
  if (newindex<0) return;
  elem.view.selection.select(newindex);
  try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
  catch (er) {elem.view.selection.select(index); newindex = index;}
  //dump(newindex + "\n");
  if (elemTV.isContainer(newindex) && !elemTV.isContainerOpen(newindex)) elemTV.toggleOpenState(newindex);
}

//NOTE: Does not open row first!
function scrollGenBookTo(resvalue, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  
  var res = RDF.GetResource("rdf:#" + resvalue);
  try {var index = elemTB.getIndexOfResource(res);}
  catch (er) {return;}
  
  var parentres = RDF.GetResource("rdf:#" + resvalue.replace(/\/[^\/]+$/,""));
  try {var parentindex = elemTB.getIndexOfResource(parentres);}
  catch (er) {return;}
  
  if (parentindex == -1 || index == -1) return;
  PassElem=elem;
  window.setTimeout("scrollTreeNow(" + parentindex + ", " + index + ")", 0);
}

var PassElem;
function scrollTreeNow(pi, i) {
  PassElem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).scrollToRow(pi);
  PassElem.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).ensureRowIsVisible(i);
}

function addParagraphIDs(text) {
  text = text.replace("<P>", "<p>","g");
  text = text.replace(/<BR/g, "<br");
  var p=1;
  
  var myParType;
  var pars = ["<p>", "<br>", "<br />"];
  for (var i=0; i<pars.length; i++) {
    if (text.indexOf(pars[i]) != -1) {
      myParType = pars[i];
      break;
    }
  }
  if (!myParType) myParType="<br>";
  var r = text.indexOf(myParType);
//jsdump("myParType=" + myParType + ", r=" + r + "\n");
  
  if (myParType != "<p>") {
    text = "<div id=\"par.1\">" + text;
    p++;
    r = text.indexOf(myParType);
    while (r != -1) {
      var ins = myParType + "</div><div id=\"par." + p++ + "\">";
      text = text.substring(0, r) + ins + text.substring(r + myParType.length);
      r = text.indexOf(myParType, r+ins.length);
    }
    text += "</div>";
  }
  else {
    while (r != -1) {
      ins = " id=\"par." + p++ + "\"";
      r += 2;
      text = text.substring(0, r) + ins + text.substr(r);
      r = text.indexOf(myParType, r+ins.length);
    }
  }
  return text;
}

function getParagraphWithID(p, text) {
  if (p==null || !text) return text;
  var origtext = text;
  var ins = "id=\"par." + p + "\">";
  var s = text.indexOf(ins);
//jsdump("Looking for:" + ins + "\n" + p + " " + s + "\norigtext:" + origtext.substr(0,128) + "\n");
  if (s == -1) return -1;
  s += ins.length;
  
  p++;
  ins = "id=\"par." + p + "\">";
  var e = text.indexOf(ins, s);
  if (e == -1) e = text.length;
  else {e = text.lastIndexOf("<", e);}
  text = text.substring(s, e);
  text = HTML2text(text);

  return text;
}

function getParagraphWithIDTry(p, text) {
  var par = getParagraphWithID(p, text);
  if (par == -1) {
    for (var tp=1; tp<=4; tp++) {
      par = getParagraphWithID(tp, text);
      if (par != -1) return par;
    }
  }
  else {return par;}
  
  jsdump("WARNING: Paragraph not found: " + p + ", " + text.substr(0,128) + "\n");
  return HTML2text(text);
}

function HTML2text(html) {
  var text = html;
  text = text.replace(/(<[^>]+>)/g,"");
  text = text.replace("&nbsp;", " ", "gim");
  return text;
}



/************************************************************************
 * Dictionary Functions
 ***********************************************************************/ 
// Builds HTML text which displays lemma information from numberList
//    numberList form: (S|WT|SM|RM):(G|H)#
function getLemmaHTML(numberList, matchingPhrase) {
//dump ("numberList:" + numberList + "\n");
  const pad="00000";
  var styleModule = "Program";
  var defaultBibleLanguage = Bible.getModuleInformation(prefs.getCharPref("DefaultVersion"), "Lang");
  if (defaultBibleLanguage == NOTFOUND) defaultBibleLanguage="";
  var html = "<b>" + matchingPhrase + "</b><br>";
  var sep = "";
  for (var i=0; i<numberList.length; i++) {
    var parts = numberList[i].split(":");
    if (!parts || !parts[1]) continue;
    var module = null;
    var key = parts[1];
    key = key.replace(" ", "", "g");
    var saveKey = key;
    switch (parts[0]) {
    case "S":
      if (key.charAt(0)=="H") {
        if (LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage])
          module = LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage];
        else if (LanguageStudyModules["StrongsHebrew"])
          module = LanguageStudyModules["StrongsHebrew"];
      }
      else if (key.charAt(0)=="G") {
        if (Number(key.substr(1)) >= 5627) continue; // SWORD filters these out- not valid it says
        if (LanguageStudyModules["StrongsGreek" + defaultBibleLanguage])
          module = LanguageStudyModules["StrongsGreek" + defaultBibleLanguage];
        else if (LanguageStudyModules["StrongsGreek"])
          module = LanguageStudyModules["StrongsGreek"];
      }
      key = pad.substr(0,5-(key.length-1)) + key.substr(1);
      break;
    case "RM":
      if (LanguageStudyModules["Robinson" + defaultBibleLanguage])
        module = LanguageStudyModules["Robinson" + defaultBibleLanguage];
      else if (LanguageStudyModules["Robinson"])
        module = LanguageStudyModules["Robinson"];
      break;
    case "SM":
      saveKey = "SM" + key;
      break;
    case "WT":
      saveKey = "WT" + key;
      break;     
    }
    if (module) {
      if (styleModule == "Program") styleModule = module;
      if (key == pad) continue; // G tags with no number
      var entry = Bible.getDictionaryEntry(module, key);
      if (entry) html += sep + entry;
      else html += sep + key;
    }
    else html += sep + saveKey;
    sep = "<hr>";
  }
  if (html)
    html = "<div class=\"vstyle" + module + "\">" + html + "</div>";
  return html;
}  

function getDictionaryHTML(dictionaryWord, dictionaryNames, dontAddParagraphIDs) {
//jsdump("dictionaryWord:" + dictionaryWord + " dictionaryNames:" + dictionaryNames + "\n");
  if (!dictionaryWord || !dictionaryNames) return "";
  dictionaryNames += ";";
  var dictMods = dictionaryNames.split(";");
  dictMods.pop();
  var dictHTML="";
  if (dictMods.length == 1) {
    try {dictHTML = Bible.getDictionaryEntry(dictMods[0], dictionaryWord);}
    catch (er) {dictHTML = "";}
    if (dictHTML) dictHTML = completeImageLinks(dictMods[0], dictHTML);
  }
  else if (dictMods.length > 1) {
    for (var dw=0; dw<dictMods.length; dw++) {
      var dictEntry="";
      try {dictEntry = Bible.getDictionaryEntry(dictMods[dw], dictionaryWord);}
      catch (er) {dictEntry = "";}
      if (dictEntry) {
        dictEntry = completeImageLinks(dictMods[dw], dictEntry);
        dictEntry = dictEntry.replace(/^(<br>)+/,"");
        var dictTitle = Bible.getModuleInformation(dictMods[dw], "Description");
        dictTitle = (dictTitle != NOTFOUND ? "<b>" + dictTitle + "</b><br>":"");
        dictHTML += "<br><br>" + dictTitle + dictEntry;
      }
    }
  }
  if (!dictHTML) return "";
//dump(dictHTML + "\n");
  dictHTML = "<b>" + dictionaryWord + ":</b> " + dictHTML + "<br>";
  if (!dontAddParagraphIDs) dictHTML = addParagraphIDs(dictHTML);
  dictHTML = "<div class=\"vstyle" + dictMods[0] + "\">" + dictHTML + "</div>";
  return dictHTML;
}

function completeImageLinks(dictionaryName, text) {
  // Add File:// to path
  text = text.replace("<image src=\"", "<image src=\"File://", "gm");
  if (text.match("<image src=\"File://.") == -1) return text;
  // If Sword is started in runDir, then sword returns "./" as the path,
  // and this is not acceptable to xul, so replace with full path
  var runDirectory = getRunDirectory();
  if (!runDirectory) return text;
  runDirectory = runDirectory.replace(/\\/g, "/");
  text = text.replace("<image src=\"File://.", "<image src=\"File://" + runDirectory, "gm");
  return text;
}

/*
function getModulePath(moduleName) {
  var path;
  try {path = Bible.getModuleInformation(moduleName, "DataPath");}
  catch (er) {return null;}
  if (path == NOTFOUND) return null;
  path = path.replace(/\/[^\/]+$/, "/"); //Remove file name if one is there
  path = path.replace("/", "\\", "g");   //Change / to \
  path = path.replace(/^\.\\/, "");      //Remove initial ./ or .\
  return path;
}
*/

/************************************************************************
 * Scripture Box Control Functions
 ***********************************************************************/ 
 
function getLinkArray() {
  var linkArray = [false];
  for (var w=1; w<3; w++) linkArray.push(isLinkedToNextFrame(w));
  return linkArray;
}
// Returns an array of boolean values indicating which windows need to be
// updated. Windows which linked to the changedWindow need updating as do
// windows which are linked differently that aPreChangeLinkArray
function getUpdatesNeededArray(changedWindow, aPreChangeLinkArray) {
  var postChangeLinkArray = getLinkArray();
  
  var updatesNeeded = [false, false, false, false];
  updatesNeeded[changedWindow] = true;
  var w=changedWindow;
  while(w>1 && postChangeLinkArray[w-1]) {
    updatesNeeded[w-1] = true;
    w--;
  }
  w=changedWindow;
  while(w<3 && postChangeLinkArray[w]) {
    updatesNeeded[w+1] = true;
    w++;
  }

  if (!aPreChangeLinkArray) return updatesNeeded;
  for (w=1; w<=prefs.getIntPref("NumDisplayedWindows")-1; w++) {
    if (postChangeLinkArray[w] != aPreChangeLinkArray[w]) {
      //We've found a link that needs updating. So now update entire link...
      if (postChangeLinkArray[w-1]) updatesNeeded[w-1] = true;
      updatesNeeded[w]   = true;
      updatesNeeded[w+1] = true;
    }
  }
  return updatesNeeded;
}

// Updates Bible text in all three Scripture boxes if needed.
// It checks the number of verses in a chapter, and if the number is greater than 
// a certain threshold, a wait cursor is used (helpful on very slow computers). 
// Plus the scriptbox update then happens in a timeout to allow the cursor to appear before update begins.
var ScriptBoxIsEmpty = [false, false, false, false];
function updateFrameScriptBoxes(updateNeededArray ,scrollToSelectedVerse, highlightSelectedVerse, highlightEvenIfVerseOne, showIntroduction, scrollTypeFlag) {
  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  var needed=false;
  for (var w=1; w<updateNeededArray.length; w++) {needed |= updateNeededArray[w];}
  if (!needed || !Bible) return;
  var vers = prefs.getCharPref("DefaultVersion");
  var numberOfVerses = Bible.getMaxVerse(vers, Bible.getLocation(vers));
  if (numberOfVerses <= 50) {updateFrameScriptBoxesReal(updateNeededArray, scrollToSelectedVerse, highlightSelectedVerse, highlightEvenIfVerseOne, showIntroduction, scrollTypeFlag);}
  else {
    waitCursor();
    window.setTimeout("updateFrameScriptBoxesReal([" + updateNeededArray + "], " + scrollToSelectedVerse + "," + highlightSelectedVerse + "," + highlightEvenIfVerseOne + "," + showIntroduction + "," + scrollTypeFlag + ")",50);
  }
}

function waitCursor() {
  UsingWaitCursor = true;
  document.getElementById("main-window").setAttribute("wait-cursor", "true");
  for (var w=1; w<=3; w++) {
    FrameDocument[w].getElementById("scriptBox").style.cursor="wait";
    FrameDocument[w].getElementById("pin").style.cursor="wait";
    for (var t=0; t<TabVers.length; t++) {FrameDocument[w].getElementById("tab" + String(t)).style.cursor="wait";}
  }
}

var PreviousHaveGenBook;
function updateFrameScriptBoxesReal(updateNeededArray, scrollToSelectedVerse, highlightSelectedVerse, highlightEvenIfVerseOne, showIntroduction, scrollTypeFlag) {
  var vers = firstDisplayBible();
  var doHighlight;
  var scrollToTop=false;
  //var focused = document.commandDispatcher.focusedElement;
  
  if (Bible.getVerseNumber(vers)==1 && Bible.getLastVerseNumber(vers)==1) {
    doHighlight = highlightEvenIfVerseOne ? highlightSelectedVerse:false;
    scrollToTop = true;
  }
  else doHighlight=highlightSelectedVerse;
  
  var haveGenBook = updateGenBooks();
  //Dont need to update chooser if this is init and there are no genbooks
  if ((haveGenBook || (PreviousHaveGenBook!=null)) && haveGenBook != PreviousHaveGenBook) 
      updateChooserVisibility(false, true, true);
  PreviousHaveGenBook = haveGenBook;
  
  // Order is 3,2,1 because lower number Frames can write text to higher number Frames
  // so this order insures that the higher number frames have been initialized
  // before text is written to it.
  for (var w=3; w>=1; w--) {
    if (updateNeededArray[w]) FrameDocument[w].defaultView.updateScriptBox(doHighlight, showIntroduction, scrollToSelectedVerse, scrollTypeFlag);
  }
  document.getElementById("cmd_xs_startHistoryTimer").doCommand();
  goUpdateTargetLocation();
  
  if (UsingWaitCursor) window.setTimeout("cancelWaitCursor();", 0);
  if (scrollToSelectedVerse) window.setTimeout("scrollScriptBoxes(" + scrollToTop + ", [" + updateNeededArray + "]);", 1);

  if (CheckAL) window.clearTimeout(CheckAL);
  CheckAL = window.setTimeout("checkAudioLinks([" + updateNeededArray + "]);", 2);
  
  if (getPrefOrCreate("HideUnavailableCrossReferences", "Bool", false)) {
    if (HideCR) window.clearTimeout(HideCR);
    HideCR = window.setTimeout("hideEmptyCrossRefs([" + updateNeededArray + "]);", 1000);
  }
  
  //if (haveGenBook) document.getElementById("genbook-tree").focus();
}

function showAudioIcon(w) {
  document.getElementById("bible" + w + "Frame").contentDocument.getElementById("listenlink").style.display = "inline";
}

function cancelWaitCursor() {
  UsingWaitCursor = false;
  document.getElementById("main-window").removeAttribute("wait-cursor");
  for (var w=1; w<=3; w++) {
    FrameDocument[w].getElementById("scriptBox").style.cursor="";
    FrameDocument[w].getElementById("pin").style.cursor="";
    for (var t=0; t<TabVers.length; t++) {FrameDocument[w].getElementById("tab" + String(t)).style.cursor="";}
  }
}

var CheckAL;
function checkAudioLinks(updateNeededArray) {
  for (var w=1; w<updateNeededArray.length; w++) {
    if (!updateNeededArray[w]) continue;
    var audioIcon = FrameDocument[w].getElementById("listenlink");
    if (!audioIcon) continue;
    var tvers = prefs.getCharPref("Version" + w);
    if (getAudioForChapter(tvers, Bible.getBookName(tvers), Bible.getChapterNumber(tvers))) audioIcon.style.display = "inline";
  }
}

var HideCR;
function hideEmptyCrossRefs(updateNeededArray) {
  for (var w=1; w<updateNeededArray.length; w++) {
    if (!updateNeededArray[w]) continue;
    var version = prefs.getCharPref("Version" + w);
    if (getModuleLongType(version) != BIBLE) {continue;}
    var notes = Fn[w].CrossRefs;
    if (!notes) continue;
    notes = notes.split("<nx/>");
    for (var n=0; n<notes.length; n++) {
      if (!notes[n]) continue;
      notes[n] = notes[n].split("<bg/>");
      notes[n][1] = notes[n][1].split(";");
      if (!notes[n][1].length) continue;
      var hideCR = true;
      for (var r=0; r<notes[n][1].length; r++) {
        if (findAVerseText(version, notes[n][1][r]).text.length > 7) {
          hideCR = false;
          break;
        }
      }
      if (hideCR) {
        var crElem = FrameDocument[w].getElementById(notes[n][0]);
        if (crElem) {
          crElem.style.visibility = "hidden";
//jsdump("Removed Empty Cross-Reference:" + crElem.id + "\n");
        }
      }
    }
  }
}


////////////////////////////////////////////////////////////////////////////////
/*
//Writes a Bible chapter, including the chapterNavigationLink at top and bottom, to
//either a link of windows, or to a single window, starting at window # leftMost2Write and
//having numberToWrite number of windows. Text flows either left-to-right through the link
//or right-to-left depending on textIsRtoL flag. Bible text, Bible notes, and connectors 
//for the link are all updated by this routine.
function writeToScriptBoxes(leftMost2Write, numberToWrite, textIsRtoL, showIntroduction) {
  var firstWindowInLink = (textIsRtoL ? leftMost2Write+numberToWrite-1:leftMost2Write);
  var firstFrame = FrameDocument[firstWindowInLink].defaultView;
  var lastWindowInLink = (textIsRtoL ? leftMost2Write:leftMost2Write+numberToWrite-1);
  var step = (textIsRtoL ? -1:1);
  var haveUserNotes = false;
  var chapterNavigationLink = FrameDocument[leftMost2Write].defaultView.getNextChapterLinks();
  var writeString = chapterNavigationLink;
  var chapterText;
  var myversion = prefs.getCharPref("Version" + leftMost2Write);
  var mytype = getModuleLongType(myversion);
  var showOriginal = prefs.getBoolPref("ShowOriginal" + firstWindowInLink);
  if (!ScriptBoxIsEmpty[leftMost2Write]) {
    if (showOriginal && mytype==BIBLE) {
      Bible.setGlobalOption("Strong's Numbers", "On");
      Bible.setGlobalOption("Morphological Tags", "On");
      var myBookNumber = findBookNum(firstFrame.BookOfFrame);
      var version1 = prefs.getCharPref("Version" + firstWindowInLink);
      var version2 = (myBookNumber < NumOT ? OrigModuleOT:OrigModuleNT);
      chapterText = firstFrame.Bible.getChapterTextMulti(version1 + "," + version2).replace("interV2", "vstyle" + version2, "gm");
      Bible.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      Bible.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      chapterText = firstFrame.getChapterWithUserNotes();
      haveUserNotes = true;
    }
  }
  if (chapterText) {
    writeString += firstFrame.getScriptBoxHeader(myversion, true, showIntroduction, showOriginal) + 
    chapterText + 
    chapterNavigationLink;
  }
  //Set connector visibility and designate frame which holds the note box, as well as which Bible to read for popups
  //Also hilight user notes if they exist
  for (var i=0; i<numberToWrite; i++) {
    FrameDocument[leftMost2Write+i].defaultView.ConnectorElement.style.visibility = (i==numberToWrite-1 ? "hidden":"visible");
    FrameDocument[leftMost2Write+i].defaultView.FrameDocumentHavingNoteBox = FrameDocument[lastWindowInLink];
    FrameDocument[leftMost2Write+i].defaultView.FrameDocumentWithValidNotes = FrameDocument[firstWindowInLink];
    if (haveUserNotes && mytype==BIBLE) {hilightUserNotes(FrameDocument[firstWindowInLink].defaultView.UserNotes, leftMost2Write+i);}
  }
  
  var lastWindowNotesAreMaximized = prefs.getBoolPref("MaximizeNoteBox" + lastWindowInLink) && !showOriginal;
  if (lastWindowNotesAreMaximized && !ScriptBoxIsEmpty[leftMost2Write]) {
    FrameDocument[lastWindowInLink].defaultView.innerHTML="";
    FrameDocument[lastWindowInLink].defaultView.copyNotes2Notebox();
    FrameDocument[lastWindowInLink].defaultView.setBibleHeight(false, false);
    if (firstWindowInLink == lastWindowInLink) return;
    else {lastWindowInLink -= step;}
  }
  var firstCharOfPage=0;
  for (i=firstWindowInLink; (textIsRtoL ? i>lastWindowInLink:i<lastWindowInLink); i+=step) {
    FrameDocument[i].defaultView.setBibleHeight(false, true);
    firstCharOfPage = fitPage(writeString, FrameDocument[i].defaultView.ScriptBoxTextElement, firstCharOfPage, showOriginal);
  }
  var topMargin = (firstCharOfPage==0 ? "":FrameDocument[1].defaultView.HTMLbr);
  var hideNoteBox = showOriginal || lastWindowNotesAreMaximized || ScriptBoxIsEmpty[leftMost2Write]; //If last window notes are max'mzd this is second to last window, so hide!
  FrameDocument[lastWindowInLink].defaultView.ScriptBoxTextElement.innerHTML = topMargin + writeString.substring(firstCharOfPage, writeString.length);
  if (!hideNoteBox) FrameDocument[lastWindowInLink].defaultView.copyNotes2Notebox();
  FrameDocument[lastWindowInLink].defaultView.setBibleHeight(false, hideNoteBox);
}

//This function takes aString and writes a certain amount of it into frame "f". The
//text which is written starts with character index "itop" and ends when the frame
//is completely full (in other words no scrollbars, but close). The function returns
//the index of the last character written + 1.
function fitPage(aString, f, itop, showOriginal){
  var iend = aString.length;
  var vtext;

  // Use different breaking point if showing original version
  if (showOriginal) {vtext = Vtext2;}
  else {vtext = Vtext1;}

  // First let's see if page would scroll or not
  var topmarg = (itop==0 ? "":FrameDocument[1].defaultView.HTMLbr); //If this is first page, then margin is 0 since it has already been included at top of aString
  f.innerHTML = topmarg + aString.substring(itop,aString.length);
  var r = f.clientHeight/f.scrollHeight;

  // Do this if the page needs to be split:
  if (r != 1) {
    // First make an educated guess for this page's last character index
    var iguess = itop + Math.round(r * (aString.length-itop));
    // Now continue testing starting from the guess, until the window no longer needs to scroll
    do {
      // Find the index just before the beginning of the verse where current guess is
      iguess = aString.lastIndexOf(vtext, iguess-1);
      // If verse not found, then search forward for first verse and break there
      if (iguess == -1) {
        iguess = aString.indexOf(vtext, 0);
        f.innerHTML = topmarg + aString.substring(itop, iguess);
        break;
      }
      f.innerHTML = topmarg + aString.substring(itop, iguess);
    }
    while (f.scrollHeight > f.clientHeight);
    // If no verse was found in the text, then just return the whole thing
    if (iguess == -1) {
      iguess = aString.length;
      f.innerHTML = topmarg + aString.substring(itop, iguess);
    }
    iend = iguess;

    // If verse after the cut was a highlighted verse, then we need to move the cut to before the highlight tag
    var ihighlt = aString.lastIndexOf(highlt,iend);
    if (ihighlt + highlt.length == iend) {iend = ihighlt;}
    // If first verse after the cut was supposed to be indented, then we need to add another indent after the cut
    var iindnt = aString.lastIndexOf(indnt,iend);
    if (iend - (iindnt + indnt.length) < 16) {aString = aString.substring(0, iend) + indnt + aString.substring(iend, aString.length);}
  }

  return iend;
}
*/
////////////////////////////////////////////////////////////////////////////////


//Writes a Bible chapter, including the chapterNavigationLink at top and bottom, to
//either a link of windows, or to a single window, starting at window # leftMost2Write and
//having numberToWrite number of windows. Text flows either left-to-right through the link
//or right-to-left depending on textIsRtoL flag. Bible text, Bible notes, and connectors
//for the link are all updated by this routine.
var Fn = new Array(4);
Fn[1] = new Object();
Fn[2] = new Object();
Fn[3] = new Object();
// TODO: previous/next page should move only one page and page should be cached for quick switchin
// selectVerse needs to be fixed to allow for chapter
function writeToScriptBoxes(leftMost2Write, numberToWrite, textIsRtoL, showIntroduction, scrollToSelectedVerse, scrollTypeFlag) {
  var s = {leftMost2Write:leftMost2Write, numberToWrite:numberToWrite, textIsRtoL:textIsRtoL, showIntroduction:showIntroduction};
  s.firstWindowInLink = (textIsRtoL ? leftMost2Write+numberToWrite-1:leftMost2Write);
  s.lastWindowInLink = (textIsRtoL ? leftMost2Write:leftMost2Write+numberToWrite-1);
  s.navlinks = FrameDocument[leftMost2Write].defaultView.getNextChapterLinks();
  s.showOriginal = prefs.getBoolPref("ShowOriginal" + s.firstWindowInLink);
  s.scrollToSelectedVerse = scrollToSelectedVerse;
  s.verse = FrameDocument[s.firstWindowInLink].defaultView.Bible.getVerseNumber(prefs.getCharPref("Version" + s.firstWindowInLink));
  s.chapter = FrameDocument[s.firstWindowInLink].defaultView.Bible.getChapterNumber(prefs.getCharPref("Version" + s.firstWindowInLink));
  if (s.verse == 1 && !scrollTypeFlag) s.scrollTypeFlag = SCROLLTYPEBEG;
  s.scrollTypeFlag = (scrollTypeFlag ? scrollTypeFlag:SCROLLTYPECENTER);
  s.bibleNotes = "";
  s.userNotes = "";
  
  //Set connector visibility and designate frame which holds the note box, as well as which Bible to read for popups
  for (var i=0; i<numberToWrite; i++) {
    FrameDocument[leftMost2Write+i].defaultView.ConnectorElement.style.visibility = (i==numberToWrite-1 ? "hidden":"visible");
    FrameDocument[leftMost2Write+i].defaultView.FrameDocumentHavingNoteBox = FrameDocument[s.lastWindowInLink];
    Fn[leftMost2Write+i].CrossRefs = "";
    Fn[leftMost2Write+i].Footnotes = "";
    Fn[leftMost2Write+i].Notes = "";
    Fn[leftMost2Write+i].UserNotes = "";
    FrameDocument[leftMost2Write+i].defaultView.MyFootnotes = Fn[s.firstWindowInLink];
  }

  var chapterText = getBibleChapter(s, Fn[s.firstWindowInLink]);

  s.lastWindowNotesAreMaximized = prefs.getBoolPref("MaximizeNoteBox" + s.lastWindowInLink) && !s.showOriginal;
  if (s.lastWindowNotesAreMaximized && !ScriptBoxIsEmpty[leftMost2Write]) {
    FrameDocument[s.lastWindowInLink].defaultView.ScriptBoxTextElement.innerHTML="";
    FrameDocument[s.lastWindowInLink].defaultView.setBibleHeight(false, false);
    s.maximizedNotesWin = s.lastWindowInLink;
    s.lastWindowInLink += (s.lastWindowInLink-s.firstWindowInLink>=0 ? -1:1);
    numberToWrite--;
  }

  s.forceNoteBox2Hide = s.showOriginal || s.lastWindowNotesAreMaximized || ScriptBoxIsEmpty[leftMost2Write]; //If last window notes are max'mzd this is second to last window, so hide!
  if (numberToWrite>1) {
    var p = {text:chapterText, ibeg:null, iend:null, imin:-1, imax:-1, numAppendedChaps:0, numPrependedChaps:0};
    text2LinkedWindows(p, s, Fn[s.firstWindowInLink]);
    if (Fn[s.firstWindowInLink].Notes) Fn[s.firstWindowInLink].Notes = filterNotes(Fn[s.firstWindowInLink].Notes, p);
    else Fn[s.firstWindowInLink].Notes = NOTFOUND;
    if (Fn[s.firstWindowInLink].UserNotes) Fn[s.firstWindowInLink].UserNotes = filterNotes(Fn[s.firstWindowInLink].UserNotes, p);
    else Fn[s.firstWindowInLink].UserNotes = NOTFOUND;
    if (!s.forceNoteBox2Hide) FrameDocument[s.lastWindowInLink].defaultView.copyNotes2Notebox(Fn[s.firstWindowInLink].Notes, Fn[s.firstWindowInLink].UserNotes);
  }
  else {
    FrameDocument[s.firstWindowInLink].defaultView.ScriptBoxTextElement.innerHTML = s.navlinks + chapterText + s.navlinks;
    if (!s.forceNoteBox2Hide) FrameDocument[s.firstWindowInLink].defaultView.copyNotes2Notebox(Fn[s.firstWindowInLink].Notes, Fn[s.firstWindowInLink].UserNotes);
    FrameDocument[s.firstWindowInLink].defaultView.setBibleHeight(false, s.forceNoteBox2Hide);
  }

  //Write maximized notes in last window if needed
  if (s.lastWindowNotesAreMaximized && !ScriptBoxIsEmpty[leftMost2Write]) {
    FrameDocument[s.maximizedNotesWin].defaultView.copyNotes2Notebox(Fn[s.firstWindowInLink].Notes, Fn[s.firstWindowInLink].UserNotes);
  }
}

function getBibleChapter(s, fn, chapOffset) {
  var chapterText;
  var showHeader = (Bible.getGlobalOption("Headings")=="On");
  if (!chapOffset) chapOffset = 0;
  if (!ScriptBoxIsEmpty[s.firstWindowInLink]) {
    if (s.showOriginal && getModuleLongType(prefs.getCharPref("Version" + s.firstWindowInLink))==BIBLE) {
      if (chapOffset && chapOffset != 0) return null; // chapter offsets for interlinear not yet supported
      Bible.setGlobalOption("Strong's Numbers", "On");
      Bible.setGlobalOption("Morphological Tags", "On");
      var myBookNumber = findBookNum(FrameDocument[s.firstWindowInLink].defaultView.BookOfFrame);
      var version1 = prefs.getCharPref("Version" + s.firstWindowInLink);
      var version2 = (myBookNumber < NumOT ? OrigModuleOT:OrigModuleNT);
      chapterText = FrameDocument[s.firstWindowInLink].defaultView.Bible.getChapterTextMulti(version1 + "," + version2).replace("interV2", "vstyle" + version2, "gm");
      Bible.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      Bible.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else {
      chapterText = FrameDocument[s.firstWindowInLink].defaultView.getChapterWithNotes(fn, chapOffset);
      if (getModuleLongType(prefs.getCharPref("Version" + s.firstWindowInLink))==BIBLE) {
        for (i=s.leftMost2Write; i<s.leftMost2Write+s.numberToWrite; i++) {
          hilightUserNotes(fn.UserNotes, i);
        }
      }
    }
  }
  
  if (showHeader && chapterText) {
    if (!chapOffset) chapOffset = 0;
    var showBook =  ((!s.scrollToSelectedVerse || s.scrollTypeFlag==SCROLLTYPEBEG || s.chapter==1) && chapOffset==0);
    if (chapterText) chapterText = FrameDocument[s.firstWindowInLink].defaultView.getScriptBoxHeader(prefs.getCharPref("Version" + s.firstWindowInLink), showBook, s.showIntroduction, s.showOriginal, chapOffset) + chapterText;
  }
  return chapterText;
}

function filterNotes(notes, p) {
//jsdump(p.text.substr(p.imin,32) + ", " + p.text.substr(p.imax, 32));
  const nsep = "<nx/>";
  var retval = "";
  var i = p.text.substring(p.imin, p.imax).indexOf(Vtext1) + p.imin;
  var loc = p.text.substr(i).match(/id=\"vs\.[^\.]*\.(\d+)\.(\d+)\"/);
  if (!loc) return null;
  var minch = Number(loc[1]);
  var minvs = Number(loc[2]);
  i = p.text.substring(p.imin, p.imax).lastIndexOf(Vtext1) + p.imin;
  loc = p.text.substr(i).match(/id=\"vs\.[^\.]*\.(\d+)\.(\d+)\"/);
  if (!loc) return null;
  var maxch = Number(loc[1]);
  var maxvs = Number(loc[2]);

  notes = notes.split(nsep);
  for (i=0; i<notes.length; i++) {
    loc = notes[i].match(/(\d+)\.(\d+)<bg\/>/);
    if (!loc) continue;
    if (Number(loc[1])<minch || (Number(loc[1])==minch && Number(loc[2])<minvs)) continue;
    if (Number(loc[1])>maxch || (Number(loc[1])==maxch && Number(loc[2])>maxvs)) continue;
    retval += notes[i] + nsep;
  }

  return retval;
}

const PREPEND = 0;
const CENTER = 1;
const APPEND = 2;
function text2LinkedWindows(p, s, fn) {
  var wstep = (s.lastWindowInLink-s.firstWindowInLink>=0 ? 1:-1);
  var i;
  FrameDocument[s.lastWindowInLink].defaultView.NoteBoxEmpty = true;

  // center scroll...
  if (s.scrollToSelectedVerse && (s.scrollTypeFlag == SCROLLTYPECENTER)) {
    p.iend = getIndexOfVerse(p.text, s.verse);
    if (p.iend == -1) p.iend = 0;
jsdump("Center scrolling:" + s.verse + ", " + p.iend);
    if (Math.abs(s.lastWindowInLink-s.firstWindowInLink) > 1) {
      fitPage(2, CENTER, p, s, fn, false, false);
      var p1end = p.ibeg;
      fitPage(3, APPEND, p, s, fn, false, s.navlinks);
      p.ibeg = p1end;
      if (!fitPage(1, PREPEND, p, s, fn, s.navlinks, false)) {
jsdump("Recalculating center scroll...");
        p.imin = -1;
        p.imax = -1;
        p.iend = 0;
        for (i=s.firstWindowInLink; i!=s.lastWindowInLink+wstep; i += wstep) {
          fitPage(i, APPEND, p, s, fn, (i==s.firstWindowInLink ? s.navlinks:false), (i==s.lastWindowInLink ? s.navlinks:false));
        }
        return;
      }
    }
    else {
      fitPage(s.firstWindowInLink, CENTER, p, s, fn, s.navlinks, false);
      for (i=s.firstWindowInLink+wstep; i!=s.lastWindowInLink+wstep; i+=wstep) {
        fitPage(i, APPEND, p, s, fn, false, (i==s.lastWindowInLink ? s.navlinks:false));
      }
    }
  }
  // end scroll...
  else if (s.scrollToSelectedVerse && s.scrollTypeFlag==SCROLLTYPEEND) {
    p.ibeg = getIndexOfVerse(p.text, s.verse+1);
    if (p.ibeg == -1) p.ibeg = p.text.length-1;
jsdump("End scrolling to " + s.verse + ", " + p.ibeg);
    for (i=s.lastWindowInLink; i!=s.firstWindowInLink-wstep; i-=wstep) {
      if (!fitPage(i, PREPEND, p, s, fn, (i==s.firstWindowInLink ? s.navlinks:false), (i==s.lastWindowInLink ? s.navlinks:false))) {
jsdump("Recalculating end scroll...");
        p.imin = -1;
        p.imax = -1;
        p.iend = 0;
        for (i=s.firstWindowInLink; i!=s.lastWindowInLink+wstep; i += wstep) {
          fitPage(i, APPEND, p, s, fn, (i==s.firstWindowInLink ? s.navlinks:false), (i==s.lastWindowInLink ? s.navlinks:false));
        }
        return;
      }
    }
  }
  // beginning scroll...
  else {
    if (s.scrollToSelectedVerse && s.scrollTypeFlag==SCROLLTYPEBEG) var firstVerse = s.verse;
    else firstVerse = 1;
    if (!firstVerse || firstVerse < 1) firstVerse = 1;
    p.iend = (firstVerse==1 ? 0:getIndexOfVerse(p.text, firstVerse));
    if (p.iend == -1) p.iend = 0;
jsdump("Beg scrolling to " + firstVerse + ", " + p.iend);
    for (i=s.firstWindowInLink; i!=s.lastWindowInLink+wstep; i += wstep) {
      fitPage(i, APPEND, p, s, fn, (i==s.firstWindowInLink ? s.navlinks:false), (i==s.lastWindowInLink ? s.navlinks:false));
    }
  }
}

function getIndexOfVerse(text, verseNum) {
  var vre = new RegExp("\"vs\\.[^\\.]*\\.\\d+\\." + verseNum +"\"");
  var i = text.search(vre);
  if (i != -1) i = text.lastIndexOf("<", i);
  return i;
}

function fitPage(fnum, type, p, s, fn, header, footer) {
  FrameDocument[fnum].defaultView.setBibleHeight(false, (fnum!=s.lastWindowInLink ? true:s.forceNoteBox2Hide));
  var f = FrameDocument[fnum].defaultView.ScriptBoxTextElement;
  if (!header) header = FrameDocument[1].defaultView.HTMLbr;
  if (!footer) footer = "";

  fn.fn = Bible.getGlobalOption("Footnotes") == "On" && prefs.getBoolPref("ShowFootnotesAtBottom");
  fn.cr = Bible.getGlobalOption("Cross-references") == "On" && prefs.getBoolPref("ShowCrossrefsAtBottom");
  fn.un = prefs.getCharPref("User Notes") == "On" && prefs.getBoolPref("ShowUserNotesAtBottom");
  
  var itest, sw;
  switch(type) {
  case PREPEND:
    p.iend = p.ibeg;
    itest = p.ibeg;
    sw = false;
    break;
  case CENTER:
    p.ibeg = p.iend;
    itest = p.ibeg;
    sw = true;
    break;
  case APPEND:
    p.ibeg = p.iend;
    itest = p.iend;
    sw = true;
    break;
  }

  do {
    if (sw) {
      itest = appendVerse(fnum, f, p, s, fn, header, footer);
      if (f.scrollHeight <= f.clientHeight) p.iend = itest;
    }
    else {
      itest = prependVerse(fnum, f, p, s, fn, header, footer);
      if (f.scrollHeight <= f.clientHeight) p.ibeg = itest;
      if (p.ibeg==0 && type==PREPEND) return false;
    }
    if (type==CENTER) sw = !sw;
  }
  while (f.scrollHeight <= f.clientHeight && p.iend < p.text.length);
  
  // remove the scrollbars that are likely there!
  f.innerHTML = ""; var dummy = f.scrollHeight;
  f.innerHTML = header + p.text.substring(p.ibeg, p.iend) + footer;
  if (p.imin==-1 || p.imin > p.ibeg) p.imin = p.ibeg;
  if (p.imax==-1 || p.imax < p.iend) p.imax = p.iend;
  
  return true;
}

function appendVerse(fnum, f, p, s, fn, header, footer) {
  checkNoteBox(fnum, p, s, fn);
  var itest = p.text.indexOf(Vtext1, p.iend+1);
  if (itest == -1) {
    p.numAppendedChaps++;
    p.text += (Bible.getGlobalOption("Headings")=="On" ? FrameDocument[1].defaultView.HTMLbr:FrameDocument[1].defaultView.HTMLbr0);
    var newtext = getBibleChapter(s, fn, p.numAppendedChaps);
    if (newtext) p.text += newtext;
    itest = p.text.indexOf(Vtext1, p.iend+1);
    if (itest == -1) itest = p.text.length;
  }
  f.innerHTML = header + p.text.substring(p.ibeg, itest) + footer;
  
  return itest;
}

function prependVerse(fnum, f, p, s, fn, header, footer) {
  checkNoteBox(fnum, p, s, fn);
  var itest = p.text.lastIndexOf(Vtext1, p.ibeg-1);
  if (itest == -1) {
    p.numPrependedChaps--;
    var newtext = getBibleChapter(s, fn, p.numPrependedChaps);
    if (newtext) {
      newtext = newtext + (Bible.getGlobalOption("Headings")=="On" ? FrameDocument[1].defaultView.HTMLbr:FrameDocument[1].defaultView.HTMLbr0);
      p.text =  newtext + p.text;
      p.ibeg = p.ibeg + newtext.length;
      p.iend = p.iend + newtext.length;
      p.imin = p.imin + newtext.length;
      p.imax = p.imax + newtext.length;
    }
    itest = p.text.lastIndexOf(Vtext1, p.ibeg-1);
    if (itest == -1) itest = 0;
  }
  f.innerHTML = header + p.text.substring(itest, p.iend) + footer;
  
  return itest;
}

function checkNoteBox(fnum, p, s, fn) {
  if (!s.forceNoteBox2Hide && FrameDocument[s.lastWindowInLink].defaultView.NoteBoxEmpty) {
    // check new verse for footnotes and if found turn note box on!
    if (fn.fn && p.text.substring(p.ibeg, p.iend).match(/id="fn\..*"/) ||
        fn.cr && p.text.substring(p.ibeg, p.iend).match(/id="cr\..*"/) ||
        fn.un && p.text.substring(p.ibeg, p.iend).match(/id="un\..*"/)) {
      FrameDocument[s.lastWindowInLink].defaultView.NoteBoxEmpty = false;
      FrameDocument[s.lastWindowInLink].defaultView.setBibleHeight(false, s.forceNoteBox2Hide);
    }
  }
}


function hilightUserNotes(userNotes, frameNumber) {
  if (!userNotes) return;
  userNotes = userNotes.split("<nx/>"); //UserNotes + myid + "<bg/>" + note + "<nx/>";
  userNotes.pop();
  for (var i=0; i<userNotes.length; i++) {
    var userNote = userNotes[i].split("<bg/>");
    if (userNote && userNote[0]) {
      window.setTimeout("FrameDocument[" + frameNumber + "].defaultView.markUserNoteVerse('" + userNote[0] + "');",0);
    }
  }
}

function scrollScriptBoxes(scrollToTop, updateNeededArray) {
  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  for (var w=1; w<=3; w++) {
    if (FrameDocument[w].defaultView.FrameIsPinned || !updateNeededArray[w]) continue;
    var mytype = getModuleLongType(prefs.getCharPref("Version" + w));
    if (FrameElement[w].style.visibility=="visible") {
      switch (mytype) {
      case BIBLE:
      case COMMENTARY:
        FrameDocument[w].defaultView.scrollScriptBox("sv", scrollToTop);
        break;
      case DICTIONARY:
      case GENBOOK:
        FrameDocument[w].defaultView.scrollScriptBox("sv", true);
        break;
      }
    }
  }
}

var SavedUpdatesNeeded;
function resizeScriptBoxes(updateNeededArray, dontChangeContents) {
  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  // Order is 1,2,3 because Frame 1 has the chooser, and the chooser size must be
  // defined before any Frames can be properly sized
  hideFrames();
  // Extra stuff in this loop helps make the transition look smoother.
  for (var w=1; w<=3; w++) {
    if (!updateNeededArray[w]) continue;
    //Done in resizeBibles(): FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML="";
    if (!dontChangeContents) {
      FrameDocument[w].defaultView.NoteBoxElement.innerHTML="";
      FrameDocument[w].defaultView.PreviousT="";
      FrameDocument[w].getElementById("langTabs").style.visibility="hidden";
    }
    FrameDocument[w].defaultView.resizeBibles(dontChangeContents);
  }
  updateLocators(true);
  showFrames();
  //Using the following timeout seemed to fix a problem with script box linking, where
  //scrollbars would inappropriately appear in frame 1 or 2 due to improper fitting of text.
  //This seems to be related to when showFrames() occurs.
  //We must update scriptboxes because innerHTMLs are null at this point
  if (!dontChangeContents) {
    window.setTimeout("updateFrameScriptBoxes([" + updateNeededArray + "],true,true);",0);
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      if (!updateNeededArray[w]) continue;
      window.setTimeout("{updateTabVisibility(" + w + ", '[" + prefs.getCharPref("Version" + w) + "]'); updateModuleMenuCheckmarks();}", 0);
    }
  }
}

function hideFrames(aWinUpdateArray) {
  for (var w=3; w>=1; w--) document.getElementById("bible" + w + "Frame").style.visibility = "hidden";
}

function showFrames() {
  document.getElementById("bible1Frame").style.visibility = "visible";
  if (prefs.getIntPref("NumDisplayedWindows") >= 2) document.getElementById("bible2Frame").style.visibility = "visible";
  if (prefs.getIntPref("NumDisplayedWindows") == 3) document.getElementById("bible3Frame").style.visibility = "visible";
}

function setNoteBoxSizer(frameNumber, maximizeNoteBox) {
  prefs.setBoolPref("MaximizeNoteBox" + String(frameNumber), maximizeNoteBox);
  FrameDocument[frameNumber].defaultView.NoteBoxSizerElement.src = (maximizeNoteBox ? "chrome://xulsword/skin/images/norm.bmp":"chrome://xulsword/skin/images/max.bmp");
}

/************************************************************************
 * Chooser Control Functions
 ***********************************************************************/ 
 //Updates the chooser and the Text Navigator based on the Bible's current book/chapter/verse
function updateLocators(forceChooserRedraw) {
  var myvers = firstDisplayBible();
  var bNum = Bible ? findBookNum(Bible.getBookName()):-1;
  if (prefs.getBoolPref("ShowChooser") && !prefs.getBoolPref("ShowGenBookChooser")) {
    // Take background style away from all chaps
    for (var b=0; b < NumBooks; b++) {
      FrameDocument[1].getElementById("book." + b).style.background = FrameDocument[1].defaultView.NormalBookBackground;
    }
    // Assign special background for this chapter only
    if (bNum>=0) FrameDocument[1].getElementById("book." + bNum).style.background = FrameDocument[1].defaultView.SelectedBookBackground;
  
    // Bring forward the correct chooser
    if ((bNum <  NumOT)&&(forceChooserRedraw||(FrameDocument[1].getElementById("chooserNT").style.visibility == "visible"))) {FrameDocument[1].defaultView.showChooser("OT",forceChooserRedraw);}
    if ((bNum >= NumOT)&&(forceChooserRedraw||(FrameDocument[1].getElementById("chooserOT").style.visibility == "visible"))) {FrameDocument[1].defaultView.showChooser("NT",forceChooserRedraw);}
  }
  //Update the input boxes in XUL
  if (Bible) {
    document.getElementById("book").book = Book[bNum].sName;
    document.getElementById("book").version = myvers;
    document.getElementById("chapter").value = Bible.getChapterNumber(myvers);
    document.getElementById("verse").value = Bible.getVerseNumber(myvers);
  }
}

function toggleChooser() {
  prefs.setBoolPref("ShowChooser", !prefs.getBoolPref("ShowChooser"));
  for (var w=1; w<=3; w++) {setNoteBoxSizer(w, false);}
  updateChooserVisibility(true);
}

function updateChooserVisibility(resizeAll, resizeFirst, dontUpdateScriptBoxes) {
  var showBibleChooser = prefs.getBoolPref("ShowChooser") && !prefs.getBoolPref("ShowGenBookChooser");
  var showGetBookChooser = prefs.getBoolPref("ShowGenBookChooser");
  FrameDocument[1].getElementById("wholeChooser").style.visibility = showBibleChooser ? "visible":"hidden";
  if (!showBibleChooser) {
    FrameDocument[1].getElementById("chooserNT").style.visibility = "hidden";
    FrameDocument[1].getElementById("chooserOT").style.visibility = "hidden";
  }
  FrameDocument[1].getElementById("chbutClose").style.visibility = showBibleChooser ? "visible":"hidden";
  FrameDocument[1].getElementById("chbutOpen").style.visibility = !showBibleChooser && !showGetBookChooser ? "visible":"hidden";

  var genBookChooserElement = document.getElementById("genBookChooser");
  genBookChooserElement.style.visibility = (showGetBookChooser ? "visible":"hidden");
  genBookChooserElement.style.display = (showGetBookChooser ? "":"none");
      
  if (resizeAll) resizeScriptBoxes(null, dontUpdateScriptBoxes);
  else if (resizeFirst) resizeScriptBoxes([null, true, false, false], dontUpdateScriptBoxes);
}

/************************************************************************
 * Version and Tab Control Functions
 ***********************************************************************/ 
var UpdateTabs; 
function setVersionTo(frameNumber, version) {
  var fdb = firstDisplayBible(true); // capture before changing prefs...
  if (version == ORIGINAL) {
    prefs.setBoolPref("ShowOriginal" + frameNumber,!prefs.getBoolPref("ShowOriginal" + frameNumber));
  }
  else {
    prefs.setBoolPref("ShowOriginal" + frameNumber, false);
    changeVersionPrefs(frameNumber, version);
    if (frameNumber==fdb || fdb!=firstDisplayBible(true)) window.setTimeout("disableMissingBooks(" + getPrefOrCreate("HideDisabledBooks", "Bool", false) + ")", 200);
  }
}

function changeVersionPrefs(w, version) {
  prefs.setCharPref("Version" + w, version);
  var genbookinfo = getGenBookInfo();
  prefs.setBoolPref("ShowGenBookChooser", genbookinfo.numUniqueGenBooks>0);
}

function disableMissingBooks(hideDisabledBooks) {
  var vers = firstDisplayBible();
  var availableBooks = getAvailableBooks(vers);
  for (var b=0; b<NumBooks; b++) {
    var belem = FrameDocument[1].getElementById("book." + b);
    var aelem = FrameDocument[1].getElementById("arrow." + b);
    var isAvailable = false;
    for (var a=0; a<availableBooks.length; a++) {if (Book[b].sName==availableBooks[a]) {isAvailable=true; break;}}
    if (!isAvailable) {
      if (hideDisabledBooks)
        belem.style.display = "none";
      else {
        if (belem.className.search("disabledBook")==-1) belem.className += " disabledBook";
        aelem.style.display = "none";
      }
    }
    else {
      if (hideDisabledBooks)
        belem.style.display = "";
      else {
        belem.className = belem.className.replace("disabledBook", "");
        aelem.style.display = "";
      }
    }
  }
  if (hideDisabledBooks) FrameDocument[1].defaultView.initChooser();
}

// Writes labels and styles for all tabs. When used for initialization, we don't run
// setNoteBoxSizer during init since it isn't needed, and because Globals used
// are not yet initialized
function updateVersionTabs(initializing) {
  for (var w=1; w<=3; w++) {FrameDocument[w].defaultView.PreviousT="";}
  
  var w2 = (prefs.getIntPref("NumDisplayedWindows") >= 2 ? true:false);
  var w3 = (prefs.getIntPref("NumDisplayedWindows") == 3 ? true:false);

  // minimize noteboxes which aren't being shown so we aren't surprised by them later.
  // Also, if a window is not linked, minimize its notebox too, and remove the button
  for (w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var hidebutton = !isLinkedToNextFrame(w-1);
    FrameDocument[w].getElementById("nbsizer").style.visibility = (hidebutton ? "hidden":"visible");
    if (hidebutton && !initializing) setNoteBoxSizer(w, false);
  }
  
  for (w=1; w<=3; w++) {
    for (var b=0; b<TabLabel.length; b++) {
      var tabClasses = {normal:null, selected:null};
      getTabClasses(w, b, tabClasses);

      var myTabElement = FrameDocument[w].getElementById("tab" + b);
      //myTabElement.value = TabLabel[b];
      myTabElement.className = ((b == moduleName2TabIndex(prefs.getCharPref("Version" + w))) ? tabClasses.selected:tabClasses.normal);
      if (prefs.getBoolPref("ShowOriginal" + w) && 
          TabVers[b]==ORIGINAL && 
          getModuleLongType(prefs.getCharPref("Version" + w)) == BIBLE) 
        {FrameDocument[w].getElementById("tab" + b).className = tabClasses.selected;}
    }
    updateSelectTab(w);
  }
//for (var shortType in SupportedModuleTypes) {dump(shortType + ":" + prefs.getCharPref("Hidden" + shortType + 1) + "\n");}
}

function updateSelectTab(aWindowNum) {
  for (var b=0; b<TabLabel.length; b++) {
    var mySelectTabOption = FrameDocument[aWindowNum].getElementById("seltab" + b);
    if (mySelectTabOption) {
      var tabClasses = {normal:null, selected:null};
      getTabClasses(aWindowNum, b, tabClasses);
      mySelectTabOption.className = tabClasses.normal;
      var mySelectTab = FrameDocument[aWindowNum].getElementById("seltab");
      if (mySelectTab.value==mySelectTabOption.value) {
        mySelectTab.className = ((b == moduleName2TabIndex(prefs.getCharPref("Version" + aWindowNum))) ? tabClasses.selected:tabClasses.normal);
      }
      if (mySelectTab.className.search("tabDisabled")!=-1 || mySelectTab.className.search("scriptboxPinnedSelTab")!=-1) mySelectTab.setAttribute("disabled", "disabled");
      else mySelectTab.removeAttribute("disabled");
    }
  }
}

function getTabClasses(aWindowNum, aTabNum, retobj) {
  var tabClass = (FrameDocument[aWindowNum].defaultView.FrameIsPinned ? "tabDisabled ":"");
  var seltabClass = (FrameDocument[aWindowNum].defaultView.FrameIsPinned ? "scriptboxPinnedSelTab ":"");
  
  var moduletype="";
  for (var type in SupportedModuleTypes) {
    if (SupportedModuleTypes[type]==TabLongType[aTabNum]) moduletype=type;
  }
  
  try {var isOrignalLabelOT = (TabLabel[aTabNum]==SBundle.getString("ORIGLabelOT"));}
  catch (er) {isOrignalLabelOT = false;}
  try {var isOrignalLabelNT = (TabLabel[aTabNum]==SBundle.getString("ORIGLabelNT"));}
  catch (er) {isOrignalLabelNT = false;}
  if (isOrignalLabelOT || isOrignalLabelNT) var mystyle = "program";
  else mystyle = TabVers[aTabNum];
  
  tabClass += " tabs tab" + moduletype + " vstyle" + mystyle;
  seltabClass += " tabs tab" + moduletype + " seltab vstyle" + mystyle;
  
  retobj.selected = seltabClass;
  retobj.normal = tabClass;
}

function getVersionsWithPinnedInfo() {
  var versions = new Array(4);
  for (var w=1; w<=3; w++) {
    versions[w] = prefs.getCharPref("Version" + w) + 
            (prefs.getBoolPref("ShowOriginal" + w) ? "ShowOriginal":"") + 
            (FrameDocument[w].defaultView.FrameIsPinned ? 
            FrameDocument[w].defaultView.BookOfFrame + " " + 
            FrameDocument[w].defaultView.ChapterOfFrame:"");
  }
  return versions;
}

function initTabHiddenPrefs() {
  //On the first time through, set up default tab view settings since they
  //will be needed by the coming getPrefOrCreate if we are using a new profile.
  var allComms="";
  var allDicts="";
  var allGenbks="";
  var someBibles="";
  for (var t=0; t<TabVers.length; t++) {
    var keepBible = (TabVers[t]==ORIGINAL || getLocaleOfVersion(TabVers[t]) || TabVers[t]==prefs.getCharPref("DefaultVersion"));
    someBibles  += (TabLongType[t]==BIBLE && !keepBible ? TabVers[t] + ";":"");
    allComms    += (TabLongType[t]==COMMENTARY ? TabVers[t] + ";":"");
    allDicts    += (TabLongType[t]==DICTIONARY ? TabVers[t] + ";":"");
    allGenbks   += (TabLongType[t]==GENBOOK ? TabVers[t] + ";":"");
  }
  var defaultPref = {
    Texts: (getPrefOrCreate("ShowAllBibleTabsByDefault", "Bool", false) ? "":someBibles),
    Comms: (getPrefOrCreate("ShowCommentaryTabsByDefault", "Bool", false) ? "":allComms),
    Dicts: (getPrefOrCreate("ShowDictionaryTabsByDefault", "Bool", false) ? "":allDicts),
    Genbks: (getPrefOrCreate("ShowGenBookTabsByDefault", "Bool", false) ? "":allGenbks)
  };
    
  for (var w=1; w<=3; w++) {
    for (var shortType in SupportedModuleTypes) {
      // Create hidden module pref and initialize...
      var mypref = getPrefOrCreate("Hidden" + shortType + w, "Char", defaultPref[shortType]);
      mypref = mypref.split(";");
HIDDENMODS:
      for (var m=0; m<mypref.length; m++) {
        if (mypref[m]==ORIGINAL && HaveOriginalTab) continue;
        for (var t=0; t<TabVers.length; t++) {if (mypref[m]==TabVers[t]) continue HIDDENMODS;}
        mypref.splice(m,1);
        m--;
      }
      mypref = mypref[0] ? mypref.join(";") + ";":"";
      
      //Hide tabs for versions designated as original...
      if (SupportedModuleTypes[shortType]==BIBLE && !getPrefOrCreate("ShowOriginalTextTabs", "Bool", false)) {
        if (OrigModuleNT) {
          var rt = new RegExp("(^|;)" + escapeRE(OrigModuleNT) + ";");
          if (mypref.search(rt)==-1) mypref += OrigModuleNT + ";";
        }
        if (OrigModuleOT) {
          rt = new RegExp("(^|;)" + escapeRE(OrigModuleOT) + ";");
          if (mypref.search(rt)==-1) mypref += OrigModuleOT + ";";
        }
      }
      prefs.setCharPref("Hidden" + shortType + w, mypref);
//jsdump("UPDATED HIDDEN PREF:" + shortType + w + " to:" + mypref);
    }
  }
  
//for (var shortType in SupportedModuleTypes) {dump(shortType + ":" + prefs.getCharPref("Hidden" + shortType + 1) + "\n");}
}

// Checks legality of requested toggle and modifies hidden module pref accordingly
// Rules for hidden pref lists:
//    1) Every module name in the list ends with a ";"
//    2) If there are no modules in the list, the list is "" (not ";")
function toggleTabVisibility(tabNum, aWindowNum) {
  if (tabNum==null || aWindowNum==null) return null;
  var oldpref="";
  for (var shortType in SupportedModuleTypes) {
    //jsdump("BEFORE TOGGLE- shortType:" + shortType + " hidden:" + prefs.getCharPref("Hidden" + shortType + aWindowNum) + "\n");
    if (SupportedModuleTypes[shortType]==TabLongType[tabNum]) var moduletype=shortType;
  }
  if (!moduletype) return null;
  
  oldpref = prefs.getCharPref("Hidden" + moduletype + aWindowNum);
  var version = new RegExp("(^|;)" + escapeRE(TabVers[tabNum]) + ";");
  var showTab = (oldpref.search(version)!=-1);
  var newprefval = (showTab ? oldpref.replace(version, "$1"):oldpref + TabVers[tabNum] + ";")
  prefs.setCharPref("Hidden" + moduletype + aWindowNum, newprefval);
  return showTab;
}


function fitTabs(aWindowNum) {
  if (aWindowNum>prefs.getIntPref("NumDisplayedWindows")) return;
  var seltab = FrameDocument[aWindowNum].getElementById("seltab");
    
  // Shrink or move tabs if there are too many to fit
  seltab.style.display="none";
  FrameDocument[aWindowNum].defaultView.setFontSize(".tabs", TABTEXTLG);
  var twMargin = getTabWidthMargin(aWindowNum);
  if (!twMargin || twMargin>0) return;
  FrameDocument[aWindowNum].defaultView.setFontSize(".tabs", TABTEXTSM);
  var twMargin = getTabWidthMargin(aWindowNum);
  if (!twMargin || twMargin>0) return;
  seltab.style.display="";
  var t=TabVers.length;
  try {var showingOrig = prefs.getBoolPref("ShowOriginal" + aWindowNum);}
  catch (er) {showingOrig=false;}
  var html = "";

  while (getTabWidthMargin(aWindowNum)<0 && t>0) {
    t--;
    // Find a tab to move to the seltab...
    if (TabVers[t] == ORIGINAL) continue;
    if (!isTabVersionVisible(t, aWindowNum)) continue;
    var ohtml = "<option id=\"seltab" + t + "\" style=\"margin:4px; padding-top:2px; height:20px; \"";
    ohtml += (TabVers[t]==prefs.getCharPref("Version" + aWindowNum) ? " selected=\"selected\"":"");
    ohtml += "onclick=\"tabHandler(event);\" onmouseover=\"tabHandler(event);\" onmouseout=\"tabHandler(event);\"" + ">"
    ohtml += TabLabel[t] + "</option>";
    html = ohtml + html;
    FrameDocument[aWindowNum].getElementById("tab" + t).style.display="none";
    seltab.innerHTML = html;
    updateSelectTab(aWindowNum);
  }
//jsdump("FINISHED fitTabs W=" + aWindowNum + ". Free=" + getTabWidthMargin(aWindowNum));
}

// Adjusts tab visibility based on hidden module prefs. Does NOT redraw anything!
function updateTabVisibility(aWindowNum, dontHideArray, initializing) {
  if (!dontHideArray) dontHideArray = [];
  var needScriptBoxUpdate = false;

  //Make sure mods in dontHideArray are not hidden
  for (var m=0; m<dontHideArray.length; m++) {
    var t=moduleName2TabIndex(dontHideArray[m]);
    if (!isTabVersionVisible(t, aWindowNum)) toggleTabVisibility(t, aWindowNum);
  }
    
  var hiddenModuleString="";
  for (var type in SupportedModuleTypes) {
    hiddenModuleString += prefs.getCharPref("Hidden" + type + aWindowNum);
  }
  
  //Find a visible default tab first
  var defVers = TabVers[0];
  var noBiblesAreVisible = true;
  var hidingORIG = false;
  for (var t=0; t<TabVers.length; t++) {
    if (TabVers[t]==ORIGINAL) continue;
    var sversion = new RegExp("(^|;)" + escapeRE(TabVers[t]) + ";");
    if (hiddenModuleString.search(sversion)==-1) {
      defVers = TabVers[t];
      if (TabLongType[t]==BIBLE) noBiblesAreVisible=false;
      break;
    }
  }

  //Now hide/show tabs
  var numVisibleTabsNotInclORIG = 0;
  for (var t=0; t<TabVers.length; t++) {
    var sversion = new RegExp("(^|;)" + escapeRE(TabVers[t]) + ";");
    var hide = (hiddenModuleString.search(sversion)!=-1);
    hide |= (TabVers[t]==ORIGINAL && noBiblesAreVisible);
    if (!hide && TabVers[t]!=ORIGINAL) numVisibleTabsNotInclORIG++;
    FrameDocument[aWindowNum].getElementById("tab" + t).style.display = (hide ? "none":"");
    if (hide && prefs.getCharPref("Version" + aWindowNum) == TabVers[t]) {
      setVersionTo(aWindowNum, defVers);
      if (UpdateTabs) window.clearTimeout(UpdateTabs);
      if (!initializing) {
        updatePinVisibility(); 
        updateVersionTabs();
        needScriptBoxUpdate = true;
      } 
    }
    if (hide && TabVers[t]==ORIGINAL) hidingORIG = true;
  }
  if (hidingORIG && prefs.getBoolPref("ShowOriginal" + aWindowNum)) {
    setVersionTo(aWindowNum, ORIGINAL); //This toggles ORIGINAL off!
    if (UpdateTabs) window.clearTimeout(UpdateTabs);
    if (!initializing) {
      updatePinVisibility(); 
      updateVersionTabs();
      needScriptBoxUpdate = true;
    }
  }

  needScriptBoxUpdate |= (ScriptBoxIsEmpty[aWindowNum] != (numVisibleTabsNotInclORIG <= 0));
  ScriptBoxIsEmpty[aWindowNum] = numVisibleTabsNotInclORIG <= 0;
  
  //On init, skip tab updates for now (they are done separately later during init)
  if (!initializing) {
    fitTabs(aWindowNum);
    updateModuleMenuCheckmarks();
  }

  FrameDocument[aWindowNum].getElementById("langTabs").style.visibility="visible";
  return needScriptBoxUpdate;
}

function getTabWidthMargin(aWindowNum) {
  var frameDoc = FrameDocument[aWindowNum];
  var frameWin = frameDoc.defaultView;
  //var scriptBoxWxx = frameDoc.getElementById("scriptBox").offsetWidth;
  var scriptBoxW = frameWin.FrameWidth - frameWin.MarginRight - frameWin.MarginLeftOfScriptBox; //This method works before UI redraw!
  var tabRowW = frameDoc.getElementById("langTabs").offsetWidth;
//jsdump("GET TAB WIDTH MARGIN:" + aWindowNum + ", Margin=" + scriptBoxW + "-" + tabRowW + "-" + frameWin.TabBarMargin);
//jsdump("TabWidthMargin=" + ((!scriptBoxW || !tabRowW) ? null:scriptBoxW - tabRowW - frameWin.TabBarMargin));
  if (!scriptBoxW || !tabRowW) return null;
  return scriptBoxW - tabRowW - frameWin.TabBarMargin;
}

function updateModuleMenuCheckmarks() {
//jsdump("RUNNING UPDATE MODULE MENU CHECKMARKS");
  for (var t=0; t<TabVers.length; t++) {
    for (var shortType in SupportedModuleTypes) {
      if (SupportedModuleTypes[shortType]==TabLongType[t]) {
        var moduletype=shortType;
        break;
      }
    }
    var aWindowNum = getRadioSelection(moduletype);
    var checked = true;
    if (aWindowNum <= 3) var sw = aWindowNum;
    else {sw=1; aWindowNum=prefs.getIntPref("NumDisplayedWindows");}
    for (var w=sw; w<=aWindowNum; w++) {
      var test = isTabVersionVisible(t, w);
      checked &= test;
    }
    checked = (checked ? "true":"false");
    document.getElementById("modulemenu." + t).setAttribute("checked", checked);
//jsdump(TabVers[t] + "=" + checked);
  }
}

function isTabVersionVisible(tabNum, aWindowNum) {
  for (var shortType in SupportedModuleTypes) {
    if (SupportedModuleTypes[shortType]==TabLongType[tabNum]) {
      var moduletype=shortType;
      break;
    }
  }
  if (!moduletype) return null;
  var hiddenMods = prefs.getCharPref("Hidden" + moduletype + aWindowNum);
  var rt = new RegExp("(^|;)" + escapeRE(TabVers[tabNum]) + ";");
  return (hiddenMods.search(rt)==-1);
}

//BIBLE/COMM: link="book.chapter.verse", DICT/GENBK: link="key"
//verse2 is lastVerse for versekeys and paragraph number for others
function gotoLink(link, version, verse2) {
  var frameNum = ensureModuleShowing(version);
  window.setTimeout("gotoLinkReal('" + link + "', '" + version + "', " + frameNum + (verse2 ? ", '" + verse2 + "'":"") + ")", 0);
}
function gotoLinkReal(link, version, frameNum, verse2) {
  if (!verse2) verse2=false;
  var updateNeeded = [false];
  for (var w=1; w<=3; w++) updateNeeded[w] = w==frameNum ? true:false;
  var link2 = link;
  link = decodeUTF8(link);
  switch (getModuleLongType(version)) {
  case BIBLE:
  case COMMENTARY:
    link += (verse2 ? "." + verse2:"");
    Bible.setBiblesReference(version, link);
    BookmarkFuns.updateMainWindow(true);
    break;
  case DICTIONARY:
    setUnicodePref("ShowingKey" + version, link);
    BookmarkFuns.updateMainWindow(true, updateNeeded);
    if (verse2) window.setTimeout("FrameDocument[" + frameNum + "].defaultView.scrollScriptBox('par." + verse2 + "', false);", 0);
    else window.setTimeout("FrameDocument[" + frameNum + "].defaultView.scrollScriptBox('par.1', true);", 0);
    break;
  case GENBOOK:
    setUnicodePref("ShowingKey" + version, link);
    BookmarkFuns.updateMainWindow(true, updateNeeded);
    if (verse2) window.setTimeout("FrameDocument[" + frameNum + "].defaultView.scrollScriptBox('par." + verse2 + "', false);", 0);
    else window.setTimeout("FrameDocument[" + frameNum + "].defaultView.scrollScriptBox('par.1', true);", 0);
    //This timeout is needed because RDF may not be ready until after updateScriptBoxes()
    window.setTimeout("{openGenBookKey(decodeUTF8('" + link2 + "')); selectGenBook(decodeUTF8('" + link2 + "'));}", 500);
    break;
  }
}

function ensureModuleShowing(version) {
  var tabnum = moduleName2TabIndex(version);
  var aWindow = 0;
  var numWins = prefs.getIntPref("NumDisplayedWindows");
  var guidir = guiDirection();
  var beg = (guidir=="rtl" ? numWins:1);
  var end = (guidir=="rtl" ? 1-1:numWins+1);
  var step = (guidir=="rtl" ? -1:1);
  for (var w=beg; w != end; w+=step) {
    if (prefs.getCharPref("Version" + w) == version) return w;
    if (isTabVersionVisible(tabnum, w)) {aWindow = w; break;}
  }
  if (aWindow == 0) {
    aWindow = (guidir=="rtl" ? prefs.getIntPref("NumDisplayedWindows"):1);
    toggleTabVisibility(tabnum, aWindow);
    if (updateTabVisibility(aWindow, [version])) {
      updatePinVisibility();
      FrameDocument[aWindow].defaultView.resizeBibles();
    }
  }
  setVersionTo(aWindow, version);
  if (UpdateTabs) window.clearTimeout(UpdateTabs);
  updatePinVisibility(); 
  updateVersionTabs(); 
  return aWindow;
}
 
/************************************************************************
 * Scripture Box Pin Control Functions
 ***********************************************************************/ 
// Sets a frame or a link of two frames to either pinned or un-pinned. 
// When a link is pinned, the left window has its value of PinnedAndLinked set 
// to -1 and the right window gets 1. Otherwise value is to be 0. If we are
// pinning a link where exactly two windows are visible and both are linked,
// we break the link when pinning.
function setPinOfLink(frameNumber, frameIsToBePinned) {
  var updatesNeeded = [false, false, false, false];
  var wasPinned = [false];
  // If frameNumber is null, unpin all windows
  if (frameNumber) {
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      wasPinned.push(FrameDocument[w].defaultView.FrameIsPinned);
    }
  
    var links = getLinkArray(); 
    var myPinnedAndLinked;
    // Pinning a frame or link...
    if (frameIsToBePinned) {
      updatesNeeded[frameNumber] |= setFramePin(frameNumber, true);
      myPinnedAndLinked = 0;
      if (links[frameNumber-1]) {
        updatesNeeded[frameNumber-1] |= setFramePin(frameNumber-1, true);
        FrameDocument[frameNumber-1].defaultView.PinnedAndLinked = -1;
        myPinnedAndLinked = 1;
      }
      else if (links[frameNumber] && !(prefs.getIntPref("NumDisplayedWindows")==2)) {
        updatesNeeded[frameNumber+1] |= setFramePin(frameNumber+1, true);
        FrameDocument[frameNumber+1].defaultView.PinnedAndLinked = 1;
        myPinnedAndLinked = -1;
      }
      FrameDocument[frameNumber].defaultView.PinnedAndLinked = myPinnedAndLinked;
    }
    // Unpinning a frame or link...
    else {
      // If un-pinning, restore static Bible location variables to what they were when this frame was pinned.
      Bible.setBiblesReference(prefs.getCharPref("Version" + String(frameNumber)), 
        FrameDocument[frameNumber].defaultView.BookOfFrame + "." + FrameDocument[frameNumber].defaultView.ChapterOfFrame + "." + FrameDocument[frameNumber].defaultView.VerseOfFrame);
    }
  

    var exception = (prefs.getIntPref("NumDisplayedWindows")==3);
    if (exception) {for (w=1; w<=2; w++) {exception = links[w] ? false:exception;}}
    if (exception) {
      var numPinned=0;
      for (w=1; w<=3; w++) {if (wasPinned[w]) numPinned++;}
      exception = (frameIsToBePinned ? numPinned==1:numPinned==2);
    }
    if (exception && !frameIsToBePinned) setFramePin(frameNumber, false);
  }
  else {wasPinned = [false, true, true, true];}
  
   // Unpin any windows which were previously pinned... 
  if (!exception) {
    for (w=1; w<=wasPinned.length; w++) {
      if (wasPinned[w]) {
        updatesNeeded[w] |= setFramePin(w, false);
      }
    }
  }
  return updatesNeeded;
}

function setFramePin(frameNumber, frameIsToBePinned) {
  if (!frameIsToBePinned) FrameDocument[frameNumber].defaultView.PinnedAndLinked = 0;
  var updateNeeded = (FrameDocument[frameNumber].defaultView.FrameIsPinned != frameIsToBePinned);
  FrameDocument[frameNumber].defaultView.FrameIsPinned = frameIsToBePinned;
  FrameDocument[frameNumber].defaultView.setFramePinStyle(frameIsToBePinned);
  FrameDocument[frameNumber].defaultView.BookOfFrame = Bible.getBookName();
  FrameDocument[frameNumber].defaultView.ChapterOfFrame = Bible.getChapterNumber(prefs.getCharPref("Version" + frameNumber));
  FrameDocument[frameNumber].defaultView.VerseOfFrame = Bible.getVerseNumber(prefs.getCharPref("Version" + frameNumber));
  return updateNeeded;
}

//If only one window, don't show pin icon. Also if two or more windows are linked, 
//only the first in the link should show a pin icon. Only Bibles and commentaries
//(because they track global book/chapter/verse) need a pin icon. If ScriptBoxIsEmpty
//also don't show a pin icon
function updatePinVisibility() {
  var numDisplayedWindows = prefs.getIntPref("NumDisplayedWindows");

  var needsPin = [null];
  for (var w=1; w<=numDisplayedWindows; w++) {
    var mytype = getModuleLongType(prefs.getCharPref("Version" + w));
    needsPin.push(!ScriptBoxIsEmpty[w] && (mytype==BIBLE || mytype==COMMENTARY));
  }
  FrameDocument[1].defaultView.ScriptBoxPinElement.style.visibility = ((needsPin[1] && numDisplayedWindows>1) ? "visible":"hidden");
  for (w=2; w<=numDisplayedWindows; w++) {
    FrameDocument[w].defaultView.ScriptBoxPinElement.style.visibility = ((needsPin[w] && !isLinkedToNextFrame(w-1)) ? "visible":"hidden");
  }
}

function isLinkedToNextFrame(frameNumber) {
  var v = getVersionsWithPinnedInfo();
  if (frameNumber<1 || frameNumber>2) return false;
  if (frameNumber>=prefs.getIntPref("NumDisplayedWindows")) return false;
  if (ScriptBoxIsEmpty[frameNumber] || ScriptBoxIsEmpty[frameNumber+1]) return false;
  if (getModuleLongType(prefs.getCharPref("Version" + frameNumber)) != BIBLE) return false;
  if (v[frameNumber]==v[frameNumber+1]) return true;
  return false;
}

function getUnpinnedWindows() {
  var isUnpinned = [false, false, false, false];
  for (var w=1; w<=3; w++) {isUnpinned[w] = !FrameDocument[w].defaultView.FrameIsPinned;}
  return isUnpinned;
}

/************************************************************************
 * XUL Window Unload
 ***********************************************************************/ 

function unloadXUL() {
  window.controllers.removeController(XulswordController);
  window.controllers.removeController(BookmarksMenuController);
  
  //Close search windows and other windows
  for (var i=0; i<SearchWins.length; i++) {SearchWins[i].close();}
  try {ManagerWindow.close();} catch (er) {}
  try {AboutScreen.close();} catch (er) {}
  try {KeyWindow.close();} catch (er) {}
  try {ProgressMeter.close();} catch (er) {}
    
  //Clear Transactions
  gTxnSvc.clear();
  
  //Save Bible chapter/verse
  if (Bible) {
    var vers = prefs.getCharPref("DefaultVersion");
    if (vers != "none")
        prefs.setCharPref("Location", Bible.convertLocation(Bible.getVerseSystem(vers), Bible.getLocation(vers), WESTERNVS));
  
    //Save history info
    var newhist="";
    for (var i=0; i<History.length; i++) {newhist += History[i] + HistoryDelimeter;}
    prefs.setCharPref("History",newhist);
    prefs.setIntPref("HistoryIndex",Historyi);

  }
  
  //Purge UserData data source
  BookmarkFuns.purgeDataSource(BMDS);
  
  jsdump("Finished unloading xulsword.js");
}

/************************************************************************
 * Display Copy/Printing Functions
 ***********************************************************************/ 

function copyPassageDialog() {
  var retval = window.open("chrome://xulsword/content/copyPassage.xul",document.getElementById("menu.copypassage").childNodes[0].nodeValue,"chrome,modal");
}
 
var PrintPassageHTML;
function handlePrintCommand(command) {
  var topWindow = WindowWatcher.getWindowByName("main-window",window);
  //Fixes a Gecko print preview bug where scroll bar was not appearing
  document.getElementById("printBrowser").style.overflow="auto";
  switch (command) {
  case "cmd_pageSetup":
    document.getElementById("cmd_pageSetup").doCommand();
    break;
  case "cmd_printPreview":
  case "cmd_print":
    document.getElementById('printBrowser').contentDocument.getElementById('printBox').innerHTML = getPrintHTML();
    var mymod = firstDisplayModule();
    var mytype = getModuleLongType(mymod);
    var printTitle = ((mytype==DICTIONARY || mytype==GENBOOK) ? getPrefOrCreate("ShowingKey" + mymod, "Unicode", ""):Book[findBookNum(Bible.getBookName())].bNameL);
    document.getElementById("printBrowser").contentDocument.title = SBundle.getString("Title") + ": " + printTitle;
    document.getElementById(command).doCommand();
    break;
  case "cmd_print_passage":
    var retval = window.open("chrome://xulsword/content/printPassage.xul",document.getElementById("print.printpassage").childNodes[0].nodeValue,"chrome,modal");
    break;
  }
}

function getPrintHTML() {
  var checkFrame = 1;
  var columns = [];
  var notes = [];
  var versions = [];
  var copyright = [];
  var thiscolumn="";
  var ltrPage="";
  var rtlPage="";
  var fnotes="";
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    var myversion = prefs.getCharPref("Version" + w);
    if (getModuleLongType(myversion)!=DICTIONARY && 
        FrameDocument[w].getElementById("noteBox").innerHTML && 
        FrameDocument[w].defaultView.NoteBoxElement.style.visibility!="hidden") {
      fnotes = FrameDocument[w].getElementById("noteBox").innerHTML + "<br><hr><br>";
    }
    var text = FrameDocument[w].getElementById("scriptBoxText").innerHTML;
    thiscolumn = ltrPage + text + rtlPage;
    if (!isLinkedToNextFrame(w)) {
      versions.push(myversion);
      columns.push(thiscolumn);
      ltrPage="";
      rtlPage="";
      notes.push(fnotes);
      fnotes="";
      copyright.push(getCopyright(myversion));
    }
    else {
      var versionConfig = VersionConfigs[myversion];
      var isRTL = (versionConfig.direction && versionConfig.direction=="rtl");
      rtlPage = isRTL ? thiscolumn:"";
      ltrPage = isRTL ? "":thiscolumn;
    }
  }
  
  var columnwidth = Math.round(100/columns.length);
  var p = "<div style=\"position:relative;\" class=\"page\">";
  for (var c=0; c<columns.length; c++) {
    p += "<div class=\"column\" style=\"position:absolute; left:" + columnwidth*c + "%; width:" + columnwidth + "%;\">";
    p += "<div style=\"padding:10px;\">";
    p += "<div class=\"scripture vstyle" + versions[c] + "\">" + columns[c] + "</div>";
    p += "<br><hr><br>";
    p += "<div class=\"footnotes vstyle" + versions[c] + "\">" + notes[c] + copyright[c] + "</div>";
    p += "</div>";
    p += "</div>";
  }
  p += "</div>";
  //p = window.unescape(p); //Allows picture (or other URLs) to resolve properly
  p = p.replace(/%5C/g, "/"); // If "/"s are encoded, paths will break, but I'm sure this line is needed. The previous line is commented because it breaks UTF8 paths!
  return p;
}

function restoreFocus() {
  if (SavedWindowWithFocus) SavedWindowWithFocus.focus();
  SavedWindowWithFocus = null;
}

function onEnterPrintPreview() {
  document.getElementById("mainbar").hidden=true;
  document.getElementById("main-controlbar").hidden=true;
  document.getElementById("appcontent").selectedIndex=1;
}
function onExitPrintPreview() {
  restoreFocus();
  document.getElementById("mainbar").hidden=false;
  document.getElementById("main-controlbar").hidden=false;
  document.getElementById("appcontent").selectedIndex=0;
}
function getPPBrowser() {
  return document.getElementById("printBrowser");
}
function getNavToolbox() {
  return document.getElementById("mainbar");
}
function getWebNavigation() {
  try {
    return document.getElementById("printBrowser").webNavigation;
  } catch (e) {
    return null;
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
  else if (features)
    thiswin = window.open(uri, "_blank", features);
  else
    thiswin = window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  
  return thiswin;
}
  
/************************************************************************
 * Debugging Functions
 ***********************************************************************/ 
 
// This is for debugging purposes only
function saveHTML () {
  for (var i=1; i<=prefs.getIntPref("NumDisplayedWindows"); i++) {
    var data = "";
    if (SearchWins[i-1])
    data += "\n\nSEARCHRESULTS:\n" + SearchWins[i-1].document.getElementById("search-frame").contentDocument.getElementById("searchBox").innerHTML;
    data += "\n\nSCRIPTBOX:\n" + document.getElementById("bible" + i + "Frame").contentDocument.getElementById("scriptBoxText").innerHTML;
    data += "\n\nNOTEBOX:\n" + document.getElementById("bible" + i + "Frame").contentDocument.getElementById("noteBox").innerHTML;
    try {
      var tmp = Bible.getChapterText(prefs.getCharPref("Version" + i));
      data += "\n\nCROSSREFS\n" + Bible.getCrossRefs();
    }
    catch (er) {}
  
    //file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("UChrm", Components.interfaces.nsIFile);
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath("C:\\");
    file.append("ScriptBox" + i + ".txt");
  
    if (!file.exists()) {file.create(0,0664);}
  
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);

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


