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

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
// This window creates xulsword profile directories, installs modules, 
// and then either quits (if xsInstallOnly is set) or opens the splash window
// and main xulsword window (the usual occurence). The main xulsword window 
// closes this hidden window during its init sequence, which in turn closes the
// visible splash window.

var SWLibrary = {};

function startxulsword() {
  prefs.setBoolPref("SessionHasInternetPermission", false);
  XSBundle = document.getElementById("xulsword-strings");
  AllWindows = [];
  rootprefs.setCharPref("intl.uidirection." + getLocale(), getDataUI("locale.dir"));
  initLogging();
  BM = {};
  BMDS = initBMServices(BM);
  AudioDirs = getAudioDirs();
  Book = getBibleBooks();
  createAppDirectories();
  
  // Check that we have libxulsword installed
  if (!BIN.hasOwnProperty(OPSYS)) {
    jsdump("ERROR: This platform is currently not supported. Exiting...");
    closeWindowXS(window);
    return;
  }
  var xulABI = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);
  try {xulABI = xulABI.XPCOMABI;}
  catch (er) {xulABI = "unknown";}
  SWLibrary.libName = "libxulsword-" + prefs.getCharPref("LibxulswordVersion") + "-" + OPSYS + "_" + xulABI + "." + BIN[OPSYS];
  SWLibrary.file = getSpecialDirectory("xsProgram");
  SWLibrary.file.append(SWLibrary.libName);
  if (SWLibrary.file.exists()) {
    startxulsword2();
    return;
  }

  // If not installed, check whether it can be downloaded
  try {SWLibrary.url = prefs.getCharPref("LibSwordURL") + "/" + SWLibrary.libName + ".zip";}
  catch (er) {
    jsdump("ERROR: No libxulsword and no LibSwordURL. Exiting...");
    closeWindowXS(window);
    return;
  }
  
  // Prompt for libxulsword download permission
  var result={};
  SWLibrary.opener = (window.opener ? window.opener:window);
  var dlg = SWLibrary.opener.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
    "",
    XSBundle.getString("LibSwordDownloadMsg") + ":\n" + SWLibrary.url,
    DLGQUEST,
    DLGOKCANCEL
  );
  
  if (!result.ok || !navigator.onLine || !internetPermission(SWLibrary.opener)) {
    closeWindowXS(window);
    return;
  }
  
  // Request the latest compatible libxulsword version available (by reading the FTP directory listing)
  // This only works if LibSwordURL protocol is FTP, otherwise LibxulswordVersion will be requested.
  SWLibrary.window = window;
  SWLibrary.ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
  SWLibrary.context = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
  .getInterface(Components.interfaces.nsIWebNavigation)
  .QueryInterface(Components.interfaces.nsILoadContext);
  
  SWLibrary.listingFile = getSpecialDirectory("TmpD");
  SWLibrary.listingFile.append("libxulswordListing.txt");
  if (SWLibrary.listingFile.exists()) SWLibrary.listingFile.remove(false);
  
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  persist.persistFlags  = persist.PERSIST_FLAGS_BYPASS_CACHE;
  persist.progressListener = 
  {
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},

    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return

      if (aStatus == 0) {
        // see if a newer compatible library version is available
        // If both primary and secondary version numbers match those of LibxulswordVersion, 
        // then the lib is compatible. If a tertiary version number is also present, choose
        // the lib with the highest tertiary.
        var data = readFile(SWLibrary.listingFile);
        var files = data.match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/gm);
        var libvers = prefs.getCharPref("LibxulswordVersion");
        var comparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);
        var compatible = new RegExp(
          escapeRE("libxulsword-") + 
          "(" + escapeRE(libvers.split(".")[0] + "." + libvers.split(".")[1]) + "[^\\-]*)" + 
          escapeRE("-" + OPSYS + "_" + xulABI + "." + BIN[OPSYS])
        ); // is only compatible if major and secondary versions are identical, in addition to platform etc.
        
        for (var i=0; files && i<files.length; i++) {
          var file = files[i].match(/201\: \"(.*?)\" (\d+) .*? FILE\s*$/)[1];
          var vers = file.match(compatible);
          if (vers && comparator.compare(vers[1], libvers) > 0) libvers = vers[1];
        }

        SWLibrary.libName = "libxulsword-" + libvers + "-" + OPSYS + "_" + xulABI + "." + BIN[OPSYS];
        SWLibrary.file = getSpecialDirectory("xsProgram");
        SWLibrary.file.append(SWLibrary.libName);
        SWLibrary.url = prefs.getCharPref("LibSwordURL") + "/" + SWLibrary.libName + ".zip";
      }
      
      if (SWLibrary.listingFile.exists()) SWLibrary.listingFile.remove(false); 
      
      // We've finished checking for latest libxulsword version, so now begin download
      downloadLibxulsword();
    },
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };

  persist.saveURI(SWLibrary.ios.newURI(prefs.getCharPref("LibSwordURL"), null, null), null, null, null, null, SWLibrary.listingFile, SWLibrary.context);
}

