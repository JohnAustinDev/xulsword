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


var ProgressMeter, FromChooser, ToChooser, FromTextBox, ToTextBox, Introduction, Crossreftexts;
var CheckBoxes = [];
var Now = {bookNumber:null, chapter:null};
var From;
var To;
var Count, TotalChaps;
var Version;
var PrintCommand;
var SavedLocation;
var SavedBible;
var SavedGlobalOptions = [];
var SavedCharPrefs = [];

function onLoad() {
  updateCSSBasedOnCurrentLocale(["#modal", "input, button, menu, menuitem"]);
  createVersionClasses(0);
  document.title = fixWindowTitle(getWindowTitle("print.printpassage"));
  
  ProgressMeter = document.getElementById("progress");
  FromChooser = document.getElementById("from-dropdown");
  ToChooser = document.getElementById("to-dropdown");
  FromTextBox = document.getAnonymousElementByAttribute(FromChooser, "anonid", "book");
  ToTextBox = document.getAnonymousElementByAttribute(ToChooser, "anonid", "book");
  Introduction = document.getElementById("introduction");
  Crossreftexts = document.getElementById("crossreftext");
  
  Introduction.label = getCurrentLocaleBundle("books.properties").GetStringFromName("IntroLink");
  
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {var bundle = BUNDLESVC.createBundle("chrome://global/locale/commonDialogs.properties");} catch(er) {bundle=null;}
  if (bundle) document.getElementById("close").label = bundle.GetStringFromName("Cancel");
  
  BMDS = initBMServices();
  
  saveProgramSettings(SavedGlobalOptions, SavedCharPrefs);

  // Collect array of checkboxes...
  for (var tcmd in GlobalToggleCommands) {
    var elem = document.getElementById(tcmd);
    if (!elem) continue;
    CheckBoxes.push(tcmd);
  }
  CheckBoxes.push(Introduction.id);
  CheckBoxes.push(Crossreftexts.id);

  SavedBible = firstDisplayBible();
  initCheckBoxes(SavedBible, CheckBoxes);
  SavedLocation = Bible.getLocation(SavedBible);
  FromChooser.version = SavedBible;
  ToChooser.version = SavedBible;
  FromChooser.location = SavedLocation;
  ToChooser.location = SavedLocation;
  //document.getElementById("to-input").hidden = !allowPrintAll(SavedBible);
    
  FromTextBox.focus();
  FromTextBox.select();
}

/*
function allowPrintAll(version) {
  if (!usesSecurityModule(Bible, version)) return true;
  var allowed = ALLOWPRINT.split(",");
  for (var i=0; i<allowed.length; i++) {
    if (allowed[i] == version) return true;
  }
  return false;
}
*/

function onRefUserUpdate(e, location, version) {
  var elem = e.target;
  while (!elem.id) {elem=elem.parentNode;}
  if (!elem) return;
//jsdump("A:" + FromChooser.location + " B:" + ToChooser.location + " " + isLocationAbeforeB(FromChooser.location, ToChooser.location) + "\n");
  switch (elem.id) {
  case FromChooser.id:
    ToChooser.version = version;
    if (!isLocationAbeforeB(location, ToChooser.location)) ToChooser.location = location;
    //var printAll = allowPrintAll(version);
    //if (!isLocationAbeforeB(location, ToChooser.location) || !printAll) ToChooser.location = location;
    //document.getElementById("to-input").hidden = !printAll;
    initCheckBoxes(version, CheckBoxes);
    break;
  case ToChooser.id:
    if (!isLocationAbeforeB(FromChooser.location, location)) ToChooser.location = FromChooser.location;
    break;
  }
  document.getAnonymousElementByAttribute(elem, "anonid", "version").className = "vstyle" + version;
}


