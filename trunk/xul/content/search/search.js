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

// LIBXULSWORD API's search types. Warning: only REGEX and LUCENE are used or are debugged...
const REGEX=0, PHRASE=-1, MULTIWORD=-2, ENTRY_ATTRIBUTE=-3, LUCENE=-4, COMPOUND=-5; 
const LOCALE_SEARCH_SYMBOLS = ["SINGLECharWildCard", "MULTICharWildCard", "AND", "OR", "NOT", "SIMILAR", "GROUPSTART", "GROUPEND", "QUOTESTART", "QUOTEEND"];
const ACTUAL_SEARCH_SYMBOLS = ["?", "*", "&&", "||", "!", "~", "(", ")", "\"", "\""];
const MAX_RESULTS_PER_PAGE = 30;
const MAX_LEXICON_SEARCH_RESULTS = 500;
const MAX_PRINT_SEARCH_RESULTS = 30;

var Search;
var SearchResults;
var LexiconResults;
var MatchingStrongs;
var AddedStrongsCSSRules;
var SearchHelpWindow;

function initSearch() {
  
  initCSS();
  
  SearchResults = document.getElementById("search-frame").contentDocument.getElementById("searchBox");
  LexiconResults = document.getElementById("search-frame").contentDocument.getElementById("lexiconBox");
  MatchingStrongs = document.getElementById("search-frame").contentDocument.defaultView.getCSS(".matchingStrongs {"); // Read from CSS stylesheet
  AddedStrongsCSSRules = [];
  
  // add module radio buttons in rows according to type
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
  
  // get our Search object
  var searchInits = (CommandTarget && CommandTarget.search ? CommandTarget.search:null);
  Search = new SearchObj(searchInits);
  
  // open in advanced mode if searching non-BIBLE so that its radio button will show up
  if (Tab[Search.init.mod].modType != BIBLE)
    document.getElementsByTagName("toolbar")[0].setAttribute("showAdvanced", "true");
  
  // timeout needed to allow DOM changes to take full effect before continuing
  window.setTimeout("initSearch2();", 1); 

}

// Initialize our search UI according to the Search object's initial parameters.
// Initiates a search upon completion.
function initSearch2() {

  var init = Search.init;
//var p=""; for (var m in init) {p += m + "=" + init[m] + " ";} jsdump(p);
  // init Search textbox & window title
  document.getElementById("searchText").value = init.searchtext;
  document.title = fixWindowTitle(Search.originalTitle.replace("**search_title**", init.searchtext));
  
  // hide any scope labels which are not supplied by the UI and select the proper scope
  var scopes = ["sg1","sg2","sg3","sg4","sg5","sg6"];
  for (var i=0; i<scopes.length; i++) {
    var elem = document.getElementById(scopes[i]);
    if (elem.label == "") {
      elem.hidden = true;
      if (scopes[i] == init.scope) init.scope = "SearchAll";
    }
  }
  document.getElementById("scopeRadio").selectedItem = document.getElementById(init.scope);

  document.getElementById("searchType").selectedItem = document.getElementById(init.type);

  // select our module to search in the radiogroup
  var item = document.getElementById("mod-radio." + init.mod);
  document.getElementById("search-module").selectedItem = item;
  document.getElementById("bible-translator").version = init.mod;
  
  window.setTimeout("Search.update();", 1); // needed so that "search-module" selectedItem is finished internally updating

  window.setTimeout("Search.search()", 100);
  
}


