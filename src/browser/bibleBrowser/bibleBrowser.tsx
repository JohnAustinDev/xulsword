import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SocketConnect from '../../server/preload.ts';
import { randomID, setGlobalPanels } from '../../common.ts';
import G from '../../renderer/rg.ts';
import log from '../../renderer/log.ts';
import { callBatchThenCache } from '../../renderer/renderPromise.ts';
import DynamicStyleSheet from '../../renderer/style.ts';
import {
  writePrefsStores,
  setGlobalLocale,
  getComponentSettings,
  getReactComponents,
  BibleBrowserData,
} from '../bcommon.ts';
import BibleBrowserController, {
  BibleBrowserControllerGlobal,
} from './controller.tsx';
import defaultSettings from './defaultSettings.ts';

import type { GCallType } from '../../type.ts';

const socket = SocketConnect(
  Number(process.env.WEBAPP_PORT),
  window.location.origin,
);
let initialized = false;
// connect is called even on reconnect, so only initialize once.
socket.on('connect', () => {
  const bibleBrowserComps = getReactComponents(document).filter(
    (x) => x.dataset.reactComponent === 'bible-browser',
  );
  if (bibleBrowserComps.length > 1)
    log.error('Only one Browser Bible component per document is supported.');
  else if (!initialized) {
    const [bibleBrowserComp] = bibleBrowserComps;
    const { prefs, langcode } = getComponentSettings(
      bibleBrowserComp,
      defaultSettings,
    ) as BibleBrowserData;
    (window as BibleBrowserControllerGlobal).browserMaxPanels = Math.ceil(
      window.innerWidth / 300,
    );
    let numPanels: number =
      (prefs.prefs?.xulsword as any)?.panels?.length ||
      (window as BibleBrowserControllerGlobal).browserMaxPanels;
    if (window.innerWidth < 800) numPanels = 1;
    setGlobalPanels(prefs, numPanels);
    const locale = setGlobalLocale(prefs, langcode);
    writePrefsStores(G, prefs);
    if (window.innerWidth < 500)
      G.Prefs.setBoolPref('xulsword.showChooser', false);

    const preloads: GCallType[] = [
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
    ];

    callBatchThenCache(preloads)
      .then(() => {
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
      })
      .catch((er) => {
        log.error(er);
      });
  }
  initialized = true;
});
