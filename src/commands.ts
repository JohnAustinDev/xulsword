import { doUntilDone, G, keep } from './common.ts';
import {
  getPanelChange,
  getTabChange,
  PanelChangeOptions,
} from './viewport.ts';
import C from './constant.ts';

import type S from './defaultPrefs.ts';
import type {
  LocationORType,
  LocationVKCommType,
  LocationVKType,
  ScrollType,
  AudioPrefType,
  GAddWindowId,
  GType,
} from './type.ts';
import type { TabChangeOptions } from './viewport.ts';
import type RenderPromise from './clients/renderPromise.ts';
import type { XulswordState } from './clients/components/xulsword/xulsword.tsx';

// Update the visible tabs of a viewport, and return the new values the
// related state props.
export function setXulswordTabs(
  options: Partial<TabChangeOptions> & {
    skipCallbacks?: boolean;
    clearRendererCaches?: boolean;
  },
  renderPromise: RenderPromise | null,
  windowID?: number,
  callback?: (xulsword: typeof S.prefs.xulsword) => void,
): Pick<typeof S.prefs.xulsword, 'panels' | 'mtModules' | 'tabs' | 'location'> {
  const id = windowID ?? -1;
  const { skipCallbacks, clearRendererCaches } = {
    skipCallbacks: false,
    clearRendererCaches: true,
    ...options,
  };

  let isViewportWin: GAddWindowId['Window'] | null = null;
  if (Build.isElectronApp) {
    const winobj = (G() as GType).Window;
    if (id !== -1 && winobj) {
      const [d] = winobj.descriptions({ id });
      if (d?.type === 'viewportWin') isViewportWin = winobj;
    }
  }

  const xulsword = isViewportWin
    ? (isViewportWin.getComplexValue('xulswordState', id) as XulswordState)
    : ((G().Prefs as GAddWindowId['Prefs']).getComplexValue(
        'xulsword',
        undefined,
        id,
      ) as typeof S.prefs.xulsword);

  getTabChange(options, xulsword, renderPromise);
  const result = keep(xulsword, ['panels', 'mtModules', 'tabs', 'location']);

  if (isViewportWin) {
    isViewportWin.setComplexValue('xulswordState', xulsword, id);
    isViewportWin.reset('all', 'self', id);
  } else {
    (G().Prefs as GAddWindowId['Prefs']).mergeValue(
      'xulsword',
      result,
      'prefs',
      skipCallbacks,
      clearRendererCaches,
      id,
    );
    // The previous prefs mergeValue will not reset the calling window to
    // prevent cycling (usually the calling window updates itself). In this
    // case the calling window needs an explicit reset to apply the new pref
    // values.
    if (Build.isElectronApp) (G() as GType).Window.reset('all', { id });
  }

  if (callback) callback(xulsword);

  return result;
}

export async function goToLocationGB(
  location: LocationORType,
  scroll?: ScrollType | undefined,
): Promise<void> {
  return new Promise((resolve) => {
    if (location.otherMod in G().Tab) {
      // Genbk keys in xulsword should not start with slash, but libxulsword
      // returns keys starting with slash. So remove it if it exists.
      const { key } = location;
      if (key.startsWith(C.GBKSEP)) location.key = key.substring(1);
      doUntilDone((renderPromise: RenderPromise | null) => {
        const xulsword: Partial<typeof S.prefs.xulsword> = setXulswordPanels(
          {
            whichModuleOrLocGB: location,
            skipCallbacks: true,
            clearRendererCaches: false,
          },
          renderPromise,
        );
        if (!renderPromise?.waiting()) {
          xulsword.scroll = scroll || { verseAt: 'center' };
          (G().Prefs as GAddWindowId['Prefs']).mergeValue(
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
export async function goToLocationVK(
  newlocation: LocationVKType | LocationVKCommType,
  newselection?: LocationVKType | LocationVKCommType,
  newscroll?: ScrollType,
): Promise<void> {
  return new Promise((resolve) => {
    const vkMod =
      ('commMod' in newlocation && newlocation.commMod) || newlocation.vkMod;
    if (!vkMod || vkMod in G().Tab) {
      doUntilDone((renderPromise: RenderPromise | null) => {
        let xulsword: Partial<typeof S.prefs.xulsword> = {};
        if (vkMod) {
          xulsword = setXulswordPanels(
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
          (G().Prefs as GAddWindowId['Prefs']).mergeValue(
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
export function setXulswordPanels(
  options: Partial<PanelChangeOptions> & {
    skipCallbacks?: boolean;
    clearRendererCaches?: boolean;
  },
  renderPromise: RenderPromise | null,
): Pick<
  typeof S.prefs.xulsword,
  'panels' | 'mtModules' | 'tabs' | 'keys' | 'isPinned' | 'location'
> {
  const { skipCallbacks, clearRendererCaches } = {
    skipCallbacks: false, // default: run callbacks
    clearRendererCaches: true, // default: reset renderer caches
    ...options,
  };

  const xulsword = G().Prefs.getComplexValue(
    'xulsword',
  ) as typeof S.prefs.xulsword;
  getPanelChange(options, xulsword, renderPromise);
  const result = keep(xulsword, [
    'panels',
    'mtModules',
    'tabs',
    'keys',
    'isPinned',
    'location',
  ]);

  // Save the results to Prefs.
  G().Prefs.mergeValue(
    'xulsword',
    result,
    'prefs',
    skipCallbacks,
    clearRendererCaches,
  );

  return result;
}

export async function playAudio(audio: AudioPrefType) {
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
        await goToLocationVK({
          book,
          chapter: chapter || 1,
          verse: 1,
          v11n: (swordModule && G().Tab[swordModule].v11n) || null,
        });
      }
    } else if ('key' in selection) {
      const { key, swordModule } = selection;
      if (key && swordModule) {
        await goToLocationGB({
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
  (G().Prefs as GAddWindowId['Prefs']).mergeValue(
    'xulsword',
    xulsword,
    'prefs',
    undefined,
    false,
    -2,
  );
}
