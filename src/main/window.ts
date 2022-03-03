/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import fs from 'fs';
import { BrowserWindow, ipcMain } from 'electron';
import { JSON_parse, JSON_stringify } from '../common';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';

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

// All Windows are created with BrowserWindow.show = false.
// This means that the window will be shown after either:
// - (if params.show === true) Electron's 'ready-to-show' event.
// - (if params.show === false) The window's custom 'did-finish-render' event.
// IMPORTANT: If params.show is false, the 'did-finish-render' event must
// be explicitly called from the window or it will never be shown.
function windowOptions(name: string, type: string, options: any) {
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
  args.classes =
    'classes' in args && Array.isArray(args.classes)
      ? args.classes.concat([name, type])
      : [name, type];
  options.webPreferences.additionalArguments[0] = JSON_stringify(args);
  // Dialog windows have these defaults (while regular windows just
  // have Electron defaults).
  if (type === 'dialog') {
    Object.entries({
      enablePreferredSizeMode: true,
      resizable: false,
      fullscreenable: false,
      skipTaskbar: true,
    }).forEach((entry) => {
      const [pro, val] = entry;
      if (!(pro in options)) {
        options[pro] = val;
      }
    });
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

// Dialog windows are not saved in user prefs and also get different
// default options from windowOptions() than regular windows.
export function openDialog(
  name: string,
  options: Electron.BrowserWindowConstructorOptions
): number {
  const { show } = options;
  windowOptions(name, 'dialog', options);
  const win = new BrowserWindow(options);
  win.loadURL(resolveHtmlPath(`${name}.html`));
  win.removeMenu();
  if (show) {
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });
  }
  win.on('resize', () => {
    const size = win.getSize();
    win.webContents.send('resize', size);
  });
  windowInitI18n(win);
  return win.id;
}

export function openWindow(
  name: string,
  options: Electron.BrowserWindowConstructorOptions
): number {
  const { show } = options;
  windowOptions(name, 'window', options);
  // Set bounds for viewport and popup type windows
  if (name === 'viewportWin' || name === 'popupWin') {
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
  const win = new BrowserWindow(options);
  win.loadURL(resolveHtmlPath(`${name}.html`));
  // win.webContents.openDevTools();
  Prefs.setComplexValue(`Windows.w${win.id}`, { type: name, options });
  windowInitI18n(win);
  if (name === 'viewportWin' || name === 'popupWin') win.removeMenu();
  if (show) {
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });
  }
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
  return win.id;
}
