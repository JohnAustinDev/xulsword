import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import LocalFile from './localFile.ts';

const dirs = {
  TmpD: '',
  xsLib: '',
  xsAsset: '',
  xsAsar: '',
  xsPrefDefD: '',
  xsResDefD: '',
  LogDir: '',
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
      Dirs.path.TmpD = app?.getPath('temp') || '/tmp';

      // This local dirname path must only be read when NOT packaged!
      const dirname = !Build.isPackaged
        ? path.dirname(fileURLToPath(import.meta.url))
        : Dirs.path.TmpD;

      const profD =
        (Build.isElectronApp && app?.getPath('userData')) ||
        (Build.isWebApp && (process.env.WEBAPP_PROFILE_DIR as string)) ||
        Dirs.path.TmpD;

      Dirs.path.LogDir = path.join(process.env.LOG_DIR || profD, 'xulsword');

      // NOTE: The app directory is not exposed in the production app. Also
      // don't try to read package.json in production by bundling it, as this
      // has security implications.
      Dirs.path.xsAsset = Build.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(dirname, '..', '..', '..', 'assets');

      // Packaged filename should be 'app.asar' if package.json has build.asar
      // set to true. Or it should be 'app' otherwise.
      Dirs.path.xsAsar = Build.isPackaged
        ? path.join(process.resourcesPath, 'app')
        : path.join(dirname, '..', '..', '..', 'build', 'app');

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

      Dirs.path.xsPrefD = path.join(profD, 'preferences');

      Dirs.path.xsResD =
        (Build.isWebApp && process.env.WEBAPP_RESOURCE_DIR) ||
        path.join(profD, 'resources');

      Dirs.path.xsCache = path.join(profD, 'cache');

      Dirs.path.xsModsUser =
        (Build.isWebApp && process.env.XSModsUser_DIR) || Dirs.path.xsResD;

      Dirs.path.xsFonts =
        (Build.isWebApp && process.env.XSFonts_DIR) ||
        path.join(Dirs.path.xsResD, 'fonts');

      Dirs.path.xsAudio =
        (Build.isWebApp && process.env.XSAudio_DIR) ||
        path.join(Dirs.path.xsResD, 'audio');

      Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, 'bookmarks');

      Dirs.path.xsVideo = path.join(Dirs.path.xsResD, 'video');

      Dirs.path.xsModsCommon =
        (Build.isWebApp && process.env.XSModsCommon_DIR) ||
        (app
          ? /^win32|darwin$/.test(process.platform)
            ? path.join(app.getPath('appData'), 'Sword')
            : path.join(app.getPath('home'), '.sword')
          : '');

      Dirs.path.xsLib = app
        ? app.getPath('exe')
        : path.join(dirname, '..', '..', '..', 'Cpp', 'lib');

      if (!pathOnly) {
        // Install default resources?
        if (Dirs.xsResDefD.exists()) {
          if (!Dirs.xsResD.exists()) {
            Dirs.xsResD.create(LocalFile.DIRECTORY_TYPE, { recursive: true });
          }
          Dirs.xsResDefD.directoryEntries.forEach((sub) => {
            const to = Dirs.xsResD.clone().append(sub);
            if (!to.exists()) {
              const from = Dirs.xsResDefD.clone().append(sub);
              from.copyTo(to.parent, from.leafName, true);
            }
          });
        }

        // Create these directories if they don't exist.
        (
          [
            'LogDir',
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
          if (d !== 'xsModsCommon' || Dirs.path.xsModsCommon) {
            Dirs[d].create(LocalFile.DIRECTORY_TYPE, { recursive: true });
          }
        });
        (['xsModsUser', 'xsModsCommon', 'xsAudio'] as const).forEach((d) => {
          if (d !== 'xsModsCommon' || Dirs.path.xsModsCommon) {
            Dirs[d].clone().append('mods.d').create(LocalFile.DIRECTORY_TYPE);
            Dirs[d].clone().append('modules').create(LocalFile.DIRECTORY_TYPE);
          }
        });
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
