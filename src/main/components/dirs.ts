import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import LocalFile from './localFile.ts';

// Note: app will be undefined when running as a web app
const electronApp = app as typeof app | undefined;

const dirname = path.dirname(fileURLToPath(import.meta.url));

const dirs = {
  TmpD: '',
  LogDir: '',
  xsAsset: '',
  xsAsar: '',
  xsPrefDefD: '',
  xsResDefD: '',
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
      const profD =
        (Build.isElectronApp && electronApp?.getPath('userData')) ||
        (process.env.WEBAPP_FILES as string);

      Dirs.path.LogDir = path.join(process.env.LogDir || profD, 'logs');

      // NOTE: The app directory is not exposed in the production app. Also
      // don't try to read package.json in production by bundling it, as this
      // has security implications.
      Dirs.path.xsAsset = Build.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(dirname, '..', '..', '..', 'assets');

      // Packaged filename should be 'app.asar' if package.json has build.asar
      // set to true. Or it should be 'app' otherwise.
      Dirs.path.xsAsar = Build.isPackaged
        ? path.join(process.resourcesPath, 'app.asar')
        : path.join(dirname, '..', '..', '..', 'build', 'app');

      Dirs.path.TmpD = electronApp?.getPath('temp') || '/tmp';

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
        process.env.RESOURCEDIR || path.join(profD, 'resources');

      Dirs.path.xsCache = path.join(profD, 'cache');

      Dirs.path.xsModsUser =
        process.env.XSModsUser || path.join(profD, 'resources');

      Dirs.path.xsFonts =
        process.env.XSFonts || path.join(Dirs.path.xsResD, 'fonts');

      Dirs.path.xsAudio =
        process.env.XSAudio || path.join(Dirs.path.xsResD, 'audio');

      Dirs.path.xsBookmarks = path.join(Dirs.path.xsResD, 'bookmarks');

      Dirs.path.xsVideo = path.join(Dirs.path.xsResD, 'video');

      Dirs.path.xsModsCommon =
        process.env.XSModsCommon ||
        (electronApp
          ? /^win32|darwin$/.test(process.platform)
            ? path.join(electronApp.getPath('appData'), 'Sword')
            : path.join(electronApp.getPath('home'), '.sword')
          : '/tmp');

      Dirs.path.xsLib = electronApp
        ? electronApp.getPath('exe')
        : path.join(dirname, '..', '..', '..', 'Cpp', 'lib');

      if (!pathOnly) {
        // Create these directories if they don't exist.
        (
          [
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
          Dirs[d].create(LocalFile.DIRECTORY_TYPE, { recursive: true });
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
