import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import socketConnect from '../preload.ts';
import { randomID, setGlobalPanels } from '../../../common.ts';
import { G } from '../../G.ts';
import log from '../../log.ts';
import { callBatchThenCache } from '../../renderPromise.ts';
import DynamicStyleSheet from '../../style.ts';
import {
  writeSettingsToPrefsStores,
  setGlobalLocale,
  getComponentSettings,
  getReactComponents,
} from '../common.ts';
import BibleBrowserController, {
  BibleBrowserControllerGlobal,
} from './controller.tsx';
import defaultSettings, {
  BibleBrowserSettings,
  setEmptySettings,
} from './defaultSettings.ts';

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
      ]);
      setEmptySettings(settings);
      setGlobalPanels(settings, numPanels);

      writeSettingsToPrefsStores(settings);
      if (window.innerWidth < 500)
        G.Prefs.setBoolPref('xulsword.showChooser', false);

      const dynamicStyleSheet = new DynamicStyleSheet(document);

      createRoot(bibleBrowserComp).render(
        <StrictMode>
          <BibleBrowserController
            locale={locale}
            renderKey={randomID()}
            dynamicStyleSheet={dynamicStyleSheet}
          />
        </StrictMode>,
      );
    }
  })().catch((er) => {
    log.error(er);
  });
});
