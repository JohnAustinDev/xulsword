/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
var gSearchBox;
var bookmarksView, bookmarksFolder;
////////////////////////////////////////////////////////////////////////////////
// Initialize the command controllers, set focus, tree root, 
// window title state, etc. 
function Startup()
{
  
  var windowNode = document.getElementById("bookmark-window");
  bookmarksView = document.getElementById("bookmarks-view");
  bookmarksFolder = document.getElementById("bookmark-folders-view");
  
  BookmarkFuns.initTemplateDataSource(document.getAnonymousElementByAttribute(bookmarksFolder, "anonid", "bookmarks-tree"), BMDS);
  BookmarkFuns.initTemplateDataSource(document.getAnonymousElementByAttribute(bookmarksView, "anonid", "bookmarks-tree"), BMDS);

  var titleString;

  titleString = BookmarksUtils.getLocaleString("bookmarks_title");
  // always open the bookmark root folder
  if (!bookmarksFolder.treeBoxObject.view.isContainerOpen(0))
    bookmarksFolder.treeBoxObject.view.toggleOpenState(0);

  document.title = fixWindowTitle(titleString);

  document.getElementById("CommandUpdate_Bookmarks").setAttribute("commandupdater","true");

  // These observers are needed because folder open/close properties are actually shared
  // between both trees (this seems like a bug and cannot be changed). So
  // the opposing tree row must also be rebuilt when a folder is opened/closed.
  bookmarksFolder.tree.builderView.addObserver(FolderTreeObserver);
  bookmarksView.tree.builderView.addObserver(BookmarkTreeObserver);
  
  if (getPrefOrCreate("BMfolderSelection", "Int", 0)>bookmarksFolder.tree.view.rowCount) prefs.setIntPref("BMfolderSelection", 0);
  bookmarksFolder.tree.view.selection.select(prefs.getIntPref("BMfolderSelection"));
  bookmarksFolder.focus();
  
  //setAllTwisties(true);
  
  BM.gTxnSvc.clear();
}

/*
function setAllTwisties(toOpen) {
  var treeview = bookmarksView.tree.view;
  var skipFirstRow = false;
  var finished;
  var maxlevel = 0;
  var firstRow = (skipFirstRow ? 1:0);
  while (!finished) {
    finished = true;
    for (var i=0; i<treeview.rowCount; i++) {
      if (treeview.getLevel(i)>maxlevel) maxlevel = treeview.getLevel(i);
      if (treeview.isContainer(i) && !treeview.isContainerOpen(i)) {
        treeview.toggleOpenState(i);
        finished = false;
      }
    }
  }

  if (toOpen) return;
  for (var l=maxlevel; l>=0; l--) {
    for (var i=firstRow; i<treeview.rowCount; i++) {
      if (treeview.getLevel(i)!=l) continue;
      if (treeview.isContainer(i) && treeview.isContainerOpen(i)) {
        treeview.toggleOpenState(i);
      }
    }
  }
}
*/

function Shutdown()
{
  // Store current window position and size in window attributes (for persistence).
  var win = document.getElementById("bookmark-window");
  win.setAttribute("x", screenX);
  win.setAttribute("y", screenY);
  win.setAttribute("height", outerHeight);
  win.setAttribute("width", outerWidth);
  
  var rangeMin = {};
  var rangeMax = {};
  bookmarksFolder.tree.view.selection.getRangeAt(0, rangeMin, rangeMax);
  if (rangeMin.value && rangeMin.value>=0)
      prefs.setIntPref("BMfolderSelection", rangeMin.value);
  
  bookmarksFolder.tree.builderView.removeObserver(FolderTreeObserver);
  bookmarksView.tree.builderView.removeObserver(BookmarkTreeObserver);
  
  BM.gTxnSvc.clear();
}

