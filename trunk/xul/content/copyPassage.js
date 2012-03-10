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
 

var PassageChooser, PassageTextBox, VerseNumCheckbox, HeadingsCheckBox, RedWordsCheckBox;
var SavedGlobalOptions, SavedCharPrefs, SavedLocation, SavedBible;
var CheckBoxes = ["cmd_xs_toggleVerseNums", "cmd_xs_toggleHeadings", "cmd_xs_toggleRedWords"];
var FirstDisplayBible;

function onLoad() {
  updateCSSBasedOnCurrentLocale(["#modal", "input, button, menu, menuitem"]);
  createVersionClasses(0);
  PassageChooser = document.getElementById("passage");
  PassageTextBox = document.getAnonymousElementByAttribute(PassageChooser, "anonid", "book");
  VerseNumCheckbox = document.getElementById("cmd_xs_toggleVerseNums");
  HeadingsCheckBox = document.getElementById("cmd_xs_toggleHeadings");
  RedWordsCheckBox = document.getElementById("cmd_xs_toggleRedWords");
  
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {var bundle = BUNDLESVC.createBundle("chrome://xsglobal/locale/commonDialogs.properties");} catch(er) {bundle=null;}
  if (bundle) document.getElementById("close").label = bundle.GetStringFromName("Cancel");
  
  document.title = fixWindowTitle(document.title);
  
  SavedBible = firstDisplayBible();
  SavedLocation = Bible.getLocation(SavedBible);
  saveProgramSettings(SavedGlobalOptions, SavedCharPrefs);

  var sel = null;  
  var selob = MainWindow.getMainWindowSelectionObject();
  if (selob) sel = MainWindow.getTargetsFromSelection(selob);
  if (sel && sel.version && sel.verse && sel.lastVerse) {
    PassageChooser.version = sel.version;
    PassageChooser.location = SavedLocation.split(".")[0] + "." + SavedLocation.split(".")[1] + "." + sel.verse + "." + sel.lastVerse;
  }
  else {
    PassageChooser.version = SavedBible;
    PassageChooser.location = SavedLocation;
  }
  
  for (var c=0; c<CheckBoxes.length; c++) {document.getElementById(CheckBoxes[c]).checked = getPrefOrCreate("copyPassage." + CheckBoxes[c], "Bool", true);}
  
  initCheckBoxes(PassageChooser.version, CheckBoxes);
    
  PassageTextBox.focus();
  PassageTextBox.select();
  PassageTextBox.setAttribute("onkeyup", "{this.parentNode.parentNode.onbookkeyup(event); if (event.which==13) onRefUserUpdate();}");
}

function onRefUserUpdate(e, location, version) {
  if (!e || !location || !version || e.which==13) {
    if (!location) location = PassageChooser.location;
    if (!version) version = PassageChooser.version;
    document.getElementById("copy").click();
  }
  initCheckBoxes(version, CheckBoxes);
  
  var elem = e.target;
  while (!elem.id) {elem=elem.parentNode;}
  if (!elem) return;
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
  window.sizeToContent();
}

function copyPassage(e) {
  // turn off text features
  for (var tcmd in GlobalToggleCommands) {
    //try{Bible.setGlobalOption(GlobalToggleCommands[tcmd], "Off");} catch(er) {jsdump("Could not setGlobalOption:" + GlobalToggleCommands[tcmd]);}
  }
  // set versenums to checkbox
  Bible.setGlobalOption(GlobalToggleCommands["cmd_xs_toggleVerseNums"], (VerseNumCheckbox.checked ? "On":"Off"));
  Bible.setGlobalOption(GlobalToggleCommands["cmd_xs_toggleHeadings"], (HeadingsCheckBox.checked ? "On":"Off"));
  Bible.setGlobalOption(GlobalToggleCommands["cmd_xs_toggleRedWords"], (RedWordsCheckBox.checked ? "On":"Off"));
  
  var loc = PassageChooser.location.split(".");
  Bible.setBiblesReference(PassageChooser.version, loc[0] + " " + loc[1]);
  Bible.setVerse(PassageChooser.version, 0, 0);
  var verseHtml = Bible.getChapterText(PassageChooser.version);
//jsdump(verseHtml); 
  verseHtml = trimVerses(loc[2], loc[3], verseHtml);
//jsdump(verseHtml);
//NOTE: MSWord 2003 doesn't display &rln; and &lrm; correctly
  verseHtml = prepVerseHtml4Clipboard(verseHtml, PassageChooser.version, PassageChooser.location);
  var verseUnicode = html2text(verseHtml);
  
//jsdump(verseHtml);
//jsdump(verseUnicode);
  
  var str = Components.classes["@mozilla.org/supports-string;1"].  
                          createInstance(Components.interfaces.nsISupportsString);  
  if (!str) return false; // couldn't get string obj  
  str.data = verseUnicode; // unicode string?  

  var htmlstring = Components.classes["@mozilla.org/supports-string;1"].  
                          createInstance(Components.interfaces.nsISupportsString);  
  if (!htmlstring) return false; // couldn't get string obj  
  htmlstring.data = verseHtml;           

  var trans = Components.classes["@mozilla.org/widget/transferable;1"].  
                         createInstance(Components.interfaces.nsITransferable);  
  if (!trans) return false; //no transferable widget found  
  
  trans.addDataFlavor("text/unicode");  
  trans.setTransferData("text/unicode", str, verseUnicode.length * 2); // *2 because it's unicode  
    
  trans.addDataFlavor("text/html");  
  trans.setTransferData("text/html", htmlstring, verseHtml.length * 2); // *2 because it's unicode   

  var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].  
                         getService(Components.interfaces.nsIClipboard);  
  if (!clipboard) return false; // couldn't get the clipboard  
  clipboard.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);  
  window.close();
}

