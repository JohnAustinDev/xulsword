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

const SEP = ",";
const TIMEOUT = 25;
const AUDEXT = ["mp3", "wav", "aif"];
const XSMODEXT = ["zip", "xsm"];
const XSBMEXT = ["txt", "xsb"];
const XSVIDEXT = ["wmv", "mov", "mpeg", "mpg", "avi"];
const NOVALUE = -1;
const NORESET = 0;
const SOFTRESET = 1;
const HARDRESET = 2;
const NEWINSTALLFILE = "newInstalls.txt";
const MINPVERPAR = "minMKVersion";
const VERSIONTAG = new RegExp (VERSIONPAR + "\\s*=\\s*(.*)\\s*", "im");
const MINPROGVERSTAG = new RegExp(MINPVERPAR + "\\s*=\\s*(.*)\\s*", "im");
const MINVERSION = "1.0";

/*
  MODULE INSTALLATION
  Functions in this file install xulsword module components. A xulsword
  module consists of a zip compressed folder containing subdirectories.
  The subdirectory names correspond to the type of module component cont-
  ained within. Individual audio or bookmark files may also be installed 
  according to the file's name. An entire directory of audio files may
  also be installed at once. Installation may be initiated by command 
  line, drag-and-drop, or dialog interface.
  
  Installation may require restarting xulsword, or reloading the main window.
  A non-blocking install, showing a progress meter and using a callback, is
  available. So is a blocking installation (but blocking installation 
  requires that LibSword is either null, uninitialized, or paused before  
  the install process begins). Module components which are incompatible 
  with the current version of xulsword are rejected and a message with 
  details is displayed.
*/

var ModuleCopyMutex = false;

/************************************************************************
 * Module install functions
 ***********************************************************************/ 
function getEXTre(exts) {
  var sep="";
  var re ="(";
  for (var e=0; e<exts.length; e++) {re += sep + "\\." + exts[e]; sep="|";}
  re += ")$";
  return re
}
const AUDIOEXT = new RegExp(getEXTre(AUDEXT), "i");
const XSMODULEEXT = new RegExp(getEXTre(XSMODEXT), "i");
const XSBOOKMARKEXT = new RegExp(getEXTre(XSBMEXT), "i");
const XSVIDEOEXT = new RegExp(getEXTre(XSVIDEXT), "i");

function addNewModule(e) {
  // get a module file
  var files = null;
  try {
    const kFilePickerContractID = "@mozilla.org/filepicker;1";
    const kFilePickerIID = Components.interfaces.nsIFilePicker;
    const kTitle = fixWindowTitle(getDataUI("menu.addNewModule.label"));
    var kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    kFilePicker.init(window, kTitle, kFilePickerIID.modeOpenMultiple);
    kFilePicker.appendFilter("XSM, ZIP", "*.xsm; *.zip");
    if (kFilePicker.show() != kFilePickerIID.returnCancel) {
      if (!kFilePicker.files.hasMoreElements()) return false;
      files = kFilePicker.files;
    }
    else return false;
  }
  catch (e) {return false;}
  
  var fileArray = [];
  while (files.hasMoreElements()) {
    var aFile = files.getNext();
    aFile = aFile.QueryInterface(Components.interfaces.nsILocalFile);
    if (!aFile) break;
    fileArray.push(aFile);
  }
  
  return installModuleArray(finishAndHandleReset, fileArray);
}

function installModuleArray(exitFunction, fileArray, audioDestination) {
  var zipFiles = [];
  var zipEntry = [];
  var regularFiles = [];
  
  for (var f=0; f<fileArray.length; f++) {
    if (fileArray[f].leafName.match(XSMODULEEXT)) {
      var entries = readZipFile(fileArray[f]);
      if (entries && entries.length) {
        zipFiles.push(fileArray[f]);
        zipEntry.push(entries.sort(sortFiles));
      }
    }
    else if (fileArray[f].leafName.match(XSBOOKMARKEXT)) regularFiles.push(fileArray[f]);
    else if (fileArray[f].leafName.match(AUDIOEXT)) regularFiles.push(fileArray[f]);
    else if (fileArray[f].isDirectory()) pushAudioFilesInFolder(fileArray[f], regularFiles);
  }

  return startImport(false, exitFunction, regularFiles, zipFiles, zipEntry, [], [], [], audioDestination);
}

function pushAudioFilesInFolder(aFolder, audioFiles) {
  aFolder = aFolder.QueryInterface(Components.interfaces.nsIFile);
  if (!aFolder || !aFolder.isDirectory() || !aFolder.directoryEntries) return;
  var files = aFolder.directoryEntries;
  while (files.hasMoreElements()) {
    var aFile = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
    if (!aFile) continue;
    if (aFile.isDirectory()) pushAudioFilesInFolder(aFile, audioFiles);
    else if (!aFile.leafName.match(AUDIOEXT)) continue;
    else audioFiles.push(aFile);
  }
}

function readZipFile(aZipFile) {
  jsdump("Reading ZIP Module:" + aZipFile.path);
  var entryArray = [];
  var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
                        .createInstance(Components.interfaces.nsIZipReader);
  try {zReader.open(aZipFile);}
  catch (er) {jsdump("Error opening ZIP " + aZipFile.leafName + ". " + er); return [];}
  var entries = zReader.findEntries(null);
  while (entries.hasMore()) {
    var entryText = entries.getNext();
    try {var entryObj = zReader.getEntry(entryText);}
    catch (er) {jsdump("Error getting zip entry " + entryText + ". " + er); continue;}
    if (entryObj.isDirectory) continue;
    entryArray.push(entryText);
  }
  return entryArray;
}

function sortFiles(a,b) {
  var priority = [MANIFEST_EXT, MODSD];
  for (var ap=0; ap<priority.length; ap++) {if (a.match(priority[ap], "i")) break;}
  for (var bp=0; bp<priority.length; bp++) {if (b.match(priority[bp], "i")) break;}
  if (ap<bp) return -1;
  if (ap>bp) return 1;
  if (a<b) return -1;
  if (a>b) return 1;
  return 0;
}

