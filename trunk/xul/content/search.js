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

const REGEX=0, PHRASE=-1, MULTIWORD=-2, ENTRY_ATTRIBUTE=-3, LUCENE=-4, COMPOUND=-5;  
const LocaleSearchSymbols = ["SINGLECharWildCard", "MULTICharWildCard", "AND", "OR", "NOT", "SIMILAR", "GROUPSTART", "GROUPEND", "QUOTESTART", "QUOTEEND"];
const ActualSearchSymbols = ["?", "*", "&&", "||", "!", "~", "(", ")", "\"", "\""];
const MaxResultsPerPage = 30;

var Search;
var SearchResults;
var LexiconResults;
var MatchingStrongs;
var AddedStrongsCSSRules;
var SearchHelpWindow;
var UI_bundle;

function initSearch() {
  
  initCSS();
  
  var searchInits = (MainWindow.GlobalTarget && MainWindow.GlobalTarget.search ? MainWindow.GlobalTarget.search:null);
  Search = new SearchObj(searchInits);
  SearchResults = document.getElementById("search-frame").contentDocument.getElementById("searchBox");
  LexiconResults = document.getElementById("search-frame").contentDocument.getElementById("lexiconBox");
  MatchingStrongs = getCSS(".matchingStrongs {"); // Read from CSS stylesheet
  AddedStrongsCSSRules = [];
  UI_bundle = document.getElementById("strings");
  
  Search.init();
  
}


