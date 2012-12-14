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
 * Audio driver functions
 ***********************************************************************/ 
const QTIMEINS = ["qtlite270.exe", "qtalt.exe"];
const PLUGINLINKS = ["http://www.ibt.org.ru/russian/bible/info_bible.htm", "http://www.ibt.org.ru/english/bible/info_bible_en.htm", "http://www.apple.com/quicktime/download/"];
var Player = {};
Player.volume = 128;
// The first audio dir is the user profile's audio dir.
// For Backward Compatibility, if there is audio in the Program Files install dir, add it.
// Add any dirs registered in prefs as having audio files
// Add the audio dir that is that pointed to by the AudioDir registry key.
function getAudioDirs() {
  var audioDirs = [];
  //Check user profile- THIS SHOULD BE FIRST IN AudioDirs ARRAY
  var resAudio = getSpecialDirectory("xsAudio");
  if (resAudio.exists() && resAudio.isDirectory()) {
    var af = {dir:resAudio, isExportable:true, isInstallDir:false};
    audioDirs.push(af);
  }
  
  //Add dirs registered in prefs
  for (var i=0; i<getPrefOrCreate("NumAudioImportDirs", "Int", 0); i++) {
    var resPref = prefs.getComplexValue("AudioImportDir" + i, Components.interfaces.nsILocalFile);
    if (resPref.exists() && resPref.isDirectory()) {
      af = {dir:resPref, isExportable:false, isInstallDir:false};
      audioDirs.push(af);
    }
  }
  
  //Check AudioDir registry key location
  var path = null;
  if (typeof Components.classes["@mozilla.org/windows-registry-key;1"] != "undefined") {
    var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
    try {
      wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\" + prefs.getCharPref("Vendor") + "\\" + prefs.getCharPref("Name"), wrk.ACCESS_READ);
      path = wrk.readStringValue("AudioDir");
      path = path.replace("\\Install\\setup\\..\\..","") + "\\";
    }
    catch (er) {}
    //for Backward Compatibility...
    if (!path) {
      try {
        wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\" + prefs.getCharPref("Vendor"), wrk.ACCESS_READ);
        path = wrk.readStringValue("AudioDir");
        path = path.replace("\\Install\\setup\\..\\..","") + "\\";
      }
      catch (er) {}
    }
  }
  if (path) {
    var regDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    regDir.initWithPath(lpath(path));
    if (regDir.exists() && regDir.isDirectory()) {
      af = {dir:regDir, isExportable:false, isInstallDir:true};
      audioDirs.push(af);
    }
  }

  for (var i=0; i<audioDirs.length; i++) {jsdump("audioDir[" + i + "]= " + audioDirs[i].dir.path);}
  return audioDirs;
}

// Audio files are chosen as follows:
//    1) Look for audio matching the module name.
//    2) If not found, get audio matching the module's "AudioCode" if it exists.
//    3) If still not found, look for audio matching the module's base "Lang" attribute.
//    4) If still not found, there is no audio...
function getAudioForChapter(version, bookShortName, chapterNumber, audioDirs) {
  if (!audioDirs) audioDirs = getAudioDirs();
  var ret = getAudioFile(version, bookShortName, chapterNumber, audioDirs);
  if (ret) return ret;
    
  var audioCode = LibSword.getModuleInformation(version, "AudioCode");
  if (audioCode!=NOTFOUND) {
    ret = getAudioFile(audioCode, bookShortName, chapterNumber, audioDirs);
    if (ret) return ret;
  }
  
  var mLang = LibSword.getModuleInformation(version, "Lang");
  if (mLang) mLang = mLang.replace(/-.*$/, "");
  ret = getAudioFile(mLang, bookShortName, chapterNumber, audioDirs);
  if (ret) return ret;
  
  return null;
}

