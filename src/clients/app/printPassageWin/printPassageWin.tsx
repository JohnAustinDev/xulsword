import React from 'react';
import renderToRoot, { PrintOptionsType } from '../../controller.tsx';
import log from '../../log.ts';
import { setStatePref, windowArguments } from '../../common.tsx';
import PrintPassage from '../../components/printPassage/printPassage.tsx';

import type { PrintPassageState } from '../../components/printPassage/printPassage.tsx';

const openedWinState = windowArguments(
  'passageWinState',
) as Partial<PrintPassageState> | null;

if (openedWinState) {
  setStatePref('prefs', 'printPassage', null, openedWinState);
}

const print: PrintOptionsType = { pageable: true, dialogEnd: 'close' };

renderToRoot(<PrintPassage />, { print }).catch((er) => {
  log.error(er);
});