var ResetNeeded;
var Success;
var GotoAudioFile;
var GotoBookmarkFile;
var GotoVideoFile;
var ZipFiles;
var ZipEntry;
var RegularFiles;
var ZipIndex;
var EntIndex;
var RegIndex;
var ExitFunction;
var NewLocales;
var NewModules;
var NewFonts;
var NewPlugin;
var PreMainWin;
var SkipList;
var CommonList;
var CopyZipFun;
var CopyRegularFun;
var CountTotal, CountCurrent;
var ProgressMeter, ProgressMeterLoaded;
var WillRestart = false;
var AudioDestination;
function startImport(blocking, exitFunction, regularFiles, zipFiles, zipEntry, newLocales, newModules, newFonts, audioDestination) {
jsdump("STARTING startImport");
  GotoAudioFile = null;
  GotoBookmarkFile = null;
  GotoVideoFile = null;
  ResetNeeded = NOVALUE;
  Success = true;
  SkipList = [];
  CommonList = [];
  ExitFunction = exitFunction;
  AudioDestination = (audioDestination ? audioDestination:getSpecialDirectory("xsAudio"));
  NewLocales = newLocales;
  NewModules = newModules;
  NewFonts   = newFonts;
  ZipFiles = zipFiles;
  ZipEntry = zipEntry;
  RegularFiles = regularFiles;
  ZipIndex = 0;
  EntIndex = 0;
  RegIndex = 0;
  CopyZipFun = (blocking ? copyZipFiles:copyZipFilesTO);
  CopyRegularFun = (blocking ? copyRegularFiles:copyRegularFilesTO);

  setPreMainWin();
  
  // show the progress meter?
  if (!blocking && (ZipFiles.length || RegularFiles.length>5)) {
    var result = {};
    ProgressMeterLoaded = false;
    AllWindows.push(window.openDialog("chrome://xulsword/content/common/workProgress.xul", "work-progress", PMSPLASH, result,
      fixWindowTitle(getDataUI("menu.addNewModule.label")),
      "", 
      PMNORMAL,
      null));
    ProgressMeter = AllWindows[AllWindows.length-1];
  }
  CountTotal = (ZipFiles ? ZipFiles.length:0) + (RegularFiles ? RegularFiles.length:0);
  CountCurrent = 0;
  
  // beep because there's nothing to install?
  if ((!ZipFiles || !ZipFiles.length) && (!RegularFiles || !RegularFiles.length)) {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("MODULE WAS EMPTY");
    if (ProgressMeter) ProgressMeter.close();
    return false;  
  }

  // remove incompatible components from the install lists
  var incomp = removeIncompatibleFiles(ZipFiles, ZipEntry);
  if (incomp.oldmodule.length || incomp.newmodule.length) {
    jsdump("There were incompatible components:");
    for (bf=0; bf<incomp.oldmodule.length; bf++) {jsdump("oldmodule:" + incomp.oldmodule[bf].leafName + ", minmodversion:" + incomp.minmodversion);}
    for (bf=0; bf<incomp.newmodule.length; bf++) {jsdump("newmodule:" + incomp.newmodule[bf].leafName + ", minprogversion:" + incomp.minprogversion);}
    try {var showPrompt = (!PreMainWin && XSBundle);} catch (er) {showPrompt = false;}
    if (showPrompt) {
      var msg = XSBundle.getString("InstalIncomplete") + "\n";
      if (incomp.oldmodule.length) {
        msg += XSBundle.getString("OutOfDate") + "\n\n";
        for (var bf=0; bf<incomp.oldmodule.length; bf++) {msg+="\"" + incomp.oldmodule[bf].leafName + "\"\n";}
        msg += "\n" + XSBundle.getFormattedString("MinModVersion2", [(incomp.minmodversion ? incomp.minmodversion:"?")]) + "\n\n";
      }
      if (incomp.newmodule.length) {
        // Try is for Backward Compatibility to previous UI. May be removed when new UI is released.
        try {
          msg += XSBundle.getString("TooNew") + "\n\n";
          for (var bf=0; bf<incomp.newmodule.length; bf++) {msg+="\"" + incomp.newmodule[bf].leafName + "\"\n";}
          msg += "\n" + XSBundle.getFormattedString("NeedUpgrade2", [(incomp.minprogversion ? incomp.minprogversion:"?")]) + "\n\n";
        }
        catch (er) {
          msg += "The following module(s) have components which are not supported:\n\n";
          for (var bf=0; bf<incomp.newmodule.length; bf++) {msg+="\"" + incomp.newmodule[bf].leafName + "\"\n";}
          msg += "\nUpgrade the program to at least version:\"" + (incomp.minprogversion ? incomp.minprogversion:"?") + "\"\n\n";
        }
      }
      if (ProgressMeter) ProgressMeter.close();
      Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      var result = {};
      var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result,
          fixWindowTitle(getDataUI("menu.addNewModule.label")),
          msg,
          DLGALERT,
          DLGOK);
    }
  }

  // LibSword may be in any state at this point: non-existant, uninitialized, 
  // failed, paused, or ready. If LibSword is initialized then it must be paused 
  // beyond this point so that new modules may be installed or deleted.
  if (typeof(LibSword) == "object") {
    
    // we need to bail under the following condition because LibSword.pause
    // does not support blocking.
    if (blocking && LibSword.libsword && !LibSword.paused) return false;
    
    LibSword.pause( { libswordPauseComplete:startImport2 } );
    
  }
  else startImport2();

  return true;
}

function startImport2() {
  
  if (ZipFiles && ZipFiles.length) CopyZipFun();
  else if (RegularFiles && RegularFiles.length) CopyRegularFun();
  // module is xulsword module, but contained nothing that needed to be, or could be, installed. Show progress meter so user knows it at least tried!
  else {
    if (typeof(ProgressMeter) != "undefined") {
      window.setTimeout("if (ProgressMeter.Progress) ProgressMeter.Progress.setAttribute('value', 90);", 500);
      window.setTimeout("if (ProgressMeter.Progress) ProgressMeter.Progress.setAttribute('value', 100);", 1500);
      window.setTimeout("ProgressMeter.close();", 2000);
    }
    ModuleCopyMutex=false;
  } 
  
}

// Checks compatibility of all sword modules and locales
function removeIncompatibleFiles(fileArray, entryArray) {
  var incomp = {newmodule:[], minprogversion:null, oldmodule:[], minmodversion:null};
  var manifest = new RegExp(CHROME + "\/[^\/]+" + MANIFEST_EXT + "$");
  var conf = new RegExp(MODSD + "\/[^\/]+" + CONF_EXT + "$");
  var comparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
  var progVersion = prefs.getCharPref("Version");
  // cannot read directly from engine because it's not loaded yet!
  var engineVersion; try {engineVersion = prefs.getCharPref("EngineVersion");} catch (er) {engineVersion = NOTFOUND;}

  var incompModsPath = [];
  var incompGUIs = [];
  for (var f=0; f<entryArray.length; f++) {
    var modHasIncompatibleNewComponents=false;
    var modHasIncompatibleOldComponents=false;
    for (var e=0; e<entryArray[f].length; e++) {
      // Manifest & Conf files
      if (entryArray[f][e].match(manifest) || entryArray[f][e].match(conf)) {
        var remove = false;
        var versioninfo = readVersion(fileArray[f], entryArray[f][e], progVersion);
//window.alert("compVers:" + versioninfo.compversion + ", minProgVers:" + versioninfo.minprogversion + ", type:" + versioninfo.type + ", path:" + versioninfo.path, + ", minCompVers:" + versioninfo.mincompversion);
        // Check version info
        if (!versioninfo) jsdump("Problem checking \"" + entryArray[f][e] + "\", retained file.");
        else if (versioninfo.error) entryArray[f].splice(e--, 1);
        else {
          if (!versioninfo.compversion) {jsdump("Unable to read version of " + entryArray[f][e]);}
          // If component version is less than the required component version, remove and report.
          // compare: a==b then x=0, a<b then x<0, a>b then x>0
          if (comparator.compare(versioninfo.compversion, versioninfo.mincompversion) < 0) {
            remove = true;
            if (!incomp.minmodversion) incomp.minmodversion = versioninfo.mincompversion;
            else incomp.minmodversion = (comparator.compare(versioninfo.mincompversion, incomp.minmodversion) < 0 ? incomp.minmodversion:versioninfo.mincompversion);
            if (!modHasIncompatibleOldComponents) {
              modHasIncompatibleOldComponents = true;
              incomp.oldmodule.push(fileArray[f]);
            }
          }
          // If program version is less than component's required program version, remove and report.
          if (comparator.compare(progVersion, versioninfo.minprogversion) < 0) {
            remove = true;
            if (!incomp.minprogversion) incomp.minprogversion = versioninfo.minprogversion;
            else incomp.minprogversion = (comparator.compare(versioninfo.minprogversion, incomp.minprogversion) < 0 ? incomp.minprogversion:versioninfo.minprogversion);
            if (!modHasIncompatibleNewComponents) {
              modHasIncompatibleNewComponents = true;
              incomp.newmodule.push(fileArray[f]);
            }   
          }
          // If component is compatible but will replace a component which is newer, remove it, and don't report.
          var overwriteInstalledVersion = null;
          var matchingXSmoduleTextVersion = null;
          if (versioninfo.type == CONF_EXT) {
            if (!versioninfo.xsmodulename) remove = true;
            // must read conf file directly because LibSword object is not necessarily available...
            else {
              var instconf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
              var xsModsUser = getSpecialDirectory("xsModsUser");
              instconf.initWithPath(lpath(xsModsUser.path + "/" + entryArray[f][e]));
              if (instconf.exists()) {
                overwriteInstalledVersion = readParamFromConf(instconf, VERSIONPAR);
                matchingXSmoduleTextVersion = readParamFromConf(instconf, "Version");
                if (!matchingXSmoduleTextVersion) matchingXSmoduleTextVersion = 0;
              }
              
							// If conf file's MinimumVersion is greater than program's own engine version, then remove
							if (versioninfo.xsmodulemineng && engineVersion != NOTFOUND &&
									comparator.compare(engineVersion, versioninfo.xsmodulemineng) < 0) {
							  remove = true;
							  modHasIncompatibleNewComponents = true;
              	incomp.newmodule.push(fileArray[f]);
							}
            }
          }
          else if (versioninfo.type == MANIFEST_EXT) {
            var locmanifest = getSpecialDirectory("AChrom");
            locmanifest.append(versioninfo.localename + ".locale.manifest");
            if (locmanifest.exists()) {
              var locfiledata = readFile(locmanifest);
              if (locfiledata) overwriteInstalledVersion = locfiledata.match(VERSIONTAG);
              if (overwriteInstalledVersion) overwriteInstalledVersion = overwriteInstalledVersion[1];
            }
          }
          if (!remove && overwriteInstalledVersion) {
            var comp = comparator.compare(versioninfo.compversion, overwriteInstalledVersion);
            if (comp < 0) {
              remove = true;
              jsdump("Rejecting compatible component:" + entryArray[f][e] + " version " + versioninfo.compversion + ", " + overwriteInstalledVersion + " is already installed.");
            }
            else if (comp == 0 && versioninfo.type == CONF_EXT && comparator.compare(versioninfo.xsmoduletext, matchingXSmoduleTextVersion) < 0) {
              remove = true;
              jsdump("Rejecting compatible xsmodule:" + entryArray[f][e] + " text version " + versioninfo.xsmoduletext + ", " + matchingXSmoduleTextVersion + " text is already installed.");
            }
          }      
          if (remove) {
            entryArray[f].splice(e--, 1);
            if (versioninfo.type==CONF_EXT) incompModsPath.push(versioninfo.path);
            if (versioninfo.type==MANIFEST_EXT) incompGUIs.push(versioninfo.path);
          }
        }
      }
      // All other files
      else {
        remove = false;
        for (var bm=0; bm<incompModsPath.length; bm++) {
          remove |= (entryArray[f][e].match(escapeRE(incompModsPath[bm])) ? true:false);
        }
        for (bm=0; bm<incompGUIs.length; bm++) {
          remove |= (entryArray[f][e].match(escapeRE(incompGUIs[bm])) ? true:false);
        }
        if (remove) entryArray[f].splice(e--, 1);
      }
    }
    if (!entryArray[f].length) {entryArray.splice(f, 1); fileArray.splice(f--,1);}
    if (!entryArray.length) break;
  }
  return incomp;
}

