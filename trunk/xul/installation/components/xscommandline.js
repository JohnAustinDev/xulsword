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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const CLINE_SERVICE_CTRID =
    "@mozilla.org/commandlinehandler/xs-startup;1?type=xulsword";
const CLINE_SERVICE_CID =
    Components.ID("{06d08b00-8b27-11df-a4ee-0800200c9a66}");
    
    
function saveFileArgs(arg, cmdLine, prefs) {
  var x = 0
  try {
    var filestr = cmdLine.handleFlagWithParam(arg, false);
    while (filestr) {
      var file = cmdLine.resolveFile(filestr);
      file = file.QueryInterface(Components.interfaces.nsILocalFile);
      if (file) {
        prefs.setComplexValue(arg + x, Components.interfaces.nsILocalFile, file);
        x++;
      }
      filestr = cmdLine.handleFlagWithParam(arg, false);
    }
  }
  catch (e) {
    Components.utils.reportError("incorrect parameter passed to -" + arg + " on the command line: \"" + filestr + "\"");
  }
}
  
/////////////////////
/* Command Line handler service */
function CLineService()
{}

/* nsISupports */
CLineService.prototype.QueryInterface =
function handler_QI(iid)
{
    var ifaces = this.getInterfaces({});
    for (var face in ifaces)
    {
        if (iid.equals(ifaces[face]))
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

/* nsIClassInfo */
CLineService.prototype.getInterfaces =
function getInterfaces(aCount)
{
    var interfaces = [Components.interfaces.nsISupports,
                      Components.interfaces.nsIClassInfo,
                      Components.interfaces.nsIObserver,
                      Components.interfaces.nsICommandLineHandler];

    aCount.value = interfaces.length;
    return interfaces;
};

CLineService.prototype.getHelperForLanguage =
function getHelperForLanguage()
{
    return null;
};

CLineService.prototype.contractID = CLINE_SERVICE_CTRID;
CLineService.prototype.classDescription = "Commandline handler for xulsword";
CLineService.prototype.classID = CLINE_SERVICE_CID;
CLineService.prototype.implementationLanguage = Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT;
CLineService.prototype.flags = Components.interfaces.nsIClassInfo.SINGLETON;
CLineService.prototype._xpcom_categories = [{
     category: "profile-after-change",
     entry: "a-xulsword"
   },
   {
     category: "command-line-handler",
     entry: "m-a-xulsword"
   }];

CLineService.prototype.prefNameForStartup = "general.startup.xulsword";

/* nsICommandLineHandler */

CLineService.prototype.handle =
function handler_handle(cmdLine)
{
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
    prefs = prefs.getBranch("extensions.xulsword.");

    saveFileArgs("xsModule", cmdLine, prefs);
    saveFileArgs("xsBookmark", cmdLine, prefs);
    saveFileArgs("xsAudio", cmdLine, prefs);
    saveFileArgs("xsAudioPath", cmdLine, prefs);

    if (cmdLine.handleFlag("xsInstallOnly", false)) prefs.setBoolPref("xsInstallOnly", true);
}

CLineService.prototype.helpInfo =
            "  -xsModule <path>     Install a xulSword module\n" +
            "  -xsBookmark <path>   Install bookmarks from a file\n" +
            "  -xsAudio <path>      Install audio from this directory\n" +
            "  -xsAudioPath         Install audio to this directory\n" +
            "  -xsInstallOnly       Don't open xulSword, just install\n"

CLineService.prototype.observe =
function handler_observe(subject, topic, data){}

var components = [CLineService];
var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);


