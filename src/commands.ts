import { keep } from './common.ts';
import C from './constant.ts';
import Viewport from './viewport.ts';

import type S from './defaultPrefs.ts';
import type PrefsElectron from './servers/app/prefs.ts';
import type PrefsBrowser from './clients/webapp/prefs.ts';
import type {
  GAddCaller,
  GenBookAudioFile,
  GType,
  LocationORType,
  LocationVKCommType,
  LocationVKType,
  ScrollType,
  VerseKeyAudioFile,
} from './type.ts';
import { PanelChangeOptions } from './viewport.ts';

// This file contains global commands that are implemented for all clients and servers.

export default class Commands {
  #Prefs;

  // Prefs2 requires the calling window argument so that window -2 may be
  // passed. The value -2 means the Pref changes should be pushed to all
  // windows and the main process (in Electron apps).
  #Prefs2;

  #G;

  #Viewport;

  constructor(
    // These web app G calls must be cache preloaded.
    G: Pick<GType, 'Tab' | 'Tabs' | 'GetBooksInVKModules'>,
    prefs: typeof PrefsElectron | typeof PrefsBrowser,
  ) {
    this.#G = G;
    this.#Prefs = prefs;
    this.#Prefs2 = prefs as GAddCaller['Prefs'];
    this.#Viewport = new Viewport(G, prefs);
  }

  goToLocationGB(
    location: LocationORType,
    scroll?: ScrollType | undefined,
  ): void {
    if (location.otherMod in this.#G.Tab) {
      const xulsword: Partial<typeof S.prefs.xulsword> = this.setXulswordPanels(
        {
          whichModuleOrLocGB: location,
          skipCallbacks: true,
          clearRendererCaches: false,
        },
      );
      xulsword.scroll = scroll || { verseAt: 'center' };
      this.#Prefs2.mergeValue('xulsword', xulsword, 'prefs', false, false, -2);
    } // else shell.beep();
  }

  // If SelectVKMType (which includes vkMod) is passed, and vkMod is not a Bible (is
  // a commentary) then the main viewport will be updated to show that module in a
  // panel, unless it is already showing.
  goToLocationVK(
    newlocation: LocationVKType | LocationVKCommType,
    newselection?: LocationVKType | LocationVKCommType,
    newscroll?: ScrollType,
  ): void {
    const vkMod =
      ('commMod' in newlocation && newlocation.commMod) || newlocation.vkMod;
    if (!vkMod || vkMod in this.#G.Tab) {
      let xulsword: Partial<typeof S.prefs.xulsword> = {};
      if (vkMod) {
        xulsword = this.setXulswordPanels({
          whichModuleOrLocGB: vkMod,
          skipCallbacks: true,
          clearRendererCaches: false,
        });
      }
      xulsword.location = newlocation;
      xulsword.selection = newselection || null;
      xulsword.scroll = newscroll || { verseAt: 'center' };
      this.#Prefs2.mergeValue('xulsword', xulsword, 'prefs', false, false, -2);
    } // else shell.beep();
  }

  // Update xulsword state prefs to modify viewport panels. The only state
  // props returned are those potentially, but not necessarily, modified
  // in the process.
  setXulswordPanels(
    options: Partial<PanelChangeOptions> & {
      skipCallbacks?: boolean;
      clearRendererCaches?: boolean;
    },
  ): Pick<
    typeof S.prefs.xulsword,
    'panels' | 'mtModules' | 'tabs' | 'keys' | 'isPinned' | 'location'
  > {
    const { skipCallbacks, clearRendererCaches } = {
      skipCallbacks: false, // default: run callbacks
      clearRendererCaches: true, // default: reset renderer caches
      ...options,
    };

    const xulsword = this.#Prefs.getComplexValue(
      'xulsword',
    ) as typeof S.prefs.xulsword;
    this.#Viewport.getPanelChange(options, xulsword);
    const result = keep(xulsword, [
      'panels',
      'mtModules',
      'tabs',
      'keys',
      'isPinned',
      'location',
    ]);

    // Save the results to Prefs.
    this.#Prefs.mergeValue(
      'xulsword',
      result,
      'prefs',
      skipCallbacks,
      clearRendererCaches,
    );

    return result;
  }

  playAudio(audio: VerseKeyAudioFile | GenBookAudioFile | null) {
    let xulsword: Partial<typeof S.prefs.xulsword> | undefined;
    if (audio) {
      if (
        'book' in audio &&
        Object.values(C.SupportedBooks).some((bg: any) =>
          bg.includes(audio.book),
        )
      ) {
        const { book, chapter, swordModule } = audio;
        this.goToLocationVK({
          book,
          chapter: chapter || 1,
          verse: 1,
          v11n: (swordModule && this.#G.Tab[swordModule].v11n) || null,
        });
      } else if ('key' in audio) {
        const { key, swordModule } = audio;
        if (swordModule) {
          this.goToLocationGB({
            otherMod: swordModule,
            key,
          });
        }
      }
      xulsword = {
        audio: {
          open: true,
          file: audio,
        },
      };
    } else {
      xulsword = {
        audio: { open: false, file: null },
      };
    }
    this.#Prefs2.mergeValue(
      'xulsword',
      xulsword,
      'prefs',
      undefined,
      false,
      -2,
    );
  }
}
