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

const EMAIL = "gpl.programs.info@gmail.com";
const SUBJECT = "Problem Report";
const MAXLENGTH = 1966; //2006 is absolute max;
const URLNEWLINE = "%0A";
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

    var isException = aMessage.flags & aMessage.exceptionFlag;
    if (!isException) {
      this.processingException = false;
      return;
    }
    
    this.skipExceptions = true;
   
    // BUILD REPORT FILE
    var file = "";
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    file += "Vendor:" + prefs.getCharPref("Vendor") + ", ";
    file += "Name:" + prefs.getCharPref("Name") + ", ";
    file += "Version:" + prefs.getCharPref("Version") + ", ";
    file += "Build:" + prefs.getCharPref("BuildID") + ", ";
    file += "xulrunner:" + (appInfo ? appInfo.platformVersion:"unknown") + ", ";
    file += "xrbuildID:" + (appInfo ? appInfo.platformBuildID:"unknown") + ", ";
    file += "Engine:" + prefs.getCharPref("EngineVersion") + URLNEWLINE;
    file += aMessage.message + URLNEWLINE;
    
    file += URLNEWLINE;

    if (OPSYS == "Windows") {
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
        file += keys[k] + " = " + data + URLNEWLINE;
      }
    }
    
    file += URLNEWLINE;        

    try {
      file += "Version1:" + ViewPort.Module[1] + URLNEWLINE;
      file += "Version2:" + ViewPort.Module[2] + URLNEWLINE;
      file += "Version3:" + ViewPort.Module[3] + URLNEWLINE;
    }
    catch(er) {file += "Could not read window modules." + URLNEWLINE;}
    
    try {
      file += "DefaultVersion:" + prefs.getCharPref("DefaultVersion") + URLNEWLINE;
      file += "Location:" + Location.getLocation(prefs.getCharPref("DefaultVersion")) + URLNEWLINE;
    }
    catch (er) {file += "Could not read prefs." + URLNEWLINE;}
    
    try {
      file += "Module List:" + LibSword.getModuleList() + URLNEWLINE;
    }
    catch(er) {file += "ERROR: Could not read LibSword module list." + URLNEWLINE;}

    file += URLNEWLINE;        

    // console messages up to first unhandled exception
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
    var messages = {};
    var length = {};
    consoleService.getMessageArray(messages, length);
    messages = messages.value;
    for (var m = messages.length-1; m>=0; m--) {
      messages[m] = messages[m].QueryInterface(Components.interfaces.nsIConsoleMessage).message;
      file += messages[m] + URLNEWLINE;
    }
   
    // EMAIL REPORT FILE
    var result={};
    var bundle = getCurrentLocaleBundle("startup/startup.properties");
    var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
      bundle.GetStringFromName("Title"),
      bundle.formatStringFromName("SendErrorReport", [bundle.GetStringFromName("dialog.OK")], 1) + "\n\n" + aMessage.message,
      DLGALERT,
      DLGOKCANCEL,
      bundle.GetStringFromName("dontShowAgain")
    );
    
    if (result.checked) {
      prefs.setBoolPref("DontShowExceptionDialog", true);
      setConsoleService(false);
    }
    
    if (!result.ok) {
      this.processingException = false;
      return;
    }
    
    //file = URLencode(file);
    var aURI = "mailto:" + EMAIL + "?subject=" + SUBJECT + "&body=" + file;
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);
    aURI = ios.newURI(aURI, null, null);
    aURI = aURI.asciiSpec;
    aURI = aURI.substr(0, MAXLENGTH);

    this.processingException = false;
    
    window.location = aURI;
  },
  
  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
		  throw Components.results.NS_ERROR_NO_INTERFACE;
	  }
    return this;
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

  setConsoleService(!prefs.getBoolPref("DontShowExceptionDialog"));
}
