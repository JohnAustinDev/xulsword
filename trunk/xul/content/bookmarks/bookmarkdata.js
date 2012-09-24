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

/************************************************************************
 * Bookmark data service initialization
 ***********************************************************************/ 
var UserDataURI;
const kUserDataFileName = "bookmarks.rdf";
const kUserDataBackupName = "bookmarks_bak.rdf";
const TextFileReturn="\r\n";
const BROWSER_ADD_BM_FEATURES = "centerscreen,modal,chrome,dialog,resizable,dependent";

function initBMServices(bm) {
  bm.RDF              = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
  bm.kRDFRSCIID       = Components.interfaces.nsIRDFResource;
  bm.kRDFLITIID       = Components.interfaces.nsIRDFLiteral;
  bm.kRDFCContractID  = "@mozilla.org/rdf/container;1";
  bm.RDFC             = Components.classes[bm.kRDFCContractID].createInstance(Components.interfaces.nsIRDFContainer);
  bm.RDFCU            = Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils);
  bm.DS               = Components.classes["@mozilla.org/widget/dragservice;1"].getService(Components.interfaces.nsIDragService);
  bm.gTxnSvc          = Components.classes["@mozilla.org/transactionmanager;1"].getService(Components.interfaces.nsITransactionManager);
  
  bm.gNC_NS     = "http://www.xulsword.com/bookmarks/rdf#";
  bm.gRDF_NS    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  bm.gXUL_NS    = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  bm.gNC_NS_CMD = bm.gNC_NS + "command?cmd=";
  bm.BmEmptyID = "http://www.xulsword.com/bookmarks/emptyBookmark";
  bm.BookmarksRootID = "http://www.xulsword.com/bookmarks/BookmarksRoot";
  bm.AllBookmarksID = "http://www.xulsword.com/bookmarks/AllBookmarks";
  bm.FoundResultsID = "http://www.xulsword.com/bookmarks/FoundResults";
  bm.NumberFieldValueID = "http://www.xulsword.com/location/rdf#Anumber";
  
  bm.gIcon = {};
  bm.gIconWithNote = {};
  for (var type in SupportedModuleTypes) {
    bm.gIcon[type]          = "chrome://xulsword/skin/bookmarks/" + type + ".png";
    bm.gIconWithNote[type]  = "chrome://xulsword/skin/bookmarks/" + type + "WithNote.png";
  }
  
  bm.BmEmptyRes       = bm.RDF.GetResource(bm.BmEmptyID);
  bm.BookmarksRootRes = bm.RDF.GetResource(bm.BookmarksRootID);
  bm.AllBookmarksRes  = bm.RDF.GetResource(bm.AllBookmarksID);
  bm.FoundResultsRes  = bm.RDF.GetResource(bm.FoundResultsID);
    
  bm.gBmProperties    = [bm.RDF.GetResource(bm.gNC_NS+"Type"),
                        bm.RDF.GetResource(bm.gNC_NS+"Name"),
                        bm.RDF.GetResource(bm.gNC_NS+"Note"),
                        bm.RDF.GetResource(bm.gNC_NS+"Book"),
                        bm.RDF.GetResource(bm.gNC_NS+"Chapter"),
                        bm.RDF.GetResource(bm.gNC_NS+"Verse"),
                        bm.RDF.GetResource(bm.gNC_NS+"LastVerse"),
                        bm.RDF.GetResource(bm.gNC_NS+"Version"),
                        bm.RDF.GetResource(bm.gNC_NS+"Location"),
                        bm.RDF.GetResource(bm.gNC_NS+"VerseText"),
                        bm.RDF.GetResource(bm.gNC_NS+"Icon"),
                        bm.RDF.GetResource(bm.gNC_NS+"CreationDate"),
                        bm.RDF.GetResource(bm.gNC_NS+"ModifiedDate"),
                        bm.RDF.GetResource(bm.gNC_NS+"NameLocale"),
                        bm.RDF.GetResource(bm.gNC_NS+"NoteLocale")];
                       
  bm.kBATCH_LIMIT = 4;
  bm.kExportDelimiter = "<bg/>";
  bm.kExportResourceDelimiter = "<nx/>" + TextFileReturn;
    
  initBookmarksDataFile(false);
  var bmds = getUserData(bm.RDF);
  initBookmarksLocale(bm.RDF, bmds, bm.AllBookmarksRes, bm.gBmProperties, bm.BmEmptyRes);
  return bmds;
}

