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

// During xulsword hard restarts (which restart both Firefox and 
// xulsword), a pref is set to indicate that xulsword should be 
// restarted when Firefox restarts.
prefs = Components.classes["@mozilla.org/preferences-service;1"]
              .getService(Components.interfaces.nsIPrefService)
              .getBranch("extensions.xulsword.");
try {var restartXulsword = prefs.getBoolPref("RestartXulsword");}
catch (er) {restartXulsword = false;}
try {prefs.clearUserPref("RestartXulsword");} catch (er) {}

if (restartXulsword) xulswordStart();

function xulswordStart() {
  var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
  if (
    !watcher.getWindowByName("xulsword-temporary-hidden-window", window) && 
    !watcher.getWindowByName("splash-banner", window) && 
    !watcher.getWindowByName("xulsword-window", window)
    ) 
    window.open("chrome://xulsword/content/startup/startup.xul", "xulsword-temporary-hidden-window", "chrome");
}