function SearchObj(searchObj) {

  var search_defaults = { mod:prefs.getCharPref("DefaultVersion"), searchtext:"", type:"hasthewords", scope:"searchAll" };

  if (!searchObj) searchObj = search_defaults;

  this.s = {};
  
  // these parameters may be passed to a new Search window using searchObj
  this.s.mod        = (searchObj.hasOwnProperty("mod") ? searchObj.mod:search_defaults.mod);
  this.s.searchtext = (searchObj.hasOwnProperty("searchtext") ? searchObj.searchtext:search_defaults.searchtext);
  this.s.type       = (searchObj.hasOwnProperty("type") ? searchObj.type:search_defaults.type);
  this.s.scope      = (searchObj.hasOwnProperty("scope") ? searchObj.scope:search_defaults.scope);

  this.result = null;
  this.progress = null;
  this.originalTitle = document.title;
  
  
  // Initialize our search UI according to the object's initial "this" parameters,
  // available Tabs, etc. Initiates a search upon completion.
  this.init = function() {
  
    var s = this.s;
  
    // init Search textbox & window title
    document.getElementById("searchText").value = s.searchtext;
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", s.searchtext));
    
    // hide any scope labels which are not supplied by the UI and select the proper one
    var scopes = ["sg1","sg2","sg3","sg4","sg5","sg6"];
    for (var i=0; i<scopes.length; i++) {
      var elem = document.getElementById(scopes[i]);
      if (elem.label == "") {
        elem.hidden = true;
        if (scopes[i] == s.scope) s.scope = "searchAll";
      }
    }
    document.getElementById("scopeRadio").selectedItem = document.getElementById(s.scope);
    
    document.getElementById("searchType").selectedItem = document.getElementById(s.type);

    // add module radio buttons according to type
    var numcols = 1;
    for (var rowtype in SupportedModuleTypes) {
      for (var t=0; t<Tabs.length; t++) {
        if (getShortTypeFromLong(Tabs[t].modType) != rowtype) continue;
        
        var row = document.getElementById(rowtype + "-row");
        row.removeAttribute("hidden");
        
        var radio = document.createElement("radio");
        radio.setAttribute("class", "radio cs-" + Tabs[t].locName);
        radio.setAttribute("id", "mod-radio."+ Tabs[t].modName);
        radio.setAttribute("label", Tabs[t].label);
        
        // do we need to add another column now?
        if (row.childNodes.length + 1 > numcols) {
          document.getElementById("module-columns").appendChild(document.createElement("column"));
          numcols++;
        }
      
        row.appendChild(radio);
      }
    }
    
    // select our module to search in the radiogroup
    var item = document.getElementById("mod-radio." + s.mod);
    document.getElementById("search-module").selectedItem = item;
    document.getElementById("moddropdown").version = s.mod;
    
    window.setTimeout("Search.update();", 1); // needed so that "search-module" selectedItem is updated

    window.setTimeout("Search.search()", 100);
    
  };


  // Updates bits of the UI based on how other UI bits are set.
  this.update = function() {

    var mod = document.getElementById("search-module").selectedItem.id.match(/^mod-radio\.(.*)$/)[1];

    // disable scope dropdown menu unless "choose book" is selected
    if (document.getElementById("scopeRadio").selectedItem == document.getElementById("searchCB")) {
      document.getElementById("scopeMenu").disabled = false;
    }
    else {document.getElementById("scopeMenu").disabled = true;}
    
    // disable scope choices if module is not a versekey module
    var radioIDs = ["searchAll","searchOT","searchNT","searchSelect","sg1","sg2","sg3","sg4","sg5","sg6"];
    if (Tab[mod].modType != BIBLE && Tab[mod].modType != COMMENTARY ) {
      var radioDisabled = [false,true,true,true,true,true,true,true,true,true];
      document.getElementById("scopeRadio").selectedItem = document.getElementById("searchAll");
    }
    else radioDisabled = [false,false,false,false,false,false,false,false,false,false];
    for (var i=0; i<radioIDs.length; i++) {document.getElementById(radioIDs[i]).setAttribute("disabled", radioDisabled[i]);}

    // enable/disable Lucene related stuff
    document.getElementById("dividerBox").hidden = Bible.luceneEnabled(mod);
    document.getElementById("createSearchIndexBox").hidden = Bible.luceneEnabled(mod);

  };


  // Initiates a search using the UI's current settings.
  // It is possible to search using a Worker thread for progress feedback. But 
  // this requires reinitializing SWORD for each and every search. This becomes
  // unnecessary if we use timeouts for non-Lucene search progress, so this is
  // the chosen approach.
  this.search = function() {

    if ((/^\s*$/).test(document.getElementById("searchText").value)) return;

    var s = this.s;
    var result = this.result;
    
    if (this.progress && this.progress.timeout) this.quitProgress(true);
    this.progress = null;
    
    s = { mod:null, searchtext:null, query:null, scope:null, type:null, flags:null, isnew:null };
    result = { matchterms:null, count:null, index:null, results_per_page:null };
    
    s.isnew = true;
    s.mod = document.getElementById("search-module").selectedItem.id.match(/^mod-radio\.(.*)$/)[1];
    s.searchtext = document.getElementById("searchText").value;
    result.results_per_page = MaxResultsPerPage;
    result.index = 0;
        
    // change window title to new search
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", s.searchtext));
    
    // prepare search results window for new results
    SearchResults.innerHTML = "";
    //SearchResults.style.whiteSpace = (ModuleConfigs[s.mod].direction == "rtl" ? "normal":""); // FF bug workaround
    LexiconResults.innerHTML = "";
    
    document.getElementById("moddropdown").version = s.mod;
    
    // Remove any previously added Strong's lemma classes from CSS stylesheet 
    for (var i = (AddedStrongsCSSRules.length-1); i>=0; i--) {
      AddedStrongsCSSRules[i].sheet.deleteRule(AddedStrongsCSSRules[i].index);
    }
    
    // ask user if search index may be created now?
    if (!Bible.luceneEnabled(s.mod)) {
      try {
        var dontAsk = (prefs.getBoolPref("dontAskAboutSearchIndex." + s.mod) && 
            s.searchtext.search("lemma:") == -1);
      }
      catch (er) {dontAsk = false;}
      
      if (!dontAsk) {
        var myresult = {};
        var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, myresult, 
            fixWindowTitle(UI_bundle.getString("BuildingIndex")),
            UI_bundle.getString("NeedSearchIndex"), 
            DLGINFO,
            DLGOKCANCEL);
        prefs.setBoolPref("dontAskAboutSearchIndex." + s.mod, true);
        if (myresult.ok) startIndexer(true)
        return;
      }
    }
    
    // process our search text using Search settings to create an actual search term
    s.query = s.searchtext;
    s.query = s.query.replace(/^\s*/,"");       //remove leading whitespace
    s.query = s.query.replace(/\s*$/,"");       //remove trailing whitespace
    s.query = s.query.replace(/\s+/," ");       //change all white space to " "
    
    // replace UI search symbols with internally recognized search symbols
    for (var i=0; i<LocaleSearchSymbols.length; i++) {
      try {var sym = UI_bundle.GetStringFromName(LocaleSearchSymbols[i]);} catch (er) {continue;}
      if (!sym || (/^\s*$/).test(sym)) continue;
      s.query = s.query.replace(sym, ActualSearchSymbols[i], "g");
    }

    var rawText = s.query; // save query at this point for use later

    if (Bible.luceneEnabled(s.mod)) {
      s.type = LUCENE; //Lucene search
      
      // if Lucene special chars/operators are present then take string literally without any modification
      if (s.query.search(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/)!=-1) {
        document.getElementById("searchType").selectedIndex = USING_SEARCH_TERMS;
      }
      
      switch (document.getElementById("searchType").selectedIndex) {
      case CONTAINS_THE_WORDS:
        s.query = s.query.replace(" "," AND ","gim");
        break;
        
      case SIMILAR_WORDS:
        s.query = s.query.replace(/\s*$/, "~");
        s.query = s.query.replace(" ", "~ AND ","gim");
        break;
        
      case EXACT_TEXT:
        s.type = MULTIWORD; //MULTIWORD and REGEX ARE CASE SENSETIVE! COMPOUND DOES NOT WORK!!!!
        break;
        
      case USING_SEARCH_TERMS:
        break;
      }
    }
    // no Lucene
    else {s.type = REGEX;}
    
    // get Search scope
    s.scope = "Gen-Rev"; // default scope is all
    if (Tab[s.mod].modType == BIBLE || Tab[s.mod].modType == COMMENTARY) {
      
      if (document.getElementById("scopeRadio").selectedItem == document.getElementById("searchCB"))
          s.scope = document.getElementById("scopeMenu").selectedItem.value; // value comes from UI!
      else s.scope = document.getElementById("scopeRadio").selectedItem.value; // value comes from UI!
      
    }
    
    // to highlight results, build regular expressions for matching them
    switch (document.getElementById("searchType").selectedIndex) {
    case CONTAINS_THE_WORDS:
    case SIMILAR_WORDS:
      rawText = rawText.replace(/ +/g,";"); //change spaces into ";" for later splitting needed for hilighting matched words
      result.matchterms = this.getTermsArray(rawText);
      break;

    case EXACT_TEXT:
      result.matchterms = [{term:rawText, type:"string"}];
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
      
      result.matchterms = this.getTermsArray(rawText);
      break;
    }
    
    // get Search flags
    s.flags = 0;
    if (document.getElementById("searchType").selectedIndex != SIMILAR_WORDS) {
      s.flags = s.flags|2048; // Turn on Sort By Relevance flag
    } 
    s.flags = s.flags|2; //Turn "Ignore Case" flag on. BUG NOTE: THIS DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
    
    // There are two different methods of searching: 1) search piecemeal
    // book by book, using timeouts to update a progress bar and 
    // initiate search on another piece of the full search scope. 2) 
    // search the entire scope at once without any progress bar.
    if (s.type != LUCENE && 
        (Tab[s.mod].modType == BIBLE || 
        Tab[s.mod].modType == COMMENTARY)) {
          
      // search book by book...
      this.progress = { timeout:null, books:null, index:null, searchedchaps:null, totalchaps:null };
      
      // get array of books to search from scope param
      // example Scope=Gen Ps.0-Ps.150 Matt-Rev
      this.progress.books = [];
      var s = (s.scope + " ").split(/\s+/);
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
      this.progress.searchedchaps = 0;
      this.progress.totalchaps = 0;
      for (var x=0; x<this.progress.books.length; x++) {
        if (!this.progress.books[x]) continue;
        if (!this.progress.hasOwnProperty("index")) this.progress.index = x;
        this.progress.totalchaps += Bible.getMaxChapter("KJV", Book[x].sName);
      }
      document.getElementById("statusbar-text").label = "";    
      document.getElementById("progressbox").style.visibility = "visible";
      document.getElementById("searchmsg").value = UI_bundle.getFormattedString("Searching", [Book[this.progress.index].bName]);
      document.getElementById("stopButton").hidden = false;
      
      this.progress.timeout = window.setTimeout("Search.searchNextBook();" , 1);
      
    }
    else {
      
      // Search all in one go with no progress meter...
//var p=""; for (var m in s) {p += m + "=" + s[m] + " ";} jsdump(p);
      result.count = Bible.search(s.mod, s.query, s.scope, s.type, s.flags, s.isnew);

      this.updateStatusBar(result);
      
      this.showSearchResults(result, s);
    }
  };
  
  
  this.getTermsArray = function(terms) {
    var tr = [];
    terms = terms.split(";");
    for (var i=0; i<terms.length; i++) {
      if (terms[i]) {
        var aTerm = {term: null, type: null};
        aTerm.term = "(^|\\s|–|\\(|>)(" + terms[i] + ")(<|\\s|\\.|\\?|,|;|:|\"|!|\\)|$)"; //Begin and End cannot be \W because non-English letters ARE \W!
        aTerm.type = "RegExp";
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
      document.getElementById("statusbar-text").label = UI_bundle.getFormattedString("FoundMult", [dString(result.index + 1), dString(lastMatchShown), dString(result.count)]);
    }
    else document.getElementById("statusbar-text").label = UI_bundle.getFormattedString("Found", [dString(result.count)]);
    
  };


  // Display the current page of results for the previous search. NOTE:
  // the module (mod) is not always the same as that which generated
  // the search results, and verses will be mapped (KJV <> Synodal only)
  this.showSearchResults = function(result, s) {
    if (!result || !s) return;
    
    // only allow translation if both mod and s.mod are BIBLEs
    var mod = document.getElementById("moddropdown").version;
    if (mod != s.mod && (Tab[mod].modType != BIBLE || Tab[s.mod].modType != BIBLE)) {
      SearchResults.innerHTML = "";
      LexiconResults.innerHTML = "";
      return;
    }

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
        l.innerHTML = decodeURI(p.ch);
        l.className = "cs-" + mod;
        l.setAttribute("href", "javascript:MainWindow.showLocation('" + mod + "','na','" + p.ch + "',1,1);");
      }
      
      var reftext = r;
      r.insertBefore(l, r.firstChild);
      
      // apply hilights to search result matches
      var html = reftext.innerHTML;
      for (var m=0; m<result.matchterms.length; m++) {
        if (!result.matchterms[m]) continue;
        if (result.matchterms[m].type == "RegExp") {
          var regex = new RegExp(result.matchterms[m].term, "gim");
          html = html.replace(regex, "$1<span class=\"searchterm\">$2</span>$3");
        }
        else if (result.matchterms[m].type == "string") {
          html = html.replace(result.matchterms[m].term, "<span class=\"searchterm\">$&</span>", "gim");
        }
      }
      
      html = html.replace(/<br[^>]*>/g, "");
      
      reftext.innerHTML = html;
      
      r = r.nextSibling;
    }
    
    // If this is a Strong's search, hilight words with matching Strong's numbers.
    // Also, create and show the lexicon window for those Strong's numbers.
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
        
        LexiconResults.style.display = "none"; // might speed things up??
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
        LexiconResults.style.display = ""; // was "none" to improve speed
         
      }
      
      LexiconResults.parentNode.setAttribute("hasLexicon", "true");
    }
    else LexiconResults.parentNode.setAttribute("hasLexicon", "false");
    
  };
    

  // This routine is only used by non-indexed search.
  this.searchNextBook = function() {
    if (!Search.progress) return; // quitProgress sets this to null
    
    var progress = Search.progress;
    var result = Search.result;
    var s = Search.s;

    var sScope = Book[progress.book[progress.index]].sName;
//var p=""; for (var m in s) {p += m + "=" + s[m] + " ";} jsdump("scope=" + sScope + " " + p);
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
      document.getElementById("searchmsg").value = UI_bundle.getFormattedString("Searching", [Book[progress.book[progress.index]].bName]);
      progress.timeout = window.setTimeout("Search.searchNextBook();", 1);
      return;
    }
    
    // Were DONE, so close up and display results
    this.quitProgress();
    
    this.updateStatusBar(result);
      
    this.showSearchResults(result, s);
    
  };
  
  
  this.quitProgress = function(invalidateResults) {
    if (!this.progress) return;
    
    if (this.progress.timeout) window.clearTimeout(this.progress.timeout);
    
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
  
  this.onPrintPreviewDone = function() {
    this.focus();
  };

};


