/* eslint-disable @typescript-eslint/no-explicit-any */

// import { app } from 'electron';
import path from 'path';
import LocalFile from '../localFile';

import type { DirsDirectories, GType } from '../../../type';

const Dirs = { path: {} } as GType['Dirs'];
const CrosswireRoot = String(process.env.HOME);

Dirs.path.xsAsset = path.join(__dirname, '..', '..', '..', 'assets');
// Dirs.path.xsAsar = path.join(__dirname, '..', '..', 'build', 'app');
// Dirs.path.TmpD = app.getPath('temp');
// Dirs.path.xsProgram = path.join(process.resourcesPath, '..');
// Dirs.path.xsDefaults = path.join(Dirs.path.xsAsset, C.DEFAULTS);
// Dirs.path.xsPrefDefD = path.join(Dirs.path.xsDefaults, C.PREFERENCES);
Dirs.path.ProfD = path.join(CrosswireRoot, '.crosswire', 'xulsword');
// Dirs.path.xsPrefD = path.join(Dirs.path.ProfD, C.PREFERENCES);
Dirs.path.xsResD = path.join(Dirs.path.ProfD, 'resources');
Dirs.path.xsModsUser = path.join(Dirs.path.ProfD, 'resources');
// Dirs.path.xsFonts = path.join(Dirs.path.xsResD, 'fonts');
// Dirs.path.xsAudio = path.join(Dirs.path.xsResD, 'audio');
// Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, 'bookmarks');
// Dirs.path.xsVideo = path.join(Dirs.path.xsResD, 'video');

// Dirs.path.xsModsCommon = /^win32|darwin$/.test(process.platform)
//   ? path.join(app.getPath('appData'), 'Sword')
//   : path.join(app.getPath('home'), '.sword');

// Add getters for LocalFiles.
const dirNames = Object.getOwnPropertyNames(Dirs.path);
dirNames.forEach((dir) => {
  Object.defineProperty(Dirs, dir, {
    get() {
      return new LocalFile(this.path[dir], LocalFile.NO_CREATE);
    },
  });
});

// Create all directories if they don't exist, except those in noCreate.
// const noCreate = ['TmpD'];
// dirNames.forEach((dir) => {
//   if (!noCreate.includes(dir)) {
//     const dirs = Dirs as any;
//     const f = dirs[dir];
//     f.create(LocalFile.DIRECTORY_TYPE);
//   }
// });

// The DirsClass interface is only available in main process directly through the Dirs object
type DirsClass = GType['Dirs'] &
  {
    [key in keyof DirsDirectories]: LocalFile;
  };

export default Dirs as DirsClass;