function initCheckBoxes(module, checkboxes) {
  var f = MainWindow.getModuleFeatures(module);
  f.enabled = true;
  var feature = {
    introduction:"enabled",
    crossreftext:"haveCrossRefs",
    cmd_xs_toggleHeadings:"haveHeadings",
    cmd_xs_toggleVerseNums:"enabled",
    cmd_xs_toggleFootnotes:"haveFootnotes",
    cmd_xs_toggleUserNotes:"enabled",
    cmd_xs_toggleRedWords:"haveRedWords",
    cmd_xs_toggleHebrewVowelPoints:"haveHebrewVowels",
    cmd_xs_toggleHebrewCantillation:"haveHebrewCant",
    cmd_xs_toggleCrossRefs:"haveCrossRefs"
  }
  for (var cb=0; cb<checkboxes.length; cb++) {
    document.getElementById(checkboxes[cb]).checked = f[feature[checkboxes[cb]]] && getPrefOrCreate("printPassage." + checkboxes[cb], "Bool", checkboxes[cb]!="crossreftext");
    if (getPrefOrCreate("HideDisabledCopyPrintIncludes", "Bool", false)) {
      document.getElementById(checkboxes[cb]).hidden = !f[feature[checkboxes[cb]]];
    }
    else document.getElementById(checkboxes[cb]).disabled = !f[feature[checkboxes[cb]]];
  }
  if (!document.getElementById("cmd_xs_toggleCrossRefs").checked) {
    if (getPrefOrCreate("HideDisabledCopyPrintIncludes", "Bool", false)) {
      document.getElementById("crossreftext").hidden=true;
    }
    else document.getElementById("crossreftext").disabled=true;
  }
  window.setTimeout("sizeToContent()", 0);
}

function onUnload(checkboxes) {
  // Return global options and save checkbox prefs
  for (var c=0; c<checkboxes.length; c++) {
    var cbelem = document.getElementById(checkboxes[c]);
    if (cbelem.disabled) continue;
    prefs.setBoolPref("printPassage." + checkboxes[c], cbelem.checked);
  }
  returnProgramSettings(SavedGlobalOptions, SavedCharPrefs);
  Bible.setBiblesReference(SavedBible, SavedLocation);
  MainWindow.updateXulswordButtons();
}

var PrintHTML;
function buttonPress(cmd) {
  updateFromCheckBoxes(CheckBoxes);
  
  PrintCommand = cmd;
  
  // Get From and To location
  // Note: lastVerse is NOT used by the print routine, but rather
  //    From.verse and To.verse are used.
  var loc = FromChooser.location.split(".");
  From = {shortName:loc[0], bookNumber:findBookNum(loc[0]), chapter:Number(loc[1]), verse:Number(loc[2]), lastVerse:Number(loc[2]), version:FromChooser.version};
  loc = ToChooser.location.split(".");
  To = {shortName:loc[0], bookNumber:findBookNum(loc[0]), chapter:Number(loc[1]), verse:Number(loc[2]), lastVerse:Number(loc[2]), version:FromChooser.version};
  From.bookNumber = findBookNum(From.shortName);
  To.bookNumber = findBookNum(To.shortName);
  Version = From.version;
  
//jsdump("Version" + ", " + From.shortName + " " + From.chapter + ":" + From.verse + " - " + To.shortName + " " + To.chapter + ":" + To.verse + "\n");
  Count = 0;
  TotalChaps = 0;
  if (From.bookNumber==To.bookNumber) TotalChaps = To.chapter-From.chapter;
  else {
    TotalChaps = Book[From.bookNumber].numChaps - From.chapter
    for (var bknum=From.bookNumber+1; bknum<=To.bookNumber; bknum++) {
      var add=0;
      if (bknum==To.bookNumber) add = To.chapter;
      else add = Book[bknum].numChaps;
      TotalChaps += add;
    }
  }
  if (TotalChaps > 0) ProgressMeter.setAttribute("hidden", false);
  PrintHTML = "";
  Now.bookNumber = From.bookNumber;
  Now.chapter = From.chapter;
//jsdump("TotalChaps:" + TotalChaps + "\n");
  window.setTimeout("getChapterHTML()",0);
}

