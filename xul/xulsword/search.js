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


// FUNCTIONS AND VARIABLES FOR THE SEARCH.XUL AND SEARCH.HTML DOCUMENTS
  
/************************************************************************
 * Global Variables used during searches
 ***********************************************************************/ 

const MINRADIOCOLS=3; 
var StartVerse=0;
var VersesPerPage=30;
var Matches = 0;

//Globals for current settings
var sText = "";
var rawText = "";
var sScope = 0;
var sType = 0;
var sFlags = 0;

//Globals for scope and progress meter implementation
var Start = 0;
var End = 0;
var Slength = 0;
var Step = 0;

//Globals for search routine
var Newsearch=true;
var SearchedVersion="";
var ModuleUsesVerseKey;
var TR = []; //new Array(6);
//for (var itr=0; itr<TR.length; itr++) {TR[itr] = new Object;}

var SearchIntervalID;
var Searching;
var SearchBoxElement;
var OriginalWindowTitle="";
var noPs = false;   //No Psalms in Wisdom books (Psalms has own category)

const REGEX=0, PHRASE=-1, MULTIWORD=-2, ENTRY_ATTRIBUTE=-3, LUCENE=-4, COMPOUND=-5;  
var SearchTypeRadio;
  
/************************************************************************
 * Loading and Unloading of the search window
 ***********************************************************************/ 
function loadSearchWindow() {
  updateCSSBasedOnCurrentLocale(["#search-window", "input, button, menu, menuitem"]);
  SearchTypeRadio = document.getElementById("searchType");
  SearchTypeRadio.selectedIndex = getPrefOrCreate("InitialSearchType", "Int", CONTAINS_THE_WORDS);
  
  // Fix createIndexButton label (should be in DTD, but to allow backward compatibility is being done here)
  try {document.getElementById("createIndexButton").label = SBundle.getString("CreateIndexButton");}
  catch (er) {}
  
  //Init Search text
  document.getElementById("searchText").value = getUnicodePref("SearchText");
  
  OriginalWindowTitle = document.title;
  document.title = fixWindowTitle(OriginalWindowTitle.replace("**search_title**", getUnicodePref("SearchText",prefs)));
  SearchBoxElement = document.getElementById("search-frame").contentDocument.getElementById("searchBox");
  
  var scopes = ["sg1","sg2","sg3","sg4","sg5","sg6"];
  for (var i=0; i<scopes.length; i++) {
    var elem = document.getElementById(scopes[i]);
    if (elem.label=="") {elem.hidden=true;}
  }
  
  BMDS = initBMServices();
  window.controllers.appendController(XulswordSearchController);
  window.controllers.appendController(BookmarksMenuController);
  window.setTimeout("postWindowInit()", 0);
}

var NumberOfShortType = {};
function postWindowInit() {
  //Create the search language radio buttons
  for (var shortType in SupportedModuleTypes) {NumberOfShortType[shortType] = 0;}
  for (var t=0; t<Tabs.length; t++) {
    if (Tabs[t].isOrigTab) continue;
    var isShowing = false;
    for (var w=1; w<=prefs.getIntPref("NumDisplayedWindows"); w++) {
      isShowing |= MainWindow.isTabShowing(t, w);
    }
    if (isShowing || !getPrefOrCreate("MinimizeSearchRadios", "Bool", false)) {
      createAndAppendRadio(t,"adv");
      if (Tabs[t].modType==BIBLE) createAndAppendRadio(t,"sim");
      NumberOfShortType[Tabs[t].tabType]++;
    }
  }
  updateAdvancedPanel();
  updateSearchWindow();
  updateSortBy();

  if (document.getElementById("searchText").value != "") {
    if (SearchTypeRadio.selectedIndex==EXACT_TEXT || !Bible.luceneEnabled(prefs.getCharPref("SearchVersion")))
      window.setTimeout("searchBible()", 500); // Timeout is for non-Lucene search
    else searchBible();
  }
  window.setInterval(resizeWatch,500);
}

// Updates between simple/advanced panel according to user pref.
function updateAdvancedPanel() {
  // Hide/Show advanced search features according to pref
  document.getElementById("advanced").hidden = !prefs.getBoolPref("AdvSearchFlag");
  document.getElementById("moreless").label = (prefs.getBoolPref("AdvSearchFlag") ? SBundle.getString("Less"):SBundle.getString("More"));
  document.getElementById("sversion.adv").hidden = !prefs.getBoolPref("AdvSearchFlag");
  document.getElementById("sversion.sim").hidden = prefs.getBoolPref("AdvSearchFlag");
  
  fitModuleRadiosToWindow();
  
  // Hide empty rows
  if (prefs.getBoolPref("AdvSearchFlag")) {
    document.getElementById("modulePanel").hidden = false;
    var aRow = document.getElementById("allModRadios.adv").firstChild;
    while (aRow) {
      var subrownum = aRow.id.split(".");
      if (subrownum && subrownum[2] && subrownum[2]=="0" && aRow.childNodes.length==1) aRow.hidden=true;
      else aRow.hidden=false;
      var possibleSep = aRow.previousSibling;
      if (possibleSep && possibleSep.id == "") possibleSep.hidden=aRow.hidden;
      aRow = aRow.nextSibling;
    }
  }
  else {
    document.getElementById("modulePanel").hidden = (document.getElementById("row.Texts.0.sim").childNodes.length==2);
  }
}

