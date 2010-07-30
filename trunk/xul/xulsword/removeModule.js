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



const MODULESID="modules", LOCALESID="locales", AUDIOID="audio";
const GROUPS = [MODULESID, LOCALESID, AUDIOID];
const TYPES = {Texts: "text", Comms: "comm", Dicts: "dict", Genbks: "book"};
const MODULEID = new RegExp(escapeRE(GROUPS[0]) + "\." + "(\\d+)");
const NOSHOWDEF = ".nomenu.manifest";
const CBMAXHEIGHT = 500;

function onLoad() {
  var audioDir = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties)
    .get("resource:app", Components.interfaces.nsIFile);
  audioDir.append(AUDIO);
  updateCSSBasedOnCurrentLocale(["#modal", "input, button, menu, menuitem"]);
  createVersionClasses(0);
  for (var g=0; g<GROUPS.length; g++) {
    var checkBoxes = [];
    var hide=true;
    var firstBibleID;
    switch (GROUPS[g]) {
    case MODULESID:
      var hide=false;
      var lastType="";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].isOrigTab) continue;
        if (Tabs[t].modType==BIBLE && !firstBibleID) firstBibleID=GROUPS[g] + "." + t;
        if (Tabs[t].modType!=lastType) {
          var cb = document.createElement("label");
          cb.setAttribute("value", document.getElementById("radio.label." + TYPES[Tabs[t].tabType]).childNodes[0].nodeValue);
          cb.setAttribute("class", "header");
          cb.style.marginTop = "1em";
          checkBoxes.push(cb);
        }
        cb = document.createElement("checkbox");
        cb = MainWindow.writeModuleElem(cb, t, "label", GROUPS[g], true, false, false);
        cb.setAttribute("oncommand", "disableItem0('" + cb.id + "');");
        if (!cb) continue;
        checkBoxes.push(cb);
        lastType = Tabs[t].modType;
      }
      break;
    case LOCALESID:
      var cnt=0;
      for (var lc=0; lc<LocaleList.length; lc++) {
        if (LocaleList[lc]==DEFAULTLOCALE) continue;
        var cb = document.createElement("checkbox");
        cb = MainWindow.writeLocaleElem(cb, lc, GROUPS[g], true);
        if (!cb) continue;
        checkBoxes.push(cb);
        if (++cnt > 0) hide=false;
      }
      checkBoxes.sort(MainWindow.localeElemSort);
      break;
    case AUDIOID:
      var cnt=0;
      if (audioDir.exists()) {
        var subs = audioDir.directoryEntries;
        while (subs.hasMoreElements()) {
          var adir = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
          if (adir.leafName == AUDIOPLUGIN) continue;
          var cb = document.createElement("checkbox");
          cb.style.MozMarginEnd = "8px";
          cb.setAttribute("id", adir.leafName);
          cb.style.MozMarginEnd = "0px";
          checkBoxes.push(cb);
          if (++cnt > 0) hide=false;
        }
      }
      break;
    }
    
    var parent = document.getElementById(GROUPS[g]);
    if (hide) parent.parentNode.hidden=true;
    else {
      for (var c=0; c<checkBoxes.length; c++) {
        switch (GROUPS[g]) {
        case MODULESID:
        case LOCALESID:
          parent.appendChild(checkBoxes[c]);
          break;
        case AUDIOID:
          var langList = getModsWithConfigEntry("Lang", checkBoxes[c].id, true, true);
          var audioList = getModsWithConfigEntry("AudioCode", checkBoxes[c].id, true, true);
          var hbox = document.createElement("hbox");
          hbox = parent.appendChild(hbox);
          // add checkbox
          hbox.appendChild(checkBoxes[c]);
          // then audio directory name using default formatting
          var elem = getChildLabel(null, checkBoxes[c].id, checkBoxes[c].id, true);
          elem.style.MozMarginEnd = "8px";
          hbox.appendChild(elem);
          // then collect modules which access the audio directory
          var dlabs = [];
          var elem = getChildLabel(checkBoxes[c].id, checkBoxes[c].id);
          if (elem) dlabs.push(elem);
          for (var m=0; m<audioList.length; m++) {
            elem = getChildLabel(audioList[m], checkBoxes[c].id);
            if (elem) dlabs.push(elem);
          }
          for (var m=0; m<langList.length; m++) {
            elem = getChildLabel(langList[m], checkBoxes[c].id);
            if (elem) dlabs.push(elem);
          }
          // if matching modules exist, then put them in an hbox for dir control, and insert labels with formatting
          var lhbox = document.createElement("hbox");
          lhbox = hbox.appendChild(lhbox);
          lhbox.dir=(guiDirection()=="rtl" ? "reverse":"normal");
          var pre = "(";
          var post = ", ";
          if (dlabs.length) {
            for (var dl=0; dl<dlabs.length; dl++) {
              if (dl==dlabs.length-1) post = ")";
              dlabs[dl].setAttribute("value", pre + dlabs[dl].getAttribute("value") + post);
              lhbox.appendChild(dlabs[dl]);
              pre="";
            }
          }
          else {
            elem = document.createElement("label");
            elem = getChildLabel(null, checkBoxes[c].id, "(?)", true);
            lhbox.appendChild(elem);
          }
          break;
        }
      }
    }
    if (firstBibleID) disableItem0(firstBibleID);
  }
  // Fix sizing bug...
  var modelem = document.getElementById("modules");
  var height = modelem.boxObject.height;
  if (height > CBMAXHEIGHT) {
    modelem.style.height = CBMAXHEIGHT + "px";
    modelem.style.overflowY = "auto";
  }
  window.setTimeout("window.sizeToContent();", 0);
}