function initBookmarksDataFile(useEmptyDataSet) {
  var userDataInProfile = getSpecialDirectory("xsBookmarks");
  userDataInProfile.append(kUserDataFileName);

  UserDataURI = encodeURI("File://" + userDataInProfile.path.replace("\\", "/", "g"));

  if (!userDataInProfile.exists()) {
    userDataInProfile.create(userDataInProfile.NORMAL_FILE_TYPE, FPERM);
    var data = "";
    if (useEmptyDataSet) {data = getEmptyUserData();}
    else {
      var currentLocale = getLocale();
      data = getDefaultUserData(currentLocale + ".rdf");
      if (!data) {data = getEmptyUserData();}
    }
    writeFile(userDataInProfile, data, 1);
  }
}

function getUserData(rdf) {
  var myDS=null;
  var DSisGood=false;
  try {myDS = rdf.GetDataSourceBlocking(UserDataURI); DSisGood = true;}
  catch (er) {
    var badRDF = getSpecialDirectory("xsBookmarks");
    badRDF.append(kUserDataFileName);
    if (badRDF.exists()) {
      badRDF.moveTo(null, kUserDataFileName.replace(".rdf", BookmarkFuns.getRandomString() + ".rdf"));
      initBookmarksDataFile(true);
      myDS = rdf.GetDataSourceBlocking(UserDataURI);
    }
  }
  
  if (DSisGood) {
    // Back up this DS now
    var bmdir = getSpecialDirectory("xsBookmarks");
    var goodDS = bmdir.clone(); goodDS.append(kUserDataFileName);
    var backup = bmdir.clone(); backup.append(kUserDataBackupName);
    if (backup.exists()) removeFile(backup, false);
    goodDS.copyTo(bmdir, kUserDataBackupName);
  }
  
  return myDS;
}

function initBookmarksLocale(rdf, aDS, allBookmarksRes, bmProperties, bmEmptyRes) {
  var oldValue = aDS.GetTarget(allBookmarksRes, bmProperties[NAME], true);
  var newValue = rdf.GetLiteral(BookmarkFuns.getLocaleString("BookmarksRoot"));
  BookmarkFuns.updateAttribute(allBookmarksRes, bmProperties[NAME], oldValue, newValue, aDS);
  
  oldValue = aDS.GetTarget(bmEmptyRes, bmProperties[NAME], true);
  newValue = rdf.GetLiteral(BookmarkFuns.getLocaleString("emptyFolder"));
  BookmarkFuns.updateAttribute(bmEmptyRes, bmProperties[NAME], oldValue, newValue, aDS);
}

function getEmptyUserData() {
var data = "\
<?xml version=\"1.0\"?>\n\
<RDF:RDF xmlns:BOOKMARKS=\"http://www.xulsword.com/bookmarks/rdf#\"\n\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"\n\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n\
\n\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/BookmarksRoot\">\n\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/AllBookmarks\"/>\n\
  </RDF:Seq>\n\
\n\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/AllBookmarks\">\n\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/emptyBookmark\"/>\n\
  </RDF:Seq>\n\
\n\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/FoundResults\">\n\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/emptyBookmark\"/>\n\
  </RDF:Seq>\n\
\n\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/BookmarksRoot\" BOOKMARKS:Type=\"Folder\" BOOKMARKS:Name=\"Bookmarks Root\"/>\n\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/AllBookmarks\" BOOKMARKS:Type=\"Folder\"/>\n\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/emptyBookmark\" BOOKMARKS:Type=\"EmptyBookmark\"/>\n\
</RDF:RDF>\n\
";
return data;
}

function getDefaultUserData(fileName) {
  var file = getSpecialDirectory("DefRt");
  file.append(fileName);
  if (!file.exists()) {return null;}
  
  var filedata = readFile(file);
  
  return filedata;
}


