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

function setState2(state: any) {
  // Change to requested state for each window
  G.reset();
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('setState', state);
  });
}

function setState(state: any) {
  // Change language if requested
  const lng = state[C.LOCALEPREF];
  if (typeof lng !== undefined && G.Prefs.getCharPref(C.LOCALEPREF) !== lng) {
    G.reset();
    delete state[C.LOCALEPREF];
    i18next
      .changeLanguage(lng)
      .then(() => {
        return setState2(state);
      })
      .catch((e) => {
        throw Error(e);
      });
  } else {
    setState2(state);
  }
}

const Command: any = {
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

  setTabs(name: string | 'all', value: 'showAll' | 'hideAll') {
    console.log(`Action not implemented: setTabs(${name}, ${value})`);
  },

  search() {
    console.log(`Action not implemented: search()`);
  },

  openHelp() {
    console.log(`Action not implemented: openHelp()`);
  },

  toggleSwitch(name: string | string[], value?: boolean) {
    const a = Array.isArray(name) ? name : [name];
    const state: any = {};
    a.forEach((n) => {
      const v = value === undefined ? !G.Prefs.getBoolPref(n) : value;
      G.Prefs.setBoolPref(n, v);
      state[n] = v;
    });
    setState(state);
  },

  radioSwitch(name: string, value: string | number) {
    const state: any = { [name]: value };
    if (typeof value === 'number') {
      G.Prefs.setIntPref(name, value);
    } else {
      G.Prefs.setCharPref(name, value);
    }
    setState(state);
    console.log(`Action not implemented: radioSwitch(${name}, ${value})`);
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

  buildDefaultTemplate() {
    const entryModule = [
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
    ];

    const entryQuit = [
      {
        label: this.ts(
          'quitApplicationCmdWin.label',
          'quitApplicationCmdWin.accesskey'
        ),
        click: () => {
          this.mainWindow.close();
        },
      },
    ];

    const subMenuFileNoBible = {
      label: this.ts('fileMenu.label', 'fileMenu.accesskey'),
      submenu: [...entryModule, ...entryQuit],
    };

    if (!G.LibSword.hasBible()) {
      return [subMenuFileNoBible];
    }

    const entryFile = [
      {
        label: this.ts('menu.removeModule.label', 'menu.removeModule.sc'),
        click: () => {
          Command.removeModule();
        },
      },
      { type: 'separator' },
      {
        label: this.ts('menu.exportAudio.label', 'menu.exportAudio.sc'),
        click: () => {
          Command.exportAudio();
        },
      },
      {
        label: this.ts('menu.importAudio.label', 'menu.importAudio.sc'),
        click: () => {
          Command.importAudio();
        },
      },
      { type: 'separator' },
      {
        label: this.ts('printSetupCmd.label', 'printSetupCmd.accesskey'),
        click: () => {
          Command.pageSetup();
        },
      },
      {
        label: this.ts('printPreviewCmd.label', 'printPreviewCmd.accesskey'),
        accelerator: this.tx('printCmd.commandkey', ['CommandOrControl']),
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
        click: () => {
          Command.print();
        },
      },
      { type: 'separator' },
      {
        label: this.ts('print.printpassage'),
        accelerator: this.tx('printPassageCmd.commandkey', [
          'CommandOrControl',
        ]),
        click: () => {
          Command.printPassage();
        },
      },
      { type: 'separator' },
    ];

    const subMenuFile = {
      label: this.ts('fileMenu.label', 'fileMenu.accesskey'),
      submenu: [...entryModule, ...entryFile, ...entryQuit],
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
      ['showHeadings', 'menu.view.headings'],
      ['sshowFootnotes', 'menu.view.footnotes'],
      ['sshowCrossRefs', 'menu.view.crossrefs'],
      ['sshowUserNotes', 'menu.view.usernotes'],
      ['sshowDictLinks', 'menu.view.dict'],
      ['sshowStrongs', 'menu.view.langnotes'],
      ['sshowVerseNums', 'menu.view.versenums'],
      ['sshowRedWords', 'menu.view.redwords'],
    ];

    const allswitches = switches.map((x: any) => {
      return x[0];
    });

    const textSwitches = switches.map((sw) => {
      const [name, key] = sw;
      return {
        label: this.ts(key),
        type: 'checkbox',
        checked: G.Prefs.getPrefOrCreate(name, 'boolean', true),
        click: () => {
          Command.toggleSwitch(name);
        },
      };
    });

    const radios = ['fnlocation', 'crlocation', 'unlocation'];

    const displayLocation = radios.map((name) => {
      const prefVal = G.Prefs.getPrefOrCreate(name, 'string', 'notebox');
      return {
        label: this.ts(`menu.view.${name}`),
        submenu: [
          {
            label: this.ts('menu.view.popups'),
            type: 'radio',
            checked: prefVal === 'popup',
            click: () => {
              Command.radioSwitch(name, 'popup');
            },
          },
          {
            label: this.ts('menu.view.notebox'),
            type: 'radio',
            checked: prefVal === 'notebox',
            click: () => {
              Command.radioSwitch(name, 'notebox');
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
          { id: tab, type: 'separator' },
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
          { id: tab, type: 'separator' },
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

    const fontPref = 'menu.options.font';
    const fontVal = G.Prefs.getPrefOrCreate(fontPref, 'number', 2);
    const langVal = G.Prefs.getCharPref(C.LOCALEPREF);
    const subMenuOptions = {
      label: this.ts('menu.options'),
      submenu: [
        {
          label: this.ts('menu.options.font'),
          submenu: [
            {
              label: this.ts('menu.options.font1'),
              type: 'radio',
              checked: fontVal === 0,
              click: () => {
                Command.radioSwitch(fontPref, 0);
              },
            },
            {
              label: this.ts('menu.options.font2'),
              type: 'radio',
              checked: fontVal === 1,
              click: () => {
                Command.radioSwitch(fontPref, 1);
              },
            },
            {
              label: this.ts('menu.options.font3'),
              type: 'radio',
              checked: fontVal === 2,
              click: () => {
                Command.radioSwitch(fontPref, 2);
              },
            },
            {
              label: this.ts('menu.options.font4'),
              type: 'radio',
              checked: fontVal === 3,
              click: () => {
                Command.radioSwitch(fontPref, 3);
              },
            },
            {
              label: this.ts('menu.options.font5'),
              type: 'radio',
              checked: fontVal === 4,
              click: () => {
                Command.radioSwitch(fontPref, 4);
              },
            },
          ],
        },
        {
          label: this.ts('menu.options.hebrew'),
          submenu: [
            {
              label: this.ts('options.hebVowel'),
              type: 'checkbox',
              checked: G.Prefs.getPrefOrCreate(
                'showHebVowelPoints',
                'boolean',
                true
              ),
              click: () => {
                Command.toggleSwitch('showHebVowelPoints');
              },
            },
            {
              label: this.ts('options.hebCant'),
              type: 'checkbox',
              checked: G.Prefs.getPrefOrCreate(
                'showHebCantillation',
                'boolean',
                true
              ),
              click: () => {
                Command.toggleSwitch('showHebCantillation');
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
              type: 'radio',
              checked: langVal === lng,
              click: () => {
                Command.radioSwitch(C.LOCALEPREF, lng);
              },
            };
          }),
        },
      ],
    };

    const subMenuBookmarks = {};

    const winPref = 'numDisplayedWindows';
    const winVal = G.Prefs.getPrefOrCreate(winPref, 'number', 2);
    const subMenuWindows = {
      label: this.ts('menu.windows'),
      submenu: [
        {
          label: this.ts('menu.windows.1win'),
          type: 'radio',
          checked: winVal === 1,
          click: () => {
            Command.radioSwitch(winPref, 1);
          },
        },
        {
          label: this.ts('menu.windows.2win'),
          type: 'radio',
          checked: winVal === 2,
          click: () => {
            Command.radioSwitch(winPref, 2);
          },
        },
        {
          label: this.ts('menu.windows.3win'),
          type: 'radio',
          checked: winVal === 3,
          click: () => {
            Command.radioSwitch(winPref, 3);
          },
        },
      ],
    };

    const subMenuHelp = {
      label: this.ts('menu.help'),
      submenu: [
        {
          label: this.ts('menu.help.about'),
          click() {
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
