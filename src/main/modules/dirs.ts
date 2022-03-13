/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import C from '../../constant';
import nsILocalFile from '../components/nsILocalFile';

import type { DirsDirectories, GType } from '../../type';

const Dirs = { path: {} } as GType['Dirs'];

Dirs.path.xsAsset = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', '..', '..', 'assets');

Dirs.path.xsAsar = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar') // should be 'app.asar' if package.json build.asar is true or 'app' otherwise
  : path.join(__dirname, '..', '..', '..', 'build', 'app');

Dirs.path.TmpD = app.getPath('temp');

Dirs.path.xsProgram = path.join(process.resourcesPath, '..');

Dirs.path.xsDefaults = path.join(Dirs.path.xsAsset, C.DEFAULTS);

Dirs.path.xsPrefDefD = path.join(Dirs.path.xsDefaults, C.PREFERENCES);

Dirs.path.ProfD = app.getPath('userData');

Dirs.path.xsPrefD = path.join(Dirs.path.ProfD, C.PREFERENCES);

Dirs.path.xsResD = path.join(Dirs.path.ProfD, 'resources');

Dirs.path.xsModsUser = path.join(Dirs.path.ProfD, 'resources');

Dirs.path.xsFonts = path.join(Dirs.path.xsResD, C.FONTS);

Dirs.path.xsAudio = path.join(Dirs.path.xsResD, C.AUDIO);

Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, C.BOOKMARKS);

Dirs.path.xsVideo = path.join(Dirs.path.xsResD, C.VIDEO);

Dirs.path.xsLocale = path.join(Dirs.path.xsResD, C.LOCALED);

Dirs.path.xsModsCommon = /^win32|darwin$/.test(process.platform)
  ? path.join(app.getPath('appData'), 'Sword')
  : path.join(app.getPath('home'), '.sword');

// Add getters for nsiLocalFiles.
const dirNames = Object.getOwnPropertyNames(Dirs.path);
dirNames.forEach((dir) => {
  Object.defineProperty(Dirs, dir, {
    get() {
      return new nsILocalFile(this.path[dir], nsILocalFile.NO_CREATE);
    },
  });
});

// Create all directories if they don't exist, except those in noCreate.
const noCreate = ['TmpD'];
dirNames.forEach((dir) => {
  if (!noCreate.includes(dir)) {
    const dirs = Dirs as any;
    const f = dirs[dir];
    f.create(nsILocalFile.DIRECTORY_TYPE);
  }
});

// The DirsClass interface is only available in main process directly through the Dirs object
type DirsClass = GType['Dirs'] &
  {
    [key in keyof DirsDirectories]: nsILocalFile;
  };

export default Dirs as DirsClass;
