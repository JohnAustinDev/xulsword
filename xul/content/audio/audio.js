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

var Player = {};
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
function getAudioForChapter(version, bookShortName, chapterNumber) {
	chapterNumber = Number(chapterNumber);
	if (isNaN(chapterNumber)) return null;
	if (Tab[version].audio.hasOwnProperty(bookShortName + "_" + chapterNumber)) {
		return Tab[version].audio[bookShortName + "_" + chapterNumber];
	}
	
	return null;
}

function refreshAudioCatalog() {
  var lang = {};
  var audioCode = {};
  for (var t=0; t<Tabs.length; t++) {
		Tabs[t].audio = {};
		if (Tabs[t].audioCode != NOTFOUND) {
			if (!audioCode.hasOwnProperty(Tabs[t].audioCode.toLowerCase())) audioCode[Tabs[t].audioCode.toLowerCase()] = [];
			audioCode[Tabs[t].audioCode.toLowerCase()].push(Tabs[t].modName);
		}
		if (Tabs[t].lang != NOTFOUND) {
			if (!lang.hasOwnProperty(Tabs[t].lang.toLowerCase())) lang[Tabs[t].lang.toLowerCase()] = [];
			lang[Tabs[t].lang.toLowerCase()].push(Tabs[t].modName);
		}
	}
	
  for (var d=0; d<AudioDirs.length; d++) {
    try {var ok = (AudioDirs[d].dir.exists() && AudioDirs[d].dir.directoryEntries)} catch (er) {continue;}
    if (!ok) continue;
    var codes = AudioDirs[d].dir.directoryEntries;
    while (codes.hasMoreElements()) {
      var code = codes.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (!code.isDirectory()) continue;
			var books = code.directoryEntries;
			while(books.hasMoreElements()) {
				var book = books.getNext().QueryInterface(Components.interfaces.nsILocalFile);
				if (!book.isDirectory()) continue;
				var chapters = book.directoryEntries;
				while(chapters.hasMoreElements()) {
					var chapter = chapters.getNext().QueryInterface(Components.interfaces.nsILocalFile);
					if (chapter.isDirectory()) continue;

					var ext = null
					for (var i=0; i<AUDEXT.length; i++) {
						var re = new RegExp("\\." + escapeRE(AUDEXT[i]) + "$", "i");
						if ((re).test(chapter.leafName)) {ext = AUDEXT[i]; break;}
					}
					if (!ext) continue;
					// currently Linux does not play mp3...
          if (OPSYS == "Linux" && ext == "mp3") continue;
         
          // we have an audio file, so now associate it with its module(s)
          var acode = code.leafName.toLowerCase();
          var abook = book.leafName;
          var achap = chapter.leafName;
          var isLocalized = acode.match(/^(.+)_(.+?)$/);
          if (isLocalized) {
						acode = isLocalized[1];
						isLocalized = isLocalized[2];
						abook = identifyBook(abook.replace(/^\d+\-/, "")).shortName;
						if (!abook) continue;
					}
					achap = achap.match(/(\d+)\.[^\.]+$/);
					if (!achap) continue;
					achap = Number(achap[1]);
				
					var mods = [];
					for (var t=0; t<Tabs.length; t++) {
						if (Tabs[t].modName.toLowerCase() == acode) mods.push(Tabs[t].modName);
					}
					if (lang.hasOwnProperty(acode)) mods = mods.concat(lang[acode]);
					if (audioCode.hasOwnProperty(acode)) mods = mods.concat(audioCode[acode]);	
						
					for (var i=0; i<mods.length; i++) {
						if (Tab[mods[i]].audio.hasOwnProperty(abook + "_" + achap)) {
							jsdump("WARN: Multiple audio files for \"" + mods[i] + ":" + abook + "." + achap + "\"");
						}
						Tab[mods[i]].audio[abook + "_" + achap] = chapter;
					}
					
				}
			}
    }
  }
}