// Each xulsword program has two version related params: MinXSMversion, MinUIversion
// Each xulsword module has five version related params: MKMversion, UIversion, XSMversion, MinProgversionForUI, MinProgversionForXSM
// These params are used as follows:
// 1) program's MinXSMversion > XSMversion of module  = Don't install module, report: module version MinXSMversion is needed
// 2) program's MinUIversion > UIversion of module    = Don't install locale, report: module version MinUIversion is needed
// 3) module's MinProgversionForXSM > program version = Don't install module, report: program version MinProgversionForXSM is needed
// 4) module's MinProgversionForUI > program version  = Don't install locale, report: program version MinProgversionForUI is needed
//
// For reporting to work properly, the following should be identical for a given xulsword module:
// 1) XSMversion
// 2) UIversion
// 3) MKMversion
//
// However, in order to be backward compatible to the first major xulsword release (2.7), an exception is allowed:
// If the program's MinXSMversion=1.0 & MinUIversion=2.7, and the module's MinProgversionForXSM=2.7, XSMversion=2.7 & UIversion=MKMversion, the following should also be met:
// 1) MKMversion: 2.7 <= (MKMversion=UIversion) < 3.0.
// 2) Module's MinProgversionForUI: 2.9 >= MinProgversionForUI < 3.0. (but still THE UI MUST NOT CAUSE EXCEPTIONS WHEN INSTALLED ON XULSWORD 2.7, because it will not be blocked! XULSWORD 2.8 will block it and give an update message, but it (and only it) needs to block, because it has a slightly different security mod which would trip.)
// 3) xulsword program's version: version < 3.0. 
// 4) When either program's MinXSMversion or MinUIversion are finally changed, THEY MUST START AT 3.0 OR GREATER.
// The above rules allow modules to be created with new version numbers, which are still backward compatible to at least 2.7.
function readVersion(aZip, aEntry, progVers) {
  var info = {compversion:"1.0", minprogversion:null, type:null, path:null, mincompversion:null, error:false, localename:null, xsmodulename:null, xsmoduletext:null};
  var temp = getSpecialDirectory("TmpD");
    
  //exceptions result in keeping the file...
  if (!temp.exists()) return null;
  temp.append("xulsword" + CONF_EXT);
  temp.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);
  
  var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
  
  zReader.open(aZip);
  try {zReader.extract(aEntry, temp);}
  catch (er) {
    zReader.close(aZip);
    return null;
  }
  zReader.close(aZip);

  var isSwordMod = false;
  if (aEntry.search("." + CONF_EXT, "i")!=-1) {
    info.type = CONF_EXT;
    try {info.mincompversion = prefs.getCharPref("MinXSMversion");} catch (er) {info.mincompversion = MINVERSION;}
    isSwordMod = true;
    info.path = readParamFromConf(temp, "DataPath").replace(/^\.\//, "").replace(/\/[^\/]+$/, "/");
    info.xsmodulename = readParamFromConf(temp, "ModuleName");
    info.xsmoduletext = readParamFromConf(temp, "Version");
    info.xsmodulemineng = readParamFromConf(temp, "MinimumVersion");
    if (!info.xsmoduletext) info.xsmoduletext = 0;
  }
  else if (aEntry.search("." + MANIFEST_EXT, "i")!=-1) {
    info.type = MANIFEST_EXT;
    try {info.mincompversion = prefs.getCharPref("MinUIversion");} catch (er) {info.mincompversion = progVers;}
    var locale = aEntry.match(/(^|\/)([^\.\/]+)[^\/]+$/);
    // If the manifest is not a locale manifest, remove it.
    if (!locale) {
      info.error = true;
      return info;
    }
    info.path = CHROME + "/" + locale[2] + ".";
    info.localename = locale[2];
  }
  
  var filedata = readFile(temp);
  removeFile(temp, false);
  //if the file is empty, there is a problem! Remove it...
  if (!filedata) {
    info.error = true;
    return info;
  }

  info.minprogversion = filedata.match(MINPROGVERSTAG);
  info.minprogversion = (info.minprogversion ? info.minprogversion[1]:MINVERSION);
  
  info.compversion = filedata.match(VERSIONTAG);
  info.compversion = (info.compversion ? info.compversion[1]:MINVERSION);
  return info;
}

var CopyAnotherFile;
function copyZipFilesTO() {
  CopyAnotherFile = window.setTimeout(copyZipFiles, TIMEOUT);
}

function copyZipFiles() {
  var result = installEntryFromZip(ZipFiles[ZipIndex], ZipEntry[ZipIndex][EntIndex]);
  if (!result.success) jsdump("FAILED:" + ZipEntry[ZipIndex][EntIndex] + ", reset:" + result.reset + ", success:" + result.success + ", remove:" + result.remove);
  if (result.reset > ResetNeeded) ResetNeeded = result.reset;
  if (result.remove) ZipEntry[ZipIndex][EntIndex] = null;
  Success &= result.success;
  
  var pc = 100*((CountCurrent+EntIndex/ZipEntry[ZipIndex].length)/CountTotal);
  if (CountTotal<=3 && ProgressMeterLoaded && typeof(ProgressMeter) != "undefined" && ProgressMeter.Progress) 
      ProgressMeter.Progress.setAttribute("value", pc);
  
  EntIndex++;
  if (EntIndex == ZipEntry[ZipIndex].length) {
    EntIndex = 0;
    ZipIndex++;
    if (ProgressMeterLoaded && typeof(ProgressMeter) != "undefined" && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));
  }
  if (ZipIndex == ZipFiles.length) {
    if (RegularFiles && RegularFiles.length) CopyRegularFun();
    else ExitFunction();
  }
  else CopyZipFun();
}

function copyRegularFilesTO() {
  CopyAnotherFile = window.setTimeout("copyRegularFiles();", TIMEOUT);
}

