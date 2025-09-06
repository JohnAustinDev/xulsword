import commands from '../commands.ts';
import { doUntilDone } from './common.tsx';
import { G, GI } from './G.ts';
import CookiePrefs from './webapp/prefs.ts';

export default new commands(
  G,
  GI,
  Build.isElectronApp ? G.Prefs : CookiePrefs,
  doUntilDone,
);
