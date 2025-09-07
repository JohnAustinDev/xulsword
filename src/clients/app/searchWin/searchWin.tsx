import React from 'react';
import { noAutoSearchIndex } from '../../../common.ts';
import { GE as G } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import log from '../../log.ts';
import Search from '../../components/search/search.tsx';
import { Indexing } from '../../components/search/searchH.tsx';
import { windowArguments } from '../../common.tsx';
import './searchWin.css';

import type { SearchType } from '../../../type.ts';

export const searchArg = windowArguments('search') as SearchType;

export const descriptor = windowArguments();

renderToRoot(<Search initialState={searchArg} descriptor={descriptor} />, {
  resetOnResize: false,
  onunload: () => {
    if (Indexing.current) {
      G.LibSword.searchIndexCancel(Indexing.current, descriptor.id);
      noAutoSearchIndex(G.Prefs, Indexing.current);
    }
  },
}).catch((er) => {
  log.error(er);
});