function getChildLabel(aModname, control, forceLabel, forceDefaultFormatting) {
  var ne = document.createElement("label");
  if (forceLabel==null) {
    if (!Tab[aModname]) return false;
    ne = MainWindow.writeModuleElem(ne, Tab[aModname].index, "value", "label", true, true, forceDefaultFormatting);
    if (!ne) return false;
  }
  else {
    ne.setAttribute("value", forceLabel);
    if (forceDefaultFormatting) {
      ne.style.fontFamily = "\"" + DefaultFont + "\"";
      ne.style.fontSizeAdjust = DefaultFontSizeAdjust;
    }
  }
  ne.setAttribute("onclick", "document.getElementById('" + control + "').click();");
  ne.style.MozMarginStart = "0px";
  ne.style.MozMarginEnd = "0px";
  return ne;
}

function disableItem0(id) {
  window.setTimeout("disableItem('" + id + "');", 0);
}

function disableItem(id) {
  var elem = document.getElementById(id);
  if (!elem) return;
  elem = elem.parentNode;
  elem = elem.firstChild;
  var numUnchecked = 0;
  var lastUnchecked = elem;
  while(elem) {
    var e = elem;
    elem = elem.nextSibling;
    e.disabled=false;
    //Only consider Bibles if this is "module" category
    var idparts = e.id.match(MODULEID);
    if (idparts && Tabs[idparts[1]].modType!=BIBLE) continue;
    if (e.tagName != "checkbox") continue;
    if (!e.checked) {
      numUnchecked++;
      lastUnchecked = e;
    }
  }
  if (numUnchecked<2) {
    lastUnchecked.disabled=true;
    lastUnchecked.checked=false;
  }
}

