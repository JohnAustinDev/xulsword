import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import socketConnect from '../preload.ts';
import {
  setGlobalLocale,
  writeSettingsToPrefsStores,
  getComponentSettings,
  getReactComponents,
} from '../common.ts';
import C from '../../../constant.ts';
import log from '../../log.ts';
import { callBatchThenCache } from '../../renderPromise.ts';
import WidgetVK from './widgetVK.tsx';
import WidgetOR from './widgetOR.tsx';
import WidgetMenulist from './widgetMenulist.tsx';
import defaultSettings from './defaultSettings.ts';

import type { PrefRoot } from '../../../type.ts';
import type { ComponentData } from '../common.ts';

const socket = socketConnect(
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
      if (settings?.langcode) ({ langcode } = settings);
      const prefs: Partial<PrefRoot> = {};
      const locale = setGlobalLocale(prefs, langcode);
      writeSettingsToPrefsStores(prefs);

      callBatchThenCache([
        ['getLocalizedBooks', null, [[locale]]],
        ['Tabs', null, undefined],
        ['Books', null, [locale]],
        ['getLocaleDigits', null, [locale]],
        ['i18n', 't', ['locale_direction', { lng: locale }]],
        ['i18n', 't', ['Full publication', { lng: locale }]],
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
            ) as ComponentData;
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
                    <WidgetMenulist compid={compid} settings={settings} />
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
