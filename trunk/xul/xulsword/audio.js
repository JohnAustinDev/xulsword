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
var AudioDirs;
var AudioRegKeyIndex;
var AudioRegMounted;
//NOTE: All audio dir paths returned by this function must end with backslash.
// The first audio dir is the program directory's audio dir.
// The second audio dir is that pointed to by the AudioDir registry key.
function initAudioDirs() {
  AudioRegKeyIndex=-1;
  AudioDirs = [];
  AudioRegMounted=false;
  //Check program directory- THIS SHOULD BE FIRST IN AudioDirs ARRAY
  var appDir = Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties).
      get("resource:app", Components.interfaces.nsIFile);
  appDir.append(AUDIO);
  if (!appDir.exists) appDir.create(appDir.DIRECTORY_TYPE , 0777);
  if (appDir.exists() && appDir.isDirectory() && appDir.directoryEntries.hasMoreElements()) AudioDirs.push(appDir.path + "\\");
  
  //Check AudioDir registry key location
  var path;
  var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
  var vendor = appInfo.vendor;
  try {
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\" + vendor,wrk.ACCESS_READ);
    path = wrk.readStringValue("AudioDir");
    path = path.replace("\\Install\\setup\\..\\..","") + "\\";
  }
  catch (er) {
    jsdump("Could not read audio registry key: HKLM\\SOFTWARE\\" + vendor + "\n");
    path=null;
  }
  if (path) {
    var regDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    regDir.initWithPath(path);
    AudioDirs.push(regDir.path + "\\");
    AudioRegKeyIndex = AudioDirs.length-1;
    if (regDir.exists()) AudioRegMounted=true;
  }
  jsdump("Audio:" + AudioDirs);
}

// Audio files are chosen as follows:
//    1) Look for audio matching the module name.
//    2) If not found, get audio matching the module's "AudioCode" if it exists.
//    3) If still not found, look for audio matching the module's "Lang".
//    4) If still not found, there is no audio...
function getAudioForChapter(version, bookShortName, chapterNumber) {
  var cn = padChapterNum(chapterNumber);

  var ret = getAudioFile(version, bookShortName, cn);
  if (ret) return ret;
    
  var audioCode = Bible.getModuleInformation(version, "AudioCode");
  if (audioCode!=NOTFOUND) {
    ret = getAudioFile(audioCode, bookShortName, cn);
    if (ret) return ret;
  }
  
  ret = getAudioFile(Bible.getModuleInformation(version, "Lang"), bookShortName, cn);
  if (ret) return ret;
  
  return null;
}

function getAudioFile(dirName, subFolder, fileName) {
  var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  for (var d=0; d<AudioDirs.length; d++) {
    for (var e=0; e<AUDEXT.length; e++) {
      aFile.initWithPath(AudioDirs[d] + dirName + "\\" + subFolder + "\\" + fileName + "." + AUDEXT[e]);
      if (aFile.exists()) return aFile;
    }
  }
  return null;
}

function getAudioRelatedFile(dirName, fileName) {
  dirName = (dirName ? dirName + "\\":"");
  var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  for (var d=0; d<AudioDirs.length; d++) {
    aFile.initWithPath(AudioDirs[d] + dirName + fileName);
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
  if (MainWindow.CheckPlayer) {
    jsdump("CLosing Player\n");
    clearInterval(MainWindow.CheckPlayer);
  }
  document.getElementById("playerFrame").contentDocument.getElementById("playerDiv").innerHTML = "";
  document.getElementById("historyButtons").hidden = false;
  document.getElementById("player").hidden = true;
}

function checkQuickTime() {
  if (isQTInstalled()) return true;
  
  jsdump("QuickTime not installed\n");
  if (getPrefOrCreate("AlreadyInstalledQuickTime", "Bool", false)) {
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        SBundle.getString("Title"), 
        SBundle.getString("QuickTimeUpdateNeeded"), 
        DLGINFO,
        DLGOK);
  }
  for (var f=0; f<QTIMEINS.length; f++) {
    var installer = getAudioRelatedFile(AUDIOPLUGIN, QTIMEINS[f]);
    if (installer) break;
  }
  if (!installer) {
    //BACKWARD COMPATIBILITY
    try {var msg = SBundle.getString("MustInstallQuickTime") + "\n\n";}
    catch (er) {msg = SBundle.getString("Want2InstallQuickTime") + "\n\n";}
    for (var k=0; k<PLUGINLINKS.length; k++) {msg += PLUGINLINKS[k] + "\n";}
    msg += "\n";
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        SBundle.getString("Title"), 
        msg, 
        DLGINFO,
        DLGOK);
    return false;
  }
  return installQT(installer);
}

// Returns value of key if plugin is installed, null otherwise
function isQTInstalled() {
  var retval=null;
  try {
    var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\Apple Computer, Inc.\\QuickTime\\Installed MIME Types",wrk.ACCESS_READ);
    var retval = wrk.readStringValue("audio/mp3");
    wrk.close();
  }
  catch (er) {retval=null;}
  return retval;
}

// Tries to install QuickTime and returns true if the install was finished, false otherwise...
function installQT(installerFile, showWaitDialog) {
	if (!installerFile || !installerFile.exists()) return false;
	
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      SBundle.getString("Title"), 
      SBundle.getString("Want2InstallQuickTime"), 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return false;
  
  quietQTInstallWin(installerFile);
  prefs.setBoolPref("AlreadyInstalledQuickTime", true);
	
	if (showWaitDialog) {
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        SBundle.getString("Title"), 
        SBundle.getString("WaitForQuickTimeInstall"), 
        DLGINFO,
        DLGOK);
    return true;
  }
  
  return false; //false means QT is not already installed (but is installing)
}

