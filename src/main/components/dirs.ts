/* eslint-disable @typescript-eslint/no-explicit-any */
import { app } from 'electron';
import path from 'path';
import LocalFile from './localFile';

export type DirsDirectories = {
  TmpD: string;
  xsAsset: string;
  xsAsar: string;
  xsProgram: string;
  xsPrefDefD: string;
  xsResDefD: string;
  ProfD: string;
  xsPrefD: string;
  xsResD: string;
  xsModsUser: string;
  xsFonts: string;
  xsAudio: string;
  xsBookmarks: string;
  xsVideo: string;
  xsModsCommon: string;
};

const Dirs = { path: {} as DirsDirectories };

Dirs.path.xsAsset = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', '..', '..', 'assets');

// Packaged filename should be 'app.asar' if package.json has build.asar
// set to true. Or it should be 'app' otherwise.
Dirs.path.xsAsar = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'build', 'app');

Dirs.path.TmpD = app.getPath('temp');

Dirs.path.xsProgram = path.join(process.resourcesPath, '..');

Dirs.path.xsPrefDefD = path.join(Dirs.path.xsAsset, 'defaults', 'preferences');

Dirs.path.xsResDefD = path.join(Dirs.path.xsAsset, 'defaults', 'resources');

Dirs.path.ProfD = app.getPath('userData');

Dirs.path.xsPrefD = path.join(Dirs.path.ProfD, 'preferences');

Dirs.path.xsResD = path.join(Dirs.path.ProfD, 'resources');

Dirs.path.xsModsUser = path.join(Dirs.path.ProfD, 'resources');

Dirs.path.xsFonts = path.join(Dirs.path.xsResD, 'fonts');

Dirs.path.xsAudio = path.join(Dirs.path.xsResD, 'audio');

Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, 'bookmarks');

Dirs.path.xsVideo = path.join(Dirs.path.xsResD, 'video');

Dirs.path.xsModsCommon = /^win32|darwin$/.test(process.platform)
  ? path.join(app.getPath('appData'), 'Sword')
  : path.join(app.getPath('home'), '.sword');

// Add getters for LocalFiles.
const dirNames = Object.getOwnPropertyNames(Dirs.path);
dirNames.forEach((dir) => {
  Object.defineProperty(Dirs, dir, {
    get() {
      return new LocalFile(this.path[dir], LocalFile.NO_CREATE);
    },
  });
});

// Install default resources?
{
  const resd = (Dirs as any).xsResD as LocalFile;
  const resdefd = (Dirs as any).xsResDefD as LocalFile;
  if (!resd.exists() && resdefd.exists()) {
    resdefd.copyTo(resd.parent, resdefd.leafName, true);
  }
}

// Create user directories if they don't exist.
[
  'ProfD',
  'xsPrefD',
  'xsResD',
  'xsModsUser',
  'xsFonts',
  'xsAudio',
  'xsBookmarks',
  'xsVideo',
  'xsModsCommon',
].forEach((dir) => {
  const dirs = Dirs as any;
  const f = dirs[dir];
  f.create(LocalFile.DIRECTORY_TYPE);
});
['xsModsUser', 'xsModsCommon', 'xsAudio'].forEach((r) => {
  const d = Dirs as any;
  d[r].clone().append('mods.d').create(LocalFile.DIRECTORY_TYPE);
  d[r].clone().append('modules').create(LocalFile.DIRECTORY_TYPE);
});

// The DirsClass interface is only available in main process directly through the Dirs object
type DirsMainType = typeof Dirs & {
  [key in keyof DirsDirectories]: LocalFile;
};

export type DirsRendererType = typeof Dirs;

export default Dirs as DirsMainType;
