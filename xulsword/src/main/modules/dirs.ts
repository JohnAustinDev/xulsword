/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import nsILocalFile from '../components/nsILocalFile';
import C from '../../constant';
import { GPublic } from '../../type';

const Dirs = {
  paths: {} as keyof typeof GPublic.Dirs,
  get path() {
    return this.paths;
  },
};

Dirs.paths.xsAsset = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', '..', '..', 'assets');
Dirs.paths.xsAsar = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'build', 'app');
Dirs.paths.TmpD = app.getPath('temp');
Dirs.paths.xsProgram = path.join(process.resourcesPath, '..');
Dirs.paths.xsDefaults = path.join(Dirs.paths.xsAsset, C.DEFAULTS);
Dirs.paths.xsPrefDefD = path.join(Dirs.paths.xsDefaults, C.PREFERENCES);
Dirs.paths.ProfD = app.getPath('userData');
Dirs.paths.xsPrefD = path.join(Dirs.paths.ProfD, C.PREFERENCES);
Dirs.paths.xsResD = path.join(Dirs.paths.ProfD, 'resources');
Dirs.paths.xsModsUser = path.join(Dirs.paths.ProfD, 'resources');
Dirs.paths.xsFonts = path.join(Dirs.paths.xsResD, C.FONTS);
Dirs.paths.xsAudio = path.join(Dirs.paths.xsResD, C.AUDIO);
Dirs.paths.xsBookmarks = path.join(Dirs.paths.xsResD, C.BOOKMARKS);
Dirs.paths.xsVideo = path.join(Dirs.paths.xsResD, C.VIDEO);
Dirs.paths.xsLocale = path.join(Dirs.paths.xsResD, C.LOCALED);
Dirs.paths.xsModsCommon = /^win32|darwin$/.test(process.platform)
  ? path.join(app.getPath('appData'), 'Sword')
  : path.join(app.getPath('home'), '.sword');

// Add getters for nsiLocalFiles.
const methods = Object.getOwnPropertyNames(GPublic.Dirs);
methods.forEach((method) => {
  if (typeof GPublic.Dirs[method] === 'function') {
    Object.defineProperty(Dirs, method, {
      get() {
        return new nsILocalFile(this.paths[method], nsILocalFile.NO_CREATE);
      },
    });
  }
});

// Make sure all directories exist, except methods in noCreate.
const noCreate = ['TmpD'];
methods.forEach((method) => {
  if (typeof GPublic.Dirs[method] === 'function') {
    if (!noCreate.includes(method)) {
      const f = Dirs[method];
      f.create(nsILocalFile.DIRECTORY_TYPE);
    }
  }
});

export default Dirs;
