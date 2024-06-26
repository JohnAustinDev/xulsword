import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { decodeJSData, writePrefsStores, setGlobalLocale } from "./bcommon.ts";
import { randomID, setGlobalPanels } from "../common.ts";
import C from "../constant.ts";
import G from "../renderer/rg.ts";
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import DynamicStyleSheet from '../renderer/style.ts';
import Xulsword from "../renderer/components/xulsword/xulsword.tsx";

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../renderer/global-htm.css';
import './bible-browser.css';

import type { GCallType, PrefObject, PrefRoot } from "../type.ts";

let dynamicStyleSheet: DynamicStyleSheet | undefined;

export type BrowserProps = {
  id: string;
  xsprops: Xulsword['props'];
  locale?: string;
  key?: string;
};

// React element controller:
function Controller(props: BrowserProps) {
  const { id, xsprops, locale } = props;
  const [state, setState] = useState(xsprops);

  window.browserState = setState;

  const html =
    document.getElementsByTagName('html')[0] as HTMLHtmlElement | undefined;
  if (html) {
    html.classList.add('skin', 'xulswordWin', 'cs-locale', locale || '');
    html.setAttribute(
      'dir',
      C.Locales.reduce((p, c) => c[0] === locale ? c[2] : p, 'ltr')
    );
  }

  dynamicStyleSheet?.update();

  // Wheel scroll is wonky in the Browser, so disable it for now.
  const wheelCapture = (e: React.SyntheticEvent<any>) => {
    e.stopPropagation();
    return true;
  };

  // Cancel Tarapro page loader overlay.
  setTimeout(() => {
    const win = frameElement?.ownerDocument.defaultView;
    if (win && 'jQuery' in win) {
      (win as any).bibleBrowserIsLoading = false;
      (win as any).jQuery(".loader").fadeOut( 'slow' );
    }
  }, 1);

  return (
    <div id="reset">
      <Xulsword onWheelCapture={wheelCapture} id={id} {...state} />
    </div>
  );
}

const socket = SocketConnect(C.Server.port, window.location.origin);
let published = false;
socket.on('connect', () => {
  const root = document.querySelector('#root');
  const { dataset } = frameElement as HTMLIFrameElement;

  // connect is called even on reconnect, so only publish this once.
  if (!published && root && dataset) {
    published = true;
    const { props: propsraw, prefs: prefsraw, langcode } = dataset;
    const props = decodeJSData(propsraw) as PrefObject;
    const prefs = decodeJSData(prefsraw) as Partial<PrefRoot>;
    window.browserMaxPanels = Math.ceil(window.innerWidth / 300);
    let numPanels = (prefs.prefs?.xulsword as any)?.panels?.length
      || window.browserMaxPanels;
    if (window.innerWidth < 800) numPanels = 1;
    setGlobalPanels(prefs, numPanels);
    const locale = setGlobalLocale(prefs, langcode);
    writePrefsStores(G, prefs);
    if (window.innerWidth < 500) G.Prefs.setBoolPref('xulsword.showChooser', false);

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

    callBatchThenCache(preloads).then(() => {
        dynamicStyleSheet = new DynamicStyleSheet(document);
        createRoot(root).render(
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