/************************************************************************
 * Bookmark functions
 ***********************************************************************/ 

var BookmarkFuns = {
  _bundle        : null,
  
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
      var loc = {version:bmInfo[MODULE], shortName:bmInfo[BOOK], chapter:bmInfo[CHAPTER], verse:bmInfo[VERSE], lastVerse:bmInfo[LASTVERSE]};
      if (!bmInfo[BMTEXT]) bmInfo[BMTEXT] = BookmarkFuns.getTextForBookmark(loc).text;
      if (!bmInfo[NAME]) bmInfo[NAME] = BookmarkFuns.getNameForBookmark(loc);
      if (!bmInfo[LOCATION] && loc.shortName)
          bmInfo[LOCATION] = Location.convertLocation(Bible.getVerseSystem(loc.version), loc.shortName + "." + loc.chapter + "." + loc.verse + "." + loc.lastVerse, WESTERNVS);
      break;
      
    case "Folder":
      if (!bmInfo[TYPE]) bmInfo[TYPE] = "Folder";
      if (!bmInfo[NAME]) bmInfo[NAME] = BookmarksUtils.getLocaleString("ile_newfolder");
      break;
    }
//jsdump(bmType + " FINISH completeBMInfo:" + bmInfo);
  },

  addBookmarkAs: function (location, selectNoteFlag) {
  // note: null, book: location.shortName, chapter: location.chapter, verse: location.verse, lastVerse: location.lastVerse, version: location.version, 
    var name = BookmarkFuns.getNameForBookmark(location);
    var text = BookmarkFuns.getTextForBookmark(location);
    var dialogArgs = {name:name, text:text, selectNoteFlag: selectNoteFlag};
    var retVal = {name:null, note: null, chosenFolderID: null, ok: false};
    openDialog("chrome://xulsword/content/bookmarks/addBookmark2.xul", "",BROWSER_ADD_BM_FEATURES, dialogArgs, retVal);
    if (!retVal.ok) return;
    // Create the new bookmark now...
    var myprops = ["Bookmark", retVal.name, retVal.note, location.shortName, location.chapter, location.verse, location.lastVerse, location.version, null, text.text];
    var resource = this.createNewResource(myprops);
    var aTarget = {parent: BM.RDF.GetResource(retVal.chosenFolderID), index: 1};
    var selection = BookmarksUtils.getSelectionFromResource(resource, aTarget.parent);
    var ok        = BookmarksUtils.insertAndCheckSelection("newbookmark", selection, aTarget, -1);
    BookmarkFuns.updateMainWindow();
    //var dmp = this.BmGetInfo(retVal.newResource.Value); for (var i=0; i<dmp.length; i++) {dump(i + " " + dmp[i] + "\n");}
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
    
    // Add a module indicator if not a Bible...
    if (Tab[location.version] && Tab[location.version].modType!=BIBLE)
      bmname = Tab[location.version].label + ": " + bmname;
    
    return dString(bmname);
  },
  
  addModuleLabel: function (text, moduleName) {

  },
  
  getTextForBookmark: function (location) {
    var retval = {text:null, location:location};
    var text=null;
    var directionChar = (VersionConfigs[location.version] && 
        VersionConfigs[location.version].direction && VersionConfigs[location.version].direction=="rtl" ? 
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
      text = Bible.getVerseText(location.version, bkChap + location.verse + "-" + bkChap + location.lastVerse).replace(/^\s*/,"");
      break;
      
    case DICTIONARY:
      for (var w=1; w<=NW; w++) {if (location.version == prefs.getCharPref("Version" + w)) break;}
      if (w > NW) return retval;
      text = MainWindow.getDictionaryHTML(getPrefOrCreate("DictKey_" + location.version + "_" + w, "Unicode", ""), location.version);
      text = MainWindow.getParagraphWithIDTry(Number(location.verse), text);
      break;
      
    case GENBOOK:
      text = getGenBookChapterText(location.chapter, Bible);
      text = MainWindow.getParagraphWithIDTry(Number(location.verse), text);
      break;
    }
    retval.text = text;
    return retval;
  },
  
  insertFolder: function (bmelem) {
    var resource = this.createNewResource(["Folder"]);
    var ok = this.showPropertiesWindow(resource.Value, false);
    if (ok) {
      var parentID = this.getParentID(bmelem);
      this.addResourceToFolder(resource,parentID);
    }
  },

  deleteItemById: function (itemID, parentID) {
    var itemRes = BM.RDF.GetResource(itemID);
    var parentFolderRes = BM.RDF.GetResource(parentID);
    this.deleteElement(itemRes, parentFolderRes, true);
  },
  
  deleteBookmarkElement: function (bmelem) {
    var bm2delete = BM.RDF.GetResource(bmelem.id);
    var parentFolder = BM.RDF.GetResource(this.getParentID(bmelem));
    this.deleteElement(bm2delete, parentFolder, true);
  },
  
  deleteElement: function (aResource, aParent, renumber) {
    var container = BM.RDFC;
    container.Init(BMDS, aParent);
    container.RemoveElement(aResource,renumber);
    if (container.GetCount() == 0) {container.AppendElement(BM.BmEmptyRes);}
  },
    
  createNewResource: function(propertyValues, keepTimeStamp, resourceName, skipComplete) {
    if (!skipComplete) this.completeBMInfo(propertyValues);
    var newResource = resourceName ? BM.RDF.GetResource(resourceName):BM.RDF.GetAnonymousResource();
    var skipProps = keepTimeStamp ? 0:2;
     
    for (var i=0; i<BM.gBmProperties.length-skipProps; i++) {
      if (propertyValues[i] != null) {
        BMDS.Assert(newResource,BM.gBmProperties[i], BM.RDF.GetLiteral(replaceASCIIcontrolChars(propertyValues[i])),true);
      }
    }
    
    if ((propertyValues[TYPE] != "BookmarkSeparator")&&!keepTimeStamp) {
      var currentDate = new Date().toLocaleDateString();
      BMDS.Assert(newResource,BM.gBmProperties[CREATIONDATE], BM.RDF.GetLiteral(currentDate),true);
      BMDS.Assert(newResource,BM.gBmProperties[VISITEDDATE], BM.RDF.GetLiteral(currentDate),true);
    }
    
    if (propertyValues[TYPE] == "Folder") {
      //When importing it is possible that we could be running "createNewResource" on an already partially "created" (and un-empty) folder!
      if (BM.RDFCU.IsSeq(BMDS, newResource)) {return newResource;}
      BM.RDFCU.MakeSeq(BMDS,newResource);
      var container = BM.RDFC;
      container.Init(BMDS, newResource);
      container.AppendElement(BM.BmEmptyRes);
    }
    
    if (propertyValues[TYPE] == "Bookmark" || propertyValues[TYPE] == "Folder") {
      BMDS.Assert(newResource,BM.gBmProperties[NAMELOCALE],BM.RDF.GetLiteral(replaceASCIIcontrolChars(getLocale())),true);
      BMDS.Assert(newResource,BM.gBmProperties[NOTELOCALE],BM.RDF.GetLiteral(replaceASCIIcontrolChars(getLocale())),true);
    }
    return newResource;
  },
  
  addResourceToFolder: function (res, folderID, insertionIndex) {
    var parentFolderRes = BM.RDF.GetResource(folderID);
    if (BM.RDFCU.IsContainer(BMDS, parentFolderRes)) {
      if (insertionIndex == null) {insertionIndex = 1;}
      BM.RDFC.Init(BMDS, parentFolderRes);
      try {BM.RDFC.InsertElementAt(res,insertionIndex,true);}
      catch (er) {BM.RDFC.AppendElement(res); jsdump("WARNING: addResourceToFolder failed first InsertElementAt attempt!\n");}
      this.removeEmptyResFrom(folderID);
    }
  },
  
  appendResourceToFolder: function (res, folderID) {
    var parentFolderRes = BM.RDF.GetResource(folderID);
    BM.RDFC.Init(BMDS, parentFolderRes);
    BM.RDFC.AppendElement(res);
    this.removeEmptyResFrom(folderID);
  },
  
  getParentID: function (element) {
    var parentRes;
    try {
      parentRes = BM.RDF.GetResource(element.parentNode.parentNode.id);
      BM.RDFC.Init(BMDS, parentRes);
    }
    catch (er) {return BM.AllBookmarksID;}
    return parentRes.Value;
  },
    
  findIndexOf: function (elemID, parentID) {
    var elemResource = BM.RDF.GetResource(elemID);
    var parentFolderRes = BM.RDF.GetResource(parentID);
    BM.RDFC.Init(BMDS, parentFolderRes);
    return BM.RDFC.IndexOf(elemResource);
  },
  
  showPropertiesWindow: function (resourceID, editNote) {
    var value = {};
    openDialog("chrome://xulsword/content/bookmarks/bookmarksProperties.xul", "", "centerscreen,chrome,modal,resizable=no", resourceID, value, editNote);
    return value.ok;
  },
    
  updateToolTip: function (bmelem) {
    var info, text;
    try {
      info = this.BmGetInfo(bmelem.id);
      var directionChar = (VersionConfigs[info[MODULE]] && VersionConfigs[info[MODULE]].direction && VersionConfigs[info[MODULE]].direction=="rtl" ? String.fromCharCode(8207):String.fromCharCode(8206));
      text = info[BMTEXT].substr(0, TOOLTIP_LEN);
      text += (text.length==TOOLTIP_LEN ? "...":"");
      text = directionChar + text + directionChar;
      if (text.length < 4) {bmelem.removeAttribute("tooltip");}
      else {
        var tooltip = document.getElementById("bookmarkTTL");
        tooltip.setAttribute("value", text);
        tooltip.setAttribute("class", "vstyle" + info[MODULE]);
        bmelem.setAttribute("tooltip", "bookmarkTT");
      }
    }
    catch (er) {bmelem.removeAttribute("tooltip");}
  },
  
  BmGetInfo: function (bmelemID) {
    var infoArray = new Array(BM.gBmProperties.length);
    var bmres = BM.RDF.GetResource(bmelemID);
    for (var i=0; i<BM.gBmProperties.length; i++) {
      infoArray[i] = null;
      var targ = BMDS.GetTarget(bmres, BM.gBmProperties[i], true);
      if (!targ) continue;
      targ = targ.QueryInterface(Components.interfaces.nsIRDFLiteral);
      if (!targ) continue;
      infoArray[i] = targ.Value;
    }
    return infoArray;
  },

  gotoBookMark: function (bmelemID) {
    var info = this.BmGetInfo(bmelemID);
    var version = info[MODULE];
    var type = getModuleLongType(version);
    var failed = false;
    var link, lastvOrpar;
    if (!type) {
      if (!info[LOCATION]) failed = true;
      else {
        var aVersion = prefs.getCharPref("DefaultVersion");
        // for backward compatibility...
        // this try is because pre V2.8, LOCATION was undefined and old BMs may cause problems here.
        // NOTE that even with garbage in LOCATION, xulsword will likely return a valid location to somewhere...
        try {var loc = Location.convertLocation(WESTERNVS, info[LOCATION], Bible.getVerseSystem(aVersion)).split(".");}
        catch (er) {failed = true;}
        if (!failed) {
          prefs.setBoolPref("HighlightVerse", true); //type==BIBLE
          lastvOrpar = loc.pop();
          link = loc.join(".");
          version = aVersion;
        }
      }
    }
    else {
      switch (type) {
      case BIBLE:
      case COMMENTARY:
        link = info[BOOK] + "." + info[CHAPTER] + "." + info[VERSE];
        prefs.setBoolPref("HighlightVerse", true); //type==BIBLE
        lastvOrpar = (info[LASTVERSE] ? info[LASTVERSE]:null);
        break;
      case DICTIONARY:
      case GENBOOK:
        link = info[CHAPTER];
        lastvOrpar = info[VERSE];
        break;
      }
    }
    if (failed) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    else MainWindow.gotoLink(encodeUTF8(link), version, lastvOrpar);
  },
  
  removeEmptyResFrom: function (folderID) {
    var folderRes = BM.RDF.GetResource(folderID);
    if (BM.RDFCU.IsContainer(BMDS, folderRes)) {
      var container = BM.RDFC;
      container.Init(BMDS, folderRes);
      container.RemoveElement(BM.BmEmptyRes,true);
    }
  },
  
  isItemChildOf: function (itemRes, folderRes, aDS) {
    var parent = this.getParentOfResource(itemRes, aDS);
    while (parent) {
      if (parent == folderRes) {return true;}
      parent = this.getParentOfResource(parent, aDS);
    }
    return false;
  },
  
  getParentOfResource: function (aResource, aDS) {
    try {aResource = aResource.QueryInterface(BM.kRDFRSCIID);} catch(er) {return null;}
    var arcsIn = aDS.ArcLabelsIn(aResource);
    var parents = [];
    var myParent = null;    
    while (arcsIn.hasMoreElements()) {
      var arc = arcsIn.getNext();
      if (BM.RDFCU.IsOrdinalProperty(arc)) {
        var thisparent = aDS.GetSource(arc, aResource, true);
        parents.push(thisparent);
      }
    }

    var inFoundResults = false;
    for (var i=0; i<parents.length; i++) {
      if (parents[i] != BM.FoundResultsRes) {myParent = parents[i];}
      else {inFoundResults = true;} 
    }
    
    if ((parents.length > 2) || (parents.length == 2 && !inFoundResults)) {
      var str="";
      for (i=0; i<parents.length; i++) {str += i + ":" + parents[i].Value + "\n";}
      jsdump("WARNING: getParentOfResource, resource " + aResource.Value + " has more than one parent:\n" + str + "\n");
    }
    
    return myParent;
  },
  
  // This routine clones bookmarks and folders/children, but does NOT clone Immutables or EmptyRes
  cloneResource: function (aResource) {
    var type = BookmarksUtils.resolveType(aResource, BMDS);
    if (type == "ImmutableBookmark" || type == "ImmutableFolder") return aResource;
    if (aResource == BM.BmEmptyRes) return aResource;
        
    aResource = aResource.QueryInterface(BM.kRDFRSCIID);
    var myprops = this.BmGetInfo(aResource.Value);
    var newResource = this.createNewResource(myprops,true);
    if (BM.RDFCU.IsContainer(BMDS, aResource) && BookmarksUtils.resolveType(aResource, BMDS)=="Folder") {
      BM.RDFCU.MakeSeq(BMDS, newResource);
      this.removeEmptyResFrom(newResource.Value);
      var container = BM.RDFC;
      var newContainer = BM.RDFC;
      container.Init(BMDS, aResource);
      newContainer.Init(BMDS, newResource);
      var children = container.GetElements();
      var newchildren = [];
      while (children.hasMoreElements()) {
        var child = children.getNext();
        var newchild = {
          resource: this.cloneResource(child),
          index: BM.RDFCU.indexOf(BMDS, aResource, child)
        }
        newchildren.push(newchild);
      }
      newchildren.sort(function (a,b) {
        if (a.index == b.index) return 0;
        return a.index > b.index ? 1:-1;
      });
      
      for (var i=0; i<newchildren.length; i++) {
        if (newchildren[i].resource) newContainer.AppendElement(newchildren[i].resource);
      }
    }
    return newResource;
  },
  
  // 
  updateAttribute: function (aResource, aProperty, aOldValue, aNewValue, aDS) {
   if (!aDS) {aDS = BMDS;}
   if ((aOldValue || aNewValue) && aOldValue != aNewValue) {
      if (aOldValue && !aNewValue)
        aDS.Unassert(aResource, aProperty, aOldValue);
      else if (!aOldValue && aNewValue)
        aDS.Assert(aResource, aProperty, aNewValue, true);
      else /* if (aOldValue && aNewValue) */
        aDS.Change(aResource, aProperty, aOldValue, aNewValue);
      return true;
    }
    return false;
  },
  
  createAndCommitTxn: function (TxnType, aAction, aItem, aIndex, aParent, propLength, propArray) {
    var newTransaction = new nsITransaction(TxnType, aAction, aItem, aIndex, aParent, propLength, propArray);
    BM.gTxnSvc.doTransaction(newTransaction);
  },
  
  updateMainWindow: function (focusOnMainWindow, scrollFlag) {
    if (!MainWindow || Bible.paused) return;
    if (scrollFlag == null) scrollFlag = SCROLLTYPECENTER;
    if (focusOnMainWindow) MainWindow.focus();
    for (var i=1; i<=3; i++) {MainWindow.TextCache[i].text = null;} // force reread due to changed user-notes
    Texts.update(scrollFlag, HILIGHTVERSE, true);
  },
  
  getRandomString: function () {
    return String(Math.round(10000*Math.random()));
  },
  
  purgeDataSource: function (aDS) {
    var resources = aDS.GetAllResources();
    while (resources.hasMoreElements()){
      var resource = resources.getNext();
      if (resource == BM.BookmarksRootRes || 
          resource == BM.AllBookmarksRes || 
          resource == BM.BmEmptyRes ||
          resource == BM.FoundResultsRes) {continue;}
      if (this.isItemChildOf(resource, BM.AllBookmarksRes, aDS)) {continue;}
      this.removeResource(resource, aDS);
    }
    this.emptySearchResultsFolder();
    try {
      aDS = aDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
      aDS.Flush();
    }
    catch (er) {}
  },
  
  emptySearchResultsFolder: function () {
    var resultsFolder = BM.RDFC;
    resultsFolder.Init(BMDS, BM.FoundResultsRes);
    var srs = resultsFolder.GetElements();
    while (srs.hasMoreElements()) {resultsFolder.RemoveElement(srs.getNext(),false);}
  },
    
  removeResource: function (aResource, aDS) {
    var arcsOut = aDS.ArcLabelsOut(aResource);
    while (arcsOut.hasMoreElements()) {
      var thisarc = arcsOut.getNext();
      var targs = aDS.GetTargets(aResource, thisarc, true);
      while (targs.hasMoreElements()) {
        aDS.Unassert(aResource, thisarc, targs.getNext());
      }
    }
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
      jsdump("Bookmark bundle "+aStringKey+" not found!\n");
      bundle = "";
    }

    //bundle = bundle.replace(/%brandShortName%/, this._brandShortName);
    return bundle;
  },
  
  saveAs: function (aSelection) {
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
      
      const kTitle = fixWindowTitle(SBundle.getString("SaveAs"));
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

      var file = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsILocalFile);
      if (!file)
        return;
      file.initWithPath(lpath(fileName));
      if (!file.exists()) {
        file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);
      }
    }
    catch (e) {
      return;
    }
    
    writeFile(file, this.getFormattedBMdata(aSelection.item[0], false), true, "UTF-16");
  },
  
  getFormattedBMdata: function(afolder, isHTML) {
    var data= (isHTML ? "<div class=\"page vstyleProgram\">":"");
    var ret = (isHTML ? "<br>":TextFileReturn);
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
    
    var container = BM.RDFC;
    try {container.Init(BMDS, aFolder);} catch (er) {return data;}
    var folderElements = container.GetElements();
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
          if (isHTML) data += "<div class=\"vstyle" + BMDS.GetTarget(thisElem,BM.gBmProperties[MODULE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value + "\">";
          data += replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[BMTEXT],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value);
          data += sms + "[" + getCopyright(replaceASCIIcontrolChars(BMDS.GetTarget(thisElem,BM.gBmProperties[MODULE],true).QueryInterface(Components.interfaces.nsIRDFLiteral).Value)) + "]" + sme;
          data += ret;
          if (isHTML) data += "</div>";
        } catch (er) {}
      }
      if (datalast != data) {data += ret;}
    }
    return data;
  },
  
  importBMFile: function (aFile, aParentRes, overwrite) {
    var aParentResVal;
    if (!aParentRes) aParentResVal = BM.AllBookmarksID;
    else {
      try {aParentResVal = aParentRes.Value;}
      catch (er) {aParentResVal = BM.AllBookmarksID;}
    }
    var filedata = readFile(aFile);
    if (!filedata) return 0;

    var suffix = (overwrite ? "":BookmarkFuns.getRandomString());
    
    BM.gTxnSvc.beginBatch();
    
    var importedResources = [];
    filedata = replaceASCIIcontrolChars(filedata);
    var textBookmarks = filedata.split(BM.kExportResourceDelimiter);
    //Next 2 lines are for backward compatibility to pre V2.8 code
    var tmp = filedata.split("<nx/>\n");
    if (tmp.length > textBookmarks.length) textBookmarks = tmp;
    if (!textBookmarks.length) return 0;
    for (var bm=0; bm<textBookmarks.length; bm++) {
      if (!textBookmarks[bm]) continue;
      var propertyValues = textBookmarks[bm].split(BM.kExportDelimiter);
      var parentName = propertyValues.shift();
      var resourceName = propertyValues.shift() + suffix;
      var index = Number(propertyValues.shift());
      if (!index && index != 0) continue; // weed out junk data
      if (parentName == BM.AllBookmarksID) {parentName = aParentResVal;}
      else {parentName = parentName + suffix;}
      if (overwrite) {
        var todelete = BM.RDF.GetResource(resourceName);
        BookmarkFuns.removeResource(todelete, BMDS);
        var arcsIn = BMDS.ArcLabelsIn(todelete);
        while (arcsIn.hasMoreElements()) {
          var thisarc = arcsIn.getNext();
          var srcs = BMDS.GetSources(thisarc, todelete, true);
          while (srcs.hasMoreElements()) {
            BMDS.Unassert(srcs.getNext(), thisarc, todelete);
          }
        }
      }
      var newResource = this.createNewResource(propertyValues, true, resourceName, true);
      var newParent = BM.RDF.GetResource(parentName);
      if (!BM.RDFCU.IsContainer(BMDS, newParent)) {BM.RDFCU.MakeSeq(BMDS,newParent);}
      var resource = {
        parent: newParent,
        child: newResource,
        index: index
      }
      importedResources.push(resource);
    }
    
     importedResources.sort(function (a, b) {
      if (a.index == b.index) return 0;
      return a.index > b.index ? 1:-1;
    });
        
    for (var i=0; i<importedResources.length; i++) {
      BookmarkFuns.createAndCommitTxn("import", "import", importedResources[i].child, null, importedResources[i].parent, 0, null);
    }
    BM.gTxnSvc.endBatch();

    BookmarksUtils.flushDataSource();
    return importedResources.length;
  }
}

