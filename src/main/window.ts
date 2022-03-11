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
import { ElectronWindow, getBrowserWindows } from './mutil';

import type { WindowArgType, GType, ResetType } from '../type';

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

function xulswordWindow(): BrowserWindow | null {
  let win: BrowserWindow | null = null;
  const windows = Prefs.getComplexValue(`Windows`);
  Object.entries(windows).forEach((window) => {
    const [ids, args] = window as any;
    const id = Number(ids.substring(1));
    if (!Number.isNaN(id) && args?.type && args.type === 'xulsword') {
      win = BrowserWindow.fromId(id);
    }
  });
  return win;
}

function windowBounds(winx?: BrowserWindow) {
  const win = winx || xulswordWindow();
  if (!win) return null;
  const w = win.getNormalBounds();
  const c = win.getContentBounds();
  return {
    width: c.width,
    height: c.height,
    x: c.x,
    // The 12 works for Ubuntu 20 at least
    y: w.y - (w.height - c.height) - 12,
  };
}

// All Windows are created with BrowserWindow.show = false.
// This means that the window will be shown after the window's
// custom 'did-finish-render' event.
function windowOptions(
  name: string,
  type: string,
  options: Electron.BrowserWindowConstructorOptions
): void {
  // All windows must have these same options.
  options.show = false;
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
      width: 50, // dialogs are auto-resized
      height: 50, // dialogs are auto-resized
      resizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      useContentSize: true,
    };
    Object.entries(ddef).forEach((entry) => {
      const [pro, val] = entry;
      if (!(pro in options)) {
        const o = options as any;
        o[pro] = val;
      }
    });
  }
  // Set bounds for viewport and popup type windows
  if (name === 'viewportWin' || name === 'popupWin') {
    // useContentSize is supposed to use width & height to set the
    // webpage size rather than window size. If it did that, then
    // adj would not be necessary. But useContentSize does nothing
    // in Linux. Maybe it does on other opsys??
    // options.useContentSize = true;
    let adj = {
      h: 50,
      t: 35,
      w: 30,
    };
    if (name === 'popupWin') {
      adj = {
        h: 0,
        t: 26,
        w: 0,
      };
    }
    const ops = options as any;
    const xs = windowBounds();
    const eb = ops?.openWithBounds;
    if (xs && eb) {
      options.width = eb.width + adj.w;
      options.height = eb.height + adj.h;
      options.x = xs.x + eb.x - adj.w / 2;
      options.y = xs.y + eb.y - adj.h + adj.t;
    }
    if (ops?.openWithBounds) delete ops.openWithBounds;
  }
  // console.log(options);
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

type WindowPrivate = {
  browserWindow: BrowserWindow | null;
};

const Window: GType['Window'] & WindowPrivate = {
  browserWindow: null,

  open(
    name: string,
    options: Electron.BrowserWindowConstructorOptions
  ): number {
    windowOptions(name, 'window', options);
    const win = new BrowserWindow(options);
    ElectronWindow[win.id] = { id: win.id, name, type: 'window', options };
    win.loadURL(resolveHtmlPath(`${name}.html`));
    // win.webContents.openDevTools();
    Prefs.setComplexValue(`Windows.w${win.id}`, { type: name, options });
    windowInitI18n(win);
    if (name === 'viewportWin' || name === 'popupWin') win.removeMenu();
    win.on('resize', () => {
      const args = Prefs.getComplexValue(`Windows.w${win.id}`);
      const b = windowBounds(win);
      args.options = { ...args.options, ...b };
      Prefs.setComplexValue(`Windows.w${win.id}`, args);
      const size = win.getSize();
      win.webContents.send('resize', size);
    });
    win.on('move', () => {
      const args = Prefs.getComplexValue(`Windows.w${win.id}`);
      const b = windowBounds(win);
      args.options = { ...args.options, ...b };
      Prefs.setComplexValue(`Windows.w${win.id}`, args);
    });
    win.once(
      'closed',
      ((id: number) => {
        return () => {
          Prefs.setComplexValue(`Windows.w${id}`, undefined);
        };
      })(win.id)
    );
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
    return win.id;
  },

  // Dialog windows are not saved in user prefs and also get different
  // default options from windowOptions() than regular windows.
  openDialog(
    name: string,
    options: Electron.BrowserWindowConstructorOptions
  ): number {
    windowOptions(name, 'dialog', options);
    const win = new BrowserWindow(options);
    ElectronWindow[win.id] = { id: win.id, name, type: 'dialog', options };
    win.loadURL(resolveHtmlPath(`${name}.html`));
    win.removeMenu();
    win.on('resize', () => {
      const size = win.getSize();
      win.webContents.send('resize', size);
    });
    windowInitI18n(win);
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
    return win.id;
  },

  setContentSize(w: number, h: number, window?: WindowArgType): void {
    getBrowserWindows(window, this.browserWindow).forEach((win) => {
      win.setContentSize(Math.round(w), Math.round(h));
    });
  },

  close(window?: WindowArgType): void {
    getBrowserWindows(window, this.browserWindow).forEach((win) => {
      win.close();
    });
  },

  // If ResetType is not specified then all resets will be called, otherwise only
  // the specified reset will be called. If window is specified, only matching
  // window(s) will be reset, otherwise all will be reset. If neither is specified
  // then all resets will be called on all windows plus the main process in addition.
  reset(type?: ResetType, window?: WindowArgType) {
    const windows = window
      ? getBrowserWindows(window, this.browserWindow)
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
    const back = getBrowserWindows(window, this.browserWindow);
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!back.includes(w)) w.moveTop();
    });
  },

  setTitle(title: string, window?: WindowArgType): void {
    getBrowserWindows(window, this.browserWindow).forEach((win) => {
      win.setTitle(title);
    });
  },
};

export default Window;