function copyRegularFiles() {
  jsdump("Processing File:" + RegularFiles[RegIndex].path);
  var result;
  if (RegularFiles[RegIndex].leafName.match(AUDIOEXT)) result = installAudioFile(RegularFiles[RegIndex]);
  else if (RegularFiles[RegIndex].leafName.match(XSBOOKMARKEXT)) result = installBookmarkFile(RegularFiles[RegIndex]);
  else jsdump("FAILED:" + RegularFiles[RegIndex].leafName + ", reset:" + result.reset + ", success:" + result.success + ", remove:" + result.remove);
  if (result.reset > ResetNeeded) ResetNeeded = result.reset;
  if (result.remove) RegularFiles[RegIndex] = null;
  Success &= result.success;

  if (ProgressMeterLoaded && typeof(ProgressMeter) != "undefined" && ProgressMeter.Progress) 
      ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));
    
  RegIndex++;
  if (RegIndex == RegularFiles.length) ExitFunction();
  else CopyRegularFun();
}

function installAudioFile(aFile) {
//jsdump("Importing file:" + aFile.leafName);
  var toFile = getAudioDestination(AudioDestination, aFile.path);
  if (!toFile) {jsdump("Could not determine audio file destination:" + aFile.path); return {reset:NORESET, success:false, remove:true};}
  
  if (!toFile.parent.exists()) toFile.parent.create(toFile.DIRECTORY_TYPE, DPERM);
  if (toFile.exists()) {
    try {toFile.remove(false);}
    catch (er) {jsdump("Could not remove pre-existing file:" +  toFile.path); return {reset:NORESET, success:false, remove:true};}
  }
  
  try {aFile.copyTo(toFile.parent, toFile.leafName);}
  catch (er) {jsdump("Could not copy " + aFile.path + " to " + toFile.parent + "/" + toFile.leafName); return {reset:NORESET, success:false, remove:true};}
  GotoAudioFile = toFile;
  return {reset:NORESET, success:true, remove:true};
}

function getAudioDestination(aOutDir, audioFilePath) {
  var info = decodeAudioFileName(audioFilePath);
  if (!info) {jsdump("Could not decode audio file path:" + audioFilePath); return null;}

  if (aOutDir.equals(getSpecialDirectory("xsAudio")))
    var toFile = getThisAudioFile(aOutDir, info.basecode.toLowerCase(), info.book, info.chapter, info.ext);
  else
    toFile = getLocalizedAudioFile(aOutDir, info.basecode.toLowerCase(), info.book, info.chapter, info.ext, getLocale());

  return (toFile ? toFile:null);
}

function installBookmarkFile(aFile) {
  if (!aFile.leafName.match(XSBOOKMARKEXT)) return {reset:NORESET, success:false, remove:true};
  if (!ResourceFuns.importBMFile(aFile, false, true)) return {reset:NORESET, success:false, remove:true};
  GotoBookmarkFile = aFile;
  return {reset:NORESET, success:true, remove:true};
}

function installEntryFromZip(aZip, aEntry) {
jsdump("Processing Entry:" + aZip + ", " + aEntry);
  var type = aEntry.match(/^([^\\\/]+)(\\|\/)/);
  if (!type) type=AUDIO;
  else {type = type[1];}
    
  var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
                        .createInstance(Components.interfaces.nsIZipReader);
  var inflated = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  var entryFileName = aEntry.substring(aEntry.lastIndexOf("/")+1);
  
  //Try and copy this file to destination...
  switch (type) {
  case AUDIO:
    // this doesn't access the LibSword object, unless files have localized names which they should not.
    inflated = getAudioDestination(AudioDestination, aEntry);
    if (!inflated) return {reset:NORESET, success:false, remove:true};
    if (!inflated.leafName.match(AUDIOEXT)) return {reset:NORESET, success:true, remove:true};
    break;
    
  case MODSD:
    var conf = getConfInfo(aZip, aEntry, zReader);
    inflated.initWithPath(lpath(getSpecialDirectory("xsModsUser").path + "/" + aEntry));
    if (!conf.modPath) {
      jsdump("Could not read DataPath of " + aEntry + ", SKIPPING conf file!");
      return {reset:NORESET, success:false, remove:true};
    }
    else {
      if (conf.isCommon) CommonList.push(conf.modPath);
    }
    break;
    
  case MODS:
    var skip = false;
    for (var s=0; s<SkipList.length; s++) {
      if (aEntry.indexOf(SkipList[s].replace("\\", "/", "g")!=-1)) skip=true;
    }
    if (skip) return {reset:SOFTRESET, success:true, remove:false};
    var dest = "xsModsUser";
//    for (var s=0; s<CommonList.length; s++) {if (aEntry.match(CommonList[s], "i")) dest = "xsModsCommon";}
    inflated.initWithPath(lpath(getSpecialDirectory(dest).path + "/" + aEntry));
    break;

  case CHROME:
    if ((/\.(jar|manifest)$/i).test(entryFileName)) {
      // .manifest files will be copied to the extension's top directory,
      // not inside the chrome directory.
      
      // this .jar or .manifest file will be copied to the extensions directory
      var localeName = entryFileName.match(/^([^\.]*)/)[1];
      var localeDir = localeName + APPLICATIONID.replace(/^.*?(\@.*)$/, "$1");
      var inflated = getSpecialDirectory("xsExtension");
      inflated.append(localeDir);
      
      if ((/\.jar$/i).test(entryFileName)) {
        inflated.append(CHROME);
        inflated.append(entryFileName);
              
        // create an install.rdf file to initiate this locale extension's 
        // installation by Firefox's install manager upon next startup.
        var file = getSpecialDirectory("xsExtension");
        file.append(localeDir);
        file.append("install.rdf");
        
        // install.rdf: the version of this locale extension and that of the
        // target application is not important because version control is 
        // already handled by xulsword code. Firefox's installation manager 
        // should always simply install without complaining.
        var str;
        str  =   "<?xml version=\"1.0\"?>" + NEWLINE;
        str +=   "<RDF xmlns=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\" xmlns:em=\"http://www.mozilla.org/2004/em-rdf#\">" + NEWLINE;
        str +=   "  <Description about=\"urn:mozilla:install-manifest\">" + NEWLINE;
        str +=   "    <em:id>" + localeDir + "</em:id>" + NEWLINE;
        str +=   "    <em:version>" + prefs.getCharPref("Version") + "</em:version>" + NEWLINE;
        str +=   "    <em:type>8</em:type>" + NEWLINE;
        str +=   "    <em:name>" + localeName + " xulsword locale</em:name>" + NEWLINE;
        str +=   "    <em:targetApplication>" + NEWLINE;
        str +=   "      <Description>" + NEWLINE;
        if (IsExtension) {
          str += "        <em:id>{" + FIREFOXUID + "}</em:id>" + NEWLINE;
          str += "        <em:minVersion>1.0</em:minVersion>" + NEWLINE;
          str += "        <em:maxVersion>99.0</em:maxVersion>" + NEWLINE;
        }
        else {
          str += "        <em:id>" + APPLICATIONID + "</em:id>" + NEWLINE;
          str += "        <em:minVersion>1.0</em:minVersion>" + NEWLINE;
          str += "        <em:maxVersion>99.0</em:maxVersion>" + NEWLINE;
        }
        str +=   "      </Description>" + NEWLINE;
        str +=   "    </em:targetApplication>" + NEWLINE;
        str +=     "</Description>" + NEWLINE;
        str +=   "</RDF>" + NEWLINE;
        
        if (!file.exists()) file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);
        writeFile(file, str, true);
        
        NewLocales = pushIf(NewLocales, localeName);
        var rootprefs = Components.classes["@mozilla.org/preferences-service;1"].
            getService(Components.interfaces.nsIPrefBranch);
        if (localeName[1] == getLocale()) {
          rootprefs.setCharPref("general.useragent.locale", DEFAULTLOCALE);
        }
      }
      else if ((/\.manifest$/i).test(entryFileName)) {
        inflated.append("chrome.manifest");
      }
    }
    else {
      // completely ignore everything in Chrome except jar and manifest files
      return {reset:NORESET, success:true, remove:true};
    }

    break;
  case AUDIOPLUGIN:
    inflated.initWithPath(lpath(getSpecialDirectory("xsAudioPI").path + "/" + entryFileName));
    break;

  case FONTS:
    inflated.initWithPath(lpath(getSpecialDirectory("xsFonts").path + "/" + entryFileName));
    break;
    
  case BOOKMARKS:
    inflated.initWithPath(lpath(getSpecialDirectory("xsBookmarks").path + "/" + entryFileName));
    if (!inflated.leafName.match(XSBOOKMARKEXT)) return {reset:NORESET, success:true, remove:true};
    break;
    
  case VIDEO:
    inflated.initWithPath(lpath(getSpecialDirectory("xsVideo").path + aEntry.replace(/^[^\\\/]+/, "")));
    if (!inflated.leafName.match(XSVIDEOEXT) && !inflated.leafName.match(/\.txt$/i)) return {reset:NORESET, success:true, remove:true};
    break;
    
  default:
    jsdump("WARNING: Unknown type \"" + type + "\" in " + aZip.leafName);
    return {reset:NORESET, success:false, remove:true};
  }

  var overwriting = inflated.exists();
  if (overwriting) {
    try {inflated.remove(false);}
    catch (er) {
      jsdump("Could not remove pre-existing ZIP entry destination " + inflated.path + ". " + er);
      return {reset:HARDRESET, success:true, remove:false};
    }
  }
  
  try {inflated.create(inflated.NORMAL_FILE_TYPE, FPERM);}
  catch (er) {
    //don't log this because it commonly happens when parent dir was just deleted and is not ready to receive children. HARDRESET takes care if this...
    jsdump("Could not create empty target file: " + inflated.path + ". " + er);
    return {reset:HARDRESET, success:true, remove:false};
  }
  
  zReader.open(aZip);
  jsdump("\tWriting to \"" + inflated.path + "\"");
  try {zReader.extract(aEntry, inflated);}
  catch (er) {
    zReader.close(aZip);
    jsdump("Could not extract from zip to target file: " + inflated.path + ". " + er);
    return {reset:HARDRESET, success:false, remove:false};
  }
  zReader.close(aZip);

  //Now perform any operations with the newly installed file
  switch (type) {
  case MODSD:
    // delete existing appDir module if it exists
    var success = true;
    if (overwriting) var success = removeModuleContents(inflated).success;
    if (!success) SkipList.push(conf.modPath);
    NewModules = pushIf(NewModules, conf.modName);
    return {reset:(PreMainWin ? NORESET:SOFTRESET), success:success, remove:true};
    break;
    
  case CHROME:
    return {reset:HARDRESET, success:true, remove:true};
    break;
    
  case FONTS:
    installFontWin(inflated);
    NewFonts = pushIf(NewFonts, inflated.leafName);
    break;
    
  case AUDIO:
    GotoAudioFile = inflated;
    break;
    
  case VIDEO:
    GotoVideoFile = inflated;
    break;
    
  case AUDIOPLUGIN:
    for (var f=0; f<QTIMEINS.length; f++) {
      var inst = new RegExp("^" + escapeRE(QTIMEINS[f]) + "$");
      if (inflated.leafName.search(inst)!=-1) {
        NewPlugin = inflated;
      }
    }
    break;
    
  case BOOKMARKS:
    // this doesn't access the LibSword object in this case.
    var ret = installBookmarkFile(inflated);
    removeFile(inflated, false);
    if (!ret.success) return ret;
    break;
  }
  
  return {reset:NORESET, success:true, remove:true};
}

