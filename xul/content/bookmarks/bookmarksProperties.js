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
 

// PARAMS ARE: 0:resourceID, 1:return value object, 2:isNew, 3:editNote

var gResource;
var gName, gNote, gVerseText, gDropDown, gDropDownRow;
var gEditNote;
var gIsContainer;
var gSaveEmptyTitle;
var gInfoResource;
var gUnknownModule = false;

function Init()
{
  updateCSSBasedOnCurrentLocale(["#bmPropsWindow", "input, button, menu, menuitem"]);
  createVersionClasses();
  AllWindows.push(window);
  
  gResource = BM.RDF.GetResource(window.arguments[0]);
  gIsContainer = BM.RDFCU.IsContainer(BMDS, gResource);
  gName = document.getElementById("bmname");
  gNote = document.getElementById("note");
  gVerseText = document.getElementById("versetext");
  gDropDown = document.getElementById("location-dropdown");
  gDropDownRow = document.getElementById("locationrow");
  gSaveEmptyTitle = document.title;  
  
  // assume the user will press cancel (only used when creating new resources)
  window.arguments[1].ok = false;

  gEditNote = window.arguments[2];
  
  gInfoResource = BookmarkFuns.BmGetInfo(gResource.Value);
  // If the module for this bookmark is no longer available, then display the bookmark
  // but it cannot be edited, and may "beep" if opened. It also needs to show 
  // module name, and location if available.
  if (!gIsContainer && !Tab[gInfoResource[MODULE]]) {
    gUnknownModule = true;
    gDropDown.setAttribute("disabled", "true");
    gDropDown.setAttribute("hidebook", "true");
    gDropDown.setAttribute("hidechapter", "true");
    gDropDown.setAttribute("hideverse", "true");
    gDropDown.setAttribute("hidelastverse", "true");
    var vers = document.getAnonymousElementByAttribute(gDropDown, "anonid", "version");
    vers.appendItem(gInfoResource[MODULE], gInfoResource[MODULE]);
    vers.value = gInfoResource[MODULE];
  }
  
  if (!gUnknownModule) BookmarkFuns.completeBMInfo(gInfoResource, (gIsContainer ? "Folder":"Bookmark"));
  
//jsdump("RESOURCE:" + gResource.Value); for (var i=0; i<gInfoResource.length; i++) {jsdump(i + " " + gInfoResource[i]);}

  document.title = fixWindowTitle(gSaveEmptyTitle.replace(/\*\*bm_title\*\*/gi, gInfoResource[NAME]));
  gName.value = gInfoResource[NAME];
  gNote.value = gInfoResource[NOTE];
  if (gInfoResource[NAMELOCALE]) gName.className="cs-" + gInfoResource[NAMELOCALE]; // due to a xulrunner 1.9.1.3 bug, this does not work on single line textboxes!
  if (gInfoResource[NOTELOCALE]) gNote.className="cs-" + gInfoResource[NOTELOCALE];

  if (gIsContainer) {
    gDropDownRow.setAttribute("hidden", "true");
    document.getElementById("verserow").setAttribute("hidden", "true");
  }
  else {
    gVerseText.value = gInfoResource[BMTEXT];
    gVerseText.className = "cs-" + gInfoResource[MODULE];
    switch (getModuleLongType(gInfoResource[MODULE])) {
    case DICTIONARY:
    case GENBOOK:
      gDropDownRow.setAttribute("hidden", "true");
      break;
      
    case BIBLE:
    case COMMENTARY:
      var location = gInfoResource[BOOK] + "." + gInfoResource[CHAPTER] + "." + gInfoResource[VERSE] + "." + gInfoResource[LASTVERSE];
      gDropDown.version  = gInfoResource[MODULE];
      gDropDown.location = location;
      document.getAnonymousElementByAttribute(gDropDown, "anonid", "version").className = "cs-" + gInfoResource[MODULE];
      break;
    }
  }
    
  // set initial focus
  if (gIsContainer) {gName.focus(); gName.select();}
  else if (gDropDownRow.getAttribute("hidden")!="true" && !gEditNote) {
    document.getAnonymousElementByAttribute(gDropDown, "anonid", "book").focus();
    document.getAnonymousElementByAttribute(gDropDown, "anonid", "book").select();
  }
  else {
    gNote.focus();
    //gNote.select(); select() does not work on note textbox!
  }
  window.setTimeout("sizeToContent()", 0);
}

