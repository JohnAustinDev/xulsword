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
/*

*/

/************************************************************************
 * Initialize Static Bible Variables and some Globals
 ***********************************************************************/
var CopyPopup;
var HistoryDepth;
var HistoryDelimeter;
var HistoryCaptureDelay;
var Historyi;
var History;
var FrameDocument = new Array(4);
var Link = {isLink:[null, null, null, null], isTextLink:[null, null, null, null], modName:null, numWins:null, startWin:null, finishWin:null, firstWin:null, lastWin:null, isRTL:null};
var SavedWindowWithFocus;
var NewModuleInfo;
var AboutScrollTo;
var CrossReferences;
var AudioDirs = null;
var Footnotes = new Array(4);
Footnotes[1] = new Object();
Footnotes[2] = new Object();
Footnotes[3] = new Object();
var TextCache = new Array(4); // used for link scrolling to avoid repeated module reads
TextCache[1] = {fn:Footnotes[1], text:null, iend:null, numAppendedChaps:null, doneAppendedChaps:null, numPrependedChaps:null, donePrependedChaps:null, display:{}};
TextCache[2] = {fn:Footnotes[2], text:null, iend:null, numAppendedChaps:null, doneAppendedChaps:null, numPrependedChaps:null, donePrependedChaps:null, display:{}};
TextCache[3] = {fn:Footnotes[3], text:null, iend:null, numAppendedChaps:null, doneAppendedChaps:null, numPrependedChaps:null, donePrependedChaps:null, display:{}};
const MAXTEXTCACHE = 131071;
const NOMODULES="0000", NOLOCALES="0001", NEEDRESTART="0002";

