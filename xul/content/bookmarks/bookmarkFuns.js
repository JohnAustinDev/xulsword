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

const BROWSER_ADD_BM_FEATURES = "centerscreen,modal,chrome,dialog,resizable,dependent";
const MAX_BOOKMARK_TEXT = 1024;

/************************************************************************
 * Bookmark functions
 ***********************************************************************/ 

BookmarkFuns = {
  _bundle: null,
  
  initTemplateDataSource: function(elem, ds) {
    elem.database.AddDataSource(ds);
    elem.builder.rebuild();
  },

  // This routine does not modify any existing BM data! It only intelligently
  // fills in empty properties 
  completeBMInfo : function (bmInfo, bmType) {
//jsdump(bmType + " START completeBMInfo:" + bmInfo);
    if (!bmType) bmType = bmInfo[TYPE];
    var currentDate = new Date().toLocaleDateString();
    // NOTE: Imported bookmarks may not correspond to installed modules!
    // Such bookmarks should NOT be modifiable, because without the module, the exact
    // meaning of the bookmark cannot be known. Such bookmarks should behave in a 
    // reasonable way however.
    if (!bmInfo[CREATIONDATE]) bmInfo[CREATIONDATE] = currentDate;
    if (!bmInfo[VISITEDDATE]) bmInfo[VISITEDDATE] = "-----";
    switch (bmType) {
    case "Bookmark":
      if (!bmInfo[MODULE]) bmInfo[MODULE] = prefs.getCharPref("DefaultVersion");
      var type = getModuleLongType(bmInfo[MODULE]);
      if (type && !bmInfo[ICON]) bmInfo[ICON] = (bmInfo[NOTE] ? BM.gIconWithNote[getShortTypeFromLong(type)]:BM.gIcon[getShortTypeFromLong(type)]);
      if (!bmInfo[TYPE]) bmInfo[TYPE] = "Bookmark";
      if (!bmInfo[VERSE]) bmInfo[VERSE] = 1; //could be verse OR paragraph
      if (!bmInfo[CHAPTER]) { //only fill in book & lastVerse if there is no chapter- could be non-versekey!
        bmInfo[CHAPTER] = 1;
        if (!bmInfo[LASTVERSE]) bmInfo[LASTVERSE] = bmInfo[VERSE];
        if (!bmInfo[BOOK]) bmInfo[BOOK] = getAvailableBooks(bmInfo[MODULE])[0];
      }
      
      // A bookmark's content is based on MODULE/BOOK/CHAPTER/VERSE/LASTVERSE rather than on LOCATION
      // The LOCATION is just the KJV equivalent of this as an "absolute" reference (not all possible 
      // verses have a KJV equivalent, but this is the way it was originally done).
      var loc = {version:bmInfo[MODULE], shortName:bmInfo[BOOK], chapter:bmInfo[CHAPTER], verse:bmInfo[VERSE], lastVerse:bmInfo[LASTVERSE]};
      if (!bmInfo[BMTEXT]) bmInfo[BMTEXT] = BookmarkFuns.getTextForBookmark(loc).text;
      if (!bmInfo[NAME]) bmInfo[NAME] = BookmarkFuns.getNameForBookmark(loc);
      if (!bmInfo[LOCATION] && loc.shortName) {
        // LOCATION is always according to the KJV verse system!
        bmInfo[LOCATION] = Location.convertLocation(LibSword.getVerseSystem(loc.version), loc.shortName + "." + loc.chapter + "." + loc.verse + "." + loc.lastVerse, WESTERNVS);
      }
      break;
      
    case "Folder":
      if (!bmInfo[TYPE]) bmInfo[TYPE] = "Folder";
      if (!bmInfo[NAME]) bmInfo[NAME] = BookmarksUtils.getLocaleString("ile_newfolder");
      break;
    }
//jsdump(bmType + " FINISH completeBMInfo:" + bmInfo);
  },
  
  updateBookmarkProperties: function(bmID, info) {
    var wasChanged = false;
    
    var gResource = BM.RDF.GetResource(bmID);
    
    // Grovel through the fields to see if any of the values have
    // changed. If so, update the RDF graph and force them to be saved
    // to disk.
    for (var i=0; i<info.length; ++i) {
      // Get the new value as a literal, using 'null' if the value is empty.
      var newValue = info[i];
      
      var oldValue = BMDS.GetTarget(gResource, BM.gBmProperties[i], true);

      if (oldValue)
        oldValue = oldValue.QueryInterface(Components.interfaces.nsIRDFLiteral);

      if (newValue)
        newValue = BM.RDF.GetLiteral(newValue);

      wasChanged |= ResourceFuns.updateAttribute(gResource, BM.gBmProperties[i], oldValue, newValue);
      
      if (!newValue) newValue = "";
      if (!oldValue) oldValue = "";
      if (i == NAME && newValue != oldValue) info[NAMELOCALE] = getLocale();
      if (i == NOTE && newValue != oldValue) info[NOTELOCALE] = getLocale();
    }
    
    return wasChanged;
  },

  addBookmarkAs: function (location, selectNoteFlag) {
  // note: null, book: location.shortName, chapter: location.chapter, verse: location.verse, lastVerse: location.lastVerse, version: location.version, 
    var name = BookmarkFuns.getNameForBookmark(location);
    var text = BookmarkFuns.getTextForBookmark(location);
    var dialogArgs = {name:name, text:text, selectNoteFlag: selectNoteFlag};
    var retVal = {name:null, note: null, chosenFolderID: null, ok: false};
    openDialog("chrome://xulsword/content/bookmarks/addBookmark/addBookmark.xul", "", BROWSER_ADD_BM_FEATURES, dialogArgs, retVal);
    if (!retVal.ok) return;
    // Create the new bookmark now...
    var myprops = ["Bookmark", retVal.name, retVal.note, location.shortName, location.chapter, location.verse, location.lastVerse, location.version, null, text.text];
    var resource = ResourceFuns.createNewResource(myprops);
    var aTarget = {parent: BM.RDF.GetResource(retVal.chosenFolderID), index: 1};
    var selection = BookmarksUtils.getSelectionFromResource(resource, aTarget.parent);
    var ok        = BookmarksUtils.insertAndCheckSelection("newbookmark", selection, aTarget, -1);
    BookmarkFuns.updateMainWindow();
    //var dmp = ResourceFuns.BmGetInfo(retVal.newResource.Value); for (var i=0; i<dmp.length; i++) {dump(i + " " + dmp[i] + "\n");}
  },

  getNameForBookmark: function (location) {
    var bmname=null;
    switch (getModuleLongType(location.version)) {
    case BIBLE:
    case COMMENTARY:
      var aConfig = LocaleConfigs[getLocale()];
      var directionChar = (aConfig && aConfig.direction && aConfig.direction=="rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));
      bmname = Book[findBookNum(location.shortName)].bNameL + " " + location.chapter + ":" + directionChar + location.verse;
      if (location.lastVerse>location.verse) bmname += directionChar + "-" + location.lastVerse;
      break;
    case DICTIONARY:
      bmname = location.chapter;
      break;
    case GENBOOK:
      bmname = location.chapter.match(/\/([^\/]+)$/);
      if (bmname) bmname = bmname[1];
      else bmname = "";
      break;
    }
    
    // Add a module indicator if not a LibSword...
    if (Tab[location.version] && Tab[location.version].modType!=BIBLE)
      bmname = Tab[location.version].label + ": " + bmname;
    
    return dString(bmname);
  },
  
  getTextForBookmark: function (location) {
    var retval = {text:null, location:location};
    var text=null;
    var directionChar = (ModuleConfigs[location.version] && 
        ModuleConfigs[location.version].direction=="rtl" ? 
        String.fromCharCode(8207):String.fromCharCode(8206));
        
    switch (getModuleLongType(location.version)) {
    
    case BIBLE:
      var bkChap = location.shortName + " " + location.chapter + ":";
      location.lastVerse = location.lastVerse ? location.lastVerse:location.verse;
      var aVerse = findAVerseText(location.version, bkChap + location.verse + "-" + bkChap + location.lastVerse);
      text = aVerse.text.replace(/^\s*/,"");
      if (location.version != Tabs[aVerse.tabNum].modName) text += " (" + Tabs[aVerse.tabNum].label + ")";
      retval.location = dotStringLoc2ObjectLoc(aVerse.location, Tabs[aVerse.tabNum].modName);
      break;
      
    case COMMENTARY:
      var bkChap = location.shortName + " " + location.chapter + ":";
      location.lastVerse = location.lastVerse ? location.lastVerse:location.verse;
      text = LibSword.getVerseText(location.version, bkChap + location.verse + "-" + bkChap + location.lastVerse, false).replace(/^\s*/,"");
      break;
      
    case DICTIONARY:
      text = DictTexts.getEntryHTML(location.chapter, location.version);
      break;
      
    case GENBOOK:
      text = LibSword.getGenBookChapterText(location.version, location.chapter);
      break;
    }
    
    text = text.replace(/<[^>]*>/g, "");
    retval.text = text.substr(0, MAX_BOOKMARK_TEXT);
    return retval;
  },
  
  showPropertiesWindow: function (aWindow, resourceID, editNote) {
    var value = {ok:false};
    // NOTE: this window MUST be modal so that bookmark transactions work properly.
    aWindow.openDialog("chrome://xulsword/content/bookmarks/bookmarksProperties/bookmarksProperties.xul", "", "centerscreen,chrome,modal,resizable=no", resourceID, value, editNote);
    return value.ok;
  },
    
  updateToolTip: function (bmelem) {
    var info, text;
    try {
      info = ResourceFuns.BmGetInfo(bmelem.id);
      var directionChar = (ModuleConfigs[info[MODULE]] && ModuleConfigs[info[MODULE]].direction=="rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));
      text = info[BMTEXT].substr(0, TOOLTIP_LEN);
      text += (text.length==TOOLTIP_LEN ? "...":"");
      text = directionChar + text + directionChar;
      if (text.length < 4) {bmelem.removeAttribute("tooltip");}
      else {
        var tooltip = document.getElementById("bookmarkTTL");
        tooltip.setAttribute("value", text);
        tooltip.setAttribute("class", "cs-" + info[MODULE]);
        bmelem.setAttribute("tooltip", "bookmarkTT");
      }
    }
    catch (er) {bmelem.removeAttribute("tooltip");}
  },

  gotoBookMark: function (bmelemID) {
    var info = ResourceFuns.BmGetInfo(bmelemID);
    
    var mod = info[MODULE];
    if (!Tab.hasOwnProperty(mod)) {
      Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      jsdump("Module \"" + mod + "\" is not installed. Cannot gotoBookMark.")
      return;
    }

    switch (Tab[mod].modType) {
    case BIBLE:
    case COMMENTARY:
      var loc = { bk:info[BOOK], ch:info[CHAPTER], vs:info[VERSE], lv:(info[LASTVERSE] ? info[LASTVERSE]:info[VERSE]) };
      break;
    case DICTIONARY:
    case GENBOOK:
      var loc = { bk:"na.", ch:info[CHAPTER], vs:info[VERSE], lv:info[VERSE] };
      break;
    }

    XS_window.showLocation(mod, loc.bk, loc.ch, loc.vs, loc.lv);
  },

  
  updateMainWindow: function (focusOnMainWindow, scrollFlag) {
    if (!XS_window || LibSword.paused) return;
    if (scrollFlag == null) scrollFlag = SCROLLTYPECENTER;
    if (focusOnMainWindow) XS_window.focus();
    XS_window.Texts.update(scrollFlag, HILIGHTVERSE, [null,1,1,1]);
  },
  
  getLocaleString: function (aStringKey, aReplaceString) {
    if (!this._bundle) {
      // for those who would xblify Bookmarks.js, there is a need to create string bundle 
      // manually instead of using <xul:stringbundle/> see bug 63370 for details
      var LOCALESVC = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                .getService(Components.interfaces.nsILocaleService);
      var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                .getService(Components.interfaces.nsIStringBundleService);
      var bookmarksBundle  = "chrome://xulsword/locale/bookmarks/bookmarks.properties";
      this._bundle         = BUNDLESVC.createBundle(bookmarksBundle, LOCALESVC.getApplicationLocale());
      //var brandBundle      = "chrome://xulsword/locale/bookmarks/brand.properties";
      //this._brandShortName = BUNDLESVC.createBundle(brandBundle,     LOCALESVC.getApplicationLocale())
      //                                .GetStringFromName("brandShortName");
    }
   
    var bundle;
    try {
      if (!aReplaceString)
        bundle = this._bundle.GetStringFromName(aStringKey);
      else if (typeof(aReplaceString) == "string")
        bundle = this._bundle.formatStringFromName(aStringKey, [aReplaceString], 1);
      else
        bundle = this._bundle.formatStringFromName(aStringKey, aReplaceString, aReplaceString.length);
    } catch (e) {
      //jsdump("Bookmark bundle "+aStringKey+" not found!\n");
      bundle = "";
    }

    //bundle = bundle.replace(/%brandShortName%/, this._brandShortName);
    return bundle;
  },
  
  saveAs: function (aSelection) {
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      var kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
      
      var kTitle = fixWindowTitle(XSBundle.getString("SaveAs"));
      kFilePicker.init(window, kTitle, kFilePickerIID["modeSave"]);
      kFilePicker.appendFilters(kFilePickerIID.filterText);
      kFilePicker.defaultString = "bookmarks.txt";
      kFilePicker.defaultExtension = "txt";
      var fileName;
      if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        fileName = kFilePicker.file.path;
        if (!fileName) return;
      }
      else return;

      var textFile = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsILocalFile);
      if (!textFile) return;
      textFile.initWithPath(lpath(fileName));
    }
    catch (e) {
      return;
    }
    
    writeSafeFile(textFile, this.getFormattedBMdata(aSelection.item[0], false), true, "UTF-16");
  },
  
  getFormattedBMdata: function(afolder, isHTML) {
    var data= (isHTML ? "<div class=\"page cs-Program\">":"");
    var ret = (isHTML ? "<br>":NEWLINE);
    var h1s = (isHTML ? "<span class=\"phead1\">":"");
    var h1e = (isHTML ? "</span>":"");
    
    // Print out folder's information first
    data += BookmarkFuns.getDataAboutFolder(afolder, h1s, h1e, ret, isHTML);
    
    // Now get all data inside the folder
    data += ret + BookmarkFuns.getDataFromFolder(afolder, h1s, h1e, ret, isHTML);
    
    data = data.replace(/  +/gm," ");   //HTML doesn't display these extra spaces, but .txt will! So remove them.
    data = data.replace(/ \./gm, ".");  //Cross-references will leave a "xxx ." at the end of a sentance, so fix this.
    if (isHTML) data += "</div>";
    return data;
  },
  
  getDataAboutFolder: function(afolder, h1s, h1e, ret, isHTML) {
    var data = (isHTML ? "<hr>":"");
    try {data += h1s + replaceASCIIcontrolChars(BMDS.GetTarget(afolder,BM.gBmProperties[NAME],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value + ret + h1e);} catch (er) {}
    try {
      var aNote="";
      aNote = replaceASCIIcontrolChars(BMDS.GetTarget(afolder,BM.gBmProperties[NOTE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value);
      if (aNote) {data += (isHTML ? "<br>":"") + "[" + aNote + "]" + ret;}
    } catch (er) {}
    return data;
  },
  
  getDataFromFolder: function(aFolder, h1s, h1e, ret, isHTML) {
    var h2s = (isHTML ? "<span class=\"phead2\">":"");
    var h2e = (isHTML ? "</span>":"");
    var fds = (isHTML ? "<div class=\"bmfolderindent\";\">":"");
    var fde = (isHTML ? "</div>":""); 
    var sms = (isHTML ? "<span class=\"psmall\">":"");
    var sme = (isHTML ? "</span>":"");
    
    var data="";
    
    try {BM.RDFC.Init(BMDS, aFolder);} catch (er) {return data;}
    var folderElements = BM.RDFC.GetElements();
    var datalast;
    var aNote;
    while (folderElements.hasMoreElements()) {
      datalast = data;
      var thisElem = folderElements.getNext();
      if (BM.RDFCU.IsContainer(BMDS, thisElem)) {
        data += BookmarkFuns.getDataAboutFolder(thisElem, h1s, h1e, ret, isHTML);
        data += fds + ret + BookmarkFuns.getDataFromFolder(thisElem, h1s, h1e, ret, isHTML) + fde;
      }
      else {
        try {data += h2s + replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[NAME],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value) + ret + h2e;} catch (er) {}
        aNote="";
        try {aNote = replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[NOTE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value);} catch (er) {}
        if (aNote) data += "[" +  aNote + "]" + ret;
        try {
          if (isHTML) data += "<div class=\"cs-" + BMDS.GetTarget(thisElem,BM.gBmProperties[MODULE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value + "\">";
          data += replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[BMTEXT],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value);
          data += sms + "[" + getCopyright(replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[MODULE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value)) + "]" + sme;
          data += ret;
          if (isHTML) data += "</div>";
        } catch (er) {}
      }
      if (datalast != data) {data += ret;}
    }
    return data;
  }
  
};

