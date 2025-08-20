import { app, Menu, shell, MenuItem } from 'electron';
import log from 'electron-log';
import path from 'path';
import {
  bookmarkItemIconPath,
  clone,
  localizeBookmark,
  xulswordLocation,
} from '../../common.ts';
import C from '../../constant.ts';
import { verseKeyCommon } from '../verseKey.ts';
import { G } from './G.ts';
import ComCommands from './commands.ts';
import Window, { getBrowserWindows } from './components/window.ts';
import Commands from './components/commands.ts';

import type S from '../../defaultPrefs.ts';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import type { BookmarkFolderType, SearchType, TabTypes } from '../../type.ts';
import type { PrefCallbackType } from '../../prefs.ts';

type Modifiers =
  | 'CommandOrControl' // 'accel' in XUL
  | 'Alt'
  | 'Option'
  | 'AltGr'
  | 'Shift'
  | 'Super'
  | 'Meta';

type DarwinMenuItemConstructorOptions = {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
} & MenuItemConstructorOptions;

// Debug mode menu clicks allow menu to close, avoiding debugger lockup.
function d(func: () => void): any {
  if (Build.isDevelopment) {
    const dfunc = () => {
      setTimeout(func, 100);
    };
    return dfunc;
  }
  return func;
}

// Update Prefs
function toggleSwitch(name: string | string[], value?: boolean) {
  const a = Array.isArray(name) ? name : [name];
  a.forEach((n) => {
    const v = value === undefined ? !G.Prefs.getBoolPref(n) : value;
    G.Prefs.setBoolPref(n, v);
  });
}

// Update Prefs
function radioSwitch(name: string | string[], value: any) {
  const a = Array.isArray(name) ? name : [name];
  a.forEach((n) => {
    if (typeof value === 'number') {
      G.Prefs.setIntPref(n, value);
    } else if (typeof value === 'string') {
      G.Prefs.setCharPref(n, value);
    } else {
      throw Error('radioSwitch supports number or string.');
    }
  });
}

const showtabs: Array<[string, TabTypes]> = [
  ['showtexttabs', 'Texts'],
  ['showcommtabs', 'Comms'],
  ['showbooktabs', 'Genbks'],
  ['showdicttabs', 'Dicts'],
];

function panelLabels() {
  const labels: string[] = [];
  const panels = G.Prefs.getComplexValue(
    'xulsword.panels',
  ) as typeof S.prefs.xulsword.panels;
  panels.forEach((_panel: string | null, i: number) => {
    labels.push(`menu.view.window${i + 1}`);
  });
  labels.push('menu.view.allwindows');
  return labels;
}

function updateModuleMenus(menux?: Menu) {
  const menu = menux || Menu.getApplicationMenu();
  if (menu) {
    const ps = G.Prefs.getComplexValue(
      'xulsword.panels',
    ) as typeof S.prefs.xulsword.panels;
    const rgtabs = clone(G.Tabs).reverse();
    showtabs.forEach((showtab) => {
      const [typekey, type] = showtab;
      let disableParent = true;
      panelLabels().forEach((pl) => {
        const panelIndex =
          pl === 'menu.view.allwindows'
            ? -1
            : Number(pl.substring(pl.length - 1)) - 1;
        const tabmenu = menu.getMenuItemById(`menu_${typekey}_${pl}`);
        const submenu = tabmenu?.submenu;
        if (!submenu) throw Error(`No tabmenu: menu_${typekey}_${pl}`);
        const { items } = submenu;
        // Menu items cannot be removed!! They can only be added or disabled.
        items.forEach((item) => {
          if (item.id !== `showAll_${typekey}_${pl}`) item.enabled = false;
        });
        rgtabs.forEach((t) => {
          if (t.tabType === type) {
            disableParent = false;
            const item = items.find(
              (i) => i.id === `showtab_${panelIndex}_${t.module}`,
            );
            if (item) item.enabled = true;
            else {
              const { description } = t;
              const newItem = new MenuItem({
                id: `showtab_${panelIndex}_${t.module}`,
                label:
                  t.label + (description ? ` --- ${description.locale}` : ''),
                type: 'checkbox',
                // icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
                click: d(() => {
                  G.Viewport.setXulswordTabs({
                    panelIndex,
                    whichTab: t.module,
                    doWhat: 'toggle',
                  });
                }),
              });
              submenu.insert(0, newItem);
            }
          }
        });
        if (panelIndex !== -1) {
          const winMenuIds = showtabs.map((tk) => `menu_${tk[0]}_${pl}`);
          winMenuIds.push(`menu_showAll_${pl}`);
          winMenuIds.push(`menu_hideAll_${pl}`);
          winMenuIds.forEach((id) => {
            const item = menu.getMenuItemById(id);
            if (item) item.enabled = ps[panelIndex] !== null;
          });
        }
        //submenu.items = items;
      });
      const parent = menu.getMenuItemById(`parent_${typekey}`);
      if (parent) parent.enabled = !disableParent;
    });
  }
}

