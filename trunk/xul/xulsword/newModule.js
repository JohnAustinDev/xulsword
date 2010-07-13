/*  This file is part of Muqaddas Kitob.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    Muqaddas Kitob is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    Muqaddas Kitob is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Muqaddas Kitob.  If not, see <http://www.gnu.org/licenses/>.
*/



const SEP = ",";
const TIMEOUT = 25;
const AUDEXT = ["mp3", "wav", "aif"];
const XSMODEXT = ["zip", "xsm"];
const XSBMEXT = ["txt", "xsb"];
const NOVALUE = -1;
const NORESET = 0;
const SOFTRESET = 1;
const HARDRESET = 2;
const NEWINSTALLFILE = "newInstalls.txt";
const PMSTD="centerscreen, dependent";
const PMSPLASH="alwaysRaised,centerscreen";
const PMNORMAL=0, PMSTOP=1;
const VERSIONPAR = "xulswordVersion";
const MINPVERPAR = "minMKVersion";
const VERSIONTAG = new RegExp (VERSIONPAR + "\\s*=\\s*(.*)\\s*", "im");
const MINPROGVERSTAG = new RegExp(MINPVERPAR + "\\s*=\\s*(.*)\\s*", "im");
const MINVERSION = "1.0";

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

function addNewModule(e) {
  // get a module file
  var files = null;
  try {
    const kFilePickerContractID = "@mozilla.org/filepicker;1";
    const kFilePickerIID = Components.interfaces.nsIFilePicker;
    const kTitle = fixWindowTitle(document.getElementById("menu.addNewModule.label").childNodes[0].nodeValue);
    var kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    kFilePicker.init(window, kTitle, kFilePickerIID.modeOpenMultiple);
    kFilePicker.appendFilter("ZIP", "*.zip");
    for (var f=0; f<AUDEXT.length; f++) {
      kFilePicker.appendFilter(AUDEXT[f].toLowerCase(), "*." + AUDEXT[f]);
    }
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
  return installModuleArray(fileArray);
}

function installModuleArray(fileArray, allowStop, blocking, exitFunction) {
  var zipFiles = [];
  var zipEntry = [];
  var regularFiles = [];
  blocking = (blocking ? blocking:false);
  exitFunction = (exitFunction ? exitFunction:finishAndHandleReset);
  
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
  var isPreSword = (MainWindow ? false:true);
  return startImport(exitFunction, blocking, isPreSword, regularFiles, zipFiles, zipEntry, [], [], [], allowStop);
}

function pushAudioFilesInFolder(aFolder, audioFiles) {
  aFolder = aFolder.QueryInterface(Components.interfaces.nsIFile);
  if (!aFolder || !aFolder.isDirectory()) return;
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
  catch (er) {jsdump("Error opening ZIP " + aZipFile.leafName); return [];}
  var entries = zReader.findEntries(null);
  while (entries.hasMore()) {
    var entryText = entries.getNext();
    var entryObj = zReader.getEntry(entryText);
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

function stopImport() {
  if (CopyAnotherFile) window.clearTimeout(CopyAnotherFile);
  ResetNeeded = NORESET;
  ExitFunction();
}

var ResetNeeded;
var Success;
var GotoFile;
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
var PreSword;
var SkipList;
var CopyZipFun;
var CopyRegularFun;
var CountTotal, CountCurrent;
var ProgressMeter, ProgressMeterLoaded;
var WillRestart;
function startImport(exitFunction, blocking, isPreSword, regularFiles, zipFiles, zipEntry, newLocales, newModules, newFonts, allowStop) {
jsdump("STARTING startImport");
  GotoFile = null;
  ResetNeeded = NOVALUE;
  Success = true;
  SkipList = [];
  ExitFunction = exitFunction;
  PreSword = isPreSword;    
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
  WillRestart = false;
  
  if (!blocking && (ZipFiles.length || RegularFiles.length>5)) {
    var result = {};
    ProgressMeterLoaded = false;
    ProgressMeter = window.openDialog("chrome://xulsword/content/workProgress.xul", "work-progress", PMSPLASH, result,
      document.getElementById("menu.addNewModule.label").childNodes[0].nodeValue,
      "", 
      (allowStop ? PMSTOP:PMNORMAL),
      (allowStop ? stopImport:null));
  }
  CountTotal = (ZipFiles ? ZipFiles.length:0) + (RegularFiles ? RegularFiles.length:0);
  CountCurrent = 0;
  
  if ((!ZipFiles || !ZipFiles.length) && (!RegularFiles || !RegularFiles.length)) {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("MODULE WAS EMPTY");
    if (ProgressMeter) ProgressMeter.close();
    return false;  
  }

  var incomp = removeIncompatibleFiles(ZipFiles, ZipEntry);
  if (incomp.oldmodule.length || incomp.newmodule.length) {
    jsdump("There were incompatible components");
    var msg = SBundle.getString("InstalIncomplete") + "\n";
    if (incomp.oldmodule.length) {
      msg += SBundle.getString("OutOfDate") + "\n\n";
      for (var bf=0; bf<incomp.oldmodule.length; bf++) {msg+="\"" + incomp.oldmodule[bf].leafName + "\"\n";}
      msg += "\n" + SBundle.getFormattedString("MinModVersion2", [incomp.minmodversion]) + "\n\n";
    }
    if (incomp.newmodule.length) {
      // Try is for Backward Compatibility to previous UI. May be removed when new UI is released.
      try {
        msg += SBundle.getString("TooNew") + "\n\n";
        for (var bf=0; bf<incomp.newmodule.length; bf++) {msg+="\"" + incomp.newmodule[bf].leafName + "\"\n";}
        msg += "\n" + SBundle.getFormattedString("NeedUpgrade2", [incomp.minprogversion]) + "\n\n";
      }
      catch (er) {
        msg += "The following module(s) have components which are not supported:\n\n";
        for (var bf=0; bf<incomp.newmodule.length; bf++) {msg+="\"" + incomp.newmodule[bf].leafName + "\"\n";}
        msg += "\nUpgrade the program to at least version:\"" + incomp.minprogversion + "\"\n\n";
      }
    }
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
        document.getElementById("menu.addNewModule.label").childNodes[0].nodeValue, 
        msg, 
        DLGALERT,
        DLGOK);
  }

  if (ZipFiles && ZipFiles.length) CopyZipFun();
  else if (RegularFiles && RegularFiles.length) CopyRegularFun();
  // module is MK module, but contained nothing that needed to be, or could be, installed. Show progress meter so user knows it at least tried!
  else {
    if (ProgressMeter) {
      window.setTimeout("if (ProgressMeter.Progress) ProgressMeter.Progress.setAttribute('value', 90);", 500);
      window.setTimeout("if (ProgressMeter.Progress) ProgressMeter.Progress.setAttribute('value', 100);", 1500);
      window.setTimeout("ProgressMeter.close();", 2000);
    }
    ModuleCopyMutex=false;
  }
  
  return true;
}

// Checks compatibility of all sword modules and locales
function removeIncompatibleFiles(fileArray, entryArray) {
  var incomp = {newmodule:[], minprogversion:null, oldmodule:[], minmodversion:null};
  var manifest = new RegExp(CHROME + "\/[^\/]+" + MANIFEST_EXT + "$");
  var conf = new RegExp(MODSD + "\/[^\/]+" + CONF_EXT + "$");
  var comparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
  var progVersion = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo).version;
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
//jsdump("compVers:" + versioninfo.compversion + ", minProgVers:" + versioninfo.minprogversion + ", type:" + versioninfo.type + ", path:" + versioninfo.path, + ", minCompVers:" + versioninfo.mincompversion);
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
            // must read conf file directly because Bible object is not necessarily available...
            else {
              var instconf = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
              var appDir = Components.classes["@mozilla.org/file/directory_service;1"].
                    getService(Components.interfaces.nsIProperties).
                    get("resource:app", Components.interfaces.nsIFile);
              instconf.initWithPath(appDir.path + "\\" + entryArray[f][e].replace("\/", "\\", "g"));
              if (instconf.exists()) {
                overwriteInstalledVersion = readParamFromConf(instconf, VERSIONPAR);
                matchingXSmoduleTextVersion = readParamFromConf(instconf, "Version");
                if (!matchingXSmoduleTextVersion) matchingXSmoduleTextVersion = 0;
              }
            }
          }
          else if (versioninfo.type == MANIFEST_EXT) {
            var locmanifest = Components.classes["@mozilla.org/file/directory_service;1"].
                getService(Components.interfaces.nsIProperties).get("AChrom", Components.interfaces.nsIFile);
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

// Each MK program has two version related params: MinXSMversion, MinUIversion
// Each MK module has five version related params: MKMversion, UIversion, XSMversion, MinProgversionForUI, MinProgversionForXSM
// These params are used as follows:
// 1) program's MinXSMversion > XSMversion of module  = Don't install module, report: module version MinXSMversion is needed
// 2) program's MinUIversion > UIversion of module    = Don't install locale, report: module version MinUIversion is needed
// 3) module's MinProgversionForXSM > program version = Don't install module, report: program version MinProgversionForXSM is needed
// 4) module's MinProgversionForUI > program version  = Don't install locale, report: program version MinProgversionForUI is needed
//
// For reporting to work properly, the following should be identical for a given MK module:
// 1) XSMversion
// 2) UIversion
// 3) MKMversion
//
// However, in order to be backward compatible to the first major MK release (2.7), an exception is allowed:
// If the program's MinXSMversion=1.0 & MinUIversion=2.7, and the module's MinProgversionForXSM=2.7, XSMversion=2.7 & UIversion=MKMversion, the following should also be met:
// 1) MKMversion: 2.7 <= (MKMversion=UIversion) < 3.0.
// 2) Module's MinProgversionForUI: 2.9 >= MinProgversionForUI < 3.0. (but still THE UI MUST NOT CAUSE EXCEPTIONS WHEN INSTALLED ON MK 2.7, because it will not be blocked! MK 2.8 will block it and give an update message, but it (and only it) needs to block, because it has a slightly different security mod which would trip.)
// 3) MK program's version: version < 3.0. 
// 4) When either program's MinXSMversion or MinUIversion are finally changed, THEY MUST START AT 3.0 OR GREATER.
// The above rules allow modules to be created with new version numbers, which are still backward compatible to at least 2.7.
function readVersion(aZip, aEntry, progVers) {
  var info = {compversion:"1.0", minprogversion:null, type:null, path:null, mincompversion:null, error:false, localename:null, xsmodulename:null, xsmoduletext:null};
  var temp = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("TmpD", Components.interfaces.nsIFile);
    
  //exceptions result in keeping the file...
  if (!temp.exists()) return null;
  temp.append("xulsword" + CONF_EXT);
  temp.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0777);
  
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
    info.mincompversion = getPrefOrCreate("MinXSMversion", "Char", MINVERSION);
    isSwordMod = true;
    info.path = readParamFromConf(temp, "DataPath").replace(/^\.\//, "").replace(/\/[^\/]+$/, "/");
    info.xsmodulename = readParamFromConf(temp, "ModuleName");
    info.xsmoduletext = readParamFromConf(temp, "Version");
    if (!info.xsmoduletext) info.xsmoduletext = 0;
  }
  else if (aEntry.search("." + MANIFEST_EXT, "i")!=-1) {
    info.type = MANIFEST_EXT;
    info.mincompversion = getPrefOrCreate("MinUIversion", "Char", progVers);
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
  temp.remove(false);
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
  CopyAnotherFile = window.setTimeout("copyZipFiles();", TIMEOUT);
}

function copyZipFiles() {
  var result = installEntryFromZip(ZipFiles[ZipIndex], ZipEntry[ZipIndex][EntIndex]);
  if (!result.success) jsdump("FAILED:" + ZipEntry[ZipIndex][EntIndex] + ", reset:" + result.reset + ", success:" + result.success + ", remove:" + result.remove);
  if (result.reset > ResetNeeded) ResetNeeded = result.reset;
  if (result.remove) ZipEntry[ZipIndex][EntIndex] = null;
  Success &= result.success;
  
  var pc = 100*((CountCurrent+EntIndex/ZipEntry[ZipIndex].length)/CountTotal);
  if (CountTotal<=3 && ProgressMeterLoaded && ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", pc);
  
  EntIndex++;
  if (EntIndex == ZipEntry[ZipIndex].length) {
    EntIndex = 0;
    ZipIndex++;
    if (ProgressMeterLoaded && ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));
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
  jsdump("Installing File:" + RegularFiles[RegIndex].path);
  var result;
  if (RegularFiles[RegIndex].leafName.match(AUDIOEXT)) result = installAudioFile(RegularFiles[RegIndex]);
  else if (RegularFiles[RegIndex].leafName.match(XSBOOKMARKEXT)) result = installBookmarkFile(RegularFiles[RegIndex]);
  if (result.success) GotoFile = RegularFiles[RegIndex];
  else jsdump("FAILED:" + RegularFiles[RegIndex].leafName + ", reset:" + result.reset + ", success:" + result.success + ", remove:" + result.remove);
  if (result.reset > ResetNeeded) ResetNeeded = result.reset;
  if (result.remove) RegularFiles[RegIndex] = null;
  Success &= result.success;

  if (ProgressMeterLoaded && ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100*(++CountCurrent/CountTotal));
    
  RegIndex++;
  if (RegIndex == RegularFiles.length) ExitFunction();
  else CopyRegularFun();
}

function installAudioFile(aFile) {
  if (!aFile.leafName.match(AUDIOEXT)) return {reset:NORESET, success:false, remove:true};
//jsdump("Importing file:" + aFile.leafName);

  var appDir = Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties).
      get("resource:app", Components.interfaces.nsIFile);
  appDir.append(AUDIO);
  
  var fileInfo = decodeAudioFileName(aFile.path);
  if (!fileInfo) return {reset:NORESET, success:false, remove:true};
  
  var parent = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  parent.initWithPath(appDir.path + "\\" + fileInfo.name + "\\" + fileInfo.book);
  if (!parent.exists()) parent.create(parent.DIRECTORY_TYPE , 0777);
  var check = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  check.initWithPath(parent.path + "\\" + fileInfo.chapter + "." + fileInfo.ext);
  if (check.exists()) {
    try {check.remove(false);}
    catch (er) {return {reset:NORESET, success:false, remove:true};}
  }
  
  try {aFile.copyTo(parent, fileInfo.chapter + "." + fileInfo.ext);}
  catch (er) {return {reset:NORESET, success:false, remove:true};}
  return {reset:NORESET, success:true, remove:true};
}

function installBookmarkFile(aFile) {
  if (!aFile.leafName.match(XSBOOKMARKEXT)) return {reset:NORESET, success:false, remove:true};
  if (!BMDS) BMDS = initBMServices();
  if (!BookmarkFuns.importBMFile(aFile, false, true)) return {reset:NORESET, success:false, remove:true};
  return {reset:NORESET, success:true, remove:true};
}

function installEntryFromZip(aZip, aEntry) {
jsdump("Installing File:" + aEntry);
  var type = aEntry.match(/^([^\\\/]+)(\\|\/)/);
  if (!type) type=AUDIO;
  else {type = type[1];}
    
  var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
                        .createInstance(Components.interfaces.nsIZipReader);
  var inflated = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  var appDir = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("resource:app", Components.interfaces.nsIFile);
        
  //Try and copy this file to destination...
  switch (type) {
  case AUDIO:
    var fileInfo = decodeAudioFileName(aEntry);
    if (!fileInfo) return {reset:NORESET, success:false, remove:true};
    inflated.initWithPath(appDir.path + "\\" + AUDIO + "\\" + fileInfo.name + "\\" + fileInfo.book + "\\" + fileInfo.chapter + "." + fileInfo.ext);
    break;
    
  case MODSD:
    inflated.initWithPath(appDir.path + "\\" + aEntry.replace("\/", "\\", "g"));
    if (inflated.exists() && !PreSword) {
      //Skip writing anything to mods that are currently installed
      try {SkipList.push(readParamFromConf(inflated, "DataPath").replace(/^\.\//, "").replace(/\/[^\/]+$/, "/"));} 
      catch (er) {jsdump("Could not read contents of " + inflated.leafName);}
      return {reset:HARDRESET, success:true, remove:false};
    }
    break;
    
  case MODS:
    inflated.initWithPath(appDir.path + "\\" + aEntry.replace("\/", "\\", "g"));
    var skip = false;
    for (var s=0; s<SkipList.length; s++) {if (aEntry.match(SkipList[s], "i")) skip=true;}
    if (skip) return {reset:HARDRESET, success:true, remove:false};
    break;

  case CHROME:
    inflated.initWithPath(appDir.path + "\\" + aEntry.replace("\/", "\\", "g"));
    var localeName = inflated.leafName.match(/(.*)\.jar/i);
    if (localeName) {
      NewLocales = pushIf(NewLocales, localeName[1]);
      var rootprefs = Components.classes["@mozilla.org/preferences-service;1"].
          getService(Components.interfaces.nsIPrefBranch);
      if (localeName[1] == rootprefs.getCharPref("general.useragent.locale")) {
        rootprefs.setCharPref("general.useragent.locale", DEFAULTLOCALE);
      }
    }
    break;
  case AUDIOPLUGIN:
    inflated.initWithPath(appDir.path + "\\" + AUDIO + "\\" + aEntry.replace("\/", "\\", "g"));
    break;
    
  case FONTS:
  case BOOKMARKS:
    inflated.initWithPath(appDir.path + "\\" + aEntry.replace("\/", "\\", "g"));
    break;
    
  default:
    jsdump("WARNING: Unknown type \"" + type + "\" in " + aZip.leafName);
    return {reset:NORESET, success:false, remove:true};
  }
  
  if (inflated.exists()) {
    try {inflated.remove(true);} catch (er) {return {reset:HARDRESET, success:false, remove:false};}
  }
  inflated.create(inflated.NORMAL_FILE_TYPE, 0777);
  zReader.open(aZip);
  try {zReader.extract(aEntry, inflated);}
  catch (er) {
    zReader.close(aZip);
    return {reset:HARDRESET, success:false, remove:false};
  }
  zReader.close(aZip);

  //Now perform any operations with the newly installed file
  switch (type) {
  case MODSD:
    // delete existing appDir module if it exists
    var modName = removeModuleContents(inflated);
    if (!modName) {
      jsdump("Could not remove module contents " + modName + ".\n");
      return {reset:NORESET, success:false, remove:true};    
    }
    else NewModules = pushIf(NewModules, modName);
    return {reset:(PreSword ? NORESET:SOFTRESET), success:true, remove:true}; 
    break;
    
  case CHROME:
    return {reset:HARDRESET, success:true, remove:true};
    break;
    
  case FONTS:
    appDir.append(FONTS);
    installFontWin(inflated);
    NewFonts = pushIf(NewFonts, inflated.leafName);
    break;
    
  case AUDIO:
    GotoFile = inflated;
    break;
    
  case AUDIOPLUGIN:
    for (var f=0; f<QTIMEINS.length; f++) {
      var inst = new RegExp("^" + escapeRE(QTIMEINS[f]) + "$");
      if (inflated.leafName.search(inst)!=-1) {
        NewPlugin = inflated;
        break;
      }
    }
    break;
    
  case BOOKMARKS:
    if (!BMDS) BMDS = initBMServices();
    if (!BookmarkFuns.importBMFile(inflated, false, true))
        return {reset:NORESET, success:false, remove:true};
    GotoFile = inflated;
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
  finish();
  writeManifest();
}

// use after hard-reset
function finishAndStartXulsword() {
  finish();
  writeManifest();
  installCommandLineModules();
}

// use when installing command line modules
function finishAndStartXulSword2() {
  finish();
  handleResetRequest();
  endInstall();
}

function finish() {
  if (ProgressMeterLoaded && ProgressMeter && ProgressMeter.Progress) ProgressMeter.Progress.setAttribute("value", 100);
  if (ProgressMeter) window.setTimeout("ProgressMeter.close();", 100);
  if (NewPlugin) {
    checkQuickTime();
    NewPlugin = false;
  }
  if (ResetNeeded>NORESET) saveArraysToPrefs();

  if (!PreSword) initAudioDirs();

  if (Success && ResetNeeded==NORESET) jsdump("ALL FILES WERE SUCCESSFULLY INSTALLED!");
  else if (!Success) {
    jsdump("THERE WERE ERRORS DURING INSTALL!");
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
  }
  ModuleCopyMutex=false;
}

function handleResetRequest() {
  switch (ResetNeeded) {
  case NOVALUE: // there was a problem
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("No compatible files found");
    break;
  case NORESET: // program continues running and needs no reload or restart
    if (PreSword) writeManifest(NewLocales, NewModules, NewFonts, true);
    else {
      if (!MainWindow.Bible || !MainWindow.TabVers.length) {
        restartApplication(false);
        break;
      }
      //NOTE: In this case a manafest file for new mods etc. will not be written!
      if (GotoFile) {
        if (GotoFile.leafName.match(AUDIOEXT)) {
          var fileInfo = decodeAudioFileName(GotoFile.path);
          fileInfo.chapter = String(Number(fileInfo.chapter)); // strip off leading 0s
          var aBibleVers=null;
          if (MainWindow.moduleName2TabIndex(fileInfo.name.toUpperCase())!=null) aBibleVers=fileInfo.name.toUpperCase();
          else {
            var mods = MainWindow.getModsWithConfigEntry("AudioCode", fileInfo.name, true, true);
            if (mods[0]) aBibleVers = mods[0];
            else {
              mods = MainWindow.getModsWithConfigEntry("Lang", fileInfo.name, true, true);
              if (mods[0]) aBibleVers = mods[0];
            }
          }
          if (aBibleVers) MainWindow.gotoLink(encodeUTF8(fileInfo.book + "." + fileInfo.chapter + ".1"), aBibleVers);
          else {MainWindow.updateFrameScriptBoxes();}
        }
        else if (GotoFile.leafName.match(XSBOOKMARKEXT)) {
          MainWindow.focus();
          MainWindow.setTimeout("document.getElementById('menu_BookmarksPopup').showPopup();", 500);
        }
      }
      else {MainWindow.updateFrameScriptBoxes();}
    }
    break;
  case SOFTRESET: // program needs to reload all SWORD modules
    if (window.name == "main-window") window.setTimeout("windowLocationReload();", 500);
    else {
      WillRestart = true;
      window.setTimeout("restartApplication();", 500);
    }
    break;
  case HARDRESET: // program needs to quite and restart from nothing
    WillRestart = true;
    window.setTimeout("restartApplication();", 500);
    break;
  }
}

function writeManifest(newLocales, newModules, newFonts, filesNotWaiting) {
  // write a module install file if needed. example- NewLocales;uz;NewModules;uzv;uzdot;uzdnt
  if (ProgressMeter) ProgressMeter.close();
  
  newLocales = (newLocales ? newLocales:NewLocales);
  newModules = (newModules ? newModules:NewModules);
  newFonts = (newFonts ? newFonts:NewFonts);
  if (newLocales.length>0 || newModules.length>0 || newFonts.length>0) {
    var modFileText = "NewLocales;" + newLocales.join(";") + ";NewModules;" + newModules.join(";") + ";NewFonts;" + newFonts.join(";");
    jsdump("WRITING NEW MODULE MANIFEST:" + modFileText + "\n");
    var pfile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("PrfDef", Components.interfaces.nsIFile);
    pfile.append(NEWINSTALLFILE);
    if (pfile.exists()) {
      try {pfile.remove(false);} catch (er) {jsdump("Could not delete " + pfile.path + ".\n");}
    }
    
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(pfile, 0x02 | 0x08 | 0x20, 0777, 0); 
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

//Audio file name format: name-BookshortName-chapterNumber.extension
//name can be language abbreviation (ie ru), module (ie RSTE), or AudioCode from module's .conf file
function decodeAudioFileName(path) {
  var ret = {};
  var savepath = path;
  path = savepath.replace(/^.*[\\\/]/, ""); // get only leafName
  path = path.match(/^(.*)\s*-\s*([^-]+)\s*-\s*(\d+)\s*\.(.*)$/);
  if (path) {
    ret.name =      path[1];
    ret.book =      path[2];
    ret.chapter =   padChapterNum(path[3]);
    ret.ext =       path[4];
    AUDEXT
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) return null;
    if (!validateChapter(ret.book, ret.chapter)) return null;
    return ret;
  }
  
  // If this is exported audio file, return correct info
  path = savepath.match(/([^\\\/]+)[\\\/]\d+\s*-\s*([^\\\/]+)[\\\/](\d+)\s*-\s*[^\.]+\.([^\.]+)$/);
  if (path) {
    ret.name =      path[1];
    try {ret.book = identifyBook(path[2]);} catch (er) {return null;} // This try is needed because identifyBook may be undefined during init
    if (ret.book && ret.book.shortName) ret.book = ret.book.shortName;
    else return null;
    ret.chapter =   padChapterNum(path[3]);
    ret.ext =       path[4];
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) return null;
    if (!validateChapter(ret.book, ret.chapter)) return null;
    return ret;  
  }
  
  // If this is an internal audio file, return the correct info
  path = savepath.match(/([^\\\/]+)[\\\/]([^\\\/]+)[\\\/](\d+)\.([^\.]+)$/);
  if (path) {
    ret.name =      path[1];
    ret.book =      path[2];
    ret.chapter =   padChapterNum(path[3]);
    ret.ext =       path[4];
    for (var e=0; e<AUDEXT.length; e++) {if (ret.ext.match(AUDEXT[e], "i")!=-1) break;}
    if (e==AUDEXT.length) return null;
    if (!validateChapter(ret.book, ret.chapter)) return null;
    return ret;  
  }
  
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
  launchTempScript("vbs", vbsdata);

/* THE FOLLOWING DOES NOT WORK IF THERE ARE SPACES IN THE FILE PATH!!!!!!!
  // execute the vbs script using cmd.exe
  var cmdpath = Components.classes["@mozilla.org/process/environment;1"].
      getService(Components.interfaces.nsIEnvironment).get("ComSpec");
  var cmdexe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  cmdexe.initWithPath(cmdpath);

  var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);  
  process.init(cmdexe);
  var args = [];
  var argt = "/C " + vbsfile.path;
  args.push(argt);
  var result = process.run(true, args, args.length);

  aTempFolder.remove(true);
  jsdump((result==0 ? "Success!":"FAILURE!!!") + "\n");  
  return result==0;
*/
}

function launchTempScript(scriptExtension, scriptContents) {
  var script = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("TmpD", Components.interfaces.nsIFile);
  if (!script.exists()) return;
  script.append("xulswordScript." + scriptExtension);
  script.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0777);

  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(script, 0x02 | 0x08 | 0x20, 0777, 0);
  var charset = "UTF-8"; // Can be any character encoding name that Mozilla supports
  var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  os.init(foStream, charset, 0, 0x0000);
  os.writeString(scriptContents);
  os.close();
  foStream.close();
  
  script = script.QueryInterface(Components.interfaces.nsILocalFile);
  script.launch();
  
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
    if (files[f].leafName.search(/\.conf$/i)!=-1) success &= (removeModuleContents(files[f]) ? true:false);
    try {files[f].remove(true);} catch (er) {success=false; msg += "ERROR: Problem deleting \"" + aMod.path + "\"\n"; continue;}
  }
  if (success) jsdump("Delete was successful!");
  else {
    Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
    jsdump("ERRORS DURING DELETE: " + msg);
  }
}

function removeModuleContents(aConfFile) {
  var pathFromConf = readParamFromConf(aConfFile, "DataPath");
  var modName = readParamFromConf(aConfFile, "ModuleName");
  if (!pathFromConf || !modName) {
    jsdump("Could not read conf file: " + aConfFile.path);
    return null;
  }
    
  pathFromConf = pathFromConf.replace("/", "\\", "g").replace(/^\.\\/, "").replace(/\\[^\\]*$/, "");
  var aMod = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
    .get("resource:app", Components.interfaces.nsIFile).QueryInterface(Components.interfaces.nsILocalFile);
  aMod.initWithPath(aMod.path + "\\" + pathFromConf);
  if (aMod.path.search(MODS)!=-1 && aMod.exists()) {
    jsdump("Attempting remove: " + aMod.path);
    try {aMod.remove(true);} catch (er) {return null;}
  }
  
  try {prefs.clearUserPref("dontAskAboutSearchIndex" + modName);} catch (er) {}
  try {prefs.clearUserPref("CipherKey" + modName);} catch (er) {}
  try {prefs.clearUserPref("ShowingKey" + modName);} catch (er) {}
  return modName;
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
    if (!installModuleArray(files)) ModuleCopyMutex=false;
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

function moduleInstall(isMainWindow) {
jsdump("STARTING moduleInstall, isMainWindow:" + isMainWindow);
  var result = retrieveFileArrays();
  // Delete any files still scheduled to be deleted
  if (result.files2Delete) deleteFiles(result.deleteFiles);
  // Install any files waiting from a previous install!
  if (result.filesWaiting) {
    if (isMainWindow)
      startImport(finishAndWriteManifest, true, true, result.audioFiles, result.installFiles, result.installEntry, result.newLocales, result.newModules, result.newFonts, false);
    else
      startImport(finishAndStartXulsword, false, true, result.audioFiles, result.installFiles, result.installEntry, result.newLocales, result.newModules, result.newFonts, false);
  }
  else if (result.haveNew) {
    writeManifest(result.newLocales, result.newModules, result.newFonts, true);
    jsdump("ALL FILES WERE SUCCESSFULLY INSTALLED!");
    if (!isMainWindow) installCommandLineModules();
  }
  else if (!isMainWindow) installCommandLineModules();
}

function installCommandLineModules() {
  var files = [];
  prefFileArray(files, "xsModule", XSMODULEEXT);
  prefFileArray(files, "xsBookmark", XSBOOKMARKEXT);
  prefFileArray(files, "xsAudio", "directory");
  if (files.length) installModuleArray(files, true, false, finishAndStartXulSword2);
  else endInstall();
}

function prefFileArray(files, aPref, exts) {
  try {
    var x=0;
    while(true) {
      var file = prefs.getComplexValue(aPref + x, Components.interfaces.nsILocalFile);
      prefs.clearUserPref(aPref + x);
      if (file && file.exists() && (file.leafName.match(exts) || (file.isDirectory() && exts=="directory"))) {
          files.push(file);
          jsdump(aPref + x + " = " + file.path);
      }
      x++;
    }
  }
  catch(e) {}
}

function restartApplication(promptBefore) {
  if (promptBefore) {
    var result = {};
    var dlg = window.openDialog("chrome://xulsword/content/dialog.xul", "dlg", DLGSTD, result, 
      SBundle.getString("Title"), 
      SBundle.getString("RestartMsg"), 
      DLGINFO,
      DLGOK);
  }
  
	var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                   .getService(Components.interfaces.nsIAppStartup);

	appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eForceQuit);
}