import SocketConnect from './preload.ts';
import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { cachePreload, decodeJSData } from "./bcommon.ts";
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import Subscription from '../subscription.ts';
import Xulsword, { XulswordProps } from "../renderer/xulswordWin/xulsword.tsx";
import { randomID, setCookie } from "../common.ts";

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
  ['getLocalizedBooks', null, []],
  ['i18n', 'exists', ['chooserBookGroup_ot']],
  ['i18n', 'exists', ['chooserBookGroup_nt']],
  ...(Object.values(C.SupportedTabTypes)
    .map((type) => ['i18n', 't', [type]] as any)),
  ...localePreload.map((x) => ['i18n', 't', x]),
];

// React element controller:
function Controller(
  props: {
    id: string;
    initial: Partial<XulswordProps>;
    defprefs: PrefObject;
  }
) {
  const { id, initial, defprefs } = props;
  const [state, setState] = useState(initial);

  setCookie('prefs_default', {
    ...S.prefs.xulsword,
    ...defprefs
  }, 30);

  return <Xulsword id={id} {...state} />;
}

// Each SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the parent div has a valid data-chaplist
// attribute value. In that case the SelectVK will become a controlled
// component where only chapters listed in data-chaplist will be available
// for selection.
Subscription.subscribe.socketConnected((_socket) => {
  cachePreload(preloads).then(() => {
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