function SearchObj(searchObj) {

  // def stores Search.init defaults
  var def = { mod:prefs.getCharPref("DefaultVersion"), searchtext:"", type:"SearchAnyWord", scope:"SearchAll" };

  if (!searchObj) searchObj = def;
  
  // These parameters may be passed to a new Search window using searchObj.
  // The type and scope params are search.xul IDs of the desired selections.
  this.init = {};
  this.init.mod        = (searchObj.hasOwnProperty("mod")        && searchObj["mod"]        ? searchObj.mod:       def.mod);
  this.init.searchtext = (searchObj.hasOwnProperty("searchtext") && searchObj["searchtext"] ? searchObj.searchtext:def.searchtext);
  this.init.type       = (searchObj.hasOwnProperty("type")       && searchObj["type"]       ? searchObj.type:      def.type);
  this.init.scope      = (searchObj.hasOwnProperty("scope")      && searchObj["scope"]      ? searchObj.scope:     def.scope);

  this.s = {}; // holds search related parameters
  this.result = {}; // holds result related parameters
  this.progress = null; // holds progress related params if progress bar is used
  this.originalTitle = document.title;

  this.bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://xulsword/locale/search/search.properties"),
      
  // Updates bits of the UI based on how other UI bits are set.
  this.update = function() {

    var mod = document.getElementById("search-module").selectedItem.id.match(/^mod-radio\.(.*)$/)[1];

    // disable scope choices if module is not a versekey module
    var radioIDs = ["SearchAll","SearchOT","SearchNT","SearchBook","SearchGroup"];
    if (Tab[mod].modType != BIBLE && Tab[mod].modType != COMMENTARY ) {
      var radioDisabled = [false,true,true,true,true];
      document.getElementById("scopeRadio").selectedItem = document.getElementById("SearchAll");
    }
    else radioDisabled = [false,false,false,false,false];
    for (var i=0; i<radioIDs.length; i++) {document.getElementById(radioIDs[i]).setAttribute("disabled", radioDisabled[i]);}

    // disable scope dropdown menu unless "choose book" is selected
    if (document.getElementById("scopeRadio").selectedItem == document.getElementById("SearchGroup")) {
      document.getElementById("scopeMenu").disabled = false;
    }
    else {document.getElementById("scopeMenu").disabled = true;}
    
    // enable/disable Lucene related stuff
    document.getElementById("dividerBox").hidden = LibSword.luceneEnabled(mod);
    document.getElementById("createSearchIndexBox").hidden = LibSword.luceneEnabled(mod);

  };


  // Initiates a search using the UI's current settings.
  // It is possible to search using a Worker thread for progress feedback. But 
  // this requires reinitializing SWORD before and after each and every search. 
  // This becomes unnecessary if we use timeouts for reporting search progress, 
  // so this is the chosen approach.
  this.search = function() {

    // don't do anything at all of search text-box is empty
    if ((/^\s*$/).test(document.getElementById("searchText").value)) return;

    if (this.progress && this.progress.timeout) this.quitProgress(true);
    this.progress = null;
    
    // clean up after any previous search
    if (this.result && this.result.hasOwnProperty("searchPointer")) {
			LibSword.freeSearchPointer(this.result.searchPointer);
			this.result.searchPointer = null;
		}
    
    // now initialize a new search from scratch...
    this.s = {};
    this.result = {};
    
    var s = this.s; // saves me some typing
    var result = this.result;
    
    s.mod = document.getElementById("search-module").selectedItem.id.match(/^mod-radio\.(.*)$/)[1];
    s.searchtext = document.getElementById("searchText").value;
    s.query = null;
    s.scope = null;
    s.type = null;
    s.flags = null;
    s.isnew = true;
    
    result.searchPointer = null;
    result.matchterms = null;
    result.count = 0;
    result.index = 0; 
    result.results_per_page = MAX_RESULTS_PER_PAGE;
    result.translate = s.mod;
        
    // change window title to new search
    document.title = fixWindowTitle(this.originalTitle.replace("**search_title**", s.searchtext));
    
    // prepare search results window for new results
    SearchResults.innerHTML = "";
    //SearchResults.style.whiteSpace = (ModuleConfigs[s.mod].direction == "rtl" ? "normal":""); // FF bug workaround
    LexiconResults.innerHTML = "";
    
    document.getElementById("bible-translator").version = s.mod;
    
    // Remove any previously added Strong's lemma classes from CSS stylesheet 
    for (var i = (AddedStrongsCSSRules.length-1); i>=0; i--) {
      AddedStrongsCSSRules[i].sheet.deleteRule(AddedStrongsCSSRules[i].index);
    }
    AddedStrongsCSSRules = [];
    
    // If there is no search index for mod, ask user 
    // if search index may be created now?
    if (!LibSword.luceneEnabled(s.mod)) {
      try {
        var dontAsk = (prefs.getBoolPref("dontAskAboutSearchIndex." + s.mod) && 
            s.searchtext.search("lemma:") == -1);
      }
      catch (er) {dontAsk = false;}
      
      if (!dontAsk) {
        var myresult = {};
        var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, myresult, 
            fixWindowTitle(getDataUI("BuildingIndex")),
            getDataUI("NeedSearchIndex"), 
            DLGINFO,
            DLGOKCANCEL);
        prefs.setBoolPref("dontAskAboutSearchIndex." + s.mod, true);
        this.searchOnIndexerDone = true;
        if (myresult.ok) startIndexer();
        return;
      }
    }
    
    // process our search text using Search settings to create an actual search term
    s.query = s.searchtext;
    s.query = s.query.replace(/^\s*/,""); //remove leading whitespace
    s.query = s.query.replace(/\s*$/,""); //remove trailing whitespace
    s.query = s.query.replace(/\s+/," "); //change all white space to " "
    
    // replace UI search symbols with internally recognized search symbols
    for (var i=0; i<LOCALE_SEARCH_SYMBOLS.length; i++) {
      try {var sym = this.bundle.GetStringFromName(LOCALE_SEARCH_SYMBOLS[i]);} catch (er) {continue;}
      if (!sym || (/^\s*$/).test(sym)) continue;
      s.query = s.query.replace(sym, ACTUAL_SEARCH_SYMBOLS[i], "g");
    }

    var rawText = s.query; // save query at this point for use later

    if (LibSword.luceneEnabled(s.mod)) {
      s.type = LUCENE; //Lucene search
      
      // if Lucene special chars/operators are present then take string literally without any modification
      if (s.query.search(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/)!=-1) {
        document.getElementById("searchType").selectedItem = document.getElementById("SearchAdvanced");
      }
      
      switch (document.getElementById("searchType").selectedItem.id) {
      case "SearchAnyWord":
        s.query = s.query.replace(" "," AND ","gim");
        break;
        
      case "SearchSimilar":
        s.query = s.query.replace(/\s*$/, "~");
        s.query = s.query.replace(" ", "~ AND ","gim");
        break;
        
      case "SearchExactText":
        s.type = REGEX; //MULTIWORD and REGEX ARE CASE SENSETIVE!
        break;
        
      case "SearchAdvanced":
        // already Lucene
        break;
      }
    }
    // no Lucene
    else {
      s.type = REGEX;
      document.getElementById("searchType").selectedItem = document.getElementById("SearchExactText");
    }
    
    // get Search scope
    // scope radio buttons are meaningful only for versekey modules...
    if (Tab[s.mod].modType == BIBLE || Tab[s.mod].modType == COMMENTARY) {
      
      var scopeRadio = document.getElementById("scopeRadio");
  
      if (scopeRadio.selectedItem == document.getElementById("SearchGroup")) {
        s.scope = document.getElementById("scopeMenu").selectedItem.value; // value comes from UI!
      }
      else s.scope = scopeRadio.selectedItem.value; // value comes from UI!
      
      if (scopeRadio.selectedItem == document.getElementById("SearchBook")) {
        s.scope = Location.getBookName(s.mod);
      }
      
    }
    else s.scope = ""; // scope is only used by LibSword for versekey modules
    
    // to highlight results, build regular expressions for matching them
    switch (document.getElementById("searchType").selectedItem.id) {
    case "SearchAnyWord":
    case "SearchSimilar":
      rawText = rawText.replace(/ +/g,";"); // change spaces into ";" for later splitting
      result.matchterms = this.getTermsArray(rawText);
      break;

    case "SearchExactText":
      result.matchterms = [{term:rawText, type:"string"}];
      break;
      
    case "SearchAdvanced":
      rawText = rawText.replace(/ +/g,";");
      rawText = rawText.replace(/(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|~|:|\\|AND;|OR;|NOT;)/g,""); // remove all control chars except [?";*]
      rawText = rawText.replace("?",".","g");     // add dots before any ?s
      rawText = rawText.replace("*",".*?","g");   // add dots before any *s
      
      //change ";"s which are between quotes back into spaces, and remove the quotes
      var quoted = false; 
      var tmp = "";
      for (var x=0; x<rawText.length; x++) {
        var mychr = rawText.charAt(x);
        if (mychr == "\"") {quoted = !quoted; continue;}
        // the \\s+ allows for more than one space between words in the striped text (common thing)
        if (quoted && (mychr == ";")) {tmp += "\\s+";} 
        else {tmp = tmp + mychr;}
      }
      rawText = tmp;
      
      result.matchterms = this.getTermsArray(rawText);
      break;
      
    }
    
    // get Search flags
    s.flags = 2; //Turn "Ignore Case" flag on. BUG NOTE: THIS DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
    if (document.getElementById("searchType").selectedItem == document.getElementById("SearchSimilar") ||
        (/\~/).test(s.query)) {
      s.flags = s.flags|2048; // Turn on Sort By Relevance flag
    } 
    
    // There are two different methods of searching: 1) search piecemeal
    // book by book, using timeouts to update a progress bar and then
    // initiating a search on the next book of the full search scope. 
    // 2) search the entire scope at once without showing any progress bar.
    if (s.type != LUCENE && 
        (Tab[s.mod].modType == BIBLE || 
        Tab[s.mod].modType == COMMENTARY)) {
          
      // search book by book...
      this.progress = { timeout:null, book:[], index:null, searchedchaps:0, totalchaps:0 };
      
      // get array of books to search from scope param
      // example Scope=Gen Ps.0-Ps.150 Matt-Rev
      // NOTE: scope params must be in KJV book order!
      var b = 0;
      if (!s.scope) s.scope = "Gen-Rev"; // empty string should mean search all!
      var sc = s.scope.split(/\s+/);
      for (var x=0; x<sc.length; x++) {
        var bk = sc[x].split("-");
        var beg = findBookNum(bk[0].replace(/\..*$/, ""));
        var end = (bk.length == 2 ? findBookNum(bk[1].replace(/\..*$/, "")):beg);
        for (i=beg; i<=end; i++) {this.progress.book[i] = true;}
      }

      // show and init progress bar
      for (var x=0; x<this.progress.book.length; x++) {
        if (!this.progress.book[x]) continue;
        if (this.progress.index === null) this.progress.index = x;
        this.progress.totalchaps += LibSword.getMaxChapter("KJV", Book[x].sName);
      }
      document.getElementById("statusbar-text").label = "";    
      document.getElementById("progressbox").style.visibility = "visible";
      document.getElementById("searchmsg").value = this.bundle.formatStringFromName("Searching", [Book[this.progress.index].bName], 1);
      document.getElementById("stopButton").hidden = false;
      
      this.progress.timeout = window.setTimeout("Search.searchNextBook();" , 500); // 500 gives progressbar time to appear
      
    }
    else {
      
      // Search all in one go with no progress meter...
      
//var p="Single Search: "; for (var m in s) {p += m + "=" + s[m] + " ";} jsdump(p);
      result.count = LibSword.search(s.mod, s.query, s.scope, s.type, s.flags, s.isnew);
      result.searchPointer = LibSword.getSearchPointer();

      this.updateStatusBar(result);
      
      this.showSearchResults(result, s);
    }
  };
  

  // This routine is only used by non-indexed search.
  this.searchNextBook = function() {
    if (!Search.progress) return; // quitProgress sets this to null
    
    var progress = Search.progress;
    var result = Search.result;
    var s = Search.s;

    // Search a single book. NOTE: when isnew==true, the count returned
    // by LibSword is the total count, not the count for a particular call.
    
//var p="Multiple Search: "; for (var m in s) {p += m + "=" + s[m] + " ";} jsdump(p + "scope=" + Book[progress.index].sName);
    result.count = LibSword.search(s.mod, s.query, Book[progress.index].sName, s.type, s.flags, s.isnew);
    s.isnew = false; // causes subsequent search results to be appended to result buffer rather than overwriting it
    
    progress.searchedchaps += LibSword.getMaxChapter("KJV", Book[progress.index].sName);
    
    progress.index++;
    
    document.getElementById("progress").value = 100*(progress.searchedchaps/progress.totalchaps);

    // get next book on list to search
    while(progress.index <= progress.book.length-1 && !progress.book[progress.index]) {
      progress.index++;
    }
    
    // search another book, or are we done?
    if (progress.index < progress.book.length) {
      document.getElementById("searchmsg").value = this.bundle.formatStringFromName("Searching", [Book[progress.index].bName], 1);
      progress.timeout = window.setTimeout("Search.searchNextBook();", 1);
      return;
    }
    
    // Were DONE, so close up shop and display results
    result.searchPointer = LibSword.getSearchPointer(); // now copy all search results
    
    this.quitProgress();
    
    this.updateStatusBar(result);
      
    this.showSearchResults(result, s);
    
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
    
    // display info about results which are currently being shown
    var lastMatchShown = (result.count - result.index < result.results_per_page ? result.count:result.index + result.results_per_page);
    if (result.count > result.results_per_page) {
      document.getElementById("statusbar-text").label = this.bundle.formatStringFromName("FoundMult", [dString(result.index + 1), dString(lastMatchShown), dString(result.count)], 3);
    }
    else document.getElementById("statusbar-text").label = this.bundle.formatStringFromName("Found", [dString(result.count)], 1);
    
  };


  // Display the current page of results for the previous search. NOTE:
  // the module (mod) is not always the same as that which generated
  // the search results, and verses will be mapped (KJV <> Synodal only right now)
  this.showSearchResults = function(result, s) {
    if (!result || !s) return;
    
    var keepStrongs = false;
    
    // only allow translation if both result.translate and s.mod are BIBLEs
    var mod = s.mod;
    if (result.translate != s.mod && Tab[result.translate].modType == BIBLE && Tab[s.mod].modType == BIBLE) {
      mod = result.translate;
    }
    else {
      keepStrongs = LibSword.getModuleInformation(mod, "Feature");
      keepStrongs = (/StrongsNumbers/).test(keepStrongs);
      result.translate = mod;
    }

    // read search results to display
    var r = LibSword.getSearchResults(mod, result.index, result.results_per_page, keepStrongs, result.searchPointer);
    if (!r) {
			SearchResults.innerHTML = "";
			LexiconResults.innerHTML = "";
			return;
		}
    
    // workaround for a FF 17 bug where innerHTML could not be added to
    // an anchor which was created using createElement...
    r = r.replace(/<span /g, "<a></a><span ");
    
    SearchResults.innerHTML = r;
    
    r = SearchResults.firstChild;
    while(r) {
      var p = getElementInfo(r);
      
      // add a reference link to each result
      var l = r.firstChild;
      switch(Tab[p.mod].modType) {
        
      case BIBLE:
      case COMMENTARY:
        // translate from s.mod to mod...
        var loc = LibSword.convertLocation(LibSword.getVerseSystem(s.mod), p.osisref, LibSword.getVerseSystem(mod));
        l.innerHTML = ref2ProgramLocaleText(loc);
        l.className = "cs-Program";
        loc = loc.split(".");
        l.setAttribute("href", "javascript:MainWindow.showLocation('" + mod + "','" + loc[0] + "','" + loc[1] + "','" + loc[2] + "','" + loc[3] + "');");
        break;
        
      case GENBOOK:
      case DICTIONARY:
        l.innerHTML = p.ch;
        l.className = "cs-" + p.mod;
        l.setAttribute("href", "javascript:MainWindow.showLocation('" + p.mod + "','na','" +  p.ch + "',1,1);");
        break;
        
      }
      
      // apply hilight class to search result matches
      var html = r.lastChild.innerHTML;
      for (var m=0; m<result.matchterms.length; m++) {
        if (result.matchterms[m].type == "RegExp") {
          var re = new RegExp(result.matchterms[m].term, "gim");
          var t = html.split(/(<[^>]*>)/);
          for (var x=0; x<t.length; x++) {
						if ((/^<[^>]*>$/).test(t[x])) continue;
						t[x] = t[x].replace(re, "$1<span class=\"searchterm\">$2</span>$3");
					}
					html = t.join("");
        }
        else if (result.matchterms[m].type == "string") {
          var re = new RegExp (escapeRE(result.matchterms[m].term), "gim");
          var t = html.split(/(<[^>]*>)/);
          for (var x=0; x<t.length; x++) {
						if ((/^<[^>]*>$/).test(t[x])) continue;
						t[x] = t[x].replace(re, "<span class=\"searchterm\">$&</span>");
					}
					html = t.join("");
        }
      }
      html = html.replace(/<br[^>]*>/g, ""); // since <br> looks bad in display
      r.lastChild.innerHTML = html;
      
      r = r.nextSibling;
    }

    // If this is a Strong's search, hilight words with matching Strong's numbers.
    // Also, create and show the lexicon window for those Strong's numbers.
    if (keepStrongs && (/lemma\:/).test(s.query)) {
      
      var classes = s.query.match(/lemma\:\s*\S+/g);
      
      for (var i=0; i<classes.length; i++) {
        
        classes[i] = "S_" + classes[i].replace(/lemma\:\s*/, "");
        
        var sheet = document.getElementById("search-frame").contentDocument.styleSheets[document.styleSheets.length-1];
        var index = sheet.cssRules.length;
        sheet.insertRule(MatchingStrongs.rule.cssText.replace("matchingStrongs", classes[i]), index);
        AddedStrongsCSSRules.push( { sheet:sheet, index:index } );
        
      }
      
      // This is a very processing intensive step, so do it only once
      // for a given set of search results.
      if (!LexiconResults.innerHTML) {
        
        LexiconResults.style.display = "none"; // might this speed things up??
        LexiconResults.innerHTML = LibSword.getSearchResults(mod, 0, MAX_LEXICON_SEARCH_RESULTS, true, result.searchPointer);
        
        var html = "";
        for (var i=0; i<classes.length; i++) {
          
          var lexicon = [];
          
          // iterate through each and every element having this Strong's number
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
          var dictinfo = DictTexts.getStrongsModAndKey(classes[i]);
          html += "<span class=\"slist cs-" + DEFAULTLOCALE + "\" title=\"" + encodeURIComponent(dictinfo.key) + "." + dictinfo.mod + "\">";
          
          var strongNum = classes[i].replace("S_", "");
          html +=   "<a " + (dictinfo.mod && dictinfo.key ? "class=\"sn " + classes[i] + "\" ":"");
          html +=       "onclick=\"MainWindow.XulswordController.doCommand('cmd_xs_searchForLemma', ";
          html +=       "{search:{searchtext:'lemma:" + strongNum + "', mod:'" + mod + "'}});\">";
          html +=     strongNum;
          html +=   "</a>";
          
          html +=   "<span class=\"lex-total\">" + dString(1) + "-" + dString(result.count > MAX_LEXICON_SEARCH_RESULTS ? MAX_LEXICON_SEARCH_RESULTS:result.count) + "</span>";
          html +=   "<span class=\"cs-" + DEFAULTLOCALE + "\">";
          for (var j=0; j<lexicon.length; j++) {
            html +=   "<span class=\"lex-text\">" + lexicon[j].text + "</span>";
            html +=   "<span class=\"lex-count\">" + lexicon[j].count + "</span>";
          }
          html +=   "</span>";
          html += "</span>";
          html += "<div class=\"lex-sep\"></div>";
          
        }
        
        LexiconResults.innerHTML = (html ? html:"<span style=\"display:none\"></span>"); // should not be left empty
        LexiconResults.style.display = ""; // was set to "none" to improve (??) speed
         
      }
      
      LexiconResults.parentNode.setAttribute("hasLexicon", "true");
    }
    
    // If this search contains Strongs info, collect all Strong's numbers attached to our results
    else if (keepStrongs) {
      LexiconResults.style.display = "none"; // might this speed things up??
      var lexiconResults = LibSword.getSearchResults(mod, 0, MAX_LEXICON_SEARCH_RESULTS, true, result.searchPointer);
      
      // apply hilight class to search result matches
      for (var m=0; m<result.matchterms.length; m++) {
        if (result.matchterms[m].type == "RegExp") {
          var re = new RegExp(result.matchterms[m].term, "gim");
          lexiconResults = lexiconResults.replace(re, "$1<span class=\"searchterm\">$2</span>$3");
        }
        else if (result.matchterms[m].type == "string") {
          var re = new RegExp (escapeRE(result.matchterms[m].term), "gim")
          lexiconResults = lexiconResults.replace(re, "<span class=\"searchterm\">$&</span>");
        }
      }
      LexiconResults.innerHTML = lexiconResults;
    
      var matches = LexiconResults.getElementsByClassName("searchterm");

      // Collect all Strongs numbers associated with the matches
      var strongsList = { "H":[], "G":[] };
      for (var i=0; i<matches.length; i++) {
        var p = matches[i].parentNode;
        if (!p) continue;

        var sclass = p.className.match(/(^|\s)S_(G|H)(\d+)(\s|$)/g);
        if (!sclass || !sclass.length) continue;
        
        for (var si=0; si<sclass.length; si++) {
          var inf = sclass[si].match(/(^|\s)(S_(G|H)\d+)(\s|$)/);
          var mtype = inf[3];
          var mclass = inf[2];
          
          // See if we've gotten this strongs number already and if so, 
          // increment its count. Otherwise add a new strongsList object.
          for (var j=0; j<strongsList[mtype].length; j++) {
            if (mclass == strongsList[mtype][j].strongs) {
              strongsList[mtype][j].count++;
              break;
            }
          }
          if (j == strongsList[mtype].length) strongsList[mtype].push( { strongs:mclass, count:1 } );

        }
      }
      
      // format and write the results in the Lexicon section
      var html = "";
      for (var type in strongsList) {
        
        // sort the results 
        strongsList[type].sort(function(a,b) {return b.count - a.count;});
        
        if (!strongsList[type].length) continue;
        
        html += "<span class=\"snlist\" contextModule=\"" + mod + "\">";
        
        var mtype = "";
        if (type == "H") mtype = XSBundle.getString("ORIGLabelOT");
        if (type == "G") mtype = XSBundle.getString("ORIGLabelNT");
        html += "<span class=\"strongs-type\">" + mtype + "</span>";
        html +=   "<span class=\"lex-total\">" + dString(1) + "-" + dString(result.count > MAX_LEXICON_SEARCH_RESULTS ? MAX_LEXICON_SEARCH_RESULTS:result.count) + "</span>";

        html +=   "<span class=\"cs-" + DEFAULTLOCALE + "\">";
        for (var j=0; j<strongsList[type].length; j++) {
					var strongNum = strongsList[type][j].strongs.replace("S_", "");
          var sti = DictTexts.getStrongsModAndKey(strongsList[type][j].strongs);

          html +=   "<a " + (sti.mod && sti.key ? "class=\"sn " + strongsList[type][j].strongs + "\" ":"");
          html +=       "onclick=\"MainWindow.XulswordController.doCommand('cmd_xs_searchForLemma', ";
          html +=       "{search:{searchtext:'lemma:" + strongNum + "', mod:'" + mod + "'}});\">";
          html +=     "<span class=\"lex-text\">" + strongNum + "</span>";
          html +=   "</a>";

          html +=   "<span class=\"lex-count\">" + strongsList[type][j].count + "</span>";
        }
        html +=   "</span>";
        
        html += "</span>";
      }
      
      html += "<div class=\"lex-sep\"></div>";
    
      LexiconResults.innerHTML = (html ? html:"<span style=\"display:none\"></span>"); // should not be left empty
      LexiconResults.style.display = ""; // was set to "none" to improve (??) speed
      
      LexiconResults.parentNode.setAttribute("hasLexicon", "true");
    }
    else LexiconResults.parentNode.setAttribute("hasLexicon", "false");
    
    this.updateStatusBar(result);
    
    // enable translator module dropdown only if searched module is a BIBLE
    document.getElementById("bible-translator").setAttribute("disabled", (Tab[mod].modType == BIBLE ? "false":"true"));

//jsdump(LexiconResults.innerHTML); 
//jsdump(SearchResults.innerHTML);      
  };
    
  
  // stops progress-type search and hides the progress bar
  this.quitProgress = function(invalidateResults) {
    if (!this.progress) return;
    
    if (this.progress.timeout) window.clearTimeout(this.progress.timeout);
    
    this.progress = null;
    
    // if we aborted, invalidate any partial results
    if (invalidateResults) {
      this.result = {};
      this.s = {};
    }
    
    document.getElementById("progressbox").style.visibility = "hidden";
    document.getElementById("searchmsg").value = "";
    document.getElementById("stopButton").hidden = true;
    document.getElementById("progress").value = 0;
  };
  
  this.onPrintPreviewDone = function() {
    window.focus();
  };

  this.searchOnIndexerDone = null,
  this.onIndexerDone = function() {
    document.getElementById("progressbox").style.visibility = "hidden";
    document.getElementById("progress").value = 0;
    document.getElementById("searchmsg").value = "";
    document.getElementById("stopButton").hidden = true;
    
    this.update();
    
    if (this.searchOnIndexerDone) {
      document.getElementById("searchType").selectedItem = document.getElementById("SearchAdvanced");
      this.search();
    }
  }

};
// END SearchObj


