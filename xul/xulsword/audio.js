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
var AudioDirs;
var AudioRegKeyIndex;
var AudioRegMounted;
//NOTE: All audio dir paths returned by this function must end with backslash.
// The first audio dir is the user profile's audio dir.
// For Backward Compatibility, if there is audio in the Program Files install dir, add it.
// Add the audio dir that is that pointed to by the AudioDir registry key.
function initAudioDirs() {
  AudioRegKeyIndex=-1;
  AudioDirs = [];
  AudioRegMounted=false;
  //Check user profile- THIS SHOULD BE FIRST IN AudioDirs ARRAY
  var resAudio = getSpecialDirectory("xsAudio");
  if (resAudio.exists() && resAudio.isDirectory() && resAudio.directoryEntries.hasMoreElements()) AudioDirs.push(resAudio.path + "\\");
  
  //Check AudioDir registry key location
  var path;
  var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
  try {
    wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\" + appInfo.vendor + "\\" + appInfo.name,wrk.ACCESS_READ);
    path = wrk.readStringValue("AudioDir");
    path = path.replace("\\Install\\setup\\..\\..","") + "\\";
  }
  catch (er) {}
  //for Backward Compatibility...
  if (!path) {
    try {
      wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,"SOFTWARE\\" + appInfo.vendor,wrk.ACCESS_READ);
      path = wrk.readStringValue("AudioDir");
      path = path.replace("\\Install\\setup\\..\\..","") + "\\";
    }
    catch (er) {}
  }

  if (!path) jsdump("Could not read audio registry keys: HKLM\\SOFTWARE\\" + appInfo.vendor + "or HKLM\\SOFTWARE\\" + appInfo.vendor + "\\" + appInfo.name + "\n");
  else {
    var regDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    regDir.initWithPath(path);
    AudioDirs.push(regDir.path + "\\");
    AudioRegKeyIndex = AudioDirs.length-1;
    if (regDir.exists()) AudioRegMounted=true;
  }
  
  //for Backward Compatibility...
  resAudio = getSpecialDirectory("resource:app");
  resAudio.append(AUDIO);
  if (resAudio.exists() && resAudio.isDirectory() && resAudio.directoryEntries.hasMoreElements()) AudioDirs.push(resAudio.path + "\\");

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
  jsdump("CLosing Player\n");
  document.getElementById("playerFrame").contentDocument.getElementById("playerDiv").innerHTML = "";
  document.getElementById("historyButtons").hidden = false;
  document.getElementById("player").hidden = true;
}

// Checks QuickTime installation and version:
// If not installed, a message is given, and then QT may be installed if available (non-blocking,
// with option to start player once finished). False is returned.
// If version is too old, a message is given, and then true is returned (then whatever QT version
// there is can try and play the file).
// If everything is good, true is returned with no message.
var AlreadyPrompted;
function checkQuickTime(startPlayerAfterInstall) {
  var haveQT = isQTInstalled();
  var haveOKQT = isQTVersionOK();
  
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
          SBundle.getString("Title"),
          msg,
          DLGINFO,
          DLGOK);
    }
    else installQT(installer, startPlayerAfterInstall);

    return false;
  }
  
  if (haveQT && !haveOKQT && !AlreadyPrompted) {
    try {var msg = SBundle.getString("QuickTimeUpdateNeeded2");}
    catch (er) {msg = SBundle.getString("QuickTimeUpdateNeeded");} //BACKWARD COMPATIBILITY
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result,
        SBundle.getString("Title"),
        SBundle.getString("QuickTimeUpdateNeeded"),
        DLGINFO,
        DLGOK);
    AlreadyPrompted = true;
  }
  
  return true;
}

// Returns value of key if plugin is installed, null otherwise
function isQTInstalled() {
  var retval=null;
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
function installQT(installerFile, startPlayerAfterInstall) {
	if (!installerFile || !installerFile.exists()) return false;
	
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      SBundle.getString("Title"), 
      SBundle.getString("Want2InstallQuickTime"), 
      DLGQUEST,
      DLGYESNO);
  if (!result.ok) return false;
  
  quietQTInstallWin(installerFile, startPlayerAfterInstall);
  return true;
}

function quietQTInstallWin(aInstaller, startPlayerAfterInstall) {
  jsdump("Installing plugin file \"" + aInstaller.leafName + "\":");
  var iniPath = aInstaller.path.replace(/\.exe$/i, ".ini");
  
  // IMPORTANT: nsIProcess can only use the program's run directory for the new process's run directory, but
  // QT install requires that it be started from its own directory in order to successfully locate its .ini
  // (passing the full path to .exe and/or .ini does NOT fix this limitation). This requires a script of some
  // sort to CD into the QT installer directory and start the QT installer from there.
  // BAT script cannot handle Unicode file names, so all file names must be ASCII and must be copied to TmpD.
  var tmp = getSpecialDirectory("TmpD");
  var ini = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  ini.initWithPath(iniPath);
  var tmpini = tmp.clone(); tmpini.append(ini.leafName);
  if (tmpini.exists()) tmpini.remove(false);
  ini.copyTo(tmp, ""); // copy .ini to TmpD
  var tmpexe = tmp.clone(); tmpexe.append(aInstaller.leafName);
  if (tmpexe.exists()) tmpexe.remove(false);
  aInstaller.copyTo(tmp, ""); // copy .ini to TmpD
  var installMon = tmp.clone();
  installMon.append("xsQTinstallmon.txt");
  if (installMon.exists()) installMon.remove(false);
  var batdata = "@cd \"" + tmp.path + "\"\r\n";
  batdata += "@echo Installing QuickTime Lite Plugin\r\n@echo.\r\n@echo Please wait...\r\n@\"" + tmpexe.leafName + "\" /verysilent /norestart /LoadInf=\"" + tmpini.leafName + "\"\r\n@echo Done!";
  batdata += "\r\n@echo Done! > \"" + installMon.path + "\"";
  launchTempScript(batdata, "bat");
  
  Player.installMon = installMon;
  Player.installMonCnt = 0;
  Player.installTmps = [tmpini, tmpexe];
  Player.installStartPlayer = startPlayerAfterInstall;
  Player.installMonInterval = window.setInterval("isQTInstallDone();", 500);
}

function isQTInstallDone() {
  // wait max 3 minutes...
  if (Player.installMonCnt++ > 360) window.clearInterval(Player.installMonInterval);
  if (Player.installMon.exists()) {
    Player.installMon.remove(false);
    for (var i=0; i<Player.installTmps.length; i++) Player.installTmps[i].remove(false);
    window.clearInterval(Player.installMonInterval)
    if (Player.installStartPlayer) beginAudioPlayer();
  }
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
