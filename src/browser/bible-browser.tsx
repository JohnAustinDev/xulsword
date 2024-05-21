import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { decodeJSData } from "./bcommon.ts";
import { randomID } from "../common.ts";
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import G from "../renderer/rg.ts";
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import Xulsword, { XulswordProps } from "../renderer/xulswordWin/xulsword.tsx";

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../renderer/global-htm.css';

import type { GCallType, PrefObject } from "../type.ts";

const preloads: GCallType[] = [
  ['Books', null, undefined],
  ['Book', null, undefined],
  ['Tabs', null, undefined],
  ['Tab', null, undefined],
  ['BkChsInV11n', null, undefined],
  ['GetBooksInVKModules', null, undefined],
  ['getLocaleDigits', null, [false]],
  ['getLocaleDigits', null, [true]],
  ['getLocalizedBooks', null, []],
  ['getLocalizedBooks', null, [true]],
  ['getLocaleDigits', null, []],
  ['getLocalizedBooks', null, [false]],
  ['ModuleConfigDefault', null, undefined],
  ['ProgramConfig', null, undefined],
  ['FeatureModules', null, undefined],
  ['AudioConfs', null, undefined],
  ['Config', null, undefined],
];

// React element controller:
function Controller(
  props: {
    id: string;
    xsprops: Xulsword['props'];
    defprefs: PrefObject;
    locale: string;
    dir: string;
  }
) {
  const { id, xsprops, locale, dir } = props;
  const [state, _setState] = useState(xsprops);

  const html =
    document.getElementsByTagName('html')[0] as HTMLHtmlElement | undefined;
  if (html) {
    html.classList.add('skin', 'xulswordWin', 'cs-locale', locale);
    html.setAttribute('dir', dir);
  }

  return (
    <div id="root">
      <div id="reset">
        <Xulsword id={id} {...state} />
      </div>
    </div>
  );
}

const bibleBrowser = document
  .getElementsByClassName('bible-browser')[0] as HTMLDivElement | undefined;

if (bibleBrowser) {
  const socket = SocketConnect(bibleBrowser.dataset.origin);
  let published = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only publish this once.
    if (!published && bibleBrowser) {
      published = true;
      const { defprefs: dp, locale } = bibleBrowser.dataset;
      if (dp) {
        const defprefs = decodeJSData(dp) as PrefObject;
        G.Prefs.setComplexValue('global', {
          ...S.prefs.global,
          locale,
        }, 'prefs_default' as 'prefs');
        G.Prefs.setComplexValue('xulsword', {
          ...S.prefs.xulsword,
          ...defprefs
        }, 'prefs_default' as 'prefs');
      }

      callBatchThenCache(preloads).then((success) => {
        if (success) {
          const id = randomID();
          bibleBrowser.setAttribute('id', id);
          const { props, defprefs: dp, locale, dir } = bibleBrowser.dataset;
          if (props && dp) {
            const initial = decodeJSData(props) as XulswordProps;
            const defprefs = decodeJSData(dp) as PrefObject;
            createRoot(bibleBrowser).render(
              <StrictMode>
                <Controller
                  id={id}
                  defprefs={defprefs}
                  xsprops={initial}
                  locale={locale || 'en'}
                  dir={dir || 'ltr'} />
              </StrictMode>);
          }
          bibleBrowser.removeAttribute('data-props');
          bibleBrowser.removeAttribute('data-defprefs');
        }
      });
    }
  });
}