function getAudioFile(code, shortName, chapter, audioDirs) {
  if (!audioDirs) audioDirs = getAudioDirs();
  var dcode;
  var dlocale;
  for (var d=0; d<audioDirs.length; d++) {
    try {var ok = (audioDirs[d].dir.exists() && audioDirs[d].dir.directoryEntries)} catch (er) {continue;}
    if (!ok) continue;
    var files = audioDirs[d].dir.directoryEntries;
    while (files.hasMoreElements()) {
      var file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (!file || !file.isDirectory()) continue;
      var re = new RegExp("^" + code + "(_(.*))?$", "i");
      var fcode = file.leafName.match(re);
      if (fcode) {
        for (var e=0; e<AUDEXT.length; e++) {
          if (fcode[2]) {
            var aFile = getLocalizedAudioFile(audioDirs[d].dir, file.leafName.replace(/_.*$/, ""), shortName, chapter, AUDEXT[e], fcode[2]);
          }
          else aFile = getThisAudioFile(audioDirs[d].dir, file.leafName.replace(/_.*$/, ""), shortName, chapter, AUDEXT[e]);
          if (aFile && aFile.exists()) return aFile;
        }
      }
    }
  }
  return null;
}

function getAudioRelatedFile(dirName, fileName, audioDirs) {
  if (!audioDirs) audioDirs = getAudioDirs();
  var aFile;
  for (var d=0; d<audioDirs.length; d++) {
    aFile = audioDirs[d].dir.clone();
    if (dirName) aFile.append(dirName);
    aFile.append(fileName);
    if (aFile.exists()) return aFile;
  }
  return null;
}

/************************************************************************
 * QuickTime player and installation functions
 ***********************************************************************/ 
  
function beginAudioPlayer() {
  document.getElementById("historyButtons").hidden = true;
  document.getElementById("player").hidden = false;
  document.getElementById("playerFrame").contentDocument.defaultView.location.reload();
}

function endAudioPlayer() {
  jsdump("CLosing Player\n");
  document.getElementById("playerFrame").contentDocument.getElementById("playerDiv").innerHTML = "";
  document.getElementById("historyButtons").hidden = false;
  document.getElementById("player").hidden = true;
}

// Checks QuickTime installation and version:
// If not installed, a message is given, and then QT may be installed if available (non-blocking,
// with option to start player once finished). False is returned.
// If version is too old, a message is given, and then false is returned.
// If everything is good, true is returned with no message.
var AlreadyPrompted;
function checkQuickTime() {
  var haveQT = isQTInstalled();
  var haveOKQT = isQTVersionOK();
  
  if (haveQT && haveOKQT) return true;
  if (!haveQT) {
    jsdump("QuickTime not installed\n");
    for (var f=QTIMEINS.length-1; f>=0; f--) {
      var installer = getAudioRelatedFile(AUDIOPLUGIN, QTIMEINS[f]);
      if (installer) break;
    }
    if (!installer) {
      try {var msg = SBundle.getString("MustInstallQuickTime") + "\n\n";}
      catch (er) {msg = SBundle.getString("Want2InstallQuickTime") + "\n\n";} //BACKWARD COMPATIBILITY
      for (var k=0; k<PLUGINLINKS.length; k++) {msg += PLUGINLINKS[k] + "\n";}
      msg += "\n";
      var result = {};
      var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result,
          fixWindowTitle(SBundle.getString("Title")),
          msg,
          DLGINFO,
          DLGOK);
    }
    else installQT(installer);

    return false;
  }
  
  if (haveQT && !haveOKQT && !AlreadyPrompted) {
    try {var msg = SBundle.getString("QuickTimeUpdateNeeded2");}
    catch (er) {msg = SBundle.getString("QuickTimeUpdateNeeded");} //BACKWARD COMPATIBILITY
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result,
        fixWindowTitle(SBundle.getString("Title")),
        msg,
        DLGINFO,
        DLGOK);
    AlreadyPrompted = true;
  }
  
  return false;
}

// Returns value of key if plugin is installed, null otherwise
function isQTInstalled() {
  var retval=null;
  if (typeof Components.classes["@mozilla.org/windows-registry-key;1"] == "undefined") return null;
  try {
    var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\Apple Computer, Inc.\\QuickTime",wrk.ACCESS_READ);
    var retval = wrk.readStringValue("InstallDir");
    wrk.close();
  }
  catch (er) {retval=null;}
  return retval;
}

