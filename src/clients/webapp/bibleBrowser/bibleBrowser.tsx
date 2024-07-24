import React from 'react';
import { setGlobalPanels } from '../../../common.ts';
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
      (window as BibleBrowserControllerGlobal).browserMaxPanels = Math.ceil(
        window.innerWidth / 300,
      );
      let numPanels: number =
        (settings.prefs?.xulsword as any)?.panels?.length ||
        (window as BibleBrowserControllerGlobal).browserMaxPanels;
      if (window.innerWidth < 800) numPanels = 1;
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
        ['getLocalizedBooks', null, [true]],
        ['getLocaleDigits', null, []],
        ['ModuleConfigDefault', null, undefined],
        ['ModuleFonts', null, undefined],
        ['ProgramConfig', null, undefined],
        ['LocaleConfigs', null, undefined],
        ['Config', null, undefined],
        ['FeatureModules', null, undefined],
        ['AudioConfs', null, undefined],
        ['Books', null, [locale]],
        ['Book', null, [locale]],
        ['i18n', 't', ['locale_direction']],
      ]);
      setEmptySettings(settings);
      setGlobalPanels(settings, numPanels);

      // Update Prefs with final settings.
      writeSettingsToPrefsStores(settings);
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

      renderToRoot(<Xulsword onWheelCapture={wheelCapture} />).catch((er) => {
        log.error(er);
      });
    }
  })().catch((er) => {
    log.error(er);
  });
});