var MyHeight, MyWidth;
function resizeWatch() {
  // If window is minimized!!!
  if (window.innerHeight==0 && window.innerWidth==0) return;
  // If first time setting values
  else if (!MyHeight && !MyWidth) {
    MyHeight = window.innerHeight;
    MyWidth  = window.innerWidth;
  }
  // If window has been resized
  else if (Math.abs(window.innerHeight-MyHeight) > 40 || Math.abs(window.innerWidth-MyWidth) > 40) {
    MyHeight = window.innerHeight;
    MyWidth  = window.innerWidth;
    fitModuleRadiosToWindow();
  }
}

function createAndAppendRadio(tabNum, id) {
  // Create a new radio button
  var xulElement = document.createElement("radio");
  xulElement.setAttribute("label", Tabs[tabNum].label);
  xulElement.setAttribute("id", Tabs[tabNum].modName + "." + id);
  
  var forceDefaultFormatting = (Bible.getModuleInformation(Tabs[tabNum].modName, "OriginalTabTestament")!=NOTFOUND);
  
  if (!forceDefaultFormatting) {
    var versionConfig = VersionConfigs[Tabs[tabNum].modName];
    var myfont = (versionConfig && versionConfig.font && !isASCII(Tabs[tabNum].label) ? versionConfig.font:DefaultFont);
    var myfontSizeAdjust = (versionConfig && versionConfig.fontSizeAdjust && !isASCII(Tabs[tabNum].label) ? versionConfig.fontSizeAdjust:DefaultFontSizeAdjust);
    xulElement.style.fontFamily = "\"" + myfont + "\"";
    xulElement.style.fontSizeAdjust = myfontSizeAdjust;
  }
  else {
    xulElement.style.fontFamily = "\"" + DefaultFont + "\"";
    xulElement.style.fontSizeAdjust = DefaultFontSizeAdjust;  
  }
  
  // Place the new radio button
  //var subRow = 0;
  var myRow = document.getElementById("row." + Tabs[tabNum].tabType + ".0." + id);
  myRow.appendChild(xulElement);
}

function fitModuleRadiosToWindow() {
  var id = (document.getElementById("sversion.adv").hidden ? "sim":"adv");
  var aRow = document.getElementById("allModRadios." + id).firstChild;
  var cols = 0;
  while (aRow) {
    var mycol = aRow.childNodes.length-1;
    cols = (mycol > cols ? mycol:cols);
    aRow = aRow.nextSibling;
  }

  var windowWidth = window.innerWidth;
  var sversion = document.getElementById("sversion." + id);
  // IF RADIO GROUP NEEDS TO BE WIDER
  if (sversion.boxObject.width < windowWidth) {
    while (!isRadioGridFlat(id) && (sversion.boxObject.width < windowWidth)) {
      cols++;
      var aRow = document.getElementById("allModRadios." + id).firstChild;
      while (aRow) {
        if (!aRow.id) {aRow = aRow.nextSibling; continue;}
        var myCol = getOptimumColForRow(aRow, cols);
        var myShortType = aRow.id.split(".")[1];
        var nextRow = aRow.nextSibling;
        var result = 0;
        while (result==0 && aRow.childNodes.length-1 < myCol) {
          result = moveFirstRadioToPrevRow(nextRow);
        }
        aRow = aRow.nextSibling;
      }
    }
  }

  // IF RADIO GROUP NEEDS TO BE NARROWER
  if (sversion.boxObject.width > windowWidth) {
    while ((cols >= MINRADIOCOLS) && (sversion.boxObject.width > windowWidth)) {
      cols--;
      var aRow = document.getElementById("allModRadios." + id).firstChild;
      while (aRow) {
        myCol = getOptimumColForRow(aRow, cols);
        result = 0
        while (result==0 && aRow.childNodes.length-1 > myCol) {
          result = moveLastRadioToNextRow(aRow);
        }
        aRow = aRow.nextSibling;
      }
    }
  }
}

function isRadioGridFlat(id) {
  var aRow = document.getElementById("row.Texts.0." + id);
  while (aRow) {
    if (!aRow.id || aRow.id.split(".")[2] != "0") {aRow = aRow.nextSibling; continue;}
    if (aRow.childNodes.length-1 != NumberOfShortType[aRow.id.split(".")[1]]) return false;
    aRow = aRow.nextSibling;
  }
  return true;
}

function getOptimumColForRow(aRow, col) {
if (!aRow.id) return col;
var num = NumberOfShortType[aRow.id.split(".")[1]];

var cLastRow = Math.round((num/col - Math.floor(num/col))*col);
var nRows = Math.ceil(num/col);
var csub;
if (nRows > 1) {
  if (cLastRow == 0) csub = col - num/nRows;
  else csub = Math.floor((col-cLastRow)/nRows);
}
else csub = 0;

//jsdump("col:" + col + " num:" + num + " nRows:" + nRows + " cLastRow:" + cLastRow + " csub:" + csub + "\n");

col -= csub;
col = (col < MINRADIOCOLS ? MINRADIOCOLS:col); // Min col

//jsdump("Adjusting " + aRow.id.split(".")[1] + " down by " + csub + " rows.\n\n");
return col;
}

