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

var StartVerse=0;
var VersesPerPage=30;
var Matches = 0;

//Globals for current settings
//var sText = "";
//var rawText = "";
//var sScope = 0;
//var sType = 0;
//var sFlags = 0;

//Globals for scope and progress meter implementation
//var Start = 0;
//var End = 0;
//var Slength = 0;
//var Step = 0;

//Globals for search routine
//var Newsearch=true;
//var SearchedVersion="";
//var ModuleUsesVerseKey;
//var TR = []; //new Array(6);
//for (var itr=0; itr<TR.length; itr++) {TR[itr] = new Object;}

//var SearchIntervalID;
//var Searching;
//var SearchBoxElement;
//var OriginalWindowTitle="";
//var noPs = false;   //No Psalms in Wisdom books (Psalms has own category)

const REGEX=0, PHRASE=-1, MULTIWORD=-2, ENTRY_ATTRIBUTE=-3, LUCENE=-4, COMPOUND=-5;  
const LocaleSearchSymbols = ["SINGLECharWildCard", "MULTICharWildCard", "AND", "OR", "NOT", "SIMILAR", "GROUPSTART", "GROUPEND", "QUOTESTART", "QUOTEEND"];
const ActualSearchSymbols = ["?", "*", "&&", "||", "!", "~", "(", ")", "\"", "\""];

var Search;
var SearchResults;
var LexiconResults;

function initSearch() {
  
  initCSS();
  
  Search = new SearchObj();
  
  SearchResults = document.getElementById("search-frame").contentDocument.getElementById("searchBox");
  LexiconResults = document.getElementById("search-frame").contentDocument.getElementById("lexiconBox");
  
  Search.init();
  
}

