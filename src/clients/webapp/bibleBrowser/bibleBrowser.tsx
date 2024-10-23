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
import Prefs from '../prefs.ts';
import {
  writeSettingsToPrefsStores,
  getComponentSettings,
  getReactComponents,
} from '../common.ts';
import defaultSettings, {
  BibleBrowserSettings,
  setEmptyPrefs,
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
      (x) => x.dataset.reactComponent === 'bibleBrowser',
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

      // If storageId is 'none', then user settings are not persistent between
      // page reloads. If the id is un-prefixed or prefixed with 'before:' then
      // user prefs will defer to any pref values in settings. Or if prefixed
      // with 'after:' then even settings will be overwritten by any previously
      // set user pref values (ie. settings will have no effect).
      let storageId: string = 'none';
      if (!Build.isDevelopment) ({ storageId } = settings);
      let userPrefs: 'before' | 'after' | 'none' =
        storageId === 'none' ? 'none' : 'before';
      const match = storageId.match(/^(before|after|none):/);
      if (match) {
        userPrefs = match[1] as 'before' | 'after' | 'none';
        storageId = storageId.substring(userPrefs.length + 1);
        if (userPrefs === 'none') storageId = 'none';
      }
      if (storageId !== 'none') Prefs.setStorageId(storageId);

      let maxPanels = Math.ceil(window.innerWidth / 300);
      if (maxPanels < 2) maxPanels = 2;
      else if (maxPanels > 6) maxPanels = 6;
      (window as BibleBrowserControllerGlobal).browserMaxPanels = maxPanels;
      let numPanels: number =
        (settings.prefs?.xulsword as any)?.panels?.length || maxPanels;
      if (numPanels > maxPanels) numPanels = maxPanels;
      if (!frame || (frame === '0' && window.innerWidth < 768)) {
        numPanels = 1;
      }

      // Must set global.locale before callBatchThenCache.
      writeSettingsToPrefsStores(settings, userPrefs);
      let locale = langcode;
      if (!locale || !C.Locales.some((x) => x[0] === locale)) locale = 'en';
      Prefs.setCharPref('global.locale', locale);

      await callBatchThenCache([
        ['getLocalizedBooks', null, [[locale]]],
        ['Tabs', null, undefined],
        ['Books', null, [locale]],
        ['Config', null, undefined], // can reduce, except style is tricky
        ['ModuleFonts', null, undefined], // can remove, except style is tricky
        ['FeatureModules', null, undefined],
        ['LocaleConfigs', null, undefined],
        ['getLocaleDigits', null, [locale]],
        ['ModuleConfigDefault', null, undefined],
        ['ProgramConfig', null, undefined],
        ['i18n', 't', ['locale_direction', { lng: locale }]],
        ...Object.values(C.SupportedTabTypes).map(
          (type) => ['i18n', 't', [type, { lng: locale }]] as any,
        ),
      ]);

      setEmptyPrefs(Prefs);
      setGlobalPanels(Prefs, numPanels);

      const globalPopup = {} as typeof S.prefs.global.popup;
      validateGlobalModulePrefs(
        G.Tabs,
        G.Prefs,
        G.i18n.language,
        G.FeatureModules,
        globalPopup,
      );
      G.Prefs.mergeValue('global.popup', globalPopup);

      // Wheel scroll is confusing in desktop Browser, so disable it.
      const wheelCapture = (e: React.SyntheticEvent<any>): boolean => {
        if (window.innerWidth > C.UI.WebApp.mobileW) {
          e.stopPropagation();
          return true;
        }
        return false;
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
        htmlCssClass: 'bibleBrowser',
      }).catch((er) => {
        log.error(er);
      });
    }
  })().catch((er) => {
    log.error(er);
  });
});