// use during user installs
function finishAndHandleReset() {
  finish();
  handleResetRequest();
}

// use after soft-reset (must be run in xulsword.xul scope)
function finishAndWriteManifest() {
  finish(true);
  writeManifest();
}

// use after hard-reset
function finishAndStartXulsword() {
  finish(true);
  writeManifest();
  installCommandLineModules();
}

// use when installing command line modules
function finishAndStartXulSword2() {
  finish();
  handleResetRequest();
  endInstall();
}

function finish(isFinalPass) {
  if (typeof(LibSword) != "undefined" && !LibSword.loadFailed && LibSword.paused) LibSword.resume();
  if (ProgressMeterLoaded && typeof(ProgressMeter) != "undefined" && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100);
  if (typeof(ProgressMeter) != "undefined") window.setTimeout("ProgressMeter.close();", 100);
  if (NewPlugin) {
    window.setTimeout("checkQuickTime();", 1000);
    NewPlugin = false;
  }
  if (GotoAudioFile) audioDirPref(AudioDestination);
  if (!isFinalPass && ResetNeeded>NORESET) saveArraysToPrefs();

  if (Success && ResetNeeded==NORESET) jsdump("ALL FILES WERE SUCCESSFULLY INSTALLED!");
  else if (!Success) {
    jsdump("THERE WERE ERRORS DURING INSTALL!");
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
  }

  if (isFinalPass && ResetNeeded != NORESET) jsdump("INSTALL DID NOT COMPLETE- RESET CODE: " + ResetNeeded);
  ModuleCopyMutex=false;
}

function handleResetRequest() {
  switch (ResetNeeded) {
  case NOVALUE: // there was a problem
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("No compatible files found");
    break;
  case NORESET: // program continues running and needs no reload or restart
    if (PreMainWin) writeManifest(NewLocales, NewModules, NewFonts, true);
    else {
      if (!MainWindow || !MainWindow.LibSword || !MainWindow.Tabs.length) {
        restartApplication(false);
        break;
      }
      
      //NOTE: In this case a manifest file for new mods etc. will not be written!
      if (GotoVideoFile) MainWindow.createHelpVideoMenu();
      if (GotoBookmarkFile) {
        MainWindow.focus();
        MainWindow.setTimeout("document.getElementById('menu_BookmarksPopup').showPopup();", 500);
      }
      if (GotoAudioFile) {
        var info = decodeAudioFileName(GotoAudioFile.path);
        var modsUsingAudio = getModsUsingAudioCode(info.basecode);
      }
      if (modsUsingAudio && modsUsingAudio[0]) {
        MainWindow.showLocation(modsUsingAudio[0], info.book, Number(info.chapter), 1, 1);
      }
      else {Texts.update(SCROLLTYPETOP, HILIGHTNONE);}
    }
    break;
  case SOFTRESET: // program needs to reload all SWORD modules
    jsdump("Initiating SOFTRESET");
    if (window.name == "xulsword-window") window.setTimeout("windowLocationReload();", 500);
    else {
      WillRestart = true;
      window.setTimeout("restartApplication();", 500);
    }
    break;
  case HARDRESET: // program needs to quit and restart from nothing
    jsdump("Initiating HARDRESET");
    WillRestart = true;
    window.setTimeout("restartApplication();", 500);
    break;
  }
}

function writeManifest(newLocales, newModules, newFonts, filesNotWaiting) {
  // write a module install file if needed. example- NewLocales;uz;NewModules;uzv;uzdot;uzdnt
  if (typeof(ProgressMeter) != "undefined") ProgressMeter.close();
  
  newLocales = (newLocales ? newLocales:NewLocales);
  newModules = (newModules ? newModules:NewModules);
  newFonts = (newFonts ? newFonts:NewFonts);
  if (newLocales.length>0 || newModules.length>0 || newFonts.length>0) {
    var modFileText = "NewLocales;" + newLocales.join(";") + ";NewModules;" + newModules.join(";") + ";NewFonts;" + newFonts.join(";");
    jsdump("WRITING NEW MODULE MANIFEST:" + modFileText + "\n");
    var pfile = getSpecialDirectory("xsResD");
    pfile.append(NEWINSTALLFILE);
    if (pfile.exists()) {
      try {pfile.remove(false);} catch (er) {jsdump("Could not delete " + pfile.path + ". " + er);}
    }
    
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(pfile, 0x02 | 0x08 | 0x20, FPERM, 0); 
    foStream.write(modFileText, modFileText.length);
    foStream.close();
  }
}

