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

var DictTexts = {
  
  keyList: [null, {}, {}, {}],
  keysHTML: [null, {}, {}, {}],
  
  read: function(w, d) {
    var ret = { htmlList:"", htmlHead:Texts.getPageLinks(), htmlEntry:"", footnotes:null };
    
    // get key list (is cached)
    if (!this.keyList[w][d.mod]) {
      this.keyList[w][d.mod] = LibSword.getAllDictionaryKeys(d.mod).split("<nx>");
      this.keyList[w][d.mod].pop();
      this.sortOrder = LibSword.getModuleInformation(d.mod, "LangSortOrder");
      if (this.sortOrder != NOTFOUND) {
        this.sortOrder += "0123456789";
        this.langSortSkipChars = LibSword.getModuleInformation(d.mod, "LangSortSkipChars");
        if (this.langSortSkipChars == NOTFOUND) this.langSortSkipChars = "";
        this.keyList[w][d.mod].sort(this.dictSort);
      }
    }
    
    // get html for list of keys (is cached)
    if (!this.keysHTML[w][d.mod]) {
      this.keysHTML[w][d.mod] = this.getListHTML(this.keyList[w][d.mod], d.mod, w);
    }
    ret.htmlList = this.keysHTML[w][d.mod];

    // get actual key
    if (!d.Key) d.Key = this.keyList[w][d.mod][0];
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
  
  getListHTML: function(list, mod, w) {
    var html = "";
    html += "<div class=\"dictlist\">"
    html +=   "<div class=\"textboxparent\" id=\"w" + w + ".textboxparent\">";
    html +=     "<input id=\"w" + w + ".keytextbox\" class=\"cs-" + mod + "\" onfocus=\"this.select()\" ondblclick=\"this.select()\" ";
    html +=     "onkeypress=\"DictTexts.keyPress('" + mod + "', " + w + ", event)\" />";
    html +=   "</div>";
    html +=   "<div class=\"keylist\" id=\"w" + w + ".keylist\" onclick=\"DictTexts.selKey('" + mod + "', " + w + ", event)\">";
    for (var e=0; e < list.length; e++) {
      html += "<div class=\"key\" id=\"w" + w + "." + encodeUTF8(list[e]) + "\" >" + list[e] + "</div>";
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
  getLemmaHTML: function(numberList, matchingPhrase) {

    const pad="00000";
    var defaultBibleLanguage = LibSword.getModuleInformation(prefs.getCharPref("DefaultVersion"), "Lang");
    if (defaultBibleLanguage == NOTFOUND) defaultBibleLanguage="";
    var defaultBibleLangBase = (defaultBibleLanguage ? defaultBibleLanguage.replace(/-.*$/, ""):"");
    
    // Start building html
    var html = "";
    var sep = "";
    for (var i=0; i<numberList.length; i++) {
      var parts = numberList[i].split("_");
      if (!parts || !parts[1]) continue;
      var module = null;
      var key = parts[1];
      key = key.replace(" ", "", "g");
      var saveKey = key;
      switch (parts[0]) {
      case "S":
        if (key.charAt(0)=="H") {
          if (LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage])
            module = LanguageStudyModules["StrongsHebrew" + defaultBibleLanguage];
          else if (LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase])
            module = LanguageStudyModules["StrongsHebrew" + defaultBibleLangBase];
          else if (LanguageStudyModules["StrongsHebrew"])
            module = LanguageStudyModules["StrongsHebrew"];
        }
        else if (key.charAt(0)=="G") {
          if (Number(key.substr(1)) >= 5627) continue; // SWORD filters these out- not valid it says
          if (LanguageStudyModules["StrongsGreek" + defaultBibleLanguage])
            module = LanguageStudyModules["StrongsGreek" + defaultBibleLanguage];
          else if (LanguageStudyModules["StrongsGreek" + defaultBibleLangBase])
            module = LanguageStudyModules["StrongsGreek" + defaultBibleLangBase];
          else if (LanguageStudyModules["StrongsGreek"])
            module = LanguageStudyModules["StrongsGreek"];
        }
        key = pad.substr(0,5-(key.length-1)) + key.substr(1);
        break;
      case "RM":
        if (LanguageStudyModules["GreekParse" + defaultBibleLanguage])
          module = LanguageStudyModules["GreekParse" + defaultBibleLanguage];
        else if (LanguageStudyModules["GreekParse" + defaultBibleLangBase])
          module = LanguageStudyModules["GreekParse" + defaultBibleLangBase];
        else if (LanguageStudyModules["GreekParse"])
          module = LanguageStudyModules["GreekParse"];
        break;
      case "SM":
        saveKey = "SM" + key;
        break;
      case "WT":
        saveKey = "WT" + key;
        break;
        
      default:
        key = null;
        break;
      }
      
      if (key && module) {
        if (key == pad) continue; // G tags with no number
        var entry = LibSword.getDictionaryEntry(module, key);
        if (entry) html += sep + entry;
        else html += sep + key;
      }
      else if (key) html += sep + saveKey;
      
      sep = "<div class=\"lemma-sep\"></div>";
    }
    
    // Add heading now that we know module styling
    html = "<div class=\"lemma-header cs-" + module + "\">" + matchingPhrase + "</div>" + html;
   
    return html;
  },

  //The timeout below was necessary so that textbox.value included the pressed key...
  keypressOT:null,
  keyPress: function(mod, w, e) {
    if (this.keypressOT) window.clearTimeout(this.keypressOT);
    this.keypressOT = window.setTimeout("DictTexts.keyPressR('" + mod + "', " + w + ", " + e.which + ")", 1000);
  },

  keyPressR: function(mod, w, charCode) {
    var textbox = document.getElementById("w" + w + ".keytextbox");
    var text = textbox.value;
    if (!text) {
      textbox.style.color="";
      return;
    }
    
    var matchtext = new RegExp("(^|<nx>)(" + escapeRE(text) + "[^<]*)<nx>", "i");
    var firstMatch = (DictTexts.keyList[w][mod].join("<nx>") + "<nx>").match(matchtext);
    if (!firstMatch) {
      if (charCode!=8) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      textbox.style.color="red";
    }
    else {
      textbox.style.color="";
      ViewPort.Key[w] = firstMatch[2];
      Texts.updateDictionary(w);
    }
  },

  selKey: function (mod, w, e) {
    if (!e.target.id || (e.target.id && (/^w\d\.keylist$/).test(e.target.id))) return;
    ViewPort.Key[w] = decodeUTF8(e.target.id.substr(3));
    Texts.updateDictionary(w);
    window.setTimeout("document.getElementById('w" + w + ".keytextbox').focus()", 1);
  }

};