var gConstructedViewMenuSortItems = false;
function fillViewMenu(aEvent)
{
  var adjacentElement = document.getElementById("fill-before-this-node");
  var popupElement = aEvent.target;
  
  var columns = bookmarksView.columns;

  if (!gConstructedViewMenuSortItems) {
    for (var i = 0; i < columns.length; ++i) {
      var accesskey = columns[i].accesskey;
      var menuitem  = document.createElement("menuitem");
      var name      = BookmarksUtils.getLocaleString("SortMenuItem", columns[i].label);
      menuitem.setAttribute("label", name);
      menuitem.setAttribute("accesskey", columns[i].accesskey);
      menuitem.setAttribute("resource", columns[i].resource);
      menuitem.setAttribute("id", "sortMenuItem:" + columns[i].resource);
      menuitem.setAttribute("checked", columns[i].sortActive);
      menuitem.setAttribute("name", "sortSet");
      menuitem.setAttribute("type", "radio");
      
      popupElement.insertBefore(menuitem, adjacentElement);
    }
    
    gConstructedViewMenuSortItems = true;
  }  

  const kPrefSvcContractID = "@mozilla.org/preferences-service;1";
  const kPrefSvcIID = Components.interfaces.nsIPrefService;
  var prefSvc = Components.classes[kPrefSvcContractID].getService(kPrefSvcIID);
  var bookmarksSortPrefs = prefSvc.getBranch("browser.bookmarks.sort.");

  if (gConstructedViewMenuSortItems) {
    try {var resource = bookmarksSortPrefs.getCharPref("resource");}
    catch (er) {resource = null;}
    if (resource) {
      var element = document.getElementById("sortMenuItem:" + resource);
      if (element) element.setAttribute("checked", "true");
    }
  }  

  var sortAscendingMenu = document.getElementById("ascending");
  var sortDescendingMenu = document.getElementById("descending");
  var noSortMenu = document.getElementById("natural");
  
  sortAscendingMenu.setAttribute("checked", "false");
  sortDescendingMenu.setAttribute("checked", "false");
  noSortMenu.setAttribute("checked", "false");
  try {var direction = bookmarksSortPrefs.getCharPref("direction");}
  catch (er) {direction = "unknown";}
  if (direction == "natural")
    sortAscendingMenu.setAttribute("checked", "true");
  else if (direction == "ascending") 
    sortDescendingMenu.setAttribute("checked", "true");
  else
    noSortMenu.setAttribute("checked", "true");
}

function onViewMenuSortItemSelected(aEvent)
{
  var resource = aEvent.target.getAttribute("resource");
  
  const kPrefSvcContractID = "@mozilla.org/preferences-service;1";
  const kPrefSvcIID = Components.interfaces.nsIPrefService;
  var prefSvc = Components.classes[kPrefSvcContractID].getService(kPrefSvcIID);
  var bookmarksSortPrefs = prefSvc.getBranch("browser.bookmarks.sort.");

  switch (resource) {
  case "":
    break;
  case "direction":
    if (aEvent.target.id == "ascending")
      bookmarksSortPrefs.setCharPref("direction", "natural");
    else if (aEvent.target.id == "descending")
      bookmarksSortPrefs.setCharPref("direction", "ascending");
    else
      bookmarksSortPrefs.setCharPref("direction", "descending");
    break;
  default:
    bookmarksSortPrefs.setCharPref("resource", resource);
    try {var direction = bookmarksSortPrefs.getCharPref("direction");}
    catch (er) {
      bookmarksSortPrefs.setCharPref("direction", "natural");
      direction = "natural";
    }
    if (direction == "descending")
      bookmarksSortPrefs.setCharPref("direction", "natural");
    break;
  }

  aEvent.stopPropagation();
}  

var gConstructedColumnsMenuItems = false;
function fillColumnsMenu(aEvent) 
{
  var columns = bookmarksView.columns;
  var i;

  if (!gConstructedColumnsMenuItems) {
    for (i = 0; i < columns.length; ++i) {
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", columns[i].label);
      menuitem.setAttribute("resource", columns[i].resource);
      menuitem.setAttribute("id", "columnMenuItem:" + columns[i].resource);
      menuitem.setAttribute("type", "checkbox");
      menuitem.setAttribute("checked", columns[i].hidden != "true");
      aEvent.target.appendChild(menuitem);
    }

    gConstructedColumnsMenuItems = true;
  }
  else {
    for (i = 0; i < columns.length; ++i) {
      var element = document.getElementById("columnMenuItem:" + columns[i].resource);
      if (element && columns[i].hidden != "true")
        element.setAttribute("checked", "true");
    }
  }
  
  aEvent.stopPropagation();
}

function onViewMenuColumnItemSelected(aEvent)
{
  var resource = aEvent.target.getAttribute("resource");
  if (resource != "") {
    bookmarksView.toggleColumnVisibility(resource);
  }  

  aEvent.stopPropagation();
}

var gColElements = [
"Name",
/*"Loc",*/
"Note",
"VerseText",
"CreationDate",
"LastVisitDate"
];

var gConstructedSearchMenuItems = false;
function fillSearchMenu(aEvent) 
{
  var columns = bookmarksView.columns;
  var i;

  if (!gConstructedSearchMenuItems) {
    for (i = 0; i < gColElements.length; ++i) {
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", columns[i].label);
      menuitem.setAttribute("resource", columns[i].resource);
      menuitem.setAttribute("id", "columnMenuItem:" + columns[i].resource);
      menuitem.setAttribute("type", "checkbox");
      var tprefv = prefs.getBoolPref("searchFlag-" + columns[i].resource);
      menuitem.setAttribute("checked", tprefv);

      aEvent.target.appendChild(menuitem);
    }

    gConstructedSearchMenuItems = true;
  }
  else {
    for (i = 0; i < columns.length; ++i) {
      var element = document.getElementById("columnMenuItem:" + columns[i].resource);
      element.setAttribute("checked", prefs.getBoolPref("searchFlag-" + columns[i].resource));
    }
  }
  
  aEvent.stopPropagation();
}