function updateBibleNavigatorAudio() {
	var doc = MainWindow.ViewPort.ownerDocument;
	
	var booknames = doc.getElementsByClassName("bookname");
	for (var i=0; i<booknames.length; i++) {booknames[i].removeAttribute("hasAudio");}
	
	var chapcells = doc.getElementsByClassName("chaptermenucell");
	for (var i=0; i<chapcells.length; i++) {chapcells[i].removeAttribute("hasAudio");}
	
	var vp = MainWindow.ViewPort;
	for (var w=1; w<=vp.NumDisplayedWindows; w++) {
		if (Tab[vp.Module[w]].modType != BIBLE) continue;
		for (var k in Tab[vp.Module[w]].audio) {
			var bk = k.match(/^(.*)_(\d+)$/)[1];
			var ch = k.match(/^(.*)_(\d+)$/)[2];
			var bkelem = doc.getElementById("book_" + findBookNum(bk));
			if (bkelem) bkelem.setAttribute("hasAudio", "true");
			var chelem = doc.getElementById("chmenucell_" + findBookNum(bk) + "_" + ch);
			if (chelem) chelem.setAttribute("hasAudio", "true");
		}
	}
	
}


/************************************************************************
 * Audio player functions
 ***********************************************************************/ 

function beginAudioPlayer() {
	jsdump("beginAudioPlayer:" + MainWindow.Player.version + ", " + MainWindow.Player.chapter + " " + MainWindow.Player.book);
  document.getElementById("historyButtons").hidden = true;
  
  var quit = false;
  if (!Player || !Player.version || !Player.book || !Player.chapter) {
    endAudioPlayer(); 
    return;
  }
  
  var audiofile = getAudioForChapter(Player.version, Player.book, Player.chapter);
  
  if (!audiofile) {
    endAudioPlayer(); 
    return;
  }
  
  jsdump("Have audio:" + audiofile.path + "\n");
  
	var audio = document.getElementById("player").getElementsByTagName("audio")[0];

	// is this file playable? If not then get one that is playable...
	var testfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	for (var i=0; i<AUDEXT.length; i++) {
		var myext = (audiofile.leafName.match(/\.([^\.]+)$/)[1].toLowerCase());
		if (audio.canPlayType(AUDMIME[myext]) !== "") {break;}
		testfile.initWithPath(lpath(audiofile.path.replace(/\.([^\.]+)$/, "." + AUDEXT[i])));
		if (testfile.exists()) audiofile = testfile;
	}

  audio.src = "file://" + audiofile.path;

	Player.canPlay = false; // oncanplay will set this to true

  audio.play();

  document.getElementById("player").hidden = false;

	window.setTimeout("if(!Player.canPlay) reportPlayerError();", 3000);
}

function reportPlayerError() {
	Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound).beep();
  var result = {};
	var bundle = getCurrentLocaleBundle("audio/audio.properties");
  var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result,
      fixWindowTitle(bundle.GetStringFromName("error")),
      bundle.GetStringFromName("audioFormatNotSupported"),
      DLGALERT,
      DLGOK);

	endAudioPlayer();
}

function emptyAudioPlayer() {
	 if (Player.isPinned) {
    endAudioPlayer()
    return;
  }
 
  goDoCommand('cmd_xs_nextChapter');
  Player.book = Location.getBookName();
  Player.chapter = Location.getChapterNumber(MainWindow.Player.version);
  
  beginAudioPlayer();
}

function endAudioPlayer() {
  jsdump("CLosing Player\n");
  var audio = document.getElementById("player").getElementsByTagName("audio")[0];
  document.getElementById("historyButtons").hidden = false;
  document.getElementById("player").hidden = true;
  audio.pause();
}


/************************************************************************
 * Audio import functions
 ***********************************************************************/  