var OldChap;
var PageBreak = "";
function getChapterHTML() {
  Count++;
  Bible.setBiblesReference(Version, Book[Now.bookNumber].sName + " " + Now.chapter);
  Bible.setVerse(Version, 0, 0);
  var chap = Bible.getChapterText(Version);
  if (chap && chap!=OldChap) {
    OldChap = chap;
    var textWithUserNotes = insertUserNotes(Bible.getBookName(), Bible.getChapterNumber(Version), Version, chap);
    PrintHTML += PageBreak;
    if (!PageBreak) PageBreak = "<div class=\"pagebreak\"></div><br>";
    PrintHTML += "<div class=\"scripture vstyle" + Version + "\">" + getScriptBoxHeader(Bible.getBookName(), Bible.getChapterNumber(Version), Version, true, Introduction.checked, false) + "</div>";
    PrintHTML += "<div class=\"scripture vstyle" + Version + "\">" + textWithUserNotes.html + "</div>";
    var allNotes = Bible.getNotes();
    allNotes += textWithUserNotes.notes;
    var showFootnotes = (Bible.getGlobalOption("Footnotes")=="On");
    var showCrossRefs = (Bible.getGlobalOption("Cross-references")=="On");
    var showUserNotes = (prefs.getCharPref("User Notes")=="On");
    if (showFootnotes || showUserNotes || showCrossRefs) {
      var notes = getNotesHTML(allNotes, Version, showFootnotes, showCrossRefs, showUserNotes, Crossreftexts.checked);
      if (notes) {
        PrintHTML += "<br><hr><br>";
        PrintHTML += "<div class=\"footnotes vstyle" + Version + "\">" + notes + "</div>";
      }
    }
  }
  
//jsdump(PrintHTML + "\n");
  ProgressMeter.value = 100*(Count/TotalChaps);
  if (Now.bookNumber==To.bookNumber && Now.chapter==To.chapter) {
    doPrintCommand(PrintCommand, PrintHTML);
    return;
  }
  if (Now.chapter == Book[Now.bookNumber].numChaps) {
    Now.bookNumber++;
    Now.chapter=1;
  }
  else Now.chapter++;
  window.setTimeout("getChapterHTML()", 0);
}

function updateFromCheckBoxes(checkboxes) {
  // Set Global Options and prefs according to check boxes...
  for (var cb=0; cb<checkboxes.length; cb++) {
dump(checkboxes[cb] + " " + document.getElementById(checkboxes[cb]).checked + "\n");
    var elem = document.getElementById(checkboxes[cb]);
    if (!GlobalToggleCommands[elem.id]) continue;
    if (elem.id=="cmd_xs_toggleUserNotes") {
      prefs.setCharPref(GlobalToggleCommands[elem.id], (elem.checked ? "On":"Off"));
    }
    else {
      try {Bible.setGlobalOption(GlobalToggleCommands[elem.id], (elem.checked ? "On":"Off"));}
      catch (er) {}
    }
  }
}

function saveProgramSettings(savedGlobalOptions, savedCharPrefs) {
  savedGlobalOptions  = {
    cmd_xs_toggleHeadings:null,
    cmd_xs_toggleFootnotes:null,
    cmd_xs_toggleVerseNums:null,
    cmd_xs_toggleRedWords:null,
    cmd_xs_toggleHebrewVowelPoints:null,
    cmd_xs_toggleHebrewCantillation:null,
    cmd_xs_toggleCrossRefs:null
  };
  savedCharPrefs = {
    cmd_xs_toggleUserNotes:null,
  };
  for (var go in savedGlobalOptions) {savedGlobalOptions[go] = Bible.getGlobalOption(GlobalToggleCommands[go]);}
  for (var pr in savedGlobalOptions) {savedCharPrefs[pr] = prefs.getCharPref(GlobalToggleCommands[pr]);}
}

function returnProgramSettings(savedGlobalOptions, savedCharPrefs) {
  for (var go in savedGlobalOptions) {
    Bible.setGlobalOption(go, savedGlobalOptions[go]);
  }
  for (var pr in savedCharPrefs) {
    prefs.setCharPref(GlobalToggleCommands[pr], savedCharPrefs[pr]);
  }
}

function doPrintCommand(cmd, html) {
  if (!html) window.close();
  ProgressMeter.setAttribute("hidden", true);
  var mytype = getModuleLongType(Version);
  var printBrowser = MainWindow.document.getElementById('printBrowser').contentDocument;
  var printTitle = FromTextBox.value + " - " + ToTextBox.value;
  printBrowser.title = SBundle.getString("Title") + ": " + printTitle;
  PrintHTML = window.unescape(html);
//dump(html + "\n");
  printBrowser.getElementById('printBox').innerHTML = html;
  MainWindow.setTimeout("MainWindow.document.getElementById('" + cmd + "').doCommand();", 0);
  window.close();
}