// return: 0=no problem; 1=row empty; -1=error;
function moveFirstRadioToPrevRow(aRow) {
  if (!aRow || !aRow.id) return -1;
  var parts = aRow.id.split(".");
  var mymoduletype = parts[1];
  var mysubRow = parts[2];
  var id = parts[3];
  var parent = aRow.parentNode;
  var firstRadio = aRow.firstChild.nextSibling;
  if (!firstRadio) return 1;
  var prevRow = aRow.previousSibling;
  if (!prevRow || !prevRow.id || prevRow.id.split(".")[1]!=mymoduletype) return -1;
  firstRadio = aRow.removeChild(firstRadio);
  firstRadio = prevRow.appendChild(firstRadio);
  return firstRadio ? 0:-1;
}

// return: 0=no problem; 1=row empty; -1=error;
function moveLastRadioToNextRow(aRow) {
  if (!aRow || !aRow.id) return -1;
  var parts = aRow.id.split(".");
  if (parts[0] != "row") return -1;
  var mymoduletype = parts[1];
  var mysubRow = parts[2];
  var id = parts[3];
  var parent = aRow.parentNode;
  var lastRadio = aRow.lastChild;
  if (!lastRadio || !lastRadio.id || lastRadio.id.substr(0,5)=="label") return 1;
  var nextRow = aRow.nextSibling;
  if (!nextRow || !nextRow.id || nextRow.id.split(".")[1]!=mymoduletype) {
    nextRow = parent.insertBefore(createNewRow(mymoduletype, Number(mysubRow)+1, id), nextRow);
  }
  if (!nextRow) return -1;
  lastRadio = aRow.removeChild(lastRadio);
  lastRadio = nextRow.insertBefore(lastRadio, nextRow.firstChild.nextSibling);
  return lastRadio ? 0:-1;
}

function createNewRow(moduletype, subRow, id) {
  var newRow = document.createElement("row");
  newRow.setAttribute("id", "row." + moduletype + "." + subRow + "." + id);
  newRow.setAttribute("align", "center");
  var blankLabel = document.createElement("label");
  blankLabel.setAttribute("id", "label." + subRow + "." + id);
  newRow.appendChild(blankLabel);
  return newRow;
}

function updateSearchWindow() {
  // Set version selection according to pref
  var svers = getPrefOrCreate("SearchVersion", "Char", prefs.getCharPref("DefaultVersion"));
  document.getElementById("sversion.adv").selectedItem = document.getElementById(svers + ".adv");
  document.getElementById("sversion.sim").selectedItem = document.getElementById(svers + ".sim");
  
  var myType = getModuleLongType(svers);
  ModuleUsesVerseKey = (myType==BIBLE || myType==COMMENTARY);

  // Enable/Disable all scope radio buttons
  var radioDisabled;
  var radioIDs = ["searchAll","searchOT","searchNT","searchSelect","sg1","sg2","sg3","sg4","sg5","sg6"];
  if (document.getElementById("scopeRadio").selectedIndex == 3) {document.getElementById("scopeMenu").disabled = false;}
  else {document.getElementById("scopeMenu").disabled = true;}
  if (svers == OrigModuleNT) {
    radioDisabled = [true,true,false,false,true,true,true,true,false,false];
    document.getElementById("scopeMenu").selectedIndex = 4;
    if (document.getElementById("scopeRadio").selectedIndex < 2) {document.getElementById("scopeRadio").selectedIndex = 2;}
  }
  else if (svers == OrigModuleOT) {
    radioDisabled = [true,false,true,false,false,false,false,false,true,true];
    document.getElementById("scopeMenu").selectedIndex = 0;
    if (document.getElementById("scopeRadio").selectedIndex < 3) {document.getElementById("scopeRadio").selectedIndex = 1;}
  }
  else if (!ModuleUsesVerseKey) {
    radioDisabled=[false,true,true,true,true,true,true,true,true,true];
    document.getElementById("scopeRadio").selectedIndex = 0;
  }
  else radioDisabled = [false,false,false,false,false,false,false,false,false,false];
  
  for (var i=0; i<radioIDs.length; i++) {document.getElementById(radioIDs[i]).setAttribute("disabled",radioDisabled[i]);}

  
  // Enable/Disable choices based on availability of search index
  document.getElementById("stopButton").hidden = true;
  document.getElementById("dividerBox").hidden = Bible.luceneEnabled(svers);
  document.getElementById("createSearchIndexBox").hidden = Bible.luceneEnabled(svers);

}

function updateSortBy(dontModifyCheck) {
  var sort = document.getElementById("sort");
  if (!dontModifyCheck) sort.checked = (SearchTypeRadio.selectedIndex!=SIMILAR_WORDS);
  sort.disabled = (SearchTypeRadio.selectedIndex!=SIMILAR_WORDS && SearchTypeRadio.selectedIndex!=USING_SEARCH_TERMS);
}

