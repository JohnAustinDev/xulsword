/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable prefer-rest-params */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import log from 'electron-log';
import path from 'path';
import i18next from 'i18next';
import { app, BrowserWindow } from 'electron';
import { randomID } from '../../common';
import Cache from '../../cache';
import C from '../../constant';
import Subscription from '../../subscription';
import type contextMenu from '../contextMenu';
import Dirs from './dirs';
import Data from './data';
import Prefs from './prefs';
import type { PrefCallbackType } from './prefs';
import LocalFile from './localFile';

import type {
  WindowArgType,
  ResetType,
  WindowDescriptorType,
  WindowRegistryType,
  ModalType,
  PrefValue,
  PrefObject,
} from '../../type';
import type { SubscriptionType } from '../../subscription';

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

// Since webPreferences.additionalArguments are string arguments with limited (and
// unspecified) maximum length, and since surpassing this limit causes segmentation
// faults, Data is used to pass arbitrary window arguments.
export function windowArguments(obj: { [k: string]: PrefValue }): string[] {
  const dataID = randomID();
  Data.write(obj, dataID);
  return [dataID];
}

// WindowRegistry value for a window will be null after window is closed.
export const WindowRegistry: WindowRegistryType = [];
function addWindowToRegistry(winid: number, descriptor: WindowDescriptorType) {
  let win = BrowserWindow.fromId(winid);
  if (win) {
    descriptor.id = winid;
    WindowRegistry[winid] = descriptor;
    win.once(
      'closed',
      ((id: number) => {
        return () => {
          WindowRegistry[id] = null;
        };
      })(winid)
    );
  }
  win = null;
}

