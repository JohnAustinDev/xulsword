/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import nsILocalFile from '../components/nsILocalFile';
import * as C from '../../constants';

// These directories already exist or will be created

export const TmpD = new nsILocalFile(
  app.getPath('temp'),
  nsILocalFile.NO_CREATE
);

// This location could be the only difference between setup and portable!
export const ProfD = new nsILocalFile(
  app.getPath('userData'),
  nsILocalFile.DIRECTORY_TYPE
);

const xsDefaultsRel =
  process.env.NODE_ENV === 'development'
    ? path.join('..', '..', 'build', 'app', 'defaults')
    : path.join('defaults');

export const xsDefaults = new nsILocalFile(
  path.join(app.getAppPath(), xsDefaultsRel),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsResD = new nsILocalFile(
  path.join(ProfD.path, 'resources'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsModsUser = xsResD;

export const xsPrefD = new nsILocalFile(
  path.join(ProfD.path, 'preferences'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsPrefDefD = new nsILocalFile(
  path.join(xsDefaults.path, 'preferences'),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsFonts = new nsILocalFile(
  path.join(ProfD.path, C.FONTS),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsAudio = new nsILocalFile(
  path.join(ProfD.path, C.AUDIO),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsBookmarks = new nsILocalFile(
  path.join(ProfD.path, C.BOOKMARKS),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsVideo = new nsILocalFile(
  path.join(ProfD.path, C.VIDEO),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsLocale = new nsILocalFile(
  path.join(ProfD.path, C.LOCALED),
  nsILocalFile.DIRECTORY_TYPE
);

export const xsProgram = new nsILocalFile(
  app.getAppPath(),
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
