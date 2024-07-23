import Cache from '../../cache.ts';
import Viewport from '../../viewport.ts';
import Prefs from './prefs.ts';
import { G } from '../G.ts';

const vp = new Viewport(G, Prefs);
Cache.write(vp, 'WebappViewport'); // remove cycle with rg.ts
export default vp;
