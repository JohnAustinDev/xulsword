import { app } from 'electron'; // may be undefined
import path from 'path';
import LocalFile from './localFile.ts';

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
  xsLib: '',
};

export type DirsDirectories = typeof dirs;

export type DirsRendererType = { path: DirsDirectories };

export type DirsMainType = DirsRendererType & {
  init: (pathOnly?: boolean) => void;
  initialized: boolean;
} & {
  [key in keyof DirsDirectories]: LocalFile;
};

const Dirs = {
  // how to lazy load paths (required for server). Using getter??
  path: dirs,

  initialized: false,

  init: (pathOnly = false) => {
    if (!Dirs.initialized) {
      // NOTE: The app directory is not exposed in the production app. Also
      // don't try to read package.json in production by bundling it, as this
      // has security implications.
      Dirs.path.xsAsset = app?.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(__dirname, '..', '..', '..', 'assets');

      // Packaged filename should be 'app.asar' if package.json has build.asar
      // set to true. Or it should be 'app' otherwise.
      Dirs.path.xsAsar = app?.isPackaged
        ? path.join(process.resourcesPath, 'app.asar')
        : path.join(__dirname, '..', '..', '..', 'build', 'app');

      Dirs.path.TmpD = app?.getPath('temp') || '/tmp';

      Dirs.path.xsPrefDefD = path.join(
        Dirs.path.xsAsset,
        'defaults',
        'preferences',
      );

      Dirs.path.xsResDefD = path.join(
        Dirs.path.xsAsset,
        'defaults',
        'resources',
      );

      Dirs.path.ProfD =
        app?.getPath('userData') || process.env.XSProfD || '/tmp';
      if (!Dirs.path.ProfD.startsWith('/')) {
        throw new Error(
          'Profile direcory path must be absolute. Is XSProfD environment var a relative path?',
        );
      }

      Dirs.path.xsPrefD = path.join(Dirs.path.ProfD, 'preferences');

      Dirs.path.xsResD = path.join(Dirs.path.ProfD, 'resources');

      Dirs.path.xsCache = path.join(Dirs.path.ProfD, 'cache');

      Dirs.path.xsModsUser =
        (app && path.join(Dirs.path.ProfD, 'resources')) ||
        process.env.XSModsUser ||
        '/tmp';

      Dirs.path.xsFonts =
        process.env.XSFonts || path.join(Dirs.path.xsResD, 'fonts');

      Dirs.path.xsAudio = path.join(Dirs.path.xsResD, 'audio');

      Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, 'bookmarks');

      Dirs.path.xsVideo = path.join(Dirs.path.xsResD, 'video');

      Dirs.path.xsModsCommon = app
        ? /^win32|darwin$/.test(process.platform)
          ? path.join(app.getPath('appData'), 'Sword')
          : path.join(app.getPath('home'), '.sword')
        : process.env.XSModsCommon || '/tmp';

      Dirs.path.xsLib = app
        ? app.getPath('exe')
        : path.join(__dirname, '..', '..', '..', 'Cpp', 'lib');

      if (!pathOnly) {
        // Create these directories if they don't exist.
        (
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
          ] as const
        ).forEach((d) => {
          Dirs[d].create(LocalFile.DIRECTORY_TYPE);
        });
        (['xsModsUser', 'xsModsCommon', 'xsAudio'] as const).forEach((d) => {
          Dirs[d].clone().append('mods.d').create(LocalFile.DIRECTORY_TYPE);
          Dirs[d].clone().append('modules').create(LocalFile.DIRECTORY_TYPE);
        });

        // Install default resources?
        if (Dirs.xsResDefD.exists()) {
          Dirs.xsResDefD.directoryEntries.forEach((sub) => {
            const to = Dirs.xsResD.clone().append(sub);
            if (!to.exists()) {
              const from = Dirs.xsResDefD.clone().append(sub);
              from.copyTo(to.parent, from.leafName, true);
            }
          });
        }
      }
    }
    Dirs.initialized = true;
  },
} as DirsMainType;

(Object.keys(Dirs.path) as Array<keyof DirsDirectories>).forEach((d) => {
  // Add getters for LocalFiles.
  Object.defineProperty(Dirs, d, {
    get() {
      return new LocalFile(Dirs.path[d], LocalFile.NO_CREATE);
    },
  });
});

export default Dirs;
