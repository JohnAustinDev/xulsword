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
  bm.kExportResourceDelimiter = "<nx/>" + BMFileReturn;
    
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
      badRDF.moveTo(null, kUserDataFileName.replace(".rdf", String(Math.round(10000*Math.random())) + ".rdf"));
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
  
  var bookmarks = "chrome://xulsword/locale/bookmarks/bookmarks.properties";
  var b = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle(bookmarks);

  var oldValue = aDS.GetTarget(allBookmarksRes, bmProperties[NAME], true);
  var newValue = rdf.GetLiteral(b.GetStringFromName("BookmarksRoot"));
  ResourceFuns.updateAttribute(allBookmarksRes, bmProperties[NAME], oldValue, newValue, aDS);
  
  oldValue = aDS.GetTarget(bmEmptyRes, bmProperties[NAME], true);
  newValue = rdf.GetLiteral(b.GetStringFromName("emptyFolder"));
  ResourceFuns.updateAttribute(bmEmptyRes, bmProperties[NAME], oldValue, newValue, aDS);
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
  var file = getSpecialDirectory("DefRt");
  file.append(fileName);
  if (!file.exists()) {return null;}
  
  var filedata = readFile(file);
  
  return filedata;
}

BM = {};
BMDS = initBMServices(BM);