// While updating the menu, a set of controlling Pref keys is collected.
// This set of keys will be monitored such that when one of them is changed,
// the menu will again be updated.
function updateCheckboxAndRadiosFromPref(menux?: Menu | null) {
  const panels = G.Prefs.getComplexValue(
    'xulsword.panels',
  ) as typeof S.prefs.xulsword.panels;
  const menuPref = new Set<string>();
  function add(pref: string) {
    menuPref.add(pref.split('.').slice(0, 2).join('.'));
  }
  function recurseMenu(menu: Electron.Menu) {
    if (!menu.items) return;
    menu.items.forEach((i) => {
      if (i.id && i.type === 'checkbox') {
        const [type, pi, mod] = i.id.split('_');
        if (type === 'showtab') {
          const panelIndex = Number(pi);
          add('xulsword.tabs');
          const pval = G.Prefs.getComplexValue(
            'xulsword.tabs',
          ) as typeof S.prefs.xulsword.tabs;
          if (panelIndex === -1) {
            i.checked = pval.every((p: any) => !p || p.includes(mod));
          } else {
            i.checked = Boolean(pval[panelIndex]?.includes(mod));
          }
        } else {
          add(i.id);
          i.checked = G.Prefs.getBoolPref(i.id);
        }
      } else if (i.id && i.type === 'radio') {
        const [pref, str] = i.id.split('_val_');
        if (pref === 'xulsword.panels') {
          add(pref);
          const numPanels = panels.filter(
            (m: string | null) => m || m === '',
          ).length;
          if (numPanels === Number(str)) i.checked = true;
        } else if (str !== '') {
          let val: string | number = str;
          if (Number(str).toString() === str) val = Number(str);
          add(pref);
          const pval =
            typeof val === 'number'
              ? G.Prefs.getIntPref(pref)
              : G.Prefs.getCharPref(pref);
          if (pval === val) i.checked = true;
        }
      }
      if (i.submenu) recurseMenu(i.submenu);
    });
  }
  const menu = menux || Menu.getApplicationMenu();
  if (menu) recurseMenu(menu);
  // To make menuPref available to pref callbacks without dependency cycles.
  G.Data.write(Array.from(menuPref), 'menuPref');
}

// This callback updates the menu when applicable prefs change. If the
// calling window is -1 (main process) the menu will normally NOT be updated
// as it will be assumed the main process initiated the change and will also
// update the menu, and ignoring it prevents cycling.
export const pushPrefsToMenu: PrefCallbackType = (winid, store, key, val) => {
  let menuPref: string[] = [];
  if (G.Data.has('menuPref')) {
    menuPref = G.Data.read('menuPref') as string[];
  }
  if (winid !== -1) {
    if (store === 'prefs') {
      const keys: string[] = [];
      if (!key.includes('.') && typeof val === 'object') {
        Object.keys(val as never).forEach((k) => keys.push(`${key}.${k}`));
      } else keys.push(key);
      if (keys.some((k) => menuPref.includes(k))) {
        updateCheckboxAndRadiosFromPref();
      }
    }
    if (store === 'bookmarks') {
      let [xs]: Array<BrowserWindow | undefined> = getBrowserWindows({
        type: 'xulswordWin',
      });
      if (xs) {
        const menuBuilder = new MainMenuBuilder(xs);
        menuBuilder.buildMenu(true);
        xs = undefined;
      }
    }
  }
};