function updateSearchBoxStyle(svers) {
  var searchBoxBodyElem = document.getElementById("search-frame").contentDocument.getElementById("searchBoxBody");
  searchBoxBodyElem.className = "searchres vstyle" + svers;
  // The following is a work around for a MOZILLA BUG
  searchBoxBodyElem.style.whiteSpace = (searchBoxBodyElem.style.direction == "rtl" ? "normal":"");
}

/************************************************************************
 * The Actual Search routine implementation
 ***********************************************************************/ 

function searchBible() {
  //Store version in global so we always know which version was last searched
  //even after pref may have been changed by user
  SearchedVersion = prefs.getCharPref("SearchVersion");
  if (Searching) stopSearch();
  if (!Bible.luceneEnabled(SearchedVersion)) {
    try {var dontAsk = prefs.getBoolPref("dontAskAboutSearchIndex" + SearchedVersion) && document.getElementById("searchText").value.search("lemma:")==-1;}
    catch (er) {dontAsk = false;}
    if (!dontAsk) {
      var result={};
      var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
          fixWindowTitle(SBundle.getString("BuildingIndex")),
          SBundle.getString("NeedSearchIndex"), 
          DLGINFO,
          DLGOK);
      prefs.setBoolPref("dontAskAboutSearchIndex" + SearchedVersion, true);
      startIndexer(true)
      return;
    }
  }
  
  Newsearch = true;
  StartVerse=0;
  
  //Get Search Text
  sText = document.getElementById("searchText").value;
  if (!sText) return;
  sText = sText.replace(/^\s*/,"");       //remove leading whitespace
  sText = sText.replace(/\s*$/,"");       //remove trailing whitespace
  sText = sText.replace(/\s+/," ");       //change all white space to " "
  setUnicodePref("SearchText",sText);
  sText = replaceLocaleSearchSymbols(sText);
  var rawText = sText;
  
  //Change window title to new search
  document.title = fixWindowTitle(OriginalWindowTitle.replace("**search_title**", getUnicodePref("SearchText")));
  
  //Get Search Scope
  if (ModuleUsesVerseKey) {
    sScope = document.getElementById("scopeRadio").selectedItem.value;
    if (document.getElementById("scopeRadio").selectedIndex == 3) {sScope = document.getElementById("scopeMenu").selectedItem.value;}
  }
  else sScope = "";

  //Get Search Type- prepare search text based on search type
  if (Bible.luceneEnabled(SearchedVersion)) {
    sType = LUCENE; //Lucene search
    // If Lucene special chars/operators are present then take string literally without any modification
    if (sText.search(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/)!=-1) {
      SearchTypeRadio.selectedIndex=USING_SEARCH_TERMS;
      updateSortBy(true);
    }
    switch (SearchTypeRadio.selectedIndex) {
    case CONTAINS_THE_WORDS:
      sText = sText.replace(" "," AND ","gim");
      break;
    case SIMILAR_WORDS:
      sText = sText.replace(/\s*$/, "~");
      sText = sText.replace(" ", "~ AND ","gim");
      break;
    case EXACT_TEXT:
      sType = MULTIWORD; //MULTIWORD and REGEX ARE CASE SENSETIVE! COMPOUND DOES NOT WORK!!!!
      break;
    case USING_SEARCH_TERMS:
      break;
    }
  }
  // no Lucene
  else {sType = REGEX;}
  /*{
    // If this is a multi-word soft search (fast)
    if (!isContainsTheWords) {sType = MULTIWORD;}
    // Otherwise, it will be a hard search- If there is also more than one word, use phrase search (slower)
    else if (sText.lastIndexOf(" ") > 1) {sType = PHRASE;}
    // Else. we are looking for a single, exact word: COMPOUND uses a multi word soft search (which is fast) followed by an exact phrase search on the results
    // There is, however, a bug with this search as words at beginning of line or ending with punctuation will not be found
    else {sType = COMPOUND;}
  }*/
  
  // Highlight Results- build regular expressions for highlighting results
  switch (SearchTypeRadio.selectedIndex) {
  case CONTAINS_THE_WORDS:
    rawText = rawText.replace(/ +/g,";"); //change spaces into ";" for later splitting needed for hilighting matched words
    makeTermsArray(rawText);
    break;
  case SIMILAR_WORDS:
    rawText = rawText.replace(/ +/g,";");
    makeTermsArray(rawText);
    break;
  case EXACT_TEXT:
    TR = [{term:rawText, type:"string"}];
    break;
  case USING_SEARCH_TERMS:
    rawText = rawText.replace(/ +/g,";");
    rawText = rawText.replace(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|~|:|\\|AND;|OR;|NOT;)/g,""); //remove all control chars except quotes
    rawText = rawText.replace("?",".","g");     //add dots before any ?s
    rawText = rawText.replace("*",".*?","g");   //add dots before any *s
    //change ";" between quotes back into spaces, and remove quotes
    var bq=false; 
    var tmp="";
    for (var x=0; x<rawText.length; x++) {
      var mychr=rawText.charAt(x);
      if (mychr=="\"") {bq = !bq; continue;}
      if (bq && (mychr==";")) {tmp=tmp+"\\s+";} // the \\s+ allows for more than one space between words in the striped text (common thing)
      else {tmp=tmp+mychr;}
    }
    rawText=tmp;
    makeTermsArray(rawText);
    break;
  }
  
  //Get Search Flags
  sFlags = 0;
  if (!document.getElementById("sort").checked) {sFlags = sFlags|2048;} // Turn on Sort By Relevance flag
  sFlags = sFlags|2; //Turn "Ignore Case" flag on. BUG NOTE: THIS DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
  
  //Do the search
  SearchBoxElement.innerHTML = "";
  updateSearchBoxStyle(SearchedVersion);
  if (ModuleUsesVerseKey && sType!=LUCENE) {
  // Search chapter by chapter...
    // Prepare search scope
    Start=0; End=0; noPs=false;
    if (sScope.search(/-/) != -1) {
      var parts=sScope.split("-"); 
      Start=findBookNum(parts[0]); 
      End=findBookNum(parts.pop());
    }
    else {
      Start = findBookNum(sScope); 
      End = Start;
    }
    if (sScope.search("Josh-Job,Prov-")!=-1) {noPs = true;}

    Slength = 0; 
    Step = 0;  
    Matches = 0;
    document.getElementById("statusbar-text").label = "";
    for (var sl=Start; sl<=End; sl++) {Slength = Slength + Book[sl].numChaps;}
  
    document.getElementById("progressbox").style.visibility = "visible";
    document.getElementById("searchmsg").value = SBundle.getFormattedString("Searching",[Book[Start].bName]);
    document.getElementById("stopButton").hidden = false;
    
    SearchIntervalID = window.setInterval(searchBook,0);
    Searching = true;
  }
  else {
  // Search all in one go...
    Matches="";
    Searching = true;
    if (!sScope) Matches = Bible.search(SearchedVersion, sText,"",sType,sFlags,true);
    else {
      var newSearch = true;
      var scopes = sScope.split(",");
      for (var i=0; i<scopes.length; i++) {
//jsdump("Fast: sVers:" + SearchedVersion + " sScope:" + scopes[i] + " sType:" + sType + " sFlags:" + sFlags + " newSearch:" + newSearch + "\nsText:>" + sText + "<\n");
        Matches = Bible.search(SearchedVersion, sText, scopes[i], sType, sFlags, newSearch);
        newSearch = false;
      }
    }
    updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
    window.setTimeout('SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);',100);
    Searching = false;
  }
}

