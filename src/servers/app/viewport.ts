import Viewport from '../../viewport.ts';
import Prefs from './prefs.ts';
import { G  } from './G.ts';

import type { GIType } from '../../type.ts';

const GI: Pick<GIType, 'getBooksInVKModule'> = {
  getBooksInVKModule: (_default, _renderPromise, module) => {
    return G.getBooksInVKModule(module);
  },
};

export default new Viewport(G, GI, Prefs);
