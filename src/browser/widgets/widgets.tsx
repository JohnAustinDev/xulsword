import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SocketConnect from '../../server/preload.ts';
import {
  setGlobalLocale,
  writePrefsStores,
  getComponentSettings,
  getReactComponents,
} from './../bcommon.ts';
import C from '../../constant.ts';
import G from '../../renderer/rg.ts';
import log from '../../renderer/log.ts';
import { callBatchThenCache } from '../../renderer/renderPromise.ts';
import WidgetVK from './widgetVK.tsx';
import WidgetOR from './widgetOR.tsx';
import ControllerOptions from './widgetMenulist.tsx';
import defaultSettings from './defaultSettings.ts';

import type { PrefRoot } from '../../type.ts';
import type { ComponentSettings } from './../bcommon.ts';

const socket = SocketConnect(
  Number(process.env.WEBAPP_PORT),
  window.location.origin,
);

const widgets = getReactComponents(document).filter((c) =>
  ['selectOR', 'selectVK', 'selectMenulist'].includes(
    c.dataset.reactComponent || '',
  ),
);
if (widgets.length) {
  let initialized = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only init widgets once.
    if (!initialized) {
      initialized = true;

      let langcode = 'en';
      const settings = getComponentSettings(widgets[0], defaultSettings);
      if (settings && langcode in settings) ({ langcode } = settings);
      const prefs: Partial<PrefRoot> = {};
      const locale = setGlobalLocale(prefs, langcode);
      writePrefsStores(G, prefs);

      callBatchThenCache([
        ['Tab', null, undefined],
        ['Tabs', null, undefined],
        ['BkChsInV11n', null, undefined],
        ['GetBooksInVKModules', null, undefined],
        ['getLocaleDigits', null, [true]],
        ['getLocalizedBooks', null, [true]],
        ['Book', null, [locale]],
        ['i18n', 't', ['locale_direction']],
        ['i18n', 't', ['Full publication']],
        ...Object.values(C.SupportedTabTypes).map(
          (type) => ['i18n', 't', [type, { lng: locale }]] as any,
        ),
      ])
        .then(() => {
          widgets.forEach((widget) => {
            const { id: compid } = widget;
            const settings = getComponentSettings(
              widget,
              defaultSettings,
            ) as ComponentSettings;
            const { component } = settings;
            switch (component) {
              case 'selectVK': {
                createRoot(widget).render(
                  <StrictMode>
                    <WidgetVK compid={compid} settings={settings} />
                  </StrictMode>,
                );
                break;
              }
              case 'selectOR': {
                createRoot(widget).render(
                  <StrictMode>
                    <WidgetOR compid={compid} settings={settings} />
                  </StrictMode>,
                );
                break;
              }
              case 'selectMenulist': {
                createRoot(widget).render(
                  <StrictMode>
                    <ControllerOptions compid={compid} settings={settings} />
                  </StrictMode>,
                );
                break;
              }
              default:
                log.error(`Unknown widget type '${component}'`);
            }
          });
        })
        .catch((er) => {
          log.error(er);
        });
    }
  });
}