function loadedXUL() {
  updateCSSBasedOnCurrentLocale(["#xulsword-window", "input, button, menu, menuitem"]);
  createVersionClasses(); // needed for tooltips
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
  window.name="xulsword-window";
  document.getElementById("xulsword-window").setAttribute("active", "true"); //overcomes bug in xulrunner1.9.1.3 where after reload (change locale etc.) window.active was false.
  ContextMenuShowing = false;
  CurrentTarget = {shortName:null, chapter:null, verse:null, lastVerse:null, tabNum:null, windowNum:null};

  FrameDocument = [null, document.getElementById("bible1Frame").contentDocument,
                         document.getElementById("bible2Frame").contentDocument,
                         document.getElementById("bible3Frame").contentDocument];
                         
  Win = [null, FrameDocument[1].defaultView.Win,
               FrameDocument[2].defaultView.Win,
               FrameDocument[3].defaultView.Win];
  
  // check for newly installed modules and reset mods if necessary
  var resetUserPrefs = false;
  var pfile = getSpecialDirectory("xsResD");
  pfile.append(NEWINSTALLFILE);
  NewModuleInfo = (pfile.exists() ? readNewInstallsFile(pfile):null);
  if (pfile.exists()) removeFile(pfile, false);
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
    if (!Tab[getPrefOrCreate("Version" + w, "Char", prefs.getCharPref("DefaultVersion"))])
    prefs.setCharPref("Version" + w, prefs.getCharPref("DefaultVersion"));
  }
  
  //Initialize history globals
  HistoryDepth = 30;  //Number of saved pages in history
  HistoryDelimeter = "<nx>";
  HistoryCaptureDelay = 3500; //Delay in ms before new page is captured as history
  History = getPrefOrCreate("History","Char",HistoryDelimeter).split(HistoryDelimeter);
  Historyi = getPrefOrCreate("HistoryIndex","Int",0);
  History.pop(); // History pref should always end with HistoryDelimeter
  if (Bible && HaveValidLocale && prefs.getCharPref("DefaultVersion")!="none") {
    var aVersion = prefs.getCharPref("DefaultVersion");
    var loc = Location.convertLocation(Bible.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
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
  
  //For backward compatibility so older locales will work with v2.13+
  try {newck = SBundle.getString("SearchAccKey");}
  catch (er) {newck = "F";}
  if (newck) document.getElementById("openSearchDialog").setAttribute("key", newck);
  
  document.getElementById("w1").setAttribute("accesskey", dString("1"));
  document.getElementById("w2").setAttribute("accesskey", dString("2"));
  document.getElementById("w3").setAttribute("accesskey", dString("3"));
  document.getElementById("f0").setAttribute("accesskey", dString("1"));
  document.getElementById("f1").setAttribute("accesskey", dString("2"));
  document.getElementById("f2").setAttribute("accesskey", dString("3"));
  document.getElementById("f3").setAttribute("accesskey", dString("4"));
  document.getElementById("f4").setAttribute("accesskey", dString("5"));
  
  
  //Listen for keypresses on search textbox (for return key)
  document.getElementById("searchText").addEventListener("keypress",keypress,false);

  //BookmarksMenuController must be appended to window since no element is necessarily 
  //focused during bookmark menu pulldown operations and so commandDispatcher doesn't help any
  window.controllers.appendController(XulswordController);
  window.controllers.appendController(BookmarksMenuController);

  //Initialize global options buttons and checkboxes
  if (!Bible || !HaveValidLocale || !Tabs.length) {
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
  
  BookmarkFuns.initTemplateDataSource(document.getElementById("bookmarks-menu"), BMDS); 
  // Cludge to get history button the right height, must happen after updating locale configuration
  document.getElementById("historymenu").style.height = String(document.getElementById("back").boxObject.height) + "px";
  
  // Order is 1,2,3 because Frame 1 has the chooser, and the chooser size must be
  // defined before any Frames can be properly sized
  // There are 3 frames, one for each Bible, and the first frame must also hold the chooser.
  // The chooser cannot be put into a separate frame, because the chooser's chapter popup menu
  // needs to extend outside the area of the chooser, over the top of the first Bible text.
  // This is impossible unless the chooser and first Bible are together in the same frame.
  if (Bible && HaveValidLocale) {
    initTabHiddenPrefs();
    for (w=1; w<=3; w++) {changeVersionPref(w, prefs.getCharPref("Version" + w));} //initialize data structures
    var dontHideArray = [];
    if (NewModuleInfo && NewModuleInfo.NewModules && NewModuleInfo.NewModules[0]) {
      dontHideArray = NewModuleInfo.NewModules;
      var w=0;
      for (var m=0; m<NewModuleInfo.NewModules.length; m++) {
        if (w<prefs.getIntPref("NumDisplayedWindows")) w++;
        var type = getModuleLongType(NewModuleInfo.NewModules[m]);
        if (type==BIBLE) {
          for (var ww=1; ww<=prefs.getIntPref("NumDisplayedWindows"); ww++) {changeVersionPref(ww, NewModuleInfo.NewModules[m]);}
          break;
        }
        else {
          changeVersionPref(w, NewModuleInfo.NewModules[m]);
        }
      }
    }
    for (var i=1; i<=3; i++) {
      removeFromHiddenModPref(i, dontHideArray);
      updateTabsFromHiddenModPrefs(i, true);
    }
    updateLinkInfo();
    for (var i=1; i<=3; i++) {
      FrameDocument[i].defaultView.initializeScript();  
      FrameDocument[i].defaultView.initPopup();
    }
    for (var i=1; i<=3; i++) fitTabs(i);
    updateModuleMenuCheckmarks();
    updateChooserVisibility();
    updatePinVisibility();    
    PreviousHaveGenBook = updateGenBooks();
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

function updateAfterInit() {
  updateFrameScriptBoxesReal([false, true, true, true], SCROLLTYPECENTER, HILIGHTNONE, NOUPDATELOCATOR);
  window.setTimeout("for (var w=1; w<=prefs.getIntPref('NumDisplayedWindows'); w++) {document.getElementById('bible' + w + 'Frame').style.visibility = 'visible';}", 100);
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
  updateFrameScriptBoxes(null, SCROLLTYPETOP, HILIGHTNONE, FORCEREDRAW);
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
      if (Tabs[i].isOrigTab) continue;
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
  if (Tabs[t].isOrigTab) {
    if (skipORIG) return null;
  }
  else if (!noDescription) {
    desc = Bible.getModuleInformation(Tabs[t].modName, "Description");
    if (desc==NOTFOUND) desc="";
    else desc = " --- " + desc;
  }
  
  forceDefaultFormatting |= (Tabs[t].vstyle == "program");
  
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
  var loc = Location.convertLocation(WESTERNVS, History[index] + ".1", Bible.getVerseSystem(refBible));
  Location.setLocation(refBible, loc);
  document.getElementById("book").book = Location.getBookName();
  document.getElementById("book").version = refBible;
  document.getElementById("chapter").value = dString(Location.getChapterNumber(refBible));
  document.getElementById("verse").value = dString(Location.getVerseNumber(refBible));
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
    var aref = Location.convertLocation(WESTERNVS, History[i], Bible.getVerseSystem(vers));
    xulElement.setAttribute("label", ref2ProgramLocaleText(aref, true));
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
  
  // Update BIBLES and COMMENTARIES
  var updateNeeded = [false, false, false, false];
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (Win[w].modType == BIBLE || Win[w].modType == COMMENTARY) updateNeeded[w] = true;
  }
  updateFrameScriptBoxes(updateNeeded, SCROLLTYPECENTER, HILIGHT_IFNOTV1, UPDATELOCATORS);
}

function previousBook() {
  var bkn = findBookNum(Location.getBookName());
  bkn--;
  if (bkn < 0) return;
  Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
  updateFrameScriptBoxes(getUnpinnedVerseKeyWindows(), SCROLLTYPETOP, HILIGHTNONE, UPDATELOCATORS);
}

// if pin info is given, apply changes to pin window only
function previousChapter(highlightFlag, scrollType, pin) {
  var vers = (pin ? Win[pin.number].modName:firstDisplayBible());
  var bkn = findBookNum(pin ? pin.display.shortName:Location.getBookName());
  var chn = (pin ? pin.display.chapter:Location.getChapterNumber(vers));
  
  if (chn > 1) {chn--;}
  else if (bkn > 0) {bkn--; chn = Book[bkn].numChaps;}
  
  if (!pin) {
    if (!scrollType || scrollType==SCROLLTYPETOP || scrollType==SCROLLTYPEBEG) quickSelectVerse(vers, Book[bkn].sName, chn, 1, 1, highlightFlag, scrollType);
    else quickSelectVerse(vers, Book[bkn].sName, chn, LAST_VERSE_IN_CHAPTER, LAST_VERSE_IN_CHAPTER, highlightFlag, scrollType);
  }
  else {
    var update = [];
    if (Link.isLink[pin.number]) update = copyLinkArray();
    else {for (var w=0; w<=3; w++) update.push(w==pin.number);}
    pin.updatePin(Book[bkn].sName, chn, 1);
    pin.updateLink();
    updateFrameScriptBoxes(update, scrollType, HILIGHTNONE, UPDATELOCATORS);
  }
}

// if pin info is given, apply changes to pin window(s) only
function previousPage(highlightFlag, scrollType, pin) {
  var firstPassageInLink = getPassageFromWindow(FIRSTPASSAGE); //FIRSTPLASTW
  if (!firstPassageInLink) {
    previousChapter(highlightFlag, SCROLLTYPEBEG, (pin ? pin:null));
    return;
  }
  
  firstPassageInLink = firstPassageInLink.split(".");
  var vers = firstPassageInLink[4];
  var bk = firstPassageInLink[0];
  var bkn = findBookNum(firstPassageInLink[0]);
  var ch = Number(firstPassageInLink[1]);
  var v = Number(firstPassageInLink[2]);
  if (ch==1 && v==1) {
    if (!pin) {
      Location.setLocation(vers, bk + "." + ch + "." + v);
      previousChapter(highlightFlag, scrollType);
      return;
    }
    else {
      pin.updatePin(bk, ch, v);
      pin.updateLink();
      previousChapter(highlightFlag, scrollType, pin);
      return;
    }
  }

  v--;
  if (v < 1) {
    ch--;
    v = Bible.getMaxVerse(vers, bk + "." + ch);
  }

  var update;
  if (!pin) quickSelectVerse(vers, bk, ch, v, v, highlightFlag, scrollType);
  else {
    update = copyLinkArray();
    pin.updatePin(bk, ch, v);
    pin.updateLink();
    updateFrameScriptBoxes(update, scrollType, HILIGHTNONE, UPDATELOCATORS);
  }
}

function previousVerse(scrollType) {
 // Set Version/Chapter so that setVerse corresponds to the verse/versification of window1
  var vers = firstDisplayBible();
  var v = Location.getVerseNumber(vers);
  v--;
  if ((v==0)&&(findBookNum(Location.getBookName()) >= 0)) previousChapter(HILIGHTVERSE, scrollType);
  else if (v > 0) quickSelectVerse(vers, null, null, v, null, HILIGHTVERSE, scrollType);
}

function nextBook() {
  var bkn = findBookNum(Location.getBookName());
  bkn++;
  if (bkn >= NumBooks) return;
  Location.setLocation(prefs.getCharPref("DefaultVersion"), Book[bkn].sName + ".1.1.1");
  updateFrameScriptBoxes(getUnpinnedVerseKeyWindows(), SCROLLTYPETOP, HILIGHTNONE, UPDATELOCATORS);
}

// if pin info is given, apply changes to pin window(s) only
function nextChapter(highlightFlag, scrollType, pin) {
  var vers = (pin ? Win[pin.number].modName:firstDisplayBible());
  var bkn = findBookNum(pin ? pin.display.shortName:Location.getBookName());
  var chn = (pin ? pin.display.chapter:Location.getChapterNumber(vers));
  
  if (chn < Book[bkn].numChaps) {chn++;}
  else if (bkn < (NumBooks-1)) {bkn++; chn=1;}
  else return;
  
  if (!pin) {quickSelectVerse(vers, Book[bkn].sName, chn, 1, 1, highlightFlag, scrollType);}
  else {
    var update = [];
    if (Link.isLink[pin.number]) update = copyLinkArray();
    else {for (var w=0; w<=3; w++) update.push(w==pin.number);}
    pin.updatePin(Book[bkn].sName, chn, 1);
    pin.updateLink();
    updateFrameScriptBoxes(update, scrollType, HILIGHTNONE, UPDATELOCATORS);
  }
}

// if pin info is given, apply changes to pin window(s) only
function nextPage(highlightFlag, pin) {
  var lastPassageOfLink = getPassageFromWindow(LASTPASSAGE); //LASTPFIRSTW
  if (!lastPassageOfLink) {
    nextChapter(highlightFlag, SCROLLTYPEBEG, (pin ? pin:null));
    return;
  }

  lastPassageOfLink = lastPassageOfLink.split(".");
  var vers = lastPassageOfLink[4];
  var bk = lastPassageOfLink[0];
  var bkn = findBookNum(lastPassageOfLink[0]);
  var ch = Number(lastPassageOfLink[1]);
  var v = Number(lastPassageOfLink[2]);
  var maxv = Bible.getMaxVerse(vers, bk + "." + ch);
  if (ch==Book[bkn].numChaps && v==maxv) {
    if (!pin) {
      Location.setLocation(vers, bk + "." + ch + "." + v);
      nextChapter(highlightFlag, SCROLLTYPEBEG);
      return;
    }
    else {
      pin.updatePin(bk, ch, v);
      pin.updateLink();
      nextChapter(highlightFlag, SCROLLTYPEBEG, pin);
      return;
    }
  }

  v++;
  if (v > maxv) {
    v = 1;
    ch++;
  }
  
  var update;
  if (!pin) quickSelectVerse(vers, bk, ch, v, v, highlightFlag, SCROLLTYPEBEG)
  else {
    update = copyLinkArray();
    pin.updatePin(bk, ch, v);
    pin.updateLink();
    updateFrameScriptBoxes(update, SCROLLTYPEBEG, HILIGHTNONE, UPDATELOCATORS);
  }
}

function nextVerse(scrollType) {
 // Set Version/Chapter such that we get verse/versification of window1 set up correctly
  var vers = firstDisplayBible();
  var cv = Location.getVerseNumber(vers);
  if (cv < Bible.getMaxVerse(vers, Location.getLocation(vers))) {
    cv++;
    quickSelectVerse(vers, null, null, cv, null, HILIGHTVERSE, scrollType);
  }
  else if (findBookNum(Location.getBookName()) <= NumBooks-1) nextChapter(HILIGHTVERSE, scrollType);
}

// If onlyThisWin is false (or null), it reads the full text of the link and
// returns the requested passage, or null if no link is found.
// If onlyThisWin is given, text in this window is read.
// Passage may be:
//    first passage of link
//    last passage of link
// Return form is book.chapter.verse.verse.version
const FIRSTPASSAGE = 0;
const LASTPASSAGE = 1;
function getPassageFromWindow(pflag, onlyThisWin) {
  if (!Link.numWins && !onlyThisWin) return null; // no link and no onlyThisWin!
  var text = "";
  
  if (onlyThisWin && !Link.isLink[onlyThisWin]) {
    // if this is a single, non-linked window:
    var elem;
    if (pflag == LASTPASSAGE) elem = getLastDisplayedPassage(onlyThisWin);
    else elem = getFirstDisplayedPassage(onlyThisWin);
    if (!elem || !elem.id || !elem.id.match(/^vs\.[^\.]+\.\d+\.\d+$/)) return null;
    return elem.id.substring(elem.id.indexOf(".")+1) + "." + Win[onlyThisWin].modName;
  }
  else {
    // if this is a linked window, read text from link
    for (var w=Link.startWin; w<=Link.finishWin; w++) {
      if (!Link.isLink[w]) continue;
      if (onlyThisWin && w!=onlyThisWin) continue;
      if (prefs.getBoolPref("MaximizeNoteBox" + w)) continue;
      if ((Link.isRTL && guiDirection() == "rtl") || (!Link.isRTL && guiDirection() != "rtl"))
          text = text + FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML;
      else
          text = FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML + text;
    }
  }
  
  var passage;
  var verseID = new RegExp("id=\"vs\\.([^\\.]*)\\.(\\d+)\\.(\\d+)\"");
  if (pflag==FIRSTPASSAGE) passage = text.match(verseID);
  else {
    passage = text.lastIndexOf(Vtext1);
    passage = text.substr(passage).match(verseID);
  }

  if (!passage) return null;
  passage.push(passage[passage.length-1]);
  passage.push(Link.modName);
  passage.shift();
  return passage.join(".");
}

// not for use with non versekey windows, or with pinned windows because they don't allow verse selections
function quickSelectVerse(version, bk, ch, vs, lastvs, highlightFlag, scrollType) {
  if (!bk) bk = Location.getBookName();
  if (!ch) ch = Location.getChapterNumber(version);
  if (!lastvs) lastvs = vs;
  var updateNeeded = getUnpinnedVerseKeyWindows();
  Location.setLocation(version, bk + "." + ch + "." + vs + "." + lastvs);
  var forceNonlinkRedraw = false;
  var forceRedraw = [false, false, false, false];
  // if we have a link which needs scrolling, force a redraw of the link
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (!updateNeeded[w] || !Link.isLink[w]) continue;
    if (scrollType && scrollType != SCROLLTYPECENTER) forceRedraw[w] = true;
    if (scrollType && scrollType == SCROLLTYPEEND) forceNonlinkRedraw = true; // selected verse might change during updateFrameScriptBoxes!
  }
  var forceLinkRedraw = false;
  var text = "";
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (!updateNeeded[w] || forceRedraw[w]) continue;
    else if (prefs.getBoolPref("ShowOriginal" + w)) forceRedraw[w] = true;
    else if (!Link.isLink[w] && forceNonlinkRedraw) forceRedraw[w] = true;
    else if (!Link.isLink[w]) {
      var chID = RegExp("id=\"vs\\." + Location.getBookName() + "\\." + Location.getChapterNumber(Win[w].modName) + "\\.");
      if (FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML.search(chID) == -1) forceRedraw[w] = true;
    }
    else {
      text += FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML;
      if (w==Link.finishWin) {
        // finished reading text for link or page
        var vsID = RegExp("id=\"vs\\." + Location.getBookName() + "\\." + Location.getChapterNumber(Win[w].modName) + "\\." + Location.getVerseNumber(Win[w].modName) + "\"");
        var vlID = RegExp("id=\"vs\\." + Location.getBookName() + "\\." + Location.getChapterNumber(Win[w].modName) + "\\." + Location.getLastVerseNumber(Win[w].modName) + "\"");
        vsID = text.search(vsID);
        vlID = text.search(vlID);
        if (vsID == -1 || vlID == -1) {
          for (var x=1; x<=3; x++) {forceRedraw[x] |= Link.isLink[w];}
        }
        text = "";
      }
    }
  }
  var notYetUpdated = [false];
  for (w=1; w<=3; w++) {notYetUpdated.push(updateNeeded[w] && !forceRedraw[w]);}
  if (scrollType) window.setTimeout("scrollScriptBoxes([" + notYetUpdated + "], " + scrollType + ");", 1);
  updateFrameScriptBoxes(forceRedraw, scrollType, highlightFlag, UPDATELOCATORS);
  var needhl = true; // if forceRedraw was all false, we need to run highlighter here instead
  for (w=1; w<=3; w++) {if (forceRedraw[w]) {needhl = false; break;}}
  if (needhl) highlightSelectedVerses(highlightFlag); 
}

function highlightSelectedVerses(highlightFlag) {
  for (var w=1; w<=3; w++) {
    if (Win[w].modType != BIBLE || 
        FrameDocument[w].defaultView.Pin.isPinned ||
        !highlightFlag || (highlightFlag==HILIGHT_IFNOTV1 && fv==1 && lv==1)) 
    {
      FrameDocument[w].defaultView.SelectedVerseCSS.style.color=FrameDocument[w].defaultView.ScriptBoxFontColor;
      continue;   
    }
    else {FrameDocument[w].defaultView.SelectedVerseCSS.style.color=FrameDocument[w].defaultView.SelectedVerseColor;}

    var oldsel = FrameDocument[w].getElementById("sv");
    if (oldsel) oldsel.removeAttribute("id");
    var selem = FrameDocument[w].createElement("span");
    selem.className="hl";
    var fv = Location.getVerseNumber(Win[w].modName);
    var lv = Location.getLastVerseNumber(Win[w].modName);

    var verseID = new RegExp("id=\"(vs\\.[^\\.]*\\.(\\d+)\\.(\\d+))\"");
    verseID = FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML.match(verseID);
    var velem, v, c;
    if (verseID && verseID[1]) velem = FrameDocument[w].getElementById(verseID[1]);
    verseID = new RegExp("vs\\.[^\\.]*\\.(\\d+)\\.(\\d+)");
    while (velem) {
      if (velem.id) {
        var id = velem.id.match(verseID);
        if (id) {
          var c = Number(id[1]);
          var v = Number(id[2]);
          if (v<fv || c != Location.getChapterNumber(Win[w].modName)) removeHL(velem);
          else if (v==fv) {
            var nelem = selem.cloneNode(true);
            nelem.id="sv";
            addHL(velem, nelem);
          }
          else if (v>fv && v<=lv) addHL(velem, selem.cloneNode(true));
          else {removeHL(velem);}
        }
      }
      velem = velem.nextSibling;
    }
  }
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
 * Scroll Wheel functions...
 ***********************************************************************/

var SWcount = 0;
var SWTO;
function scrollwheel(event, w) {
  if (Link.isTextLink[w]) {
    // scrolling over linked windows
    // Over a delay, sum up scroll wheel values, then call the scroll function at end of delay (help scroll keep up).
    var vd = Math.round(event.detail/3);
    SWcount = (SWcount + vd);

    if (SWTO) window.clearTimeout(SWTO);
    SWTO = window.setTimeout("scrollWheelLink();", 100);
  }
  else {
    // scrolling over non-linked Bible or commentary window
    if (FrameDocument[w].defaultView.Pin.isPinned) return;
    if (Win[w].modType != BIBLE && Win[w].modType != COMMENTARY) return;
    if (SWTO) window.clearTimeout(SWTO);
    SWTO = window.setTimeout("scrollWheelNoLink(" + w + ");", 100);
  }
}

function scrollWheelLink() {
  linkVerseScroll(2*SWcount-(Math.abs(SWcount)/SWcount));
  SWcount = 0;
}

// Should be run if user is scrolling the mouse wheel over an unlinked, unpinned, versekey window
// Syncs other unpinned windows to this one...
function scrollWheelNoLink(refWindow) {
  var elem = getFirstDisplayedPassage(refWindow);
  if (!elem) return;
  var oloc = Location.getLocation(Win[refWindow].modName);
  oloc = oloc.substring(0, oloc.lastIndexOf(".")); // remove lastVerse
  var nloc = elem.id.match(/vs\.([^\.]+\.[^\.]+\.[^\.]+)/)[1];
  if (oloc == nloc) return; // already there!
  
  //scroll other windows to top verse
  Location.setLocation(Win[refWindow].modName, nloc);
  var update = [false, false, false, false];
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (Link.isTextLink[w] || w==refWindow) continue;
    if (Win[w].modType == BIBLE || Win[w].modType == COMMENTARY) update[w] = true;
  }
  scrollScriptBoxes(update, SCROLLTYPEBEG);
  updateFrameScriptBoxes(Link.isTextLink, SCROLLTYPEBEG, HILIGHTNONE, UPDATELOCATORS);
}

function getFirstDisplayedPassage(w) {
  var scriptBoxElem = FrameDocument[w].defaultView.ScriptBoxTextElement;
  var scrollTop = scriptBoxElem.scrollTop;
  var vre = new RegExp("id=\"(vs\\..*?)\"", "g");
  var verseIDs = FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML.match(vre);
  vre = new RegExp("id=\"(vs\\..*?)\"");
  for (var i=0; i<verseIDs.length; i++) {
    verseIDs[i] = verseIDs[i].match(vre)[1];
    var elem = FrameDocument[w].getElementById(verseIDs[i]);
    if (elem && elem.offsetTop > scrollTop && elem.offsetTop < (scrollTop + (0.4*scriptBoxElem.offsetHeight))) return elem;
    if (elem &&             elem.offsetTop+elem.offsetHeight > (scrollTop + (0.4*scriptBoxElem.offsetHeight))) return elem;
  }
  return null;
}

function getLastDisplayedPassage(w) {
  var scrollBottom = FrameDocument[w].defaultView.ScriptBoxTextElement;
  scrollBottom = scrollBottom.scrollTop + scrollBottom.offsetHeight;
  var vre = new RegExp("id=\"(vs\\..*?)\"", "g");
  var verseIDs = FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML.match(vre);
  vre = new RegExp("id=\"(vs\\..*?)\"");
  for (var i=verseIDs.length-1; i>=0; i--) {
    verseIDs[i] = verseIDs[i].match(vre)[1];
    var elem = FrameDocument[w].getElementById(verseIDs[i]);
    if (elem && (elem.offsetTop + elem.offsetHeight) < scrollBottom) return elem;
  }
  return null;
}

function linkVerseScroll(numVerses) {
  var fp = getPassageFromWindow(FIRSTPASSAGE);
  if (!fp) {
    var df = prefs.getCharPref("DefaultVersion");
    fp = Location.getLocation(df) + "." + df;
  }
  fp = fp.split(".");
  var b = fp[0];
  var c = Number(fp[1]);
  var v = Number(fp[2]);
  var vers = fp[4];

  var redrawAll = false;
  v += numVerses;
  if (v <= 0) {
    redrawAll = true;
    c--;
    if (c <= 0) {
      var bn = findBookNum(b);
      bn--;
      if (bn < 0) return;
      b = Book[bn].sName;
      c = Book[bn].numChaps;
    }
    v = Bible.getMaxVerse(vers, b + "." + c); // - (numVerses - Number(fp[2]));
    if (v <= 0) v = 1;
  }
  else if (v > Bible.getMaxVerse(vers, b + "." + c)) {
    redrawAll = true;
    c++;
    bn = findBookNum(b);
    if (c > Book[bn].numChaps) {
      bn++;
      if (bn >= NumBooks) return;
      b = Book[bn].sName;
      c = 1;
    }
    v = 1; // + (numVerses - (Bible.getMaxVerse(vers, fp[0] + "." + Number(fp[1])) - Number(fp[2])));
    var mv = Bible.getMaxVerse(vers, b + "." + c);
    if (v > mv) v = mv;
  }
  var update;
  var pin = FrameDocument[Link.firstWin].defaultView.Pin;
  if (pin.isPinned) {
    pin.updatePin(b, c, v);
    pin.updateLink();
    update = copyLinkArray();
  }
  else {
    Location.setLocation(vers, b + "." + c + "." + v);
    if (redrawAll) update = getUnpinnedVerseKeyWindows();
    else {
      update = copyLinkArray();
      var scroll = getUnpinnedVerseKeyWindows();
      for (var w=1; w<=3; w++) {scroll[w] &= !update[w];}
      scrollScriptBoxes(scroll, SCROLLTYPEBEG);
    }
  }
  updateFrameScriptBoxes(update, SCROLLTYPEBEG, HILIGHTNONE, UPDATELOCATORS);
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
      updateFrameScriptBoxes(getUnpinnedWindows(), SCROLLTYPECENTER, HILIGHTNONE, NOUPDATELOCATOR);
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
      updateFrameScriptBoxes(getUnpinnedWindows(), SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
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
      openSearchDialog(document.getElementById('searchText').value, firstDisplayModule(), tp);
      break;
    case "cmd_xs_searchForSelection":
      // override default type by setting to negative of desired type.
      var tp = (getPrefOrCreate("InitialSearchType", "Int", EXACT_TEXT) < 0 ? Math.abs(prefs.getIntPref("InitialSearchType")):EXACT_TEXT);
      openSearchDialog(getMainWindowSelection(), CurrentTarget.version, tp);
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
      document.getElementById("verse").value = dString(CurrentTarget.verse);
      quickSelectVerse(CurrentTarget.version, CurrentTarget.shortName, CurrentTarget.chapter, CurrentTarget.verse, CurrentTarget.lastVerse, HILIGHTVERSE, SCROLLTYPECENTER);
      break;
    case "cmd_xs_back":
      historyBack();
      break;
    case "cmd_xs_forward":
      historyForward();
      break;
    case "cmd_xs_navigatorUpdate":
      updateFromNavigator();
      break;
    case "cmd_xs_openManager":
      AllWindows.push(window.open("chrome://xulsword/content/bookmarks/bookmarksManager.xul", "_blank", "chrome,resizable,centerscreen"));
      break;
    case "cmd_xs_toggleTab":
      var preChangeLinkArray = copyLinkArray();
      toggleHiddenModPref(CurrentTarget.tabNum, CurrentTarget.windowNum);
      updateModuleMenuCheckmarks();
      if (updateTabsFromHiddenModPrefs(CurrentTarget.windowNum)) {
        updateLinkInfo();
        updatePinVisibility();
        updateFrameScriptBoxes(getUpdatesNeededArray(CurrentTarget.windowNum, preChangeLinkArray), SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
      }
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
      return (Historyi < History.length-1);
    case "cmd_xs_back":
      return (Historyi > 0);
    case "cmd_xs_openFromSelection":
      var selt = getMainWindowSelection();
      this.parsedLocation = parseLocation(selt.substr(0,64));
      return this.parsedLocation ? true:false;
    case "cmd_xs_toggleTab":
      if (ScriptBoxIsEmpty[CurrentTarget.windowNum]) return false;
      if (CurrentTarget.windowNum && FrameDocument[CurrentTarget.windowNum].defaultView.Pin.isPinned) return false;
      return true;
    case "cmd_xs_aboutModule":
      if (ScriptBoxIsEmpty[CurrentTarget.windowNum]) return false;
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
      //var cd = getFocusedElemID();
      //if (id[2] && id[2]=="key" && cd && (cd=="chapter" || cd=="verse")) previousVerse(SCROLLTYPECENTER);
      nextVerse(id[2] && id[2]=="button" ? SCROLLTYPECENTERALWAYS:SCROLLTYPECENTER);
      break;
    case "chapter":
      //cd = getFocusedElemID();
      //if (id[2] && id[2]=="key" && cd && (cd=="chapter" || cd=="verse")) previousChapter(HILIGHTNONE, SCROLLTYPEBEG);
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
      //cd = getFocusedElemID();
      //if (id[2] && id[2]=="key" && cd && (cd=="chapter" || cd=="verse")) nextVerse(SCROLLTYPECENTER);
      previousVerse(id[2] && id[2]=="button" ? SCROLLTYPECENTERALWAYS:SCROLLTYPECENTER);
      break;
    case "chapter":
      //cd = getFocusedElemID();
      //if (id[2] && id[2]=="key" && cd && (cd=="chapter" || cd=="verse")) nextChapter(HILIGHTNONE, SCROLLTYPEBEG);
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
    if (Win[w].modType==BIBLE || Win[w].modType==COMMENTARY) haveVK=true;
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
    selob = document.getElementById("bible" + String(w) + "Frame").contentDocument.defaultView.getSelection();
    if (!selob.isCollapsed) {return selob;}
  }
  return null;
}

function openSearchDialog(text, version, type) {
  if (!text) text = "";
  if (!version) version = firstDisplayModule();
  if (type!=0 && !type) type = CONTAINS_THE_WORDS;
  
  prefs.setIntPref("InitialSearchType", type);
  prefs.setCharPref("SearchVersion", version);
  setUnicodePref("SearchText", text);
  AllWindows.push(window.open("chrome://xulsword/content/search.xul","_blank","chrome,resizable,centerscreen"));
}

//Sets view->Show... prefs
function handleViewPopup(elem) {
  var val=elem.getAttribute('value');
  var vals=val.split("_");
  prefs.setBoolPref(vals[0],(vals[1]=="1" ? true:false));
  updateFrameScriptBoxes(null, SCROLLTYPECENTER, HILIGHT_IFNOTV1, NOUPDATELOCATOR);
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
      updateLinkInfo();
      updatePinVisibility(); //If only one window, there is no pin
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
      updateFrameScriptBoxes(getUnpinnedWindows(), SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
      break;
    
    case "about":
      AllWindows.push(window.open("chrome://xulsword/content/about.xul","splash","chrome,modal,centerscreen"));
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
      var toggleMe = (toShowing ? !isTabShowing(t, i):isTabShowing(t, i));
      if (toggleMe) toggleHiddenModPref(t, i);
    }
  }
  
  updateModuleMenuCheckmarks();
  if (w) {s=w; e=w;}
  else {s=1; e=prefs.getIntPref("NumDisplayedWindows");}
  var needRedraw = false;
  for (var i=s; i<=e; i++) {
    needRedraw |= updateTabsFromHiddenModPrefs(i);
  }
  if (needRedraw) {
    var preChangeLinkArray = copyLinkArray();
    updateLinkInfo();
    updatePinVisibility();
    if (w) var update = getUpdatesNeededArray(w, preChangeLinkArray);
    else update = [false, true, true, true];
    updateFrameScriptBoxes(update, SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
  }
}

var RedrawAfterModuleMenuSelect;
function moduleMenuClick1(id, tabNum, subPupId, oldCheckedValue) {
  var rs = getRadioSelection(subPupId);
  var aWindowNum = rs;
  if (aWindowNum <= 3) var sw=aWindowNum;
  else {sw=1; aWindowNum=3;}
  for (var i=sw; i<=aWindowNum; i++) {
    switch (id) {
    case "modulemenu":
      var isTabVisible = isTabShowing(tabNum, i);
      var doToggle = (isTabVisible == oldCheckedValue);
      if (doToggle) {
        toggleHiddenModPref(tabNum, i);
        updateModuleMenuCheckmarks();
      }
      break;
    case "showAllTabs":
    case "showNoTabs":
      var moduletype = SupportedModuleTypes[subPupId];
      if (!moduletype) return;
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType != moduletype) continue;
        var toggleMe = (id=="showNoTabs" ? isTabShowing(t, i):!isTabShowing(t, i));
        if (toggleMe) toggleHiddenModPref(t, i);
      }
      updateModuleMenuCheckmarks();
      break;
    }
  }
  if (rs <= 3) var sw=aWindowNum;
  else {sw=1; rs=3;}
  var needRedraw = false;
  var wins = prefs.getIntPref("NumDisplayedWindows");
  for (var i=sw; i<=rs; i++) {
    if (i>wins) break; 
    needRedraw |= updateTabsFromHiddenModPrefs(i);
  }
  if (needRedraw) {
    var preChangeLinkArray = copyLinkArray();
    updateLinkInfo();
    updatePinVisibility();
    updateFrameScriptBoxes(getUpdatesNeededArray(sw, preChangeLinkArray), SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
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

//Tabs are html and not XUL, but we want XUL tool tips to appear above them (for
//consistency). These routines allow that...
var ShowTabToolTip, HideTabToolTip;
function openTabToolTip(tabNum, frame, cX, cY) {
  if (!document.getElementById('tabTT')) return;
  document.getElementById('tabTT').hidePopup();
  var modName = Tabs[tabNum].modName;
  if (Tabs[tabNum].isOrigTab) modName = resolveOriginalVersion(Location.getBookName());
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
  if (guiDirection() == "rtl") cX = document.getElementById('frameset').boxObject.width - cX;
  ShowTabToolTip = window.setTimeout("document.getElementById('tabTT').openPopup(document.getElementById('frameset'), 'after_pointer', " + cX + ", " + cY + ");", 500);
  HideTabToolTip = window.setTimeout("document.getElementById('tabTT').hidePopup();", 5000);
}

function closeTabToolTip() {
  window.clearTimeout(ShowTabToolTip);
  window.clearTimeout(HideTabToolTip);
  var tabtt = document.getElementById('tabTT');
  if (tabtt) tabtt.hidePopup();
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
  var loc = Location.convertLocation(Bible.getVerseSystem(aVersion), Location.getLocation(aVersion), WESTERNVS).split(".");
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

/************************************************************************
 * Context Menu functions
 ***********************************************************************/ 
var ContextMenuShowing;
var CurrentTarget = {};
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
    FrameDocument[CurrentTarget.windowNum].defaultView.Popup.close();
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
  var myModuleName = Win[winnum].modName;
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
  case GENBOOK:
    CurrentTarget.shortName = "";
    CurrentTarget.chapter = getPrefOrCreate("ShowingKey" + myModuleName, "Unicode", "");
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
  var overSelectedVerse = (overScriptboxVerse && CurrentTarget.verse==Location.getVerseNumber(Win[CurrentTarget.windowNum].modName) && CurrentTarget.verse!=1);
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
      if (element.id=="scriptBox" && !targs.version) targs.version = Win[element.ownerDocument.defaultView.frameElement.id.substr(5,1)].modName;
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
  FrameDocument[CurrentTarget.windowNum].defaultView.Popup.close();
  aEvent.target.setAttribute("value","closed");
  goUpdateTargetLocation();
  goUpdateCommand("cmd_bm_properties");
}

function goUpdateTargetLocation() {
  CurrentTarget.version = firstDisplayModule();
  switch (getModuleLongType(CurrentTarget.version)) {
  case BIBLE:
  case COMMENTARY:
    CurrentTarget.shortName = Location.getBookName();
    CurrentTarget.chapter = Location.getChapterNumber(CurrentTarget.version);
    CurrentTarget.verse = Location.getVerseNumber(CurrentTarget.version);
    CurrentTarget.lastVerse = Location.getLastVerseNumber(CurrentTarget.version);
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
    if (Win[w].modType == GENBOOK) {
      var mymodRE = new RegExp("(^|;)(" + escapeRE(Win[w].modName) + ");");
      if (!genBookList.match(mymodRE)) numUniqueGenBooks++;
      else continue;
      // Insure genbook has a showingkey pref!
      var key = getPrefOrCreate("ShowingKey" + Win[w].modName, "Unicode", "/" + Win[w].modName);
      if (key == "/" + Win[w].modName) modsAtRoot.push(Win[w].modName);
      if (!firstGenBook) firstGenBook=Win[w].modName;
      genBookList += Win[w].modName + ";";
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
    var moduleRDF = getSpecialDirectory("ProfD");
    moduleRDF.append(GBs[i] + ".rdf");
    if (!moduleRDF.exists() || !RDFChecked[GBs[i]]) writeFile(moduleRDF, Bible.getGenBookTableOfContents(GBs[i]));
    RDFChecked[GBs[i]] = true;
  
    var myURI = encodeURI("File://" + moduleRDF.path.replace("\\","/","g"));
    //jsdump("Adding: " + myURI.match(/\/([^\/]+\.rdf)/)[1] + "\n");
    elem.database.AddDataSource(BM.RDF.GetDataSourceBlocking(myURI));
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
  var root = BM.RDF.GetResource("rdf:#" + "/" + module);
  var notFound=false;
  try {var child1 = elem.database.GetTarget(root, BM.RDFCU.IndexToOrdinalResource(1), true);}
  catch (er) {notFound=true;}
  if (!child1 || notFound) {jsdump("Resource " + root.Value + " not found.\n"); return;}
  var chapter = elem.database.GetTarget(child1, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true)
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
    var res = BM.RDF.GetResource(resvalue);
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
  var selRes = BM.RDF.GetResource("rdf:#" + key);
  try {
    var i = elemTB.getIndexOfResource(selRes);
    elem.view.selection.select(i);
  }
  catch (er) {
    if (UpdateOnlyPin) UpdateOnlyPin = null;
    else elem.view.selection.select(0);
  }
}

function isSelectedGenBook(key, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
  try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
  catch (er) {return false;}
  var chapter = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
  chapter = chapter.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
  return key==chapter;
}

var SkipGenBookWindow=0;
var UpdateOnlyPin;
function onSelectGenBook(elem) {
  if (BlockOnSelect) return;
  if (UpdateOnlyPin && UpdateOnlyPin.done) {
//jsdump("5 onSelectGenBook:");
    UpdateOnlyPin=null;
    SkipGenBookWindow=0;
    return;
  }
  if (UpdateOnlyPin && UpdateOnlyPin.shiftKey) {
//jsdump("2 onSelectGenBook:");
    if (!bumpSelectedIndex((UpdateOnlyPin.shiftKey==-1), elem)) {
      UpdateOnlyPin.done = true;
      selectGenBook(UpdateOnlyPin.selectedKey, elem);
    }
    UpdateOnlyPin=null;
    SkipGenBookWindow=0;
    return;
  }
//jsdump("4 onSelectGenBook:");
  if (!elem) elem=document.getElementById("genbook-tree");
  try {var selRes = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(elem.currentIndex);}
  catch (er) {}
  if (!selRes) {SkipGenBookWindow=0; UpdateOnlyPin=null; return;}
  
  var newkey = elem.database.GetTarget(selRes, BM.RDF.GetResource("http://www.xulsword.com/tableofcontents/rdf#Chapter"), true);
  newkey = newkey.QueryInterface(Components.interfaces.nsIRDFLiteral).Value.replace("rdf:#","");
  
  var newmod = newkey.match(/^\/([^\/]+)/);
  if (!newmod)  {SkipGenBookWindow=0; UpdateOnlyPin=null; return;}
  newmod = newmod[1];
  
  if (!UpdateOnlyPin) {
    try {var oldkey = getUnicodePref("ShowingKey" + newmod);}
    catch (er) {oldkey = "";}
  }
  else oldkey = UpdateOnlyPin.display.key;
  
  if (newkey != oldkey) {
    var updateNeeded = [false, false, false, false];
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      if (!UpdateOnlyPin) {
        if (w == SkipGenBookWindow) continue;
        if (Win[w].modName == newmod && !FrameDocument[w].defaultView.Pin.isPinned) updateNeeded[w] = true;
      }
      else if (w == UpdateOnlyPin.number) updateNeeded[w] = true;
    }
    if (!UpdateOnlyPin) setUnicodePref("ShowingKey" + newmod, newkey);
    else UpdateOnlyPin.display.key = newkey;
    updateFrameScriptBoxes(updateNeeded, SCROLLTYPETOP, HILIGHTNONE, NOUPDATELOCATOR);
  }
  SkipGenBookWindow=0;
  
  if (UpdateOnlyPin) {
    UpdateOnlyPin.done = true;
    selectGenBook(UpdateOnlyPin.selectedKey, elem);
  }
}

var BlockOnSelect;
function bumpSelectedIndex(previousNotNext, elem) {
//jsdump("3 bumpSelectedIndex:");
  if (UpdateOnlyPin && UpdateOnlyPin.shiftKey) UpdateOnlyPin.shiftKey = 0;
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  var elemTV = elem.view.QueryInterface(Components.interfaces.nsITreeView);
  var index = elem.currentIndex;
  var newindex = index;
  newindex = (previousNotNext ? --newindex:++newindex);
  if (newindex<0) return false;
  BlockOnSelect = true;
  elem.view.selection.select(newindex);
  try {var selRes = elemTB.getResourceAtIndex(elem.currentIndex);}
  catch (er) {elem.view.selection.select(index); newindex = index;}
  //dump(newindex + "\n");
  if (elemTV.isContainer(newindex) && !elemTV.isContainerOpen(newindex)) elemTV.toggleOpenState(newindex);
  BlockOnSelect = false;
  if (newindex != index) onSelectGenBook(elem);
  return newindex != index;
}

// 1 run bumpPinnedIndex to set UpdateOnlyPin to start the process, and select pin.display.key which will trigger onSelectGenBook
// 2 run onSelectGenBook which does nothing but call bumpSelectedIndex
// 3 run bumpSelectedIndex to select shifted pin entry which will trigger onSelectGenBook
// 4 run onSelectGenBook to redraw shifted pin window and then select original key again which will trigger onSelectGenBook
// 5 run onSelectGenBook which does nothing but clear UpdateOnlyPin to stop the process.
function bumpPinnedIndex(pin, previousNotNext, elem) {
//jsdump("1 bumpPinnedIndex:" + previousNotNext);
  if (!elem) elem=document.getElementById("genbook-tree");
  var selectedKey = getPrefOrCreate("ShowingKey" + Win[pin.number].modName, "Unicode", "");
  UpdateOnlyPin = pin;
  UpdateOnlyPin.selectedKey = selectedKey;
  UpdateOnlyPin.shiftKey = (previousNotNext ? -1:1);
  UpdateOnlyPin.done = false;
  selectGenBook(pin.display.key, elem);
  if (UpdateOnlyPin && UpdateOnlyPin.shiftKey) onSelectGenBook(elem); // needed when pin.display.key == selectedKey
  UpdateOnlyPin = null;
}

//NOTE: Does not open row first!
function scrollGenBookTo(resvalue, elem) {
  if (!elem) elem=document.getElementById("genbook-tree");
  var elemTB = elem.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
  
  var res = BM.RDF.GetResource("rdf:#" + resvalue);
  try {var index = elemTB.getIndexOfResource(res);}
  catch (er) {return;}
  
  var parentres = BM.RDF.GetResource("rdf:#" + resvalue.replace(/\/[^\/]+$/,""));
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
  var defaultBibleLangBase = (defaultBibleLanguage ? defaultBibleLanguage.replace(/-.*$/, ""):"");
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
        else if (LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase])
          module = LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase];
        else if (LanguageStudyModules["StrongsHebrew"])
          module = LanguageStudyModules["StrongsHebrew"];
      }
      else if (key.charAt(0)=="G") {
        if (Number(key.substr(1)) >= 5627) continue; // SWORD filters these out- not valid it says
        if (LanguageStudyModules["StrongsGreek" + defaultBibleLanguage])
          module = LanguageStudyModules["StrongsGreek" + defaultBibleLanguage];
        else if (LanguageStudyModules["StrongsGreek" + defaultBibleLangBase])
          module = LanguageStudyModules["StrongsGreek" + defaultBibleLangBase];
        else if (LanguageStudyModules["StrongsGreek"])
          module = LanguageStudyModules["StrongsGreek"];
      }
      key = pad.substr(0,5-(key.length-1)) + key.substr(1);
      break;
    case "RM":
      if (LanguageStudyModules["GreekParse" + defaultBibleLanguage])
        module = LanguageStudyModules["GreekParse" + defaultBibleLanguage];
      else if (LanguageStudyModules["GreekParse" + defaultBibleLangBase])
        module = LanguageStudyModules["GreekParse" + defaultBibleLangBase];
      else if (LanguageStudyModules["GreekParse"])
        module = LanguageStudyModules["GreekParse"];
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
    if (html && module)
    html = "<div class=\"vstyle" + module + "\">" + html + "</div>";
  }
  return html;
}  

