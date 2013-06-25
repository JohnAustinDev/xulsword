/*  This file is part of xulSword.

    Copyright 2013 John Austin (gpl.programs.info@gmail.com)

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

var HaveInternetPermission = false;
function onLoad() {

//prefs.clearUserPref("HaveInternetPermission");

  // Don't allow access to internet until we have express permission!
  try {
    HaveInternetPermission = prefs.getBoolPref("HaveInternetPermission");
  }
  catch(er) {HaveInternetPermission = false;}
  
  if (!HaveInternetPermission) {
    var result = requestInternetPermission();
    HaveInternetPermission = result.ok;
    if (result.checked) prefs.setBoolPref("HaveInternetPermission", HaveInternetPermission);
  }
  
  if (!HaveInternetPermission) {
    window.close();
    return;
  }
  
  
  
}

function requestInternetPermission() {

  var title = safeGetStringFromName("Download From Internet", null, null, "InternetWarning.title");
  var msg = safeGetStringFromName("This will access Bible related websites on the Internet.\n\nDo you wish to continue?", null, null, "InternetWarning.message");
  var cbText = safeGetStringFromName("Remember my choice", null, null, "RememberMyChoice");
  
  var result = {};
  var dlg = window.opener.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result,
      fixWindowTitle(title),
      msg,
      DLGALERT,
      DLGYESNO,
      cbText);
      
  return result;
}

