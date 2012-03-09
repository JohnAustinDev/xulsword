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
 

var BookmarksMenu = {
  _selection:null,
  _target:null,
  _orientation:null,

  //////////////////////////////////////////////////////////////////////////
  // Fill a context menu popup with menuitems appropriate for the current
  // selection.
  createContextMenu: function (aEvent)
  {
    var target = document.popupNode;

    if (!this.isBTBookmark(target.id)) {
      target.removeAttribute("open");
      return false;
    }
    
    var targettype = BookmarksUtils.resolveType(target.id);

    if (targettype == "ImmutableFolder") {
      // no context; see bug#... (popups getting stuck because "open"
      // attribute doesn't get removed)
      target.removeAttribute("open");
      return false;
    }

    // -moz-user-focus: ignore; is set on toolbars
    //document.getElementById("PersonalToolbar").focus();

    this._selection   = this.getBTSelection(target);
    this._orientation = this.getBTOrientation(aEvent, target);
    // Don't let commands target the contents of folders, rather target before folders
    if (this._orientation == BookmarksUtils.DROP_ON) this._orientation = BookmarksUtils.DROP_BEFORE;
    if (RDF.GetResource(target.id)==BmEmptyRes || targettype != "ImmutableBookmark")
      this._target = this.getBTTarget(target, this._orientation);

    // walk up the tree until we find a database node
    var p = target;
    while (p && !p.database)
      p = p.parentNode;
    if (p)
      this._db = p.database;

    if (targettype == "Folder") target.firstChild.hidePopup(); //Added for xulrunner 1.9pre. Open menupopup forced selection to null!
    BookmarksCommand.createContextMenu(aEvent, this._selection, this._db);
    this.onCommandUpdate();
    aEvent.target.addEventListener("mousemove", BookmarksMenuController.onMouseMove, false);
    return true;
  },

  /////////////////////////////////////////////////////////////////////////
  // Clean up after closing the context menu popup
  destroyContextMenu: function (aEvent)
  {
    // note that this method is called after doCommand.
    // let's focus the content and dismiss the popup chain (needed when the user
    // type escape or if he/she clicks outside the context menu)

    BookmarksMenuDNDObserver.onDragRemoveFeedBack(document.popupNode);
/*    
    if (content)
      content.focus();
*/
    // XXXpch: see bug 210910, it should be done properly in the backend
    BookmarksMenuDNDObserver.mCurrentDragOverTarget = null;
    BookmarksMenuDNDObserver.onDragCloseTarget();

    // if the user types escape, we need to remove the feedback
    BookmarksMenuDNDObserver.onDragRemoveFeedBack(document.popupNode);

    aEvent.target.removeEventListener("mousemove", BookmarksMenuController.onMouseMove, false);

    this._target = null;
    this._selection = null;
  },

  /////////////////////////////////////////////////////////////////////////////
  // returns the formatted selection from aNode
  getBTSelection: function (aNode)
  {
    var item;
    switch (aNode.id) {
    case "bookmarks-menu":
      item = AllBookmarksID;
      break;
    default:
      item = aNode.id;
      if (!this.isBTBookmark(item))
        return {length:0};
    }
    var parent           = this.getBTContainer(aNode);
    var isExpanded       = aNode.hasAttribute("open") && aNode.open;
    var selection        = {};
    selection.item       = [RDF.GetResource(item)];
    selection.parent     = [RDF.GetResource(parent)];
    selection.isExpanded = [isExpanded];
    selection.length     = selection.item.length;
    BookmarksUtils.checkSelection(selection);
    return selection;
  },

  /////////////////////////////////////////////////////////////////////////
  // returns the insertion target from aNode
  getBTTarget: function (aNode, aOrientation)
  {
    var item, parent, index;
    switch (aNode.id) {

    case "bookmarks-menu":
      parent = AllBookmarksID;
      break;

    default:
      if (aOrientation == BookmarksUtils.DROP_ON)
        parent = aNode.id
      else {
        parent = this.getBTContainer(aNode);
        item = aNode;
      }
    }

    parent = RDF.GetResource(parent);
    if (aOrientation == BookmarksUtils.DROP_ON)
      return BookmarksUtils.getTargetFromFolder(parent);

    if (!item.id) return null;
    item = RDF.GetResource(item.id);
    RDFC.Init(BMDS, parent);
    index = RDFC.IndexOf(item);
    if (aOrientation == BookmarksUtils.DROP_AFTER)
      ++index;

    return { parent: parent, index: index };
  },

  /////////////////////////////////////////////////////////////////////////
  // returns the parent resource of a node in the personal toolbar.
  // this is determined by inspecting the source element and walking up the 
  // DOM tree to find the appropriate containing node.
  getBTContainer: function (aNode)
  {
    var parent;
    var item = aNode.id;
    if (!this.isBTBookmark(item))
      return AllBookmarksID;
    parent = aNode.parentNode.parentNode;
    parent = parent.id;
    switch (parent) {
    case "bookmarks-stack":
    case "bookmarks-toolbar":
      return BMSVC.getBookmarksToolbarFolder().Value;
    case "bookmarks-menu":
      return AllBookmarksID;
    default:
      return parent;
    }
  },

  ///////////////////////////////////////////////////////////////////////////
  // returns true if the node is a bookmark, a folder or a bookmark separator
  isBTBookmark: function (aURI)
  {
    if (!aURI || aURI == "bookmarkAllCmd")
      return false;
    var type = BookmarksUtils.resolveType(aURI);
    return (type == "BookmarkSeparator"     ||
            type == "Bookmark"              ||
            type == "Folder"                ||
            type == "PersonalToolbarFolder" ||
            type == "Livemark"              ||
            type == "ImmutableBookmark"     ||
            type == "ImmutableFolder"       ||
            aURI == "bookmarks-ptf")
  },

  /////////////////////////////////////////////////////////////////////////
  // returns true if the node is a container. -->
  isBTContainer: function (aTarget)
  {
    return  aTarget.localName == "menu" || (aTarget.localName == "toolbarbutton" &&
           (aTarget.getAttribute("container") == "true"));
  },

  /////////////////////////////////////////////////////////////////////////
  // returns BookmarksUtils.DROP_BEFORE, DROP_ON or DROP_AFTER accordingly
  // to the event coordinates. Skin authors could break us, we'll cross that 
  // bridge when they turn us 90degrees.  -->
  getBTOrientation: function (aEvent, aTarget)
  {
    var target
    if (!aTarget)
      target = aEvent.target;
    else
      target = aTarget;
    if (target.localName == "menu"                 &&
        target.parentNode.localName != "menupopup" ||
        target.id == "bookmarks-chevron")
      return BookmarksUtils.DROP_ON;
    if (target.id == "bookmarks-ptf") {
      return target.hasChildNodes()?
             BookmarksUtils.DROP_AFTER:BookmarksUtils.DROP_ON;
    }

    var overButtonBoxObject = target.boxObject.QueryInterface(Components.interfaces.nsIBoxObject);
    var overParentBoxObject = target.parentNode.boxObject.QueryInterface(Components.interfaces.nsIBoxObject);

    var size, border;
    var coordValue, clientCoordValue;
    switch (target.localName) {
      case "toolbarseparator":
      case "toolbarbutton":
        size = overButtonBoxObject.width;
        coordValue = overButtonBoxObject.x;
        clientCoordValue = aEvent.clientX;
        break;
      case "menuseparator": 
      case "menu":
      case "menuitem":
        size = overButtonBoxObject.height;
        coordValue = overButtonBoxObject.screenY;
        clientCoordValue = aEvent.screenY;
        break;
      default: return BookmarksUtils.DROP_ON;
    }
    if (this.isBTContainer(target))
      border = size/5;
    else
      border = size/2;

    // in the first region?
    if (clientCoordValue-coordValue < border)
      return BookmarksUtils.DROP_BEFORE;
    // in the last region?
    else if (clientCoordValue-coordValue >= size-border)
      return BookmarksUtils.DROP_AFTER;
    else // must be in the middle somewhere
      return BookmarksUtils.DROP_ON;
  },

  onCommandUpdate: function ()
  {
    var selection = this._selection;
    var target    = this._target;
    BookmarksController.onCommandUpdate(selection, target);
  }
}

