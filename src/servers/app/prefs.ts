import path from 'path';
import { BrowserWindow } from 'electron'; // may be undefined
import log from 'electron-log';
import PrefsBase from '../../prefs.ts';
import LocalFile from '../components/localFile.ts';
import Dirs from '../components/dirs.ts';
import Data from '../components/data.ts';

import type { PrefsGType } from '../../prefs.ts';

const getStore = (aStore: string) => {
  const pdir = aStore.endsWith('_default')
    ? Dirs.path.xsPrefDefD
    : Dirs.path.xsPrefD;

  const pname = aStore.endsWith('_default')
    ? aStore.replace(/_default$/, '')
    : aStore;

  return new LocalFile(
    path.join(pdir, pname.concat('.json')),
    LocalFile.NO_CREATE,
  );
};

const Prefs = new PrefsBase(
  { type: 'fileStorage', getStore, id: '' },
  log,
  false,
  BrowserWindow,
);

Data.write(Prefs, 'PrefsElectron'); // for buried fontURL()

export default Prefs as PrefsGType;