const LocaleSearchSymbols = ["SINGLECharWildCard", "MULTICharWildCard", "AND", "OR", "NOT", "SIMILAR", "GROUPSTART", "GROUPEND", "QUOTESTART", "QUOTEEND"];
const ActualSearchSymbols = ["?", "*", "&&", "||", "!", "~", "(", ")", "\"", "\""];
function replaceLocaleSearchSymbols(s) {
  var b = getCurrentLocaleBundle("searchSymbols.properties");
  if (!b) return s;
  for (var i=0; i<LocaleSearchSymbols.length; i++) {
    try {var sym = b.GetStringFromName(LocaleSearchSymbols[i]);} catch (er) {continue;}
    if (!sym || sym.search(/^\s*$/)!=-1) continue;
    s = s.replace(sym, ActualSearchSymbols[i], "g");
  }
  return s;
}

function makeTermsArray(terms) {
  TR = [];
  terms = terms.split(";");
  for (var i=0; i<terms.length; i++) {
    if (terms[i]) {
      var aTerm = {term: null, type: null};
      if (terms[i].substr(0,5)=="lemma") {
        aTerm.term = terms[i];
        aTerm.type = "lemma";
      }
      else {
        aTerm.term = "(^|\\s|–|\\(|>)(" + terms[i] + ")(<|\\s|\\.|\\?|,|;|:|\"|!|\\)|$)"; //Begin and End cannot be \W because non-English letters ARE \W!
        aTerm.type = "RegExp";
      }
      TR.push(aTerm);
    }
  }
}

function updateSearchStatusBar(totalMatches, firstMatchShown, matchesPerPage) {
  document.getElementById("resultsnav").hidden = (totalMatches <= matchesPerPage);
  var lastMatchShown = (totalMatches-firstMatchShown < matchesPerPage ? totalMatches:firstMatchShown + matchesPerPage);
  if (totalMatches == 0) {document.getElementById("statusbar-text").label = SBundle.getFormattedString("Found",[dString("0")]);}
  if (totalMatches > matchesPerPage) {document.getElementById("statusbar-text").label = SBundle.getFormattedString("FoundMult",[dString(firstMatchShown+1),dString(lastMatchShown),dString(totalMatches)]);}
  else {document.getElementById("statusbar-text").label = SBundle.getFormattedString("Found",[dString(totalMatches)]);}
}

