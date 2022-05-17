/* eslint-disable prefer-rest-params */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import i18next from 'i18next';
import { BrowserWindow, ipcMain } from 'electron';
import { JSON_parse, JSON_stringify } from '../common';
import Cache from '../cache';
import C from '../constant';
import Subscription from '../subscription';
import Dirs from './components/dirs';
import Data from './components/data';
import Prefs from './components/prefs';

import type {
  WindowArgType,
  GType,
  ResetType,
  WindowDescriptorType,
  WindowRegistryType,
  ModalType,
} from '../type';
import type contextMenu from './contextMenu';
import type { PrefCallbackType } from './components/prefs';
import LocalFile from './components/localFile';

const i18nBackendRenderer = require('i18next-electron-fs-backend');

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

// WindowRegistry value for a window will be null after window is closed.
export const WindowRegistry: WindowRegistryType = [];
function addWindowToRegistry(
  win: BrowserWindow,
  descriptor: WindowDescriptorType
) {
  descriptor.id = win.id;
  WindowRegistry[win.id] = descriptor;
  win.once(
    'closed',
    ((id: number) => {
      return () => {
        WindowRegistry[id] = null;
      };
    })(win.id)
  );
}

// Return a list of BrowserWindow objects matching winargs. If winargs
// is a string other than 'all', then caller must be a BrowserWindow
// or else no windows will be returned. If winargs is a BrowserWindow,
// it will be returned. If winargs is undefined or null, then caller
// will be returned. Otherwise winargs is treated as a partial
// WindowDescriptorType and any windows which match all its property
// values will be returned.
export function getBrowserWindows(
  winargs?: WindowArgType | null,
  caller?: BrowserWindow | null
): BrowserWindow[] {
  let testwin: Partial<WindowDescriptorType> | null = null;
  if (winargs === 'parent') {
    if (caller) {
      return [caller.getParentWindow()];
    }
  } else if (winargs === 'self') {
    if (caller) {
      return [caller];
    }
  } else if (winargs === 'not-self') {
    if (caller) {
      const others: BrowserWindow[] = [];
      BrowserWindow.getAllWindows().forEach((w) => {
        if (w !== caller) others.push(w);
      });
      return others;
    }
  } else if (winargs === 'children') {
    if (caller) return caller.getChildWindows();
  } else if (winargs === 'all') {
    return BrowserWindow.getAllWindows();
  } else if (winargs && typeof winargs !== 'object') {
    throw Error(`getBrowserWindows unexpected argument: '${winargs}'`);
  } else if (winargs && 'loadURL' in winargs) {
    return [winargs];
  } else if (winargs) {
    testwin = winargs;
  } else if (caller) {
    return [caller];
  }
  const windows: BrowserWindow[] = [];
  BrowserWindow.getAllWindows().forEach((w) => {
    if (
      testwin &&
      Object.entries(testwin).every((entry) => {
        const p = entry[0] as keyof WindowDescriptorType;
        const v = entry[1] as any;
        const ew = WindowRegistry[w.id];
        return ew && ew[p] === v;
      })
    )
      windows.push(w);
  });
  return windows;
}

// Return a window content's width and height, and the
// window's x and y position on the screen. When creating
// new windows with useContentSize, these dimensions are
// intended to recreate the window's exact size and location
// on the screen. But there has been a long standing Electron
// bug report #10388 and yAdj is an attempted workaround.
function windowBounds(win: BrowserWindow) {
  const w = win.getNormalBounds();
  const c = win.getContentBounds();
  const yAdj = process.platform === 'linux' ? -38 : 0;
  return {
    width: c.width,
    height: c.height,
    x: w.x,
    y: w.y + yAdj,
    wLeft: c.x - w.x, // width of left window border
    hTop: c.y - w.y, // width of top window border
  };
}

function windowInitI18n(win: BrowserWindow) {
  // Bind i18next-electron-fs-backend providing IPC to renderer processes
  i18nBackendRenderer.mainBindings(ipcMain, win, fs);
  // Unbind i18next-electron-fs-backend from window upon close to prevent
  // access of closed window. Since the binding is anonymous, all are
  // removed, and other windows get new ones added back.
  win.once('close', () => {
    i18nBackendRenderer.clearMainBindings(ipcMain);
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== win) {
        i18nBackendRenderer.mainBindings(ipcMain, w, fs);
      }
    });
    if (win !== null) win.webContents.send('close');
  });
}

function persist(
  argname: string,
  value: any,
  merge: boolean,
  callingWin: BrowserWindow
) {
  const pref = Prefs.getComplexValue(
    `Windows.w${callingWin.id}`,
    'windows'
  ) as WindowDescriptorType;
  const args = pref?.options?.webPreferences?.additionalArguments;
  const [argstring] = args || [''];
  if (args && argstring) {
    const arg = JSON_parse(argstring);
    if (typeof arg === 'object') {
      if (merge) {
        if (
          !['undefined', 'object'].includes(typeof value) ||
          Array.isArray(value)
        )
          throw Error(`Window: merge value is not a data object: ${value}`);
        const origval = arg[argname];
        if (
          !['undefined', 'object'].includes(typeof origval) ||
          Array.isArray(origval)
        )
          throw Error(`Window: merge target is not a data object: ${origval}`);
        arg[argname] = { ...origval, ...value };
      } else arg[argname] = value;
      args[0] = JSON_stringify(arg);
      Prefs.setComplexValue(`Windows.w${callingWin.id}`, pref, 'windows');
    }
  }
}