function isQTVersionOK() {
  var retval=null;
  if (typeof Components.classes["@mozilla.org/windows-registry-key;1"] == "undefined") return false;
  try {
    var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\Apple Computer, Inc.\\QuickTime",wrk.ACCESS_READ);
    var retval = wrk.readInt64Value("Version");
    wrk.close();
  }
  catch (er) {retval=0;}
  return (retval > 119603200); // which is 0x07210000, or version 7.2.1 - the first QT version supporting DOM events
}

// Tries to install QuickTime and returns true if the install was started, false otherwise...
function installQT(installerFile) {
	if (!installerFile || !installerFile.exists()) return false;
	
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      fixWindowTitle(SBundle.getString("Title")),
      SBundle.getString("Want2InstallQuickTime"), 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return false;
  
  quietQTInstallWin(installerFile);
  return true;
}

function quietQTInstallWin(aInstaller) {
  jsdump("Installing plugin file \"" + aInstaller.leafName + "\":");
  var iniPath = aInstaller.path.replace(/\.exe$/i, ".ini");
  
  // IMPORTANT: nsIProcess can only use the program's run directory for the new process's run directory, but
  // QT install requires that it be started from its own directory in order to successfully locate its .ini
  // (passing the full path to .exe and/or .ini does NOT fix this limitation). This requires a script of some
  // sort to CD into the QT installer directory and start the QT installer from there.
  // BAT script cannot handle Unicode file names, so all file names must be ASCII and must be copied to TmpD.
  var tmp = getSpecialDirectory("TmpD");
  var ini = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  ini.initWithPath(lpath(iniPath));
  var tmpini = tmp.clone(); tmpini.append(ini.leafName);
  if (tmpini.exists()) tmpini.remove(false);
  ini.copyTo(tmp, ""); // copy .ini to TmpD
  var tmpexe = tmp.clone(); tmpexe.append(aInstaller.leafName);
  if (tmpexe.exists()) tmpexe.remove(false);
  aInstaller.copyTo(tmp, ""); // copy .ini to TmpD
  var installMon = tmp.clone();
  installMon.append("xsQTinstallmon.txt");
  if (installMon.exists()) installMon.remove(false);
  var batdata = "@cd /D \"" + tmp.path + "\"\r\n";
  batdata += "@echo Installing QuickTime Lite Plugin\r\n@echo.\r\n@echo Please wait...\r\n@\"" + tmpexe.leafName + "\" /verysilent /norestart /LoadInf=\"" + tmpini.leafName + "\"\r\n@echo Done!";
  batdata += "\r\n@echo Done! > \"" + installMon.path + "\"";
  launchTempScript(batdata, "bat");
  
  Player.installMon = installMon;
  Player.installMonCnt = 0;
  Player.installTmps = [tmpini, tmpexe];
  Player.installMonInterval = window.setInterval("isQTInstallDone();", 500);
}

function isQTInstallDone() {
  // wait max 5 minutes...
  if (Player.installMonCnt++ > 600) window.clearInterval(Player.installMonInterval);
  if (Player.installMon.exists()) {
    Player.installMon.remove(false);
    for (var i=0; i<Player.installTmps.length; i++) Player.installTmps[i].remove(false);
    window.clearInterval(Player.installMonInterval)
    window.setTimeout("restartApplication();", 500);
  }
}

/************************************************************************
 * Audio import functions
 ***********************************************************************/  