function getHTMLSearchResults(firstMatchToWrite, numMatchesToWrite, wordsToHighlight) {
  var displayVersion = prefs.getCharPref("SearchVersion");
  var html="";
  var matches = Bible.getSearchTexts(displayVersion, firstMatchToWrite, numMatchesToWrite, document.getElementById("searchText").value.search("lemma:")!=-1);
  if (!matches) {
    return html;
  }

  try {var versionDirectionEntity = (VersionConfigs[displayVersion].direction == "rtl" ? "&rlm;":"&lrm;");}
  catch (er) {versionDirectionEntity = "&lrm";}
  
  // Build result HTML
  var isStrongsSearch = document.getElementById("searchText").value.search("lemma:")!=-1;
  var strongsArray = [];
  for (var r=0; r<wordsToHighlight.length; r++) {
    if (!wordsToHighlight[r]) continue;
    if (wordsToHighlight[r].type=="lemma") {
      var firstChar = wordsToHighlight[r].term.indexOf("G");
      if (firstChar == -1) firstChar = wordsToHighlight[r].term.indexOf("H");
      if (firstChar != -1) {
        var sterm = "'S:" + wordsToHighlight[r].term.substr(firstChar) + "'";
        strongsArray.push(sterm);
      }
    }
  }
//dump(strongsArray + "\n");
  var matchid, matchLink, matchText; 
  var match = matches.split("<nx/>");
  match.pop(); //remove last value which is always empty
  for (var i=0; i<match.length; i++) {
    var parts = match[i].split("<bg/>");
    if (ModuleUsesVerseKey) {
      try {var bname = Book[findBookNum(parts[0].split(".")[0])].bName;}
      catch (er) {jsdump("WARNING: getHTMLSearchResults, NO BNUM!!: " + parts[0] + "\n"); continue;}
      matchLink = ref2ProgramLocaleText(parts[0]);
    }
    else matchLink = parts[0];
    switch (getModuleLongType(displayVersion)) {
    case BIBLE:
    case COMMENTARY:
    case DICTIONARY:
      matchid = parts[0];
      break;
    case GENBOOK:
      matchid = "/" + displayVersion  + parts[0];
      break;
    }
    matchText = parts[1];
    // Highlight the search word(s)
    for (var r=0; r<wordsToHighlight.length; r++) {
      if (!wordsToHighlight[r]) continue;
      if (wordsToHighlight[r].type=="RegExp") {
        var regex = new RegExp(wordsToHighlight[r].term,"gim");
        matchText = matchText.replace(regex, "$1<span class=\"searchterm\">$2</span>$3");
      }
      else if (wordsToHighlight[r].type=="string") {
        matchText = matchText.replace(wordsToHighlight[r].term, "<span class=\"searchterm\">$&</span>", "gim");
      }
    }
    if (!matchText || matchText.length < 4) {matchText[1] = versionDirectionEntity;} //Unicode control mark insures blank rtl lines do not become ltr or vice versa...
    matchid = encodeUTF8(matchid);
    matchText = matchText.replace(/<br[^>]*>/g, "");
    var tline = "<div class=\"matchverse\"><a id=\"vl." + matchid + "\" href=\"javascript:MainWindowRef.gotoLink('" + matchid + "','" + displayVersion + "');\" class=\"vstyleProgram\">" + matchLink + " - " + "</a><span id=\"vt." + matchid + "\">" + matchText + "</span><br></div>";
    html += tline;
  }
  if (isStrongsSearch) {
    window.setTimeout("MainWindow.highlightStrongs(document.getElementById('search-frame').contentDocument.getElementById('searchBox'), [" + strongsArray + "], 'searchterm')", 0); 
  }
  return html;
}

// This routine is only used by non-indexed search.
function searchBook() {
  if (!(noPs && (Start == 18))) {
    sScope = Book[Start].sName;
//jsdump("Slow Search: sVers:" + SearchedVersion + " sScope:" + sScope + " sType:" + sType + " sFlags:" + sFlags + " newSearch:" + Newsearch + "\nsText:>" + sText + "<\n");
    Matches = Bible.search(SearchedVersion, sText, sScope, sType, sFlags, Newsearch);
    if (Matches > 0) {
      if (Matches > VersesPerPage) {document.getElementById("resultsnav").hidden=false;}
      else {document.getElementById("resultsnav").hidden=true;}
      if (Matches < VersesPerPage) {StartVerse = 0;}
      else {StartVerse = Matches - VersesPerPage;}
      updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
      SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    }
    Newsearch=false;
    Step = Step + Book[Start].numChaps;
    var progress = 100*Step/Slength;
    document.getElementById("progress").value = progress;
  }
  Start++;
  
  if (Start > End) {stopSearch();}
  else {document.getElementById("searchmsg").value = SBundle.getFormattedString("Searching",[Book[Start].bName]);}
  
  //SearchBoxElement.innerHTML = sText + " " + sScope + " " + sType + " " + sFlags;
}

