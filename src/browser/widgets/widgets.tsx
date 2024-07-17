import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SocketConnect from '../../server/preload.ts';
import {
  createNodeList,
  setGlobalLocale,
  writePrefsStores,
  componentData,
  reactComponents,
} from './../bcommon.ts';
import C from '../../constant.ts';
import G from '../../renderer/rg.ts';
import log from '../../renderer/log.ts';
import { callBatchThenCache } from '../../renderer/renderPromise.ts';
import type { GCallType, PrefRoot } from '../../type.ts';
import type { ComponentData } from './../bcommon.ts';

import WidgetVK from './widgetVK.tsx';
import WidgetOR from './widgetOR.tsx';
import ControllerOptions from './widgetMenulist.tsx';

const socket = SocketConnect(C.Server.port);

const widgets = reactComponents(document).filter((c) =>
  ['selectOR', 'selectVK', 'selectMenulist'].includes(
    c.dataset.reactComponent || '',
  ),
);
if (widgets.length) {
  let published = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only publish this once.
    if (!published) {
      published = true;

      let langcode = 'en';
      const data = componentData(widgets[0]);
      if (data && langcode in data) ({ langcode } = data);
      const prefs: Partial<PrefRoot> = {};
      const locale = setGlobalLocale(prefs, langcode);
      writePrefsStores(G, prefs);

      const preloads: GCallType[] = [
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
      ];

      callBatchThenCache(preloads)
        .then(() => {
          widgets.forEach((widget) => {
            const { id: compid } = widget;
            const compData = componentData(widget) as ComponentData;
            const { component } = compData;
            switch (component) {
              case 'selectVK': {
                const { action, data, props } = compData;
                createRoot(widget).render(
                  <StrictMode>
                    <WidgetVK
                      compid={compid}
                      action={action}
                      chaplist={data}
                      initial={props}
                    />
                  </StrictMode>,
                );
                break;
              }
              case 'selectOR': {
                const { action, data, props } = compData;
                data.forEach((x) => {
                  x[0] = x[0].toString();
                });
                if (Array.isArray(data)) {
                  createNodeList(data, props);
                }
                createRoot(widget).render(
                  <StrictMode>
                    <WidgetOR
                      compid={compid}
                      action={action}
                      chaplist={data}
                      initial={props}
                    />
                  </StrictMode>,
                );
                break;
              }
              case 'selectMenulist': {
                const { action, data, props } = compData;
                createRoot(widget).render(
                  <StrictMode>
                    <ControllerOptions
                      compid={compid}
                      action={action}
                      data={data}
                      initial={props}
                    />
                  </StrictMode>,
                );
                break;
              }
              default:
                log.error(`Unknown widget type '${component}'`);
            }
            widget.removeAttribute('data-props');
            widget.removeAttribute('data-chaplist');
          });
        })
        .catch((er) => {
          log.error(er);
        });
    }
  });
}
