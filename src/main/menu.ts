/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  MenuItem,
} from 'electron';
import path from 'path';
import C from '../constant';
import { JSON_parse, JSON_stringify } from '../common';
import Commands from './commands';
import G from './mg';

import type { TabTypes } from '../type';

type Modifiers =
  | 'CommandOrControl'
  | 'Alt'
  | 'Option'
  | 'AltGr'
  | 'Shift'
  | 'Super'
  | 'Meta';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  // Update Prefs, then setGlobalStateFromPref()
  static toggleSwitch(name: string | string[], value?: boolean) {
    const a = Array.isArray(name) ? name : [name];
    a.forEach((n) => {
      const v = value === undefined ? !G.Prefs.getBoolPref(n) : value;
      G.Prefs.setBoolPref(n, v);
    });
    G.setGlobalStateFromPref(null, name);
  }

  // Update Prefs, then setGlobalStateFromPref()
  static radioSwitch(name: string | string[], value: any) {
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
    G.setGlobalStateFromPref(null, name);
  }

  static setTabs(
    type: TabTypes | 'all',
    panelLabel: string | 'all',
    modOrAll: string,
    doWhat: 'show' | 'hide' | 'toggle'
  ) {
    const panels = G.Prefs.getComplexValue('xulsword.panels');
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const pix = Number(panelLabel.substring(panelLabel.length - 1));
    const panelIndexes = Number.isNaN(pix)
      ? panels.map((_p: any, i: number) => i)
      : [pix - 1];

    const modules =
      modOrAll === 'all'
        ? G.Tabs.map((t) => {
            return type === 'all' || type === t.tabType ? t : null;
          })
        : [G.Tab[modOrAll]];

    const pval = G.Prefs.getComplexValue('xulsword.tabs') as (
      | string[]
      | null
    )[];
    const nval = JSON_parse(JSON_stringify(pval)) as (string[] | null)[];

    // If toggling on allwindows, set them according to the clicked
    // menuitem, and not each item separately.
    let doWhat2 = doWhat;
    if (doWhat === 'toggle' && panelLabel === 'menu.view.allwindows') {
      const m = modules[0];
      const dwh =
        m !== null &&
        pval.every((t: any) => t === undefined || t?.includes(m.module));
      doWhat2 = dwh ? 'hide' : 'show';
    }
    panelIndexes.forEach((pi: number) => {
      modules.forEach((m) => {
        if (m) {
          const tabbank = pval[pi];
          const ntabbank = nval[pi];
          const show =
            doWhat2 === 'toggle'
              ? !tabbank || !tabbank.includes(m.module)
              : doWhat2 === 'show';
          if (show && (!tabbank || !tabbank.includes(m.module))) {
            if (ntabbank) ntabbank.push(m.module);
            // if creating a tab bank, create tab banks before it as well
            else
              panels.forEach((_p: any, i: number) => {
                if (!nval[i]) nval[i] = i === pi ? [m.module] : [];
              });
          } else if (
            !show &&
            ntabbank &&
            tabbank &&
            tabbank.includes(m.module)
          ) {
            ntabbank.splice(ntabbank.indexOf(m.module), 1);
          }
        }
      });
    });

    nval.forEach((tabs, i: number) => {
      if (tabs) {
        const tmp = tabs.filter(Boolean);
        nval[i] = tmp.sort(MenuBuilder.tabOrder);
      }
    });

    // If user is setting tabs for a panel that is not open, then open it.
    if (panelIndexes.length === 1 && panels[panelIndexes[0]] === null)
      panels[panelIndexes[0]] = '';

    // Insure a panel's module vars point to modules within the panel's tab bank,
    // and rather than leave a panel's display module as empty string, we can
    // choose a new module, and choose a book too if none is already selected.
    const mtm = G.Prefs.getComplexValue('xulsword.mtModules');
    const nmtm = mtm.map((m: string | null, i: number) => {
      const nvali = nval[i];
      return m && nvali && nvali.includes(m) ? m : undefined;
    });
    G.Prefs.setComplexValue('xulsword.mtModules', nmtm);
    const used: any = {};
    panels.forEach((m: string | null, i: number) => {
      const nvali = nval[i];
      if (m !== null && nvali && nvali.length && !nvali.includes(m)) {
        panels[i] = '';
        let it = 0;
        let nextmod = nvali[it];
        while (nextmod in used && it + 1 < nvali.length) {
          it += 1;
          nextmod = nvali[it];
        }
        panels[i] = nextmod;
        used[nextmod] = true;
        let bk = G.Prefs.getCharPref('xulsword.book');
        if (!bk && nextmod && G.Tab[nextmod].isVerseKey) {
          [bk] = G.AvailableBooks[nextmod];
          if (bk) {
            G.Prefs.setCharPref('xulsword.book', bk);
          }
        }
      }
    });

    G.Prefs.setComplexValue('xulsword.panels', panels);
    G.Prefs.setComplexValue('xulsword.tabs', nval);

    // Update global states corresponding to prefs which could have been changed.
    G.setGlobalStateFromPref(null, [
      'xulsword.tabs',
      'xulsword.panels',
      'xulsword.mtModules',
      'xulsword.book',
    ]);
  }

  // Sort tabs to particular order
  static tabOrder(as: string, bs: string) {
    const a = G.Tab[as];
    const b = G.Tab[bs];
    if (a.tabType === b.tabType) {
      // Priority: 1) Modules matching current locale, 2) Other tabs that have
      // locales installed, 3) remaining tabs.
      const aLocale = G.ModuleConfigs[a.module]?.AssociatedLocale;
      const bLocale = G.ModuleConfigs[b.module]?.AssociatedLocale;
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      const aPriority =
        aLocale && aLocale !== C.NOTFOUND ? (aLocale === lng ? 1 : 2) : 3;
      const bPriority =
        bLocale && bLocale !== C.NOTFOUND ? (bLocale === lng ? 1 : 2) : 3;
      if (aPriority !== bPriority) return aPriority > bPriority ? 1 : -1;
      // Type and Priority are same. Sort by label's alpha.
      return a.label > b.label ? 1 : -1;
    }
    const mto = C.ModuleTypeOrder as any;
    return mto[a.tabType] > mto[b.tabType] ? 1 : -1;
  }

  mainWindow: BrowserWindow;

  i18n: any;

  constructor(mainWindow: BrowserWindow, i18n: any) {
    this.mainWindow = mainWindow;
    this.i18n = i18n;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template: any =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    MenuBuilder.updateTabMenus(menu);
    G.setGlobalMenuFromPref(menu);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  static showtabs: [string, TabTypes][] = [
    ['showtexttabs', 'Texts'],
    ['showcommtabs', 'Comms'],
    ['showbooktabs', 'Genbks'],
    ['showdicttabs', 'Dicts'],
  ];

  static panelLabels = (() => {
    const panelLabels: string[] = [];
    G.Prefs.getComplexValue('xulsword.panels').forEach(
      (_panel: string | null, i: number) => {
        panelLabels.push(`menu.view.window${i + 1}`);
      }
    );
    panelLabels.push('menu.view.allwindows');
    return panelLabels;
  })();

  static updateTabMenus(menu: Menu) {
    MenuBuilder.showtabs.forEach((showtab) => {
      const [tab, type] = showtab;
      let disableParent = true;
      MenuBuilder.panelLabels.forEach((pl) => {
        const panelIndex = Number(pl.substring(pl.length - 1));
        const tabmenu = menu.getMenuItemById(`menu_${tab}_${pl}`);
        const submenu = tabmenu?.submenu;
        if (!submenu) throw Error(`No tabmenu: menu_${tab}_${pl}`);
        const { items } = submenu;
        while (items[0].id !== `showAll_${tab}_${pl}`) items.shift();
        G.Tabs.reverse().forEach((t) => {
          if (t.tabType === type) {
            disableParent = false;
            const newItem = new MenuItem({
              id: `showtab_${panelIndex}_${t.module}`,
              label: t.label + (t.description ? ` --- ${t.description}` : ''),
              type: 'checkbox',
              // icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
              click: () => {
                MenuBuilder.setTabs(type, pl, t.module, 'toggle');
              },
            });
            submenu.insert(0, newItem);
          }
        });
      });
      const parent = menu.getMenuItemById(`parent_${tab}`);
      if (parent) parent.enabled = !disableParent;
    });
  }

  // Read locale key, appending & before shortcut key and escaping other &s.
  ts(key: string, sckey?: string): string {
    // CLUDGE:
    let fix;
    [/(?<=menu\.windows\.)(\d)(?=win)/, /(?<=menu\.view\.window)(\d)/].forEach(
      (re) => {
        if (re.test(key)) {
          const m = key.match(re);
          if (m && m[1] && Number(m[1]) > 3) {
            fix = this.i18n.t(key.replace(m[1], '3'));
            fix = fix.replace('3', m[1]);
          }
        }
      }
    );
    if (fix) return fix;

    let text = this.i18n.t(key);
    const sckey2 = sckey || `${key}.sc`;
    if (text) {
      text = text.replace(/(?!<&)&(?!=&)/g, '&&');
      const l = this.i18n.t(sckey2);
      if (l) {
        const re = new RegExp(`(${l})`, 'i');
        text = text.replace(re, '&$1');
      }
    }
    return text;
  }

  // Read locale key returning undefined if it doesn't exist.
  // Also prepend with key modifiers if needed.
  tx(key: string, modifiers?: Modifiers[]): string | undefined {
    const text = this.i18n.t(key);
    if (!text) return undefined;
    if (modifiers && modifiers.length) {
      return `${modifiers.join('+')}+${text}`;
    }
    return text;
  }

  buildDefaultTemplate() {
    const subMenuFile = {
      role: 'fileMenu',
      label: this.ts('fileMenu.label', 'fileMenu.accesskey'),
      submenu: [
        {
          label: this.ts('menu.addNewModule.label'),
          submenu: [
            {
              label: this.ts(
                'newmodule.fromInternet',
                'newmodule.fromInternet.ak'
              ),
              accelerator: 'F2',
              click: () => {
                Commands.addRepositoryModule();
              },
            },
            {
              label: this.ts('newmodule.fromFile', 'newmodule.fromFile.ak'),
              click: () => {
                Commands.addLocalModule();
              },
            },
          ],
        },
        {
          label: this.ts('menu.removeModule.label', 'menu.removeModule.sc'),
          visible: G.LibSword.hasBible(),
          click: () => {
            Commands.removeModule();
          },
        },
        { type: 'separator' },
        {
          label: this.ts('menu.exportAudio.label', 'menu.exportAudio.sc'),
          click: () => {
            Commands.exportAudio();
          },
        },
        {
          label: this.ts('menu.importAudio.label', 'menu.importAudio.sc'),
          click: () => {
            Commands.importAudio();
          },
        },
        { type: 'separator' },
        {
          label: this.ts('printSetupCmd.label', 'printSetupCmd.accesskey'),
          click: () => {
            Commands.pageSetup();
          },
        },
        {
          label: this.ts('printPreviewCmd.label', 'printPreviewCmd.accesskey'),
          accelerator: this.tx('printCmd.commandkey', ['CommandOrControl']),
          click: () => {
            Commands.printPreview();
          },
        },
        {
          label: this.ts('printCmd.label', 'printCmd.accesskey'),
          accelerator: this.tx('printCmd.commandkey', [
            'CommandOrControl',
            'Shift',
          ]),
          click: () => {
            Commands.print();
          },
        },
        { type: 'separator' },
        {
          label: this.ts('print.printpassage'),
          accelerator: this.tx('printPassageCmd.commandkey', [
            'CommandOrControl',
          ]),
          click: () => {
            Commands.printPassage();
          },
        },
        { type: 'separator' },
        {
          role: 'quit',
          label: this.ts(
            'quitApplicationCmdWin.label',
            'quitApplicationCmdWin.accesskey'
          ),
          click: () => {
            this.mainWindow.close();
          },
        },
      ],
    };

    const subMenuEdit = {
      role: 'editMenu',
      label: this.ts('editMenu.label', 'editMenu.accesskey'),
      submenu: [
        { type: 'separator' },
        {
          label: this.ts('searchBut.label', 'SearchAccKey'),
          accelerator: this.tx('SearchCommandKey', ['CommandOrControl']),
          click: () => {
            Commands.search();
          },
        },
        {
          label: this.ts('menu.copypassage', 'menu.copypassage.ak'),
          accelerator: this.tx('menu.copypassage.sc', ['CommandOrControl']),
          click: () => {
            Commands.copyPassage();
          },
        },
      ],
    };

    const switches = [
      'headings',
      'footnotes',
      'crossrefs',
      'dictlinks',
      'usernotes',
      'strongs',
      'versenums',
      'redwords',
    ];

    const allswitches = switches.map((x: any) => {
      return `xulsword.show.${x}`;
    });

    const textSwitches = switches.map((key) => {
      return {
        label: this.ts(`menu.view.${key}`),
        id: `xulsword.show.${key}`,
        type: 'checkbox',
        icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x14', `${key}.png`),
        click: () => {
          MenuBuilder.toggleSwitch(`xulsword.show.${key}`);
        },
      };
    });

    const radios = ['footnotes', 'crossrefs', 'usernotes'];

    const displayLocation = radios.map((name) => {
      return {
        label: this.ts(`menu.view.place.${name}`),
        submenu: [
          {
            label: this.ts('menu.view.popups'),
            id: `xulsword.place.${name}_val_popup`,
            type: 'radio',
            click: () => {
              MenuBuilder.radioSwitch(`xulsword.place.${name}`, 'popup');
            },
          },
          {
            label: this.ts('menu.view.notebox'),
            id: `xulsword.place.${name}_val_notebox`,
            type: 'radio',
            click: () => {
              MenuBuilder.radioSwitch(`xulsword.place.${name}`, 'notebox');
            },
          },
        ],
      };
    });

    const textTabs = MenuBuilder.showtabs.map((t) => {
      const [tab, type] = t;
      return {
        id: `parent_${tab}`,
        label: this.ts(`menu.view.${tab}`),
        icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
        submenu: [
          ...MenuBuilder.panelLabels.map((pl: any) => {
            return {
              label: this.ts(pl),
              id: `menu_${tab}_${pl}`,
              submenu: [
                {
                  id: `showAll_${tab}_${pl}`,
                  label: this.ts('menu.view.showAll'),
                  click: () => {
                    MenuBuilder.setTabs(type, pl, 'all', 'show');
                  },
                },
                {
                  id: `hideAll_${tab}_${pl}`,
                  label: this.ts('menu.view.hideAll'),
                  click: () => {
                    MenuBuilder.setTabs(type, pl, 'all', 'hide');
                  },
                },
              ],
            };
          }),
        ],
      };
    });

    const subMenuView = {
      role: 'viewMenu',
      label: this.ts('viewMenu.label', 'viewMenu.accesskey'),
      submenu: [
        /*
        {
          label: 'Toggle &Full Screen',
          accelerator: 'F11',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        }, */
        ...textSwitches,
        {
          label: this.ts('menu.view.showAll'),
          click: () => {
            MenuBuilder.toggleSwitch(allswitches, true);
          },
        },
        {
          label: this.ts('menu.view.hideAll'),
          click: () => {
            MenuBuilder.toggleSwitch(allswitches, false);
          },
        },
        { type: 'separator' },
        ...displayLocation,
        { type: 'separator' },
        ...textTabs,
        {
          label: this.ts('menu.view.showAll'),
          submenu: MenuBuilder.panelLabels.map((pl: any) => {
            return {
              label: this.ts(pl),
              click: () => {
                MenuBuilder.setTabs('all', pl, 'all', 'show');
              },
            };
          }),
        },
        {
          label: this.ts('menu.view.hideAll'),
          submenu: MenuBuilder.panelLabels.map((pl: any) => {
            return {
              label: this.ts(pl),
              click: () => {
                MenuBuilder.setTabs('all', pl, 'all', 'hide');
              },
            };
          }),
        },
      ],
    };

    const subMenuOptions = {
      label: this.ts('menu.options'),
      submenu: [
        {
          label: this.ts('menu.options.font'),
          submenu: [
            {
              label: this.ts('menu.options.font1'),
              id: `global.fontSize_val_0`,
              type: 'radio',
              click: () => {
                MenuBuilder.radioSwitch('global.fontSize', 0);
              },
            },
            {
              label: this.ts('menu.options.font2'),
              id: `global.fontSize_val_1`,
              type: 'radio',
              click: () => {
                MenuBuilder.radioSwitch('global.fontSize', 1);
              },
            },
            {
              label: this.ts('menu.options.font3'),
              id: `global.fontSize_val_2`,
              type: 'radio',
              click: () => {
                MenuBuilder.radioSwitch('global.fontSize', 2);
              },
            },
            {
              label: this.ts('menu.options.font4'),
              id: `global.fontSize_val_3`,
              type: 'radio',
              click: () => {
                MenuBuilder.radioSwitch('global.fontSize', 3);
              },
            },
            {
              label: this.ts('menu.options.font5'),
              id: `global.fontSize_val_4`,
              type: 'radio',
              click: () => {
                MenuBuilder.radioSwitch('global.fontSize', 4);
              },
            },
            { type: 'separator' },
            {
              label: this.ts('fontsAndColors.label'),
              click: () => {
                Commands.openFontsColors();
              },
            },
          ],
        },
        {
          label: this.ts('menu.options.hebrew'),
          submenu: [
            {
              label: this.ts('menu.options.hebVowel'),
              id: 'xulsword.show.hebvowelpoints',
              type: 'checkbox',
              click: () => {
                MenuBuilder.toggleSwitch('xulsword.show.hebvowelpoints');
              },
            },
            {
              label: this.ts('menu.options.hebCant'),
              id: 'xulsword.show.hebcantillation',
              type: 'checkbox',
              click: () => {
                MenuBuilder.toggleSwitch('xulsword.show.hebcantillation');
              },
            },
          ],
        },
        {
          label: this.ts('menu.options.language'),
          // accelerator: 'F1', cannot open main menu item
          submenu: G.Prefs.getComplexValue('global.locales').map((l: any) => {
            const [lng, name] = l;
            return {
              label: name,
              id: `${C.LOCALEPREF}_val_${lng}`,
              type: 'radio',
              toolTip: lng,
              click: () => {
                MenuBuilder.radioSwitch(C.LOCALEPREF, lng);
              },
            };
          }),
        },
      ],
    };

    const subMenuBookmarks = {
      label: this.ts('bookmarksMenu.label', 'bookmarksMenu.accesskey'),
      submenu: [
        {
          label: this.ts('manBookmarksCmd.label'),
          accelerator: this.tx('manBookmarksCmd.commandkey', [
            'CommandOrControl',
          ]),
          click: () => {
            Commands.openBookmarksManager();
          },
        },
        {
          label: this.ts('menuitem.newBookmark.label'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', [
            'CommandOrControl',
          ]),
          click: () => {
            Commands.openNewBookmarkDialog();
          },
        },
        {
          label: this.ts('menu.usernote.add'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', [
            'CommandOrControl',
            'Shift',
          ]),
          click: () => {
            Commands.openNewUserNoteDialog();
          },
        },
      ],
    };

    const panelpref = 'xulsword.panels';
    const panelarray = G.Prefs.getComplexValue(panelpref);
    const subMenuWindows = {
      role: 'windowMenu',
      label: this.ts('menu.windows'),
      submenu: panelarray.map((_p: string | null, i: number) => {
        const n = i + 1;
        return {
          label: this.ts(`menu.windows.${n}win`),
          id: `xulsword.panels_val_${n}`,
          type: 'radio',
          click: () => {
            const newpans = panelarray.map(
              (panel: string | null, x: number) => {
                return x > i ? null : panel || '';
              }
            );
            G.Prefs.setComplexValue(panelpref, newpans);
            G.setGlobalStateFromPref(null, panelpref);
          },
        };
      }),
    };

    const subMenuHelp = {
      role: 'about',
      label: this.ts('menu.help'),
      submenu: [
        {
          label: this.ts('menu.help.about'),
          click: () => {
            Commands.openHelp();
          },
        },
      ],
    };

    const subMenuDev = {
      role: 'help',
      label: 'Devel',
      submenu: [
        {
          role: 'reload',
          label: '&Reload',
          accelerator: 'Ctrl+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          role: 'togglefullscreen',
          label: 'Toggle &Full Screen',
          accelerator: 'F11',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          role: 'toggelDevTools',
          label: 'Toggle &Developer Tools',
          accelerator: 'Alt+Ctrl+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
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

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    )
      applicationMenuTemplate.push(subMenuDev);

    return applicationMenuTemplate;
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
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
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
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
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://electronjs.org');
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal(
              'https://github.com/electron/electron/tree/main/docs#readme'
            );
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell.openExternal('https://www.electronjs.org/community');
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell.openExternal('https://github.com/electron/electron/issues');
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }
}