function importAudio(fromDir, toDir, doNotCopyFiles) {
  const kFilePickerContractID = "@mozilla.org/filepicker;1";
  const kFilePickerIID = Components.interfaces.nsIFilePicker;
  const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
  if (!fromDir || doNotCopyFiles) {
    try {
      var kTitle = fixWindowTitle(getDataUI("dlgFrom"));
      for (var i=0; i<AudioDirs.length; i++) {
        if (AudioDirs[i].isInstallDir && AudioDirs[i].dir.exists()) {
          kFilePicker.displayDirectory = AudioDirs[i].dir;
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
    else return installModuleArray(finishAndHandleReset, [fromDir], toDir);
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
    .createBundle("chrome://xulsword/locale/audio/audio.properties")
    .formatStringFromName("diskFull", [fromLeafName], 1);
  }
  catch (er) {msg = "Not enough disk space for this operation.";}
  var result = {};
  var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result,
      fixWindowTitle(getDataUI("menu.importAudio.label")),
      msg,
      DLGALERT,
      DLGOK);
}

function importAudioTo() {
  const kFilePickerContractID = "@mozilla.org/filepicker;1";
  const kFilePickerIID = Components.interfaces.nsIFilePicker;
  const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
  try {
    var kTitle = fixWindowTitle(getDataUI("dlgTo"));
    kFilePicker.init(window, kTitle, kFilePickerIID.modeGetFolder);
    if (kFilePicker.show() == kFilePickerIID.returnCancel) return false;
  }
  catch (e) {return false;}
  if (!kFilePicker.file) return false;
  return kFilePicker.file;
}

function audioDirPref(aDir) {
  var n = getPrefOrCreate("NumAudioImportDirs", "Int", 0);
  aDir = aDir.QueryInterface(Components.interfaces.nsILocalFile);
  if (aDir.equals(getSpecialDirectory("xsAudio"))) return;
  
  for (var i=0; i<AudioDirs.length; i++) {if (aDir.equals(AudioDirs[i].dir)) return;}
  
  // prefs may not be same as audioDirs so check them too...
  for (i=0; i<n; i++) {if (aDir.equals(prefs.getComplexValue("AudioImportDir" + i, Components.interfaces.nsILocalFile))) return;}
  
  prefs.setComplexValue("AudioImportDir" + n, Components.interfaces.nsILocalFile, aDir);
  n++;
  prefs.setIntPref("NumAudioImportDirs", n);
  
  AudioDirs = getAudioDirs();
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
    
    const kTitle = fixWindowTitle(getDataUI("menu.exportAudio.label"));
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
  if (ADestFolder && ADestFolder.isDirectory() && AudioDirs.length) {
    for (var d=AudioDirs.length-1; d>=0; d--) {
      if (!AudioDirs[d].isExportable || !AudioDirs[d].dir.exists() || !AudioDirs[d].dir.isDirectory()) continue;
      exportThisFolder(AudioDirs[d].dir, ADestFolder);
    }
  }
  
  if (!Files || !Files.length) return false;
  
  var result = {};
  ProgressMeter = window.openDialog("chrome://xulsword/content/common/workProgress.xul", "work-progress", PMSTD, result, 
      fixWindowTitle(getDataUI("menu.exportAudio.label")),
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
    window.setTimeout("closeWindowXS(ProgressMeter);", 1000);
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
  // all the slashes are to match both linux and Windows type path separators
  var re = AUDIO + "[\\\\\\/]([^\\\\\\/]+)[\\\\\\/]([^\\\\\\/]+)[\\\\\\/](\\d+)\\.(";
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
  var localeBundle = getLocaleBundle(locale, "common/books.properties");
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
  var bundle = getCurrentLocaleBundle("common/books.properties");
  try {var bnum = bundle.GetStringFromName(shortName + "i");}
  catch (er) {bnum = null; jsdump("Book \"" + shortName + "\" is not in books.properties.");}
  if (bnum !== null) bnum = Number(bnum);

  return bnum;
}