function onRefUserUpdate(e, location, version) {
  switch (getModuleLongType(version)) {
  case BIBLE:
    var aVerse = findAVerseText(version, location);
    gVerseText.value = aVerse.text.replace(/^\s*/,"");
    if (version != Tabs[aVerse.tabNum].modName) gVerseText.value += " (" + Tabs[aVerse.tabNum].label + ")";
    gVerseText.className = "cs-" + Tabs[aVerse.tabNum].modName;
    break;
  case COMMENTARY:
    gVerseText.value = Bible.getVerseText(version, location).replace(/^\s*/,"").replace(/\n/g, " ");
    gVerseText.className = "cs-" + version;
    break;
  }
  document.getAnonymousElementByAttribute(gDropDown, "anonid", "version").className = "cs-" + version;
  location = dotStringLoc2ObjectLoc(location, version);
  gName.value = BookmarkFuns.getNameForBookmark(location);
  gName.className = "cs-Program";
  document.title = fixWindowTitle(gSaveEmptyTitle.replace(/\*\*bm_title\*\*/gi, gName.value));
  window.setTimeout("sizeToContent();", 0);
}

function Commit() {
  var changed = false;
  gInfoResource[NAME] = gName.value ? replaceASCIIcontrolChars(gName.value):"-----";
  gInfoResource[NOTE] = gNote.value ? replaceASCIIcontrolChars(gNote.value):"";
  // If the bookmark module is unknown, only the name and note can be modified!
  if (!gIsContainer && !gUnknownModule && gDropDownRow.getAttribute("hidden")!="true") {
    var version = gDropDown.version;
    switch (getModuleLongType(version)) {
    case BIBLE:
    case COMMENTARY:
      var location = gDropDown.location.split(".");
      gInfoResource[BOOK]     = location[0];
      gInfoResource[CHAPTER]  = location[1];
      gInfoResource[VERSE]    = location[2];
      gInfoResource[LASTVERSE]= location[3];
      gInfoResource[BMTEXT]   = replaceASCIIcontrolChars(gVerseText.value);
      gInfoResource[MODULE]  = version;
      break;
    }
  }
  if (!gUnknownModule) {
    gInfoResource[ICON] = null; // to update icon
    gInfoResource[LOCATION] = null; // to update location
    BookmarkFuns.completeBMInfo(gInfoResource, (gIsContainer ? "Folder":"Bookmark"));
  }
  
  // Grovel through the fields to see if any of the values have
  // changed. If so, update the RDF graph and force them to be saved
  // to disk.
  for (var i=0; i<gInfoResource.length; ++i) {
    // Get the new value as a literal, using 'null' if the value is empty.
    var newValue = gInfoResource[i];
    
    var oldValue = BMDS.GetTarget(gResource, BM.gBmProperties[i], true);

    if (oldValue)
      oldValue = oldValue.QueryInterface(Components.interfaces.nsIRDFLiteral);

    if (newValue)
      newValue = BM.RDF.GetLiteral(newValue);

    changed |= BookmarkFuns.updateAttribute(gResource, BM.gBmProperties[i], oldValue, newValue);
    
    if (!newValue) newValue = "";
    if (!oldValue) oldValue = "";
    if (i == NAME && newValue != oldValue) gInfoResource[NAMELOCALE] = getLocale();
    if (i == NOTE && newValue != oldValue) gInfoResource[NOTELOCALE] = getLocale();
  }

  var remote = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  if (remote) {remote.Flush();}
  
  if (changed) BookmarkFuns.updateMainWindow();

  window.arguments[1].ok = true;
  window.close();
  return true;
}

function Cancel()
{
  return true;
}

function Unload() {
}

