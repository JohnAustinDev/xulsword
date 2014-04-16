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

function initBMServices(bm) {
  bm.RDF              = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
  bm.kRDFCContractID  = "@mozilla.org/rdf/container;1";
  // bm.RDFC is a single instance and must never be treated as a factory
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
    bm.gIcon[type]          = "chrome://xulsword/skin/images/" + type + ".png";
    bm.gIconWithNote[type]  = "chrome://xulsword/skin/images/" + type + "WithNote.png";
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
                        bm.RDF.GetResource(bm.gNC_NS+"ModuleName"),
                        bm.RDF.GetResource(bm.gNC_NS+"Location"),
                        bm.RDF.GetResource(bm.gNC_NS+"VerseText"),
                        bm.RDF.GetResource(bm.gNC_NS+"Icon"),
                        bm.RDF.GetResource(bm.gNC_NS+"CreationDate"),
                        bm.RDF.GetResource(bm.gNC_NS+"ModifiedDate"),
                        bm.RDF.GetResource(bm.gNC_NS+"NameLocale"),
                        bm.RDF.GetResource(bm.gNC_NS+"NoteLocale")];
                       
  bm.kBATCH_LIMIT = 4;
  bm.kExportDelimiter = "<bg/>";
  bm.kExportResourceDelimiter = "<nx/>";
    
  initBookmarksDataFile(false);
  var bmds = getBookmarkData(bm.RDF);
  //initBookmarksLocale(bm, bmds);
  return bmds;
}

function initBookmarksDataFile(useEmptyDataSet) {
  var rdfFile = getSpecialDirectory("xsBookmarks");
  rdfFile.append(kUserDataFileName);

  UserDataURI = encodeURI("File://" + rdfFile.path.replace("\\", "/", "g"));

  if (!rdfFile.exists()) {
    var data = "";
    if (useEmptyDataSet) {data = getEmptyUserData();}
    else {
      data = getDefaultUserData("bookmarks.rdf");
      if (!data) {data = getEmptyUserData();}
    }
    writeSafeFile(rdfFile, data, true);
  }
}

function getBookmarkData(rdf) {
  var myDS=null;
  var DSisGood=false;
  try {
    myDS = rdf.GetDataSourceBlocking(UserDataURI); 
    DSisGood = true;
  }
  catch (er) {
    var badRDF = getSpecialDirectory("xsBookmarks");
    badRDF.append(kUserDataFileName);
    if (badRDF.exists()) {
      badRDF.moveTo(null, kUserDataFileName.replace(".rdf", String(Math.round(10000*Math.random())) + ".rdf"));
      initBookmarksDataFile(true);
      myDS = rdf.GetDataSourceBlocking(UserDataURI);
    }
  }

  if (DSisGood) {
    
    // For backward compatibility, convert Version < 3.5 .rdf contents
    var resources = myDS.GetAllResources();
    while (resources.hasMoreElements()) {
      var res = resources.getNext();
      
      // change icon paths
      if (myDS.hasArcOut(res, BM.RDF.GetResource(BM.gNC_NS+"Icon"))) {
        var oldval = myDS.GetTarget(res, BM.RDF.GetResource(BM.gNC_NS+"Icon"), true);
        var newval = oldval.QueryInterface(Components.interfaces.nsIRDFLiteral).
            Value.replace("chrome://xulsword/skin/bookmarks/", "chrome://xulsword/skin/images/");
        if (newval != oldval.QueryInterface(Components.interfaces.nsIRDFLiteral).Value) {
          newval = BM.RDF.GetLiteral(newval);
          myDS.Change(res, BM.RDF.GetResource(BM.gNC_NS+"Icon"), oldval, newval);
        }
      }
      
      // change "Version" attribute to "ModuleName"
      if (myDS.hasArcOut(res, BM.RDF.GetResource(BM.gNC_NS+"Version"))) {
        var val = myDS.GetTarget(res, BM.RDF.GetResource(BM.gNC_NS+"Version"), true);
        myDS.Unassert(res, BM.RDF.GetResource(BM.gNC_NS+"Version"), val);
        myDS.Assert(res, BM.gBmProperties[MODULE], val, true);
      }
      
    }
    
    // Back up this DS now
    var bmdir = getSpecialDirectory("xsBookmarks");
    var goodDS = bmdir.clone(); goodDS.append(kUserDataFileName);
    var backup = bmdir.clone(); backup.append(kUserDataBackupName);
    if (backup.exists()) removeFile(backup, false);
    goodDS.copyTo(bmdir, kUserDataBackupName);
  }
  
  return myDS;
}