function addWindowToPrefs(
  win: BrowserWindow,
  descriptor: WindowDescriptorType
) {
  // Remove any parent or there will JSON recursion problems
  if (descriptor.options && 'parent' in descriptor.options)
    delete descriptor.options.parent;
  Prefs.setComplexValue(`Windows.w${win.id}`, descriptor, 'windows');
  function updateBounds() {
    const args = Prefs.getComplexValue(
      `Windows.w${win.id}`,
      'windows'
    ) as WindowDescriptorType;
    const b = windowBounds(win);
    args.options = { ...args.options, ...b };
    Prefs.setComplexValue(`Windows.w${win.id}`, args, 'windows');
  }
  win.on('resize', () => {
    updateBounds();
  });
  win.on('move', () => {
    updateBounds();
  });
  win.once(
    'closed',
    ((id: number) => {
      return () => {
        Prefs.deleteUserPref(`Windows.w${id}`, 'windows');
      };
    })(win.id)
  );
}

// All Windows are created with BrowserWindow.show = false so they
// will not be shown until the custom 'did-finish-render' event.
function updateOptions(
  descriptor: WindowDescriptorType,
  parent: BrowserWindow
): void {
  const { type, category } = descriptor;
  let { options } = descriptor;
  options = options || {};
  descriptor.category = category || 'window';
  // All windows must have these same options.
  options.show = false;
  options.useContentSize = true;
  options.icon = path.join(Dirs.path.xsAsset, 'icon.png');
  if (!options.webPreferences) options.webPreferences = {};
  options.webPreferences.preload = path.join(__dirname, 'preload.js');
  options.webPreferences.contextIsolation = true;
  options.webPreferences.nodeIntegration = false;
  options.webPreferences.enableRemoteModule = false;
  options.webPreferences.webSecurity = true;
  if (!Array.isArray(options.webPreferences.additionalArguments))
    options.webPreferences.additionalArguments = ['{}'];
  if (typeof options.webPreferences.additionalArguments[0] !== 'string')
    throw Error(
      `Window additionalArguments must be a JSON_stringify { key: value } string.`
    );
  const args = JSON_parse(options.webPreferences.additionalArguments[0]);
  args.classes = [type, category];
  args.name = type;
  args.type = category;
  options.webPreferences.additionalArguments[0] = JSON_stringify(args);
  // Dialog windows have these defaults (while regular windows and dialog-
  // windows just have Electron defaults).
  if (category === 'dialog') {
    const ddef: Electron.BrowserWindowConstructorOptions = {
      width: 50, // dialogs are auto-resized and then fixed
      height: 50, // dialogs are auto-resized and then fixed
      resizable: false,
      fullscreenable: false,
      // skipTaskbar: true,
    };
    Object.entries(ddef).forEach((entry) => {
      const [pro, val] = entry;
      if (options && !(pro in options)) {
        const o = options as any;
        o[pro] = val;
      }
    });
  }
  // Set bounds for windows that should cover their source position
  // within the parent window.
  if (parent && (type === 'viewportWin' || type === 'popupWin')) {
    const xs = windowBounds(parent);
    const o = options as any;
    const eb = o?.openWithBounds;
    if (xs && eb) {
      options.width = eb.width;
      options.height = eb.height;
      options.x = xs.x + eb.x + xs.wLeft;
      options.y = xs.y + eb.y + xs.hTop;
    }
    if (o?.openWithBounds) delete o.openWithBounds;
  }
  log.silly('Window options:', options);
}

