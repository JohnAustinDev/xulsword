import path from 'path';
import log from 'electron-log';
import Mprefs, { type PrefsGType } from '../../prefs.ts';
import LocalFile from './localFile.ts';
import Dirs from './dirs.ts';

import type { BrowserWindow as BW } from 'electron';

// Note: BrowserWindow will be undefined when running as a web app
const { BrowserWindow } = (await import('electron')) as {
  BrowserWindow: typeof BW | undefined;
};

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