function importAudio(fromDir, toDir, doNotCopyFiles) {
  var audioDirs = getAudioDirs();
  const kFilePickerContractID = "@mozilla.org/filepicker;1";
  const kFilePickerIID = Components.interfaces.nsIFilePicker;
  const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
  if (!fromDir || doNotCopyFiles) {
    try {
      var kTitle = fixWindowTitle(document.getElementById("savingSource").childNodes[0].nodeValue);
      for (var i=0; i<audioDirs.length; i++) {
        if (audioDirs[i].isInstallDir && audioDirs[i].dir.exists()) {
          kFilePicker.displayDirectory = audioDirs[i].dir;
          kFilePicker.defaultString = "Audio";
        }
      }
      kFilePicker.init(window, kTitle, kFilePickerIID.modeGetFolder);
      kFilePicker.show();
      if (kFilePicker.file) fromDir = kFilePicker.file;
    }
    catch (e) {fromDir = null;}
  }
  
  if (!toDir) toDir = importAudioTo();
  if (!toDir) return false;
  
  if (fromDir && !doNotCopyFiles) {
    if (getFileSize(fromDir) > toDir.diskSpaceAvailable) {
      diskSpaceMessage(fromDir.leafName);
      return false;
    }
    else return installModuleArray(false, true, finishAndHandleReset, [fromDir], toDir);
  }

  // no fromDir or doNotCopyFiles...
  audioDirPref(toDir); // allow setting of pref without copy
  Texts.update(SCROLLTYPETOP, HILIGHTNONE);
  return false;
}

function diskSpaceMessage(fromLeafName) {
  Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
  var msg;
  try {
    msg = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle("chrome://xulsword/locale/module.properties")
    .formatStringFromName("diskFull", [fromLeafName], 1);
  }
  catch (er) {msg = "Not enough disk space for this operation.";}
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result,
      fixWindowTitle(document.getElementById("menu.importAudio.label").childNodes[0].nodeValue),
      msg,
      DLGALERT,
      DLGOK);
}

function importAudioTo() {
  const kFilePickerContractID = "@mozilla.org/filepicker;1";
  const kFilePickerIID = Components.interfaces.nsIFilePicker;
  const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
  try {
    var kTitle = fixWindowTitle(document.getElementById("savingTarget").childNodes[0].nodeValue);
    kFilePicker.init(window, kTitle, kFilePickerIID.modeGetFolder);
    if (kFilePicker.show() == kFilePickerIID.returnCancel) return false;
  }
  catch (e) {return false;}
  if (!kFilePicker.file) return false;
  return kFilePicker.file;
}

function audioDirPref(aDir) {
  var audioDirs = getAudioDirs();
  var n = getPrefOrCreate("NumAudioImportDirs", "Int", 0);
  aDir = aDir.QueryInterface(Components.interfaces.nsILocalFile);
  if (aDir.equals(getSpecialDirectory("xsAudio"))) return;
  for (var i=0; i<audioDirs.length; i++) {if (aDir.equals(audioDirs[i].dir)) return;}
  // prefs may not be same as audioDirs so check them too...
  for (i=0; i<n; i++) {if (aDir.equals(prefs.getComplexValue("AudioImportDir" + i, Components.interfaces.nsILocalFile))) return;}
  prefs.setComplexValue("AudioImportDir" + n, Components.interfaces.nsILocalFile, aDir);
  n++;
  prefs.setIntPref("NumAudioImportDirs", n);
  if (MainWindow) MainWindow.AudioDirs = null; // invalidate so that it will be refreshed when next used
}

function getFileSize(aFile) {
  var s = 0;
  aFile = aFile.QueryInterface(Components.interfaces.nsIFile);
  if (!aFile || !aFile.exists()) return s;
  if (!aFile.isDirectory()) s = aFile.fileSize;
  else {
    var subs = aFile.directoryEntries;
    while (subs && subs.hasMoreElements()) {s += getFileSize(subs.getNext());}
  }
  return s;
}

/************************************************************************
 * Audio export functions
 ***********************************************************************/ 