function bookmarkProgramMenu(
  bookmarks: BookmarkFolderType,
): MenuItemConstructorOptions[] {
  return bookmarks.childNodes
    .map((bm) => localizeBookmark(G, verseKeyCommon, bm))
    .map((bm) => ({
      label: bm.label,
      type: bm.type === 'folder' ? 'submenu' : 'normal',
      submenu: bm.type === 'folder' ? bookmarkProgramMenu(bm) : undefined,
      icon: bookmarkItemIconPath(G, bm),
      id: bm.id,
      click: d(() => {
        if ('location' in bm) {
          if (bm.location) {
            if ('v11n' in bm.location) {
              // Don't change panels, just the location, by removing vkMod.
              if (bm.tabType === 'Texts') delete bm.location.vkMod;
              ComCommands.goToLocationVK(bm.location, bm.location);
            } else ComCommands.goToLocationGB(bm.location);
          }
        }
      }),
    }));
}

function addShortcutKeys(submenu?: MenuItemConstructorOptions[]): void {
  if (submenu) {
    const sc = /(?!<&)&([^&])/;

    const numbers: string[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      n.toString(),
    );

    // Collect every letter of every label in this submenu and sort them.
    const uc = new Set<string>();
    const lc = new Set<string>();
    submenu.forEach((item) => {
      const { label } = item;
      if (label) {
        for (let x = 0; x <= label.length; x += 1) {
          const l = label.substring(x, x + 1);
          if (l.trim()) {
            if (l.toUpperCase() === l) uc.add(l);
            else lc.add(l);
          }
        }
      }
    });
    const ucLetters: string[] = Array.from(uc).sort();
    const lcLetters: string[] = Array.from(lc).sort();

    // Collect already present shortcuts in this submenu
    const used: string[] = [];
    submenu.forEach((item) => {
      const m = item.label?.match(sc);
      if (m) {
        used.push(m[1]);
      }
    });
    const doAdd = (letters: string[]): void => {
      submenu.forEach((item) => {
        const m = item.label?.match(sc);
        if (item.label && !m) {
          const words = item.label.split(' ');
          for (let x = 0; x < words.length && !item.label.match(sc); x += 1) {
            const available = letters.filter((l) => !used.includes(l));
            let i = -1;
            available.forEach((l) => {
              const i2 = words[x].indexOf(l);
              if (i2 > -1 && (i === -1 || i2 < i)) i = i2;
            });
            if (i !== -1) {
              const l = words[x].substring(i, i + 1);
              used.push(l);
              words[x] = words[x].replace(l, `&${l}`);
              item.label = words.join(' ');
            }
          }
        }
      });
    };
    doAdd(numbers.concat(ucLetters));
    doAdd(lcLetters);
    submenu.forEach((item) => {
      addShortcutKeys(item.submenu as MenuItemConstructorOptions[] | undefined);
    });
  }
}

// Read locale key, appending & before shortcut key and escaping other &s.
// IMPORTANT: shortcut keys are automatically added by addShortcutKeys(), so
// i18n shortcut keys only need to be provided where automation is unacceptable.
function ts(key: string, sckey?: string): string {
  // Only 3 keys exist for panels:
  let fix;
  [/(?<=menu\.windows\.)(\d)(?=win)/, /(?<=menu\.view\.window)(\d)/].forEach(
    (re) => {
      if (re.test(key)) {
        const m = key.match(re);
        if (m?.[1] && Number(m[1]) > 3) {
          fix = G.i18n.t(key.replace(m[1], '3'));
          fix = fix.replace('3', m[1]);
        }
      }
    },
  );
  if (fix) return fix;

  let text = G.i18n.t(key);
  const sckey2 = sckey || `${key}.sc`;
  if (text) {
    text = text.replace(/(?!<&)&(?!=&)/g, '&&');
    if (G.i18n.exists(sckey2)) {
      const l = G.i18n.t(sckey2);
      const re = new RegExp(`(${l})`, 'i');
      text = text.replace(re, '&$1');
    }
  }
  return text;
}

// Read locale key returning undefined if it doesn't exist.
// Also prepend with key modifiers if needed.
function tx(key: string, modifiers?: Modifiers[]): string | undefined {
  const text = G.i18n.t(key);
  if (!text) return undefined;
  if (modifiers?.length) {
    return `${modifiers.join('+')}+${text}`;
  }
  return text;
}

export default class MainMenuBuilder {
  window: BrowserWindow;

  menuPref: string[];

  constructor(window: BrowserWindow) {
    this.window = window;
    this.menuPref = [];
  }

