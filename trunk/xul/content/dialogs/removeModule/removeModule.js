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

function onLoad() {
  initCSS();
  
  // Create MODULE checkboxes
  var checkBoxes = [];
  var lastType=""; 
  for (var t=0; t<Tabs.length; t++) {
    
    // add label when module type changes
    if (Tabs[t].modType != lastType) {
      var cb = document.createElement("label");
      cb.setAttribute("value", getDataUI("radio.label." + Tabs[t].tabType));
      cb.setAttribute("class", "module-heading");
      checkBoxes.push(cb);
    }
    
    // make a checkbox
    cb = document.createElement("checkbox");
    cb.setAttribute("class", "module-checkbox");
    cb.setAttribute("modName", Tabs[t].modName);
    cb.addEventListener("command", function () {window.setTimeout(function () {disableBibleIfLast();}, 1);});
    checkBoxes.push(cb);
    
    lastType = Tabs[t].modType;
  }
  
  // place MODULE checkboxes
  for (var c=0; c<checkBoxes.length; c++) {
    if (checkBoxes[c].tagName == "label") {
      document.getElementById("modules").appendChild(checkBoxes[c]);
      continue;
    }
    
    var mod = checkBoxes[c].getAttribute("modName");
    // Multiple labels are needed to accommodate RTL module names and
    // descriptions even when UI is LTR (or vice versa).
    // <parent>
    //   <hbox1>
    //     <hbox2><image /></hbox>
    //     <checkbox /><label /><label /><label />
    //   </hbox>
    var hbox1 = document.getElementById("modules").appendChild(document.createElement("hbox"));
    hbox1.setAttribute("class", "module-container");
    hbox1.setAttribute("align", "center");
    if (!Tab[mod].isCommDir) hbox1.setAttribute("isLocalModule", "true");
    else checkBoxes[c].setAttribute("disabled", true);
    var hbox2 = hbox1.appendChild(document.createElement("hbox"));
    hbox2.setAttribute("align", "center");
    hbox2.appendChild(document.createElement("image"));
    hbox1.appendChild(checkBoxes[c]);
    
    // add our labels and descriptions
    var label = hbox1.appendChild(document.createElement("label"));
    label.setAttribute("value", Tab[mod].label);
    label.setAttribute("class", "cs-" + Tab[mod].locName);
    if (Tab[mod].description) {
      label = hbox1.appendChild(document.createElement("label"));
      label.setAttribute("value", " --- ");
      label.setAttribute("class", "cs-" + DEFAULTLOCALE);
      label = hbox1.appendChild(document.createElement("label"));
      label.setAttribute("value", Tab[mod].description);
      label.setAttribute("class", "cs-" + Tab[mod].locName);
    }
    
  }

  // Create LOCALES checkboxes
  var checkBoxes = [];
  for (var lc in LocaleConfigs) {
    
    // Is this locale installed with install manger? We can only delete 
    // locales which were installed with the install manager. Those which 
    // are installed in the program's chrome directory cannot be uninstalled.
    var aFile = getSpecialDirectory("xsExtension");
    aFile.append(lc + "." + APPLICATIONID + ".xpi");
    if (!aFile.exists()) continue;
    
    var bundle = getLocaleBundle(lc, "xulsword.properties");
    var myAccKey = "";
    try {myAccKey = bundle.GetStringFromName("LanguageMenuAccKey");} catch (er) {myAccKey = ""};

    var cb = document.createElement("checkbox");
    cb.setAttribute("label", bundle.GetStringFromName("LanguageMenuLabel"));
    if (myAccKey) cb.setAttribute("accesskey", myAccKey);
    cb.setAttribute("class", "locale-checkbox cs-" + lc);
    checkBoxes.push(cb);
  }
  
  // Place LOCALES checkboxes
  if (checkBoxes.length) {
    document.getElementById("locgroup").removeAttribute("hidden");
    document.getElementById("locgroup-spacer").removeAttribute("hidden");
    checkBoxes.sort(XSNS_MainWindow.localeElemSort);
    for (var c=0; c<checkBoxes.length; c++) {
      document.getElementById("locales").appendChild(checkBoxes[c]);
    }
  }
  
  // Create AUDIO checkboxes
  var checkBoxes = [];
  var audioDir = getSpecialDirectory("xsAudio");
  if (audioDir.exists()) {
    var subs = audioDir.directoryEntries;
    while (subs.hasMoreElements()) {
      var adir = subs.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (!adir.isDirectory()) continue;
      
      var cb = document.createElement("checkbox");
      cb.setAttribute("id", adir.leafName);
      cb.setAttribute("class", "audio-checkbox cs-" + DEFAULTLOCALE);
      checkBoxes.push(cb);
    }
  }
  
  // Place AUDIO checkboxes
  if (checkBoxes.length) {
    document.getElementById("audgroup").removeAttribute("hidden");
    document.getElementById("audgroup-spacer").removeAttribute("hidden");
    checkBoxes.sort(XSNS_MainWindow.localeElemSort);
    for (var c=0; c<checkBoxes.length; c++) {

      // build our label name using default formatting
      var label = checkBoxes[c].id + " ";
      
      // add a list of modules which access the audio directory
      var dmods = getModsUsingAudioCode(checkBoxes[c].id);
      
      label += "(";
      if (dmods && dmods.length) {
        var sep = "";
        for (var i=0; i<dmods.length; i++) {
          label += sep + dmods[i];
          sep = ", ";
        }
      }
      else label += "?";
      label += ")";
      
      checkBoxes[c].setAttribute("label", label);
      document.getElementById("audio").appendChild(checkBoxes[c]);
    }
  }
  
  disableBibleIfLast();
  
  window.setTimeout(function() {
    var w = document.getElementById("checkboxes").offsetWidth;
    window.innerWidth = Number(w + 20) + "px";
  }, 1);
  
}