var Success;
var Files;
var Index;
var ADestFolder;
var ExportFileFormat;
var ExportAnotherFile;
const AUDIOFILELOC=0, AUDIOFILESIM=1, AUDIOFILEXSM=2;
function exportAudio(exportFileFormat) {
  try {
    const kFilePickerContractID = "@mozilla.org/filepicker;1";
    const kFilePickerIID = Components.interfaces.nsIFilePicker;
    const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    
    const kTitle = fixWindowTitle(document.getElementById("menu.exportAudio.label").childNodes[0].nodeValue);
    kFilePicker.init(window, kTitle, kFilePickerIID.modeGetFolder);
    if (kFilePicker.show() == kFilePickerIID.returnCancel) return false;
  }
  catch (e) {
    return false;
  }
  
  Success = true;
  Files = [];
  Index = 0;
  ADestFolder = kFilePicker.file.clone();
  if (!ADestFolder.exists()) ADestFolder.create(ADestFolder.DIRECTORY_TYPE, DPERM);
  ExportFileFormat = exportFileFormat;
  jsdump("Beginnig audio export to: " + kFilePicker.file.path);
  var audioDirs = getAudioDirs();
  if (ADestFolder && ADestFolder.isDirectory() && audioDirs.length) {
    for (var d=audioDirs.length-1; d>=0; d--) {
      if (!audioDirs[d].isExportable || !audioDirs[d].dir.exists() || !audioDirs[d].dir.isDirectory()) continue;
      exportThisFolder(audioDirs[d].dir, ADestFolder);
    }
  }
  
  if (!Files || !Files.length) return false;
  
  var result = {};
  ProgressMeter = window.openDialog("chrome://xulsword/content/workProgress.xul", "work-progress", PMSTD, result, 
      fixWindowTitle(document.getElementById("menu.exportAudio.label").childNodes[0].nodeValue),
      "", 
      PMSTOP,
      stopExport);
  CountTotal = (Files ? Files.length:0);
  CountCurrent = 0;
  
  ExportAnotherFile = window.setTimeout("copyFiles();", TIMEOUT);
  return true;
}

function stopExport() {
  if (ExportAnotherFile) window.clearTimeout(ExportAnotherFile);
  finishExport();
}
  
function copyFiles() {
  if (Files[Index]) Success &= exportThisFile(Files[Index], ADestFolder, ExportFileFormat);
  Index++;
  try {if (ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));}
  catch (er) {}
  if (Index==Files.length) finishExport();
  else ExportAnotherFile = window.setTimeout("copyFiles();", TIMEOUT);
}

function finishExport() {
  if (!Success) Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();

  if (ProgressMeter) {
    if (ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100);
    window.setTimeout("ProgressMeter.close();", 1000);
  }
  ModuleCopyMutex=false;
}

function exportThisFolder(aFolder, aDestFolder) {
  var files = aFolder.QueryInterface(Components.interfaces.nsIFile).directoryEntries;
  while (files.hasMoreElements()) {
    var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (file.isDirectory()) exportThisFolder(file, aDestFolder);
    else Files.push(file);
  }
}

function exportThisFile(aFile, aDestFolder, localized) {
  var sep = "";
  var re = AUDIO + "\\\\([^\\\\]+)\\\\([^\\\\]+)\\\\(\\d+)\\.(";
  for (var e=0; e<AUDEXT.length; e++) {re += sep + AUDEXT[e]; sep = "|";}
  re += ")$";
  var re = new RegExp(re);
  var parts = aFile.path.match(re);
  if (!parts) {jsdump("WARNING not copying: " + aFile.path); return true;}
  
  var newFile;
  try {
    switch(localized) {
    case AUDIOFILELOC:
      newFile = getLocalizedAudioFile(aDestFolder, parts[1].toLowerCase(), parts[2], parts[3], parts[4], getLocale());
      break;
    case AUDIOFILESIM:
      newFile = getThisAudioFile(aDestFolder, parts[1].toLowerCase(), parts[2], parts[3], parts[4]);
      break;
    case AUDIOFILEXSM:
      newFile = getXSModAudioFile(aDestFolder, parts[1].toLowerCase(), parts[2], parts[3], parts[4]);
      break;
    }

    if (!newFile) {jsdump("Failed to parse audio file name: " + aFile.path); return false;}
    if (!newFile.parent.exists()) newFile.parent.create(newFile.DIRECTORY_TYPE, DPERM);
    if (newFile.exists()) newFile.remove(false);
  }
  catch (er) {sdump("ERROR making parent folder for " + aFile.path); return false;}
  
  try {aFile.copyTo(newFile.parent, newFile.leafName);}
  catch (er) {jsdump("Failed to copy " + aFile.path); return false;}
  return true;
}

