import React from 'react';
import {
  sanitizeHTML,
  setGlobalPanels,
  validateModulePrefs,
} from '../../../common.ts';
import S from '../../../defaultPrefs.ts';
import C from '../../../constant.ts';
import { cachePreload } from '../../common.ts';
import log from '../../log.ts';
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
  BibleBrowserData,
  setDefaultBibleBrowserPrefs,
} from './defaultSettings.ts';
import './bibleBrowser.css';

window.WebAppClient = 'BibleBrowser';

export type BibleBrowserControllerGlobal = {
  browserMaxPanels?: number;
} & typeof window;

const socket = socketConnect(
  Number(process.env.WEBAPP_PORT),
  process.env.WEBAPP_DOMAIN,
);

// Wheel scroll is confusing in desktop Browser, so disable it.
const wheelCapture = (e: React.SyntheticEvent<any>): boolean => {
  if (window.innerWidth > C.UI.WebApp.mobileW) {
    e.stopPropagation();
    return true;
  }
  return false;
};

// connect is called even on reconnect, so only initialize once.
let initialized = false;

socket.on('connect', () => {
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
    ) as BibleBrowserData;

    // Since servers do not receive URL fragments from browsers, URL
    // fragments cannot be handled by the server, so handle now.
    if (
      window.location.href.endsWith('#sv') ||
      frameElement?.ownerDocument?.defaultView?.location.href.endsWith('#sv')
    ) {
      settings.prefs.xulsword.scroll = { verseAt: 'center' };
    }

    // Add CSS
    const { css } = settings;
    if (css) {
      const style = document.createElement('div');
      // style must be a child of div to pass through the sanitizer.
      sanitizeHTML(style, `<div><style>${css}</style></div>`);
      if (style.firstElementChild?.firstElementChild) {
        document
          .querySelector('body')
          ?.insertBefore(style.firstElementChild.firstElementChild, null);
      }
    }

    // DETERMINATION OF INITIAL BIBLE BROWSER STATE:
    // Initial xulsword state is set by xulsword's getStatePref()
    // system. So initial user prefs must be saved before renderToRoot() is
    // run. The writeSettingsToPrefsStores() function does this by combining
    // xulsword default prefs, user prefs for the storage ID, and server
    // settings. These are combined in the order specified by the ID as
    // follows:
    //
    //  storage ID
    //   none        -User prefs are not persistent between page reloads, so
    //                xulsword default prefs and data settings alone will
    //                determine the initial state.
    //   <ID>        -Same as 'before:<ID>'
    //   before:<ID> -Order is xulsword default prefs, followed by user prefs
    //                for this storage ID (if they exist) then server
    //                settings. Therefore server settings will override user
    //                prefs when determining the initial state.
    //   after:<ID>  -Order is xulsword default prefs, followed by server
    //                settings, then user prefs for this storage ID (if they
    //                exist). Therefore once a user pref has been set (upon
    //                first load) it will be used to determine initial state
    //                when this storage ID is used. But see EXCEPTIONS below.
    let { storageId } = settings;
    let applyUserPrefs: 'before' | 'after' | 'none' =
      storageId === 'none' ? 'none' : 'before';
    const keywords = storageId.match(/^(before|after|none):/);
    if (keywords) {
      applyUserPrefs = keywords[1] as 'before' | 'after' | 'none';
      storageId = storageId.substring(applyUserPrefs.length + 1);
      if (applyUserPrefs === 'none') storageId = 'none';
    }
    if (storageId !== 'none') {
      Prefs.setStorageId(storageId);
      if (!Prefs.storeExists('prefs', storageId)) applyUserPrefs = 'before';
    }
    // EXCEPTIONS to storage ID rules:
    // These user prefs cannot be changed by the user (ie. there is no UI to
    // do so) but they will nevertheless take on default values upon first
    // use, so server settings must always override them regardless of
    // storage ID specifying 'after'. This insures unchangeable xulsword
    // default prefs will not permanently override these server settings.
    if (applyUserPrefs === 'after') {
      Prefs.setComplexValue('xulsword.place', settings.prefs.xulsword.place);
      Prefs.setCharPref('global.locale', settings.prefs.global.locale);
      Prefs.setIntPref('global.fontSize', settings.prefs.global.fontSize);
    }
    writeSettingsToPrefsStores(settings, applyUserPrefs);

    // Must check and set final global.locale before callBatchThenCache.
    let locale = Prefs.getCharPref('global.locale');
    if (!locale || !C.Locales.some((x) => x[0] === locale)) {
      locale =
        langcode && C.Locales.some((x) => x[0] === langcode) ? langcode : 'en';
      Prefs.setCharPref('global.locale', locale);
    }
    const fallback = C.FallbackLanguage[locale];
    Prefs.setCharPref('global.fallbackLocale', fallback);

    // Determine the number of panels to show initially. If runtime is narrow
    // screen and server settings show a single text, reduce the initial
    // number of panels to 1.
    let maxPanels = Math.ceil(window.innerWidth / 300);
    if (maxPanels < 2) maxPanels = 2;
    else if (maxPanels > 6) maxPanels = 6;
    (window as BibleBrowserControllerGlobal).browserMaxPanels = maxPanels;
    const panels = Prefs.getComplexValue(
      'xulsword.panels',
    ) as typeof S.prefs.xulsword.panels;
    const forceSinglePanel =
      window.innerWidth <= C.UI.WebApp.mobileW &&
      panels.length > 1 &&
      [...new Set(panels)].filter(Boolean).length === 1;
    let numPanels = forceSinglePanel ? 1 : panels.length;
    if (numPanels > maxPanels) numPanels = maxPanels;

    cachePreload(locale, fallback)
      .then(() => {
        setDefaultBibleBrowserPrefs(Prefs);
        setGlobalPanels(Prefs, numPanels);
        validateModulePrefs();

        // Now cancel the Tarapro page loader overlay.
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
      })
      .catch((er) => log.error(er));
  }
});
