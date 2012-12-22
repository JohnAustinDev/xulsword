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
    de = Texts.addParagraphIDs(de, d.mod);
    var un = Texts.getUserNotes("na", d.Key, d.mod, de);
    de = un.html; // has user notes added to text
    ret.footnotes = un.notes;
    
    ret.htmlEntry += "<div class=\"dictentry\">";
    ret.htmlEntry +=  "<div>" + de + "</div>";
    ret.htmlEntry += "</div>";
  
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
      html += "<div class=\"key\" title=\"" + encodeUTF8(list[e]) + "\" >" + list[e] + "</div>";
    }
    html +=   "</div>";
    html += "</div>";

    return html;
  },
  
  getEntryHTML: function(key, mods, dontAddParagraphIDs) {
    if (!key || !mods) return "";
    key = this.decodeOSISRef(key);
   
    mods += ";";
    mods = mods.split(";");
    mods.pop();
    
    var html = "";
    if (mods.length == 1) {
      try {html = LibSword.getDictionaryEntry(mods[0], key);}
      catch (er) {jsdump("e1"); html = "";}
    }
    else if (mods.length > 1) {
      var sep = "";
      for (var dw=0; dw<mods.length; dw++) {
        var dictEntry="";
        try {dictEntry = LibSword.getDictionaryEntry(mods[dw], key);}
        catch (er) {jsdump("e2"); dictEntry = "";}
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
   
    if (!dontAddParagraphIDs) html = Texts.addParagraphIDs(html, mods[0]);
   
    return html;
  },
  
  decodeOSISRef: function(aRef) {
    var re = new RegExp(/_(\d+)_/);
    var m = aRef.match(re);
    while(m) {
      var r = String.fromCharCode(Number(m[1]));
      aRef = aRef.replace(m[0], r, "g");
      m = aRef.match(re);
    }
    return aRef;
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
  getLemmaHTML: function(strongsClassList, matchingPhrase, sourcemod) {
    
    // Start building html
    var html = "";
    var sep = "";
    for (var i=0; i<strongsClassList.length; i++) {
      
      var info = this.getStrongsModAndKey(strongsClassList[i]);
      
      if (info.key && info.mod) {
        if (info.key == "00000") continue; // skip G tags with no number
        var entry = LibSword.getDictionaryEntry(info.mod, info.key);
        if (entry) {
          html   += sep;
          if ((/^S_/).test(strongsClassList[i])) { // add button for Strong number search
            html += "<button type=\"button\" class=\"snbut\" ";
            html +=     "title=\"" + info.mod + ":" + strongsClassList[i].replace(/^[^_]+_/, "") + "." + sourcemod + "\">";
            html +=   strongsClassList[i].replace(/^[^_]+_/, "");
            html += "</button>";
          }
          html   += entry;
        }
        else html += sep + info.key;
      }
      else html += sep + strongsClassList[i];
      
      sep = "<div class=\"lemma-sep\"></div>";
    }
    
    // Add heading now that we know module styling
    html = "<div class=\"lemma-header cs-" + info.mod + "\">" + matchingPhrase + "</div>" + html;
   
    return html;
  },
  
  getStrongsModAndKey: function(snclass) {
    var res = { mod:null, key:null };
    
    const pad="00000";
    var defaultBibleLanguage = LibSword.getModuleInformation(prefs.getCharPref("DefaultVersion"), "Lang");
    if (defaultBibleLanguage == NOTFOUND) defaultBibleLanguage = "";
    var defaultBibleLangBase = (defaultBibleLanguage ? defaultBibleLanguage.replace(/-.*$/, ""):"");
    
    var parts = snclass.split("_");
    if (!parts || !parts[1]) return res;
    
    res.key = parts[1];
    res.key = res.key.replace(" ", "", "g"); // why?

    var type = parts[0];
    switch (type) {
      
    case "S":
      // Strongs Hebrew or Greek tags
      if (res.key.charAt(0)=="H") {
        if (SpecialModules.LanguageStudy["StrongsHebrew" + defaultBibleLanguage])
          res.mod = SpecialModules.LanguageStudy["StrongsHebrew" + defaultBibleLanguage];
        else if (SpecialModules.LanguageStudy["StrongsHebrew" + defaultBibleLangBase])
          res.mod = SpecialModules.LanguageStudy["StrongsHebrew" + defaultBibleLangBase];
        else if (SpecialModules.LanguageStudy["StrongsHebrew"])
          res.mod = SpecialModules.LanguageStudy["StrongsHebrew"];
      }
      else if (res.key.charAt(0)=="G") {
        if (Number(res.key.substr(1)) >= 5627) return res; // SWORD filters these out- not valid it says
        if (SpecialModules.LanguageStudy["StrongsGreek" + defaultBibleLanguage])
          res.mod = SpecialModules.LanguageStudy["StrongsGreek" + defaultBibleLanguage];
        else if (SpecialModules.LanguageStudy["StrongsGreek" + defaultBibleLangBase])
          res.mod = SpecialModules.LanguageStudy["StrongsGreek" + defaultBibleLangBase];
        else if (SpecialModules.LanguageStudy["StrongsGreek"])
          res.mod = SpecialModules.LanguageStudy["StrongsGreek"];
      }
      res.key = pad.substr(0, 5-(res.key.length-1)) + res.key.substr(1);
      break;
      
    case "RM":
      // Greek parts of speech tags
      if (SpecialModules.LanguageStudy["GreekParse" + defaultBibleLanguage])
        res.mod = SpecialModules.LanguageStudy["GreekParse" + defaultBibleLanguage];
      else if (SpecialModules.LanguageStudy["GreekParse" + defaultBibleLangBase])
        res.mod = SpecialModules.LanguageStudy["GreekParse" + defaultBibleLangBase];
      else if (SpecialModules.LanguageStudy["GreekParse"])
        res.mod = SpecialModules.LanguageStudy["GreekParse"];
      break;
      
    case "SM":
    case "WT":
      // no lookup module available for these
      break;
      
    default:
      // meaning of tag is unknown
      key = null;
      break;
      
    }
    
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
    
    ViewPort.Key[w] = decodeUTF8(e.target.title);
    Texts.updateDictionary(w);
    window.setTimeout("document.getElementById('note" + w + "').getElementsByClassName('keytextbox')[0].focus();", 1);
  }

};

