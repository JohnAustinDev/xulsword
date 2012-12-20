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

/**
 * Add Bookmark Dialog. 
 * ====================
 * 
 * This is a generic bookmark dialog that allows for bookmark addition
 * and folder selection. It can be opened with various parameters that 
 * result in appearance/purpose differences and initial state. 
 * 
 * Use: Open with 'openDialog', with the flags 
 *        'centerscreen,chrome,dialog=no,resizable=yes'
 * 
 * Parameters: 
 *   Apart from the standard openDialog parameters, this dialog can 
 *   be passed additional information, which is contained in the 
 *   wArg object:
 *  
 *   wArg.name              : Bookmark Name. The value to be prefilled
 *                            into the "Name: " field (if visible).
 *   wArg.address           : Bookmark address. The value to be added
 *                          : to the boomarks address field.
 *   wArg.note              
 *   wArg.folderURI         : Bookmark Folder. The RDF Resource URI of the
 *                            folder that this bookmark should be created in.
 */

var gSelectedFolder;
var gName;
var gNote;
var gVerseText;
var gExpander;
var gExpanderTTL;
var gMenulist;
var gBookmarksTree;
var gArg = window.arguments[0];
var gReturn = window.arguments[1];
var gResource;

var WSucks;

function Startup()
{

  AllWindows.push(window);

  BookmarkFuns.initTemplateDataSource(document.getElementById("folderPopup"), BMDS);
  BookmarkFuns.initTemplateDataSource(document.getAnonymousElementByAttribute(document.getElementById("folder-tree"), "anonid", "bookmarks-tree"), BMDS);
  
  gName = document.getElementById("name");
  gNote = document.getElementById("note");
  gVerseText = document.getElementById("versetext");
  gExpander = document.getElementById("expander");
  gExpanderTTL = document.getElementById("expanderTTL");
  gMenulist = document.getElementById("select-menu");
  gBookmarksTree = document.getElementById("folder-tree");
  
  gName.value = gArg.name;
  
  if (gArg.selectNoteFlag) {
    gNote.select();
    gNote.focus();
  }
  else {
    gMenulist.focus();
    document.getElementById("noterow").setAttribute("hidden",true);
  }

  sizeToContent();
 
  var title = BookmarksUtils.getLocaleString("ile_newbookmark");
  if (getLocale() == DEFAULTLOCALE) title += " \"" + gName.value + "\"";
  document.title = fixWindowTitle(title);
  
  gExpanderTTL.setAttribute("value", gExpander.getAttribute("tooltiptextdown"));

  WSucks = parseInt(gBookmarksTree.getAttribute("height"));
  if (!WSucks)
    WSucks = 150;

  // fix no more persisted class attribute in old profiles
  var localStore = BM.RDF.GetDataSource("rdf:local-store");
  var rAttribute = BM.RDF.GetResource("class");
  var rElement   = BM.RDF.GetResource("chrome://xulsword/content/bookmarks/addBookmark2.xul#expander");
  var rDialog    = BM.RDF.GetResource("chrome://xulsword/content/bookmarks/addBookmark2.xul");
  var rPersist   = BM.RDF.GetResource(BM.gNC_NS+"persist");
  
  var rOldValue = localStore.GetTarget(rElement, rAttribute, true);
  if (rOldValue) {
    localStore.Unassert(rElement, rAttribute, rOldValue, true);
    localStore.Unassert(rDialog, rPersist, rElement, true);
    gExpander.setAttribute("class", "down");
  }
  
  gVerseText.value = gArg.text.text;
  gVerseText.className = "cs-" + gArg.text.location.version;
  
  // Select the specified folder after the window is made visible
  function initMenulist() {
    if ("folderURI" in gArg) {
      var folderItem = document.getElementById(gArg.folderURI);
      if (folderItem)
        gMenulist.selectedItem = folderItem;
    }
    else {gMenulist.selectedIndex = 0;}
    gSelectedFolder = BM.RDF.GetResource(gMenulist.selectedItem.id);
  }
  setTimeout(initMenulist, 0);
  
}