function getLocalizedAudioFile(aDir, basecode, shortName, chapter, ext, locale) {
  chapter = Number(chapter);
  var localeBundle = getLocaleBundle(locale, "books.properties");
  try {var ok = (localeBundle && localeBundle.GetStringFromName("Matt"))} catch (er) {ok=false;}
  if (!ok) return null;
  var bnl = Number(localeBundle.GetStringFromName(shortName + "i"));
  var bns = ((bnl+1)<10 ? "0":"") + String(bnl+1);
  var cns =  padChapterLocalized(shortName, chapter);
  try {var lbk = localeBundle.GetStringFromName("Long" + shortName);}
  catch (er) {lbk = localeBundle.GetStringFromName(shortName);}
  var chapTerm = getLocalizedChapterTerm(shortName, chapter, localeBundle, locale).replace(/^[\s\d-]*/, "").replace(/[\s\d-]*$/, "");
  var path = aDir.path + "/" + basecode + "_" + locale + "/" + bns + "-" + lbk + "/" + cns + "-" + chapTerm + "." + ext;
  var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  aFile.initWithPath(lpath(path));
  return aFile;
}

function getThisAudioFile(aDir, code, shortName, chapter, ext) {
  chapter = Number(chapter);
  var bn = findBookNumPreMainWin(shortName);
  if (bn===null) return null;
  var path = aDir.path + "/" + code + "/" + shortName + "/" + padChapterNum(chapter) + "." + ext;
  var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  aFile.initWithPath(lpath(path));
  return aFile;
}

function getXSModAudioFile(aDir, code, shortName, chapter, ext) {
  chapter = Number(chapter);
  var bn = findBookNumPreMainWin(shortName);
  if (bn===null) return null;
  var path = aDir.path + "/" + code + "/" + code + "-" + shortName + "-" + padChapterNum(chapter) + "." + ext;
  var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  aFile.initWithPath(lpath(path));
  return aFile;
}

function getModsUsingAudioCode(basecode) {
  var list = [];
  if (!basecode) return list;
  if (Tab[basecode]) list.push(basecode);
  else if (Tab[basecode.toUpperCase()]) list.push(basecode.toUpperCase());
  var matchAudioCode = MainWindow.getModsWithConfigEntry("AudioCode", basecode, true, true, false);
  if (matchAudioCode && matchAudioCode[0]) list = list.concat(matchAudioCode);
  var matchLang = MainWindow.getModsWithConfigEntry("Lang", basecode.replace(/-.*$/, ""), true, true, true);
  if (matchLang && matchLang[0]) list = list.concat(matchLang);
  
  return list;
}

function padChapterLocalized(shortName, chapterNumber, atLeast2Digits) {
  const bksFewChaps = ["Ruth", "Song", "Lam", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Mal", "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm"];

  var numChaps = 10;
  if (shortName == "Ps") numChaps = 100;
  else {for (var i=0; i<bksFewChaps.length; i++) {if (shortName == bksFewChaps[i]) {numChaps = 1; break;}}}
  
  var cn = "";
  if (numChaps>99 && chapterNumber<=99) cn += "0";
  if (numChaps>9  && chapterNumber<=9)  cn += "0";
  if (numChaps<=9 && chapterNumber<=9 && atLeast2Digits) cn += "0";
  cn += String(chapterNumber);
  return cn;
}

function findBookNumPreMainWin(shortName) {
  var bundle = getCurrentLocaleBundle("books.properties");
  try {var bnum = bundle.GetStringFromName(shortName + "i");}
  catch (er) {bnum = null; jsdump("Book \"" + shortName + "\" is not in books.properties.");}
  if (bnum !== null) bnum = Number(bnum);

  return bnum;
}