var BookmarksMenuController = {

  supportsCommand: BookmarksController.supportsCommand,

  isCommandEnabled: function (aCommand)
  {
    var selection = BookmarksMenu._selection;
    var target    = BookmarksMenu._target;
    if (selection)
      return BookmarksController.isCommandEnabled(aCommand, selection, target);

    return false;
  },

  doCommand: function (aCommand)
  {
//jsdump("Entering BookmarksMenuController.doCommand:" + aCommand + "\n");
    // we needed to focus the element that has the bm command controller
    // to get here. Now, let's focus the content before performing the command:
    // if a modal dialog is called from now, the content will be focused again
    // automatically after dismissing the dialog

    BookmarksMenuDNDObserver.onDragRemoveFeedBack(document.popupNode);
/*    
    if (content) content.focus();
    BookmarksMenuDNDObserver.onDragRemoveFeedBack(document.popupNode);
*/
    // if a dialog opens, the "open" attribute of a menuitem-container
    // clicked on won't be removed. We do it manually.
    var element = document.popupNode.firstChild;
    if (element && element.localName == "menupopup")
      element.hidePopup();

    var selection = BookmarksMenu._selection;
    var target    = BookmarksMenu._target;
    var db        = BookmarksMenu._db;

    BookmarksController.doCommand(aCommand, selection, target, db);

  },

  onMouseMove: function (aEvent)
  {
    var command = aEvent.target.getAttribute("command");
    var isDisabled = aEvent.target.getAttribute("disabled")
    if (isDisabled != "true" && (command == "cmd_bm_newfolder" || command == "cmd_paste")) {
      BookmarksMenuDNDObserver.onDragSetFeedBack(document.popupNode, BookmarksMenu._orientation);
    } else {
      BookmarksMenuDNDObserver.onDragRemoveFeedBack(document.popupNode);
    }
  }
}

