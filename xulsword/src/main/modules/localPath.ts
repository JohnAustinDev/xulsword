/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import nsILocalFile from '../components/nsILocalFile';
import * as C from '../../constants';

// Path to the 'assets' directory which moves when packaged
export const ASSET_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', '..', '..', 'assets');

// Path to app contents, which is a directory tree during
// development, but becomes a special tar-like file when packaged.
export const ASAR_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'build', 'app');

// These directories already exist or will be created
export const TmpD = new nsILocalFile(
  app.getPath('temp'),
  nsILocalFile.NO_CREATE
);

// Apparently app.getAppPath is the app's 'current directory'
// which is not necessarily the directory of the app executable.
export const xsProgram = new nsILocalFile(
  path.join(process.resourcesPath, '..'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsDefaults = new nsILocalFile(
  path.join(ASSET_PATH, 'defaults'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefDefD = new nsILocalFile(
  path.join(xsDefaults.path, 'preferences'),
  nsILocalFile.DIRECTORY_TYPE
);

// This location could be the only difference between setup and portable!
export const ProfD = new nsILocalFile(
  app.getPath('userData'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefD = new nsILocalFile(
  path.join(ProfD.path, 'preferences'),
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