function deleteCheckedResources(e) {

  // Ask confirmation that we really want to delete.
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
      fixWindowTitle(getDataUI("menu.removeModule.label")),
      getDataUI("deleteconfirm.title"), 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return;
  
  // Begin marking things for delete
  var filesToDelete = [];
  var success = true;
  var reset = NOVALUE;
  var errormsg = "";

  // Get SWORD MODULES to be deleted
  var mods = document.getElementsByClassName("module-checkbox");
  var need2ChangeVers = [false, false, false, false];
  var aGoodModule;
  for (var i=0; i<mods.length; i++) {
    var mod = mods[i].getAttribute("modName");
    
    if (!mods[i].checked) {
      aGoodModule = mod;
      continue;
    }
    
    if (Tab[mod].conf) {
      filesToDelete.push(Tab[mod].conf);
      if (reset < HARDRESET) reset = HARDRESET;
      for (var w=1; w<=NW; w++) {
        if (ViewPort.Module[w] == mod) need2ChangeVers[w] = true;
      }
    }
    else {success = false; errormsg += "ERROR: Module \"" + mod + "\" .conf not found.\n";}
    
  }
  
  // Change window's module if the current one is to be deleted
  for (var w=1; w<=NW; w++) {
    if (need2ChangeVers[w]) {
      Tab[aGoodModule]["w" + w + ".hidden"] = false;
      ViewPort.selectTab(w, aGoodModule);
    }
  }
  
  // Get AUDIO to be deleted
  var audios = document.getElementsByClassName("audio-checkbox");
  var audioDir = getSpecialDirectory("xsAudio");
  for (var i=0; i<audios.length; i++) {
    if (!audios[i].checked) continue;
    
    var aFile = audioDir.clone();
    aFile.append(audios[i].id);
    if (aFile.exists()) {
      filesToDelete.push(aFile);
      if (reset < SOFTRESET) reset = SOFTRESET;
    }
    else {success = false; errormsg += "ERROR: File \"" + aFile.path + "\" not found.\n";}
    
  }
  
  // Save the list of Audio and Conf files marked for deletion in prefs
  for (var i=0; i<filesToDelete.length; i++) {
    prefs.setComplexValue("ToDelete" + i, Components.interfaces.nsILocalFile, filesToDelete[i]);
    jsdump("Marking \"" + filesToDelete[i].path + "\" for delete.");
  }
  prefs.setIntPref("ToDeleteNum", i);
  
  // Use AddonManager to delete chosen LOCALES
  var locs = document.getElementsByClassName("locale-checkbox");
  var currentLocale = getLocale();
  for (var i=0; i<locs.length; i++) {
    if (!locs[i].checked) continue;
    
    var loc = locs[i].getAttribute("class").match(/(^|\s)cs-(.*)(\s|$)/)[2];
    if (loc == currentLocale) {
      rootprefs.setCharPref(LOCALEPREF, DEFAULTLOCALE);
    }
    if (typeof(AddonManager) == "undefined") Components.utils.import("resource://gre/modules/AddonManager.jsm");
    AddonManager.getAddonByID(loc + "." + APPLICATIONID, function(addon) {addon.uninstall();});
    //if (reset < HARDRESET) reset = HARDRESET; HARDRESET may accur before addon.uninstall happens!
    
  }

  if (!success) {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("ERRORS MARKING FILES FOR DELETE: " + errormsg);
  }
  
  if (reset != NOVALUE) {
    switch(reset) {
    case NORESET:
    case SOFTRESET:
      XSNS_MainWindow.location.reload();
      break;
    case HARDRESET:
      XSNS_MainWindow.setTimeout(function () {restartApplication();}, 0);
      break;
    }
  }
  
  closeWindowXS(window);
}

// Don't allow all xulsword's Bibles to be deleted. At least one must remain in
// order for xulsword to properly function.
function disableBibleIfLast() {

  var aBible;
  var aDisabledBible;
  var count = 0;
  
  var mods = document.getElementsByClassName("module-checkbox");
  for (var m=0; m<mods.length; m++) {
    if (Tab[mods[m].getAttribute("modName")].modType != BIBLE) continue;
    if (Tab[mods[m].getAttribute("modName")].isCommDir) continue;
    
    if (!mods[m].checked) {
      aBible = mods[m];
      count++;
    }
    
    if (mods[m].disabled) aDisabledBible = mods[m];
  }
  
  if (count == 1) aBible.setAttribute("disabled", "true");
  if (count > 1 && aDisabledBible) aDisabledBible.removeAttribute("disabled");
}
