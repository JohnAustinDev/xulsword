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

//var StartVerse=0;
//var VersesPerPage=30;
//var Matches = 0;

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
var MatchingStrongs = getCSS(".matchingStrongs {"); // Read from CSS stylesheet
var AddedStrongsCSSRules = [];

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
    this.progress = {timeout:, books:, index:, searchedchaps, totalchaps: };
    this.result = { matchterms:, list:, count:, index:, results_per_page: }
    this.s = {mod:, query:, scope:, type:, flags: isnew:}
  
  }
  else {
  
    this.result = { matcherms:null, list:null, index:null, count:30 }
  }
  
  // Initialize our search object according to the object's "this" parameters,
  // available Tabs, etc. Also may initiate a search upon completion
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
        radio.setAttribute("id", "mod-radio."+ Tabs[t].modName);
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
  // and it just uses them to update the advanced search UI.
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


  // Initiates a search using the Search object's previously set parameters.
  // It is possible to search using a Worker thread for progress feedback. But 
  // this requires reinitializing SWORD for each and every search. This becomes
  // unnecessary if we use timeouts for non-Lucene search progress, so this is
  // the chosen approach.
  this.search = function() {

    if (this.progress && this.progress.timeout) this.quitProgress(true);
    if (!this.searchText) return;
    
    // Remove any previously added Strong's lemma classes from CSS stylesheet 
    for (var i = (AddedStrongsCSSRules.length-1); i>=0; i--) {
      AddedStrongsCSSRules[i].sheet.deleteRule(AddedStrongsCSSRules[i].index);
    }
    
    this.s = {};
    this.result = {};
    this.progress = null;
    
    this.s.isnew = true;
    this.s.mod = this.searchModule;
    
    // change window title to new search
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", this.searchText);
    
    // prepare search results window for new results
    SearchResults.innerHTML = "";
    //SearchResults.style.whiteSpace = (ModuleConfigs[this.s.mod].direction == "rtl" ? "normal":""); // FF bug workaround
    LexiconResults.innerHTML = "";
    
    // ask user if search index may be created now?
    if (!Bible.luceneEnabled(this.s.mod)) {
      try {
        var dontAsk = (prefs.getBoolPref("dontAskAboutSearchIndex." + this.s.mod) && 
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
        prefs.setBoolPref("dontAskAboutSearchIndex." + this.s.mod, true);
        if (result.ok) startIndexer(true)
        return;
      }
    }
    
    // process our search text using Search settings to create an actual search term
    this.s.query = this.searchText;
    this.s.query = this.s.query.replace(/^\s*/,"");       //remove leading whitespace
    this.s.query = this.s.query.replace(/\s*$/,"");       //remove trailing whitespace
    this.s.query = this.s.query.replace(/\s+/," ");       //change all white space to " "
    
    // replace UI search symbols with internally recognized search symbols
    var bundle = getCurrentLocaleBundle("searchSymbols.properties");
    for (var i=0; i<LocaleSearchSymbols.length; i++) {
      try {var sym = bundle.GetStringFromName(LocaleSearchSymbols[i]);} catch (er) {continue;}
      if (!sym || (/^\s*$/).test(sym)) continue;
      this.s.query = this.s.query.replace(sym, ActualSearchSymbols[i], "g");
    }

    var rawText = this.s.query; // save query at this point for use later

    // prepare search text based on search type
    if (Bible.luceneEnabled(this.s.mod)) {
      this.s.type = LUCENE; //Lucene search
      
      // if Lucene special chars/operators are present then take string literally without any modification
      if (this.s.query.search(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/)!=-1) {
        document.getElementById("searchType").selectedIndex = USING_SEARCH_TERMS;
      }
      
      switch (document.getElementById("searchType").selectedIndex) {
      case CONTAINS_THE_WORDS:
        this.s.query = this.s.query.replace(" "," AND ","gim");
        break;
        
      case SIMILAR_WORDS:
        this.s.query = this.s.query.replace(/\s*$/, "~");
        this.s.query = this.s.query.replace(" ", "~ AND ","gim");
        break;
        
      case EXACT_TEXT:
        this.s.type = MULTIWORD; //MULTIWORD and REGEX ARE CASE SENSETIVE! COMPOUND DOES NOT WORK!!!!
        break;
        
      case USING_SEARCH_TERMS:
        break;
      }
    }
    // no Lucene
    else {this.s.type = REGEX;}
    
    // get Search scope
    this.s.scope = ""; // default scope is all
    if (Tab[this.s.mod].modType == BIBLE || Tab[this.s.mod].modType == COMMENTARY) {
      
      if (document.getElementById("scopeRadio").selectedItem == document.getElementById("searchCB"))
          this.s.scope = document.getElementById("scopeMenu").selectedItem.value; // value comes from UI!
      else this.s.scope = document.getElementById("scopeRadio").selectedItem.value; // value comes from UI!
      
    }
    
    // to highlight results, build regular expressions for matching them
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
    this.s.flags = 0;
    if (document.getElementById("searchType").selectedIndex != SIMILAR_WORDS) {
      this.s.flags = this.s.flags|2048; // Turn on Sort By Relevance flag
    } 
    this.s.flags = this.s.flags|2; //Turn "Ignore Case" flag on. BUG NOTE: THIS DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
    
    // There are two different methods of searching: 1) search piecemeal
    // book by book, using timeouts to update a progress bar and 
    // initiate search on another piece of the full search scope. 2) 
    // search the entire scope at once without any progress bar.
    if (this.s.type != LUCENE && 
        (Tab[this.s.mod].modType == BIBLE || 
        Tab[this.s.mod].modType == COMMENTARY)) {
          
      // search book by book...
      this.progress = {};
      
      // get array of books to search from scope param
      // example Scope=Gen Ps.0-Ps.150 Matt-Rev
      this.progress.books = [];
      var s = (this.s.scope + " ").split(/\s+/);
      for (var x=0; x<s.length; x++) {
        if (!s[x]) continue;
        var b = (s[x] + "-").split("-");
        for (var y=0; y<b.length; y++) {
          if (!b[y]) continue;
          b[y] = b[y].replace(/^([^\.]*)\..*$/, "$1");
          var bn = findBookNum(b[y]);
          if (bn === null) continue; // unrecognized book in scope
          this.progress.books[bn] = true;
        }
      }

      // show and init progress meter
      this.result.count = 0;
      this.progress.searchedchaps = 0;
      this.progress.totalchaps = 0;
      for (var x=0; x<this.progress.books.length; x++) {
        if (!this.progress.books[x]) continue;
        if (!this.progress.hasOwnProperty("index")) this.progress.index = x;
        this.progress.totalchaps += Bible.getMaxChapter("KJV", Book[x].sName);
      }
      document.getElementById("statusbar-text").label = "";    
      document.getElementById("progressbox").style.visibility = "visible";
      document.getElementById("searchmsg").value = SBundle.getFormattedString("Searching",[Book[this.progress.index].bName]);
      document.getElementById("stopButton").hidden = false;
      
      this.progress.timeout = window.setTimeout("Search.searchNextBook();" , 1);
      
    }
    else {
      
      // Search all in one go...
      this.result.count = Bible.search(this.s.mod, this.s.query, "", this.s.scope, this.s.flags, this.s.isnew);

      this.updateStatusBar(this.result);
      
      this.showSearchResults(this.s.mod, this.result, this.s);
    }
  };
  
  
  this.getTermsArray = function(terms) {
    var tr = [];
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
        tr.push(aTerm);
      }
    }
    
    return tr;
  };


  this.updateStatusBar = function(result) {
    
    // don't show navigation arrows if they're not needed
    document.getElementById("resultsnav").hidden = (result.count <= result.results_per_page);
    
    // display number of results showing
    var lastMatchShown = (result.count - result.index < result.results_per_page ? result.count:result.index + result.results_per_page);
    if (result.count > result.results_per_page) {
      document.getElementById("statusbar-text").label = SBundle.getFormattedString("FoundMult", [dString(result.index + 1), dString(lastMatchShown), dString(result.count)]);
    }
    else document.getElementById("statusbar-text").label = SBundle.getFormattedString("Found", [dString(result.count)]);
    
  };


  // Display the current page of results for the last search. NOTE:
  // the module (mod) is not always the same as that which generated
  // the search results.
  this.showSearchResults = function(mod, result, s) {
    if (!result || !s) return;
    
    // only allow translation if both mod and s.mod are BIBLEs
    if (mod != s.mod && (Tab[mod].modType != BIBLE || Tab[s.mod].modType != BIBLE)) return;

    // read our search results
    var r = Bible.getSearchResults(mod, result.index, result.results_per_page, (/lemma\:/).test(s.query));
    if (!r) return;
    
    SearchResults.innerHTML = r;
    
    r = SearchResults.firstChild;
    while(r) {
      var p = getElementInfo(r);
      
      // add a reference link to each result
      var l = document.createElement("a");
      if (Tab[s.mod].modType == BIBLE || Tab[s.mod].modType == COMMENTARY) {
        // translate from s.mod to mod...
        var loc = Bible.convertLocation(Bible.getVerseSystem(s.mod), p.osisref, Bible.getVerseSystem(mod));
        l.innerHTML = ref2ProgramLocaleText(loc);
        l.className = "cs-Program";
        loc = loc.split(".");
        l.setAttribute("href", "javascript:MainWindow.showLocation('" + mod + "','" + loc[0] + "','" + loc[1] + "','" + loc[2] + "','" + loc[3] + "');");
      }
      else {
        l.innerHTML = p.ch;
        l.className = "cs-" + mod;
        l.setAttribute("href", "javascript:MainWindow.showLocation('" + mod + "','na','" + p.ch + "','" + p.vs + "','" + p.lv + "');");
      }
      
      var reftext = r;
      r.insertBefore(l, r.firstChild);
      
      // apply hilights to search result matches
      var html = reftext.innerHTML;
      for (var m=0; m<results.matchterms.length; m++) {
        if (!results.matchterms[m]) continue;
        if (results.matchterms[m].type == "RegExp") {
          var regex = new RegExp(results.matchterms[m].term, "gim");
          html = html.replace(regex, "$1<span class=\"searchterm\">$2</span>$3");
        }
        else if (results.matchterms[m].type == "string") {
          html = html.replace(results.matchterms[m].term, "<span class=\"searchterm\">$&</span>", "gim");
        }
      }
      
      html = html.replace(/<br[^>]*>/g, "");
      
      reftext.innerHTML = html;
      
      r = r.nextSibling;
    }
    
    // If this is a Strong's search, hilight words with matching Strong's numbers.
    // Also, create and show lexicon window for those Strong's numbers.
    if ((/lemma\:/).test(s.query)) {
      
      var classes = s.query.match(/lemma\:(\S+)/g);
      
      for (var i=0; i<classes.length; i++) {
        if (!(/^S_/).test(classes[i])) continue;
        var sheet = document.styleSheets[document.styleSheets.length-1];
        var index = sheet.cssRules.length;
        sheet.insertRule(MatchingStrongs.rule.cssText.replace("matchingStrongs", classes[i]), index);
        AddedStrongsCSSRules.push( { sheet:sheet, index:index } );
      }
      
      if (!LexiconResults.innerHTML) {
        
        LexiconResults.innerHTML = Bible.getSearchResults(mod, 0, 0, true);
        
        var html = "";
        for (var i=0; i<classes.length; i++) {
          if (!(/^S_/).test(classes[i])) continue;
          
          var lexicon = [];
          
          // iterate through all elements having this Strong's number
          var els = LexiconResults.getElementsByClassName(classes[i]);
          for (var el=0; el<els.length; el++) {
            
            // See if we've gotten this element's text already and if so, 
            // increment its count. Otherwise add a new lexicon object.
            for (var j=0; j<lexicon.length; j++) {
              if (els[el].innerHTML == lexicon[j].text) {
                lexicon[j].count++;
                break;
              }
            }
            
            if (j == lexicon.length) lexicon.push( {text:els[el].innerHTML, count:1} );
          }
          
          // sort the results 
          lexicon.sort(function(a,b) {return b.count - a.count;});
          
          // format and save the results
          html += "<span class=\"lex-link\">" + classes[i] + "</span>";
          for (var j=0; j<lexicon.length; j++) {
            html += "<span class=\"lex-text\">" + lexicon[j].text + "</span><span class=\"lex-count\">" + lexicon[j].count + "</span>";
          }
          
        }
        
        LexiconResults.innerHTML = (html ? html:"<span style=\"display:none\"></span>"); // must not be left empty!
         
      }
    }
    
  };
    

  // This routine is only used by non-indexed search.
  this.searchNextBook = function() {
    if (!Search.progress) return; // quitProgress sets this to null
    
    var progress = Search.progress;
    var result = Search.result;
    var s = Search.s;

    var sScope = Book[progress.book[progress.index]].sName;
    result.count += Bible.search(s.mod, s.query, sScope, s.type, s.flags, s.isnew);
    s.isnew = false;
    
    progress.index++;
    progress.searchedchaps += Bible.getMaxChapter("KJV", sScope);
    
    document.getElementById("progress").value = 100*(progress.searchedchaps/progress.totalchaps);

    // get next book on list to search
    while(progress.index <= progress.books.length-1 && !progress.books[progress.index]) {
      progress.index++;
    }
    
    // search another book, or are we done?
    if (progress.index < progress.books.length) {
      document.getElementById("searchmsg").value = SBundle.getFormattedString("Searching", [Book[progress.book[progress.index]].bName]);
      progress.timeout = window.setTimeout("Search.searchNextBook();", 1);
      return;
    }
    
    this.quitProgress();
    
    this.updateStatusBar(result);
      
    this.showSearchResults(s.mod, result, s);
    
  };

}


