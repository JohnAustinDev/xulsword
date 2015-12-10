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

var SearchBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://xulsword/locale/search/search.properties");

function onLoad() {
  initCSS();
  window.frameElement.ownerDocument.defaultView.innerHeight = document.getElementById("helpPane").scrollHeight + 20;
  document.getElementsByTagName("body")[0].style.overflow = "auto"; // only allow scroll bar after proper sizing
}

function writeSearchHelp(elem) {
  var rows = [null, "MULTICharWildCard", "SINGLECharWildCard", "AND", "OR", "NOT", "GROUPSTART", "SIMILAR", "QUOTESTART"];
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  var bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/search/search-help.properties");
  
  window.frameElement.ownerDocument.title = fixWindowTitle(bundle.GetStringFromName("windowTitle"));
  
  var searchTypes = elem.appendChild(document.createElement("div"));
  searchTypes.className = "searchTypes";
  searchTypes.textContent = bundle.GetStringFromName("searchTypes");
  
  var desc = elem.appendChild(document.createElement("div"));
  var descrow = function(row, name, description) {
    var cont = desc.appendChild(document.createElement("div"));
    var r1 = cont.appendChild(document.createElement("div"));
    r1.className = "typeName";
    r1.textContent = dString(row) + ") " + bundle.GetStringFromName(name) + ": ";
    var r2 = cont.appendChild(document.createElement("div"));
    r2.className = "typeDesc";
    r2.textContent = bundle.GetStringFromName(description);
  };
  descrow(1, "hasthewords", "contains_the_words_desc");
  descrow(2, "hasthistext", "contains_exact_text_desc");
  descrow(3, "advancedmatch", "using_special_search_terms_desc");
  descrow(4, "matchparts", "contains_similar_words_desc");
  
  // use a table to display search help text
  var tbody = elem.appendChild(document.createElement("table")).appendChild(document.createElement("tbody"));
  for (var r=0; r<9; r++) {
    var row = tbody.appendChild(document.createElement("tr"));
    row.className =  (r%2 == 1 ? "odd-row":"even-row");
    for (var c=0; c<4; c++) {
      if (c > 0 || r == 0) {
        var lstring = bundle.GetStringFromName("searchTable_" + r + "_" + c);
      }
      else {
        lstring = getSpecialSearchChar(rows[r]);
        if ((/START$/).test(rows[r])) {
          lstring += " " + getSpecialSearchChar(rows[r].replace("START", "END"));
        }
      }
      var cell = row.appendChild(document.createElement("td"));
      cell.className = "col" + c + " row" + r;
      cell.innerHTML = lstring;
    }
  }
  
  var caseMessage = elem.appendChild(document.createElement("div"));
  caseMessage.id = "caseMessage";
  caseMessage.textContent = bundle.GetStringFromName("searchCase");
}

function getSpecialSearchChar(name) {
  try {var schar = SearchBundle.GetStringFromName(name);}
  catch (er) {schar = "";}
  
  if (!schar || (/^\s*$/).test(schar)) {
    schar = LOCALE_SEARCH_SYMBOLS[name];
  }
  
  return schar;
}
