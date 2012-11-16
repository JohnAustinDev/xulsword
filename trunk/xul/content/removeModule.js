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
const MODULEID = new RegExp(escapeRE(GROUPS[0]) + "\." + "(\\d+)");
const NOSHOWDEF = ".nomenu.manifest";
const CBMAXHEIGHT = 500;

function onLoad() {
  var audioDir = getSpecialDirectory("xsAudio");
//  updateCSSBasedOnCurrentLocale(["#modal", "input, button, menu, menuitem"]);
  createDynamicClasses();
  for (var g=0; g<GROUPS.length; g++) {
    var checkBoxes = [];
    var hide=true;
    var firstBibleID;
    // Create all checkboxes
    switch (GROUPS[g]) {
    case MODULESID:
      var hide=false;
      var lastType="";
      for (var t=0; t<Tabs.length; t++) {
        if (Tabs[t].modType==BIBLE && !firstBibleID) firstBibleID = "ch." + Tabs[t].modName;
        if (Tabs[t].modType!=lastType) {
          var cb = document.createElement("label");
          cb.setAttribute("value", document.getElementById("radio.label." + TYPES[Tabs[t].tabType]).childNodes[0].nodeValue);
          cb.setAttribute("class", "header");
          cb.style.marginTop = "1em";
          checkBoxes.push(cb);
        }
        cb = document.createElement("checkbox");
        cb = MainWindow.writeModuleElem(cb, t, "label", GROUPS[g], true, false, false);
        cb.setAttribute("id", "ch." + Tabs[t].modName);
        cb.setAttribute("oncommand", "disableItem0('" + cb.id + "');");
        checkBoxes.push(cb);
        lastType = Tabs[t].modType;
      }
      break;
    case LOCALESID:
      var cnt=0;
      for (var lc LocaleConfigs) {
        if (lc == DEFAULTLOCALE) continue;
        var aFile = getSpecialDirectory("xsExtension");
        aFile.append(lc + "@xulsword.org");
        if (!aFile.exists()) continue;
        var cb = document.createElement("checkbox");
        cb = MainWindow.writeLocaleElem(cb, lc, GROUPS[g], true);
        if (!cb) continue;
        cb.setAttribute("id", "lc." + lc);
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
          if (!adir.isDirectory()) continue;
          if (adir.leafName == AUDIOPLUGIN) continue;
          var cb = document.createElement("checkbox");
          cb.setAttribute("id", adir.leafName);
          cb.style.MozMarginEnd = "0px";
          checkBoxes.push(cb);
          if (++cnt > 0) hide=false;
        }
      }
      break;
    }
    
    // Place all checkboxes on window
    var parent = document.getElementById(GROUPS[g]);
    if (hide) parent.parentNode.hidden=true;
    else {
      for (var c=0; c<checkBoxes.length; c++) {
        switch (GROUPS[g]) {
        case MODULESID:
          hbox = parent.appendChild(document.createElement("hbox"));
          var img = document.createElement("image");
          img.setAttribute("src", "chrome://xulsword/skin/images/shared.png");
          var isCommDir = checkBoxes[c].id;
          if (isCommDir) hbox.setAttribute("id", "gt." + isCommDir);
          if (!isCommDir || !Tab[isCommDir.substring(3)].isCommDir) img.setAttribute("hidden", "true");
          var img2 = hbox.appendChild(document.createElement("hbox"));
          img2.setAttribute("width", "16px");
          img2.setAttribute("align", "center");
          img2.appendChild(img);
          hbox.appendChild(checkBoxes[c]);
          break;
        case LOCALESID:
          parent.appendChild(checkBoxes[c]);
          break;
        case AUDIOID:
          var hbox = document.createElement("hbox");
          hbox = parent.appendChild(hbox);
          if (checkBoxes[c].id) hbox.setAttribute("id", "gt." + checkBoxes[c].id);
          // add checkbox
          hbox.appendChild(checkBoxes[c]);
          // then audio directory name using default formatting
          var elem = getChildLabel(null, checkBoxes[c].id, checkBoxes[c].id, true);
          elem.style.MozMarginEnd = "8px";
          hbox.appendChild(elem);
          // then collect modules which access the audio directory
          var dlabs = [];
          var dmods = getModsUsingAudioCode(checkBoxes[c].id.replace(/_.*$/, ""));
          for (var i=0; i<dmods.length; i++) {
            var elem = getChildLabel(dmods[i], checkBoxes[c].id);
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
      //ne.style.fontFamily = DefaultFont;
      //ne.style.fontSizeAdjust = DefaultFontSizeAdjust;
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
  var elem = document.getElementById("gt." + id).parentNode.firstChild;
  var numUnchecked = 0;
  var lastUnchecked;
  while(elem) {
    var e = elem;
    elem = elem.nextSibling;
    if (!e.id) continue;
    var cb = document.getElementById(e.id.substring(3));
    cb.disabled=false;
    //Only consider Bibles if this is "module" category
    var modName = cb.id.substring(3);
    if (Tab[modName].modType!=BIBLE) continue;
    if (!cb.checked) {
      numUnchecked++;
      lastUnchecked = cb;
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
    var bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/dialog.properties");
    var areYouSure = bundle.GetStringFromName("deleteconfirm.title");
  }
  catch (er) {
    areYouSure = document.getElementById("deleteCmd.label").childNodes[0].nodeValue + "?";
  }
  
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      fixWindowTitle(document.getElementById("menu.removeModule.label").childNodes[0].nodeValue),
      areYouSure, 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return;
  
  var success=true;
  var reset=NOVALUE;
  var msg="";
  const LFILES = [".jar", ".txt", ".locale.manifest"];
  var chromeDir = getSpecialDirectory("AChrom");
  var audioDir = getSpecialDirectory("xsAudio");
  
  var need2ChangeLocale=false;
  var aLocale=DEFAULTLOCALE;
  var aTabMod=prefs.getCharPref("DefaultVersion");
  var need2ChangeVers = [false, false, false, false];
  var x=0; //must be set BEFORE main loop
  for (var g=0; g<GROUPS.length; g++) {
    var tchild = document.getElementById(GROUPS[g]).firstChild;
    while (tchild) {
      var child = tchild;
      tchild = tchild.nextSibling;
      if (child.nodeName != "checkbox") {
        if (!child.id) continue;
        child = document.getElementById(child.id.substring(3));
        if (!child) continue;
      }

      if (child.checked) {
        var files = [];
        switch (g) {
        case 0: //modules
          var modName = child.id.substring(3);
          if (Tab[modName].conf) {
            files.push(Tab[modName].conf);
            if (reset<SOFTRESET) reset=SOFTRESET;
            for (var w=1; w<=3; w++) {
              if (prefs.getCharPref("Version" + w) == modName) need2ChangeVers[w] = true;
            }
          }
          else {success=false; msg+="ERROR: Module \"" + modName + "\" .conf not found.\n";}
          break;
        case 1: //locales
          var loc = child.id.substring(3);
          if (loc == getLocale()) need2ChangeLocale=true;
          Components.utils.import("resource://gre/modules/AddonManager.jsm");
          AddonManager.getAddonByID(loc + "@xulsword.org", function(addon) {addon.uninstall();});
          if (reset<HARDRESET) reset=HARDRESET;
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
      else if (GROUPS[g]==MODULESID) {aTabMod = child.id.substring(3);}
    }
  }

  if (need2ChangeLocale) rootprefs.setCharPref("general.useragent.locale", aLocale);
  for (var w=1; w<=3; w++) {
    if (need2ChangeVers[w]) {
      if (Tab[aTabMod]["w" + w + ".hidden"]) {
        Tab[aTabMod]["w" + w + ".hidden"] = !Tab[aTabMod]["w" + w + ".hidden"];
      }
      MainWindow.selectTab(w, aTabMod);
    }
  }
  
  if (!success) {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("ERRORS DURING DELETE: " + msg);
  }
  
  if (reset != NOVALUE) {
    switch(reset) {
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

function onResize() {
  var mg = document.getElementById("modgroup");
  var lg = document.getElementById("locgroup");
  var ag = document.getElementById("audgroup");
  var cb = document.getElementById("checkboxes");
  mg.style.maxWidth = Number(cb.boxObject.width - lg.boxObject.width - ag.boxObject.width) + "px";
  
  var bd = document.getElementById("body");
  var dl = document.getElementById("dialogbuttons");
  mg.style.maxHeight = Number(bd.boxObject.height - dl.boxObject.height) + "px";
}

function onUnload() {

}