function commandHandler(e) {
  if (!e.target.id) return;
  
  switch (e.target.id.split(".")[0]) {
  case "advancedmatch":
  case "hasthewords":
  case "matchsimilar":
  case "hasthistext":
  case "scopeRadio":
    Search.update();
    break;
        
  case "mod-radio":
    Search.searchModule = e.target.id.split(".")[1];
    if (Search.progress.timeout) Search.quitProgress(true);
    // IMPORTANT!: Or else user may unknowingly get a partial search without his choosing:
    document.getElementById("scopeRadio").selectedIndex = 0;
    
    Search.update();
    if (Tab[Search.searchModule].modType == BIBLE && getModuleLongType(mod) == BIBLE) {
      updateSearchBoxStyle(mod);
      SearchBoxElement.innerHTML = getHTMLSearchResults(StartVerse, VersesPerPage, TR);
    }
    break;    
    
  
    var svers = document.getElementById(myId).selectedItem;
    if (svers && svers.id) {
      svers = svers.id.split(".")[0];
      changeToModule(svers);
    }
    
      if (Searching) this.quitProgress(true);
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
    this.quitProgress(true);
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

  this.quitProgress = function(invalidateResults) {
    
    window.clearTimeout(this.progress.timeout);
    
    this.progress = null;
    
    // if we aborted, invalidate any partial results
    if (invalidateResults) {
      this.result = null;
      this.s = null;
    }
    
    document.getElementById("progressbox").style.visibility = "hidden";
    document.getElementById("searchmsg").value = "";
    document.getElementById("stopButton").hidden = true;
    document.getElementById("progress").value = 0;
  };

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