function initBookmarksLocale() {
  var mod = prefs.getCharPref("DefaultVersion");
  
  // if our locale has associated modules, see if one of them is 
  // installed and use it if possible
  var mods = LocaleConfigs[getLocale()].AssociatedModules;
  mods = (mods ? mods.split(/\s*,\s*/):[null]);
  for (var i=0; i<mods.length; i++) {
    if (!mods[i] || !Tab.hasOwnProperty(mods[i])) continue;
    mod = mods[i];
    break;
  }
  
  var b = getCurrentLocaleBundle("bookmarks/bookmarks.properties");
  
  var update = {};
  
  // list new values of attributes of special bookmarks that need to be localized
  update[BM.AllBookmarksID] = { attribs:[NAME],         vals:[b.GetStringFromName("BookmarksRoot")] };
  update[BM.BmEmptyID]      = { attribs:[NAME],         vals:[b.GetStringFromName("emptyFolder")] };
  
  // localize the default bookmarks in defaults/bookmarks.rdf
  update.example_usernote   = { attribs:[NOTE],         vals:[b.GetStringFromName("exampleDescription")] };
  update.example_folder     = { attribs:[NAME, NOTE],   vals:[b.GetStringFromName("exampleFolder"), b.GetStringFromName("exampleDescription")] };
  update.example_1          = { attribs:[NAME],         vals:[b.GetStringFromName("exampleSubFolder1")] };
  update.example_1_1        = {};
  update.example_1_2        = {};
  update.example_1_3        = {};
  update.example_1_4        = {};
  update.example_1_5        = {};
  update.example_1_6        = {};
  update.example_1_7        = {};
  update.example_1_8        = {};
  update.example_2          = { attribs:[NAME],         vals:[b.GetStringFromName("exampleSubFolder2")] };
  update.example_2_1        = {};
  update.example_2_2        = {};
  update.example_2_3        = {};
  update.example_2_4        = {};

  for (var bmid in update) {
    var newBM = update[bmid];
    if (bmid.indexOf("http") != 0) bmid = "rdf:#" + bmid;
    if (!newBM.hasOwnProperty("attribs")) {newBM.attribs = []; newBM.vals = [];}
    
    // just bail if this bookmark doesn't exist or was deleted
    if (!BMDS.ArcLabelsOut(BM.RDF.GetResource(bmid)).hasMoreElements()) continue;
    
    var info = ResourceFuns.BmGetInfo(bmid);
    
    if (info[TYPE] == "Bookmark") {
			
			// translate this bookmark's location into the new module's verse system if necessary
			var toLoc = info[LOCATION];
			var toVsys = LibSword.getVerseSystem(mod);
			if (toVsys != "KJV") toLoc = LibSword.convertLocation("KJV", toLoc, toVsys);
			
			// (re)set location attributes
			toLoc = toLoc.split(".");
			newBM.attribs.push(MODULE);    newBM.vals.push(mod);
			newBM.attribs.push(BOOK);      newBM.vals.push(toLoc[0]);
			newBM.attribs.push(CHAPTER);   newBM.vals.push(toLoc[1]);
			newBM.attribs.push(VERSE);     newBM.vals.push(toLoc[2]);
			newBM.attribs.push(LASTVERSE); newBM.vals.push(toLoc.length > 3 ? toLoc[3]:toLoc[2]);
		}
		
    // now write all new values from our update object
    for (var i=0; i<newBM.attribs.length; i++) {
      info[newBM.attribs[i]] = newBM.vals[i];
    }

    // now update dependencies
    var clear = [BMTEXT, ICON, CREATIONDATE, NAMELOCALE, NOTELOCALE];
    if (info[TYPE] == "Bookmark") clear.push(NAME);
    for (var i=0; i<clear.length; i++) {info[clear[i]] = null;}
    BookmarkFuns.completeBMInfo(info);
    
    // write our updated bookmark info
    BookmarkFuns.updateBookmarkProperties(bmid, info);
  }
  
  // flush the bookmark database
  BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
}

function getEmptyUserData() {
var data = "\
<?xml version=\"1.0\"?>\n\
<RDF:RDF xmlns:BOOKMARKS=\"http://www.xulsword.com/bookmarks/rdf#\"" + NEWLINE + "\
         xmlns:NC=\"http://home.netscape.com/NC-rdf#\"" + NEWLINE + "\
         xmlns:RDF=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" + NEWLINE + "\
" + NEWLINE + "\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/BookmarksRoot\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/AllBookmarks\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
" + NEWLINE + "\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/AllBookmarks\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/emptyBookmark\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
" + NEWLINE + "\
  <RDF:Seq RDF:about=\"http://www.xulsword.com/bookmarks/FoundResults\">" + NEWLINE + "\
    <RDF:li RDF:resource=\"http://www.xulsword.com/bookmarks/emptyBookmark\"/>" + NEWLINE + "\
  </RDF:Seq>" + NEWLINE + "\
" + NEWLINE + "\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/BookmarksRoot\" BOOKMARKS:Type=\"Folder\" BOOKMARKS:Name=\"Bookmarks Root\"/>" + NEWLINE + "\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/AllBookmarks\" BOOKMARKS:Type=\"Folder\"/>" + NEWLINE + "\
  <Description RDF:about=\"http://www.xulsword.com/bookmarks/emptyBookmark\" BOOKMARKS:Type=\"EmptyBookmark\"/>" + NEWLINE + "\
</RDF:RDF>" + NEWLINE + "\
";
return data;
}

function getDefaultUserData(fileName) {
  var file = getSpecialDirectory("xsDefaults");
  file.append(fileName);
  if (!file.exists()) {return null;}
  
  var filedata = readFile(file);
  
  return filedata;
}