function onSearchMenuColumnItemSelected(aEvent)
{
  var resource = aEvent.target.getAttribute("resource");
  if (resource != "") {
    var element = document.getElementById("columnMenuItem:" + resource);
    var pname = "searchFlag-" + resource;
    var newval = !prefs.getBoolPref(pname);
    if (newval || numberOfSearchColumnsSelected()>1) {
      prefs.setBoolPref(pname, newval);
      BookmarksUtils.refreshSearch();
    }
  }
  
  aEvent.stopPropagation();
  //window.setTimeout(fuction () {document.getElementById("searchinPopup").showPopup(null,-1,-1,"popup");},0);

}

function numberOfSearchColumnsSelected() {
  var columns = bookmarksView.columns;
  var cnt=0;
  for (var i = 0; i < columns.length; ++i) {if (prefs.getBoolPref("searchFlag-" + columns[i].resource)) {cnt++;}}
  return cnt;
}

function onViewSelected(aEvent)
{
  var statusBar = document.getElementById("statusbar-text");
  var displayValue;
  var selection = aEvent.target.getTreeSelection();

  if (selection.length == 0)
      return;

  if (aEvent.target.id == "bookmark-folders-view" && selection) {
    var rangeMin = {};
    var rangeMax = {};
    aEvent.target.treeBoxObject.view.selection.getRangeAt(0, rangeMin, rangeMax);
    var mysel = rangeMin.value;
    window.setTimeout(function () {BookmarksUtils.FolderSelection = mysel;}, 0); //Save selection as late as possible in thread
    bookmarksView.tree.setAttribute("ref",selection.item[0].ValueUTF8);
  }
  
  if (statusBar && selection.length == 1) {
    if (selection.isContainer[0]) {
      BM.RDFC.Init(aEvent.target.db, selection.item[0]);
      var count = 0;
      var children = BM.RDFC.GetElements();
      while (children.hasMoreElements()) {
        if (BookmarksUtils.resolveType(children.getNext()) != "BookmarkSeparator")
          count++;
      }

      displayValue = BookmarksUtils.getLocaleString("status_foldercount", dString(count));
    }
    else if (selection.type[0] == "Bookmark")
      displayValue = BookmarksUtils.getProperty(selection.item[0], BM.gNC_NS+"Name", aEvent.target.db)
    else
      displayValue = "";
    statusBar.label = displayValue;
  }
}

function goToggleToolbar( id, elementID )
{
  var toolbar = document.getElementById(id);
  var element = document.getElementById(elementID);
  if (toolbar)
  {
    var isHidden = toolbar.hidden;
    toolbar.hidden = !isHidden;
    document.persist(id, 'hidden');
    if (element) {
      element.setAttribute("checked", isHidden ? "true" : "false");
      document.persist(elementID, 'checked');
    }
  }
}

var FolderTreeObserver = {
  onToggleOpenState : function(rowIndex) {
    updateTreeResource(bookmarksFolder.tree.builderView.getResourceAtIndex(rowIndex), "bookmarks-view");
  },
  canDrop : function(index, orientation) {},
  onCycleCell : function(row, colID) {},
  onCycleHeader : function(colID, elt) {},
  onDropr : function(row, orientation) {},
  onPerformAction : function(action) {},
  onPerformActionOnCell : function(action, row, colID) {},
  onPerformActionOnRow : function(action, row) {},
  onSelectionChanged : function() {}
}

var BookmarkTreeObserver = {
  onToggleOpenState : function(rowIndex) {
    updateTreeResource(bookmarksView.tree.builderView.getResourceAtIndex(rowIndex), "bookmark-folders-view");
  },
  canDrop : function(index, orientation) {},
  onCycleCell : function(row, colID) {},
  onCycleHeader : function(colID, elt) {},
  onDropr : function(row, orientation) {},
  onPerformAction : function(action) {},
  onPerformActionOnCell : function(action, row, colID) {},
  onPerformActionOnRow : function(action, row) {},
  onSelectionChanged : function() {}
}

function updateTreeResource(aResource, aID) {
  var treelem = document.getElementById(aID);
  var row = treelem.tree.builderView.getIndexOfResource(aResource);
  if (row<0) return;
  //Can't seem to rebuild just one row in this implementation...
  //window.setTimeout(function () {document.getElementById(aID).tree.treeBoxObject.invalidateRow(row);}, 0);
  window.setTimeout(function () {document.getElementById(aID).tree.builder.rebuild();}, 0);
}
