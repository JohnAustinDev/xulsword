import path from 'path';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import Mprefs, { type PrefsGType } from '../../prefs.ts';
import LocalFile from './localFile.ts';
import Dirs from './dirs.ts';

const fileStorage = (aStore: string) => {
  const pdir = aStore.endsWith('_default')
    ? Dirs.path.xsPrefDefD
    : Dirs.path.xsPrefD;

  return new LocalFile(
    path.join(pdir, aStore.concat('.json')),
    LocalFile.NO_CREATE,
  );
};

const Prefs = new Mprefs(fileStorage, log, false, BrowserWindow);

export default Prefs as PrefsGType;