function commandHandler(e) {
  if (!e.target.id) return;
  
  switch (e.target.id.split(".")[0]) {
  case "advancedmatch":
  case "hasthewords":
  case "matchsimilar":
  case "hasthistext":
  case "scopeRadio":
  case "mod-radio":
    Search.update();
    break;

  case "more":
    document.getElementsByTagName("toolbar")[0].setAttribute("showAdvanced", "true");
    break;
    
  case "less":
    document.getElementsByTagName("toolbar")[0].setAttribute("showAdvanced", "false");
    break;
    
  case "first":
    Search.result.index = 0;
    Search.showSearchResults(Search.result, Search.s);
    break;
    
  case "prev":
    Search.result.index -= Search.result.results_per_page;
    if (Search.result.index < 0) {Search.result.index = 0;}
    Search.showSearchResults(Search.result, Search.s);
    break;
    
  case "last":
    Search.result.index = Search.result.count - Search.result.results_per_page;
    if (Search.result.index < 0) {Search.result.index = 0;}
    Search.showSearchResults(Search.result, Search.s);
    break;
  
  case "next":
    if (Search.result.index + Search.result.results_per_page < Search.result.count) {
      Search.result.index += Search.result.results_per_page;
      Search.showSearchResults(Search.result, Search.s);
    }
    break;
    
  case "searchButton":
    Search.search();
    break;
    
  case "stopButton":
    Search.quitProgress(true);
    break;
    
  case "createIndexButton":
    startIndexer(false)
    break;
    
  case "question":
  case "searchHelp":
    SearchHelpWindow = window.open("chrome://xulsword/content/searchHelp.xul","searchHelp","chrome,resizable");
    AllWindows.push(SearchHelpWindow);
    break;
  }
}