function saveArraysToPrefs() {
  jsdump("PREPARING FOR RESTART...");

  var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
  var x=0;
  for (var f=0; f<RegularFiles.length; f++) {
    if (!RegularFiles[f]) continue;
    prefs.setComplexValue("InsAudio" + x, Components.interfaces.nsILocalFile, RegularFiles[x]);
//jsdump("SAVING InsAudio" + x + ":" + RegularFiles[x].path);
    x++;
  }
  prefs.setIntPref("InsAudioNum", x);
  
  var sequentSEP = new RegExp("(" + escapeRE(SEP) + ")+", "g");
  var leadingSEP = new RegExp("^" + escapeRE(SEP));
  var trailingSEP = new RegExp(escapeRE(SEP) + "$");
  x=0;
  for (f=0; f<ZipFiles.length; f++) {
    sString.data = ZipEntry[f].join(SEP).replace(sequentSEP, SEP).replace(leadingSEP, ""). replace(trailingSEP, "");
    if (!sString.data) continue;
    prefs.setComplexValue("InsZipEntry" + x, Components.interfaces.nsISupportsString, sString);
    prefs.setComplexValue("InsZip" + x, Components.interfaces.nsILocalFile, ZipFiles[f]);
//jsdump("SAVING InsZipEntry" + x + ":" + sString.data);
    x++;
  }
  prefs.setIntPref("InsZipNum", x);

  if (NewModules[0]) {
    sString.data = NewModules.join(SEP);
    prefs.setComplexValue("NewModules", Components.interfaces.nsISupportsString, sString);
//jsdump("SAVING NewModules:" + aString.data);
  }
  if (NewLocales[0]) {
    sString.data = NewLocales.join(SEP);
    prefs.setComplexValue("NewLocales", Components.interfaces.nsISupportsString, sString);
//jsdump("SAVING NewLocales:" + aString.data);
  }
  if (NewFonts[0]) {
    sString.data = NewFonts.join(SEP);
    prefs.setComplexValue("NewFonts", Components.interfaces.nsISupportsString, sString);
//jsdump("SAVING NewFonts:" + aString.data);
  }
}

function retrieveFileArrays() {
  var result = {};
  
  result.audioFiles = [];
  result.installFiles = [];
  result.installEntry = [];
  result.deleteFiles = [];
  
  //Read list of files to delete
  result.files2Delete = false;
  var end=0;
  try {end=prefs.getIntPref("ToDeleteNum");} catch (er) {}
  for (var x=0; x<end; x++) {
    try {
      var aFile2Delete = prefs.getComplexValue("ToDelete" + x, Components.interfaces.nsILocalFile);
      prefs.clearUserPref("ToDelete" + x);
    }
    catch (er) {continue;}
    result.deleteFiles.push(aFile2Delete);
    result.files2Delete = true;
  }
  try {prefs.clearUserPref("ToDeleteNum");} catch (er) {}

  result.filesWaiting=false;
  var end=0;
  try {end=prefs.getIntPref("InsAudioNum");} catch (er) {}
  for (var x=0; x<end; x++) {
    try {
      var aAudio = prefs.getComplexValue("InsAudio" + x, Components.interfaces.nsILocalFile);
      prefs.clearUserPref("InsAudio" + x);
    }
    catch (er) {break;}
    result.audioFiles.push(aAudio);
//jsdump("RETREIVING InsAudio" + x + ":" + aAudio.path);
    result.filesWaiting = true;
  }
  try {prefs.clearUserPref("InsAudioNum");} catch (er) {}
  
  var end=0;
  try {end=prefs.getIntPref("InsZipNum");} catch (er) {}
  for (var x=0; x<end; x++) {
    try {
      var aZipFile  = prefs.getComplexValue("InsZip" + x, Components.interfaces.nsILocalFile);
      prefs.clearUserPref("InsZip" + x);
    }
    catch (er) {continue;}
    try {
      var aZipEntry = prefs.getComplexValue("InsZipEntry" + x, Components.interfaces.nsISupportsString).data.split(SEP);
      prefs.clearUserPref("InsZipEntry" + x);
    }
    catch (er) {continue;}
    result.installFiles.push(aZipFile);
    result.installEntry.push(aZipEntry);
//jsdump("RETREIVING InsZipEntry" + x + ":" + aZipEntry);
    result.filesWaiting = true;
  }
  try {prefs.clearUserPref("InsZipNum");} catch (er) {}
  
  result.haveNew=false;
  try {
    result.newModules = prefs.getComplexValue("NewModules", Components.interfaces.nsISupportsString).data.split(SEP);
//jsdump("RETREIVING NewModules:" + result.newModules);
    prefs.clearUserPref("NewModules");
    result.haveNew=true;
  }
  catch (er) {result.newModules = [];}

  try {
    result.newLocales = prefs.getComplexValue("NewLocales", Components.interfaces.nsISupportsString).data.split(SEP);
//jsdump("RETREIVING NewLocales:" + result.newLocales);
    prefs.clearUserPref("NewLocales");
    result.haveNew=true;
  }
  catch (er) {result.newLocales = [];}
  
  try {
    result.newFonts = prefs.getComplexValue("NewFonts", Components.interfaces.nsISupportsString).data.split(SEP);
//jsdump("RETREIVING NewFonts:" + result.newFonts);
    prefs.clearUserPref("NewFonts");
    result.haveNew=true;
  }
  catch (er) {result.newFonts = [];}
  
  if (result.filesWaiting || result.haveNew) jsdump("Installation arrays: filesWaiting=" + result.filesWaiting + ", haveNew=" + result.haveNew);
  return result;
}

function pushIf(aArray, elem) {
  if (aArray.length==0) {
    aArray = [elem];
    return aArray;
  }
  for (var e=0; e<aArray.length; e++) {
    if (aArray[e]==elem) return aArray;
  }
  aArray.push(elem);
  return aArray;
}


function getConfInfo(aZip, aEntry, zReader) {
  var ret = {isCommon:false, modPath:null, modName:null};
  var tconf = getSpecialDirectory("TmpD");
  tconf.append(MODSD);
  if (!tconf.exists()) tconf.create(tconf.DIRECTORY_TYPE, DPERM);
  tconf.append("xulsword.conf");
  tconf.createUnique(tconf.NORMAL_FILE_TYPE, FPERM);
  
  zReader.open(aZip);
  try {zReader.extract(aEntry, tconf);}
  catch (er) {}
  zReader.close(aZip);
  
  ret.modName = readParamFromConf(tconf, "ModuleName");
  ret.modPath = cleanDataPathDir(readParamFromConf(tconf, "DataPath"));
// It is not safe to try and write to both common and user directories, because
// it is very difficult to tell from a conf file alone what the module directory
// name is, and without knowing this it is impossible to match incoming module
// files to their module directory and hence their correct destination (common
// or user). The only solution is to have only one destination.
//  ret.isCommon = isConfCommon(tconf);
  removeFile(tconf, false);
  return ret;
}
/*
function isConfCommon(aConf) {
  if (IsPortable) return false; // install all mods as user if Portable Version
  var data = readParamFromConf(aConf, "Versification");
  if (data && data == "EASTERN") return false; // must be user mod (not supported by other front-ends)
  data = readParamFromConf(aConf, "CipherKey");
  if (data !== null && data == "") return false; // encrypted with no key provided
  return true;
}
*/

function cleanDataPathDir(aDataPath) {
  if (!aDataPath) return null;
  aDataPath = aDataPath.replace("\\", "/", "g").replace(/(^\s*\.\/|\s*$)/, "", "g");
  var d = 0;
  var d1 = 0;
  var d2 = 0;
  while (d<4 || aDataPath.substring(d1, d2) == "devotionals") {
    d++;
    d1 = d2+1;
    d2 = aDataPath.indexOf("/", d1);
    if (d2 == -1) break;
  }
  if (d<4) return null; // not enough subdirs
  if (d==4 && d1==aDataPath.length) return null; // no mod name

  if (d2 == -1) d2 = aDataPath.length;
  return aDataPath.substring(0, d2);
}