  buildMenu(update?: boolean): Menu {
    const template: MenuItemConstructorOptions[] =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();
    addShortcutKeys(template);
    const menu = Menu.buildFromTemplate(template);
    updateModuleMenus(menu);
    updateCheckboxAndRadiosFromPref(menu);
    if (update) {
      const appMenu = Menu.getApplicationMenu();
      if (appMenu) {
        while (appMenu.items.length) appMenu.items.shift();
        while (menu.items.length) {
          const item = menu.items.pop();
          if (item) appMenu.insert(0, item);
        }
      }
    } else Menu.setApplicationMenu(menu);
    return menu;
  }

  buildDefaultTemplate() {
    const haveBookmarks =
      (
        G.Prefs.getComplexValue(
          'rootfolder',
          'bookmarks',
        ) as typeof S.bookmarks.rootfolder
      ).childNodes.length > 0;
    const panels = G.Prefs.getComplexValue(
      'xulsword.panels',
    ) as typeof S.prefs.xulsword.panels;

    const subMenuFile: MenuItemConstructorOptions = {
      role: 'fileMenu',
      label: ts('menu.file'),
      submenu: [
        {
          label: ts('menu.addNewModule'),
          submenu: [
            {
              label: ts('menu.newModule.fromInternet'),
              accelerator: C.UI.AcceleratorKey.openModuleManager,
              click: d(() => {
                Commands.openModuleManager();
              }),
            },
            {
              label: ts('menu.newModule.fromFile'),
              click: d(() => {
                Commands.installXulswordModules().catch((er) => {
                  log.error(er);
                });
              }),
            },
          ],
        },
        {
          label: ts('menu.removeModule'),
          click: d(() => {
            Commands.removeModule();
          }),
        },
        { type: 'separator' },
        {
          label: ts('menu.importAudio'),
          click: d(() => {
            Commands.importAudio().catch((er) => {
              log.error(er);
            });
          }),
        },
        {
          label: ts('menu.exportAudio'),
          enabled: !!G.Dirs.xsAudio.append('modules').directoryEntries.length,
          click: d(() => {
            Commands.exportAudio().catch((er) => {
              log.error(er);
            });
          }),
        },
        { type: 'separator' },
        {
          label: `${ts('menu.import').replace(/[.…]+$/, '')} ${G.i18n.t(
            'menu.bookmarks',
          )}`,
          click: d(() => {
            Commands.importBookmarks().catch((er) => {
              log.error(er);
            });
          }),
        },
        {
          label: `${ts('menu.export').replace(/[.…]+$/, '')} ${G.i18n.t(
            'menu.bookmarks',
          )}`,
          enabled: haveBookmarks,
          click: d(() => {
            Commands.exportBookmarks().catch((er) => {
              log.error(er);
            });
          }),
        },
        { type: 'separator' },
        {
          label: ts('menu.printPassage'),
          accelerator: tx('menu.print.ac', ['CommandOrControl']),
          click: d(() => {
            let location = xulswordLocation(G.Tab, G.Prefs, 'Texts');
            if (!location) {
              location =
                (G.Prefs.getComplexValue(
                  'xulsword.location',
                ) as typeof S.prefs.xulsword.location) || undefined;
            }
            if (location) {
              let vkMod = G.Tabs.find((t) => t.tabType === 'Texts')?.module;
              if ('vkMod' in location && location.vkMod) ({ vkMod } = location);
              if (location && vkMod) {
                Commands.printPassage({ chapters: { ...location, vkMod } });
              }
            }
          }),
        },
        {
          label: ts('menu.print'),
          accelerator: tx('menu.print.ac', ['CommandOrControl', 'Shift']),
          click: d(() => {
            Commands.print({ pageable: false, dialogEnd: 'cancel' }).catch(
              (er) => {
                log.error(er);
              },
            );
          }),
        },
        { type: 'separator' },
        {
          role: 'quit',
          label: ts('menu.quit'),
          click: d(() => {
            Window.close({ type: 'xulswordWin' });
          }),
        },
      ],
    };

    const edits = ['undo', 'redo', 'cut', 'copy', 'paste'];
    const subMenuEdit: MenuItemConstructorOptions = {
      role: 'editMenu',
      label: ts('menu.edit'),
      submenu: edits
        .map((edx) => {
          const ed = edx as 'undo' | 'redo' | 'cut' | 'copy' | 'paste';
          const item: MenuItemConstructorOptions = {
            label: ts(`menu.edit.${ed}`),
            accelerator: tx(`menu.edit.${ed}.ac`, ['CommandOrControl']),
            enabled: !(
              (ed === 'undo' && !G.canUndo()) ||
              (ed === 'redo' && !G.canRedo())
            ),
            click: d(() => {
              if (!Commands.edit(ed)) this.window.webContents[ed]();
            }),
          };
          return item;
        })
        .concat([
          { type: 'separator' } as any,
          {
            label: ts('menu.search'),
            accelerator: tx('menu.search.ac', ['CommandOrControl']),
            click: d(() => {
              const search: SearchType = {
                module: (G.Tabs.length && G.Tabs[0].module) || '',
                searchtext: '',
                type: 'SearchAnyWord',
              };
              Commands.search(search);
            }),
          },
          {
            label: ts('menu.copyPassage'),
            accelerator: tx('menu.copyPassage.ac', ['CommandOrControl']),
            click: d(() => {
              Commands.copyPassage();
            }),
          },
        ]),
    };

    const switches = [
      'headings',
      'dictlinks',
      'footnotes',
      'crossrefs',
      'usernotes',
      'strongs',
      'morph',
      'versenums',
      'redwords',
    ];
    const radios = ['footnotes', 'crossrefs', 'usernotes'];

    const allswitches = switches.map((x: any) => {
      return `xulsword.show.${x}`;
    });

    const textSwitches: MenuItemConstructorOptions[] = [];
    switches.forEach((key) => {
      if (key !== 'morph') {
        textSwitches.push({
          label: ts(`menu.view.${key}`),
          id: `xulsword.show.${key}`,
          type: 'checkbox',
          icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${key}.png`),
          click: d(() => {
            const keys = [`xulsword.show.${key}`];
            if (key === 'strongs') {
              keys.push(`xulsword.show.morph`); // switch these two together
            }
            toggleSwitch(keys);
          }),
        });
        if (radios.includes(key)) {
          textSwitches.push({
            label: ts(`menu.view.place.${key}`),
            submenu: [
              {
                label: ts('menu.view.popups'),
                id: `xulsword.place.${key}_val_popup`,
                type: 'radio',
                click: d(() => {
                  radioSwitch(`xulsword.place.${key}`, 'popup');
                }),
              },
              {
                label: ts('menu.view.notebox'),
                id: `xulsword.place.${key}_val_notebox`,
                type: 'radio',
                click: d(() => {
                  radioSwitch(`xulsword.place.${key}`, 'notebox');
                }),
              },
            ],
          });
        }
      }
    });

    const textTabs: MenuItemConstructorOptions[] = showtabs.map((t) => {
      const [typekey, type] = t;
      return {
        id: `parent_${typekey}`,
        label: ts(`menu.view.${typekey}`),
        icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${type}.png`),
        submenu: [
          ...panelLabels().map((pl: string) => {
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: ts(pl),
              id: `menu_${typekey}_${pl}`,
              enabled: panelIndex === -1 || Boolean(panels[panelIndex]),
              submenu: [
                {
                  id: `showAll_${typekey}_${pl}`,
                  label: ts('menu.view.showAll'),
                  click: d(() => {
                    G.Viewport.setXulswordTabs(
                      {
                        panelIndex,
                        whichTab: type,
                        doWhat: 'show',
                      },
                      null,
                      () => updateCheckboxAndRadiosFromPref(),
                    );
                  }),
                },
                {
                  id: `hideAll_${typekey}_${pl}`,
                  label: ts('menu.view.hideAll'),
                  click: d(() => {
                    G.Viewport.setXulswordTabs(
                      {
                        panelIndex,
                        whichTab: type,
                        doWhat: 'hide',
                      },
                      null,
                      () => updateCheckboxAndRadiosFromPref(),
                    );
                  }),
                },
              ],
            };
          }),
        ],
      };
    });

    const subMenuView: MenuItemConstructorOptions = {
      role: 'viewMenu',
      label: ts('menu.view'),
      submenu: [
        {
          label: G.i18n.t('Toggle Full Screen'),
          visible: false,
          accelerator: C.UI.AcceleratorKey.toggleFullScreen,
          click: d(() => {
            this.window.setFullScreen(!this.window.isFullScreen());
          }),
        },
        ...textSwitches,
        {
          label: ts('menu.view.showAll'),
          click: d(() => {
            toggleSwitch(allswitches, true);
          }),
        },
        {
          label: ts('menu.view.hideAll'),
          click: d(() => {
            toggleSwitch(allswitches, false);
          }),
        },
        { type: 'separator' },
        ...textTabs,
        {
          label: ts('menu.view.showAll'),
          submenu: panelLabels().map((pl: string) => {
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: ts(pl),
              id: `menu_showAll_${pl}`,
              enabled: panelIndex === -1 || Boolean(panels[panelIndex]),
              click: d(() => {
                G.Viewport.setXulswordTabs(
                  {
                    panelIndex,
                    whichTab: 'all',
                    doWhat: 'show',
                  },
                  null,
                  () => updateCheckboxAndRadiosFromPref(),
                );
              }),
            };
          }),
        },
        {
          label: ts('menu.view.hideAll'),
          submenu: panelLabels().map((pl: string) => {
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: ts(pl),
              id: `menu_hideAll_${pl}`,
              enabled: panelIndex === -1 || Boolean(panels[panelIndex]),
              click: d(() => {
                G.Viewport.setXulswordTabs(
                  {
                    panelIndex,
                    whichTab: 'all',
                    doWhat: 'hide',
                  },
                  null,
                  () => updateCheckboxAndRadiosFromPref(),
                );
              }),
            };
          }),
        },
      ],
    };

    const subMenuOptions: MenuItemConstructorOptions = {
      label: ts('menu.options'),
      submenu: [
        {
          label: ts('menu.options.font'),
          submenu: [
            {
              label: ts('menu.options.font1'),
              id: `global.fontSize_val_0`,
              type: 'radio',
              click: d(() => {
                radioSwitch(
                  'global.fontSize',
                  0 satisfies typeof S.prefs.global.fontSize,
                );
              }),
            },
            {
              label: ts('menu.options.font2'),
              id: `global.fontSize_val_1`,
              type: 'radio',
              click: d(() => {
                radioSwitch(
                  'global.fontSize',
                  1 satisfies typeof S.prefs.global.fontSize,
                );
              }),
            },
            {
              label: ts('menu.options.font3'),
              id: `global.fontSize_val_2`,
              type: 'radio',
              click: d(() => {
                radioSwitch(
                  'global.fontSize',
                  2 satisfies typeof S.prefs.global.fontSize,
                );
              }),
            },
            {
              label: ts('menu.options.font4'),
              id: `global.fontSize_val_3`,
              type: 'radio',
              click: d(() => {
                radioSwitch(
                  'global.fontSize',
                  3 satisfies typeof S.prefs.global.fontSize,
                );
              }),
            },
            {
              label: ts('menu.options.font5'),
              id: `global.fontSize_val_4`,
              type: 'radio',
              click: d(() => {
                radioSwitch(
                  'global.fontSize',
                  4 satisfies typeof S.prefs.global.fontSize,
                );
              }),
            },
            { type: 'separator' },
            {
              label: ts('fontsAndColors.label'),
              click: d(() => {
                const ps = G.Prefs.getComplexValue(
                  'xulsword.panels',
                ) as typeof S.prefs.xulsword.panels;
                const module = ps.find((m) => m) || G.Tabs[0]?.module || '';
                Commands.openFontsColors(module);
              }),
            },
          ],
        },
        {
          label: ts('menu.options.hebrew'),
          submenu: [
            {
              label: ts('menu.options.hebVowel'),
              id: 'xulsword.show.hebvowelpoints',
              type: 'checkbox',
              click: d(() => {
                toggleSwitch('xulsword.show.hebvowelpoints');
              }),
            },
            {
              label: ts('menu.options.hebCant'),
              id: 'xulsword.show.hebcantillation',
              type: 'checkbox',
              click: d(() => {
                toggleSwitch('xulsword.show.hebcantillation');
              }),
            },
          ],
        },
        {
          label: ts('menu.options.language'),
          // sublabel: ts('menu.language.tooltip'),
          submenu: C.Locales.map((l: any) => {
            const [lng, name] = l;
            return {
              label: name,
              id: `global.locale_val_${lng}`,
              type: 'radio',
              toolTip: lng,
              click: d(() => {
                radioSwitch('global.locale', lng);
              }),
            };
          }),
        },
      ],
    };

    const subMenuBookmarks: MenuItemConstructorOptions = {
      label: ts('menu.bookmarks'),
      submenu: [
        {
          label: ts('menu.bookmark.manager'),
          accelerator: tx('menu.bookmark.manager.ac', ['CommandOrControl']),
          enabled: haveBookmarks,
          click: d(() => {
            Commands.openBookmarksManager();
          }),
        },
        { type: 'separator' },
        {
          label: ts('menu.bookmark.add'),
          accelerator: tx('menu.bmitem.add.ac', ['CommandOrControl']),
          click: d(() => {
            Commands.openBookmarkProperties(
              G.i18n.t('menu.bookmark.add'),
              {},
              {
                location: xulswordLocation(G.Tab, G.Prefs),
              },
            );
          }),
        },
        {
          label: ts('menu.usernote.add'),
          accelerator: tx('menu.bmitem.add.ac', ['CommandOrControl', 'Shift']),
          click: d(() => {
            Commands.openBookmarkProperties(
              G.i18n.t('menu.usernote.add'),
              {},
              {
                location: xulswordLocation(G.Tab, G.Prefs),
              },
            );
          }),
        },
        {
          label: ts('menu.folder.add'),
          accelerator: tx('menu.bmitem.add.ac', ['Alt', 'Shift']),
          click: d(() => {
            Commands.openBookmarkProperties(
              G.i18n.t('menu.folder.add'),
              {},
              {
                location: undefined,
              },
            );
          }),
        },
      ],
    };

    const bookmarks = G.Prefs.getComplexValue(
      'rootfolder',
      'bookmarks',
    ) as typeof S.bookmarks.rootfolder;

    if (bookmarks && bookmarks.childNodes.length) {
      const submenu = subMenuBookmarks.submenu as MenuItemConstructorOptions[];
      submenu.push({ type: 'separator' });
      submenu.push(...bookmarkProgramMenu(bookmarks));
    }

    const subMenuWindows: MenuItemConstructorOptions = {
      role: 'windowMenu',
      label: ts('menu.windows'),
      submenu: panels.map((_p: string | null, i: number) => {
        const n = i + 1;
        return {
          label: ts(`menu.windows.${n}win`),
          id: `xulsword.panels_val_${n}`,
          type: 'radio',
          click: d(() => {
            const ps = G.Prefs.getComplexValue(
              'xulsword.panels',
            ) as typeof S.prefs.xulsword.panels;
            const newpans = ps.map((panel: string | null, x: number) => {
              return x > i ? null : panel || '';
            });
            G.Prefs.setComplexValue('xulsword.panels', newpans);
            updateModuleMenus();
          }),
        };
      }),
    };

    const subMenuHelp: MenuItemConstructorOptions = {
      role: 'about',
      label: ts('menu.help'),
      submenu: [
        {
          label: ts('menu.help.about'),
          click: d(() => {
            Commands.openAbout();
          }),
        },
      ],
    };

    const subMenuDev: MenuItemConstructorOptions = {
      role: 'help',
      label: 'Devel',
      submenu: [
        {
          role: 'reload',
          label: '&Reload',
          accelerator: 'Ctrl+R',
          click: d(() => {
            // because role is 'reload', this handler isn't called
            // (in Linux at least)
            this.window.webContents.reload();
          }),
        },
        {
          role: 'toggleDevTools',
          label: 'Toggle &Developer Tools',
          accelerator: 'Alt+Ctrl+I',
          click: d(() => {
            const { webContents: contents } = this.window;
            contents.toggleDevTools();
          }),
        },
      ],
    };

    const applicationMenuTemplate = [
      subMenuFile,
      subMenuEdit,
      subMenuView,
      subMenuOptions,
      subMenuBookmarks,
      subMenuWindows,
      subMenuHelp,
    ];

    if (Build.isDevelopment) {
      applicationMenuTemplate.push(subMenuDev);
    }

    return applicationMenuTemplate;
  }

  buildDarwinTemplate(): DarwinMenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Electron',
      submenu: [
        {
          label: 'About ElectronReact',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide ElectronReact',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.window.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.window.setFullScreen(!this.window.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            const { webContents: contents } = this.window;
            contents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: DarwinMenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.window.setFullScreen(!this.window.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: DarwinMenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://electronjs.org').catch((er) => {
              log.error(er);
            });
          },
        },
        {
          label: 'Documentation',
          click() {
            shell
              .openExternal(
                'https://github.com/electron/electron/tree/servers/app/docs#readme',
              )
              .catch((er) => {
                log.error(er);
              });
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell
              .openExternal('https://www.electronjs.org/community')
              .catch((er) => {
                log.error(er);
              });
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell
              .openExternal('https://github.com/electron/electron/issues')
              .catch((er) => {
                log.error(er);
              });
          },
        },
      ],
    };

    const subMenuView = Build.isDevelopment ? subMenuViewDev : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }
}