function onRefUserUpdate(e, location, version) {
  Search.showSearchResults(Search.result, Search.s);
}


function unloadSearchWindow() {

  // need to clean up indexer if it was in process
  if (MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.terminate(); // doesn't actually terminate anything
    MainWindow.Indexer.exitfunc = null;
  }
  
  try {SearchHelpWindow.close();} catch(er) {}
}


function handlePrintCommand(command) {

  var result = copyObj(Search.result);
  
  result.index = 0;
  result.results_per_page = 100; // get max of 100 results
  Search.showSearchResults(result, Search.s);
  var bodyhtml = SearchResults.parentNode.innerHTML;
  
  Search.showSearchResults(Search.result, Search.s); // return to original
    
  var target = {
    command:command,
    uri:"chrome://xulsword/content/search.html", 
    bodyHTML:bodyhtml,
    callback:Search
  };
  
  MainWindow.handlePrintCommand(command, target);
}


/************************************************************************
 * Indexer
 ***********************************************************************/

var SearchAfterCreate;
function startIndexer(searchAfterCreate) {
  SearchAfterCreate = searchAfterCreate;
  document.getElementById("progressbox").style.visibility = "visible";
  document.getElementById("progress").value = 0;
  document.getElementById("searchmsg").value = UI_bundle.getString("BuildingIndex");
  document.getElementById("stopButton").hidden = true;
  
  if (!MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.progressMeter = document.getElementById("progress");
    MainWindow.Indexer.exitfunc = indexerFinished;
    Bible.allWindowsModal(true); // prevent triggering of Bible ops
    window.setTimeout("MainWindow.Indexer.create();", 500); // allow pending Bible ops before starting indexer
  }
  
}


function indexerFinished() {
  document.getElementById("progressbox").style.visibility = "hidden";
  document.getElementById("progress").value = 0;
  document.getElementById("searchmsg").value = "";
  document.getElementById("stopButton").hidden = true;
  
  if (SearchAfterCreate) Search.search();
}