function downloadLibxulsword() {
  // Download libxulsword (as a zip file for quicker download)
  SWLibrary.response = 0;
  SWLibrary.zipFile = getSpecialDirectory("TmpD");
  SWLibrary.zipFile.append(SWLibrary.libName + ".zip");
  if (SWLibrary.zipFile.exists()) SWLibrary.zipFile.remove(false); 
  
  // Open progress-meter
  var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  var result = {};
  SWLibrary.progressMeter = SWLibrary.opener.openDialog("chrome://xulsword/content/common/workProgress/workProgress.xul", "work-progress", PMSPLASH, result,
    "",
    "", 
    PMSTOP,
    null,
    function () {persist.cancelSave();}
  );
  
  // Begin download
  persist.persistFlags  = persist.PERSIST_FLAGS_BYPASS_CACHE;
  persist.progressListener = 
  {

    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
      SWLibrary.progressMeter.Progress.setAttribute("value", Math.floor(100*aCurSelfProgress/aMaxSelfProgress));
    },
    
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
      if (!(aStateFlags & 0x10)) return; // if this is not STATE_STOP, always return
      
      try {var http = aRequest.QueryInterface(Components.interfaces.nsIHttpChannel);}
      catch (er) {http = null;}
      if (http) {
        SWLibrary.response = http.responseStatus;
        SWLibrary.status = http.responseStatus + " " + http.responseStatusText;
      }

      if (aStatus == 0 && (!http || SWLibrary.response == 200)) {
        // download success! now unzip the download to get the library
        if (!(/\.(so|dll)$/i).test(SWLibrary.file.leafName)) {
          aStatus = -1;
          SWLibrary.status = "Bad file type \"" + SWLibrary.file.leafName + "\".";
        }
        else {
          SWLibrary.file.create(SWLibrary.file.NORMAL_FILE_TYPE, FPERM);
          
          var zReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
          zReader.open(SWLibrary.zipFile);
          try {zReader.extract(SWLibrary.zipFile.leafName.replace(".zip",""), SWLibrary.file);}
          catch (er) {
            aStatus = -1;
            SWLibrary.status = "nsIZipReader \"" + SWLibrary.zipFile.leafName + "\".";
          }
          zReader.close(SWLibrary.zipFile);
          SWLibrary.file.permissions = FPERM; // zReader sets permissions!
        }
      }
      if (SWLibrary.zipFile.exists()) SWLibrary.zipFile.remove(false);
      
      if (aStatus == 0 && (!http || SWLibrary.response == 200)) {
        // final success! now we're done...
        prefs.setCharPref("LibxulswordVersion", SWLibrary.file.leafName.match(/libxulsword\-([^\-]*)\-/)[1]);
        closeWindowXS(SWLibrary.progressMeter);
        startxulsword2();
      }
      else {
        // could not get libxulsword, so clean up, tell user, and bail...
        if (SWLibrary.file.exists()) SWLibrary.file.remove(false);
        SWLibrary.progressMeter.Progress.setAttribute("value", 5);
        SWLibrary.progressMeter.LabelElem.textContent = "ERROR: " + SWLibrary.status + "\nStatus=" + aStatus;
        SWLibrary.progressMeter.LabelElem.style.width = "400px";
        SWLibrary.progressMeter.sizeToContent();
        closeWindowXS(SWLibrary.window);
      }
      
    },
    
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
      if (aMessage) {
        SWLibrary.status = aMessage;
        jsdump("INFO: Download status " + SWLibrary.url + ": " + aMessage);
      }
    },
    
    onLocationChange: function(aWebProgress, aRequest, aLocation) {},
    
    onSecurityChange: function(aWebProgress, aRequest, aState) {}
  };

  persist.saveURI(SWLibrary.ios.newURI(SWLibrary.url, null, null), null, null, null, null, SWLibrary.zipFile, SWLibrary.context);
}
  
