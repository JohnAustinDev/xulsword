/* eslint-disable prefer-rest-params */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import fs from 'fs';
import { BrowserWindow, ipcMain } from 'electron';
import { JSON_parse, JSON_stringify } from '../common';
import Cache from '../cache';
import Data from './modules/data';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';

import type {
  WindowArgType,
  GType,
  ResetType,
  WindowDescriptorType,
  WindowRegistryType,
} from '../type';

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

export function resetMain() {
  Cache.clear();
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

function addWindowToPrefs(
  win: BrowserWindow,
  descriptor: WindowDescriptorType
) {
  // Remove any parent or there will JSON recursion problems
  if (descriptor.options && 'parent' in descriptor.options)
    delete descriptor.options.parent;
  Prefs.setComplexValue(`Windows.w${win.id}`, descriptor, 'windows');
  function updateBounds() {
    const args = Prefs.getComplexValue(`Windows.w${win.id}`, 'windows');
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
        Prefs.setComplexValue(`Windows.w${id}`, undefined, 'windows');
      };
    })(win.id)
  );
}

// All Windows are created with BrowserWindow.show = false so they
// will not be shown until the custom 'did-finish-render' event.
function updateOptions(descriptor: WindowDescriptorType): void {
  const { name, type } = descriptor;
  let { options } = descriptor;
  options = options || {};
  descriptor.type = type || 'window';
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
  args.classes = [name, type];
  args.name = name;
  args.type = type;
  options.webPreferences.additionalArguments[0] = JSON_stringify(args);
  // Dialog windows have these defaults (while regular windows just
  // have Electron defaults).
  if (type === 'dialog') {
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
  // within the main xulsword window.
  if (name === 'viewportWin' || name === 'popupWin') {
    const mainWindow = getBrowserWindows({ name: 'xulsword' })[0];
    if (mainWindow) {
      const xs = windowBounds(mainWindow);
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
  }
  // console.log(options);
}

function createWindow(descriptor: WindowDescriptorType): BrowserWindow {
  const { name, type, options } = descriptor;
  updateOptions(descriptor);
  const win = new BrowserWindow(options);
  addWindowToRegistry(win, descriptor);
  win.loadURL(resolveHtmlPath(`${name}.html`));
  // win.webContents.openDevTools();
  windowInitI18n(win);
  if (name === 'viewportWin' || name === 'popupWin' || type !== 'window')
    win.removeMenu();
  win.on('resize', () => {
    win.webContents.send('resize', win.getSize());
  });
  if (Data.has('contextMenuFunc')) {
    win.once(
      'closed',
      ((dlist: () => void) => {
        return () => {
          if (typeof dlist === 'function') dlist();
        };
      })(Data.read('contextMenuFunc')(win))
    );
  }
  return win;
}

const Window: GType['Window'] = {
  open(descriptor: WindowDescriptorType): number {
    const win = createWindow(descriptor);
    if (descriptor.type === 'window') addWindowToPrefs(win, descriptor);
    return win.id;
  },

  persist(argname: string, value: any) {
    const win = getBrowserWindows('self', arguments[2]);
    if (win.length && win[0]) {
      const pref = Prefs.getComplexValue(`Windows.w${win[0].id}`, 'windows');
      const args = pref.options.webPreferences.additionalArguments[0];
      if (args) {
        const arg = JSON_parse(args);
        if (typeof arg === 'object') {
          arg[argname] = value;
          pref.options.webPreferences.additionalArguments[0] =
            JSON_stringify(arg);
          Prefs.setComplexValue(`Windows.w${win[0].id}`, pref, 'windows');
        }
      }
    }
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

  // If ResetType is not specified then all resets will be called, otherwise only
  // the specified reset will be called. If window is specified, only matching
  // window(s) will be reset, otherwise all will be reset. If neither is specified
  // then all resets will be called on all windows plus the main process in addition.
  reset(type?: ResetType, window?: WindowArgType) {
    const windows = window
      ? getBrowserWindows(window, arguments[2])
      : getBrowserWindows('all');
    if (!type && !window) resetMain();
    windows.forEach((win) => {
      if (win) {
        const resets: ResetType[] = [
          'cache-reset',
          'module-reset',
          'component-reset',
          'dynamic-stylesheet-reset',
        ];
        resets.forEach((r) => {
          // 'component-reset' also does 'dynamic-stylesheet-reset'
          if (!type && r === 'dynamic-stylesheet-reset') return;
          if (!type || type === r) win.webContents.send(r);
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
