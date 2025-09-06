import RenderPromise from './clients/renderPromise.ts';
import { PanelChangeOptions } from './viewport.ts';
import { keep } from './common.ts';
import C from './constant.ts';
import Viewport from './viewport.ts';

import type S from './defaultPrefs.ts';
import type PrefsElectron from './servers/app/prefs.ts';
import type PrefsBrowser from './clients/webapp/prefs.ts';
import type { doUntilDone as DoUntilDone } from './clients/common.tsx';
import type {
  GAddWindowId,
  GIType,
  GType,
  LocationORType,
  LocationVKCommType,
  LocationVKType,
  ScrollType,
  AudioPrefType,
} from './type.ts';

// This file contains global commands that are implemented for all clients and servers.
export default class Commands {
  #Prefs;

  // Prefs2 requires the calling window argument so that window -2 may be
  // passed. The value -2 means the Pref changes should be pushed to all
  // windows and the main process (in Electron apps).
  #Prefs2;

  #G;

  #Viewport;

  #doUntilDone: typeof DoUntilDone;

  constructor(
    // These web app G calls must be cache preloaded.
    G: Pick<GType, 'Tab' | 'Tabs' | 'Books' | 'i18n'>,
    GI: Pick<GIType, 'getBooksInVKModule'>,
    prefs: typeof PrefsElectron | typeof PrefsBrowser,
    doUntilDone?: typeof DoUntilDone,
  ) {
    this.#G = G;
    this.#Prefs = prefs;
    this.#Prefs2 = prefs as GAddWindowId['Prefs'];
    this.#Viewport = new Viewport(G, GI, prefs, undefined); // this Viewport's usage must not use Window
    this.#doUntilDone = doUntilDone || ((func) => func(null));
  }

  async goToLocationGB(
    location: LocationORType,
    scroll?: ScrollType | undefined,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (location.otherMod in this.#G.Tab) {
        // Genbk keys in xulsword should not start with slash, but libxulsword
        // returns keys starting with slash. So remove it if it exists.
        const { key } = location;
        if (key.startsWith(C.GBKSEP)) location.key = key.substring(1);
        this.#doUntilDone((renderPromise) => {
          const xulsword: Partial<typeof S.prefs.xulsword> =
            this.setXulswordPanels(
              {
                whichModuleOrLocGB: location,
                skipCallbacks: true,
                clearRendererCaches: false,
              },
              renderPromise,
            );
          if (!renderPromise?.waiting()) {
            xulsword.scroll = scroll || { verseAt: 'center' };
            this.#Prefs2.mergeValue(
              'xulsword',
              xulsword,
              'prefs',
              false,
              false,
              -2,
            );
            resolve();
          }
        });
      } // else shell.beep();
    });
  }

  // If SelectVKMType (which includes vkMod) is passed, and vkMod is not a Bible (is
  // a commentary) then the main viewport will be updated to show that module in a
  // panel, unless it is already showing.
  async goToLocationVK(
    newlocation: LocationVKType | LocationVKCommType,
    newselection?: LocationVKType | LocationVKCommType,
    newscroll?: ScrollType,
  ): Promise<void> {
    return new Promise((resolve) => {
      const vkMod =
        ('commMod' in newlocation && newlocation.commMod) || newlocation.vkMod;
      if (!vkMod || vkMod in this.#G.Tab) {
        this.#doUntilDone((renderPromise) => {
          let xulsword: Partial<typeof S.prefs.xulsword> = {};
          if (vkMod) {
            xulsword = this.setXulswordPanels(
              {
                whichModuleOrLocGB: vkMod,
                skipCallbacks: true,
                clearRendererCaches: false,
              },
              renderPromise,
            );
          }
          if (!renderPromise?.waiting()) {
            xulsword.location = newlocation;
            xulsword.selection = newselection || null;
            xulsword.scroll = newscroll || { verseAt: 'center' };
            this.#Prefs2.mergeValue(
              'xulsword',
              xulsword,
              'prefs',
              false,
              false,
              -2,
            );
            resolve();
          }
        });
      } // else shell.beep();
    });
  }

  // Update xulsword state prefs to modify viewport panels. The only state
  // props returned are those potentially, but not necessarily, modified
  // in the process.
  setXulswordPanels(
    options: Partial<PanelChangeOptions> & {
      skipCallbacks?: boolean;
      clearRendererCaches?: boolean;
    },
    renderPromise?: RenderPromise | null,
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
    this.#Viewport.getPanelChange(options, xulsword, renderPromise);
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

  async playAudio(audio: AudioPrefType) {
    let xulsword: Partial<typeof S.prefs.xulsword> | undefined;
    const { file: selection, defaults } = audio;
    if (selection) {
      if (
        'book' in selection &&
        Object.values(C.SupportedBooks).some((bg: any) =>
          bg.includes(selection.book),
        )
      ) {
        const { book, chapter, swordModule } = selection;
        if (book && typeof chapter !== 'undefined') {
          await this.goToLocationVK({
            book,
            chapter: chapter || 1,
            verse: 1,
            v11n: (swordModule && this.#G.Tab[swordModule].v11n) || null,
          });
        }
      } else if ('key' in selection) {
        const { key, swordModule } = selection;
        if (key && swordModule) {
          await this.goToLocationGB({
            otherMod: swordModule,
            key,
          });
        }
      }
      xulsword = {
        audio: {
          open: true,
          file: selection,
          defaults,
        },
      };
    } else {
      xulsword = {
        audio: { open: false, file: null, defaults },
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
