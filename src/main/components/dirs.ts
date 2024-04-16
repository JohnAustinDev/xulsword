import { app } from 'electron'; // may be undefined
import path from 'path';
import LocalFile from './localFile.ts';

export type DirsDirectories = {
  [k in keyof typeof dirs]: string;
}

// The DirsClass interface is only available in main process directly through the Dirs object
type DirsMainType = typeof Dirs & {
  [key in keyof typeof dirs]: LocalFile;
};

export type DirsRendererType = typeof Dirs;

const dirs = {
  TmpD: '',
  xsAsset: '',
  xsAsar: '',
  xsPrefDefD: '',
  xsResDefD: '',
  ProfD: '',
  xsPrefD: '',
  xsResD: '',
  xsCache: '',
  xsModsUser: '',
  xsFonts: '',
  xsAudio: '',
  xsBookmarks: '',
  xsVideo: '',
  xsModsCommon: '',
};

const Dirs = {
  path: {} as DirsDirectories,

  init: () => {
    // NOTE: The app directory is not exposed in the production app. Also
    // don't try to read package.json in production by bundling it, as this
    // has security implications.

    dirs.xsAsset = app?.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '..', '..', '..', 'assets');

    // Packaged filename should be 'app.asar' if package.json has build.asar
    // set to true. Or it should be 'app' otherwise.
    dirs.xsAsar = app?.isPackaged
      ? path.join(process.resourcesPath, 'app.asar')
      : path.join(__dirname, '..', '..', '..', 'build', 'app');

    dirs.TmpD = app?.getPath('temp') || '/tmp';

    dirs.xsPrefDefD = path.join(dirs.xsAsset, 'defaults', 'preferences');

    dirs.xsResDefD = path.join(dirs.xsAsset, 'defaults', 'resources');

    dirs.ProfD = app?.getPath('userData') || process.env.XSProfD || '/tmp';

    dirs.xsPrefD = path.join(dirs.ProfD, 'preferences');

    dirs.xsResD = path.join(dirs.ProfD, 'resources');

    dirs.xsCache = path.join(dirs.ProfD, 'cache');

    dirs.xsModsUser = (app && path.join(dirs.ProfD, 'resources'))
      || process.env.XSModsUser || '/tmp';

    dirs.xsFonts = path.join(dirs.xsResD, 'fonts');

    dirs.xsAudio = path.join(dirs.xsResD, 'audio');

    dirs.xsBookmarks = path.join(dirs.xsResD, 'bookmarks');

    dirs.xsVideo = path.join(dirs.xsResD, 'video');

    if (app) {
      dirs.xsModsCommon = /^win32|darwin$/.test(process.platform)
        ? path.join(app.getPath('appData'), 'Sword')
        : path.join(app.getPath('home'), '.sword');
    } else {
      dirs.xsModsCommon = process.env.XSModsCommon || '/tmp';
    }

    // Install default resources?
    {
      const resd = (Dirs as DirsMainType).xsResD;
      if (!resd.exists()) resd.create(LocalFile.DIRECTORY_TYPE);
      const resdefd = (Dirs as DirsMainType).xsResDefD;
      if (resdefd.exists()) {
        resdefd.directoryEntries.forEach((sub) => {
          const to = resd.clone().append(sub);
          if (!to.exists()) {
            const from = resdefd.clone().append(sub);
            from.copyTo(to.parent, from.leafName, true);
          }
        });
      }
    }

    // Create user directories if they don't exist.
    [
      'ProfD',
      'xsPrefD',
      'xsResD',
      'xsCache',
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
  },
};

(Object.keys(dirs) as (keyof typeof dirs)[]).forEach((dir) => {
  // Add getters for LocalFiles.
  Object.defineProperty(Dirs, dir, {
    get() {
      if (!dirs[dir]) Dirs.init();
      if (!dirs[dir]) throw new Error(`Could not init Dirs.${dir}`);
      return new LocalFile(this.path[dir], LocalFile.NO_CREATE);
    },
  });

  // Add getters to initialize path.
  Object.defineProperty(Dirs.path, dir, {
    get() {
      if (!dirs[dir]) Dirs.init();
      if (!dirs[dir]) throw new Error(`Could not init Dirs.${dir}`);
      return dirs[dir];
    }
  });
});

export default Dirs as DirsMainType;