/************************************************************************
 * Bookmark Undo/Redo Functions...
 ***********************************************************************/ 
var TransactionTO;

function nsITransaction (TxnType, aAction, aItem, aIndex, aParent, propLength, propArray) {
  this.type = TxnType;
  this.item = aItem;
  this.action = aAction;
  this.index = aIndex;
  this.parent = aParent;
  this.propLength = propLength;
  this.propArray = propArray;
}

nsITransaction.prototype = {
  doTransaction: function () {
    switch (this.type) {
    case "insert":
      BookmarkFuns.addResourceToFolder(this.item, this.parent.Value, this.index);
      break;
    
    case "remove":
      BookmarkFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    
    case "import":
      BookmarkFuns.appendResourceToFolder(this.item, this.parent.Value);
      break;
    }
    try {window.clearTimeout(TransactionTO);} catch (er) {}
    TransactionTO = window.setTimeout("BookmarkFuns.updateMainWindow()",0);
  },
  
  merge: function () {
  },
  
  redoTransaction: function () {
    this.doTransaction();
  },
  
  undoTransaction: function () {
    switch (this.type) {
    case "insert":
      BookmarkFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    
    case "remove":
      BookmarkFuns.addResourceToFolder(this.item, this.parent.Value, this.index);
      break;
      
    case "import":
      BookmarkFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    }
    try {window.clearTimeout(TransactionTO);} catch (er) {}
    TransactionTO = window.setTimeout("BookmarkFuns.updateMainWindow()",0);
  }
}

var BM = {};
var BMDS = initBMServices(BM);
