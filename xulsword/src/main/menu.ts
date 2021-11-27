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
import i18next from 'i18next';
import G from './mg';
import C from '../constant';

const Command = {
  // Some commands update language and global state from Prefs
  setGlobalStateFromPrefs(prefs: string | string[]) {
    function setGlobalStateFromPrefs2() {
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('setStateFromPrefs', prefs);
      });
    }

    // Change language if Pref changed
    const lng = G.Prefs.getCharPref(C.LOCALEPREF);
    if (lng !== i18next.language) {
      i18next
        .changeLanguage(lng, (err) => {
          if (err) throw Error(err);
          G.reset();
          setGlobalStateFromPrefs2();
        });
    } else {
      setGlobalStateFromPrefs2();
    }
  },

  // Update Prefs, then setGlobalStateFromPrefs()
  toggleSwitch(name: string | string[], value?: boolean) {
    const a = Array.isArray(name) ? name : [name];
    a.forEach((n) => {
      const v = value === undefined ? !G.Prefs.getBoolPref(n) : value;
      G.Prefs.setBoolPref(n, v);
    });
    this.setGlobalStateFromPrefs(name);
  },

  // Update Prefs, then setGlobalStateFromPrefs()
  radioSwitch(name: string | string[], value: any) {
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
    this.setGlobalStateFromPrefs(name);
  },

  setTabs(
    type: string | 'all',
    winLabel: string | 'all',
    modOrAll: string,
    doWhat: 'show' | 'hide' | 'toggle'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const n = Number(winLabel.substr(winLabel.length - 1));
    const windows = Number.isNaN(n) ? [1, 2, 3] : [n];

    const modules =
      modOrAll === 'all'
        ? G.Tabs.map((t) => {
            return type === 'all' || type === t.tabType ? t : null;
          })
        : [G.Tab[modOrAll]];

    const pval = G.Prefs.getComplexValue('xulsword.tabs');
    const nval = JSON.parse(JSON.stringify(pval));

    // If toggling on allwindows, set all according to the clicked
    // menuitem, and not each item selarately.
    let doWhat2 = doWhat;
    if (doWhat === 'toggle' && winLabel === 'menu.view.allwindows') {
      const m = modules[0];
      const val = m !== null && pval.every((wn: any) => wn?.includes(m.modName));
      doWhat2 = val ? 'hide' : 'show';
    }

    windows.forEach((w) => {
      modules.forEach((t) => {
        if (t) {
          const show =
            doWhat2 === 'toggle'
              ? !pval[w - 1].includes(t.modName)
              : doWhat2 === 'show';
          if (show && !pval[w - 1].includes(t.modName)) {
            nval[w - 1].push(t.modName);
          } else if (!show && pval[w - 1].includes(t.modName)) {
            nval[w - 1].splice(nval[w - 1].indexOf(t.modName), 1);
          }
        }
      });
    });
    G.Prefs.setComplexValue('xulsword.tabs', nval);
    this.setGlobalStateFromPrefs('xulsword.tabs');
  },

  addRepositoryModule() {
    console.log(`Action not implemented: addRepositoryModule`);
  },

  addLocalModule() {
    console.log(`Action not implemented: addLocalModule`);
  },

  removeModule() {
    console.log(`Action not implemented: removeModule`);
  },

  exportAudio() {
    console.log(`Action not implemented: exportAudio`);
  },

  importAudio() {
    console.log(`Action not implemented: importAudio`);
  },

  pageSetup() {
    console.log(`Action not implemented: pageSetup`);
  },

  printPreview() {
    console.log(`Action not implemented: printPreview`);
  },

  printPassage() {
    console.log(`Action not implemented: printPassage`);
  },

  print() {
    console.log(`Action not implemented: print`);
  },

  search() {
    console.log(`Action not implemented: search()`);
  },

  copyPassage() {
    console.log(`Action not implemented: copyPassage`);
  },

  openFontsColors() {
    console.log(`Action not implemented: openFontsColors`);
  },

  openBookmarksManager() {
    console.log(`Action not implemented: openBookmarksManager()`);
  },

  openNewBookmarkDialog() {
    console.log(`Action not implemented: openNewBookmarkDialog()`);
  },

  openNewUserNoteDialog() {
    console.log(`Action not implemented: openNewUserNoteDialog()`);
  },

  openHelp() {
    console.log(`Action not implemented: openHelp()`);
  },
};

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

  static tabs = [
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
        const win = Number(wl.substr(wl.length - 1));
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
              id: `showtab_${win}_${t.modName}`,
              label: t.label + (t.description ? ` --- ${t.description}` : ''),
              type: 'checkbox',
              // icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x16', `${tab}.png`),
              click: () => {
                Command.setTabs(type, wl, t.modName, 'toggle');
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
                Command.addRepositoryModule();
              },
            },
            {
              label: this.ts('newmodule.fromFile', 'newmodule.fromFile.ak'),
              click: () => {
                Command.addLocalModule();
              },
            },
          ],
        },
        {
          label: this.ts('menu.removeModule.label', 'menu.removeModule.sc'),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.removeModule();
          },
        },
        { type: 'separator', visible: G.LibSword.hasBible() },
        {
          label: this.ts('menu.exportAudio.label', 'menu.exportAudio.sc'),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.exportAudio();
          },
        },
        {
          label: this.ts('menu.importAudio.label', 'menu.importAudio.sc'),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.importAudio();
          },
        },
        { type: 'separator', visible: G.LibSword.hasBible() },
        {
          label: this.ts('printSetupCmd.label', 'printSetupCmd.accesskey'),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.pageSetup();
          },
        },
        {
          label: this.ts('printPreviewCmd.label', 'printPreviewCmd.accesskey'),
          accelerator: this.tx('printCmd.commandkey', ['CommandOrControl']),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.printPreview();
          },
        },
        {
          label: this.ts('printCmd.label', 'printCmd.accesskey'),
          accelerator: this.tx('printCmd.commandkey', [
            'CommandOrControl',
            'Shift',
          ]),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.print();
          },
        },
        { type: 'separator', visible: G.LibSword.hasBible() },
        {
          label: this.ts('print.printpassage'),
          accelerator: this.tx('printPassageCmd.commandkey', [
            'CommandOrControl',
          ]),
          visible: G.LibSword.hasBible(),
          click: () => {
            Command.printPassage();
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
            Command.search();
          },
        },
        {
          label: this.ts('menu.copypassage', 'menu.copypassage.ak'),
          accelerator: this.tx('menu.copypassage.sc', ['CommandOrControl']),
          click: () => {
            Command.copyPassage();
          },
        },
      ],
    };

    const switches = [
      ['showHeadings', 'headings'],
      ['showFootnotes', 'footnotes'],
      ['showCrossRefs', 'crossrefs'],
      ['showDictLinks', 'dict'],
      ['showUserNotes', 'usernotes'],
      ['showStrongs', 'langnotes'],
      ['showVerseNums', 'versenums'],
      ['showRedWords', 'redwords'],
    ];

    const allswitches = switches.map((x: any) => {
      return `xulsword.${x[0]}`;
    });

    const textSwitches = switches.map((sw) => {
      const [name, key] = sw;
      return {
        label: this.ts(`menu.view.${key}`),
        id: `xulsword.${name}`,
        type: 'checkbox',
        icon: path.join(G.Dirs.path.xsAsset, 'icons', '16x14', `${name}.png`),
        click: () => {
          Command.toggleSwitch(`xulsword.${name}`);
        },
      };
    });

    const radios = ['fnlocation', 'crlocation', 'unlocation'];

    const displayLocation = radios.map((name) => {
      return {
        label: this.ts(`menu.view.${name}`),
        submenu: [
          {
            label: this.ts('menu.view.popups'),
            id: `mainmenu.${name}_val_popup`,
            type: 'radio',
            click: () => {
              Command.radioSwitch(`mainmenu.${name}`, 'popup');
            },
          },
          {
            label: this.ts('menu.view.notebox'),
            id: `mainmenu.${name}_val_notebox`,
            type: 'radio',
            click: () => {
              Command.radioSwitch(`mainmenu.${name}`, 'notebox');
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
                    Command.setTabs(type, wl, 'all', 'show');
                  },
                },
                {
                  id: `hideAll_${tab}_${wl}`,
                  label: this.ts('menu.view.hideAll'),
                  click: () => {
                    Command.setTabs(type, wl, 'all', 'hide');
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
            Command.toggleSwitch(allswitches, true);
          },
        },
        {
          label: this.ts('menu.view.hideAll'),
          click: () => {
            Command.toggleSwitch(allswitches, false);
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
                Command.setTabs('all', wl, 'all', 'show');
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
                Command.setTabs('all', wl, 'all', 'hide');
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
                Command.radioSwitch('global.fontSize', 0);
              },
            },
            {
              label: this.ts('menu.options.font2'),
              id: `global.fontSize_val_1`,
              type: 'radio',
              click: () => {
                Command.radioSwitch('global.fontSize', 1);
              },
            },
            {
              label: this.ts('menu.options.font3'),
              id: `global.fontSize_val_2`,
              type: 'radio',
              click: () => {
                Command.radioSwitch('global.fontSize', 2);
              },
            },
            {
              label: this.ts('menu.options.font4'),
              id: `global.fontSize_val_3`,
              type: 'radio',
              click: () => {
                Command.radioSwitch('global.fontSize', 3);
              },
            },
            {
              label: this.ts('menu.options.font5'),
              id: `global.fontSize_val_4`,
              type: 'radio',
              click: () => {
                Command.radioSwitch('global.fontSize', 4);
              },
            },
            { type: 'separator' },
            {
              label: this.ts('fontsAndColors.label'),
              click: () => {
                Command.openFontsColors();
              },
            },
          ],
        },
        {
          label: this.ts('menu.options.hebrew'),
          submenu: [
            {
              label: this.ts('menu.options.hebVowel'),
              id: 'xulsword.showHebVowelPoints',
              type: 'checkbox',
              click: () => {
                Command.toggleSwitch('xulsword.showHebVowelPoints');
              },
            },
            {
              label: this.ts('menu.options.hebCant'),
              id: 'xulsword.showHebCantillation',
              type: 'checkbox',
              click: () => {
                Command.toggleSwitch('xulsword.showHebCantillation');
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
                Command.radioSwitch(C.LOCALEPREF, lng);
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
          open: () => {Command.openBookmarksManager();},
        },
        {
          label: this.ts('menuitem.newBookmark.label'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', ['CommandOrControl']),
          open: () => {Command.openNewBookmarkDialog();},
        },
        {
          label: this.ts('menu.usernote.add'),
          accelerator: this.tx('addCurPageAsCmd.commandkey', ['CommandOrControl', 'Shift']),
          open: () => {Command.openNewUserNoteDialog();},
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
            Command.radioSwitch('xulsword.numDisplayedWindows', 1);
          },
        },
        {
          label: this.ts('menu.windows.2win'),
          id: 'xulsword.numDisplayedWindows_val_2',
          type: 'radio',
          click: () => {
            Command.radioSwitch('xulsword.numDisplayedWindows', 2);
          },
        },
        {
          label: this.ts('menu.windows.3win'),
          id: 'xulsword.numDisplayedWindows_val_3',
          type: 'radio',
          click: () => {
            Command.radioSwitch('xulsword.numDisplayedWindows', 3);
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
            Command.openHelp();
          },
        },
      ],
    };

    const subMenuDev = {
      label: 'Devel',
      submenu: [
        {
          label: '&Reload',
          accelerator: 'Ctrl+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle &Full Screen',
          accelerator: 'F11',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
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