function quietQTInstallWin(aInstaller) {
  jsdump("Installing plugin file \"" + aInstaller.leafName + "\":");
  var iniPath = aInstaller.path.replace(/\.exe$/i, ".ini");
  var batdata = "@echo Installing QuickTime Lite Plugin\r\n@echo.\r\n@echo Please wait...\r\n@\"" + aInstaller.path + "\" /verysilent /norestart /LoadInf=\"" + iniPath + "\"\r\n@echo Done!";
  launchTempScript("bat", batdata);
}


/************************************************************************
 * Audio import functions
 ***********************************************************************/  
function importAudio() {
  initAudioDirs();
  
  try {
    const kFilePickerContractID = "@mozilla.org/filepicker;1";
    const kFilePickerIID = Components.interfaces.nsIFilePicker;
    const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    const kTitle = fixWindowTitle(document.getElementById("menu.importAudio.label").childNodes[0].nodeValue);
    if (AudioRegKeyIndex!=-1) {
      var def = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      def.initWithPath(AudioDirs[AudioRegKeyIndex]);
      if (def.exists()) {
        kFilePicker.displayDirectory = def;
        kFilePicker.defaultString = "Audio";
      }
    }
    kFilePicker.init(window, kTitle, kFilePickerIID.modeGetFolder);
    if (kFilePicker.show() == kFilePickerIID.returnCancel) return false;
  }
  catch (e) {
    return false;
  }
  
  if (!kFilePicker.file) return;
  return installModuleArray([kFilePicker.file], true);
}

/************************************************************************
 * Audio export functions
 ***********************************************************************/ 
var Success;
var Files;
var Index;
var ADestFolder;
var ExportFormat;
var ExportAnotherFile;
function exportAudio(toSimpleFormat) {
  toSimpleFormat = toSimpleFormat ? true:false;
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
  ADestFolder.append(AUDIO);
  if (!ADestFolder.exists()) ADestFolder.create(ADestFolder.DIRECTORY_TYPE, 0777);
  ExportFormat = toSimpleFormat;
  jsdump("Beginnig audio export to: " + kFilePicker.file.path);
  if (ADestFolder && ADestFolder.isDirectory() && AudioDirs.length) {
    for (var d=AudioDirs.length-1; d>=0; d--) {
      var toExport = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      toExport.initWithPath(AudioDirs[d]);
      if (!toExport.exists()) continue;
      exportThisFolder(toExport, ADestFolder);
    }
  }
  
  var result = {};
  ProgressMeter = window.openDialog("chrome://xulsword/content/workProgress.xul", "work-progress", PMSTD, result, 
      document.getElementById("menu.exportAudio.label").childNodes[0].nodeValue, 
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
  if (Files[Index]) Success &= exportThisFile(Files[Index], ADestFolder, ExportFormat);
  Index++;
  if (ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));
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
  
function exportThisFile(aFile, aDestFolder, toSimpleFormat) {
  var sep = "";
  var re = AUDIO + "\\\\([^\\\\]+)\\\\([^\\\\]+)\\\\(\\d+)\\.(";
  for (var e=0; e<AUDEXT.length; e++) {re += sep + AUDEXT[e]; sep = "|";}
  re += ")$";
  var re = new RegExp(re);
  var parts = aFile.path.match(re);
  if (!parts) {jsdump("WARNING not copying: " + aFile.path); return true;}
  
  var name = parts[1];
  var bookNum = findBookNum(parts[2]);
  if (bookNum==null) {jsdump("ERORR unknown book: \"" + parts[2] + "\" in " + aFile.path); return false;}
  var chapter = Number(parts[3]);
  var ext = parts[4];
  
  var bns = ((bookNum+1)<10 ? "0":"") + String(bookNum+1);
  var cns = padChapterNumForExport(bookNum, chapter);

  var chapTerm = getLocalizedChapterTerm(parts[2], chapter, getCurrentLocaleBundle("books.properties")).replace(/^[\s\d-]*/, "").replace(/[\s\d-]*$/, "");
  
  try {
    var newParent = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    if (!toSimpleFormat) {
      newParent.initWithPath(aDestFolder.path + "\\" + name + "\\" + bns + "-" + Book[bookNum].bNameL);
      var fileName = cns + "-" + chapTerm + "." + ext;
    }
    else {
      newParent.initWithPath(aDestFolder.path + "\\" + name); // + "\\" + bns + "-" + Book[bookNum].bNameL);
      fileName = name + "-" + parts[2] + "-" + padChapterNumForExport(bookNum, chapter, true) + "." + ext;
    }
    if (!newParent.exists()) newParent.create(newParent.DIRECTORY_TYPE, 0777);
    var newFile = newParent.clone();
    newFile.append(fileName);
    if (newFile.exists()) newFile.remove(false);
  }
  catch (er) {sdump("ERROR making parent folder for " + aFile.path); return false;}
  
  try {aFile.copyTo(newParent, fileName);}
  catch (er) {jsdump("Failed to copy " + aFile.path); return false;}
  return true;
}

function padChapterNumForExport(bookNum, chapterNumber, atLeast2Digits) {
  var numChaps = Book[bookNum].numChaps;
  var cn = "";
  if (numChaps>99 && chapterNumber<=99) cn += "0";
  if (numChaps>9  && chapterNumber<=9)  cn += "0";
  if (numChaps<=9 && chapterNumber<=9 && atLeast2Digits) cn += "0";
  cn += String(chapterNumber);
  return cn;
}
