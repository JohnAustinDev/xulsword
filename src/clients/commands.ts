import commands from '../commands.ts';
import { G } from './G.ts';
import CookiePrefs from './webapp/prefs.ts';

export default new commands(G, Build.isElectronApp ? G.Prefs : CookiePrefs);
