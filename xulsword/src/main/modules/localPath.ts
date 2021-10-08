/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import nsILocalFile from '../components/nsILocalFile';

// These directories exist or will be created
// TmpD         = opsys temp directory
// ProfD        = opsys user profile directory
// xsResD       = resource directory
// xsFonts      = user fonts directory
// xsAudio      = user audio directory
// xsBookmarks  = user bookmarks directory
// xsModsUser   = user SWORD module directory (contains mods.d & modules)
// xsModsCommon = shared SWORD module directory (contains mods.d & modules)
// xsLocale     = libsword locale directory
// xsDefaults   = xulsword's defaults directory
// xsProgram    = xulsword's program files root directory
// xsExtension  = profile extensions directory

export const TmpD = new nsILocalFile(
  app.getPath('temp'),
  nsILocalFile.NO_CREATE
);

// This location could be the only difference between setup and portable!
export const ProfD = new nsILocalFile(
  app.getPath('userData'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsDefaults = new nsILocalFile(
  path.join(app.getAppPath(), '..', 'defaults'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsResD = new nsILocalFile(
  path.join(ProfD.path, 'resources'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefD = new nsILocalFile(
  path.join(ProfD.path, 'preferences'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefDefD = new nsILocalFile(
  path.join(xsDefaults.path, 'preferences'),
  nsILocalFile.DIRECTORY_TYPE
);

/*
export default function getSpecialDirectory(name) {
  var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  if (name.substr(0,2) == "xs") {

    var profile = directoryService.get("ProfD", Components.interfaces.nsILocalFile);

    var resources = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    var path = profile.path;
    if (IsExtension) path += "/xulsword_resources";
    else path = path.replace(new RegExp(escapeRE(profile.leafName) + "$"), "resources");
    resources.initWithPath(lpath(path));

    var retval = resources.clone().QueryInterface(Components.interfaces.nsILocalFile);

    switch(name) {
    case "xsFonts":
      retval.append(FONTS);
      break;
    case "xsAudio":
      retval.append(AUDIO);
      break;
    case "xsBookmarks":
      retval.append(BOOKMARKS);
      break;
    case "xsVideo":
      retval.append(VIDEO);
      break;
    case "xsLocale":
      retval.append("locales.d");
      break;
    case "xsExtension":
      retval = profile.clone();
      retval.append("extensions");
      break;
    case "xsResD":
    case "xsModsUser":
      // already correct...
      break;
    case "xsExtResource":
      if (IsExtension) {
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
        retval.append("resources");
      }
      // else return regular resources directory
      break;
    case "xsDefaults":
      if (IsExtension) {
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
        retval.append("defaults");
      }
      else {
        retval = directoryService.get("DefRt", Components.interfaces.nsILocalFile);
      }
      break;
    case "xsProgram":
      if (IsExtension) {
        retval = profile.clone();
        retval.append("extensions");
        retval.append(APPLICATIONID);
      }
      else {
        retval = directoryService.get("CurProcD", Components.interfaces.nsILocalFile);
      }
      break;
    case "xsModsCommon":
      switch (OPSYS) {
      case "WINNT":
        var userAppPath = Components.classes["@mozilla.org/process/environment;1"].
            getService(Components.interfaces.nsIEnvironment).get("APPDATA");
        userAppPath += "/Sword";
        break
      case "Linux":
        var userAppPath = Components.classes["@mozilla.org/process/environment;1"].
            getService(Components.interfaces.nsIEnvironment).get("HOME");
        userAppPath += "/.sword";
        break;
      }
      try {retval.initWithPath(lpath(userAppPath));}
      catch (er) {retval = null;}
      break;
    }
  }
  else {
    retval = directoryService.get(name, Components.interfaces.nsILocalFile);
  }
  return retval;
}
*/