function deleteModules(e) {

  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {
    var bundle = BUNDLESVC.createBundle("chrome://global/locale/crashes.properties");
    var areYouSure = bundle.GetStringFromName("deleteconfirm.title");
  }
  catch (er) {
    areYouSure = document.getElementById("deleteCmd.label").childNodes[0].nodeValue + "?";
  }
  
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      document.getElementById("menu.removeModule.label").childNodes[0].nodeValue, 
      areYouSure, 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return;
  
  addDefaultLocaleIfNeeded();
  
  var success=true;
  var reset=NOVALUE;
  var msg="";
  const LFILES = [".jar", ".txt", ".locale.manifest"];
  var chromeDir = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties)
    .get("AChrom", Components.interfaces.nsIFile);
  var modsDir = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties)
    .get("resource:app", Components.interfaces.nsIFile);
  var audioDir = modsDir.clone();
  audioDir.append(AUDIO);
  modsDir.append(MODSD);
  
  var need2ChangeLocale=false;
  var aLocale=DEFAULTLOCALE;
  var need2RemoveEN=false;
  var aTabNum=prefs.getCharPref("DefaultVersion");
  var need2ChangeVers = [false, false, false, false];
  var x=0; //must be set BEFORE main loop
  for (var g=0; g<GROUPS.length; g++) {
    var tchild = document.getElementById(GROUPS[g]).firstChild;
    while (tchild) {
      var child = tchild;
      tchild = tchild.nextSibling;
      if (child.nodeName=="hbox") child=child.firstChild;
      if (child.nodeName!="checkbox") continue;
      if (child.checked) {
        var files = [];
        switch (g) {
        case 0: //modules
          var confs = modsDir.directoryEntries;
          var found=false;
          while (confs.hasMoreElements()) {
            var aFile = confs.getNext();
            try {
              var t = Number(child.id.substring(GROUPS[g].length+1));
              if (readParamFromConf(aFile, "ModuleName") == Tabs[t].modName) {
                files.push(aFile);
                found = true;
                if (reset<HARDRESET) reset=HARDRESET;
                for (var w=1; w<=3; w++) {
                  if (Win[w].modName==Tabs[t].modName) need2ChangeVers[w] = true;
                }
                break;
              }
            }
            catch (er) {}
          }
          if (!found) {success=false; msg+="ERROR: Module \"" + Tabs[Number(child.id.substring(GROUPS[g].length+1))].modName + "\" .conf not found.\n";}
          break;
        case 1: //locales
          var loc = child.id.substring(GROUPS[g].length+1);
          if (loc == rootprefs.getCharPref("general.useragent.locale")) need2ChangeLocale=true;
          if (loc == DEFAULTLOCALE) need2RemoveEN=true;
          else {
            for (var f=0; f<LFILES.length; f++) {
              var aFile = chromeDir.clone();
              aFile.append(loc + LFILES[f]);
              if (aFile.exists()) {
                files.push(aFile);
                if (reset<SOFTRESET) reset=SOFTRESET;
              }
              else {success=false; msg+="ERROR: File \"" + aFile.path + "\" not found.\n";}
            }
          }
          break;
        case 2: //audio
          var aFile = audioDir.clone();
          aFile.append(child.id);
          if (aFile.exists()) {
            files.push(aFile);
            if (reset<SOFTRESET) reset=SOFTRESET;
          }
          else {success=false; msg+="ERROR: File \"" + aFile.path + "\" not found.\n";}
          break;
        }
        
        //Save list of files marked for deletion in prefs
        for (var f=0; f<files.length; f++) {
          prefs.setComplexValue("ToDelete" + x++, Components.interfaces.nsILocalFile, files[f]);
          jsdump("Marking \"" + files[f].path + "\" for delete.");
        }
        prefs.setIntPref("ToDeleteNum", x);
      }
      // Checkbox is NOT checked...
      else if (GROUPS[g]==LOCALESID) {aLocale = child.id.substring(GROUPS[g].length+1);}
      else if (GROUPS[g]==MODULESID) {aTabNum = Number(child.id.substring(GROUPS[g].length+1));}
    }
  }
  
  if (need2ChangeLocale) rootprefs.setCharPref("general.useragent.locale", aLocale);
  if (need2RemoveEN) {
    var enMan = chromeDir.clone();
    enMan.append(DEFAULTLOCALE + ".locale.manifest");
    if (enMan.exists()) {enMan.moveTo(null, DEFAULTLOCALE + NOSHOWDEF);}
    if (reset<SOFTRESET) reset=SOFTRESET;
  }
  for (var w=1; w<=3; w++) {
    if (need2ChangeVers[w]) {
      if (!MainWindow.isTabShowing(aTabNum, w)) {
        MainWindow.toggleHiddenModPref(aTabNum, w);
      }
      MainWindow.setVersionTo(w, Tabs[aTabNum].modName);
    }
  }
  
  if (!success) {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("ERRORS DURING DELETE: " + msg);
  }
  
  if (x>0 || need2RemoveEN) {
    switch(reset) {
    case NOVALUE:
    case NORESET:
    case SOFTRESET:
      MainWindow.location.reload();
      break;
    case HARDRESET:
      MainWindow.setTimeout("restartApplication();", 0);
      break;
    }
  }
  window.close();
}

function addDefaultLocaleIfNeeded() {
  var locGBox = document.getElementById(GROUPS[1]);
  if (locGBox && locGBox.childNodes && locGBox.childNodes.length) {
    var locRemains=false;
    for (var i=0; i<locGBox.childNodes.length; i++) {
      if (!locGBox.childNodes.item(i).checked) locRemains=true;
    }
    if (locRemains) return;
    var enMan = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties)
    .get("AChrom", Components.interfaces.nsIFile);
    enMan.append(DEFAULTLOCALE + NOSHOWDEF);
    if (enMan.exists()) {enMan.moveTo(null, DEFAULTLOCALE + ".locale.manifest");}
  }
}

function onUnload() {

}