function getDictionaryHTML(dictionaryWord, dictionaryNames, dontAddParagraphIDs) {
//jsdump("dictionaryWord:" + dictionaryWord + " dictionaryNames:" + dictionaryNames + "\n");
  if (!dictionaryWord || !dictionaryNames) return "";
  dictionaryWord = decodeOSISRef(dictionaryWord);
  dictionaryNames += ";";
  var dictMods = dictionaryNames.split(";");
  dictMods.pop();
  var dictHTML="";
  if (dictMods.length == 1) {
    try {dictHTML = Bible.getDictionaryEntry(dictMods[0], dictionaryWord);}
    catch (er) {dictHTML = "";}
  }
  else if (dictMods.length > 1) {
    for (var dw=0; dw<dictMods.length; dw++) {
      var dictEntry="";
      try {dictEntry = Bible.getDictionaryEntry(dictMods[dw], dictionaryWord);}
      catch (er) {dictEntry = "";}
      if (dictEntry) {
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

function decodeOSISRef(aRef) {
  var re = new RegExp(/_(\d+)_/);
  var m = aRef.match(re);
  while(m) {
    var r = String.fromCharCode(Number(m[1]));
    aRef = aRef.replace(m[0], r, "g");
    m = aRef.match(re);
  }
  return aRef;
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
 
function copyLinkArray() {
  var linkArray = [false];
  for (var w=1; w<=3; w++) linkArray.push(Link.isLink[w]);
  return linkArray;
}
// Returns an array of boolean values indicating which windows need to be
// updated.
function getUpdatesNeededArray(changedWindow, aPreChangeLinkArray) {
  // update changed window and its link (if it has one)
  var updatesNeeded = [false, false, false, false];
  updatesNeeded[changedWindow] = true;
  if (Link.isLink[changedWindow]) {
    for (var w=1; w<=3; w++) {updatesNeeded[w] = Link.isLink[w];}
  }
  if (!aPreChangeLinkArray) return updatesNeeded;
  
  // if old link has changed, update all windows in old link too
  var needed = false;
  for (w=1; w<=3; w++) {needed |= (aPreChangeLinkArray[w] != Link.isLink[w]);}
  if (needed) {
    for (w=1; w<=3; w++) {updatesNeeded[w] |= aPreChangeLinkArray[w];}
  }

  return updatesNeeded;
}

// Updates Bible text in all three Scripture boxes if needed.
// It checks the number of verses in a chapter, and if the number is greater than 
// a certain threshold, a wait cursor is used (helpful on very slow computers). 
// Plus the scriptbox update then happens in a timeout to allow the cursor to appear before update begins.
var ScriptBoxIsEmpty = [false, false, false, false];
function updateFrameScriptBoxes(updateNeededArray ,scrollTypeFlag, highlightFlag, locatorFlag) {

//document.getElementById("viewport").contentDocument.defaultView.updateViewPort();

  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  var needed=false;
  for (var w=1; w<updateNeededArray.length; w++) {needed |= updateNeededArray[w];}
  if (!needed || !Bible) return;
  
  var haveGenBook = updateGenBooks();
  if ((haveGenBook || (PreviousHaveGenBook!=null)) && haveGenBook != PreviousHaveGenBook) {
    updateChooserVisibility();
    resizeScriptBoxes(true);
    locatorFlag = FORCEREDRAW;
    updateLinkInfo();
  }
  PreviousHaveGenBook = haveGenBook;
  
  window.setTimeout("updateFrameScriptBoxesReal([" + updateNeededArray + "], " + scrollTypeFlag + "," + highlightFlag + "," + locatorFlag + ")",50);
}

var PreviousHaveGenBook;
function updateFrameScriptBoxesReal(updateNeededArray, scrollTypeFlag, highlightFlag, locatorFlag) {
  var vers = firstDisplayBible();
  //var focused = document.commandDispatcher.focusedElement;

  // Order is high to low because lower number Frames can write text to higher number Frames
  // so this order insures that the higher number frames have been initialized
  // before text is written to it.
  // Links are processed first because in the case of SCROLLTYPEEND on a link, the link
  // must be completed first, so that the first verse of the link can be set as SCROLLTYPEBEG
  // for non-linked window.
  var nonLinked = [];
  var ref = Location.getLocation(prefs.getCharPref("DefaultVersion"));
  for (var w=prefs.getIntPref("NumDisplayedWindows"); w>=1; w--) {
    if (!updateNeededArray[w]) continue;
    if (!Link.isLink[w]) {
      nonLinked.push(w);
      continue;
    }
    FrameDocument[w].defaultView.updateScriptBox(scrollTypeFlag);
  }
  // if Location was changed after writing link, then scroll to beginning of new location
  if (ref != Location.getLocation(prefs.getCharPref("DefaultVersion"))) {
    scrollTypeFlag = SCROLLTYPEBEG;
    if (locatorFlag == NOUPDATELOCATOR) locatorFlag = UPDATELOCATORS;
  }
  while (nonLinked.length) {
    if (updateNeededArray[nonLinked[0]]) FrameDocument[nonLinked[0]].defaultView.updateScriptBox(scrollTypeFlag);
    nonLinked.shift();
  }
  
  document.getElementById("cmd_xs_startHistoryTimer").doCommand();
  goUpdateTargetLocation();
  
  highlightSelectedVerses(highlightFlag);
  
  if (scrollTypeFlag) {
    if (scrollTypeFlag != SCROLLTYPECUSTOM) 
        window.setTimeout("scrollScriptBoxes([" + updateNeededArray + "], " + scrollTypeFlag + ");", 1);
    else window.setTimeout(CustomScrollFunction, 1);
  }
  if (!locatorFlag || locatorFlag != NOUPDATELOCATOR) window.setTimeout("updateLocators(" + locatorFlag + ")", 0);
  if (CheckAL) window.clearTimeout(CheckAL);
  CheckAL = window.setTimeout("updateAudioLinks([" + updateNeededArray + "]);", 2);
  
  if (getPrefOrCreate("HideUnavailableCrossReferences", "Bool", false)) {
    if (HideCR) window.clearTimeout(HideCR);
    HideCR = window.setTimeout("hideEmptyCrossRefs([" + updateNeededArray + "]);", 1000);
  }
  
  //if (haveGenBook) document.getElementById("genbook-tree").focus();
}

var CheckAL;
function updateAudioLinks(updateNeededArray) {
  for (var w=1; w<updateNeededArray.length; w++) {
    if (!updateNeededArray[w]) continue;
    if (FrameDocument[w].defaultView.Pin.isPinned) var bk = FrameDocument[w].defaultView.Pin.display.shortName;
    else bk = Location.getBookName();
    var icons = FrameDocument[w].getElementsByClassName("listenlink");
    for (var i = 0; i < icons.length; ++i) {
      var icon = icons[i];
//icon.style.visibility = "visible"; continue;
      if (AudioDirs === null) AudioDirs = getAudioDirs();
      if (getAudioForChapter(Win[w].modName, bk, Number(icon.id.split(".")[1]), AudioDirs)) icon.style.visibility = "visible";
    }
  }
}

var HideCR;
function hideEmptyCrossRefs(updateNeededArray) {
  for (var w=1; w<updateNeededArray.length; w++) {
    if (!updateNeededArray[w]) continue;
    if (Win[w].modType != BIBLE) {continue;}
    var notes = TextCache[w].fn.CrossRefs;
    if (!notes) continue;
    notes = notes.split("<nx>");
    for (var n=0; n<notes.length; n++) {
      if (!notes[n]) continue;
      notes[n] = notes[n].split("<bg>");
      notes[n][1] = notes[n][1].split(";");
      if (!notes[n][1].length) continue;
      var hideCR = true;
      for (var r=0; r<notes[n][1].length; r++) {
        if (findAVerseText(Win[w].modName, notes[n][1][r]).text.length > 7) {
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

// Saves window's display information to a display object
function saveWindowDisplay(win) {
  var display = {modName:null, shortName:null, chapter:null, verse:null, key:null, globalOptions:{}};
  display.modName = win.modName;
  display.shortName = Location.getBookName();
  display.chapter = Location.getChapterNumber(win.modName);
  display.verse = Location.getVerseNumber(win.modName);
  display.key = getPrefOrCreate("ShowingKey" + win.modName, "Unicode", "");
  display.showingOrig = prefs.getBoolPref("ShowOriginal" + win.number);
  display.maximizeNoteBox = prefs.getBoolPref("MaximizeNoteBox" + win.number);

  for (var cmd in GlobalToggleCommands) {
  if (GlobalToggleCommands[cmd] == "User Notes") 
    display.globalOptions["cmd_xs_toggleUserNotes"] = prefs.getCharPref(GlobalToggleCommands[cmd]);
  else display.globalOptions[cmd] = Bible.getGlobalOption(GlobalToggleCommands[cmd]);
  }
  
  return display;
}

// Set window's display information from a display object
// Normally we are setting global option prefs temporarily, or setting them
// back to their toggle button status, therefore no toggle button or pref updates are performed.
function setWindowDisplay(win, display) {
  Location.setLocation(display.modName, display.shortName + "." + display.chapter + "." + display.verse);
  setUnicodePref("ShowingKey" + win.modName, display.key);
  prefs.setBoolPref("ShowOriginal" + win.number, display.showingOrig);
  prefs.setBoolPref("MaximizeNoteBox" + win.number, display.maximizeNoteBox);
  
  for (var cmd in GlobalToggleCommands) {
    if (GlobalToggleCommands[cmd] == "User Notes")
      prefs.setCharPref(GlobalToggleCommands[cmd], display.globalOptions[cmd]);
    else Bible.setGlobalOption(GlobalToggleCommands[cmd], display.globalOptions[cmd]);
  }
}

//Writes a Bible chapter, including the chapterNavigationLink at top and bottom, to
//either a link of windows, or a single window. Text flows either left-to-right through the link
//or right-to-left depending on isRTL flag. Bible text, Bible notes, and connectors
//for the link are all updated by this routine.
function writeToScriptBoxes(win, isPinned, display, scrollTypeFlag) {
  var s = {link:{}};
  if (Link.isLink[win.number]) {
    for (var par in Link) {s.link[par] = Link[par];}
  }
  else s.link = getLinkInfoForWindow(win.number);
  s.win = win;
  s.isPinned = isPinned;
  s.scrollTypeFlag = scrollTypeFlag;
  if (s.scrollTypeFlag==SCROLLTYPEENDSELECT) s.scrollTypeFlag=SCROLLTYPEEND;
  if (Location.getVerseNumber(s.win.modName) == 1 && s.scrollTypeFlag == SCROLLTYPECENTER) s.scrollTypeFlag = SCROLLTYPEBEG;
  // If we're scrolling to the top, set Bible or Pin to verse 1
  if (s.scrollTypeFlag == SCROLLTYPETOP) {
    if (FrameDocument[s.link.startWin].defaultView.Pin.isPinned) {
      var tpin = FrameDocument[s.link.startWin].defaultView.Pin;
      tpin.updatePin(tpin.shortName, tpin.chapter, 1);
      tpin.updateLink();
    }
    Location.setVerse(s.link.modName, 1, 1);
    s.scrollTypeFlag = SCROLLTYPEBEG
  }
  
  s.navlinks = FrameDocument[s.link.firstWin].defaultView.getPageLinks();

  if (needToInitText(s, TextCache[s.link.firstWin], display)) initTextCache(s, TextCache[s.link.firstWin], display);
  //else jsdump("USING CACHE");

  for (var i=s.link.startWin; i<=s.link.finishWin; i++) {
    FrameDocument[i].defaultView.ConnectorElement.style.visibility = (Win[i].isLinkedToNext ? "visible":"hidden");
    FrameDocument[i].defaultView.FrameDocumentHavingNoteBox = FrameDocument[s.link.lastWin];
    for (var m in TextCache[s.link.firstWin].fn) {FrameDocument[i].defaultView.MyFootnotes[m] = TextCache[s.link.firstWin].fn[m];}
  }
  
  // if note box is maximized make necessary adjustments
  s.lastWindowNotesAreMaximized = prefs.getBoolPref("MaximizeNoteBox" + s.link.lastWin) &&
                                  !prefs.getBoolPref("ShowOriginal" + win.number);
  if (s.lastWindowNotesAreMaximized && !ScriptBoxIsEmpty[s.link.firstWin]) {
    FrameDocument[s.link.lastWin].defaultView.ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
    FrameDocument[s.link.lastWin].defaultView.ScriptBoxTextElement.innerHTML="";
    FrameDocument[s.link.lastWin].defaultView.setBibleHeight(false, false);
    s.maximizedNotesWin = s.link.lastWin;
    s.link.lastWin += (s.link.lastWin-s.link.firstWin>=0 ? -1:1);
    s.link.numWins--;
  }

  s.forceNoteBox2Hide = prefs.getBoolPref("ShowOriginal" + win.number) ||
                        s.lastWindowNotesAreMaximized ||
                        ScriptBoxIsEmpty[s.link.firstWin]; //If last window notes are max'mzd this is second to last window, so hide!

  var firstVerseInLink;
  var notes, userNotes;
  if (s.link.numWins>1) {
    text2LinkedWindows(TextCache[s.link.firstWin], s, TextCache[s.link.firstWin].fn);
    firstVerseInLink = new RegExp("id=\"vs\\.([^\\.]+\\.\\d+\.\\d+)");
    firstVerseInLink = FrameDocument[s.link.firstWin].defaultView.ScriptBoxTextElement.innerHTML.match(firstVerseInLink);
    if (TextCache[s.link.firstWin].fn.Notes) notes = filterNotes(TextCache[s.link.firstWin].fn.Notes, TextCache[s.link.firstWin]);
    else notes = NOTFOUND;
    if (TextCache[s.link.firstWin].fn.UserNotes) userNotes = filterNotes(TextCache[s.link.firstWin].fn.UserNotes, TextCache[s.link.firstWin]);
    else userNotes = NOTFOUND;
    if (!s.forceNoteBox2Hide)
      FrameDocument[s.link.lastWin].defaultView.copyNotes2Notebox(notes, userNotes);
  }
  else {
    notes = TextCache[s.link.firstWin].fn.Notes;
    userNotes = TextCache[s.link.firstWin].fn.UserNotes;
    FrameDocument[s.link.firstWin].defaultView.ScriptBoxTextElement.scrollTop = 0; // prevents window from flashing white
    FrameDocument[s.link.firstWin].defaultView.ScriptBoxTextElement.innerHTML = (ScriptBoxIsEmpty[s.link.firstWin] ? "":s.navlinks + TextCache[s.link.firstWin].text + s.navlinks);
    if (!s.forceNoteBox2Hide) FrameDocument[s.link.firstWin].defaultView.copyNotes2Notebox(notes, userNotes);
  }
  FrameDocument[s.link.lastWin].defaultView.setBibleHeight(false, s.forceNoteBox2Hide);

  for (var i=s.link.startWin; i<=s.link.finishWin; i++) {adjustChapnum(i);}

  //Write maximized notes in last window if needed
  if (s.lastWindowNotesAreMaximized && !ScriptBoxIsEmpty[s.link.firstWin]) {
    FrameDocument[s.maximizedNotesWin].defaultView.copyNotes2Notebox(notes, userNotes);
  }
  if (s.win.modType==BIBLE) {
    for (i=s.link.startWin; i<=s.link.finishWin; i++) {
      hilightUserNotes(TextCache[s.link.firstWin].fn.UserNotes, i);
    }
  }
  if (scrollTypeFlag==SCROLLTYPEEND && !isPinned && firstVerseInLink) Location.setLocation(s.win.modName, firstVerseInLink[1]);
//for (var par in s) {jsdump("s." + par + ":" + s[par]); for (var par2 in s[par]) {if (par != "navlinks") jsdump("\ts." + par + "." + par2 + ":" + s[par][par2]);}}
}

// resize chapter header if needed
function adjustChapnum(w) {
  w = FrameDocument[w];
  if (!w) return;
  var f = w.defaultView.ScriptBoxTextElement;
  var hs = f.getElementsByClassName("chapnum");
  if (!hs || !hs.length) return;
  
  // insures scrollbars do not appear during adjustment and stay!
  var tmp = f.style.overflow;
  f.style.overflow = "visible";
  
  for (var i=0; hs && i<hs.length; i++) {
    hs[i].style.overflow = "auto";
    var fs = 22;
    while(fs >= 10 && hs[i].clientWidth < hs[i].scrollWidth) {
      hs[i].style.fontSize = fs + "px";
      fs -= 4;
    }
    hs[i].style.overflow = "";
  }
  f.style.overflow = (tmp ? tmp: "");
}

function needToInitText(s, textCache, display) {
  if (!textCache || !textCache.text || !textCache.text.length || textCache.text.length > MAXTEXTCACHE) {return true;}
  if (s.link.numWins == 1) {return true;} // dont need cache for single windows
  
  // has display changed, or is new reference not in cache
  var initCache = false;
  for (var el in display) {
    if (el == "key" || el == "verse") continue; // only verseKey mods use cacheing
    else if (el == "chapter") {
      if ((Number(textCache.display.chapter) - textCache.numPrependedChaps) > display.chapter) {initCache = true;}
      if ((Number(textCache.display.chapter) + textCache.numAppendedChaps)  < display.chapter) {initCache = true;}
    }
    else if (el == "globalOptions") {
      for (var el2 in display.globalOptions) {
        if (textCache.display.globalOptions[el2] != display.globalOptions[el2]) {initCache = true;}
      }
    }
    else if (textCache.display[el] != display[el]) {initCache = true;}
  }

  return initCache;
}

function initTextCache(s, textCache, display) {
  for (var i=s.link.startWin; i<=s.link.finishWin; i++) {
    TextCache[i].fn.CrossRefs = "";
    TextCache[i].fn.Footnotes = "";
    TextCache[i].fn.Notes = "";
    TextCache[i].fn.UserNotes = "";
  }
  
  for (var el in display) {
    if (el == "globalOptions") {
      if (!textCache.display.globalOptions) textCache.display.globalOptions = {};
      for (var el2 in display.globalOptions) {textCache.display.globalOptions[el2] = display.globalOptions[el2];}
    }
    else textCache.display[el] = display[el];
  }
  
  textCache.ibeg = null;
  textCache.iend = null;
  textCache.numAppendedChaps = 0;
  textCache.doneAppendedChaps = false;
  textCache.numPrependedChaps = 0;
  textCache.donePrependedChaps = false;
  textCache.text = getBodyHTML(s, textCache, 0);
  textCache.modName = s.win.modName;
}
    
function getBodyHTML(s, p, chapOffset) {
//jsdump("getBodyHTML:" + s.win.number + ", " + chapOffset);
  var chapterText;
  var showHeader = (Bible.getGlobalOption("Headings")=="On");
  if (!ScriptBoxIsEmpty[s.link.firstWin]) {
    if (prefs.getBoolPref("ShowOriginal" + s.win.number) && s.win.modType==BIBLE) {
      if (chapOffset && chapOffset != 0) return null; // chapter offsets for interlinear not yet supported
      Bible.setGlobalOption("Strong's Numbers", "On");
      Bible.setGlobalOption("Morphological Tags", "On");
      var version1 = s.win.modName;
      var version2 = (findBookNum(Location.getBookName()) < NumOT ? OrigModuleOT:OrigModuleNT);
      chapterText = FrameDocument[s.link.firstWin].defaultView.Bible.getChapterTextMulti(version1 + "," + version2, Location.getLocation(version1)).replace("interV2", "vstyle" + version2, "gm");
      Bible.setGlobalOption("Strong's Numbers", prefs.getCharPref("Strong's Numbers"));
      Bible.setGlobalOption("Morphological Tags", prefs.getCharPref("Morphological Tags"));
    }
    else chapterText = FrameDocument[s.link.firstWin].defaultView.getChapterWithNotes(p.fn, p.display.chapter, chapOffset);
  }
  
  if (showHeader && chapterText) {
    var showBook = s.isPinned;
    showBook |=  ((s.scrollTypeFlag==SCROLLTYPENONE || s.scrollTypeFlag==SCROLLTYPEBEG || Location.getChapterNumber(s.win.modName)==1) && chapOffset==0);
    if (chapterText)
      chapterText = FrameDocument[s.link.firstWin].defaultView.getScriptBoxHeader(Location.getBookName(), Number(p.display.chapter)+chapOffset, s.win.modName, showBook, false, prefs.getBoolPref("ShowOriginal" + s.win.number)) + chapterText;
  }
  return chapterText;
}

function filterNotes(notes, p) {
//jsdump(p.text.substr(p.imin,32) + ", " + p.text.substr(p.imax, 32));
  const nsep = "<nx>";
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

  var xsn = "^" + XSNOTE + "<bg>";
  notes = notes.split(nsep);
  for (i=0; i<notes.length; i++) {
    loc = notes[i].match(xsn);
    if (!loc) continue;
    if (Number(loc[4])<minch || (Number(loc[4])==minch && Number(loc[5])<minvs)) continue;
    if (Number(loc[4])>maxch || (Number(loc[4])==maxch && Number(loc[5])>maxvs)) continue;
    retval += notes[i] + nsep;
  }

  return retval;
}

const PREPEND = 0;
const CENTER = 1;
const APPEND = 2;
function text2LinkedWindows(p, s, fn) {
  var chapter = Location.getChapterNumber(s.win.modName);
  var verse = Location.getVerseNumber(s.win.modName);
  var lastverse = Location.getLastVerseNumber(s.win.modName);
  var wstep = (s.link.startWin == s.link.firstWin ? 1:-1);
  p.imin = -1;
  p.imax = -1;
  for (var i=s.link.firstWin; i!=s.link.lastWin+wstep; i += wstep) {
    FrameDocument[i].defaultView.ScriptBoxTextElement.scrollTop = 0;
    FrameDocument[i].defaultView.NoteBoxEmpty = true;
    FrameDocument[i].defaultView.NoteBoxElement.scrollTop = 0; // prevents window from flashing white
    FrameDocument[i].defaultView.NoteBoxElement.innerHTML = "";
    FrameDocument[i].defaultView.PreviousT = "";
    FrameDocument[i].defaultView.setBibleHeight(false, (i!=s.link.lastWin ? true:s.forceNoteBox2Hide));
  }

  // center scroll...
  if (s.scrollTypeFlag == SCROLLTYPECENTER || s.scrollTypeFlag == SCROLLTYPECENTERALWAYS) {
//jsdump("Center scrolling to verse " + verse);
    p.iend = getIndexOfVerse(p, chapter, verse, CENTER);
    if (s.link.numWins > 2) {
      // three page link...
      fitPage(2, CENTER, p, s, fn, false, false);
      var p1end = p.ibeg;
      fitPage(s.link.lastWin, APPEND, p, s, fn, false, s.navlinks);
      p.ibeg = p1end;
      if (!fitPage(s.link.firstWin, PREPEND, p, s, fn, s.navlinks, false)) {
//jsdump("Recalculating center scroll...");
        beginningScroll(0, p, s, fn)
        return;
      }
    }
    else {
      // two page link...
      fitPage(s.link.firstWin, CENTER, p, s, fn, s.navlinks, false);
      fitPage(s.link.lastWin, APPEND, p, s, fn, false, s.navlinks);
    }
  }
  // end scroll...
  else if (s.scrollTypeFlag==SCROLLTYPEEND) {
//jsdump("End scrolling to verse " + verse);
    p.ibeg = getIndexOfVerse(p, chapter, lastverse, PREPEND);
    var check = true;
    for (i=s.link.lastWin; i!=s.link.firstWin-wstep; i-=wstep) {
      if (!fitPage(i, PREPEND, p, s, fn, (i==s.link.firstWin ? s.navlinks:false), (i==s.link.lastWin ? s.navlinks:false))) {
//jsdump("Recalculating end scroll...");
        beginningScroll(0, p, s, fn)
        return;
      }
      // we must start over if the note box just turned on and caused a scroll bar on last page!
      if (check && !FrameDocument[s.link.lastWin].defaultView.NoteBoxEmpty) {
        if (FrameDocument[s.link.lastWin].defaultView.ScriptBoxTextElement.scrollHeight > FrameDocument[s.link.lastWin].defaultView.ScriptBoxTextElement.clientHeight) {
//jsdump("Restarting end scroll, this time with note box on...");
          i = s.link.lastWin + wstep;
          p.ibeg = getIndexOfVerse(p, chapter, verse, PREPEND);
          p.imax = -1;
          p.imin = -1;
        }
        check = false; // come here only once, after notebox has been turned on
      }
    }
  }
  // beginning scroll...
  else {
    if (s.scrollTypeFlag==SCROLLTYPEBEG) var firstVerse = verse;
    else firstVerse = 1;
    if (!firstVerse || firstVerse < 1) firstVerse = 1;
//jsdump("Beg scrolling to verse " + firstVerse);
    p.iend = getIndexOfVerse(p, chapter, firstVerse, APPEND);
    beginningScroll(p.iend, p, s, fn);
  }
}

function beginningScroll(iend, p, s, fn) {
  p.imin = -1;
  p.imax = -1;
  p.iend = iend;
  var wstep = (s.link.startWin == s.link.firstWin ? 1:-1);
  for (var i=s.link.firstWin; i!=s.link.lastWin+wstep; i += wstep) {
    fitPage(i, APPEND, p, s, fn, (i==s.link.firstWin ? s.navlinks:false), (i==s.link.lastWin ? s.navlinks:false));
  }
}

function getIndexOfVerse(p, chapNum, verseNum, type) {
  if (type == PREPEND) verseNum++;
  
  var vre = new RegExp("\"vs\\.[^\\.]*\\." + chapNum + "\\." + verseNum +"\"");
  var i = p.text.search(vre);
  
  if (i == -1) {
    // verse may just be missing, so find applicable nearest verse or end point.
    var vb, va;
    var verses = new RegExp("\"vs\\.[^\\.]*\\." + chapNum + "\\.(\\d+)\"", "g");
    verses = p.text.match(verses);
    if (!verses) i = 0;
    else {
      for (var x=0; x<verses.length; x++) {
        var vre = new RegExp("\"vs\\.[^\\.]*\\." + chapNum + "\\.(\\d+)\"");
        var n = verses[x].match(vre);
        n = Number(n[1]);
        if (n < verseNum) vb = n;
        if (n > verseNum) va = n;
      }

      var v, endPoint;
      switch (type) {
      case CENTER:
        v = (va ? va:vb);
        endPoint = 0;
        break;

      case PREPEND:
        v = va;
        endPoint = p.text.length-1;
        break;

      case APPEND:
        v = vb;
        endPoint = 0;
        break;
      }
      if (v) {
        vre = new RegExp("\"vs\\.[^\\.]*\\." + chapNum + "\\." + v +"\"");
        i = p.text.search(vre);
      }
      else i = endPoint;
    }
  }
  
  // include any title and chapter headings before the verse
  if (i != 0 && i != p.text.length) {
    i = p.text.lastIndexOf("<", i);
    var prevchap = p.text.lastIndexOf(NewChapter, i-1);
    var prevtitle = p.text.lastIndexOf(Titles, i-1);
    var preverse = p.text.lastIndexOf(Vtext1, i-1);
    if (prevtitle > preverse) i = prevtitle;
    if (prevchap > preverse) i = prevchap;
  }

  return i;
}

function fitPage(fnum, type, p, s, fn, header, footer) {
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
      itest = appendVerse(f, p, s, fn, header, footer);
      if (f.scrollHeight <= f.clientHeight) p.iend = itest;
    }
    else {
      itest = prependVerse(f, p, s, fn, header, footer);
      if (f.scrollHeight <= f.clientHeight) p.ibeg = itest;
      // if we're at the beginning of the book with nothing left to prepend return error condition.
      if (p.ibeg==0 && type==PREPEND && Number(p.display.chapter)+p.numPrependedChaps <= 1) return false;
    }
    if (type==CENTER) sw = !sw;
  }
  while (f.scrollHeight <= f.clientHeight && p.iend < p.text.length);
  
  // remove the scrollbars that are likely there!
  f.innerHTML = ""; var dummy = f.scrollHeight;
  var ind = "";
  var i = p.ibeg - 7 - indnt.length; // 7 = length of </span>
	while(p.text.substr(i, indnt.length) == indnt) {ind += indnt; i -= indnt.length;}
  f.innerHTML = header + ind + p.text.substring(p.ibeg, p.iend) + footer;
  if (p.imin==-1 || p.imin > p.ibeg) p.imin = p.ibeg;
  if (p.imax==-1 || p.imax < p.iend) p.imax = p.iend;
  return true;
}

function appendVerse(f, p, s, fn, header, footer, intend, appendExtraVerse) {
  intend = (intend ? intend:p.iend); // allow us to use interim endpoint without changing p.iend
  // Find next closest verse or title start point. If we're starting at a title, append an extra verse.
  var itest = p.text.indexOf(Vtext1, intend+1);
  if (appendExtraVerse === undefined) {
    var title = p.text.indexOf(Titles, intend-1);
    var title2 = p.text.indexOf(NewChapter, intend-1);
    if (title2 != -1 && (title == -1 || title2 < title)) title = title2;
    if (title != -1 && title == intend) return appendVerse(f, p, s, fn, header, footer, title, true);
    if (title != -1 && title < itest) itest = title;
  }
  // append more chapter text if we couldn't progress...
  if (itest == -1) {
    if (!p.doneAppendedChaps) { // don't even try if we've already done so
      p.numAppendedChaps++;
      var newtext = getBodyHTML(s, p, p.numAppendedChaps);
      if (newtext) {
        p.text += (Bible.getGlobalOption("Headings")=="On" ? FrameDocument[1].defaultView.HTMLbr:FrameDocument[1].defaultView.HTMLbr0);
        itest = p.text.length;
        p.text += newtext;
      }
      else {
        p.numAppendedChaps--;
        p.doneAppendedChaps = true;
        itest = p.text.length;
      }
    }
    else itest = p.text.length;
  }
  if (appendExtraVerse) return appendVerse(f, p, s, fn, header, footer, itest, false);

  checkNoteBox(p.imax, itest, p, s, fn);
  var ind = "";
  var i = p.ibeg - 7 - indnt.length; // 7 = length of </span>
	while(p.text.substr(i, indnt.length) == indnt) {ind += indnt; i -= indnt.length;}
  f.innerHTML = header + ind + p.text.substring(p.ibeg, itest) + footer;
  
  return itest;
}

function prependVerse(f, p, s, fn, header, footer) {
  var itest = (p.ibeg > 0 ? p.text.lastIndexOf(Vtext1, p.ibeg-1):-1);

  if (itest == -1) {
    if (!p.donePrependedChaps) { // don't even try if we've already done so
      p.numPrependedChaps--;
      var newtext = getBodyHTML(s, p, p.numPrependedChaps);
      if (newtext) {
        newtext = newtext + (Bible.getGlobalOption("Headings")=="On" ? FrameDocument[1].defaultView.HTMLbr:FrameDocument[1].defaultView.HTMLbr0);
        p.text =  newtext + p.text;
        p.ibeg = p.ibeg + newtext.length;
        p.iend = p.iend + newtext.length;
        p.imin = p.imin + newtext.length;
        p.imax = p.imax + newtext.length;
      }
      else {
        p.numPrependedChaps++;
        p.donePrependedChaps = true;
      }
      itest = p.text.lastIndexOf(Vtext1, p.ibeg-1);
    }
    if (itest == -1) itest = 0;
  }
  
  // if a title and/or chapter heading preceeds this verse, include it too
  var prevchap = p.text.lastIndexOf(NewChapter, itest-1);
  var prevtitle = p.text.lastIndexOf(Titles, itest-1);
  var preverse = p.text.lastIndexOf(Vtext1, itest-1);
  if (prevtitle > preverse) itest = prevtitle;
  if (prevchap > preverse) itest = prevchap;
  checkNoteBox(itest, p.imin, p, s, fn);
  var ind = "";
  var i = itest - 7 - indnt.length; // 7 = length of </span>
	while(p.text.substr(i, indnt.length) == indnt) {ind += indnt; i -= indnt.length;}
  f.innerHTML = header + ind + p.text.substring(itest, p.iend) + footer;

  return itest;
}

function checkNoteBox(beg, end, p, s, fn) {
  if (beg == -1) beg = p.ibeg; // fix first pass
  if (end == -1) end = p.iend;
  if (!s.forceNoteBox2Hide && FrameDocument[s.link.lastWin].defaultView.NoteBoxEmpty) {
    // check new verse for footnotes and if found turn note box on!
    var fn = new RegExp("id=\"(fn|cr|un)\\.");
    if (fn.fn && p.text.substring(beg, end).match(fn)) {
      FrameDocument[s.link.lastWin].defaultView.NoteBoxEmpty = false;
      FrameDocument[s.link.lastWin].defaultView.setBibleHeight(false, s.forceNoteBox2Hide);
    }
  }
}


function hilightUserNotes(userNotes, frameNumber) {
  if (!userNotes) return;
  userNotes = userNotes.split("<nx>"); //UserNotes + myid + "<bg>" + note + "<nx>";
  userNotes.pop();
  for (var i=0; i<userNotes.length; i++) {
    var userNote = userNotes[i].split("<bg>");
    if (userNote && userNote[0]) {
      window.setTimeout("FrameDocument[" + frameNumber + "].defaultView.markUserNoteVerse('" + userNote[0] + "');",0);
    }
  }
}

function scrollScriptBoxes(updateNeededArray, scrollTypeFlag) {
  if (!updateNeededArray) updateNeededArray = [false, true, true, true];
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (!updateNeededArray[w]) continue;
    FrameDocument[w].defaultView.scrollScriptBox(scrollTypeFlag);
  }
}

var SavedUpdatesNeeded;
function resizeScriptBoxes(resizeOnly) {
  // Order is 1,2,3 because Frame 1 has the chooser, and the chooser size must be
  // defined before any Frames can be properly sized
  hideFrames();
  // Extra stuff in this loop helps make the transition look smoother.
  for (var w=1; w<=3; w++) {
    //Done in resizeBibles(): FrameDocument[w].defaultView.ScriptBoxTextElement.innerHTML="";
    if (!resizeOnly) {
      FrameDocument[w].defaultView.NoteBoxElement.scrollTop = 0; // prevents window from flashing white
      FrameDocument[w].defaultView.NoteBoxElement.innerHTML = "";
      FrameDocument[w].defaultView.PreviousT="";
    }
    FrameDocument[w].defaultView.resizeBibles(resizeOnly, true);
    if (w<=prefs.getIntPref("NumDisplayedWindows")) updateTabsFromHiddenModPrefs(w);
  }
  if (!resizeOnly) {
    updateLinkInfo();
    updateLocators(FORCEREDRAW);
  }
  showFrames();
  //Using the following timeout seemed to fix a problem with script box linking, where
  //scrollbars would inappropriately appear in frame 1 or 2 due to improper fitting of text.
  //This seems to be related to when showFrames() occurs.
  //We must update scriptboxes because innerHTMLs are null at this point
  if (!resizeOnly) window.setTimeout("updateFrameScriptBoxes(''," + SCROLLTYPECENTER + "," + HILIGHT_IFNOTV1 + "," + NOUPDATELOCATOR + ");",0);
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
  updateLinkInfo();
}

/************************************************************************
 * Chooser Control Functions
 ***********************************************************************/ 
 //Updates the chooser and the Text Navigator based on the Bible's current book/chapter/verse
function updateLocators(locatorFlag) {
  var myvers = firstDisplayBible();
  var bNum = Bible ? findBookNum(Location.getBookName()):-1;
  if (prefs.getBoolPref("ShowChooser") && !prefs.getBoolPref("ShowGenBookChooser")) {
    // Take background style away from all chaps
    for (var b=0; b < NumBooks; b++) {
      FrameDocument[1].getElementById("book." + b).style.background = FrameDocument[1].defaultView.NormalBookBackground;
    }
    // Assign special background for this chapter only
    if (bNum>=0) FrameDocument[1].getElementById("book." + bNum).style.background = FrameDocument[1].defaultView.SelectedBookBackground;
  
    // Bring forward the correct chooser
    var forceChooserRedraw = (locatorFlag && locatorFlag == FORCEREDRAW);
    if ((bNum <  NumOT)&&(forceChooserRedraw||(FrameDocument[1].getElementById("chooserNT").style.visibility == "visible"))) 
        FrameDocument[1].defaultView.showChooser("OT",forceChooserRedraw);
    if ((bNum >= NumOT)&&(forceChooserRedraw||(FrameDocument[1].getElementById("chooserOT").style.visibility == "visible"))) 
        FrameDocument[1].defaultView.showChooser("NT",forceChooserRedraw);
  }
  //Update the input boxes in XUL
  if (Bible) {
    document.getElementById("book").book = Book[bNum].sName;
    document.getElementById("book").version = myvers;
    document.getElementById("chapter").value = dString(Location.getChapterNumber(myvers));
    document.getElementById("verse").value = dString(Location.getVerseNumber(myvers));
  }
}

function toggleChooser() {
  prefs.setBoolPref("ShowChooser", !prefs.getBoolPref("ShowChooser"));
  for (var w=1; w<=3; w++) {setNoteBoxSizer(w, false);}
  updateChooserVisibility();
  resizeScriptBoxes();
}

function updateChooserVisibility() {
  var showBibleChooser = prefs.getBoolPref("ShowChooser") && !prefs.getBoolPref("ShowGenBookChooser");
  var showGetBookChooser = prefs.getBoolPref("ShowGenBookChooser");
  FrameDocument[1].getElementById("wholeChooser").style.visibility = showBibleChooser ? "visible":"hidden";
  if (!showBibleChooser) {
    FrameDocument[1].getElementById("chooserNT").style.visibility = "hidden";
    FrameDocument[1].getElementById("chooserOT").style.visibility = "hidden";    
    FrameDocument[1].getElementById("testamentChooser").style.visibility = "hidden";
    FrameDocument[1].getElementById("chbutClose").style.visibility = "hidden"; 
  }
  FrameDocument[1].getElementById("chbutOpen").style.visibility = !showBibleChooser && !showGetBookChooser ? "visible":"hidden";
  
  var genBookChooserElement = document.getElementById("genBookChooser");
  genBookChooserElement.style.visibility = (showGetBookChooser ? "visible":"hidden");
  genBookChooserElement.style.display = (showGetBookChooser ? "":"none");
}

/************************************************************************
 * Version and Tab Control Functions
 ***********************************************************************/ 
var UpdateTabs; 
function setVersionTo(w, version) {
  var fdb = firstDisplayBible(true); // capture before changing prefs...
  if (version == ORIGINAL) {
    prefs.setBoolPref("ShowOriginal" + w,!prefs.getBoolPref("ShowOriginal" + w));
  }
  else {
    prefs.setBoolPref("ShowOriginal" + w, false);
    changeVersionPref(w, version);
    if (w==fdb || fdb!=firstDisplayBible(true)) window.setTimeout("disableMissingBooks(" + getPrefOrCreate("HideDisabledBooks", "Bool", false) + ")", 200);
  }
  updateLinkInfo();
}

function changeVersionPref(w, version) {
  prefs.setCharPref("Version" + w, version);
  Win[w].modName = version;
  if (Bible) var dir = Bible.getModuleInformation(version, "Direction");
  Win[w].isRTL = (dir ? dir.search("RtoL","i")!=-1:false);
  Win[w].modType = getModuleLongType(version);
  updateORIGtab(w);
  var genbookinfo = getGenBookInfo();
  prefs.setBoolPref("ShowGenBookChooser", genbookinfo.numUniqueGenBooks>0);
  if (FrameDocument[w].defaultView.Pin.elem) {
    if (FrameDocument[w].defaultView.Pin.isPinned) {
      FrameDocument[w].defaultView.Pin.isPinned = false;
      FrameDocument[w].defaultView.setFramePinStyle(false);
    }
    updatePinVisibility();
  }
}

function disableMissingBooks(hideDisabledBooks) {
  var vers = firstDisplayBible();
  var availableBooks = getAvailableBooks(vers);
  for (var b=0; b<NumBooks; b++) {
    var belem = FrameDocument[1].getElementById("book." + b);
    var aelem = FrameDocument[1].getElementById("arrow." + b);
    var isAvailable = false;
    for (var a=0; availableBooks && a<availableBooks.length; a++) {if (Book[b].sName==availableBooks[a]) {isAvailable=true; break;}}
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
// This needs to be run when pinning/unpinning, or changing the selected version of a window
function updateTabLabelsAndStyles(initializing) {
  for (var w=1; w<=3; w++) {FrameDocument[w].defaultView.PreviousT="";}
  
  // minimize noteboxes which aren't being shown so we aren't surprised by them later.
  // only last window in a link needs the notebox maximize button
  for (w=1; w<=3; w++) {
    var hidebutton = !Link.isLink[w];
    hidebutton |= (Link.isLink[w] && w != Link.lastWin);
    FrameDocument[w].getElementById("nbsizer").style.visibility = (hidebutton ? "hidden":"visible");
    if (hidebutton && !initializing) setNoteBoxSizer(w, false);
  }
  
  for (w=1; w<=3; w++) {
    updateORIGtab(w);
    for (var b=0; b<Tabs.length; b++) {
      var tabClasses = {normal:null, selected:null};
      getTabClasses(w, b, tabClasses);

      var myTabElement = FrameDocument[w].getElementById("tab" + b);
      //myTabElement.value = Tabs[b].label;
      if (prefs.getBoolPref("ShowOriginal" + w) && Tabs[b].isOrigTab && Win[w].modType == BIBLE)
        myTabElement.className = tabClasses.selected;
      else if (Tabs[b].isOrigTab) {
        // retain tabDisabled setting!
        if (myTabElement.className.search("tabDisabled")!=-1) myTabElement.className = "tabDisabled " + tabClasses.normal;
        else myTabElement.className= tabClasses.normal;
      }
      else myTabElement.className = ((b == Tab[Win[w].modName].index) ? tabClasses.selected:tabClasses.normal);
    }
    
    updateSelectTab(w);
  }
}
    
function updateSelectTab(aWindowNum) {
  for (var b=0; b<Tabs.length; b++) {
    var mySelectTabOption = FrameDocument[aWindowNum].getElementById("seltab" + b);
    if (mySelectTabOption) {
      var tabClasses = {normal:null, selected:null};
      getTabClasses(aWindowNum, b, tabClasses);
      mySelectTabOption.className = tabClasses.normal;
      var mySelectTab = FrameDocument[aWindowNum].getElementById("seltab.menu");
      if (mySelectTab.value==mySelectTabOption.value) {
        mySelectTab.className = ((b == Tab[Win[aWindowNum].modName].index) ? tabClasses.selected:tabClasses.normal);
      }
      if (mySelectTab.className.search("tabDisabled")!=-1 || mySelectTab.className.search("scriptboxPinnedSelTab")!=-1) mySelectTab.setAttribute("disabled", "disabled");
      else mySelectTab.removeAttribute("disabled");
    }
  }
  FrameDocument[aWindowNum].defaultView.setSelTabDirection();
}

function updateORIGtab(w) {
  var origtab = null;
  for (var t=0; t<Tabs.length; t++) {
    if (Tabs[t].isOrigTab) {
      origtab = t;
      break;
    }
  }
  if (!origtab) return;
  var ot = FrameDocument[w].getElementById("tab" + origtab);
  var tw = Tab[Win[w].modName].index;
  if (Win[w].modType == BIBLE && isTabShowing(tw, w)) ot.className = ot.className.replace(/\s*tabDisabled\s*/g, "");
  else if (ot.className.search("tabDisabled")==-1) ot.className = "tabDisabled " + ot.className;
}

function getTabClasses(aWindowNum, aTabNum, retobj) {
  var tabClass = (FrameDocument[aWindowNum].defaultView.Pin.isPinned ? "tabDisabled ":"");
  var selectedtabClass = (FrameDocument[aWindowNum].defaultView.Pin.isPinned ? "scriptboxPinnedSelTab ":"");
  
  tabClass += " tabs tab" + Tabs[aTabNum].tabType + " vstyle" + Tabs[aTabNum].vstyle;
  selectedtabClass += " tabs tab" + Tabs[aTabNum].tabType + " seltab vstyle" + Tabs[aTabNum].vstyle;
  
  retobj.selected = selectedtabClass;
  retobj.normal = tabClass;
}

function initTabHiddenPrefs() {
  //On the first time through, set up default tab view settings since they
  //will be needed by the coming getPrefOrCreate if we are using a new profile.
  var allComms="";
  var allDicts="";
  var allGenbks="";
  var someBibles="";
  for (var t=0; t<Tabs.length; t++) {
    var keepBible = (Tabs[t].isOrigTab || getLocaleOfModule(Tabs[t].modName) || Tabs[t].modName==prefs.getCharPref("DefaultVersion"));
    someBibles  += (Tabs[t].modType==BIBLE && !keepBible ? Tabs[t].modName + ";":"");
    allComms    += (Tabs[t].modType==COMMENTARY ? Tabs[t].modName + ";":"");
    allDicts    += (Tabs[t].modType==DICTIONARY ? Tabs[t].modName + ";":"");
    allGenbks   += (Tabs[t].modType==GENBOOK ? Tabs[t].modName + ";":"");
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
        for (var t=0; t<Tabs.length; t++) {if (mypref[m]==Tabs[t].modName) continue HIDDENMODS;}
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
function toggleHiddenModPref(tabNum, aWindowNum) {
  if (tabNum==null || aWindowNum==null) return null;
  var oldpref = prefs.getCharPref("Hidden" + Tabs[tabNum].tabType + aWindowNum);
  var version = new RegExp("(^|;)" + escapeRE(Tabs[tabNum].modName) + ";");
  var showTab = (oldpref.search(version)!=-1);
  var newprefval = (showTab ? oldpref.replace(version, "$1"):oldpref + Tabs[tabNum].modName + ";")
  prefs.setCharPref("Hidden" + Tabs[tabNum].tabType + aWindowNum, newprefval);
  return showTab;
}

function removeFromHiddenModPref(modNameArray, aWindowNum) {
  if (!modNameArray || !modNameArray.length) return;
  var needUpdate = false;
  for (var i=0; i<modNameArray.length; i++) {
    if (!Tab[modNameArray[i]]) continue;
    if (!isTabShowing(Tab[dontHideArray[i]].index, aWindowNum)) {
      toggleHiddenModPref(Tab[modNameArray[i]].index, aWindowNum);
      needUpdate = true;
    }
  }
  if (needUpdate) updateModuleMenuCheckmarks();
}

function fitTabs(aWindowNum) {
  if (aWindowNum>prefs.getIntPref("NumDisplayedWindows")) return;
  var seltab = FrameDocument[aWindowNum].getElementById("seltab.menu");
    
  // Shrink or move tabs if there are too many to fit
  seltab.style.display="none";
  var twMargin = getTabWidthMargin(aWindowNum);
  if (!twMargin || twMargin>0) return;
  
  seltab.style.display=""; 
  try {var showingOrig = prefs.getBoolPref("ShowOriginal" + aWindowNum);}
  catch (er) {showingOrig=false;}
  var html = "";
  
  var tmargin = 140;
  var finished = quickSetTabsToMargin(tmargin, aWindowNum);
  while (!finished && getTabWidthMargin(aWindowNum)<0) {
    tmargin += 20;
    finished = quickSetTabsToMargin(tmargin, aWindowNum);
  }
}

function quickSetTabsToMargin(margin, w) {
  var frameDoc = FrameDocument[w];
  var frameWin = frameDoc.defaultView;
  var scriptBoxW = frameWin.FrameWidth - frameWin.MarginEnd - frameWin.MarginStartOfScriptBox;  
  var gap = scriptBoxW - margin - 20 - 40; // 20 for margin scrollbar-side, 40 for margin pin-side
  var numVisibleTabs = 0;
  // ORIG tab can't be hidden, so if it's showing, make space for it first
  for (t=0; t<Tabs.length; t++) {
    if (!Tabs[t].isOrigTab) continue;
    if (isTabShowing(t, w)) {
      numVisibleTabs++;
      gap = gap - FrameDocument[w].getElementById("tab" + t).offsetWidth + 6;
    }
    break;
  }
  // add tabs until gap is full
  for (var t=0; t<Tabs.length; t++) {
    if (Tabs[t].isOrigTab) continue;
    if (!isTabShowing(t, w)) continue;
    gap = gap - (FrameDocument[w].getElementById("tab" + t).offsetWidth + 6); // 6 for margin between tabs
    if (gap < 0) break;
    numVisibleTabs++;
  }
  // place remaining tabs in seltab
  var html = "";
  for (var ts=t; ts<Tabs.length; ts++) {
    if (Tabs[ts].isOrigTab) continue;
    if (!isTabShowing(ts, w)) continue;
    html += "<option id=\"seltab" + ts + "\" style=\"margin:4px; padding-top:2px; height:20px; \"";
    html += (Tabs[ts].modName==Win[w].modName ? " selected=\"selected\"":"");
    html += "onclick=\"tabHandler(event);\" onmouseover=\"tabHandler(event);\" onmouseout=\"tabHandler(event);\"" + ">"
    html += Tabs[ts].label + "</option>";
    FrameDocument[w].getElementById("tab" + ts).style.display="none";  
  }
  FrameDocument[w].getElementById("seltab.menu").innerHTML = html;
  updateSelectTab(w);

  return (numVisibleTabs <= 1);
}

// Adjusts tab visibility based on hidden module prefs. Does NOT redraw anything!
function updateTabsFromHiddenModPrefs(aWindowNum, initializing) {
  var needScriptBoxUpdate = false;
    
  var hiddenModuleString="";
  for (var type in SupportedModuleTypes) {
    hiddenModuleString += prefs.getCharPref("Hidden" + type + aWindowNum);
  }
  
  //Init some vars
  var defVers = prefs.getCharPref("DefaultVersion");
  var noBiblesAreVisible = true;
  for (var t=0; t<Tabs.length; t++) {
    if (Tabs[t].isOrigTab) continue;
    var sversion = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
    if (hiddenModuleString.search(sversion)==-1) {
      defVers = Tabs[t].modName;
      if (Tabs[t].modType==BIBLE) noBiblesAreVisible=false;
      break;
    }
  }

  //Now hide/show tabs
  var numVisibleTabsNotInclORIG = 0;
  var hidingORIG = false;
  for (var t=0; t<Tabs.length; t++) {
    var sversion = new RegExp("(^|;)" + escapeRE(Tabs[t].modName) + ";");
    var hide = (hiddenModuleString.search(sversion)!=-1);
    if (!hide && !Tabs[t].isOrigTab) numVisibleTabsNotInclORIG++;
    FrameDocument[aWindowNum].getElementById("tab" + t).style.visibility = "hidden"; // hide for now so these operations aren't visible
    FrameDocument[aWindowNum].getElementById("tab" + t).style.display = (hide ? "none":"");
    if (hide && Win[aWindowNum].modName == Tabs[t].modName) {
      setVersionTo(aWindowNum, defVers);
      if (UpdateTabs) window.clearTimeout(UpdateTabs);
      if (!initializing) {
        updatePinVisibility();
        updateTabLabelsAndStyles();
        needScriptBoxUpdate = true;
      }
    }
    if (hide && Tabs[t].isOrigTab) hidingORIG = true;
  }
  if (hidingORIG && prefs.getBoolPref("ShowOriginal" + aWindowNum)) {
    setVersionTo(aWindowNum, ORIGINAL); //This toggles ORIGINAL off!
    if (UpdateTabs) window.clearTimeout(UpdateTabs);
    if (!initializing) {
      updatePinVisibility(); 
      updateTabLabelsAndStyles();
      needScriptBoxUpdate = true;
    }
  }

  needScriptBoxUpdate |= (ScriptBoxIsEmpty[aWindowNum] != (numVisibleTabsNotInclORIG <= 0));
  ScriptBoxIsEmpty[aWindowNum] = numVisibleTabsNotInclORIG <= 0;
  
  //On init, skip tab updates for now (they are done separately later during init)
  if (!initializing) fitTabs(aWindowNum);
  for (t=0; t<Tabs.length; t++) {FrameDocument[aWindowNum].getElementById("tab" + t).style.visibility = "visible";}

  return needScriptBoxUpdate;
}

function getTabWidthMargin(aWindowNum) {
  var frameDoc = FrameDocument[aWindowNum];
  var frameWin = frameDoc.defaultView;
  //var scriptBoxWxx = frameDoc.getElementById("scriptBox").offsetWidth;
  var scriptBoxW = frameWin.FrameWidth - frameWin.MarginEnd - frameWin.MarginStartOfScriptBox; //This method works before UI redraw!
  var tabRowW = frameDoc.getElementById("langTabs").offsetWidth;
//jsdump("GET TAB WIDTH MARGIN:" + aWindowNum + ", Margin=" + scriptBoxW + "-" + tabRowW + "-" + frameWin.TabBarMargin);
//jsdump("TabWidthMargin=" + ((!scriptBoxW || !tabRowW) ? null:scriptBoxW - tabRowW - frameWin.TabBarMargin));
  if (!scriptBoxW || !tabRowW) return null;
  return scriptBoxW - tabRowW - frameWin.TabBarMargin;
}

function updateModuleMenuCheckmarks() {
//jsdump("RUNNING UPDATE MODULE MENU CHECKMARKS");
  for (var t=0; t<Tabs.length; t++) {
    var aWindowNum = getRadioSelection(Tabs[t].tabType);
    var checked = true;
    if (aWindowNum <= 3) var sw = aWindowNum;
    else {sw=1; aWindowNum=3;}
    for (var w=sw; w<=aWindowNum; w++) {
      var test = isTabShowing(t, w);
      checked &= test;
    }
    checked = (checked ? "true":"false");
    document.getElementById("modulemenu." + t).setAttribute("checked", checked);
//jsdump(Tabs[t].modName + "=" + checked);
  }
}

function isTabShowing(tabNum, aWindowNum) {
  var hiddenMods = prefs.getCharPref("Hidden" + Tabs[tabNum].tabType + aWindowNum);
  var rt = new RegExp("(^|;)" + escapeRE(Tabs[tabNum].modName) + ";");
  return (hiddenMods.search(rt)==-1);
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
  var updateNeeded = [false];
  for (var w=1; w<=3; w++) updateNeeded[w] = w==frameNum ? true:false;
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
    setUnicodePref("ShowingKey" + version, link);
    if (verse2) CustomScrollFunction = "FrameDocument[" + frameNum + "].defaultView.scrollScriptBox(" + SCROLLTYPECENTER + ", 'par." + verse2 + "');";
    else CustomScrollFunction = "FrameDocument[" + frameNum + "].defaultView.scrollScriptBox(" + SCROLLTYPETOP + ");";
    BookmarkFuns.updateMainWindow(true, updateNeeded, SCROLLTYPECUSTOM);
    break;
  case GENBOOK:
    setUnicodePref("ShowingKey" + version, link);
    //This timeout is needed because RDF may not be ready until after updateScriptBoxes()
    CustomScrollFunction = "{ openGenBookKey(decodeUTF8('" + link2 + "')); selectGenBook(decodeUTF8('" + link2 + "'));";
    if (verse2) CustomScrollFunction += " FrameDocument[" + frameNum + "].defaultView.scrollScriptBox(" + SCROLLTYPECENTER + ", 'par." + verse2 + "'); }";
    else CustomScrollFunction += "FrameDocument[" + frameNum + "].defaultView.scrollScriptBox(" + SCROLLTYPETOP + "); }";
    BookmarkFuns.updateMainWindow(true, updateNeeded, SCROLLTYPECUSTOM);
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
  var numWins = prefs.getIntPref("NumDisplayedWindows");
  var guidir = guiDirection();
  var beg = (guidir=="rtl" ? numWins:1);
  var end = (guidir=="rtl" ? 1-1:numWins+1);
  var step = (guidir=="rtl" ? -1:1);
  var firstUnPinnedWin;
  for (var w=beg; w != end; w+=step) {
    if (FrameDocument[w].defaultView.Pin.isPinned) continue;
    if (!firstUnPinnedWin) firstUnPinnedWin = w;
    if (Win[w].modName == version) return w;
    if (!aWindow && isTabShowing(Tab[version].index, w)) {aWindow = w;}
  }
  if (aWindow == 0) {
    if (!firstUnPinnedWin) return 0;
    aWindow = firstUnPinnedWin;
    toggleHiddenModPref(Tab[version].index, aWindow);
    updateModuleMenuCheckmarks();
  }
  if (UpdateTabs) window.clearTimeout(UpdateTabs);
  setVersionTo(aWindow, version);
  updateTabsFromHiddenModPrefs(aWindow); // needed to select seltab module!!!!
  updateLinkInfo();
  updatePinVisibility();
  updateTabLabelsAndStyles(); 
  return aWindow;
}
 
/************************************************************************
 * Scripture Box Link and Pin Control Functions
 ***********************************************************************/ 

// Needs to be rerun when the following change:
// Version1,2,3 ShowOriginal1,2,3, NumDisplayedWindows, ScriptBoxIsEmpty, Win.isRTL, Win.modName, Pin.isPinned, Pin.display.shortName, Pin.display.chapter, MaximizeNoteBox
// NOTE: startWin is lowest frame number of a link and finishWin is the highest number.
// NOTE: firstWin is frame in which text reading begins and lastWin is frame in which text reading ends.
function updateLinkInfo() {
  Link.modName = null;
  Link.numWins = 0;
  Link.firstWin = 0;
  Link.lastWin = 0;
  Link.startWin = 0;
  Link.finishWin = 0;
  Link.isRTL = false;
  Link.isLink[0] = false;

  for (var w=1; w<=3; w++) {
    Win[w].isLinkedToNext = isLinkedToNext(w);
    Link.isLink[w] = Win[w].isLinkedToNext || (w>1 && Win[w-1].isLinkedToNext);
    if (Link.isLink[w]) Link.numWins++;
    if (Link.isLink[w] && Link.numWins == 1) {
      Link.startWin = w;
      Link.isRTL = Win[w].isRTL;
      Link.modName = Win[w].modName;
    }
  }
  if (Link.numWins) {
    Link.finishWin = Link.startWin + Link.numWins - 1;
    var startIsFirst = (guiDirection() == "rtl" && Link.isRTL) || (guiDirection() != "rtl" && !Link.isRTL);
    Link.firstWin = (startIsFirst ? Link.startWin:Link.finishWin);
    Link.lastWin  = (startIsFirst ? Link.finishWin:Link.startWin);
  }
  for (var w=1; w<=3; w++) {
    Link.isTextLink[w] = (Link.isLink[w] &&
                         !prefs.getBoolPref("MaximizeNoteBox" + w) &&
                         !(Link.numWins==2 && prefs.getBoolPref("MaximizeNoteBox" + Link.lastWin)))
  }
//for (var par in Link) {jsdump(par + ":" + Link[par]);}
}

function getLinkInfoForWindow(w) {
  var link = {}
  link.modName = Win[w].modName;
  link.numWins = 1;
  link.firstWin = w;
  link.lastWin = w;
  link.startWin = w;
  link.finishWin = w;
  link.isRTL = Win[w].isRTL;
  link.isLink = [false, false, false, false];
  link.isTextLink = [false, false, false, false];
  return link;
}

function isLinkedToNext(w) {
  if (w < 1 || w > 2) return false;
  if (w >= prefs.getIntPref("NumDisplayedWindows")) return false;
  if (ScriptBoxIsEmpty[w] || ScriptBoxIsEmpty[w+1]) return false;
  if (Win[w].modType != BIBLE) return false;
  if (prefs.getBoolPref("ShowOriginal" + w)) return false;
  var v = getVersionsWithPinnedInfo();
  if (v[w] == v[w+1]) return true;
  return false;
}

//If only one window, don't show pin icon (unless the window is already pinned!).
//Only Bibles and commentaries (because they track global book/chapter/verse)
//and general books need a pin icon. If ScriptBoxIsEmpty also don't show a pin icon
function updatePinVisibility() {
  var needsPin = [null];
  for (var w=1; w<=3; w++) {
    var needs = FrameDocument[w].defaultView.Pin.isPinned;
    var isPinableType = (Win[w].modType==BIBLE || Win[w].modType==COMMENTARY || Win[w].modType==GENBOOK);
    needs |= (!ScriptBoxIsEmpty[w] && prefs.getIntPref("NumDisplayedWindows") > 1 && isPinableType);
    needsPin.push(needs);
  }
  for (w=1; w<=3; w++) {
    FrameDocument[w].defaultView.Pin.elem.style.visibility = (needsPin[w] ? "visible":"hidden");
  }
}

function getVersionsWithPinnedInfo() {
  var v = new Array(4);
  for (var w=1; w<=3; w++) {
    v[w] = Win[w].modName +
            (prefs.getBoolPref("ShowOriginal" + w) ? "ShowOriginal":"") +
            (FrameDocument[w].defaultView.Pin.isPinned ?
            FrameDocument[w].defaultView.Pin.display.shortName + " " +
            FrameDocument[w].defaultView.Pin.display.chapter:"");
  }
  return v;
}

function getUnpinnedVerseKeyWindows() {
  var wins = [false, false, false, false];
  for (var w=1; w<=3; w++) {
    if (Win[w].modType != BIBLE && Win[w].modType != COMMENTARY) continue;
    wins[w] = !FrameDocument[w].defaultView.Pin.isPinned;
  }
  return wins;
}

function getUnpinnedWindows() {
  var wins = [false, false, false, false];
  for (var w=1; w<=3; w++) {
    wins[w] = !FrameDocument[w].defaultView.Pin.isPinned;
  }
  return wins;
}

function popupkeydown(e) {for (var w=1; w<=3; w++) {FrameDocument[w].defaultView.Popup.keydown(e);}}
function popupkeyup(e)   {for (var w=1; w<=3; w++) {FrameDocument[w].defaultView.Popup.keyup(e);}}

/************************************************************************
 * XUL Window Unload
 ***********************************************************************/ 

//Watch for window resize
var ResizeWatchTimer;
function resizeWatch() {
  if (window.innerHeight==0 && window.innerWidth==0) return; // This happens when window is minimized!!!
  // If window has been resized
  if (window.innerHeight!=prefs.getIntPref("WindowHeight") || window.innerWidth!=prefs.getIntPref("WindowWidth")) {
    for (var w=1; w<=3; w++) {document.getElementById("bible" + w + "Frame").style.visibility = "hidden";}
    document.getElementById("genBookChooser").style.visibility = "hidden";
    if (ResizeWatchTimer) window.clearTimeout(ResizeWatchTimer);
    ResizeWatchTimer = window.setTimeout("resizeWatchReal();", 300);
  }
}

function resizeWatchReal() {
  document.getElementById("xulviewport").contentDocument.defaultView.updateViewPort();
  prefs.setIntPref("WindowHeight",window.innerHeight);
  prefs.setIntPref("WindowWidth",window.innerWidth);
  resizeScriptBoxes();
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {document.getElementById("bible" + w + "Frame").style.visibility = "visible";}
  document.getElementById("genBookChooser").style.visibility = (prefs.getBoolPref("ShowGenBookChooser") ? "visible":"hidden");
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
    //Save history info
    var newhist="";
    for (var i=0; i<History.length; i++) {newhist += History[i] + HistoryDelimeter;}
    prefs.setCharPref("History",newhist);
    prefs.setIntPref("HistoryIndex",Historyi);
    //Save Bible chapter/verse
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
    var mymod = firstDisplayModule();
    var mytype = getModuleLongType(mymod);
    var printTitle = ((mytype==DICTIONARY || mytype==GENBOOK) ? getPrefOrCreate("ShowingKey" + mymod, "Unicode", ""):Book[findBookNum(Location.getBookName())].bNameL);
    document.getElementById("printBrowser").contentDocument.title = SBundle.getString("Title") + ": " + printTitle;
    document.getElementById(command).doCommand();
    break;
  case "cmd_print_passage":
    AllWindows.push(window.open("chrome://xulsword/content/printPassage.xul",document.getElementById("print.printpassage").childNodes[0].nodeValue,"chrome,resizable,centerscreen"));
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
  var fwdPage="";
  var revPage="";
  var fnotes="";
  for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
    if (Win[w].modType != DICTIONARY &&
        FrameDocument[w].getElementById("noteBox").innerHTML && 
        FrameDocument[w].defaultView.NoteBoxElement.style.visibility!="hidden") {
      fnotes = FrameDocument[w].getElementById("noteBox").innerHTML + "<br><hr><br>";
    }
    var text = FrameDocument[w].getElementById("scriptBoxText").innerHTML;
    thiscolumn = fwdPage + text + revPage;
    if (!Win[w].isLinkedToNext) {
      versions.push(Win[w].modName);
      columns.push(thiscolumn);
      fwdPage="";
      revPage="";
      notes.push(fnotes);
      fnotes="";
      copyright.push(getCopyright(Win[w].modName));
    }
    else {
      var versionConfig = VersionConfigs[Win[w].modName];
      var isRTL = (versionConfig.direction && versionConfig.direction=="rtl");
      if (((isRTL && guiDirection() == "rtl") || (!isRTL && guiDirection() != "rtl"))) {revPage = ""; fwdPage = thiscolumn;}
      else {revPage = thiscolumn; fwdPage = "";}
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
/*
    if (SearchWins[i-1])
    data += "\n\nSEARCHRESULTS:\n" + SearchWins[i-1].document.getElementById("search-frame").contentDocument.getElementById("searchBox").innerHTML;
    data += "\n\nSCRIPTBOX:\n" + document.getElementById("bible" + i + "Frame").contentDocument.getElementById("scriptBoxText").innerHTML;
    data += "\n\nNOTEBOX:\n" + document.getElementById("bible" + i + "Frame").contentDocument.getElementById("noteBox").innerHTML;
*/
    try {
      var tmp = Bible.getChapterText(Win[i].modName, Location.getLocation(Win[i].modName));
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