var SearchHelpWindow;
function clickHandler(e) {
  var myId;
  try {myId = e.id;}
  catch (er) {myId = e.target.id;}
  
  switch (myId) {
  case "advancedmatch":
  case "hasthewords":
  case "matchsimilar":
  case "hasthistext":
  case "scopeRadio":
    updateSearchWindow();
    updateSortBy();
    break;
        
  case "sversion.adv":
  case "sversion.sim":
    if (Searching) stopSearch();
    document.getElementById("scopeRadio").selectedIndex=0; // IMPORTANT!: Or else user may unknowingly get a partial search without his choosing!
    // Set Bible version according to selection
    var svers = document.getElementById(myId).selectedItem;
    if (svers && svers.id) {
      svers = svers.id.split(".")[0];
      if (prefs.getCharPref("SearchVersion") != svers) {
        prefs.setCharPref("SearchVersion", svers);
        updateSearchWindow();
        updateSortBy();
        if (getModuleLongType(SearchedVersion) == BIBLE && getModuleLongType(svers) == BIBLE) {
          updateSearchBoxStyle(svers);
          SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
        }
      }
    }
    break;
    
  case "moreless":
    prefs.setBoolPref("AdvSearchFlag",!prefs.getBoolPref("AdvSearchFlag"));
    updateAdvancedPanel();
    break;
    
  case "sort":
    if (SearchBoxElement.innerHTML != "") {searchBible();}
    break;
  
  case "first":
    StartVerse=0;
    updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
    SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    break;
    
  case "prev":
    StartVerse = StartVerse - VersesPerPage;
    if (StartVerse < 0) {StartVerse = 0;}
    updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
    SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    break;
    
  case "last":
    StartVerse = Matches - VersesPerPage;
    if (StartVerse<0) {StartVerse=0;}
    updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
    SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    break;
  
  case "next":
    if (StartVerse + VersesPerPage < Matches) {
      StartVerse = StartVerse + VersesPerPage;
      updateSearchStatusBar(Matches, StartVerse, VersesPerPage);
      SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    }
    break;
    
  case "searchButton":
    searchBible();
    break;
    
  case "stopButton":
    stopSearch();
    break;
    
  case "createIndexButton":
    Newsearch=true;
    window.clearInterval(SearchIntervalID);
    document.getElementById("progressbox").style.visibility = "hidden";
    document.getElementById("searchmsg").value = "";
    document.getElementById("stopButton").hidden = true;
    document.getElementById("progress").value = 0;
    startIndexer(false)
    break;
    
  case "question":
  case "searchHelp":
    SearchHelpWindow = window.open("chrome://xulsword/content/searchHelp.xul","searchHelp","chrome,resizable");
    break;
  }
}

function stopSearch() {
//jsdump("Stopping search...\n");
  Newsearch=true;
  if (SearchIntervalID) window.clearInterval(SearchIntervalID);
  document.getElementById("progressbox").style.visibility = "hidden";
  document.getElementById("searchmsg").value = "";
  document.getElementById("stopButton").hidden = true;
  document.getElementById("progress").value = 0;
  Searching=false;
}

function mouseHandler(e) {
  var myId = e.target.id;
  if (e.type == "mouseover") {
    switch (myId) {
    case "prev":
      e.target.src = "chrome://xulsword/skin/images/uarrow2.bmp";
      break;
      
    case "next":
      e.target.src = "chrome://xulsword/skin/images/darrow2.bmp";
      break;
      
    case "first":
      e.target.src = "chrome://xulsword/skin/images/uuarrow2.bmp";
      break;
      
    case "last":
      e.target.src = "chrome://xulsword/skin/images/ddarrow2.bmp";
      break;
    }
  }
  if (e.type == "mouseout") {
    switch (myId) {
    case "prev":
      e.target.src = "chrome://xulsword/skin/images/uarrow1.bmp";
      break;
      
    case "next":
      e.target.src = "chrome://xulsword/skin/images/darrow1.bmp";
      break;
      
    case "first":
      e.target.src = "chrome://xulsword/skin/images/uuarrow1.bmp";
      break;
      
    case "last":
      e.target.src = "chrome://xulsword/skin/images/ddarrow1.bmp";
      break;
    }
  }
}

function unloadSearchWindow() {
  window.controllers.removeController(XulswordSearchController);
  window.controllers.removeController(BookmarksMenuController);
  try {SearchHelpWindow.close();} catch(er) {}
}

/************************************************************************
 * Command Controller
 ***********************************************************************/ 

var XulswordSearchController = {
 
  doCommand: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
      BookmarksCommand.undoBookmarkTransaction();
      break;
    case "cmd_redo":
      BookmarksCommand.redoBookmarkTransaction();
      break;
    case "cmd_bm_open":
      MainWindow.gotoLink(TargLink, TargetLocation.version);
      break;
    case "cmd_xs_searchForSelection":
      setUnicodePref("SearchText",getSearchWindowSelection());
      prefs.setIntPref("InitialSearchType", -EXACT_TEXT);
      window.opener.document.getElementById("cmd_xs_search").doCommand();
      break;
    case "cmd_xs_newBookmark":
      BookmarkFuns.addBookmarkAs(TargetLocation, false);
      break;
    case "cmd_xs_newUserNote":
      BookmarkFuns.addBookmarkAs(TargetLocation, true);
      break;
    }
  },
  
  isCommandEnabled: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
      return (gTxnSvc.numberOfUndoItems > 0);
    case "cmd_redo":
      return (gTxnSvc.numberOfRedoItems > 0);
    case "cmd_xs_searchForSelection":
      return (getSearchWindowSelection()!="");
    case "cmd_bm_open":
    case "cmd_xs_newBookmark":
    case "cmd_xs_newUserNote":
      return (TargLink!="");
      break;   
    }
    return true;
  },
  
  supportsCommand: function (aCommand) {
    switch (aCommand) {
    case "cmd_undo":
    case "cmd_redo":
    case "cmd_bm_open":
    case "cmd_xs_searchForSelection":
    case "cmd_xs_newBookmark":
    case "cmd_xs_newUserNote":
      return true;
    }
    return false;
  }
}

