/*  This file is part of xulSword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

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

////////////////////////////////////////////////////////////////////////
// DictTexts
////////////////////////////////////////////////////////////////////////

DictTexts = {
  
  keyList: {},
  keysHTML: {},
  
  read: function(w, d) {
    var ret = { htmlList:"", htmlHead:Texts.getPageLinks(), htmlEntry:"", footnotes:null };
    
    // the key list is cached because it can take several seconds to
    // process large dictionaries!
    if (!this.keyList[d.mod]) {
      if (this !== MainWindow.DictTexts && 
          MainWindow.DictTexts.keyList.hasOwnProperty(d.mod)) {
        this.keyList[d.mod] = MainWindow.DictTexts.keyList[d.mod];
      }
      else {
        this.keyList[d.mod] = LibSword.getAllDictionaryKeys(d.mod).split("<nx>");
        this.keyList[d.mod].pop();
        this.sortOrder = LibSword.getModuleInformation(d.mod, "LangSortOrder");
        if (this.sortOrder != NOTFOUND) {
          this.sortOrder += "0123456789";
          this.langSortSkipChars = LibSword.getModuleInformation(d.mod, "LangSortSkipChars");
          if (this.langSortSkipChars == NOTFOUND) this.langSortSkipChars = "";
          this.keyList[d.mod].sort(this.dictSort);
        }
      }
    }
    
    // get html for list of keys (is cached)
    if (!this.keysHTML[d.mod]) {
      if (this !== MainWindow.DictTexts && 
          MainWindow.DictTexts.keysHTML.hasOwnProperty(d.mod)) {
        this.keysHTML[d.mod] = MainWindow.DictTexts.keysHTML[d.mod];
      }
      else this.keysHTML[d.mod] = this.getListHTML(d.mod);
    }
    ret.htmlList = this.keysHTML[d.mod];

    // get actual key
    if (!d.Key) d.Key = this.keyList[d.mod][0];
    if (d.Key == "DailyDevotionToday") {
      var today = new Date();
      d.Key = (today.getMonth()<9 ? "0":"") + String(today.getMonth()+1) + "." + (today.getDate()<10 ? "0":"") + today.getDate();
    }
    
    // get htmlEntry
    var de = this.getEntryHTML(d.Key, d.mod);
    var un = Texts.getUserNotes("na", d.Key, d.mod, de);
    de = un.html; // has user notes added to text
    ret.footnotes = un.notes;
    
    ret.htmlEntry += "<div class=\"dictentry\">" + de + "</div>";
  
    ret.key = d.Key;
 
    return ret;
  },
  
  getListHTML: function(mod) {
    var list = this.keyList[mod];
    
    var html = "";
    html += "<div class=\"dictlist\">"
    html +=   "<div class=\"textboxparent\">";
    html +=     "<input class=\"cs-" + mod + " keytextbox\" onfocus=\"this.select()\" ondblclick=\"this.select()\" ";
    html +=     "onkeypress=\"DictTexts.keyPress(event)\" />";
    html +=   "</div>";
    html +=   "<div class=\"keylist\" onclick=\"DictTexts.selKey(event)\">";
    for (var e=0; e < list.length; e++) {
      html += "<div class=\"key " + encodeURIComponent(list[e]) + "\" title=\"" + encodeURIComponent(list[e]) + "\" >" + list[e] + "</div>";
    }
    html +=   "</div>";
    html += "</div>";

    return html;
  },
  
  getEntryHTML: function(key, mods) {
    if (!key || !mods) return "";

    mods = mods.split(";");
    
    var html = "";
    if (mods.length == 1) {
      try {html = LibSword.getDictionaryEntry(mods[0], key);}
      catch (er) {jsdump("e1: missing key, trying uppercase..."); html = "";}
      if (!html) {
        try {html = LibSword.getDictionaryEntry(mods[0], key.toUpperCase());}
        catch (er) {jsdump("e1: missing key, skipping."); html = "";}
      }
    }
    else if (mods.length > 1) {
      var sep = "";
      for (var dw=0; dw<mods.length; dw++) {
        var dictEntry="";
        try {dictEntry = LibSword.getDictionaryEntry(mods[dw], key);}
        catch (er) {jsdump("e2: missing key, trying uppercase..."); dictEntry = "";}
        if (!dictEntry) {
          try {dictEntry = LibSword.getDictionaryEntry(mods[dw], key.toUpperCase());}
          catch (er) {jsdump("e2: missing key, skipping."); dictEntry = "";}
        }
        if (dictEntry) {
          dictEntry = dictEntry.replace(/^(<br>)+/, "");
          var dictTitle = LibSword.getModuleInformation(mods[dw], "Description");
          dictTitle = (dictTitle != NOTFOUND ? "<div class=\"dict-description\">" + dictTitle + "</div>":"");
          html += sep + dictTitle + dictEntry;
          sep = "<div class=\"dict-sep\"></div>";
        }
      }
    }
    
    if (!html) return "";

    // Add a heading
    html = "<div class=\"cs-" + mods[0] + "\"><div class=\"dict-key-heading cd-" + mods[0] + "\">" + key + ":</div>" + html + "</div>";
   
    return html;
  },
  
  sortOrder:"",
  langSortSkipChars:"",
  dictSort: function(a,b) {
    var xa=0;
    var xb=0;
    var ca = a.charAt(xa);
    while (ca && DictTexts.langSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
    var cb = b.charAt(xb);
    while (cb && DictTexts.langSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
    while (ca || cb) {
      if (!ca) return -1;
      if (!cb) return 1;
      if (DictTexts.sortOrder.indexOf(ca) < DictTexts.sortOrder.indexOf(cb)) return -1;
      if (DictTexts.sortOrder.indexOf(ca) > DictTexts.sortOrder.indexOf(cb)) return 1;
      ca = a.charAt(++xa);
      while (ca && DictTexts.langSortSkipChars.indexOf(ca)!=-1) {ca = a.charAt(++xa);}
      cb = b.charAt(++xb);
      while (cb && DictTexts.langSortSkipChars.indexOf(cb)!=-1) {cb = b.charAt(++xb);}
    }
    return 0;
  },
  
  // Builds HTML text which displays lemma information from numberList
  //    numberList form: (S|WT|SM|RM)_(G|H)#
  getLemmaHTML: function(strongsClassArray, matchingPhrase, sourcemod) {
    
    // Start building html
    var html = "";
    var sep = "";
    for (var i=0; i<strongsClassArray.length; i++) {
      
      var info = this.getStrongsModAndKey(strongsClassArray[i]);
      
      // get a button to search for this Strong's number
      var buttonHTML = "";
      if ((/^S_/).test(strongsClassArray[i])) {
        buttonHTML += "<button type=\"button\" class=\"snbut\" ";
        buttonHTML +=     "title=\"" + (info.mod ? info.mod:"Program") + ":" + strongsClassArray[i].replace(/^[^_]+_/, "") + "." + sourcemod + "\">";
        buttonHTML +=   strongsClassArray[i].replace(/^[^_]+_/, "");
        buttonHTML += "</button>";
      }
      
      if (info.key && info.mod) {
        if (info.key == "00000") continue; // skip G tags with no number
        var entry = LibSword.getDictionaryEntry(info.mod, info.key);
        if (entry) {
          html += sep + buttonHTML + entry;
        }
        else html += sep + buttonHTML + info.key;
      }
      else html += sep + buttonHTML + strongsClassArray[i];
      
      sep = "<div class=\"lemma-sep\"></div>";
    }
    
    // Add heading now that we know module styling
    html = "<div class=\"lemma-html cs-" + (info.mod ? info.mod:"Program") + "\"><div class=\"lemma-header\">" + matchingPhrase + "</div>" + html + "<div>";
   
    return html;
  },
  
  getStrongsModAndKey: function(snclass) {
    var res = { mod:null, key:null };
    
    var parts = snclass.split("_");
    if (!parts || !parts[1]) return res;
    
    res.key = parts[1];
    res.key = res.key.replace(" ", "", "g"); // why?

    var feature = null;
    switch (parts[0]) {
      
    case "S":
      // Strongs Hebrew or Greek tags
      if (res.key.charAt(0)=="H") {
        feature = "HebrewDef";
      }
      else if (res.key.charAt(0)=="G") {
        if (Number(res.key.substr(1)) >= 5627) return res; // SWORD filters these out- not valid it says
        feature = "GreekDef";
      }
      res.key = String("00000").substr(0, 5-(res.key.length-1)) + res.key.substr(1);
      break;
      
    case "RM":
      // Greek parts of speech tags
      feature = "GreekParse";
      break;
      
    case "SM":
    case "WT":
      // no lookup module available for these
      break;
      
    default:
      // meaning of tag is unknown
      jsdump("Unknown Strongs class:" + parts[0]);
      res.key = null;
      break;
      
    }
    
    if (!feature) return res;
    
    try {res.mod = prefs.getCharPref("Selected" + feature);}
    catch (er) {res.mod = null;}
    
    return res;
  },

  //The timeout below was necessary so that textbox.value included the pressed key...
  keypressOT:null,
  keypressEvent:null,
  keyPress: function(e) {
    if (this.keypressOT) window.clearTimeout(this.keypressOT);
    this.keypressEvent = e;
    this.keypressOT = window.setTimeout("DictTexts.keyPressR()", 500);
  },

  keyPressR: function() {
    var e = this.keypressEvent;
    this.keypressEvent = null;
    
    var charCode = e.which;
    var w = getContextWindow(e.target);
    var mod = ViewPort.Module[w];
    
    var textbox = document.getElementById("note" + w).getElementsByClassName("keytextbox")[0];
    var text = textbox.value;
    if (!text) {
      textbox.style.color="";
      return;
    }
    
    var matchtext = new RegExp("(^|<nx>)(" + escapeRE(text) + "[^<]*)<nx>", "i");
    var firstMatch = (DictTexts.keyList[mod].join("<nx>") + "<nx>").match(matchtext);
    if (!firstMatch) {
      if (charCode != 8) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      textbox.style.color="red";
    }
    else {
      textbox.style.color="";
      ViewPort.Key[w] = firstMatch[2];
      Texts.updateDictionary(w);
    }
  },

  selKey: function (e) {
    if (!e.target.title) return;
    
    var w = getContextWindow(e.target);
    
    ViewPort.Key[w] = decodeURIComponent(e.target.title);
    Texts.updateDictionary(w);
    window.setTimeout("document.getElementById('note" + w + "').getElementsByClassName('keytextbox')[0].focus();", 1);
  }

};