// Return a list of BrowserWindow objects matching winargs. If winargs
// is a string other than 'all', then caller must be a BrowserWindow
// or else no windows will be returned. If winargs is a BrowserWindow,
// it will be returned. If winargs is undefined or null, then caller
// will be returned. Otherwise winargs is treated as a partial
// WindowDescriptorType and any windows which match all its property
// values will be returned. IMPORTANT: Returned BrowserWindow array
// may need to be set to [] after use, to prevent memory leaks after
// a window is closed.
export function getBrowserWindows(
  winargs?: WindowArgType | null,
  callerid?: number | null
): BrowserWindow[] {
  const cid = callerid ?? null;
  const caller = cid !== null ? BrowserWindow.fromId(cid) : null;
  let testwin: Partial<WindowDescriptorType> | null = null;
  if (winargs === 'parent') {
    if (caller) {
      const pw = caller.getParentWindow();
      return pw ? [pw] : [];
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
  } else if (winargs) {
    testwin = winargs;
  } else if (caller) {
    return [caller];
  }
  const windows: BrowserWindow[] = [];
  BrowserWindow.getAllWindows().forEach((w) => {
    const ew = WindowRegistry[w.id];
    if (
      ew &&
      testwin &&
      Object.entries(testwin).every((entry) => {
        const p = entry[0] as keyof WindowDescriptorType;
        const v = entry[1] as any;
        return v === undefined || ew[p] === v;
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
function windowBounds(winid: number) {
  const win = BrowserWindow.fromId(winid);
  if (win) {
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
  return null;
}

function persist(
  argname: string,
  value: PrefValue,
  merge: boolean,
  callingWinID: number
) {
  const pref = Prefs.getComplexValue(
    `OpenWindows.w${callingWinID}`,
    'windows'
  ) as WindowDescriptorType;
  const winargs = pref?.options?.additionalArguments || {};
  if (merge) {
    if (
      !['undefined', 'object'].includes(typeof value) ||
      Array.isArray(value)
    ) {
      throw Error(`Window: merge value is not a data object: ${value}`);
    }
    const v = value as PrefObject | undefined;
    const origval = winargs[argname];
    if (
      !['undefined', 'object'].includes(typeof origval) ||
      Array.isArray(origval)
    ) {
      throw Error(`Window: merge target is not a data object: ${origval}`);
    }
    const ov = origval as PrefObject | undefined;
    winargs[argname] = { ...ov, ...v };
  } else winargs[argname] = value;
  if (!('options' in pref) || !pref.options) pref.options = {};
  pref.options.additionalArguments = winargs;
  Prefs.setComplexValue(`OpenWindows.w${callingWinID}`, pref, 'windows');
}

function addWindowToPrefs(winid: number, descriptor: WindowDescriptorType) {
  // Remove any parent or there will be JSON recursion problems
  if (descriptor.options && 'parent' in descriptor.options)
    delete descriptor.options.parent;
  Prefs.setComplexValue(`OpenWindows.w${winid}`, descriptor, 'windows');
  function updateBounds() {
    const args = Prefs.getComplexValue(
      `OpenWindows.w${winid}`,
      'windows'
    ) as WindowDescriptorType;
    const b = windowBounds(winid);
    args.options = { ...args.options, ...b };
    Prefs.setComplexValue(`OpenWindows.w${winid}`, args, 'windows');
  }
  const win = BrowserWindow.fromId(winid);
  if (win) {
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
          if (C.UI.Window.persistentTypes.includes(descriptor.type || '')) {
            Prefs.setComplexValue(
              `PersistentTypes.${descriptor.type}`,
              Prefs.getComplexValue(`OpenWindows.w${id}`, 'windows'),
              'windows'
            );
          }
          Prefs.deleteUserPref(`OpenWindows.w${id}`, 'windows');
        };
      })(winid)
    );
  }
}

// All Windows are created with BrowserWindow.show = false so they
// will not be shown until the custom 'did-finish-render' event.
// This function modifies descriptor.options in place.
function updateOptions(
  descriptor: WindowDescriptorType,
  sizeToWinID: number
): void {
  let persistentTypesOptions: Electron.BrowserWindowConstructorOptions = {};
  if (
    C.UI.Window.persistentTypes.includes(descriptor.type || '') &&
    Prefs.has(
      `PersistentTypes.${descriptor.type}.options`,
      'complex',
      'windows'
    )
  ) {
    persistentTypesOptions = Prefs.getComplexValue(
      `PersistentTypes.${descriptor.type}.options`,
      'windows'
    ) as Electron.BrowserWindowConstructorOptions;
  }
  descriptor.options = {
    ...(persistentTypesOptions || {}),
    ...(descriptor.options || {}),
  };
  const { type, category } = descriptor;
  let { options } = descriptor;
  options = options || {};
  descriptor.category = category || 'window';
  // All windows must have these same options.
  options.show = false;
  options.useContentSize = true;
  options.icon = path.join(Dirs.path.xsAsset, 'icon.png');
  if (!options.webPreferences) options.webPreferences = {};
  options.webPreferences.preload = app.isPackaged
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, '../preload.js');
  options.webPreferences.contextIsolation = true;
  options.webPreferences.nodeIntegration = false;
  options.webPreferences.webSecurity = true;

  const winargs = options.additionalArguments || {};
  winargs.classes = [type, category];
  winargs.name = type;
  winargs.type = category;
  options.webPreferences.additionalArguments = windowArguments(winargs);

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
  if (sizeToWinID !== -1 && (type === 'viewportWin' || type === 'popupWin')) {
    const xs = windowBounds(sizeToWinID);
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

function createWindow(
  descriptor: WindowDescriptorType,
  sizeToWinID?: number
): number {
  updateOptions(descriptor, sizeToWinID ?? -1);
  const { type, options } = descriptor;
  log.silly('Window options:', options);
  const win = new BrowserWindow(options);
  // Remove any parent or there will be JSON recursion problems
  if (descriptor.options && 'parent' in descriptor.options)
    delete descriptor.options.parent;
  addWindowToRegistry(win.id, descriptor);
  if (C.DevToolsopen) win.webContents.openDevTools({ mode: 'detach' });
  win.loadURL(resolveHtmlPath(`${type}.html`));
  if (type !== 'xulsword') win.removeMenu();
  win.on('resize', () => {
    win.webContents.send('resize', win.getSize());
  });
  const disposables: (() => void)[] = [];
  win.once(
    'ready-to-show',
    ((w, d) => () => {
      Subscription.publish.windowCreated(
        ...([w, d] as Parameters<typeof contextMenu>)
      );
    })(win, disposables)
  );
  win.once('closed', () => {
    disposables.forEach((dispose) => dispose());
  });
  return win.id;
}

// Push user preference changes from the winid focused window, or from the main
// process (winid === -1) to other windows using update-state-from-pref. For some
// changes, more is done than simply updating state prefs, like changing locale
// or dynamic stylesheet.
export const pushPrefsToWindows: PrefCallbackType = (
  winid,
  key, // ie. global or xulsword.panels
  val,
  store
) => {
  let pushKeyProps: string[] = [];
  if (winid === -1 || winid === BrowserWindow.getFocusedWindow()?.id) {
    if (!store) {
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
      } else {
        // Get a (key.property)[] of changed keyprops requesting to be pushed.
        const keyprops: string[] =
          !key.includes('.') && val && typeof val === 'object'
            ? Object.keys(val).map((k) => {
                return [key, k].join('.');
              })
            : [key];

        // Collect a list of keyprops that are allowed to be pushed.
        // Note: menuPref is auto-generated during menu build as (key.property)[]
        const allowed: string[] = ['xulsword.keys'];
        if (Data.has('menuPref')) {
          allowed.push(...(Data.read('menuPref') as string[]));
        }
        Object.entries(C.SyncPrefs).forEach((entry) => {
          const [id, parray] = entry;
          parray.forEach((p) => {
            allowed.push([id, p].join('.'));
          });
        });

        // Get the list of keyprops that will be pushed.
        pushKeyProps = keyprops.filter((kp) => {
          const basekey = kp.split('.').slice(0, 2).join('.');
          return allowed.includes(basekey);
        });
      }
    } else if (store === 'bookmarks' && key.startsWith('manager.bookmarks')) {
      pushKeyProps = ['manager.bookmarks'];
    }
  }
  if (pushKeyProps.length) {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (winid === -1 || w.id !== winid) {
        w.webContents.send('update-state-from-pref', pushKeyProps, store);
      }
    });
  }
};

// Publish any subscription on the main process and/or any other window
// or group of windows.
export function publishSubscription<
  S extends keyof SubscriptionType['publish']
>(
  subscription: S,
  renderers: WindowArgType | WindowArgType[],
  main: boolean,
  ...args: Parameters<SubscriptionType['publish'][S]>
) {
  if (main) Subscription.doPublish(subscription, ...args);
  const done: number[] = [];
  (Array.isArray(renderers) ? renderers : [renderers]).forEach((r) => {
    getBrowserWindows(r).forEach((w) => {
      if (!done.includes(w.id)) {
        done.push(w.id);
        w.webContents.send('publish-subscription', subscription, ...args);
      }
    });
  });
}

const Window = {
  // Returns the WindowDescriptorType for the calling window.
  description() {
    let win: BrowserWindow | null = getBrowserWindows(null, arguments[0])[0];
    const ret = win ? WindowRegistry[win.id] || {} : {};
    win = null;
    return ret;
  },

  // Returns the WindowDescriptorTypes for the given window(s).
  descriptions(window?: WindowArgType) {
    const wins: WindowDescriptorType[] = [];
    getBrowserWindows(window, arguments[1]).forEach((win) => {
      wins.push(WindowRegistry[win.id] || {});
    });
    return wins;
  },

  // Returns the id of a newly created window.
  open(descriptor: WindowDescriptorType): number {
    const winid = createWindow(descriptor, arguments[1] ?? -1);
    if (descriptor.category === 'window') addWindowToPrefs(winid, descriptor);
    const o = descriptor.options;
    if (o && o.parent) o.parent = undefined;
    return winid;
  },

  // Returns the id of a singleton window. If a window matching the given descriptor
  // is currently open, the first such window will be moved to the front, otherwise a
  // new window will be created.
  openSingleton(descriptor: WindowDescriptorType): number {
    const matching = {
      ...descriptor,
      category: undefined, // matches regardless of value
      options: undefined, // matches regardless of value
    };
    const wins = getBrowserWindows(matching, arguments[1] ?? -1);
    const dofunc = (wins.length ? Window.moveToFront : Window.open) as any;
    const withwin = wins.length ? { id: wins[0].id } : descriptor;
    const ret = dofunc(withwin, arguments[1]) as number | number[];
    return Array.isArray(ret) ? ret[0] : ret;
  },

  // Set the caller window's window prefs, or if calling window is undefined,
  // sets the default window state prefs.
  setComplexValue(argname: string, value: { [i: string]: any }): void {
    persist(argname, value, false, arguments[2] ?? -1);
  },

  // Merge a key with the caller window's window prefs, or if calling window is
  // undefined, merge a key with the default window state prefs.
  mergeValue(argname: string, value: any) {
    persist(argname, value, true, arguments[2] ?? -1);
  },

  // Set the size of the given window(s) or else the calling window.
  setContentSize(w: number, h: number, window?: WindowArgType): number[] {
    const winids: number[] = [];
    getBrowserWindows(window, arguments[3]).forEach((win) => {
      win.setContentSize(Math.round(w), Math.round(h));
      winids.push(win.id);
    });
    return winids;
  },

  // Close the given window(s) or else the calling window. Returns the closed window(s)
  // id(s).
  close(window?: WindowArgType): number[] {
    const winids: number[] = [];
    getBrowserWindows(window, arguments[1]).forEach((win) => {
      winids.push(win.id);
      win.close();
    });
    return winids;
  },

  // Create new temp directory for window(s), or return the path(s) of existing tmp dirs(s).
  // These temp directories will be deleted when the associated window closes.
  tmpDir(window?: WindowArgType | null) {
    const ret: string[] = [];
    getBrowserWindows(window, arguments[1]).forEach((win) => {
      let w = win as any;
      if (w && 'xstmpDir' in w) {
        ret.push(w.xstmpDir);
      } else {
        const dir = Dirs.TmpD;
        dir.append(`xulsword_${win.id}`);
        dir.create(LocalFile.DIRECTORY_TYPE);
        if (dir.exists()) {
          ret.push(dir.path);
          w.xstmpDir = dir.path;
          win.once(
            'closed',
            ((d) => {
              return () => {
                const f = new LocalFile(d);
                if (f.exists()) f.remove(true);
              };
            })(dir.path)
          );
        }
      }
      w = null;
    });
    return ret;
  },

  // Disable all event handlers on a window to insure user input is bocked for
  // a time, such as when LibSword is offline. Returns id of modal windows.
  modal(
    modalx: ModalType | { modal: ModalType; window: WindowArgType }[]
  ): number[] {
    const winids: number[] = [];
    (Array.isArray(modalx) ? modalx : [{ modal: modalx, window: arguments[1] }])
      .reverse()
      .forEach((obj) => {
        const { modal, window } = obj;
        getBrowserWindows(window)
          .reverse()
          .forEach((win) => {
            if (!winids.includes(win.id)) {
              winids.push(win.id);
              win.webContents.send('modal', modal || '');
            }
          });
      });
    return winids;
  },

  reset(typex?: ResetType, windowx?: WindowArgType): number[] {
    // NOTE: Default params with reset(param='default') is not allowed
    // here or previously appended arguments[2] will not work!
    const type = typex || 'all';
    const window = windowx || 'self';
    let windows = getBrowserWindows(window, arguments[2]);
    const winids: Set<number> = new Set();
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
          if (!type || type === 'all' || type === r) {
            win.webContents.send(r);
            winids.add(win.id);
          }
        });
      }
    });
    windows = [];
    return Array.from(winids);
  },

  moveToFront(window?: WindowArgType): number[] {
    const front = getBrowserWindows(window, arguments[1]);
    const winids: number[] = [];
    BrowserWindow.getAllWindows().forEach((w) => {
      if (front.includes(w)) {
        w.moveTop();
        winids.push(w.id);
      }
    });
    return winids;
  },

  moveToBack(window?: WindowArgType): number[] {
    const back = getBrowserWindows(window, arguments[1]);
    const winids: number[] = [];
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!back.includes(w)) {
        w.moveTop();
        winids.push(w.id);
      }
    });
    return winids;
  },

  setTitle(title: string, window?: WindowArgType): number[] {
    const winids: number[] = [];
    getBrowserWindows(window, arguments[2]).forEach((w) => {
      w.setTitle(title);
      winids.push(w.id);
    });
    return winids;
  },
};

export default Window;