function createWindow(
  descriptor: WindowDescriptorType,
  parent: BrowserWindow
): BrowserWindow {
  const { type, options } = descriptor;
  updateOptions(descriptor, parent);
  const win = new BrowserWindow(options);
  addWindowToRegistry(win, descriptor);
  win
    .loadURL(resolveHtmlPath(`${type}.html`))
    .then(() => {
      if (
        C.DevToolsopen &&
        (process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true')
      ) {
        return setTimeout(() => win.webContents.openDevTools(), 1000);
      }
      return null;
    })
    .catch((err) => {
      log.error(err);
    });
  windowInitI18n(win);
  if (type !== 'xulsword') win.removeMenu();
  win.on('resize', () => {
    win.webContents.send('resize', win.getSize());
  });
  const disposables: (() => void)[] = [];
  const args: Parameters<typeof contextMenu> = [win, disposables];
  Subscription.publish('createWindow', ...args);
  win.once('closed', () => {
    disposables.forEach((dispose) => dispose());
  });
  return win;
}

const Window: GType['Window'] = {
  open(descriptor: WindowDescriptorType): number {
    const win = createWindow(descriptor, arguments[1]);
    if (descriptor.category === 'window') addWindowToPrefs(win, descriptor);
    return win.id;
  },

  setComplexValue(argname: string, value: any) {
    const win = arguments[2] || null;
    if (win && win[0]) persist(argname, value, false, win[0]);
  },

  mergeValue(argname: string, value: any) {
    const win = arguments[2] || null;
    if (win && win[0]) persist(argname, value, true, win[0]);
  },

  setContentSize(w: number, h: number, window?: WindowArgType): void {
    getBrowserWindows(window, arguments[3]).forEach((win) => {
      win.setContentSize(Math.round(w), Math.round(h));
    });
  },

  close(window?: WindowArgType): void {
    getBrowserWindows(window, arguments[1]).forEach((win) => {
      win.close();
    });
  },

  // Create a new temp directory for the window that gets deleted when
  // the window closes.
  tmpDir(window?: WindowArgType): string {
    const win = getBrowserWindows(window, arguments[1])[0];
    const w = win as any;
    if (w.xstmpDir) return w.xstmpDir;
    const dir = Dirs.TmpD;
    dir.append(`xulsword_${String(Math.round(10000 * Math.random()))}`);
    if (dir.exists()) dir.remove(true);
    dir.create(LocalFile.DIRECTORY_TYPE);
    if (!dir.exists()) return '';
    win.once(
      'closed',
      ((d) => {
        return () => {
          const f = new LocalFile(d);
          if (f.exists()) f.remove(true);
        };
      })(dir.path)
    );
    w.xstmpDir = dir.path;
    return dir.path;
  },

  // Disable all event handlers on a window to insure user input is bocked for
  // a time, such as when LibSword is offline.
  modal(modal?: ModalType, window?: WindowArgType) {
    getBrowserWindows(window, arguments[2]).forEach((win) => {
      win.webContents.send('modal', modal || '');
    });
  },

  // If ResetType is not specified then all resets will be called, otherwise only
  // the specified reset will be called. If window is specified, only matching
  // window(s) will be reset, otherwise all will be reset. If neither is specified
  // then all resets will be called on all windows plus the main process in addition.
  reset(type?: ResetType, window?: WindowArgType) {
    const windows = window
      ? getBrowserWindows(window, arguments[2])
      : getBrowserWindows('all');
    if (!type && !window) Subscription.publish('resetMain');
    windows.forEach((win) => {
      if (win) {
        const resets: ResetType[] = [
          'cache-reset',
          'component-reset',
          'dynamic-stylesheet-reset',
        ];
        resets.forEach((r) => {
          // 'component-reset' also does 'dynamic-stylesheet-reset'
          if ((!type || type === 'all') && r === 'dynamic-stylesheet-reset')
            return;
          if (!type || type === 'all' || type === r) win.webContents.send(r);
        });
      }
    });
  },

  moveToBack(window?: WindowArgType): void {
    const back = getBrowserWindows(window, arguments[1]);
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!back.includes(w)) w.moveTop();
    });
  },

  setTitle(title: string, window?: WindowArgType): void {
    getBrowserWindows(window, arguments[2]).forEach((win) => {
      win.setTitle(title);
    });
  },
};

export default Window;

// Push user preference changes from the focused window to other windows using
// update-state-from-pref. For some changes, more is done than simply updating
// state prefs. For instance when changing locale or dynamic stylesheet.
export const pushPrefsToWindows: PrefCallbackType = (win, key, val, store) => {
  if (
    (!store || store === 'prefs') &&
    (!win || win === BrowserWindow.getFocusedWindow())
  ) {
    const keysToUpdate: string[] = [];
    const keys: string[] =
      !key.includes('.') && typeof val === 'object'
        ? Object.keys(val).map((k) => {
            return `${key}.${k}`;
          })
        : [key];
    // C.GlobalState and menuPref are base-key lists (id.property)
    let menuPref: string[] = [];
    if (Data.has('menuPref')) {
      menuPref = Data.read('menuPref') as string[];
    }
    keys.forEach((pkey) => {
      const basekey = pkey.split('.').slice(0, 2).join('.');
      if (menuPref.includes(basekey)) keysToUpdate.push(pkey);
      else {
        C.GlobalXulsword.forEach((k) => {
          const gloskey = `xulsword.${k}`;
          if (basekey === gloskey) keysToUpdate.push(pkey);
        });
      }
    });
    if (key === 'global.locale') {
      const lng = Prefs.getCharPref('global.locale');
      i18next
        .loadLanguages(lng)
        .then(() => i18next.changeLanguage(lng))
        .then(() => {
          Cache.clear();
          Window.reset('all', 'all');
          return true;
        })
        .catch((err: any) => {
          if (err) throw Error(err);
        });
    } else if (key === 'global.fontSize') {
      Window.reset('dynamic-stylesheet-reset', 'all');
    } else if (keysToUpdate.length) {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!win || w !== win) {
          w.webContents.send('update-state-from-pref', keysToUpdate);
        }
      });
    }
  }
};
