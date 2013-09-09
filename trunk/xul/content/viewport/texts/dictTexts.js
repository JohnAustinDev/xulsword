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
  
  keyList: MainWindow.DictKeyLists,
  keysHTML: MainWindow.DictKeyHTMLs,
  
  read: function(w, d) {
    var ret = { htmlList:"", htmlHead:Texts.getPageLinks(), htmlEntry:"", footnotes:null };
    
    // the key list is cached because it can take several seconds to
    // process large dictionaries!
    if (!this.keyList[d.mod]) {
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
    
    // get html for list of keys (is cached)
    if (!this.keysHTML[d.mod]) this.keysHTML[d.mod] = this.getListHTML(d.mod);
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
      if (html) html = this.markup2html(this.replaceLinks(html, mods[0]), mods[0]);
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
					dictEntry = this.markup2html(this.replaceLinks(dictEntry, mods[dw]), mods[dw]);
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
      if ((/^S_/).test(strongsClassArray[i]) && !(/^S_(DSS|MT)/).test(strongsClassArray[i])) { // DSS|MT for SPVar module
        buttonHTML += "<button type=\"button\" class=\"snbut\" ";
        buttonHTML +=     "title=\"" + (info.mod ? info.mod:"Program") + ":" + strongsClassArray[i].replace(/^[^_]+_/, "") + "." + sourcemod + "\">";
        buttonHTML +=   strongsClassArray[i].replace(/^[^_]+_/, "");
        buttonHTML += "</button>";
      }
      
      if (info.key && info.mod) {
        if (Number(info.key) == 0) continue; // skip G tags with no number
        var entry = LibSword.getDictionaryEntry(info.mod, info.key);
        if (entry) {
          html += sep + buttonHTML + this.markup2html(this.replaceLinks(entry, info.mod), info.mod);
        }
        else html += sep + buttonHTML + info.key;
      }
      else html += sep + buttonHTML + strongsClassArray[i].replace(/S_(DSS|MT)_/g, "$1: "); // DSS|MT for SPVar module
      
      sep = "<div class=\"lemma-sep\"></div>";
    }
    
    // Add heading now that we know module styling
    html = "<div class=\"lemma-html cs-" + (info.mod ? info.mod:"Program") + "\"><div class=\"lemma-header\">" + matchingPhrase + "</div>" + html + "<div>";
   
    return html;
  },
  
  // some TEI mods (like AbbottSmith, Strong) may use @LINK, so replace these here.
  replaceLinks: function(entry, mod) {
		var link = entry.match(/(\@LINK\s+[^\s<]+)/g);
		if (link) {
			for (var x=0; x<link.length; x++) {
				var l = link[x].match(/\@LINK\s+([^\s<]+)/);
				
				// fix problems related to AbbottSmith module...
				if (mod == "AbbottSmith") {
					var hack = {ΐ:"Ϊ́", ὐ:"Υ̓"};
					for (var h in hack) {l[1] = l[1].replace(h, hack[h], "g");}
					if (l[1] == "ἀγαλλίασις") l[1] = " ἈΓΑΛΛΊΑΣΙΣ"; // key needs space before!
				}

				var r = LibSword.getDictionaryEntry(mod, l[1].toUpperCase());
				if (!r) r = LibSword.getDictionaryEntry(mod, l[1]);
				if (r) entry = entry.replace(l[0], r);
			}
		}
		
		return entry;
	},
	
	markup2html: function(entry, mod) {
		
		// sense
		entry = entry.replace(/<\/sense[^>]*>/g, "</span>");
		do {
			var entry2 = entry;
			var p = entry.match(/<sense([^>]*)>(.*?<)/);
			if (p) {
				var n = p[1].match(/n="(.*?)"/);
				n = (n && p[2].indexOf(n[1]) != 0 ? n[1]:"");
				
				entry = entry.replace(p[0], "<span class=\"markup-sense\">" + (n ? "<b>" + n + "</b>":"") + (n && !(/^[\.]/).test(p[2]) ? ". ":"") + p[2]);
			}
		} while(entry != entry2);
		
		// ref
		entry = entry.replace(/<\/ref[^>]*>/g, "</span>");
		do {
			var entry2 = entry;
			var p = entry.match(/<ref([^>]*)>/);
			if (p) {
				var osisID = p[1].match(/osisRef="(.*?)"/);
				var target = p[1].match(/target="(.*?)"/);
				
				var mclass, mtitle;
				if (osisID) {
					mtitle = osisID[1] + "." + mod;
					mclass = "sr";
				}
				else if (target) {
					target = target[1].replace("self:", mod + ":");
					mtitle = target + "." + mod
					mclass = "dtl"
				}
				
				entry = entry.replace(p[0], "<span class=\"" + mclass + "\" title=\"" + mtitle + "\">");
			}
		} while(entry != entry2);
		
		entry = this.replaceTags(entry, "orth", /type="(.*?)/);
		entry = this.replaceTags(entry, "hi");
		entry = this.replaceTags(entry, "pron");
		entry = this.replaceTags(entry, "def");
		entry = this.replaceTags(entry, "entryFree");
		entry = this.replaceTags(entry, "title");
		entry = this.replaceTags(entry, "foreign");
		entry = this.replaceTags(entry, "xr");
		entry = this.replaceTags(entry, "entry");
		entry = this.replaceTags(entry, "form");
		entry = this.replaceTags(entry, "etym", /n="(.*?)"/);
		entry = this.replaceTags(entry, "cit");
		entry = this.replaceTags(entry, "usg");
		entry = this.replaceTags(entry, "quote");
		entry = this.replaceTags(entry, "note");
		entry = this.replaceTags(entry, "emph");
		entry = this.replaceTags(entry, "gramGrp");
		entry = this.replaceTags(entry, "pos");
		
var m=entry.match(/<(\w+)/g); if (m) {for (var x=0; x<m.length; x++) {if (!(/(span|div|b|i)/).test(m[x])) jsdump("INFO: Found unhandled tag \"" + m[x] + "\" in\n" + entry);}} 
	
		return entry;
	},
	
	// class must be a string or a regular-expression to match a string
	replaceTags: function(entry, tag, subclass) {
		var eTag = new RegExp("<\\/" + tag + "[^>]*>", "g");
		entry = entry.replace(eTag, "</span>");
		
		var sTag = new RegExp("<" + tag + "([^>]*)>");
		do {
			var entry2 = entry;
			var p = entry.match(sTag);
			if (p) {
				var mclass;
				if (subclass && typeof(subclass) != "string") {
					mclass = p[1].match(subclass);
					if (mclass) mclass = mclass[1];
				}
				else mclass = subclass;
				
				var rend = p[1].match(/rend="(.*?)"/);
				
				entry = entry.replace(p[0], "<span class=\"markup-" + tag + (mclass ? "-" + mclass:"") + (rend ? " markup_" + rend[1]:"") + "\">");
			}
		}
		while (entry2 != entry);
		
		return entry;
	},
  
  getStrongsModAndKey: function(snclass) {
    var res = { mod:null, key:null };
    
    var parts = snclass.split("_");
    if (!parts || !parts[1]) return res;
    
    res.key = parts[1];
    res.key = res.key.replace(" ", "", "g"); // why?

    switch (parts[0]) {
      
    case "S":
        
      // Strongs Hebrew or Greek tags
      var feature = null;
      if (res.key.charAt(0)=="H") {
        feature = "HebrewDef";
      }
      else if (res.key.charAt(0)=="G") {
        if (Number(res.key.substr(1)) >= 5627) return res; // SWORD filters these out- not valid it says
        feature = "GreekDef";
      }
      if (feature) {
				try {res.mod = prefs.getCharPref("Selected" + feature);}
				catch (er) {res.mod = null; return res;}
			}
			if (!res.mod) {res.key = null; return res;};
      
      var styp = (feature == "HebrewDef" ? "H":"G");
      var snum = Number(res.key.substr(1));
      if (isNaN(snum)) {res.key = null; return res;}
      var pad4 = String("0000").substr(0, 4-(String(snum).length-1)) + String(snum);

			// possible keys in order of likelyhood
			var keys = ["0" + pad4, styp + pad4, pad4, styp + snum, snum, styp + "0" + pad4];
			
			// try out key possibilities until we find a correct key for this mod
			if (res.mod) {
				for (var k=0; k<keys.length; k++) {
					if (LibSword.getDictionaryEntry(res.mod, keys[k])) break;
				}
				if (k < keys.length) res.key = keys[k];
			}
      break;
      
    case "RM":
      // Robinson's Greek parts of speech tags (used by KJV)
      if (SpecialModules.LanguageStudy.GreekParse.indexOf("Robinson") != -1) res.mod = "Robinson";
      break;
      
    case "SM":
      // no lookup module available for these yet...
      try {res.mod = prefs.getCharPref("Selected" + "GreekParse");}
			catch (er) {res.mod = null;}
      break;
      
    default:
      // meaning of tag is unknown
      jsdump("Unknown Strongs type:" + parts[0]);
      res.key = null;
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
    this.keypressOT = window.setTimeout("DictTexts.keyPressR()", 2000);
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
      Texts.updateDictionary(w, Texts.getWindowDisplay(w), false);
    }
  },

  selKey: function (e) {
    if (!e.target.title) return;
    
    var w = getContextWindow(e.target);
    
    ViewPort.Key[w] = decodeURIComponent(e.target.title);
    Texts.updateDictionary(w, Texts.getWindowDisplay(w), false);
    window.setTimeout("document.getElementById('note" + w + "').getElementsByClassName('keytextbox')[0].focus();", 1);
  }

};