var BookmarksMenuDNDObserver = {

  ////////////////////
  // Public methods //
  ////////////////////

  onDragStart: function (aEvent, aXferData, aDragAction)
  {
    var target = aEvent.target;

    // Prevent dragging from invalid regions

    // can't drag from the empty areas
    if (target.id == "bookmarks-menu")
      return false;

    if (!BookmarksMenu.isBTBookmark(target.id))
      return false;

    // Prevent dragging out of menupopups on non Win32 platforms. 
    // a) on Mac drag from menus is generally regarded as being satanic
    // b) on Linux, this causes an X-server crash, (bug 151336)
    // c) on Windows, there is no hang or crash associated with this, so we'll leave 
    // the functionality there. 
    if (navigator.platform != "Win32" && target.localName != "toolbarbutton")
      return false;

    if (this.isContainer(target)) {
      if (this.isPlatformNotSupported) 
        return false;
      target.firstChild.hidePopup();
    }
    var selection  = BookmarksMenu.getBTSelection(target);
    aXferData.data = BookmarksUtils.getXferDataFromSelection(selection);
    return true;
  },

  onDragOver: function(aEvent, aFlavour, aDragSession) 
  {
    var orientation = BookmarksMenu.getBTOrientation(aEvent)
    if (aDragSession.canDrop)
      this.onDragSetFeedBack(aEvent.target, orientation);
    if (orientation != this.mCurrentDropPosition) {
      // emulating onDragExit and onDragEnter events since the drop region
      // has changed on the target.
      this.onDragExit(aEvent, aDragSession);
      this.onDragEnter(aEvent, aDragSession);
    }
    if (this.isPlatformNotSupported)
      return;
    if (this.isTimerSupported || !aDragSession.sourceNode)
      return;
    this.onDragOverCheckTimers();
  },

  onDragEnter: function (aEvent, aDragSession)
  {
    var target = aEvent.target;
    var orientation = BookmarksMenu.getBTOrientation(aEvent);
    if (target.localName == "menupopup" || target.id == "bookmarks-ptf")
      target = target.parentNode;
    if (aDragSession.canDrop) {
      this.onDragSetFeedBack(target, orientation);
      this.onDragEnterSetTimer(target, aDragSession);
    }
    this.mCurrentDragOverTarget = target;
    this.mCurrentDropPosition   = orientation;
  },

  onDragExit: function (aEvent, aDragSession)
  {
    var target = aEvent.target;
    if (target.localName == "menupopup" || target.id == "bookmarks-ptf")
      target = target.parentNode;
    this.onDragRemoveFeedBack(target);
    this.onDragExitSetTimer(target, aDragSession);
    this.mCurrentDragOverTarget = null;
    this.mCurrentDropPosition = null;
  },

  onDrop: function (aEvent, aXferData, aDragSession)
  {
    var target = aEvent.target;
    this.onDragRemoveFeedBack(target);

    var selection = BookmarksUtils.getSelectionFromXferData(aDragSession);

    var orientation = BookmarksMenu.getBTOrientation(aEvent);

    var selTarget   = BookmarksMenu.getBTTarget(target, orientation);
    if (!selTarget) return;

    // we can only test for kCopyAction if the source is a bookmark
    var checkCopy = aDragSession.isDataFlavorSupported("moz/rdfitem");

    const kDSIID      = Components.interfaces.nsIDragService;
    const kCopyAction = kDSIID.DRAGDROP_ACTION_COPY + kDSIID.DRAGDROP_ACTION_LINK;

    // doCopy defaults to true; check if we should make it false.
    // we make it false only if all the selection items have valid parent
    // bookmark DS containers (i.e. aren't generated via aggregation)
    var doCopy = true;
    if (checkCopy && !(aDragSession.dragAction & kCopyAction))
      doCopy = BookmarksUtils.shouldCopySelection("drag", selection);

    if (doCopy)
      BookmarksUtils.insertAndCheckSelection("drag", selection, selTarget);
    else
      BookmarksUtils.moveAndCheckSelection("drag", selection, selTarget);

  },

  canDrop: function (aEvent, aDragSession)
  {
    var target = aEvent.target;
    if (!BookmarksMenu.isBTBookmark(target.id))
      return false;

    var btype = BookmarksUtils.resolveType(target.id);

    return target.id == "bookmarks-menu" ||
          (target.id != BookmarksRootRes &&
           btype == "Folder" ||
           btype == "Bookmark");
  },

  canHandleMultipleItems: true,

  getSupportedFlavours: function () 
  {
    var flavourSet = new FlavourSet();
    flavourSet.appendFlavour("moz/rdfitem");
    return flavourSet;
  }, 
  

  ////////////////////////////////////
  // Private methods and properties //
  ////////////////////////////////////

  springLoadedMenuDelay: 350, // milliseconds
  isPlatformNotSupported: navigator.platform.indexOf("Mac") != -1, // see bug 136524
  // Needs to be dynamically overridden (to |true|) in the case of an external drag: see bug 232795.
  isTimerSupported: navigator.platform.indexOf("Win") == -1,

  mCurrentDragOverTarget: null,
  mCurrentDropPosition: null,
  loadTimer  : null,
  closeTimer : null,
  loadTarget : null,
  closeTarget: null,

  _observers : null,
  get mObservers ()
  {
    if (!this._observers) {
      this._observers = [document.getElementById("bookmarks-menu").firstChild]
    } 
    return this._observers;
  },

  getObserverForNode: function (aNode)
  {
    if (!aNode)
      return null;
    var node = aNode;
    var observer;
    while (node) {
      for (var i=0; i < this.mObservers.length; i++) {
        observer = this.mObservers[i];
        if (observer == node)
          return observer;
      }
      node = node.parentNode;
    }
    return null;
  },

  onDragCloseMenu: function (aNode)
  {
    var children = aNode.childNodes;
    for (var i = 0; i < children.length; i++) {
      if (this.isContainer(children[i]) && 
          children[i].getAttribute("open") == "true") {
        this.onDragCloseMenu(children[i].lastChild);
        if (children[i] != this.mCurrentDragOverTarget || this.mCurrentDropPosition != BookmarksUtils.DROP_ON)
          children[i].lastChild.hidePopup();
      }
    } 
  },

  onDragCloseTarget: function ()
  {
    if (this.mCurrentDragOverTarget && this.mCurrentDragOverTarget.parentNode)
        this.onDragCloseMenu(this.mCurrentDragOverTarget.parentNode);
  },

  onDragLoadTarget: function (aTarget) 
  {
    if (!this.mCurrentDragOverTarget)
      return;
    // Load the current menu
    if (this.mCurrentDropPosition == BookmarksUtils.DROP_ON && 
        this.isContainer(aTarget))
      aTarget.lastChild.showPopup(aTarget);
  },

  onDragOverCheckTimers: function ()
  {
    var now = new Date().getTime();
    if (this.closeTimer && now-this.springLoadedMenuDelay>this.closeTimer) {
      this.onDragCloseTarget();
      this.closeTimer = null;
    }
    if (this.loadTimer && (now-this.springLoadedMenuDelay>this.loadTimer)) {
      this.onDragLoadTarget(this.loadTarget);
      this.loadTimer = null;
    }
  },

  onDragEnterSetTimer: function (aTarget, aDragSession)
  {
    if (this.isPlatformNotSupported)
      return;
    if (this.isTimerSupported || !aDragSession.sourceNode) {
      var targetToBeLoaded = aTarget;
      clearTimeout(this.loadTimer);
      if (aTarget == aDragSession.sourceNode)
        return;
      var This = this;
      this.loadTimer=setTimeout(function () {This.onDragLoadTarget(targetToBeLoaded)}, This.springLoadedMenuDelay);
    } else {
      var now = new Date().getTime();
      this.loadTimer  = now;
      this.loadTarget = aTarget;
    }
  },

  onDragExitSetTimer: function (aTarget, aDragSession)
  {
    if (this.isPlatformNotSupported)
      return;
    var This = this;
    if (this.isTimerSupported || !aDragSession.sourceNode) {
      clearTimeout(this.closeTimer)
      this.closeTimer=setTimeout(function () {This.onDragCloseTarget()}, This.springLoadedMenuDelay);
    } else {
      var now = new Date().getTime();
      this.closeTimer  = now;
      this.closeTarget = aTarget;
      this.loadTimer = null;

      // If the user isn't rearranging within the menu, close it
      // To do so, we exploit a Mac bug: timeout set during
      // drag and drop on Windows and Mac are fired only after that the drop is released.
      // timeouts will pile up, we may have a better approach but for the moment, this one
      // correctly close the menus after a drop/cancel outside the personal toolbar.
      // The if statement in the function has been introduced to deal with rare but reproducible
      // missing Exit events.
      if (aDragSession.sourceNode.localName != "menuitem" && aDragSession.sourceNode.localName != "menu")
        setTimeout(function () { if (This.mCurrentDragOverTarget) {This.onDragRemoveFeedBack(This.mCurrentDragOverTarget); This.mCurrentDragOverTarget=null} This.loadTimer=null; This.onDragCloseTarget() }, 0);
    }
  },

  onDragSetFeedBack: function (aTarget, aOrientation)
  {
   switch (aTarget.localName) {
      case "menuseparator": 
      case "menu":
      case "menuitem":
        switch (aOrientation) {
          case BookmarksUtils.DROP_BEFORE: 
            aTarget.setAttribute("dragover-top", "true");
            break;
          case BookmarksUtils.DROP_AFTER:
            aTarget.setAttribute("dragover-bottom", "true");
            break;
          case BookmarksUtils.DROP_ON:
            break;
        }
        break;
      case "hbox"     : 
        // hit between the last visible bookmark and the chevron
        var newTarget = BookmarksToolbar.getLastVisibleBookmark();
        if (newTarget)
          newTarget.setAttribute("dragover-right", "true");
        break;
      case "stack"    :
      case "menupopup": break; 
     default: jsdump("No feedback for: "+aTarget.localName+"\n");
    }
  },

  onDragRemoveFeedBack: function (aTarget)
  { 
    var newTarget;
    var bt;
    if (aTarget.id == "bookmarks-ptf") { 
      // hit when dropping in the bt or between the last visible bookmark 
      // and the chevron
      newTarget = BookmarksToolbar.getLastVisibleBookmark();
      if (newTarget)
        newTarget.removeAttribute("dragover-right");
    } else if (aTarget.id == "bookmarks-stack") {
      newTarget = BookmarksToolbar.getLastVisibleBookmark();
      newTarget.removeAttribute("dragover-right");
    } else {
      aTarget.removeAttribute("dragover-left");
      aTarget.removeAttribute("dragover-right");
      aTarget.removeAttribute("dragover-top");
      aTarget.removeAttribute("dragover-bottom");
    }
  },

  onDropSetFeedBack: function (aTarget)
  {
    //XXX Not yet...
  },

  isContainer: function (aTarget)
  {
    return aTarget.localName == "menu"          || 
           aTarget.localName == "toolbarbutton" &&
           aTarget.getAttribute("type") == "menu";
  }
}