function SearchObj(searchObj) {

  if (searchObj) {
  
    this.searchModule = 
    this.searchText = searchObj.searchText;
    this.originalTitle = 
    this.showAdvanced = 
    this.searchingTO = 
    this.isNewSearch = 
    this.progress = {startVerse:null, }
    this.result = {matcherms:null, }
  
  }
  else {
  
  }
  
  // Initialize our search object according to the object's "this" parameters,
  // available Tabs, etc. Also initiates a search upon completion
  this.init = function() {

    // init Search textbox & window title
    document.getElementById("searchText").value = this.searchText;

    this.originalTitle = document.title;
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", this.searchText));
    
    // hide any scope labels which are not supplied by the UI
    var scopes = ["sg1","sg2","sg3","sg4","sg5","sg6"];
    for (var i=0; i<scopes.length; i++) {
      var elem = document.getElementById(scopes[i]);
      if (elem.label == "") {elem.hidden = true;}
    }

    // add module radio buttons according to type
    var numcols = 1;
    for (var rowtype in SupportedModuleTypes) {
      for (var t=0; t<Tabs.length; t++) {
        if (getShortTypeFromLong(Tabs[t].modType) != rowtype) continue;
        
        var row = document.getElementById(rowtype + "-row");
        row.setAttribute("hidden", "false");
        
        var radio = document.createElement("radio");
        radio.setAttribute("class", "radio cs-" + Tabs[t].locName);
        radio.setAttribute("id", "radio."+ Tabs[t].modName);
        radio.setAttribute("label", Tabs[t].label);
        
        // do we need to add another column now?
        if (row.childNodes.length + 1 > numcols) {
          document.getElementById("module-columns").appendChild(document.createElement("column");
          numcols++;
        }
      
        row.appendChild(radio);
      }
    }
    
    document.getElementsByTagName("toolbar")[0].setAttribute("showAdvanced", (this.showAdvanced ? "true":"false"));

    // select our module to search in the radiogroup
    var item = document.getElementById("radio." + this.searchModule);
    document.getElementById("search-module").selectedItem = item; 
    
    this.update();

    // now do a search if we have text to search for
    if (this.searchText != "") {
    
      if (document.getElementById("searchType").selectedIndex == EXACT_TEXT || !Bible.luceneEnabled(this.searchModule))
        window.setTimeout("Search.search()", 500); // Timeout is for non-Lucene search
      else this.search();
      
    }
  };


  // The update function assumes our "this" parameters are updated already, 
  // and it just uses them to update the search UI.
  this.update = function() {

    // update the choose-book dropdown
    var svers = getPrefOrCreate("SearchVersion", "Char", prefs.getCharPref("DefaultVersion"));
    document.getElementById("moddropdown").version = this.searchModule;
    
    var myType = getModuleLongType(svers);
    ModuleUsesVerseKey = (myType==BIBLE || myType==COMMENTARY);
    
    // disable book dropdown menu unless "choose book" is selected
    if (document.getElementById("scopeRadio").selectedItem == document.getElementById("searchCB")) {
      document.getElementById("scopeMenu").disabled = false;
    }
    else {document.getElementById("scopeMenu").disabled = true;}
    
    // disable scope choices if module is not a versekey module
    var radioIDs = ["searchAll","searchOT","searchNT","searchSelect","sg1","sg2","sg3","sg4","sg5","sg6"];
    if (Tab[this.searchModule].modType != BIBLE && Tab[this.searchModule].modType != COMMENTARY ) {
      radioDisabled = [false,true,true,true,true,true,true,true,true,true];
      document.getElementById("scopeRadio").selectedItem = document.getElementById("searchAll");
    }
    else radioDisabled = [false,false,false,false,false,false,false,false,false,false];
    for (var i=0; i<radioIDs.length; i++) {document.getElementById(radioIDs[i]).setAttribute("disabled", radioDisabled[i]);}

    // enable/disable Lucene related stuff
    document.getElementById("stopButton").hidden = true;
    document.getElementById("dividerBox").hidden = Bible.luceneEnabled(this.searchModule);
    document.getElementById("createSearchIndexBox").hidden = Bible.luceneEnabled(this.searchModule);

  };

/*
function updateSearchBoxStyle(svers) {
  var searchBoxBodyElem = document.getElementById("search-frame").contentDocument.getElementById("searchBoxBody");
  searchBoxBodyElem.className = "searchres cs-" + svers;
  // The following is a work around for a MOZILLA BUG
  searchBoxBodyElem.style.whiteSpace = (searchBoxBodyElem.style.direction == "rtl" ? "normal":"");
}
*/

  // Initiates a search using the Search object's previously set parameters.
  // It is possible to search using a Worker thread for progress feedback. But 
  // this requires reinitializing SWORD for each and every search. This becomes
  // unnecessary if we use timeouts for non-Lucene search progress, so this is
  // the chosen approach.
  this.search = function() {

    if (this.searchingTO) stopSearch();
    if (!this.searchText) return;
    
    // change window title to new search
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", this.searchText);
    
    // prepare search results window for new results
    SearchResults.innerHTML = "";
    SearchResults.className = SearchResults.className.replace(/(\s*cs\-\S+)?\s*?$/, " cs-" + this.searchModule);
    SearchResults.style.whiteSpace = (ModuleConfigs[this.searchModule].direction == "rtl" ? "normal":"");
    LexiconResults.innerHTML = "";
    LexiconResults.className = LexiconResults.className.replace(/(\s*cs\-\S+)?\s*?$/, " cs-" + this.searchModule);
    
    if (!Bible.luceneEnabled(this.searchModule)) {
      try {
        var dontAsk = (prefs.getBoolPref("dontAskAboutSearchIndex." + this.searchModule) && 
            document.getElementById("searchText").value.search("lemma:") == -1);
      }
      catch (er) {dontAsk = false;}
      
      if (!dontAsk) {
        var result={};
        var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
            fixWindowTitle(SBundle.getString("BuildingIndex")),
            SBundle.getString("NeedSearchIndex"), 
            DLGINFO,
            DLGOKCANCEL);
        prefs.setBoolPref("dontAskAboutSearchIndex." + this.searchModule, true);
        if (result.ok) startIndexer(true)
        return;
      }
    }
    
    this.isNewSearch = true;
    this.progress.startVerse = 0
    
    // process our search text using Search settings to create an actual search term
    var sText = this.searchText;
    sText = sText.replace(/^\s*/,"");       //remove leading whitespace
    sText = sText.replace(/\s*$/,"");       //remove trailing whitespace
    sText = sText.replace(/\s+/," ");       //change all white space to " "
    
    // replace UI search symbols with internally recognized search symbols
    var bundle = getCurrentLocaleBundle("searchSymbols.properties");
    for (var i=0; i<LocaleSearchSymbols.length; i++) {
      try {var sym = bundle.GetStringFromName(LocaleSearchSymbols[i]);} catch (er) {continue;}
      if (!sym || (/^\s*$/).test(sym)) continue;
      sText = sText.replace(sym, ActualSearchSymbols[i], "g");
    }

    var rawText = sText;

    // prepare search text based on search type
    var sType;
    if (Bible.luceneEnabled(this.searchModule)) {
      sType = LUCENE; //Lucene search
      
      // if Lucene special chars/operators are present then take string literally without any modification
      if (sText.search(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/)!=-1) {
        document.getElementById("searchType").selectedIndex = USING_SEARCH_TERMS;
      }
      
      switch (document.getElementById("searchType").selectedIndex) {
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
    
    // get Search scope
    var sScope = ""; // default scope is all
    if (Tab[this.searchModule].modType == BIBLE || Tab[this.searchModule].modType == COMMENTARY) {
      
      sScope = document.getElementById("scopeRadio").selectedItem.value;
      
      if (document.getElementById("scopeRadio").selectedItem == document.getElementById("searchCB")) {
        sScope = document.getElementById("scopeMenu").selectedItem.value; // value comes from UI!
      }
      
    }
    
    // Highlight Results- build regular expressions for highlighting results
    this.result = null;
    switch (document.getElementById("searchType").selectedIndex) {
    case CONTAINS_THE_WORDS:
    case SIMILAR_WORDS:
      rawText = rawText.replace(/ +/g,";"); //change spaces into ";" for later splitting needed for hilighting matched words
      this.result.matchterms = getTermsArray(rawText);
      break;

    case EXACT_TEXT:
      this.result.matchterms = [{term:rawText, type:"string"}];
      break;
      
    case USING_SEARCH_TERMS:
      rawText = rawText.replace(/ +/g,";");
      rawText = rawText.replace(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|~|:|\\|AND;|OR;|NOT;)/g,""); //remove all control chars except [?";*]
      rawText = rawText.replace("?",".","g");     //add dots before any ?s
      rawText = rawText.replace("*",".*?","g");   //add dots before any *s
      
      //change ";"s which are between quotes back into spaces, and remove quotes
      var quoted = false; 
      var tmp = "";
      for (var x=0; x<rawText.length; x++) {
        var mychr = rawText.charAt(x);
        if (mychr == "\"") {quoted = !quoted; continue;}
        
        if (quoted && (mychr == ";")) {tmp += "\\s+";} // the \\s+ allows for more than one space between words in the striped text (common thing)
        else {tmp = tmp + mychr;}
      }
      rawText = tmp;
      
      this.result.matchterms = getTermsArray(rawText);
      break;
    }
    
    // get Search flags
    sFlags = 0;
    if (document.getElementById("searchType").selectedIndex != SIMILAR_WORDS) {
      sFlags = sFlags|2048; // Turn on Sort By Relevance flag
    } 
    sFlags = sFlags|2; //Turn "Ignore Case" flag on. BUG NOTE: THIS DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
    
    //Do the search
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
      for (var sl=Start; sl<=End; sl++) {Slength = Slength + Bible.getMaxChapter("KJV", Book[sl].sName);}
    
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
  };
  
  
  



function getTermsArray(terms) {
  var TR = [];
  terms = terms.split(";");
  for (var i=0; i<terms.length; i++) {
    if (terms[i]) {
      var aTerm = {term: null, type: null};
      if (terms[i].substr(0,5) == "lemma") {
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
  
  return TR;
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
  var matches = Bible.getSearchResults(displayVersion, firstMatchToWrite, numMatchesToWrite, document.getElementById("searchText").value.search("lemma:")!=-1);
  if (!matches) {
    return html;
  }

  try {var versionDirectionEntity = (ModuleConfigs[displayVersion].direction == "rtl" ? "&rlm;":"&lrm;");}
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
  var match = matches.split("<nx>");
  match.pop(); //remove last value which is always empty
  for (var i=0; i<match.length; i++) {
    var parts = match[i].split("<bg>");
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
    if (!matchText || matchText.length < 4) {matchText = versionDirectionEntity;} //Unicode control mark insures blank rtl lines do not become ltr or vice versa...
    matchid = encodeUTF8(matchid);
    matchText = matchText.replace(/<br[^>]*>/g, "");
    //var tline = "<div class=\"matchverse\"><a id=\"vl." + matchid + "\" href=\"javascript:MainWindowRef.gotoLink('" + matchid + "','" + displayVersion + "');\" class=\"cs-Program\">" + matchLink + " - " + "</a><span id=\"vt." + matchid + "\">" + matchText + "</span><br></div>";
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
    Step = Step + Bible.getMaxChapter("KJV", Book[Start].sName);
    var progress = 100*Step/Slength;
    document.getElementById("progress").value = progress;
  }
  Start++;
  
  if (Start > End) {stopSearch();}
  else {document.getElementById("searchmsg").value = SBundle.getFormattedString("Searching",[Book[Start].bName]);}
  
  //SearchBoxElement.innerHTML = sText + " " + sScope + " " + sType + " " + sFlags;
}

function onRefUserUpdate() {
  changeToModule(document.getElementById("moddropdown").version);
}

function changeToModule(mod) {
  if (Searching) stopSearch();
  document.getElementById("scopeRadio").selectedIndex=0; // IMPORTANT!: Or else user may unknowingly get a partial search without his choosing!
  if (prefs.getCharPref("SearchVersion") != mod) {
    prefs.setCharPref("SearchVersion", mod);
    updateSearchWindow();
    updateSortBy();
    if (getModuleLongType(SearchedVersion) == BIBLE && getModuleLongType(mod) == BIBLE) {
      updateSearchBoxStyle(mod);
      SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    }
  }
}

var SearchHelpWindow;
function commandHandler(e) {
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
        
  case "sversion.sim":
    var svers = document.getElementById(myId).selectedItem;
    if (svers && svers.id) {
      svers = svers.id.split(".")[0];
      changeToModule(svers);
    }
    break;
    
  case "moreless":
    prefs.setBoolPref("AdvSearchFlag",!prefs.getBoolPref("AdvSearchFlag"));
    updatePanel();
    break;
    
  case "sort":
    if (SearchBoxElement.innerHTML != "") {this.search();}
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
    this.search();
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
    AllWindows.push(SearchHelpWindow);
    break;
  }
}

function stopSearch() {
//jsdump("Stopping search...\n");
  window.clearInterval(this.searchingTO);
  this.searchingTO = null;
  document.getElementById("progressbox").style.visibility = "hidden";
  document.getElementById("searchmsg").value = "";
  document.getElementById("stopButton").hidden = true;
  document.getElementById("progress").value = 0;
}

function unloadSearchWindow() {
  if (MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.terminate(); // doesn't actually terminate anything
    MainWindow.Indexer.exitfunc = null;
  }
  window.controllers.removeController(XulswordSearchController);
  window.controllers.removeController(BookmarksMenuController);
  try {SearchHelpWindow.close();} catch(er) {}
}


/************************************************************************
 * Indexer
 ***********************************************************************/

var SearchAfterCreate;
function startIndexer(searchAfterCreate) {
  SearchAfterCreate = searchAfterCreate;
  document.getElementById("progressbox").style.visibility="visible";
  document.getElementById("progress").value=0;
  document.getElementById("searchmsg").value = SBundle.getString("BuildingIndex");
  document.getElementById("stopButton").hidden = true;
  if (!MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.progressMeter = document.getElementById("progress");
    MainWindow.Indexer.exitfunc = indexerFinished;
    Bible.allWindowsModal(true); // prevent triggering of Bible ops
    window.setTimeout("MainWindow.Indexer.create();", 500); // allow pending Bible ops before starting indexer
  }
}

function indexerFinished() {
  document.getElementById("progressbox").style.visibility="hidden";
  document.getElementById("progress").value=0;
  document.getElementById("searchmsg").value = "";
  document.getElementById("stopButton").hidden = true;
  updateSearchWindow();
  updateSortBy();
  if (SearchAfterCreate) this.search();
}

/************************************************************************
 * Printing Functions
 ***********************************************************************/ 
function handlePrintCommand(command) {
  var topWindow = WindowWatcher.getWindowByName("xulsword-window",window);
  //topWindow.SavedWindowWithFocus = window;
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
  var p = "<div style=\"position:relative;\" class=\"page cs-" + myversion + "\">";
  // print max of 100 results...
  p += getHTMLSearchResults(StartVerse, 100, TR);
  if (Matches>100) p += "<br><hr><hr><hr><hr>";
  p += "<hr>[" + getCopyright(myversion) + "]<br>";
  p += "</div>";
  
  return p;
}
