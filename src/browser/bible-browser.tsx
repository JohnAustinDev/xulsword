import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { decodeJSData, saveToPrefs, setGlobalLocale } from "./bcommon.ts";
import { randomID } from "../common.ts";
import C from "../constant.ts";
import G from "../renderer/rg.ts";
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import Xulsword from "../renderer/components/xulsword/xulsword.tsx";

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../renderer/global-htm.css';

import type { GCallType, PrefObject, PrefRoot } from "../type.ts";

// React element controller:
function Controller(
  props: {
    id: string;
    xsprops: Xulsword['props'];
    locale?: string;
  }
) {
  const { id, xsprops, locale } = props;
  const [state, _setState] = useState(xsprops);

  const html =
    document.getElementsByTagName('html')[0] as HTMLHtmlElement | undefined;
  if (html) {
    html.classList.add('skin', 'xulswordWin', 'cs-locale', locale || '');
    html.setAttribute(
      'dir',
      C.Locales.reduce((p, c) => c[0] === locale ? c[2] : p, 'ltr')
    );
  }

  // Wheel scroll is wonky in the Browser, so disable it for now.
  const wheelCapture = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    return true;
  };

  return (
    <div id="root">
      <div id="reset">
        <Xulsword onWheelCapture={wheelCapture} id={id} {...state} />
      </div>
    </div>
  );
}

const bibleBrowser = document
  .getElementsByClassName('bible-browser')[0] as HTMLDivElement | undefined;

if (bibleBrowser) {
  const socket = SocketConnect(C.Server.port, bibleBrowser.dataset.origin);
  let published = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only publish this once.
    if (!published && bibleBrowser) {
      published = true;
      const { props: propsraw, prefs: prefsraw, langcode } = bibleBrowser.dataset;
      const props = decodeJSData(propsraw) as PrefObject;
      const prefs = decodeJSData(prefsraw) as Partial<PrefRoot>;
      const locale = setGlobalLocale(prefs, langcode);
      saveToPrefs(G, prefs);

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
        ['ProgramConfig', null, undefined],
        ['FeatureModules', null, undefined],
        ['AudioConfs', null, undefined],
        ['Config', null, undefined],
        ['Books', null, [locale]],
        ['Book', null, [locale]],
      ];

      callBatchThenCache(preloads).then(() => {
          bibleBrowser.removeAttribute('data-props');
          bibleBrowser.removeAttribute('data-prefs');
          createRoot(bibleBrowser).render(
            <StrictMode>
              <Controller
                id={randomID()}
                xsprops={props}
                locale={locale}
              />
            </StrictMode>);
      });
    }
  });
}
