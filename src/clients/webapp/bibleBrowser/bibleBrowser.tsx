import React from 'react';
import {
  sanitizeHTML,
  setGlobalPanels,
  validateGlobalModulePrefs,
} from '../../../common.ts';
import S from '../../../defaultPrefs.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import log from '../../log.ts';
import { callBatchThenCache } from '../../renderPromise.ts';
import renderToRoot from '../../controller.tsx';
import Xulsword from '../../components/xulsword/xulsword.tsx';
import socketConnect from '../preload.ts';
import {
  writeSettingsToPrefsStores,
  setGlobalLocale,
  getComponentSettings,
  getReactComponents,
} from '../common.ts';
import defaultSettings, {
  BibleBrowserSettings,
  setEmptySettings,
} from './defaultSettings.ts';
import './bibleBrowser.css';

// For narrow screens, only one panel is shown and all notes appear in popups,
// regardless of initial settings.

export type BibleBrowserControllerGlobal = {
  browserMaxPanels?: number;
} & typeof window;

const socket = socketConnect(
  Number(process.env.WEBAPP_PORT),
  window.location.origin,
);

// connect is called even on reconnect, so only initialize once.
let initialized = false;

socket.on('connect', () => {
  (async () => {
    const bibleBrowserComps = getReactComponents(document).filter(
      (x) => x.dataset.reactComponent === 'bible-browser',
    );
    if (bibleBrowserComps.length > 1)
      log.error('Only one Browser Bible component per document is supported.');
    else if (!initialized) {
      initialized = true;

      const [bibleBrowserComp] = bibleBrowserComps;
      const { settings, langcode } = getComponentSettings(
        bibleBrowserComp,
        defaultSettings,
      ) as BibleBrowserSettings;

      // Add any custom iframe CSS
      const { frame } = settings;
      if (frame && !/^(0|1)$/.test(frame)) {
        const style = document.createElement('div');
        // style must be a child of div to pass through the sanitizer.
        sanitizeHTML(style, `<div><style>${frame}</style></div>`);
        if (style.firstElementChild?.firstElementChild) {
          document
            .querySelector('body')
            ?.insertBefore(style.firstElementChild.firstElementChild, null);
        }
      }

      (window as BibleBrowserControllerGlobal).browserMaxPanels = Math.ceil(
        window.innerWidth / 300,
      );
      let numPanels: number =
        (settings.prefs?.xulsword as any)?.panels?.length ||
        (window as BibleBrowserControllerGlobal).browserMaxPanels;
      if (window.innerWidth < 768) {
        numPanels = 1;
      }
      const locale = setGlobalLocale(settings, langcode);
      // Must set global.locale before callBatch.
      writeSettingsToPrefsStores(settings);

      await callBatchThenCache([
        ['Tabs', null, undefined],
        ['Tab', null, undefined],
        ['BkChsInV11n', null, undefined],
        ['GetBooksInVKModules', null, undefined],
        ['getLocaleDigits', null, [false]],
        ['getLocaleDigits', null, [true]],
        ['getLocaleDigits', null, []],
        ['getLocalizedBooks', null, [true]],
        ['ModuleConfigDefault', null, undefined],
        ['ModuleFonts', null, undefined],
        ['ProgramConfig', null, undefined],
        ['LocaleConfigs', null, undefined],
        ['Config', null, undefined],
        ['FeatureModules', null, undefined],
        ['AudioConfs', null, undefined],
        ['Books', null, [locale]],
        ['Book', null, [locale]],
        ['i18n', 't', ['ORIGLabelOT', { lng: locale }]],
        ['i18n', 't', ['ORIGLabelNT', { lng: locale }]],
        ['i18n', 't', ['locale_direction', { lng: locale }]],
        ...Object.values(C.SupportedTabTypes).map(
          (type) => ['i18n', 't', [type, { lng: locale }]] as any,
        ),
        ...Object.entries(C.UI.Search.symbol).map((entry) => {
          const [k] = entry;
          return ['i18n', 'exists', [k, { lng: locale }]];
        }),
        ...Object.entries(C.UI.Search.symbol).map((entry) => {
          const [k] = entry;
          return ['i18n', 't', [k, { lng: locale }]];
        }),
      ]);
      setEmptySettings(settings);
      setGlobalPanels(settings, numPanels);

      // Update Prefs with final settings.
      if (window.innerWidth < 768) {
        settings.prefs.xulsword.noteBoxHeight = [300]; // for dict modules
        settings.prefs.xulsword.place = {
          footnotes: 'popup',
          crossrefs: 'popup',
          usernotes: 'popup',
        };
      }

      writeSettingsToPrefsStores(settings);

      const globalPopup = {} as typeof S.prefs.global.popup;
      validateGlobalModulePrefs(
        G.Tabs,
        G.Prefs,
        G.i18n.language,
        G.FeatureModules,
        globalPopup,
      );
      G.Prefs.mergeValue('global.popup', globalPopup);

      if (window.innerWidth < 500)
        G.Prefs.setBoolPref('xulsword.showChooser', false);

      // Wheel scroll is wonky in the Browser, so disable it for now.
      const wheelCapture = (e: React.SyntheticEvent<any>): boolean => {
        e.stopPropagation();
        return true;
      };

      // Cancel Tarapro page loader overlay.
      setTimeout(() => {
        const win = frameElement?.ownerDocument.defaultView;
        if (win && 'jQuery' in win) {
          (win as any).bibleBrowserIsLoading = false;
          (win as any).jQuery('.loader').fadeOut('slow');
        }
      }, 1);

      renderToRoot(<Xulsword onWheelCapture={wheelCapture} />, {
        className: 'bibleBrowser',
      }).catch((er) => {
        log.error(er);
      });
    }
  })().catch((er) => {
    log.error(er);
  });
});
