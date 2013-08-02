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

ResourceFuns = {
  
  // skipComplete must be true if this function is called before the MainWindow loads!
  createNewResource: function(propertyValues, keepTimeStamp, resourceName, skipComplete) {
    if (!skipComplete) BookmarkFuns.completeBMInfo(propertyValues);
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
      BMDS.Assert(newResource,BM.gBmProperties[NAMELOCALE],BM.RDF.GetLiteral(getLocale()),true);
      BMDS.Assert(newResource,BM.gBmProperties[NOTELOCALE],BM.RDF.GetLiteral(getLocale()),true);
    }
    return newResource;
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
    try {aResource = aResource.QueryInterface(Components.interfaces.nsIRDFResource);} catch(er) {return null;}
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
      for (i=0; i<parents.length; i++) {str += i + ":" + parents[i].ValueUTF8 + "\n";}
      jsdump("WARNING: getParentOfResource, resource " + aResource.ValueUTF8 + " has more than one parent:\n" + str + "\n");
    }
    
    return myParent;
  },
  
  // This routine clones bookmarks and folders/children, but does NOT clone Immutables or EmptyRes
  cloneResource: function (aResource) {
    var type = BookmarksUtils.resolveType(aResource, BMDS);
    if (type == "ImmutableBookmark" || type == "ImmutableFolder") return aResource;
    if (aResource == BM.BmEmptyRes) return aResource;
        
    aResource = aResource.QueryInterface(Components.interfaces.nsIRDFResource);
    var myprops = this.BmGetInfo(aResource.ValueUTF8);
    var newResource = this.createNewResource(myprops,true);
    if (BM.RDFCU.IsContainer(BMDS, aResource) && BookmarksUtils.resolveType(aResource, BMDS)=="Folder") {
      BM.RDFCU.MakeSeq(BMDS, newResource);
      this.removeEmptyResFrom(newResource.ValueUTF8);
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
  
  createAndCommitTxn: function (TxnType, aAction, aItem, aIndex, aParent, propLength, propArray) {
    var newTransaction = new nsITransaction(TxnType, aAction, aItem, aIndex, aParent, propLength, propArray);
    BM.gTxnSvc.doTransaction(newTransaction);
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
    
    // get file's newline type
    var le = new RegExp(BM.kExportResourceDelimiter + "([\n\r]+)");
    var le = filedata.match(le);
    if (!le) {
      jsdump("ERROR: Could not determine type of line endings in \"" + aFile.path + "\"");
      return 0;
    }
    le = le[1];
    
    filedata = filedata.replace(BM.kExportResourceDelimiter + le, "<bMRet>", "g");
    filedata = replaceASCIIcontrolChars(filedata);
    filedata = filedata.replace("<bMRet>", BM.kExportResourceDelimiter, "g");

    var suffix = (overwrite ? "":String(Math.round(10000*Math.random())));
    
    try {BM.gTxnSvc.beginBatch(null);}
    catch (er) {BM.gTxnSvc.beginBatch();}
    
    var importedResources = [];
    var textBookmarks = filedata.split(BM.kExportResourceDelimiter);
    if (!textBookmarks.length) {
      jsdump("ERROR: No bookmark records");
      return 0;
    }
    for (var bm=0; bm<textBookmarks.length; bm++) {
      if (!textBookmarks[bm]) continue;
      var propertyValues = textBookmarks[bm].split(BM.kExportDelimiter);
      var parentName = propertyValues.shift();
      var resourceName = propertyValues.shift() + suffix;
      var index = Number(propertyValues.shift());
      if (!index && index != 0) continue; // weed out junk data
      if (parentName == BM.AllBookmarksID) {parentName = aParentResVal;}
      else {parentName = parentName + suffix;}
      
      // for backward compatibility to < version 3.5, change icon image URLs
      var icon = (propertyValues[0] && propertyValues[0] == "Folder" ? "":BM.gIcon.Texts); // default
      if (propertyValues[ICON]) {
        var type = propertyValues[ICON].match(/\/([^\/]+)\.png$/);
        if (type) {
          type = type[1];
          if ((/^(Texts|Comms|Dicts|Genbks)(WithNote)?$/).test(type)) {
            icon = icon.replace(/\/[^\/]+\.png$/, "/" + type + ".png"); // path changed but file names did not
          }
          else if (type == "Bookmarks-Note") icon = BM.gIconWithNote.Texts; // ancient variation
        }
      }
      propertyValues[ICON] = icon;
      
      // for backward compatibility to < version 3.5, the module name is at 
      // the start of GenBk chapter paths but it should be removed now
      // because internally, versions >= 3.5 do not expect it there.
      propertyValues[CHAPTER] = propertyValues[CHAPTER].replace(new RegExp("^\\/" + escapeRE(propertyValues[MODULE]) + "\\/"), "/");
     
      if (overwrite) {
        var todelete = BM.RDF.GetResource(resourceName);
        ResourceFuns.removeResource(todelete, BMDS);
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
      ResourceFuns.createAndCommitTxn("import", "import", importedResources[i].child, null, importedResources[i].parent, 0, null);
    }
    try {BM.gTxnSvc.endBatch(false);}
    catch (er) {BM.gTxnSvc.endBatch();}

    var remoteDS = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    setTimeout(function () {try {remoteDS.Flush();} catch (er) {}}, 100);
    
    return importedResources.length;
  }
  
};


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
      ResourceFuns.addResourceToFolder(this.item, this.parent.Value, this.index);
      break;
    
    case "remove":
      ResourceFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    
    case "import":
      ResourceFuns.appendResourceToFolder(this.item, this.parent.Value);
      break;
    }
    try {window.clearTimeout(TransactionTO);} catch (er) {}
    if (typeof(BookmarkFuns) != "undefined") 
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
      ResourceFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    
    case "remove":
      ResourceFuns.addResourceToFolder(this.item, this.parent.Value, this.index);
      break;
      
    case "import":
      ResourceFuns.deleteItemById(this.item.Value, this.parent.Value);
      break;
    }
    try {window.clearTimeout(TransactionTO);} catch (er) {}
    if (typeof(BookmarkFuns) != "undefined") 
        TransactionTO = window.setTimeout("BookmarkFuns.updateMainWindow()",0);
  }
};
