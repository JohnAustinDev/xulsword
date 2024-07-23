import path from 'path';
import { BrowserWindow } from 'electron'; // may be undefined
import log from 'electron-log';
import PrefsBase, { type PrefsGType } from '../../prefs.ts';
import LocalFile from '../components/localFile.ts';
import Dirs from '../components/dirs.ts';

const fileStorage = (aStore: string) => {
  const pdir = aStore.endsWith('_default')
    ? Dirs.path.xsPrefDefD
    : Dirs.path.xsPrefD;

  return new LocalFile(
    path.join(pdir, aStore.concat('.json')),
    LocalFile.NO_CREATE,
  );
};

const Prefs = new PrefsBase(fileStorage, log, false, BrowserWindow);

export default Prefs as PrefsGType;