function commandHandler(e) {
  if (!e.target.id) return;
  
  switch (e.target.id.split(".")[0]) {
  case "SearchAdvanced":
  case "SearchAnyWord":
  case "SearchSimilar":
  case "SearchExactText":
  case "SearchAll":
  case "SearchOT":
  case "SearchNT":
  case "SearchBook":
  case "SearchGroup":
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
    Search.searchOnIndexerDone = true;
    startIndexer();
    break;
    
  case "helpButton":
  case "searchHelp":
    SearchHelpWindow = window.open("chrome://xulsword/content/search/searchHelp.xul", "searchHelp", "chrome,resizable");
    AllWindows.push(SearchHelpWindow);
    break;
  }
  
}


// called by "bible-translator" onupdate: 
// allows translation of BIBLE search results
function onRefUserUpdate(e, location, version) {
  Search.result.translate = version;
  Search.showSearchResults(Search.result, Search.s);
}


function unloadSearchWindow() {

	// free any search results
	if (Search && Search.result && Search.result.hasOwnProperty("searchPointer")) {
		LibSword.freeSearchPointer(Search.result.searchPointer);
		Search.result.searchPointer = null;
	}
		
  // need to clean up indexer if it was in process
  if (MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.terminate(); // doesn't actually terminate anything
    MainWindow.Indexer.progressMeter = null;
    MainWindow.Indexer.callback = null;
  }
  
  try {SearchHelpWindow.close();} catch(er) {}
}


