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
import G from './mg';
import Commands, { newDbItemWithDefaults } from './commands';
import setViewportTabs from './tabs';

import type { TabTypes, XulswordStatePref } from '../type';
import { verseKey } from './minit';

type Modifiers =
  | 'CommandOrControl' // 'accel' in XUL
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

  mainWindow: BrowserWindow;

  i18n: any;

  constructor(mainWindow: BrowserWindow, i18n: any) {
    this.mainWindow = mainWindow;
    this.i18n = i18n;
  }

  buildMenu(): Menu {
    const template: any =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    MenuBuilder.buildTabMenus(menu);
    G.setGlobalMenuFromPref(menu);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  static showtabs: [string, TabTypes][] = [
    ['showtexttabs', 'Texts'],
    ['showcommtabs', 'Comms'],
    ['showbooktabs', 'Genbks'],
    ['showdicttabs', 'Dicts'],
  ];

  static panelLabels = (() => {
    const panelLabels: string[] = [];
    const panels = G.Prefs.getComplexValue(
      'xulsword.panels'
    ) as XulswordStatePref['panels'];
    panels.forEach((_panel: string | null, i: number) => {
      panelLabels.push(`menu.view.window${i + 1}`);
    });
    panelLabels.push('menu.view.allwindows');
    return panelLabels;
  })();

  static buildTabMenus(menu: Menu) {
    MenuBuilder.showtabs.forEach((showtab) => {
      const [typekey, type] = showtab;
      let disableParent = true;
      MenuBuilder.panelLabels.forEach((pl) => {
        const panelIndex =
          pl === 'menu.view.allwindows'
            ? -1
            : Number(pl.substring(pl.length - 1)) - 1;
        const tabmenu = menu.getMenuItemById(`menu_${typekey}_${pl}`);
        const submenu = tabmenu?.submenu;
        if (!submenu) throw Error(`No tabmenu: menu_${typekey}_${pl}`);
        const { items } = submenu;
        while (items[0].id !== `showAll_${typekey}_${pl}`) items.shift();
        G.Tabs.reverse().forEach((t) => {
          if (t.tabType === type) {
            disableParent = false;
            const newItem = new MenuItem({
              id: `showtab_${panelIndex}_${t.module}`,
              label: t.label + (t.description ? ` --- ${t.description}` : ''),
              type: 'checkbox',
              // icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
              click: () => {
                setViewportTabs(panelIndex, t.module, 'toggle');
              },
            });
            submenu.insert(0, newItem);
          }
        });
      });
      const parent = menu.getMenuItemById(`parent_${typekey}`);
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

    const edits = ['undo', 'redo', 'cut', 'copy', 'paste'];
    const subMenuEdit = {
      role: 'editMenu',
      label: this.ts('editMenu.label', 'editMenu.accesskey'),
      submenu: edits
        .map((edx) => {
          const ed = edx as 'undo' | 'redo' | 'cut' | 'copy' | 'paste';
          return {
            label: this.ts(`menu.edit.${ed}`),
            accelerator: this.tx(`menu.edit.${ed}.ac`, ['CommandOrControl']),
            click: () => {
              if (!Commands.edit(ed)) this.mainWindow.webContents[ed]();
            },
          };
        })
        .concat([
          { type: 'separator' } as any,
          {
            label: this.ts('searchBut.label', 'SearchAccKey'),
            accelerator: this.tx('SearchCommandKey', ['CommandOrControl']),
            click: () => {
              const search = {} as any;
              Commands.search(search);
            },
          },
          {
            label: this.ts('menu.copypassage', 'menu.copypassage.ak'),
            accelerator: this.tx('menu.copypassage.sc', ['CommandOrControl']),
            click: () => {
              Commands.copyPassage();
            },
          },
        ]),
    };

    const switches = [
      'headings',
      'footnotes',
      'crossrefs',
      'dictlinks',
      'usernotes',
      'strongs',
      'morph',
      'versenums',
      'redwords',
    ];

    const allswitches = switches.map((x: any) => {
      return `xulsword.show.${x}`;
    });

    const textSwitches = switches
      .filter((s) => {
        return s !== 'morph'; // this options does not have a menu item
      })
      .map((key) => {
        return {
          label: this.ts(`menu.view.${key}`),
          id: `xulsword.show.${key}`,
          type: 'checkbox',
          icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x14', `${key}.png`),
          click: () => {
            const keys = [`xulsword.show.${key}`];
            if (key === 'strongs') {
              keys.push(`xulsword.show.morph`); // switch these two together
            }
            MenuBuilder.toggleSwitch(keys);
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
      const [typekey, type] = t;
      return {
        id: `parent_${typekey}`,
        label: this.ts(`menu.view.${typekey}`),
        icon: path.join(
          G.Dirs.path.xsAsset,
          'icons',
          '16x16',
          `${typekey}.png`
        ),
        submenu: [
          ...MenuBuilder.panelLabels.map((pl: any) => {
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: this.ts(pl),
              id: `menu_${typekey}_${pl}`,
              submenu: [
                {
                  id: `showAll_${typekey}_${pl}`,
                  label: this.ts('menu.view.showAll'),
                  click: () => {
                    setViewportTabs(panelIndex, type, 'show');
                  },
                },
                {
                  id: `hideAll_${typekey}_${pl}`,
                  label: this.ts('menu.view.hideAll'),
                  click: () => {
                    setViewportTabs(panelIndex, type, 'hide');
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
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: this.ts(pl),
              click: () => {
                setViewportTabs(panelIndex, 'all', 'show');
              },
            };
          }),
        },
        {
          label: this.ts('menu.view.hideAll'),
          submenu: MenuBuilder.panelLabels.map((pl: any) => {
            const panelIndex =
              pl === 'menu.view.allwindows'
                ? -1
                : Number(pl.substring(pl.length - 1)) - 1;
            return {
              label: this.ts(pl),
              click: () => {
                setViewportTabs(panelIndex, 'all', 'hide');
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
                const panels = G.Prefs.getComplexValue(
                  'xulsword.panels'
                ) as XulswordStatePref['panels'];
                const module =
                  panels.find((m) => m) ||
                  (G.Tabs[0] && G.Tabs[0].module) ||
                  '';
                Commands.openFontsColors(module, this.mainWindow);
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

    const dummy = {
      location: verseKey('Gen.1.1').location(),
      module: 'KJV',
      text: '',
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
          label: this.ts('menu.bookmark.add'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', [
            'CommandOrControl',
          ]),
          click: () => newDbItemWithDefaults(false, dummy),
        },
        {
          label: this.ts('menu.usernote.add'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', [
            'CommandOrControl',
            'Shift',
          ]),
          click: () => newDbItemWithDefaults(true, dummy),
        },
      ],
    };

    const panelarray = G.Prefs.getComplexValue(
      'xulsword.panels'
    ) as XulswordStatePref['panels'];
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
            G.Prefs.setComplexValue('xulsword.panels', newpans);
            G.setGlobalStateFromPref(null, 'xulsword.panels');
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