function trimVerses(v1, v2, chapterHTML) {
  var elem = document.getElementById("chaptertext").contentDocument.body;
  elem.innerHTML = chapterHTML;
  elem = elem.firstChild;
  var html="";
  var rethtml="";
  while (elem) {
    if (elem.id.match(/vs\.[^\.]*\.\d+\.(\d+)/)) {
      var v = elem.id ? elem.id.match(/vs\.[^\.]*\.\d+\.(\d+)/):null;
      if (Number(v[1])==v2) elem.innerHTML = elem.innerHTML.replace(/(<br>|&nbsp;|\s)+$/i, ""); //remove formatting after last verse
      if (Number(v[1])>=v1 && Number(v[1])<=v2) {
        rethtml += html + "<" + elem.tagName + ">" +  elem.innerHTML + "</" + elem.tagName + ">";
      }
      html="";
    }
    else if (elem.tagName && elem.className) {
      html += "<" + elem.tagName + " class=\"" + elem.className + "\">" + elem.innerHTML + "</" + elem.tagName + ">";
    }
    else {
      html += elem.innerHTML;
    }
    
    elem = elem.nextSibling;
  }
  return rethtml;
}

function prepVerseHtml4Clipboard(html, version, location) {
  //The folowing seem to cause problems for WordPad
  const LRE = ""; //"&#8235;"; //String.fromCharCode(8235);
  const RTE = ""; //"&#8236;"; //String.fromCharCode(8236);
  const PDF = ""; //"&#8237;"; //String.fromCharCode(8237);
  
  // headings
  html = html.replace(/class="[^"]*canonical[^"]*"/g, "style=\"font-weight:bold; font-style:italic;\"");
  html = html.replace(/class="[^"]*head1[^"]*"/g, "style=\"font-weight:bold; text-align:center;\"");
  html = html.replace(/class="[^"]*head2[^"]*"/g, "style=\"font-weight:bold;\"");
  
/*  // make verse numbers bold
  html = html.replace(/<sup/g, "<b><sup");
  html = html.replace(/<\/sup>/g, "</sup></b>");*/
  
  // add verse number style (Open Office does not recognize sup tags)
  //html = html.replace(/<sup class="versenum">(\d+)<\/sup>/g, "<sup style=\"font-size:8px;\">$1<\/sup>");
  
  // add reference
  var aConfig = LocaleConfigs[rootprefs.getCharPref("general.useragent.locale")];
  if (aConfig) {
    //dir attribute is not needed because ambiguous punctuation character direction is defined by ref2ProgramLocaleText dir chars and embeded Unicode dir control chars
    var emdir = (aConfig.direction && aConfig.direction=="rtl" ? RTE:LRE);
    var font = (aConfig.font ? aConfig.font:DefaultFont);
    html += "<span style=\"font-family:'" + font + "';\">" + emdir + " (" + ref2ProgramLocaleText(location) + ")" + PDF + "</span>";
  }
  else html += "<span> (" + ref2ProgramLocaleText(location) + ")</span>";
  
  // add config file info
  aConfig = VersionConfigs[version];
  if (aConfig) {
    emdir = (aConfig.direction && aConfig.direction=="rtl" ? RTE:LRE);
    font = (aConfig.font ? aConfig.font:DefaultFont);
    var dir = (aConfig.direction && aConfig.direction=="rtl" ? "rtl":"ltr");
    html = "<div style=\"font-family:'" + font + "'; dir:" + dir + ";\">" + emdir + html + PDF + "</div>";
  }
  else html = "<div>" + html + "</div>";

  return html;
}

function html2text(html) {
  var text = html;
  text = text.replace(/(<\/span>)(<span><sup class=\"versenum\">)/ig, "$1 $2"); // add " " before verse number
  text = text.replace(/<sup class=\"versenum\">(\d+)<\/sup>\s*/g, "$1)"); // add ")" after verse number
  text = text.replace("&nbsp;", " ", "gi");
  text = text.replace("&rlm;", "", "gi"); //String.fromCharCode(8207)
  text = text.replace("&lrm;", "", "gi");
  text = text.replace("&#8235;", String.fromCharCode(8235), "gi");
  text = text.replace("&#8236;", String.fromCharCode(8236), "gi");
  text = text.replace("&#8237;", String.fromCharCode(8237), "gi");
  text = text.replace(/<br>/gi, NEWLINE);
  text = text.replace(/<\/div>/gi, NEWLINE);
  text = text.replace(/<[^>]+>/g,"");
  return text
}

function onUnload() {
  returnProgramSettings(SavedGlobalOptions, SavedCharPrefs);
  Bible.setBiblesReference(SavedBible, SavedLocation);
  for (var c=0; c<CheckBoxes.length; c++) {prefs.setBoolPref("copyPassage." + CheckBoxes[c], document.getElementById(CheckBoxes[c]).checked);}
  MainWindow.updateXulswordButtons();
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