function onOK()
{
  gReturn.name = gName.value;
  gReturn.note = gNote.value;
  gReturn.chosenFolderID = gSelectedFolder.Value;
  gReturn.ok = true;

  // in insertSelection, the ds flush is delayed. It will never be performed,
  // since this dialog is destroyed before.
  // We have to flush manually

  var remote = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  if (remote) {remote.Flush();}
}

function onCancel()
{
  return true;
}

function selectMenulistFolder(aEvent)
{
  gSelectedFolder = BM.RDF.GetResource(aEvent.target.id);
  if (!gBookmarksTree.collapsed)
    selectFolder(gSelectedFolder);
}

function selectTreeFolder()
{
  // If no item is selected, we obviously can't do anything with the selection.
  // This happens when the bookmarks tree rebuilds, since the rebuild starts
  // by removing all items from the tree, including the currently selected item,
  // and removing the selection also triggers the "select" handler which calls
  // this function.
  if (gBookmarksTree.currentIndex == -1)
    return;

  var resource = gBookmarksTree.currentResource;
  if (resource == gSelectedFolder)
    return;
  gSelectedFolder = resource;
  var menuitem = document.getElementById(gSelectedFolder.Value);
  gMenulist.selectedItem = menuitem;
  if (!menuitem) {
    gMenulist.removeItemAt(gMenulist.firstChild.childNodes.length-1);
    var newItem = gMenulist.appendItem(BookmarksUtils.getProperty(gSelectedFolder, BM.gNC_NS+"Name"), gSelectedFolder.Value);
    newItem.setAttribute("class", "menuitem-iconic folder-icon");
    newItem.setAttribute("id", gSelectedFolder.Value);
    gMenulist.selectedItem = newItem;
  }
}

function selectFolder(aFolder)
{
  gBookmarksTree.treeBoxObject.view.selection.selectEventsSuppressed = true;
  gBookmarksTree.treeBoxObject.view.selection.clearSelection();
  gBookmarksTree.selectResource(aFolder);
  var index = gBookmarksTree.currentIndex;
  gBookmarksTree.treeBoxObject.ensureRowIsVisible(index);
  gBookmarksTree.treeBoxObject.view.selection.selectEventsSuppressed = false;
}

function expandTree()
{
  setFolderTreeHeight();
  var willCollapse = !gBookmarksTree.collapsed;
  gExpander.setAttribute("class",willCollapse?"down":"up");
  gExpanderTTL.setAttribute("value", gExpander.getAttribute("tooltiptext"+(willCollapse?"down":"up")));
  if (willCollapse) {
    document.documentElement.buttons = "accept,cancel";
    WSucks = gBookmarksTree.boxObject.height;
    gMenulist.selectedIndex = 0;
    gSelectedFolder = BM.RDF.GetResource(gMenulist.selectedItem.id);
  } else {
    document.documentElement.buttons = "accept,cancel,extra2";
    if (!gBookmarksTree.treeBoxObject.view.isContainerOpen(0)) gBookmarksTree.treeBoxObject.view.toggleOpenState(0);
    selectFolder(gSelectedFolder);
    gBookmarksTree.focus();
  }
  gBookmarksTree.collapsed = willCollapse;
  resizeTo(window.outerWidth, window.outerHeight+(willCollapse?-WSucks:+WSucks));
}

function setFolderTreeHeight()
{
  var isCollapsed = gBookmarksTree.collapsed;
  if (!isCollapsed)
    gBookmarksTree.setAttribute("height", gBookmarksTree.boxObject.height);
}

function newFolder()
{
  gBookmarksTree.focus();
  var parentRes = BM.RDF.GetResource(gMenulist.selectedItem.id);
  var target = {parent: parentRes, index: 1}
  BookmarksCommand.createNewFolder(target);
}