function handlePrintCommand(command) {
  if (!Search || !Search.result || !Search.result.count) return;

  var result_per_page = Search.result.results_per_page; // save original result_per_page
  Search.result.results_per_page = MAX_PRINT_SEARCH_RESULTS;
  Search.showSearchResults(Search.result, Search.s);
  var bodyHTML = document.getElementById("search-frame").contentDocument.getElementsByTagName("body")[0].innerHTML;
  Search.result.results_per_page = result_per_page; // return to original
  Search.showSearchResults(Search.result, Search.s); // redraw results
    
  var target = {
    command:command,
    uri:"chrome://xulsword/content/search/search.html", 
    bodyHTML:bodyHTML,
    callback:Search
  };
  

  MainWindow.handlePrintCommand(command, target);
}


/************************************************************************
 * Indexer
 ***********************************************************************/

function startIndexer() {

  // use progress bar to show indexer progress
  document.getElementById("progressbox").style.visibility = "visible";
  document.getElementById("progress").value = 0;
  document.getElementById("searchmsg").value = getDataUI("BuildingIndex");
  document.getElementById("stopButton").hidden = true;
  
  if (!MainWindow.Indexer.inprogress) {
    MainWindow.Indexer.moduleName = document.getElementById("search-module").selectedItem.id.match(/^mod-radio\.(.*)$/)[1];
    MainWindow.Indexer.progressMeter = document.getElementById("progress");
    MainWindow.Indexer.callback = Search;
    MainWindow.Indexer.create();
  }
  
}

