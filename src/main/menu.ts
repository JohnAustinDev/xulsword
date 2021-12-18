/* eslint-disable no-nested-ternary */
/* eslint-disable prettier/prettier */
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
import { TabTypes } from '../type';
import C from '../constant';
import Commands from './commands';
import G from './mg';

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
  // Update Prefs, then setGlobalStateFromPrefs()
  static toggleSwitch(name: string | string[], value?: boolean) {
    const a = Array.isArray(name) ? name : [name];
    a.forEach((n) => {
      const v = value === undefined ? !G.Prefs.getBoolPref(n) : value;
      G.Prefs.setBoolPref(n, v);
    });
    G.setGlobalStateFromPrefs(name);
  }

  // Update Prefs, then setGlobalStateFromPrefs()
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
    G.setGlobalStateFromPrefs(name);
  }

  static setTabs(
    type: TabTypes | 'all',
    winLabel: string | 'all',
    modOrAll: string,
    doWhat: 'show' | 'hide' | 'toggle'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const n = Number(winLabel.substring(winLabel.length - 1));
    const windows = Number.isNaN(n) ? [1, 2, 3] : [n];

    const modules =
      modOrAll === 'all'
        ? G.Tabs.map((t) => {
            return type === 'all' || type === t.tabType ? t : null;
          })
        : [G.Tab[modOrAll]];

    const pval = G.Prefs.getComplexValue('xulsword.tabs');
    const nval = JSON.parse(JSON.stringify(pval));

    // If toggling on allwindows, set them according to the clicked
    // menuitem, and not each item separately.
    let doWhat2 = doWhat;
    if (doWhat === 'toggle' && winLabel === 'menu.view.allwindows') {
      const m = modules[0];
      const val = m !== null && pval.every((wn: any) => wn?.includes(m.module));
      doWhat2 = val ? 'hide' : 'show';
    }

    windows.forEach((w) => {
      modules.forEach((t) => {
        if (t) {
          const show =
            doWhat2 === 'toggle'
              ? !pval[w - 1].includes(t.module)
              : doWhat2 === 'show';
          if (show && !pval[w - 1].includes(t.module)) {
            nval[w - 1].push(t.module);
          } else if (!show && pval[w - 1].includes(t.module)) {
            nval[w - 1].splice(nval[w - 1].indexOf(t.module), 1);
          }
        }
      });
    });

    nval.forEach((tabs: string[], i: number) => {
      const tmp = tabs.filter(Boolean);
      nval[i] = tmp.sort(MenuBuilder.tabOrder);
    });

    // Insure module vars aren't pointing to modules which have no tab.
    const prefs = ['xulsword.modules', 'xulsword.mtModules'];
    const used: any = {};
    prefs.forEach((p) => {
      const ms = G.Prefs.getComplexValue(p);
      let save = false;
      ms.forEach((m: any, i: any) => {
        if (!nval[i].includes(m)) {
          save = true;
          ms[i] = undefined;
          // Rather than leave a window's display module undefined, we
          // can choose a new module, and choose a book too if none is
          // already selected.
          if (p === 'xulsword.modules') {
            let it = 0;
            let nextmod = nval[i][it];
            while(nextmod in used && it + 1 < nval[i].length) {
              it += 1;
              nextmod = nval[i][it];
            }
            ms[i] = nextmod;
            used[nextmod] = true;
            let bk = G.Prefs.getCharPref('xulsword.book');
            if (!bk && nextmod && G.Tab[nextmod].isVerseKey) {
              [bk] = G.AvailableBooks[nextmod];
              if (bk) {
                G.Prefs.setCharPref('xulsword.book', bk);
              }
            }
          }
        }
      });
      if (save) G.Prefs.setComplexValue(p, ms);
    });

    // If user is setting tabs for a window that is not open, then open it.
    if (windows.length === 1) {
      let ndw = G.Prefs.getIntPref('xulsword.numDisplayedWindows');
      for (let w = 2; w <= windows[0]; w += 1) {
        if (w > ndw) ndw = w;
      }
      G.Prefs.setIntPref('xulsword.numDisplayedWindows', ndw);
    }

    G.Prefs.setComplexValue('xulsword.tabs', nval);

    // Update global states corresponding to prefs which could have been changed.
    G.setGlobalStateFromPrefs([
      'xulsword.tabs',
      'xulsword.modules',
      'xulsword.mtModules',
      'xulsword.book',
      'xulsword.numDisplayedWindows'
    ]);
  }

  static tabOrder(as: string, bs: string) {
    const a = G.Tab[as];
    const b = G.Tab[bs];
    if (a.tabType === b.tabType) {
      // Priority: 1) Modules matching current locale, 2) Other tabs that have
      // locales installed, 3) remaining tabs.
      const aLocale = G.ModuleConfigs[a.module]?.AssociatedLocale;
      const bLocale = G.ModuleConfigs[b.module]?.AssociatedLocale;
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      const aPriority = aLocale && aLocale !== C.NOTFOUND ? (aLocale === lng ? 1 : 2) : 3;
      const bPriority = bLocale && bLocale !== C.NOTFOUND ? (bLocale === lng ? 1 : 2) : 3;
      if (aPriority !== bPriority) return (aPriority > bPriority ? 1 : -1);
      // Type and Priority are same. Sort by label's alpha.
      return (a.label > b.label ? 1 : -1);
    }
    const mto = C.ModuleTypeOrder as any;
    return (mto[a.tabType] > mto[b.tabType] ? 1 : -1);
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
    G.setGlobalMenuFromPrefs(menu);
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

  static tabs: [string, TabTypes][] = [
    ['showtexttabs', 'Texts'],
    ['showcommtabs', 'Comms'],
    ['showbooktabs', 'Genbks'],
    ['showdicttabs', 'Dicts'],
  ];

  static winLabels = [
    'menu.view.window1',
    'menu.view.window2',
    'menu.view.window3',
    'menu.view.allwindows',
  ];

  static updateTabMenus(menu: Menu) {
    MenuBuilder.tabs.forEach((tb) => {
      const [tab, type] = tb;
      let disableParent = true;
      MenuBuilder.winLabels.forEach((wl) => {
        const win = Number(wl.substring(wl.length - 1));
        const tabmenu = menu.getMenuItemById(`menu_${tab}_${wl}`);
        const submenu = tabmenu?.submenu;
        if (!submenu) throw Error(`No tabmenu: menu_${tab}_${wl}`);
        const { items } = submenu;
        while (items[0].id !== `showAll_${tab}_${wl}`) items.shift();
        let disableMulti = 0;
        G.Tabs.reverse().forEach((t) => {
          if (t.tabType === type) {
            disableParent = false;
            disableMulti += 1;
            const newItem = new MenuItem({
              id: `showtab_${win}_${t.module}`,
              label: t.label + (t.description ? ` --- ${t.description}` : ''),
              type: 'checkbox',
              // icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
              click: () => {
                MenuBuilder.setTabs(type, wl, t.module, 'toggle');
              },
            });
            submenu.insert(0, newItem);
          }
        });
        const showAll = menu.getMenuItemById(`showAll_${tab}_${wl}`);
        const hideAll = menu.getMenuItemById(`hideAll_${tab}_${wl}`);
        if (showAll) showAll.enabled = disableMulti > 1;
        if (hideAll) hideAll.enabled = disableMulti > 1;
      });
      const parent = menu.getMenuItemById(`parent_${tab}`);
      if (parent) parent.enabled = !disableParent;
    });
  }

  // Get locale key with letter prepended by '&' to specify shortcut.
  ts(key: string, sckey?: string): string {
    let text = this.i18n.t(key);
    const sckey2 = sckey || `${key}.sc`;
    if (text) {
      const l = this.i18n.t(sckey2);
      if (l) {
        const re = new RegExp(`(${l})`, 'i');
        text = text.replace(re, '&$1');
      }
    }
    return text;
  }

  // Get locale key or return undefined if it doesn't exist.
  // Also prepend text with modifiers if supplied.
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
      'redwords'
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

    const textTabs = MenuBuilder.tabs.map((t) => {
      const [tab, type] = t;
      return {
        id: `parent_${tab}`,
        label: this.ts(`menu.view.${tab}`),
        icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
        submenu: [
          ...MenuBuilder.winLabels.map((wl: any) => {
            return {
              label: this.ts(wl),
              id: `menu_${tab}_${wl}`,
              submenu: [
                {
                  id: `showAll_${tab}_${wl}`,
                  label: this.ts('menu.view.showAll'),
                  click: () => {
                    MenuBuilder.setTabs(type, wl, 'all', 'show');
                  },
                },
                {
                  id: `hideAll_${tab}_${wl}`,
                  label: this.ts('menu.view.hideAll'),
                  click: () => {
                    MenuBuilder.setTabs(type, wl, 'all', 'hide');
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
          submenu: MenuBuilder.winLabels.map((wl: any) => {
            return {
              label: this.ts(wl),
              click: () => {
                MenuBuilder.setTabs('all', wl, 'all', 'show');
              },
            };
          }),
        },
        {
          label: this.ts('menu.view.hideAll'),
          submenu: MenuBuilder.winLabels.map((wl: any) => {
            return {
              label: this.ts(wl),
              click: () => {
                MenuBuilder.setTabs('all', wl, 'all', 'hide');
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
          accelerator: this.tx('manBookmarksCmd.commandkey', ['CommandOrControl']),
          click: () => {Commands.openBookmarksManager();},
        },
        {
          label: this.ts('menuitem.newBookmark.label'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', ['CommandOrControl']),
          click: () => {Commands.openNewBookmarkDialog();},
        },
        {
          label: this.ts('menu.usernote.add'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', ['CommandOrControl', 'Shift']),
          click: () => {Commands.openNewUserNoteDialog();},
        }
      ],
    };

    const subMenuWindows = {
      role: 'windowMenu',
      label: this.ts('menu.windows'),
      submenu: [
        {
          label: this.ts('menu.windows.1win'),
          id: 'xulsword.numDisplayedWindows_val_1',
          type: 'radio',
          click: () => {
            MenuBuilder.radioSwitch('xulsword.numDisplayedWindows', 1);
          },
        },
        {
          label: this.ts('menu.windows.2win'),
          id: 'xulsword.numDisplayedWindows_val_2',
          type: 'radio',
          click: () => {
            MenuBuilder.radioSwitch('xulsword.numDisplayedWindows', 2);
          },
        },
        {
          label: this.ts('menu.windows.3win'),
          id: 'xulsword.numDisplayedWindows_val_3',
          type: 'radio',
          click: () => {
            MenuBuilder.radioSwitch('xulsword.numDisplayedWindows', 3);
          },
        },
      ],
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
