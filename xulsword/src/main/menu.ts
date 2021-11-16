/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';
import i18next from 'i18next';
import G from './gm';
import C from '../constant';

const Command = {
  // Some commands update language and global state from Prefs
  setGlobalStateFromPrefs(name: string | string[]) {
    function setGlobalStateFromPrefs2() {
      G.reset();
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('setStateFromPrefs', name);
      });
    }

    // Change language if Pref changed
    const lng = G.Prefs.getCharPref(C.LOCALEPREF);
    if (lng !== i18next.language) {
      G.reset();
      i18next
        .changeLanguage(lng)
        .then(() => {
          return setGlobalStateFromPrefs2();
        })
        .catch((e) => {
          throw Error(e);
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

  setTabs(name: string | 'all', value: 'showAll' | 'hideAll') {
    console.log(`Action not implemented: setTabs(${name}, ${value})`);
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

  copyPassage() {
    console.log(`Action not implemented: copyPassage`);
  },

  search() {
    console.log(`Action not implemented: search()`);
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

  // Get locale key with letter prepended with '&' to specify shortcut.
  ts(key: string, letter?: string): string {
    let text = this.i18n.t(key);
    const ltr = letter || `${key}.sc`;
    if (ltr) {
      const l = this.tx(ltr);
      const re = new RegExp(`(${l})`, 'i');
      if (l) text = text.replace(re, '&$1');
    }
    return text;
  }

  // Get locale key or silently return undefined if it doesn't exist.
  // Also prepend text with modifiers if supplied.
  tx(key: string, modifiers?: Modifiers[]): string | undefined {
    const text = this.i18n.exists(key) ? this.i18n.t(key) : undefined;
    if (text === undefined) return undefined;
    if (modifiers && modifiers.length) {
      return `${modifiers.join('+')}+${text}`;
    }
    return text;
  }

  buildDefaultTemplate() {
    const subMenuFile = {
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
      ['xulsword.showHeadings', 'menu.view.headings'],
      ['xulsword.showFootnotes', 'menu.view.footnotes'],
      ['xulsword.showCrossRefs', 'menu.view.crossrefs'],
      ['xulsword.showDictLinks', 'menu.view.dict'],
      ['xulsword.showUserNotes', 'menu.view.usernotes'],
      ['xulsword.showStrongs', 'menu.view.langnotes'],
      ['xulsword.showVerseNums', 'menu.view.versenums'],
      ['xulsword.showRedWords', 'menu.view.redwords'],
    ];

    const allswitches = switches.map((x: any) => {
      return x[0];
    });

    const textSwitches = switches.map((sw) => {
      const [name, key] = sw;
      return {
        label: this.ts(key),
        id: name,
        type: 'checkbox',
        click: () => {
          Command.toggleSwitch(name);
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

    const tabs = [
      'showtexttabs',
      'showcommtabs',
      'showbooktabs',
      'showdicttabs',
    ];

    const winLabels = [
      {
        label: this.ts('menu.view.window1'),
      },
      {
        label: this.ts('menu.view.window2'),
      },
      {
        label: this.ts('menu.view.window3'),
      },
      {
        label: this.ts('menu.view.allwindows'),
      },
    ];

    const textTabs = tabs.map((tab) => {
      return {
        label: this.ts(`menu.view.${tab}`),
        submenu: [
          { id: `sep_${tab}`, type: 'separator' },
          {
            label: this.ts('menu.view.showAll'),
            click: () => {
              Command.setTabs(tab, 'showAll');
            },
          },
          {
            label: this.ts('menu.view.hideAll'),
            click: () => {
              Command.setTabs(tab, 'hideAll');
            },
          },
          { type: 'separator' },
          ...winLabels.map((sm: any, i) => {
            sm.type = 'radio';
            if (i === winLabels.length - 1) sm.checked = true;
            return sm;
          }),
        ],
      };
    });

    const subMenuView = {
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
          submenu: winLabels.map((sm: any) => {
            sm.click = () => {
              Command.setTabs('all', 'showAll');
            };
            return sm;
          }),
        },
        {
          label: this.ts('menu.view.hideAll'),
          submenu: winLabels.map((sm: any) => {
            sm.click = () => {
              Command.setTabs('all', 'hideAll');
            };
            return sm;
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
          ],
        },
        {
          label: this.ts('menu.options.hebrew'),
          submenu: [
            {
              label: this.ts('options.hebVowel'),
              id: 'xulsword.showHebVowelPoints',
              type: 'checkbox',
              click: () => {
                Command.toggleSwitch('xulsword.showHebVowelPoints');
              },
            },
            {
              label: this.ts('options.hebCant'),
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
          submenu: C.Languages.map((l) => {
            const [lng, name] = l;
            return {
              label: name,
              id: `${C.LOCALEPREF}_val_${lng}`,
              type: 'radio',
              click: () => {
                Command.radioSwitch(C.LOCALEPREF, lng);
              },
            };
          }),
        },
      ],
    };

    const subMenuBookmarks = {};

    const subMenuWindows = {
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

    const all = [
      subMenuFile,
      subMenuEdit,
      subMenuView,
      subMenuOptions,
      // subMenuBookmarks,
      subMenuWindows,
      subMenuHelp,
    ];
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    )
      all.push(subMenuDev);

    return all;
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
