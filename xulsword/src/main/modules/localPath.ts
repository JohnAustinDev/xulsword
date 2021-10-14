/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import nsILocalFile from '../components/nsILocalFile';
import * as C from '../../constants';

// Path to the 'assets' directory of package.json build.extraResources
export const ASSET_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', '..', '..', 'assets');

// Path to app.asar contents. Before packaging these are build/app/
// subdirectories. But those directories listed in package.json build.files
// will be combined into a tar-like app.asar file after packaging, and the
// app.asar file conetents can be accessed using a regular path.
export const ASAR_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'build', 'app');

export const TmpD = new nsILocalFile(
  app.getPath('temp'),
  nsILocalFile.NO_CREATE
);

// These directories already exist or will be created

// Note: app.getAppPath is the app's 'current directory' which
// is not necessarily the directory of the app executable. But
// xsProgram is the directory of the packaged app's executable.
export const xsProgram = new nsILocalFile(
  path.join(process.resourcesPath, '..'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsDefaults = new nsILocalFile(
  path.join(ASSET_PATH, C.DEFAULTS),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefDefD = new nsILocalFile(
  path.join(xsDefaults.path, C.PREFERENCES),
  nsILocalFile.DIRECTORY_TYPE
);

// This location could be the only difference between setup and portable!
export const ProfD = new nsILocalFile(
  app.getPath('userData'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefD = new nsILocalFile(
  path.join(ProfD.path, C.PREFERENCES),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsResD = new nsILocalFile(
  path.join(ProfD.path, 'resources'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsModsUser = xsResD;

export const xsFonts = new nsILocalFile(
  path.join(xsResD.path, C.FONTS),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsAudio = new nsILocalFile(
  path.join(xsResD.path, C.AUDIO),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsBookmarks = new nsILocalFile(
  path.join(xsResD.path, C.BOOKMARKS),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsVideo = new nsILocalFile(
  path.join(xsResD.path, C.VIDEO),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsLocale = new nsILocalFile(
  path.join(xsResD.path, C.LOCALED),
  nsILocalFile.DIRECTORY_TYPE
);

let xsModsCommonDir;
switch (process.platform) {
  case 'win32':
  case 'darwin':
    xsModsCommonDir = path.join(app.getPath('appData'), 'Sword');
    break;
  default:
    xsModsCommonDir = path.join(app.getPath('home'), '.sword');
    break;
}

export const xsModsCommon = new nsILocalFile(
  xsModsCommonDir,
  nsILocalFile.DIRECTORY_TYPE
);
