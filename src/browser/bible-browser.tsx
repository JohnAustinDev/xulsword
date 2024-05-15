import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { decodeJSData } from "./bcommon.ts";
import { randomID } from "../common.ts";
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import G, { GA } from "../renderer/rg.ts";
import Subscription from '../subscription.ts';
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import Xulsword, { XulswordProps } from "../renderer/xulswordWin/xulsword.tsx";

import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
// import '@blueprintjs/core/lib/css/blueprint.css';
import '../renderer/global-htm.css';

import type { GCallType, PrefObject } from "../type.ts";

const localePreload = [
  ['history.back.tooltip'],
  ['back.label'],
  ['history.all.tooltip'],
  ['history.forward.tooltip'],
  ['history.forward.label'],
  ['close.label'],
  ['searchbox.tooltip'],
  ['search.tooltip'],
  ['menu.search'],
  ['headingsButton.tooltip'],
  ['dictButton.tooltip'],
  ['notesButton.tooltip'],
  ['crossrefsButton.tooltip'],
  ['ORIGLabelTab'],
  ['chooserBookGroup_ot'],
  ['chooserBookGroup_nt'],
  ['PrevChaptext'],
  ['NextChaptext'],
  ['install.label'],
  ['module-required.message'],
  ['close'],
];

const preloads: GCallType[] = [
  ['i18n', 'language'],
  ['Book', null],
  ['Tab', null],
  ['Tabs', null],
  ['BkChsInV11n', null],
  ['GetBooksInVKModules', null],
  ['getLocaleDigits', null, [false]],
  ['getLocalizedBooks', null, [false]],
  ['i18n','t', ['locale_direction']],
  ['Books', null],
  ['ModuleConfigDefault', null],
  ['ProgramConfig', null],
  ['getLocaleDigits', null, []],
  ['getLocaleDigits', null, [true]],
  ['getLocalizedBooks', null, []],
  ['getLocalizedBooks', null, [true]],
  ['FeatureModules', null],
  ['AudioConfs', null],
  ['Config', null],
  ['i18n', 'exists', ['chooserBookGroup_ot']],
  ['i18n', 'exists', ['chooserBookGroup_nt']],
  ...(Object.values(C.SupportedTabTypes)
    .map((type) => ['i18n', 't', [type]] as any)),
  ...localePreload.map((x) => ['i18n', 't', x]),
];

// Top React element controller:
function Controller(
  props: {
    id: string;
    initial: Partial<XulswordProps>;
    defprefs: PrefObject;
  }
) {
  const { id, initial, defprefs } = props;
  const [state, _setState] = useState(initial);
  const $lang = 'en'; // TODO!: <---
  const $dir = 'ltr'; // TODO!: <---

  G.Prefs.setComplexValue('xulsword', {
    ...S.prefs.xulsword,
    ...defprefs
  }, 'prefs_default' as 'prefs');

  const html =
    document.getElementsByTagName('html')[0] as HTMLHtmlElement | undefined;
  if (html) {
    html.classList.add('skin', 'xulswordWin', 'cs-locale', $lang);
    html.setAttribute('dir', $dir);
  }

  return (
    <div id="root">
      <div id="reset">
        <Xulsword id={id} {...state} />
      </div>
    </div>
  );
}

// Each SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the parent div has a valid data-chaplist
// attribute value. In that case the SelectVK will become a controlled
// component where only chapters listed in data-chaplist will be available
// for selection.
Subscription.subscribe.socketConnected((_socket) => {
  callBatchThenCache(GA, preloads).then(() => {
    if (bibleBrowser) {
      const id = randomID();
      bibleBrowser.setAttribute('id', id);
      const { props, defprefs: dp } = bibleBrowser.dataset;
      if (props && dp) {
        const initial = decodeJSData(props) as XulswordProps;
        const defprefs = decodeJSData(dp) as PrefObject;
        createRoot(bibleBrowser).render(
          <StrictMode>
            <Controller
              id={id}
              defprefs={defprefs}
              initial={initial} />
          </StrictMode>);
      }
      bibleBrowser.removeAttribute('data-props');
      bibleBrowser.removeAttribute('data-defprefs');
    }
  });
});

const bibleBrowser = document
  .getElementsByClassName('bible-browser')[0] as HTMLDivElement | undefined;
if (bibleBrowser) {
  const socket = SocketConnect(bibleBrowser.dataset.origin);
  let published = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only publish this once.
    if (socket && !published) Subscription.publish.socketConnected(socket);
    published = true;
  });
}