/************************************************************************
 * Context Menu functions
 ***********************************************************************/ 

var TargLink = "";
var TargetLocation = {};
function SearchContextMenuShowing(e) {
  //dump ("SearchContextMenuShowing:" + document.popupNode.id + "\n");
  goUpdateCommand("cmd_copy");
  goUpdateCommand("cmd_xs_searchForSelection");
  
  var targ = document.popupNode;
  var win = targ.ownerDocument.defaultView;
  
  // Find what we are right clicking over...
  var parent = targ;
  WHILELP:
  while (parent) {
    if (parent.id) {
      var parts = parent.id.split(".");
      if (parts && parts[0]=="vt") {
        TargLink = parts[1];
        var link = decodeUTF8(parts[1]);
        var vers = prefs.getCharPref("SearchVersion");
        switch (getModuleLongType(vers)) {
        case BIBLE:
        case COMMENTARY:
          link = link.split(".");
          TargetLocation = {
            shortName: link[0], 
            chapter: link[1], 
            verse: link[2], 
            lastVerse: link[2], 
            version: vers
          }
          break
        case DICTIONARY:
        case GENBOOK:
          TargetLocation = {
            shortName: "", 
            chapter: link, 
            verse: 1, 
            lastVerse: 1, 
            version: vers
          }
          break;
        }
        break;
      }
    }
    parent = parent.parentNode;
  }
  var overVerse = (TargLink!="");
  if (!overVerse) {e.preventDefault();}
//dump(TargLink + "\n");
}

function getSearchWindowSelection() {
  var selectedText="";
  var selob = document.getElementById("search-frame").contentDocument.defaultView.getSelection();
  if (!selob.isCollapsed) {selectedText = selob.toString();}
  return selectedText;
}

function SearchContextMenuHidden(aEvent) {
  var TargLink = "";
}


/************************************************************************
 * Indexer
 ***********************************************************************/

var SearchAfterCreate;
function startIndexer(searchAfterCreate) {
  allWindowsModal(true);
  SearchAfterCreate = searchAfterCreate;
  document.getElementById("progressbox").style.visibility="visible";
  document.getElementById("progress").value=0;
  document.getElementById("searchmsg").value = SBundle.getString("BuildingIndex");
  document.getElementById("stopButton").hidden = true;
  Indexer.create();
}

function indexerFinished() {
  document.getElementById("progressbox").style.visibility="hidden";
  document.getElementById("progress").value=0;
  document.getElementById("searchmsg").value = "";
  document.getElementById("stopButton").hidden = true;
  updateSearchWindow();
  updateSortBy();
  allWindowsModal(false);
  if (SearchAfterCreate) searchBible();
}

function allWindowsModal(setModal) {
  for (var i=0; i<MainWindow.SearchWins.length; i++) {
    windowModal(MainWindow.SearchWins[i], setModal);
  }
  if (MainWindow.ManagerWindow)
    windowModal(MainWindow.ManagerWindow, setModal);
  windowModal(MainWindow, setModal);
}

var stopevent = function(event) {event.stopPropagation(); event.preventDefault();}
function windowModal(win, setModal) {
  var events = ["click", "mouseover", "mouseout", "mousemove", "mousedown",
            "mouseup", "dblclick", "select", "keydown", "keypress", "keyup"];
  if (setModal) {
    for (var i=0; i<events.length; i++){
      win.addEventListener(events[i], stopevent, true);
    }
  }
  else {
    for (var i=0; i<events.length; i++){
      win.removeEventListener(events[i], stopevent, true);
    }
  }
}

/************************************************************************
 * Printing Functions
 ***********************************************************************/ 
function handlePrintCommand(command) {
  var topWindow = WindowWatcher.getWindowByName("main-window",window);
  topWindow.SavedWindowWithFocus = window;
  topWindow.focus();
  
  switch (command) {
  case "cmd_pageSetup":
    topWindow.document.getElementById("cmd_pageSetup").doCommand();
    break;
  case "cmd_printPreview":
  case "cmd_print":
    topWindow.document.getElementById("printBrowser").contentDocument.getElementById("printBox").innerHTML = getSearchPrintHTML();
    topWindow.document.getElementById("printBrowser").contentDocument.title = SBundle.getString("Title") + ": " + document.title;
    topWindow.document.getElementById(command).doCommand();
    break;
  }
}
 
function getSearchPrintHTML() {
  var myversion = prefs.getCharPref("SearchVersion");
  var p = "<div style=\"position:relative;\" class=\"page vstyle" + myversion + "\">";
  // print max of 100 results...
  p += getHTMLSearchResults(StartVerse, 100, TR);
  if (Matches>100) p += "<br><hr><hr><hr><hr>";
  p += "<hr>[" + getCopyright(myversion) + "]<br>";
  p += "</div>";
  
  return p;
}
