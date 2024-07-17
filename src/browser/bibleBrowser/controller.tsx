import React, { useState } from 'react';
import C from '../../constant.ts';
import Xulsword from '../../renderer/components/xulsword/xulsword.tsx';
import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../renderer/global-htm.css';
import './bibleBrowser.css';

import type DynamicStyleSheet from '../../renderer/style.ts';

export type BibleBrowserControllerState = { locale: string; renderKey: string };

export type BibleBrowserControllerProps = BibleBrowserControllerState & {
  dynamicStyleSheet: DynamicStyleSheet;
};

export default function BibleBrowserController(
  props: BibleBrowserControllerProps,
): React.JSX.Element {
  const { locale, renderKey, dynamicStyleSheet } = props;
  const [state, setState] = useState({ locale, renderKey });

  window.setBibleBrowserState = setState;

  const html = document.getElementsByTagName('html')[0] as
    | HTMLHtmlElement
    | undefined;
  if (html) {
    html.classList.add('skin', 'xulswordWin', 'cs-locale', locale ?? '');
    html.setAttribute(
      'dir',
      C.Locales.reduce((p, c) => (c[0] === locale ? c[2] : p), 'ltr'),
    );
  }

  dynamicStyleSheet.update();

  // Wheel scroll is wonky in the Browser, so disable it for now.
  const wheelCapture = (e: React.SyntheticEvent<any>): boolean => {
    e.stopPropagation();
    return true;
  };

  // Cancel Tarapro page loader overlay.
  setTimeout(() => {
    const win = frameElement?.ownerDocument.defaultView;
    if (win && 'jQuery' in win) {
      (win as any).bibleBrowserIsLoading = false;
      (win as any).jQuery('.loader').fadeOut('slow');
    }
  }, 1);

  // id=reset is expected by global-html.css
  return (
    <div id="reset">
      <Xulsword onWheelCapture={wheelCapture} {...state} />
    </div>
  );
}
