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

const SUBJECT = "Problem Report";
const MAXLENGTH = 5000
const URLNEWLINE = "\n";

var aConsoleListener =
{
  skipExceptions:false,
  processingException:false,
  
  observe: function(aMessage) {
    if (this.skipExceptions || this.processingException) return;
    this.processingException = true;
    
    try {aMessage = aMessage.QueryInterface(Components.interfaces.nsIScriptError);}
    catch(er) {aMessage=null;}
    if (!aMessage) {
      this.processingException = false;
      return;
    }

    // only alert about exceptions in xulsword code- ignore exceptions in Firefox code
    var isException = aMessage.flags & aMessage.exceptionFlag;
    if (!isException || !(/chrome\:\/\/xulsword\/content/).test(aMessage.message)) {
      this.processingException = false;
      return;
    }
    
    this.skipExceptions = true; // only report the first exception during a session...
    
		prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);  
		prefs = prefs.getBranch("extensions.xulsword.");
   
    // BUILD REPORT
    var rep = aMessage.message + URLNEWLINE;
    
    rep += this.getPlatformInfo();

    try {rep += "Version1:" + ViewPort.Module[1] + ", ";}
    catch (er) {rep += "Could not read ViewPort.Module[1]. ";}
    try {rep += "Version2:" + ViewPort.Module[2] + ", ";}
    catch (er) {rep += "Could not read ViewPort.Module[2]. ";}
    try {rep += "Version3:" + ViewPort.Module[3] + ", ";}
    catch (er) {rep += "Could not read ViewPort.Module[3]. ";}
    
    try {rep += "DefaultVersion:" + prefs.getCharPref("DefaultVersion") + ", ";}
    catch (er) {rep += "Could not read pref 'DefaultVersion'. ";}
    try {rep += "Location:" + Location.getLocation(prefs.getCharPref("DefaultVersion")) + ", ";}
    catch (er) {rep += "Could not read Location. ";}
    
    rep += URLNEWLINE;
    
    try {rep += "Module List:" + LibSword.getModuleList() + URLNEWLINE;}
    catch(er) {rep += "ERROR: Could not read LibSword module list." + URLNEWLINE;}     
   
    // prompt user to report problem
    try {var haveInternetPermission = (prefs.getBoolPref("SessionHasInternetPermission") || prefs.getBoolPref("HaveInternetPermission"));}
		catch (er) {haveInternetPermission = false;}

    var result={checked:false, ok: false};
    try {
			var bundle = getCurrentLocaleBundle("startup/startup.properties");
			var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
				bundle.GetStringFromName("Title"),
				(haveInternetPermission ? bundle.formatStringFromName("SendErrorReport", [bundle.GetStringFromName("dialog.OK")], 1) + "\n\n":"") + aMessage.message,
				DLGALERT,
				(haveInternetPermission ? DLGOKCANCEL:DLGOK),
				bundle.GetStringFromName("dontShowAgain")
			);
		}
		catch (er) {}
    
    if (result.checked) {
      prefs.setBoolPref("DontShowExceptionDialog", true);
      setConsoleService(false);
    }
   
    if (!result.ok || !haveInternetPermission) {
      this.processingException = false;
      return;
    }
    
    try {var url = prefs.getCharPref("ProblemReportURL");} catch (er) {url=null;}
    if (!url) {
			this.processingException = false;
      return;
		}
    
    var params = "xulsword=1&report=" + encodeURIComponent(rep.substr(0, MAXLENGTH)).replace(/%20/g, '+');
		var ajax = new XMLHttpRequest();
		ajax.open("POST", url, true);
		ajax.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		ajax.setRequestHeader("Content-length", params.length);
		ajax.setRequestHeader("Connection", "close");
		ajax.send(params);
		
		this.processingException = false;
    
  },
  
  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
		  throw Components.results.NS_ERROR_NO_INTERFACE;
	  }
    return this;
  },
  
  getPlatformInfo: function() {
		var info = "Program info: ";
		
		prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);  
		prefs = prefs.getBranch("extensions.xulsword.");
    
    var bid = prefs.getCharPref("BuildID");
    if (LibSword && !LibSword.loadFailed) bid += LibSword.LibswordPath.match(/libxulsword\-(.*?)\.[^\.]+$/)[1];
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    info += "Vendor:" + prefs.getCharPref("Vendor") + ", ";
    info += "Name:" + prefs.getCharPref("Name") + ", ";
    info += "Version:" + prefs.getCharPref("Version") + ", ";
    info += "Build:" + bid + ", ";
    info += "LibxulswordVersion:" + prefs.getCharPref("LibxulswordVersion") + ", ";
    info += "xulrunner version:" + (appInfo ? appInfo.platformVersion:"unknown") + ", ";
    info += "xulrunner buildID:" + (appInfo ? appInfo.platformBuildID:"unknown") + ", ";
    info += "SWORD Engine version:" + prefs.getCharPref("EngineVersion");
    
    info += URLNEWLINE;

    if (OPSYS == "WINNT") {
      var keys = ["ProductName", "CSDVersion", "CurrentBuildNumber", "CurrentVersion"];
      var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
      for (var k=0; wrk && k<keys.length; k++) {
        var data = "";
        try {
          wrk.open(wrk["ROOT_KEY_LOCAL_MACHINE"], "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", wrk.ACCESS_READ);
          var data = wrk.readStringValue(keys[k]);
          wrk.close();
        }
        catch(er) {data = "failed to read registry value";}
        info += keys[k] + " = " + data + ", ";
      }
      info += URLNEWLINE;
    }
    
    return info;
	}
  
};

function setConsoleService(addListener) {
  if (addListener) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
    consoleService.registerListener(aConsoleListener);
  }
  else {
    try {
      var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
          .getService(Components.interfaces.nsIConsoleService);
      consoleService.unregisterListener(aConsoleListener);
    }
    catch(er) {}
  }
}

function initLogging() {
  var debugInfo = getSpecialDirectory("ProfD");
  debugInfo.append("consoleLog.txt");
  if (!debugInfo.exists()) debugInfo.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FPERM);
  var env = Components.classes["@mozilla.org/process/environment;1"].getService(Components.interfaces.nsIEnvironment);
  env.set("XRE_CONSOLE_LOG", debugInfo.path);

	try {var dev = prefs.getCharPref("BuildID").match(/D$/);} 
	catch (er) {dev = null;}
    
  if (!dev && !prefs.getBoolPref("DontShowExceptionDialog")) setConsoleService(true);
}
