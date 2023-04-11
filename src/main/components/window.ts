/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable prefer-rest-params */
/* eslint-disable import/no-mutable-exports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import log from 'electron-log';
import path from 'path';
import i18next from 'i18next';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  shell,
} from 'electron';
import { drop, keep, randomID } from '../../common';
import Cache from '../../cache';
import C from '../../constant';
import S from '../../defaultPrefs';
import Subscription from '../../subscription';
import Dirs from './dirs';
import Data from './data';
import Prefs from './prefs';
import LocalFile from './localFile';

import type {
  WindowArgType,
  ResetType,
  WindowDescriptorType,
  WindowRegistryType,
  ModalType,
  PrefValue,
  PrefObject,
  WindowDescriptorPrefType,
} from '../../type';
import type { SubscriptionType } from '../../subscription';
import type contextMenu from '../contextMenu';
import type { PrefCallbackType } from './prefs';

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
      (testwin.type === 'all' ||
        Object.entries(testwin).every((entry) => {
          const p = entry[0] as keyof WindowDescriptorType;
          const v = entry[1] as any;
          return v === undefined || ew[p] === v;
        }))
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
      windowFrameThicknessLeft: c.x - w.x,
      windowFrameThicknessTop: c.y - w.y,
    };
  }
  return null;
}

function descriptorToPref(
  descriptor: WindowDescriptorType
): WindowDescriptorPrefType {
  // Remove this intentional circular reference.
  if (descriptor.additionalArguments?.descriptor) {
    delete descriptor.additionalArguments.descriptor;
  }
  const strip: (keyof BrowserWindowConstructorOptions)[] = [
    'parent',
    'icon',
    'trafficLightPosition',
    'webPreferences',
    'titleBarOverlay',
  ];
  const { options: o } = descriptor;
  return {
    ...descriptor,
    options: (o && drop(o, strip)) || undefined,
  };
}

// Set window preferences for on open window, by adding them to, or modifying them
// in, the window's additionalArguments.
function setWindowPref(
  key: string,
  value: PrefValue,
  merge: boolean,
  windowID: number
) {
  const descriptor = WindowRegistry[windowID];
  if (descriptor) {
    const prefs = Prefs.getComplexValue(
      'OpenWindows',
      'windows'
    ) as typeof S.windows.OpenWindows;
    const pk = `w${windowID}`;
    if (!(pk in prefs)) prefs[pk] = descriptorToPref(descriptor);
    const additionalArguments = prefs[pk].additionalArguments || {};
    if (merge) {
      if (
        !['undefined', 'object'].includes(typeof value) ||
        Array.isArray(value)
      ) {
        throw Error(`Window: merge value is not a data object: ${value}`);
      }
      const v = value as PrefObject | undefined;
      const origval = additionalArguments[key];
      if (
        !['undefined', 'object'].includes(typeof origval) ||
        Array.isArray(origval)
      ) {
        throw Error(`Window: merge target is not a data object: ${origval}`);
      }
      const ov = origval as PrefObject | undefined;
      additionalArguments[key] = { ...ov, ...v };
    } else additionalArguments[key] = value;
    prefs[pk].additionalArguments = additionalArguments;
    Prefs.setComplexValue('OpenWindows', prefs, 'windows');
  }
}

// All Windows are created with BrowserWindow.show = false so they
// will not be shown until the custom 'did-finish-render' event.
// NOTE: This function modifies descriptor.options in place.
function updateOptions(descriptor: Omit<WindowDescriptorType, 'id'>): void {
  if (!descriptor.options) descriptor.options = {};

  // Overwrite descriptor and its options with any persisted values.
  let persistedDescriptor: WindowDescriptorType | undefined;
  if (
    descriptor.persist &&
    Prefs.has(`PersistForType.${descriptor.type}`, 'complex', 'windows')
  ) {
    persistedDescriptor = Prefs.getComplexValue(
      `PersistForType.${descriptor.type}`,
      'windows'
    ) as WindowDescriptorType;
  }
  if (persistedDescriptor) {
    Object.entries(persistedDescriptor).forEach((entry) => {
      const [key, val] = entry;
      if (key !== 'options') (descriptor as any)[key] = val;
    });
    let o: BrowserWindowConstructorOptions = {};
    if (persistedDescriptor.options) ({ options: o } = persistedDescriptor);
    descriptor.options = {
      ...descriptor.options,
      ...o,
    };
  }

  const { dataID, openWithBounds, notResizable, persist, options } = descriptor;

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

  options.resizable = !notResizable;

  // fitToContent windows are up-sized after their content has loaded.
  const cancelFitToContent = !notResizable && persist && persistedDescriptor;
  if (cancelFitToContent) descriptor.fitToContent = false;
  if (descriptor.fitToContent) {
    options.width = 50;
    options.height = 50;
  }

  // openWithBounds sets bounds for a new window relative to an existing window.
  // This is usually so the new window will open over its source element.
  if (openWithBounds) {
    const xs = windowBounds(openWithBounds.withinWindowID);
    if (xs) {
      options.width = openWithBounds.width;
      options.height = openWithBounds.height;
      options.x = xs.x + openWithBounds.x + xs.windowFrameThicknessLeft;
      options.y = xs.y + openWithBounds.y + xs.windowFrameThicknessTop;
    }
  }

  // Since webPreferences.additionalArguments are string arguments with limited
  // (and unspecified) maximum length, and since surpassing this limit causes
  // segmentation faults, Data is used to pass arbitrary window arguments and
  // the window descriptor to the renderer window.
  if (dataID) options.webPreferences.additionalArguments = [dataID];
}

// Push user preference changes from the winid focused window, or from the main
// process (winid === -1) to other windows using update-state-from-pref. For some
// changes, more is done than simply updating state prefs, like changing locale
// or dynamic stylesheet.
export const pushPrefsToWindows: PrefCallbackType = (
  winid,
  store,
  idOrKey, // ie. global or xulsword.panels
  val
) => {
  let pushKeyProps: string[] = [];
  if (winid < 0 || winid === BrowserWindow.getFocusedWindow()?.id) {
    if (store === 'prefs' && idOrKey === 'global.locale') {
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
    } else if (store === 'prefs' && idOrKey === 'global.fontSize') {
      Window.reset('dynamic-stylesheet-reset', 'all');
    } else {
      // Get a (key.property)[] of changed keyprops requesting to be pushed.
      const keyprops: string[] =
        !idOrKey.includes('.') && val && typeof val === 'object'
          ? Object.keys(val).map((k) => {
              return [idOrKey, k].join('.');
            })
          : [idOrKey];

      // Collect a list of keyprops that are allowed to be pushed.
      // Note: menuPref is auto-generated during menu build as (key.property)[]
      const allowed: string[] = [];
      if (store === 'prefs') {
        if (Data.has('menuPref')) {
          allowed.push(...(Data.read('menuPref') as string[]));
        }
      }
      if (store in S) {
        Object.entries((S as any)[store]).forEach((e) => {
          const [id, props] = e;
          Object.keys(props as PrefObject).forEach((prop: string) => {
            allowed.push([id, prop].join('.'));
          });
        });
      }

      // Get the list of keyprops that will be pushed.
      pushKeyProps = keyprops.filter((kp) => {
        const basekey = kp.split('.').slice(0, 2).join('.');
        return allowed.includes(basekey);
      });
    }
  }
  if (pushKeyProps.length) {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (winid < 0 || w.id !== winid) {
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
  options?: {
    renderers?: Partial<WindowDescriptorType> | Partial<WindowDescriptorType>[];
    main?: boolean;
  },
  ...args: Parameters<SubscriptionType['publish'][S]>
) {
  const { renderers, main } = {
    renderers: { type: 'all' } as Partial<WindowDescriptorType>,
    main: true,
    ...options,
  };
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

// Update window bounds after a delay. The delay is required since events
// such as maximize are emmitted before the window size has finished changing.
let UBTO: NodeJS.Timeout | null = null;
function updateBounds(winid: number) {
  if (UBTO) clearTimeout(UBTO);
  UBTO = setTimeout(() => {
    if (Prefs.has(`OpenWindows.w${winid}`, 'complex', 'windows')) {
      const desc = Prefs.getComplexValue(
        `OpenWindows.w${winid}`,
        'windows'
      ) as WindowDescriptorPrefType;
      const b = windowBounds(winid);
      if (b) {
        const { x, y, width, height } = b;
        desc.options = { ...desc.options, x, y, width, height };
        Prefs.setComplexValue(`OpenWindows.w${winid}`, desc, 'windows');
      }
      if (desc.persist && desc.options) {
        let { options: o } = desc;
        o = keep(o, ['width', 'height', 'x', 'y']);
        Prefs.setComplexValue(
          `PersistForType.${desc.type}`,
          { options: o },
          'windows'
        );
      }
    }
  }, 500);
}

export const WindowRegistry: WindowRegistryType = [];

const Window = {
  // Returns the WindowDescriptorPrefTypes for the given window(s).
  descriptions(window?: WindowArgType): WindowDescriptorPrefType[] {
    const wins: WindowDescriptorPrefType[] = [];
    getBrowserWindows(window, arguments[1]).forEach((win) => {
      const wdt = WindowRegistry[win.id];
      if (wdt) wins.push(descriptorToPref(wdt));
    });
    return wins;
  },

  // Returns the id of the window.
  open(descriptor: Omit<WindowDescriptorType, 'id' | 'dataID'>): number {
    // If window is a singleton, bring open window forward if it exists.
    if (!descriptor.allowMultiple) {
      const { type } = descriptor;
      const [awin] = getBrowserWindows({ type }, arguments[1] ?? -1);
      if (awin) {
        const { id } = awin;
        const [r] = Window.moveToFront({ id });
        return r;
      }
    }
    const d = descriptor as WindowDescriptorType;
    d.dataID = randomID();
    updateOptions(d);
    log.silly('Opening window with descriptor:', d);

    const win = new BrowserWindow(d.options);
    d.id = win.id; // descriptor is now complete
    Data.write(descriptorToPref(d), d.dataID);

    if (C.DevToolsopen) win.webContents.openDevTools({ mode: 'detach' });

    win.loadURL(resolveHtmlPath(`${d.type}.html`));

    if (d.type !== 'xulsword') win.removeMenu();

    win.setTitle(descriptor.options.title || '');

    // Add window to registry
    WindowRegistry[win.id] = d;

    // Add window to Prefs
    Prefs.setComplexValue(
      `OpenWindows.w${win.id}`,
      descriptorToPref(d),
      'windows'
    );

    // Window event handlers
    const { id } = win;
    const disposables: (() => void)[] = [];
    win.once('ready-to-show', () =>
      Subscription.publish.windowCreated(
        ...([win, disposables] as Parameters<typeof contextMenu>)
      )
    );
    const resize = () => {
      updateBounds(id);
      win?.webContents.send('resize', win.getSize());
    };
    win.on('resize', resize);
    win.on('resized', resize);
    win.on('move', () => updateBounds(id));
    win.on('moved', () => updateBounds(id));
    win.on('maximize', resize);
    win.on('unmaximize', resize);
    win.once('close', () => win?.webContents.send('close'));
    win.once('closed', () => {
      Prefs.deleteUserPref(`OpenWindows.w${id}`, 'windows');
      WindowRegistry[id] = null;
      disposables.forEach((dispose) => dispose());
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    return win.id;
  },

  // Set the caller window's window prefs, or if calling window is undefined,
  // sets the default window state prefs.
  setComplexValue(key: string, value: PrefObject): void {
    setWindowPref(key, value, false, arguments[2] ?? -1);
  },

  // Merge a key with the caller window's window prefs, or if calling window is
  // undefined, merge a key with the default window state prefs.
  mergeValue(key: string, value: any) {
    setWindowPref(key, value, true, arguments[2] ?? -1);
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
            if (r === 'cache-reset') {
              log.debug(
                `Clearing ${win.id} cache: Window.reset(${typex}, ${windowx})`
              );
            }
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