//Audio file name format: name-BookshortName-chapterNumber.extension
//name can be language abbreviation (ie ru), module (ie RSTE), or AudioCode from module's .conf file
function decodeAudioFileName(path) {
  var ret = {};
  var savepath = path;
  path = savepath.match(/^(.*)[\\\/](.*)\s*-\s*([^-]+)\s*-\s*(\d+)\s*\.([^\.]+)$/);
  if (path) {
    ret.type =      AUDIOFILEXSM;
    ret.dir =       path[1];
    ret.basecode =  path[2];
    ret.book =      path[3];
    ret.chapter =   padChapterNum(path[4]);
    ret.ext =       path[5];
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) {jsdump("A: Bad audio ext:" + ret.ext); return null;}
    if (!validateChapter(ret.book, ret.chapter)) {jsdump("A: Bad book/chapter:" + ret.book + ", " + ret.chapter); return null;}
    return ret;
  }
  
  // If this is exported audio file, return correct info
  path = savepath.match(/^(.*)[\\\/]([^\\\/]+)[\\\/]\d+\s*-\s*([^\\\/]+)[\\\/](\d+)\s*-\s*[^\.]+\.([^\.]+)$/);
  if (path) {
    ret.type =      AUDIOFILELOC;
    ret.dir =       path[1];
    ret.basecode =  path[2];
    var inloc;
    var np = ret.basecode.match(/^(.*)_(.*)$/); // get locale designation
    if (np) {
      ret.basecode = np[1];
      inloc = np[2];
    }
    try {var bkinfo = identifyBook(path[3]);} catch (er) {jsdump("B: Cannot use identifyBook in pre-Sword:" + path[3]); return null;} // This try is needed because identifyBook may be undefined during init
    if (!bkinfo || !bkinfo.shortName) {jsdump("B: Could not identify book:" + path[3]); return null;}
    ret.book = bkinfo.shortName;
    ret.locale = (inloc ? inloc:bkinfo.locale);
    ret.chapter =   padChapterNum(path[4]);
    ret.ext =       path[5];
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) {jsdump("B: Bad audio ext:" + ret.ext); return null;}
    if (!validateChapter(ret.book, ret.chapter)) {jsdump("B: Bad book/chapter:" + ret.book + ", " + ret.chapter); return null;}
    return ret;  
  }
  
  // If this is an internal audio file, return the correct info
  path = savepath.match(/^(.*)[\\\/]([^\\\/]+)[\\\/]([^\\\/]+)[\\\/](\d+)\.([^\.]+)$/);
  if (path) {
    ret.type =      AUDIOFILESIM;
    ret.dir =       path[1];
    ret.basecode =  path[2];
    ret.book =      path[3];
    ret.chapter =   padChapterNum(path[4]);
    ret.ext =       path[5];
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) {jsdump("C: Bad audio ext:" + ret.ext); return null;}
    if (!validateChapter(ret.book, ret.chapter)) {jsdump("C: Bad book/chapter:" + ret.book + ", " + ret.chapter); return null;}
    return ret;  
  }
  
  jsdump("Audio path did not match any pattern:" + savepath);
  return null;
}

function validateChapter(book, chapter) {
  var maxchaps = {};
	maxchaps.xGen = 50;
	maxchaps.xExod = 40;
	maxchaps.xLev = 27;
	maxchaps.xNum = 36;
	maxchaps.xDeut = 34;
	maxchaps.xJosh = 24;
	maxchaps.xJudg = 21;
	maxchaps.xRuth = 4;
	maxchaps.x1Sam = 31;
	maxchaps.x2Sam = 24;
	maxchaps.x1Kgs = 22;
	maxchaps.x2Kgs = 25;
	maxchaps.x1Chr = 29;
	maxchaps.x2Chr = 36;
	maxchaps.xEzra = 10;
	maxchaps.xNeh = 13;
	maxchaps.xEsth = 10;
	maxchaps.xJob = 42;
	maxchaps.xPs = 150;
	maxchaps.xProv = 31;
	maxchaps.xEccl = 12;
	maxchaps.xSong = 8;
	maxchaps.xIsa = 66;
	maxchaps.xJer = 52;
	maxchaps.xLam = 5;
	maxchaps.xEzek = 48;
	maxchaps.xDan = 12;
	maxchaps.xHos = 14;
	maxchaps.xJoel = 3;
	maxchaps.xAmos = 9;
	maxchaps.xObad = 1;
	maxchaps.xJonah = 4;
	maxchaps.xMic = 7;
	maxchaps.xNah = 3;
	maxchaps.xHab = 3;
	maxchaps.xZeph = 3;
	maxchaps.xHag = 2;
	maxchaps.xZech = 14;
	maxchaps.xMal = 4;
	maxchaps.xMatt = 28;
	maxchaps.xMark = 16;
	maxchaps.xLuke = 24;
	maxchaps.xJohn = 21;
	maxchaps.xActs = 28;
	maxchaps.xJas = 5;
	maxchaps.x1Pet = 5;
	maxchaps.x2Pet = 3;
	maxchaps.x1John = 5;
	maxchaps.x2John = 1;
	maxchaps.x3John = 1;
	maxchaps.xJude = 1;
	maxchaps.xRom = 16;
	maxchaps.x1Cor = 16;
	maxchaps.x2Cor = 13;
	maxchaps.xGal = 6;
	maxchaps.xEph = 6;
	maxchaps.xPhil = 4;
	maxchaps.xCol = 4;
	maxchaps.x1Thess = 5;
	maxchaps.x2Thess = 3;
	maxchaps.x1Tim = 6;
	maxchaps.x2Tim = 4;
	maxchaps.xTitus = 3;
	maxchaps.xPhlm = 1;
	maxchaps.xHeb = 13;
	maxchaps.xRev = 22;

  return !(!maxchaps["x" + book] || maxchaps["x" + book] < chapter);
}

function padChapterNum(ch) {
  ch = Number(ch);
  ch = (ch<100 ? "0" + (ch<10 ? "0" + String(ch):String(ch)):String(ch));
  return ch;
}

function installFontWin(aFontFile) {
  var type = aFontFile.leafName.match(/\.([^\.]+)$/);
  if (!type) return false;
  type = type[1];
  var validTypes = ["ttf", "otf", "fon"];
  for (var f=0; f<validTypes.length; f++) {if (type.search(validTypes[f], "i")!=-1) break;}
  if (f==validTypes.length) return false;
  
  jsdump("Installing font file \"" + aFontFile.leafName + "\":");
  var vbsdata = "Const FONTS = &H14& \r\nSet objShell = CreateObject(\"Shell.Application\")\r\nSet objFolder = objShell.Namespace(FONTS)\r\nSet objFolderItem = objFolder.ParseName(\"" + aFontFile.leafName + "\")\r\nif (objFolderItem is nothing) then\r\nobjFolder.CopyHere(\"" + aFontFile.path + "\")\r\nend if";
  launchTempScript(vbsdata, "vbs");

  return true;

/* THE FOLLOWING DOES NOT WORK IF THERE ARE SPACES IN THE FILE PATH!!!!!!!
  // execute the vbs script using cmd.exe
  var cmdpath = Components.classes["@mozilla.org/process/environment;1"].
      getService(Components.interfaces.nsIEnvironment).get("ComSpec");
  var cmdexe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  cmdexe.initWithPath(lpath(cmdpath));

  var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);  
  process.init(cmdexe);
  var args = [];
  var argt = "/C " + vbsfile.path;
  args.push(argt);
  var result = process.run(true, args, args.length);

  removeFile(aTempFolder, true);
  jsdump((result==0 ? "Success!":"FAILURE!!!") + "\n");  
  return result==0;
*/
}

function launchTempScript(scriptContents, ext) {
  var script = getSpecialDirectory("TmpD");
  if (!script.exists()) return;
  script.append("xulswordScript." + ext);
  script.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);

  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(script, 0x02 | 0x08 | 0x20, FPERM, 0);
  var charset = (ext.match(/^vbs$/i) ? "UTF-16LE":"ASCII"); // VBS understands UTF-16LE, but BAT must be ASCII to work!
  var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  os.init(foStream, charset, 0, 0x0000);
  os.writeString(scriptContents);
  os.close();
  foStream.close();
  
  script = script.QueryInterface(Components.interfaces.nsILocalFile);
  try {script.launch();}
  catch (er) {jsdump("Could not execute script:\n" + scriptContents);}
  
  // This leaves the temp file in the temp directory! But since we are not blocking, it's hard to know when to delete it, and they're small anyway
  return;
}