function startxulsword2() {

  if (!IsExtension) {
    // Scripts or programs that need to block while xulsword performs
    // command line module installation (the xsInstallOnly command line 
    // option), will get confused if xulsword needs to restart. Hence 
    // we need xsInstallOnlyMutex. Xulsword will delete the mutex file 
    // when it is done installing to signify to the caller that 
    // installation is complete. The xsInstallOnly pref is set by
    // xulsword's command line handler component: xscommandline.js.
    try {var installOnly = prefs.getBoolPref("xsInstallOnly");} 
    catch (er) {installOnly = false;}
    if (installOnly) {
      var mutex = getSpecialDirectory("TmpD");
      mutex.append("xsInstallOnlyMutex.txt");
      if (!mutex.exists()) createSafeFile(mutex, FPERM);
      jsdump("INFO: xsInstallOnly flag was set");
    }
  }

  // If the FirstRunXSM pref is set, then install the specified XSM 
  // module, which must be located in the xsDefaults directory.
  try {
    var firstRunXSM = prefs.getCharPref("FirstRunXSM");
    prefs.setCharPref("FirstRunXSM", ""); // can't clear pref since it's in defaults/prefs.js
  }
  catch(er) {firstRunXSM = "";}
  if (firstRunXSM) {
    var xsm = getSpecialDirectory("xsDefaults");
    xsm.append(firstRunXSM);
    if (xsm.exists()) installModuleArray(finishAndStartXulSword2, [xsm]);
  }
  else moduleInstall(false); // this will call endInstall() when complete...
  
}

// endInstall is called by newModule.js when module installation is complete
var SplashScreen;
function endInstall() {
  if (WillRestart) return;
  
  if (!IsExtension) {
    try {var installOnly = prefs.getBoolPref("xsInstallOnly");}
    catch(er) {installOnly = false;}
    
    // Are we just installing modules, but not starting xulsword?
    // Or is XS_window already open? Then we're done...
    if (installOnly || XS_window) {
      closeWindowXS(window);
      return;
    }
  }
  
  // If the main xulsword window is already open (which may happen when 
  // startup.xul is opened by an .xsm click for instance) then just reload.
  var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
  var mainwin = watcher.getWindowByName("xulsword-window", window);
  if (mainwin) {
    mainwin.location.reload();
    window.close();
    return;
  }
  
  // Open the visible splash screen and start the main xulsword window
  SplashScreen = openWindowXS("chrome://xulsword/content/startup/splash.xul", "splash-banner", "chrome,alwaysRaised,centerscreen,resizable", "splash-banner");
  window.setTimeout(function () {
    openWindowXS("chrome://xulsword/content/xulsword.xul", "xulsword-window", "chrome,centerscreen,resizable", "xulsword-window");
  }, 300);

  // xulsword.xul may close this window during XS_window init,
  // and then this window's onunload will close the visible splash screen.
}

function unloadXS() {
  if (SplashScreen) {closeWindowXS(SplashScreen);}
  
  if (!IsExtension) {
    try {var installOnly = prefs.getBoolPref("xsInstallOnly");}
    catch (er) {installOnly = false;}
    
    if (installOnly) {
      prefs.setBoolPref("xsInstallOnly", false);
      prefs.clearUserPref("xsInstallOnly");
      jsdump("Quiting... xsInstallOnly command line flag was set.");
      var mutex = getSpecialDirectory("TmpD");
      mutex.append("xsInstallOnlyMutex.txt");
      if (mutex.exists()) mutex.remove(false); // siginify to caller that we're done installing
    }
  }
  
}
