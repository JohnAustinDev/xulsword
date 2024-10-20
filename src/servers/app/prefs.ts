import path from 'path';
import { BrowserWindow } from 'electron'; // may be undefined
import log from 'electron-log';
import PrefsBase from '../../prefs.ts';
import LocalFile from '../components/localFile.ts';
import Dirs from '../components/dirs.ts';

import type { PrefStorage, PrefsGType } from '../../prefs.ts';

const fileStorage = (aStore: string) => {
  const pdir = aStore.endsWith('_default')
    ? Dirs.path.xsPrefDefD
    : Dirs.path.xsPrefD;

  const file = new LocalFile(
    path.join(pdir, aStore.concat('.json')),
    LocalFile.NO_CREATE,
  );

  return Object.assign(file, { supported: () => true });
};

const Prefs = new PrefsBase(fileStorage, log, false, BrowserWindow);

export default Prefs as PrefsGType;