/************************************************************************
 * Module Removal
 ***********************************************************************/ 
function deleteFiles(files) {
  var success = true;
  var msg="";
  for (var f=0; f<files.length; f++) {
    if (files[f].leafName.search(/\.conf$/i)!=-1) success &= (removeModuleContents(files[f]).success ? true:false);
    try {files[f].remove(true);} catch (er) {success=false; msg += "ERROR: Problem deleting \"" + files[f].path + "\ " + er + "\n"; continue;}
  }
  if (success) jsdump("Delete was successful!");
  else {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("ERRORS DURING DELETE: " + msg);
  }
}

// Removes existing module contents if they exist. Returns null only if the conf
// could not be read, or if there is a module which cannot be deleted. Otherwise
// it returns the module name from the conf file.
function removeModuleContents(aConfFile) {
  var modName = readParamFromConf(aConfFile, "ModuleName");
  if (!modName) {
    jsdump("Could not read conf file: " + aConfFile.path);
    return {modName:null, success:false};
  }
  try {prefs.clearUserPref("dontAskAboutSearchIndex" + modName);} catch (er) {}
  try {prefs.clearUserPref("CipherKey" + modName);} catch (er) {}
  
  var aMod = getSwordModParent(aConfFile, true);
  if (!aMod || !aMod.file) {
    jsdump("Possible problem with DataPath in conf: " + aConfFile.path);
    return {modName:null, success:false};
  }
  aMod = aMod.file;
  
  jsdump("Attempting to remove directory: " + aMod.path);
  if (aMod && aMod.path.search(MODS)!=-1 && aMod.exists() && aMod.isDirectory()) {
    try {aMod.remove(true);}
    catch (er) {
jsdump("NO CLEAN REMOVE");
      // Sometimes the remove fails because the dir itself was not removed, even though all the contents were removed. So check for this...
      if (aMod.exists() && aMod.directoryEntries && aMod.directoryEntries.getNext()) {
        jsdump("Could not remove directory contents: " + aMod.path + ". " + er);
        return {modName:modName, success:false};
      }
    }
  }
  else jsdump("Module directory did not exist: " + aMod.path);
  
  return {modName:modName, success:true};
}

function getSwordModParent(aConfFile, willDelete) {
  var pathFromConf = readParamFromConf(aConfFile, "DataPath");
  if (!pathFromConf) return {pathFromConf:null, file:null};
  
  pathFromConf = pathFromConf.replace("\\", "/", "g").replace(/(^\s*\.\/|\s*$)/, "", "g");
  var realdir = cleanDataPathDir(pathFromConf);
  if (!realdir) return {pathFromConf:pathFromConf, file:null};
  var modulePath = aConfFile.path.substring(0, aConfFile.path.lastIndexOf("/" + MODSD)+1) + realdir;
  var aMod = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  try {aMod.initWithPath(lpath(modulePath));} catch (er) {return {pathFromConf:pathFromConf, file:null};}
  return {pathFromConf:pathFromConf, file:aMod};
}
    
 

/************************************************************************
 * Drap and Drop functions
 ***********************************************************************/ 
  
var fileObserver = {
  canHandleMultipleItems:true,
  
  getSupportedFlavours : function () {
    var flavours = new FlavourSet();
    flavours.appendFlavour("application/x-moz-file","nsIFile");
    return flavours;
  },
  
  onDrop : function (event, transferData, session) {
    if (ModuleCopyMutex) {
      Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
      return;
    }
    var files = [];
    if (!transferData.dataList || !transferData.dataList.length) return;
    for (var i=0; i<transferData.dataList.length; i++) {
      if (!transferData.dataList[i].first || !transferData.dataList[i].first.data) continue;
      files.push(transferData.dataList[i].first.data)
    }
    ModuleCopyMutex=true; //insures other module functions are blocked during this operation
    if (!installModuleArray(finishAndHandleReset, files)) ModuleCopyMutex=false;
  },
  
  onDragOver : function (event, flavour, session) {},
  
  canDrop: function (aEvent, session) {
    if (!session) return false;
    return session.isDataFlavorSupported("application/x-moz-file");
  }
}

/************************************************************************
 * Startup functions
 ***********************************************************************/ 

// If isMainWindow == false, then this function must insure that 
// installCommandLineModules is called, which in turn must insure
// that endInstall is called.
function moduleInstall(isMainWindow) {
jsdump("STARTING moduleInstall, isMainWindow:" + isMainWindow);

  var result = retrieveFileArrays();
  
  // delete any files still scheduled to be deleted
  if (result.files2Delete) deleteFiles(result.deleteFiles);
  
  // install any files waiting from a previous install
  if (result.filesWaiting) {
    var blocking = (isMainWindow ? true:false);
    
    // NOTE: finishAndStartXulsword calls installCommandLineModules
    var exitfunc = (isMainWindow ? finishAndWriteManifest:finishAndStartXulsword);
    
    startImport(blocking, exitfunc, result.audioFiles, result.installFiles, result.installEntry, result.newLocales, result.newModules, result.newFonts);
    
    return; 
  }
  else if (result.haveNew) {
    writeManifest(result.newLocales, result.newModules, result.newFonts, true);
    jsdump("ALL FILES WERE SUCCESSFULLY INSTALLED!");
  }
  
  if (!isMainWindow) installCommandLineModules();
}

// check the command-line prefs for requested installation of module 
// files, and if any are found perform the installation. This function
// must insure endInstall() is called when finished.
function installCommandLineModules() {
  var files = [];
  var mods = prefFileArray(files, "xsModule", XSMODULEEXT);
  var bms = prefFileArray(files, "xsBookmark", XSBOOKMARKEXT);
  var audio = prefFileArray(files, "xsAudio", "directory");
  var toFile;
  
  if (audio.haveFiles) {
    var audioPath = [];
    var audiop = prefFileArray(audioPath, "xsAudioPath", "directory", true);
    if (audiop.haveFiles) toFile = audioPath[0];
    if (toFile && !toFile.exists()) {
      try {toFile.create(toFile.DIRECTORY_TYPE, DPERM);} catch (er) {toFile = null;}
    }
  }
    
  if (files.length) {
    if (audio.haveFiles) {
      if (!toFile) toFile = importAudioTo();
      if (toFile && toFile.diskSpaceAvailable < audio.size) {
        diskSpaceMessage(audio.leafNames);
        toFile = null;
      }
      if (!toFile) {
        endInstall();
        return;
      }
    }
    
    // NOTE: finishAndStartXulSword2 calls endInstall
    installModuleArray(finishAndStartXulSword2, files, toFile);
    return;
  }

  endInstall();
}

// see if xulsword's commandline handler has saved to prefs a given 
// type of file for subsequent installation.
function prefFileArray(files, aPref, exts, dontCheckExists) {
  var haveFiles = false;
  var totalsize = 0;
  var leafNames = "";
  try {
    var x=0;
    while(true) {
      var file = prefs.getComplexValue(aPref + x, Components.interfaces.nsILocalFile);
      prefs.clearUserPref(aPref + x);
      if (file && (dontCheckExists || file.exists()) && (file.leafName.match(exts) || (file.isDirectory() && exts=="directory"))) {
          files.push(file);
          haveFiles = true;
          totalsize += getFileSize(file);
          leafNames += file.leafName + ";";
          jsdump(aPref + x + " = " + file.path);
      }
      x++;
    }
  }
  catch(e) {}
  return {haveFiles:haveFiles, leafNames:leafNames, size:totalsize};
}

function restartApplication(promptBefore) {
  if (promptBefore) {
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
      fixWindowTitle(XSBundle.getString("Title")),
      XSBundle.getString("RestartMsg"), 
      DLGINFO,
      DLGOK);
  }
  
  if (LibSword && LibSword.paused) LibSword.resume(); // window unload accesses LibSword object
  
	var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                   .getService(Components.interfaces.nsIAppStartup);

	appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eForceQuit);
}

function setPreMainWin() {
  PreMainWin = (!MainWindow)
  jsdump("PreMainWin = " + PreMainWin);
}
