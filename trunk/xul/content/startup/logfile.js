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
  bundle:Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://xulsword/locale/startup/startup.properties"),
  
  haveException:false,
  
  observe:function( aMessage ){
    if (this.haveException) return;
    try {aMessage = aMessage.QueryInterface(Components.interfaces.nsIScriptError);}
    catch(er) {aMessage=null;}
    if (aMessage) {
      var isException = aMessage.flags & aMessage.exceptionFlag;
      if (isException) {
        this.haveException = true;
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
            .getService(Components.interfaces.nsIConsoleService);
        var messages = {};
        var length = {};
        consoleService.getMessageArray(messages, length);
        messages = messages.value;
        
        // BUILD REPORT FILE
        var file = "";
        try {
          var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
          var engineVersion; try {engineVersion = prefs.getCharPref("EngineVersion");} catch (er) {engineVersion = NOTFOUND;}
          file += "Vendor:" + prefs.getCharPref("Vendor") + ", Name:" + prefs.getCharPref("Name") + ", Version:" + prefs.getCharPref("Version") + ", Build:" + prefs.getCharPref("BuildID") + ", Xulrunner:" + appInfo.platformVersion + ", " + appInfo.platformBuildID + ", Engine:" + engineVersion + URLNEWLINE;
        }
        catch (er) {file += "Could not read appInfo!" + URLNEWLINE;}
        file += aMessage.message + URLNEWLINE;
        
        file += URLNEWLINE;
        //file += "SYSTEM INFO:" + URLNEWLINE;
        //file += getRuntimeInfo();
        var keys = ["ProductName", "CSDVersion", "CurrentBuildNumber", "CurrentVersion"];
        for (var k=0; k<keys.length; k++) {file += this.getRegKeySafeWin("ROOT_KEY_LOCAL_MACHINE", "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", keys[k]) + URLNEWLINE;}

        file += URLNEWLINE;        
        //file += "MODULES, STATIC VARS:" + URLNEWLINE;
        try {
          file += "Version1:" + prefs.getCharPref("Version1") + URLNEWLINE;
          file += "Version2:" + prefs.getCharPref("Version2") + URLNEWLINE;
          file += "Version3:" + prefs.getCharPref("Version3") + URLNEWLINE;
          file += "DefaultVersion:" + prefs.getCharPref("DefaultVersion") + URLNEWLINE;
          file += "Location:" + Location.getLocation(prefs.getCharPref("DefaultVersion")) + URLNEWLINE;
          file += "Module List:" + LibSword.getModuleList() + URLNEWLINE;
        }
        catch(er) {file += "ERROR: Could not read b-object." + URLNEWLINE;}

        file += URLNEWLINE;        
        //file += "CONSOLE (IN REVERSE):" + URLNEWLINE;
        // console messages up to first unhandled exception
        for (var m=messages.length-1; m>=0; m--) {
          messages[m] = messages[m].QueryInterface(Components.interfaces.nsIConsoleMessage).message;
          file += messages[m] + URLNEWLINE;
        }
        
        // EMAIL REPORT FILE
        if (window.opener) {window.opener.close();} // Don't let splash screen obscure dialogs...
 
        var result={};
        var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
            this.bundle.getString("Title"),
            this.bundle.getFormattedString("SendErrorReport", [this.bundle.GetStringFromName("dialog.OK")]),
            DLGALERT,
            DLGOKCANCEL,
            this.bundle.GetStringFromName("dontShowAgain"));
          
        if (result.checked) {
          var dsed = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService); 
          dsed = dsed.getBranch("xulsword.");
          dsed.setBoolPref("DontShowExceptionDialog", true);
          setConsoleService(false);
        }
        if (!result.ok) return;
        
//jsdump(file);
        //file = URLencode(file);
        var aURI = "mailto:" + EMAIL + "?subject=" + SUBJECT + "&body=" + file;
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
        aURI = ios.newURI(aURI, null, null);
        aURI = aURI.asciiSpec;
        aURI = aURI.substr(0,MAXLENGTH);
        
//jsdump(aURI);
        try {
          window.location = aURI;
          this.jsdump("Launched mailto URI of " + aURI.length + " chars.");
        }
        catch (er) {this.jsdump(er);}
        //this.haveException = false;
      }
    }
  },
  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
		  throw Components.results.NS_ERROR_NO_INTERFACE;
	  }
    return this;
  },
  
  getRegKeySafeWin: function(rootKey, key, value) {
    if (typeof Components.classes["@mozilla.org/windows-registry-key;1"] != "undefined") {
      var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
    }
    else {
      this.jsdump("Could not get nsIWindowsRegKey instance from @mozilla.org/windows-registry-key;1");
      return "";
    }
    try {
      wrk.open(wrk[rootKey], key, wrk.ACCESS_READ);
      var data = wrk.readStringValue(value);
      wrk.close();
    }
    catch (er) {this.jsdump("Could not read Windows key:" + rootKey + ", " + key + ", " + value); return "";}
    return value + " = " + data;
  },
  
  jsdump: function(str) {
    Components.classes['@mozilla.org/consoleservice;1']
              .getService(Components.interfaces.nsIConsoleService)
              .logStringMessage(str);
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

  var dsed = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
  dsed = dsed.getBranch("xulsword.");
  try {dsed = dsed.getBoolPref("DontShowExceptionDialog");}
  catch(er) {dsed=false;}

  setConsoleService(!dsed);
}
