import React, { useEffect, useState, createRef } from 'react';
import { OverlayToaster, Position } from '@blueprintjs/core';
import Cache from '../cache.ts';
import Subscription from '../subscription.ts';
import {
  diff,
  isAudioVerseKey,
  keep,
  versionCompare,
  audioConfNumbers,
  gbPaths,
  localizeString,
  randomID,
  findTreeNodeOrder,
  JSON_attrib_stringify,
  prefType,
  dString,
} from '../common.ts';
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import { G, GI } from './G.ts';
import VerseKey from '../verseKey.ts';
import RenderPromise from './renderPromise.ts';
import { getElementData, HTMLData } from './htmlData.ts';
import log from './log.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  AudioPath,
  GenBookAudio,
  GenBookAudioConf,
  AudioPlayerSelectionGB,
  GIType,
  GType,
  LocationVKType,
  LookupInfo,
  ModTypes,
  OSISBookType,
  PrefObject,
  PrefStoreType,
  PrefValue,
  Repository,
  SwordConfLocalized,
  SwordConfType,
  TextVKType,
  V11nType,
  VerseKeyAudio,
  AudioPlayerSelectionVK,
  WindowDescriptorPrefType,
  FeatureMods,
  ConfigType,
  Gsafe,
} from '../type.ts';
import type { XulswordState } from './components/xulsword/xulsword.tsx';
import parseExtendedVKRef from '../extrefParser.ts';

window.WebAppTextScroll = -1;

// WebApp requires methods of Gsafe to be cache-preloaded. Not all Gsafe
// methods are explicitly called here because some calls preload multiple
// individual cache entries (see RenderPromise.writeCallToCache()); Any
// i18n required by the initial render may be supplied and it will display
// on first render, before another renderPromise dispatch.
export async function cachePreload(
  i18nArgs?: Parameters<GType['i18n']['t']>[],
): Promise<void> {
  if (Build.isWebApp) {
    RenderPromise.retryDelay = 1; // Make preload calls without delay.
    return new Promise((resolve) => {
      doUntilDone((renderPromise) => {
        GI.Tabs([], renderPromise);
        GI.BooksLocalized({}, renderPromise);
        GI.Books([], renderPromise);
        GI.Config({}, renderPromise);
        GI.ModuleFonts([], renderPromise);
        GI.FeatureModules({} as FeatureMods, renderPromise);
        GI.LocaleConfigs({}, renderPromise);
        GI.ModuleConfigDefault({} as ConfigType, renderPromise);
        GI.ProgramConfig({} as ConfigType, renderPromise);
        C.Locales.forEach((l) => GI.getLocaleDigits(null, renderPromise, l[0]));
        GI.i18n.t('', renderPromise, 'locale_direction');
        Object.values(C.SupportedTabTypes).forEach((s) =>
          GI.i18n.t('', renderPromise, s),
        );
        i18nArgs?.forEach((args) => GI.i18n.t('', renderPromise, ...args));
        RenderPromise.retryDelay = undefined;
        if (!renderPromise?.waiting()) resolve();
      });
    });
  }
}

// Return a renderPromise for a React functional component. For React class
// components, implement RenderPromiseComponent and RenderPromiseState instead.
export function functionalComponentRenderPromise(loadingSelector?: string) {
  const [, setState] = useState(0);
  const callback = () => setState((prevState) => prevState + 1);
  const [loadingRef] = useState(createRef() as React.RefObject<HTMLElement>);
  const [renderPromise] = useState(
    () => new RenderPromise(callback, loadingRef, loadingSelector),
  );
  useEffect(() => renderPromise.dispatch());
  return { renderPromise, loadingRef };
}

// Run a function taking a render promise until the function completes without
// the render promise waiting. The function may run any number of times but is
// guaranteed to run once from beginning to end with renderPromise.waiting()
// being zero. This means the function must check renderPromise.waiting()
// before any code that should only be run once. In Electron, where GI
// functions are synchronous, the passed renderPromise will be null.
export function doUntilDone(
  func: (renderPromise: RenderPromise) => void,
): void {
  const renderPromise = new RenderPromise(() => {
    func(renderPromise);
    renderPromise.dispatch();
  });
  func(renderPromise);
  renderPromise.dispatch();
}
Cache.write(doUntilDone, 'doUntilDone');

// Return the renderPromise that resets the root controller whenever it is
// fulfilled.
let rootRPInstance: RenderPromise | null = null;
export function rootRenderPromise() {
  if (!rootRPInstance) {
    rootRPInstance = new RenderPromise(() =>
      Subscription.publish.setControllerState({ reset: randomID() }, false),
    );
    setInterval(() => rootRPInstance?.dispatch(), 200);
  }
  return rootRPInstance;
}

export function component(
  comp: any,
): { displayName: string; props: any } | null {
  const c1 = comp as React.Component;
  const p = c1 && typeof c1 === 'object' && 'props' in c1 ? c1.props : null;
  const c2 = comp;
  const displayName: string =
    (c2 && typeof c2 === 'object' && 'type' in c2 && c2.type.displayName) || '';
  if (p) {
    return { displayName, props: p };
  }
  return null;
}

export const topToaster = OverlayToaster.create({
  canEscapeKeyClear: true,
  position: Position.TOP,
});

// Get this window's descriptor object and either retrieve the value of one of
// its additionalArguments, or return the entire descriptor object.
export function windowArguments(prop?: undefined): WindowDescriptorPrefType;
export function windowArguments(prop: string): PrefValue;
export function windowArguments(
  prop: string | undefined,
): PrefValue | WindowDescriptorPrefType {
  const dataID = window.ProcessInfo.argv().at(-1);
  if (
    Build.isElectronApp &&
    typeof dataID === 'string' &&
    (G as GType).Data.has(dataID)
  ) {
    const data = (G as GType).Data.read(dataID) as WindowDescriptorPrefType;
    if (prop) {
      const { additionalArguments } = data;
      if (additionalArguments && prop in additionalArguments) {
        return additionalArguments[prop];
      }
    } else return data;
  }
  const defval = Build.isElectronApp
    ? { type: 'xulswordWin', id: 1 }
    : { type: '', id: 0 };

  return prop ? undefined : defval;
}

// Add <style id="skin"> and write any user pref skin CSS to it.
export function setGlobalSkin(skin: typeof S.prefs.global.skin) {
  if (Build.isElectronApp) {
    // Set BluePrint Dark theme class.
    const html = document?.getElementsByTagName('html')[0];
    if (html) {
      if (skin === 'dark') html.classList.add('bp6-dark');
      else html.classList.remove('bp6-dark');
    }
    // Update skin CSS
    let css = '';
    if (skin) {
      css = (G as GType).inlineFile(
        ['xulsword://xsAsset', 'skins', `${skin}.css`].join(C.FSSEP),
        'utf8',
        true,
      );
    }
    let style = document.getElementById('skin');
    if (!style) {
      style = document.createElement('style');
      style.id = 'skin';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
}

export const printRefs: {
  pageViewRef: React.RefObject<HTMLDivElement>;
  printContainerRef: React.RefObject<HTMLDivElement>;
  customSettingsRef: React.RefObject<HTMLDivElement>;
  settingsRef: React.RefObject<HTMLDivElement>;
  setPages: () => void;
} = {
  pageViewRef: React.createRef(),
  printContainerRef: React.createRef(),
  customSettingsRef: React.createRef(),
  settingsRef: React.createRef(),
  setPages: () => {},
};

// Read libsword data-src attribute file URLs and convert them into src inline data.
export function libswordImgSrc(container: HTMLElement) {
  Array.from(container.getElementsByTagName('img')).forEach((img) => {
    if (img.dataset.src) {
      let src: string | undefined;
      if (Build.isWebApp) {
        if (img.dataset.src.startsWith('/')) {
          ({ src } = img.dataset);
        }
      } else if (Build.isElectronApp) {
        const m = img.dataset.src.match(/^file:\/\/(.*)$/i);
        if (m) {
          if (m[1].match(/^(\w:[/\\]|\/)/))
            src = (G as GType).inlineFile(m[1], 'base64');
          else {
            log.error(`Image source is not absolute: ${m[1]}`);
          }
        }
      }

      if (src) {
        img.src = src;
      } else {
        if (Build.isElectronApp) {
          img.src = (G as GType).inlineFile(
            ['xulsword://xsAsset', 'icons', '20x20', 'media.svg'].join(C.FSSEP),
            'base64',
          );
        } else img.removeAttribute('src');
        img.classList.add('image-not-found');
      }
      img.removeAttribute('data-src');
    }
  });
}

export function clearPending(
  obj: any,
  name: string[] | string,
  isInterval = false,
) {
  const names = Array.isArray(name) ? name : [name];
  names.forEach((n) => {
    if (n in obj) {
      const cl = obj[n] as ReturnType<typeof setTimeout | typeof setInterval>;
      if (cl) {
        if (isInterval) clearInterval(cl);
        else clearTimeout(cl);
        obj[n] = undefined;
      }
    }
  });
}

// Javascript's scrollIntoView() also scrolls ancestors in ways that can break
// Electron window layout (although this may have been alleviated by changing
// container overflow from hidden to visible). So this util sets scrollTop of
// all ancestors greater than ancestor away, to zero. If percent is provided,
// the element will be scrolled to that percent of the client height.
export function safeScrollIntoView(
  elem: HTMLElement,
  ancestor: HTMLElement,
  arg?: ScrollIntoViewOptions,
  percent?: number,
) {
  // Only behaviour instant is supported, since any smooth animation would
  // need to be completed before ancestor adjustments could be made.
  const arg2: ScrollIntoViewOptions = arg ?? {};
  arg2.behavior = 'instant';
  elem.scrollIntoView(arg2);
  let st: HTMLElement | null = elem;
  let setToZero = false;
  let adjust = true;
  while (st) {
    const max = st.scrollHeight - st.clientHeight;
    if (
      percent &&
      !setToZero &&
      adjust &&
      st.scrollTop > 0 &&
      st.scrollTop < max
    ) {
      st.scrollTop -= (st.clientHeight - elem.offsetHeight) * (percent / 100);
      adjust = false;
    }
    if (setToZero && st.scrollTop) st.scrollTop = 0;
    if (st === ancestor) setToZero = true;
    st = st.parentNode as HTMLElement | null;
  }
}

// Send a message to the iframe parent with the clientHeight of a selected div.
// If elem is provided, any images it contains will be loaded before the height
// is reported. If clear is set then -1 is sent.
export function iframeAutoHeight(
  selector: string,
  clear?: boolean,
  elem?: HTMLElement,
) {
  if (Build.isWebApp) {
    if (!clear) {
      const so = document.querySelector(selector);
      const resize = () => {
        if (so) {
          window.parent.postMessage(
            {
              type: 'iframeHeight',
              height: so.clientHeight,
            },
            '*',
          );
        }
      };
      if (elem) {
        const imgs = elem.querySelectorAll('img');
        if (imgs.length) imgs.forEach((img) => (img.onload = resize));
      }
      resize();
    } else {
      window.parent.postMessage({ type: 'iframeHeight', height: -1 }, '*');
    }
  }
}

// The various types of mouse events are fired inconsistently across browsers
// when mobile touch actions occur. However pointer events are w3c consistent
// and always occur in the following order:
// - pointerenter
// - pointerdown (for devices without hover)
// - pointerup (for devices without hover)
// - pointerleave
export const PointerDownLong = { timeout: null as NodeJS.Timeout | null };
export function supportsHover(): boolean {
  return window.matchMedia('(hover: hover)').matches;
}

// Implement onPointerDownLong, primarily for use by devices without hover
// support.
export function onPointerDownLong(
  func: (e: React.PointerEvent) => void,
): (e: React.PointerEvent) => void {
  return supportsHover()
    ? func
    : (e: React.PointerEvent) => {
        const { timeout } = PointerDownLong;
        if (timeout) clearTimeout(timeout);
        PointerDownLong.timeout = setTimeout(
          () => func(e),
          C.UI.WebApp.longTouchTO,
        );
      };
}

// React does not support pointerover or pointerout, so this function
// implements the same functionality.
export function addHoverLinks(
  container: HTMLElement,
  classes: string[],
  handler: (e: PointerEvent) => void,
) {
  container
    .querySelectorAll(classes.map((s) => `.${s}`).join(', '))
    .forEach((elem) => {
      (elem as HTMLElement).addEventListener('pointerenter', handler, {
        capture: true,
      });
      (elem as HTMLElement).addEventListener('pointerleave', handler, {
        capture: true,
      });
    });
}

export function isIBTChildrensBible(
  tocOrModule: TreeNodeInfo[] | string,
  renderPromise?: RenderPromise,
): boolean {
  if (tocOrModule) {
    let toc: TreeNodeInfo[] = [];
    if (typeof tocOrModule === 'string') {
      if (tocOrModule in G.Tab && G.Tab[tocOrModule].tabType === 'Genbks') {
        toc = GI.genBookTreeNodes([], renderPromise, tocOrModule);
      }
    } else {
      toc = tocOrModule;
    }
    if (!renderPromise?.waiting() && toc.length === 1) {
      const [top] = toc;
      if (top && top.childNodes) {
        const [, ot, nt] = top.childNodes;
        if (Array.isArray(ot?.childNodes) && Array.isArray(nt?.childNodes)) {
          return ot.childNodes.length === 133 && nt.childNodes.length === 113;
        }
      }
    }
  }
  return false;
}

// Web app Children's Bibles should always have a valid leaf-node key and
// should sync across panels. When there are multiple CB panels, the last
// panel to change should update all the others.
export function syncChildrensBibles(
  panels: XulswordState['panels'],
  prevKeys: XulswordState['keys'],
  keys: XulswordState['keys'],
  renderPromise?: RenderPromise,
): (string | null)[] {
  const cbTocs: Array<TreeNodeInfo[] | null> = panels.map(() => null);
  panels.forEach((m, i) => {
    if (m && m in G.Tab && G.Tab[m].tabType === 'Genbks') {
      const toc = GI.genBookTreeNodes([], renderPromise, m);
      if (toc.length && isIBTChildrensBible(toc, renderPromise))
        cbTocs[i] = toc;
    }
  });

  const ks = keys.slice();
  if (!renderPromise?.waiting()) {
    // Find the index order of a CB key, prefering any that changed compared
    // to previous state.
    let order = -1;
    panels.forEach((m, i) => {
      if (cbTocs[i] && m && keys[i]) {
        if (order === -1 || (prevKeys[i] && keys[i] !== prevKeys[i])) {
          const r = findTreeNodeOrder(cbTocs[i], { id: keys[i] });
          if (r) ({ order } = r);
        }
      }
    });
    // If no CB has a valid key, set all to the first CB chapter.
    if (order === -1) order = 3;
    panels.forEach((_m, i) => {
      if (cbTocs[i]) {
        const r = findTreeNodeOrder(cbTocs[i], { order });
        if (r) ks[i] = r.id.toString();
      }
    });
  }

  return ks;
}

// Return the audio module config objects for a SWORD module's AudioCodes.
export function audioConfigs(
  module: string,
  renderPromise?: RenderPromise,
): SwordConfType[] {
  const audioConfs: SwordConfType[] = [];
  if (module && module in G.Tab) {
    let conf = GI.getAudioConf(null, renderPromise, module);
    if (conf) audioConfs.push(conf);
    const { audioCodes } = G.Tab[module];
    audioCodes.forEach((audiocode) => {
      conf = GI.getAudioConf(null, renderPromise, audiocode);
      if (conf && !audioConfs.find((c) => conf && c.module === conf.module))
        audioConfs.push(conf);
    });
  }

  return audioConfs;
}

// Return possible audio player selections by updating audioModule, path and
// possibly book, chapter or key. This is done by checking each of the
// selection's swordModule AudioCode audio modules. If book, chapter or key of
// the input selection is undefined, the first applicable audio file will be
// chosen and the returned book and chapter will be updated accordingly.
export function audioSelections(
  selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
  renderPromise?: RenderPromise,
): Array<{
  selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB;
  conf: SwordConfType;
}> {
  if (selection) {
    const { swordModule } = selection;
    if (swordModule) {
      const results = audioConfigs(swordModule, renderPromise).map((conf) => {
        const { module: audioModule, AudioChapters } = conf;
        if (
          swordModule in G.Tab &&
          G.Tab[swordModule].isVerseKey &&
          'book' in selection &&
          AudioChapters &&
          isAudioVerseKey(AudioChapters)
        ) {
          const { book: bk, chapter: ch } = selection;
          let boolarray: boolean[] = [];
          const ac = AudioChapters as VerseKeyAudio;
          let book = bk;
          let chapter = ch === undefined ? -1 : ch;
          if (!book) {
            const [entry] = Object.entries(ac);
            if (entry) {
              [, boolarray] = entry;
              const [b] = entry;
              book = b as OSISBookType;
              chapter = -1;
            }
          } else if (book in ac) {
            const acbk = ac[book];
            if (acbk) boolarray = acbk;
          }
          if (book && boolarray.length) {
            if (chapter === -1) chapter = boolarray.indexOf(true);
            if (chapter !== -1 && boolarray[chapter])
              return {
                selection: {
                  swordModule,
                  book,
                  chapter,
                  audioModule,
                  path: [book, chapter],
                },
                conf,
              };
          }
        } else if (
          swordModule in G.Tab &&
          G.Tab[swordModule].tabType === 'Genbks' &&
          'key' in selection &&
          AudioChapters &&
          !isAudioVerseKey(AudioChapters)
        ) {
          let { key } = selection;
          const ac = AudioChapters as GenBookAudioConf;
          const gbaudio = getGenBookAudio(ac, swordModule, renderPromise);
          if (typeof key === 'undefined') [key] = Object.keys(gbaudio);
          if (key in gbaudio) {
            return {
              selection: {
                swordModule,
                key,
                audioModule,
                path: gbaudio[key],
              },
              conf,
            };
          }
        }
        return null;
      });

      return results.filter((r) => r !== null);
    }
  }

  return [];
}

// Return groups of same-genbook-panels, in chooser order.
// Ex: [[0],[1,2]] or [[0,1,2]]
export function chooserGenbks(panels: Array<string | null>): number[][] {
  const r: number[][] = [];
  panels.forEach((m, i) => {
    if (m && m in G.Tab && G.Tab[m].type === C.GENBOOK) {
      if (i > 0 && m === panels[i - 1]) {
        r[r.length - 1].push(i);
      } else {
        r.push([i]);
      }
    }
  });
  return r;
}

// Check a GenBook tree node to see if it has an audio file. If so,
// add the audio file information to the node and return true.
export function audioGenBookNode(
  node: TreeNodeInfo,
  swordModule: string,
  key: string,
  renderPromise: RenderPromise,
): boolean {
  if (
    swordModule &&
    swordModule in G.Tab &&
    G.Tab[swordModule].tabType === 'Genbks' &&
    key
  ) {
    const selections = audioSelections({ swordModule, key }, renderPromise);
    const selection = selections[0]?.selection ?? null;
    if (selection) {
      node.nodeData = selection;
      node.className = 'audio-icon';
      node.icon = 'volume-up';
      return true;
    }
  }
  return false;
}

// Returns the GenBookAudio object for a genbk module. It resolves a gbmod
// AudioChapters config value to the full genbk key and AudioPath.
export function getGenBookAudio(
  audio: GenBookAudioConf,
  gbmod: string,
  renderPromise?: RenderPromise,
): GenBookAudio {
  if (gbmod && gbmod in G.Tab) {
    const treeNodes = GI.genBookTreeNodes([], renderPromise, gbmod);
    if (treeNodes.length) {
      if (!Cache.has('readGenBookAudioConf', gbmod)) {
        const allGbKeys = gbPaths(treeNodes);
        const r: GenBookAudio = {};
        Object.entries(audio).forEach((entry) => {
          const [pathx, str] = entry;
          const px = pathx.split(C.GBKSEP).filter(Boolean);
          const parentPath: AudioPath = [];
          px.forEach((p, i) => {
            parentPath[i] = Number(p.replace(/^(\d+).*?$/, '$1'));
          });
          audioConfNumbers(str).forEach((n) => {
            const pp = parentPath.slice() as AudioPath;
            pp.push(n);
            const kx = Object.entries(allGbKeys).find((e) => !diff(pp, e[1]));
            if (kx) r[kx[0]] = pp;
          });
        });
        Cache.write(r, 'readGenBookAudioConf', gbmod);
      }
      return Cache.read('readGenBookAudioConf', gbmod);
    }
  }

  return {};
}

export function getLocalizedChapterTerm(
  book: string,
  chapter: number,
  locale: string,
  renderPromise: RenderPromise,
) {
  const k1 = `${book}_Chaptext`;
  const k2 = 'Chaptext';
  const toptions = {
    v1: dString(chapter, locale),
    lng: locale,
    ns: 'books',
  };
  const tkExists = GI.i18n.exists(false, renderPromise, k1, toptions);
  const tk = tkExists ? GI.i18n.t(k1, renderPromise, k1, toptions) : '';
  const r2 = GI.i18n.t(k2, renderPromise, k2, toptions);
  const r1 = tkExists && !/^\s*$/.test(tk) && tk;
  return r1 || r2;
}

// Does location surely exist in the module? It's assumed if a book is included,
// then so are all of its chapters and verses.
export function isValidVKM(
  location: LocationVKType,
  module: string,
  renderPromise: RenderPromise,
): boolean {
  if (!isValidVK(location, renderPromise)) return false;
  if (!module || !(module in G.Tab)) return false;
  if (
    !GI.getBooksInVKModule(
      G.Books.map((b) => b.code),
      renderPromise,
      module,
    ).includes(location.book as never)
  ) {
    return false;
  }
  return true;
}

// Does location actually exist in v11n?
export function isValidVK(
  location: LocationVKType,
  renderPromise: RenderPromise,
): boolean {
  const { book, chapter, v11n, verse, lastverse } = location;
  if (!book || !v11n) return false;
  if (chapter < 1 || chapter > getMaxChapter(v11n, book, renderPromise)) {
    return false;
  }
  const maxv = getMaxVerse(v11n, `${book} ${chapter}`, renderPromise);
  if (verse !== undefined && verse !== null) {
    if (verse < 1 || verse > maxv) {
      return false;
    }
  }
  if (lastverse !== undefined && lastverse !== null) {
    if (!verse || lastverse < verse || lastverse > maxv) {
      return false;
    }
  }
  return true;
}

export function moduleIncludesStrongs(
  module: string,
  renderPromise: RenderPromise,
): boolean {
  if (G.Tab[module].isVerseKey) {
    return /Strongs/i.test(
      GI.LibSword.getModuleInformation('', renderPromise, module, 'Feature') +
        GI.LibSword.getModuleInformation(
          '',
          renderPromise,
          module,
          'GlobalOptionFilter',
        ),
    );
  }
  return false;
}

// LibSword.getMaxChapter returns an erroneous number if vkeytext's
// book is not part of v11n, so it would be necessary to check here
// first. But a LibSword call is unnecessary with G.BooksInV11n.
// NOTE: main process has this same function.
export function getMaxChapter(
  v11n: V11nType,
  vkeytext: string,
  renderPromise: RenderPromise,
) {
  const [book] = vkeytext.split(/[\s.:]/);
  const bkChsInV11n = GI.getBkChsInV11n([], renderPromise, v11n);
  if (!bkChsInV11n) return 0;
  const b = bkChsInV11n.find((x) => x[0] === book);
  return b ? b[1] : 0;
}

// LibSword.getMaxVerse returns an erroneous number if vkeytext's
// chapter is not part of v11n, so check here first.
// NOTE: main process has this same function.
export function getMaxVerse(
  v11n: V11nType,
  vkeytext: string,
  renderPromise: RenderPromise,
): number {
  const { chapter } = new VerseKey({ parse: vkeytext, v11n }, renderPromise);
  const maxch = getMaxChapter(v11n, vkeytext, renderPromise);
  if (chapter <= maxch && chapter > 0) {
    return GI.LibSword.getMaxVerse(0, renderPromise, v11n, vkeytext);
  }
  return 0;
}

export function getCompanionModules(
  mod: string,
  renderPromise?: RenderPromise,
) {
  const cms = GI.LibSword.getModuleInformation(
    C.NOTFOUND,
    renderPromise,
    mod,
    'Companion',
  );
  if (cms !== C.NOTFOUND) return cms.split(/\s*,\s*/);
  return [];
}

// Return and persist the key/value pairs of component state Prefs. Component
// state Prefs are permanently persisted component state values recorded in
// a prefs json file whose key begins with the component id.
export function getStatePref(
  store: keyof typeof S,
  id: string | null,
): PrefObject;
export function getStatePref<P extends PrefObject>(
  store: keyof typeof S,
  id: string | null,
  defaultPrefs: P,
): P;
export function getStatePref<P extends PrefObject>(
  store: keyof typeof S,
  id: string | null,
  defaultPrefs?: P,
): P | PrefObject {
  if (defaultPrefs) return getStatePref2(store, id, defaultPrefs) as P;
  return getStatePref2(store, id);
}

// Return values of key/value pairs of component state Prefs. Component
// state Prefs are permanently persisted component state values recorded in
// a json preference file.
export function getStatePref2(
  store: PrefStoreType,
  id: string | null,
  defaultPrefs?: PrefObject, // default is all
): PrefObject {
  const state: PrefObject = {};
  const sdef = store in S ? (S as any)[store] : null;
  const p1 = defaultPrefs || (sdef as Record<string, unknown>);
  if (p1) {
    const p2 = defaultPrefs || ((id && sdef[id]) as Record<string, unknown>);
    if (id && p2) {
      Object.entries(p2).forEach((entry) => {
        const [key, value] = entry;
        state[key] = G.Prefs.getPrefOrCreate(
          `${id}.${String(key)}`,
          prefType(value as PrefValue),
          value as PrefValue,
          store,
        );
      });
    } else {
      Object.entries(p1).forEach((entry) => {
        const [sid, value] = entry;
        state[sid] = G.Prefs.getPrefOrCreate(
          sid,
          prefType(value as PrefValue),
          value as PrefValue,
          store,
        );
      });
    }
  }
  return state;
}

// Push state changes of statePrefKeys value to Prefs.
export function setStatePref(
  store: PrefStoreType,
  id: string | null,
  prevState: Record<string, any> | null,
  state: Record<string, any>,
  statePrefKeys?: string[], // default is all applicable S keys
): Record<string, any> | null {
  let keys = statePrefKeys?.slice();
  if (!keys) {
    const st: PrefObject = store in S ? (S as any)[store] : null;
    if (st) {
      if (id)
        if (st && id in st) keys = Object.keys(st[id] as PrefObject);
        else keys = Object.keys(st);
    }
  }
  if (keys) {
    const newStatePref = keep(state, keys);
    if (prevState === null) {
      G.Prefs.mergeValue(id, newStatePref, store);
      return newStatePref;
    } else {
      const prvStatePref = keep(prevState, keys);
      const d = diff(prvStatePref, newStatePref);
      if (d) {
        G.Prefs.mergeValue(id, d, store);
        return newStatePref;
      }
    }
  }
  return null;
}

// Calling this function sets a listener for update-state-from-pref. It will
// read component state Prefs and locale, and will update component state
// and window locale as needed.
export function registerUpdateStateFromPref(
  store: PrefStoreType,
  id: string | null,
  c: React.Component,
  defaultPrefs?: Record<string, PrefValue>, // default is all
) {
  const updateStateFromPref = (prefs: string | string[], aStorex?: string) => {
    const aStore = aStorex || 'prefs';
    log.silly(`Updating state from prefs:`, prefs, aStore);
    if (aStore === store && aStore in S) {
      const sp = defaultPrefs
        ? getStatePref(aStore as keyof typeof S, id, defaultPrefs)
        : getStatePref(aStore as keyof typeof S, id);
      const different = diff(c.state, sp);
      if (different && Object.keys(different).length) {
        const d = different as any;
        if (
          !aStore &&
          d?.global?.locale &&
          d?.global?.locale !== G.i18n.language
        ) {
          Cache.clear();
          log.debug(`Cache cleared (locale)`);
        } else if (aStore === 'bookmarks') {
          Cache.clear('bookmarkMap');
          log.debug(`bookmarkMap cache cleared`);
        }
        c.setState(different);
      }
    }
  };
  if (Build.isElectronApp)
    return window.IPC.on('update-state-from-pref', updateStateFromPref);

  return Subscription.subscribe.prefsChanged((_wid, store, key, _value) =>
    updateStateFromPref(key, store),
  );
}

export function getLangReadable(
  code: string,
  renderPromise?: RenderPromise,
): string {
  if (/^en(-*|_*)$/.test(code)) return 'English';
  if (!code || code === '?' || /^\s*$/.test(code)) return '?';
  const langName = GI.getLanguageName(
    { en: '', local: '' },
    renderPromise,
    code,
  );
  let name = '';
  if (G.i18n.language.split('-').shift() === 'en') {
    name = langName.en || langName.local;
  } else {
    name = langName.local || langName.en;
  }
  return name || code;
}

// This is useful for making i18n.t() calls having options cacheable!
export function i18nApplyOpts(
  str: string,
  opts: Record<string, string>,
): string {
  let r = str;
  Object.entries(opts).forEach((entry) => {
    const [k, v] = entry;
    r = r.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
  });
  return r;
}

// Return an HTML Scripture reference list representing an extended reference.
// An extended reference is a textual reference comprising a list of Scripture
// references separated by semicolons and/or commas. If showText is false, only
// a list of reference links will be returned, without the contents of each
// reference.
export function getExtRefHTML(
  G: Gsafe,
  GI: GIType,
  extref: string,
  targetmod: string,
  locale: string,
  context: LocationVKType,
  showText: boolean,
  keepNotes: boolean,
  renderPromise: RenderPromise,
): string {
  // Find alternate modules associated with the locale and tab settings.
  const am = G.LocaleConfigs[locale].AssociatedModules;
  const alts = new Set(am ? am.split(',') : undefined);
  if ('Prefs' in G) {
    const tabs = G.Prefs.getComplexValue(
      'xulsword.tabs',
    ) as typeof S.prefs.xulsword.tabs;
    tabs.forEach((tbk) => {
      if (tbk) tbk.forEach((t) => alts.add(t));
    });
  }
  const alternates = Array.from(alts);

  const list = parseExtendedVKRef(extref, renderPromise, context, [locale]);

  const mod = targetmod || alternates[0] || '';
  const html: string[] = [];
  const texts = GI.locationVKText(
    [],
    renderPromise,
    list.map((x) => {
      return typeof x !== 'string' && (showText || x.subid) ? x : null;
    }),
    mod,
    alternates,
    keepNotes,
    false,
    true,
  );
  list.forEach((locOrStr, i) => {
    let h = '';
    if (typeof locOrStr === 'string') {
      h += `
      <bdi>
        <span class="crref-miss">${locOrStr}</span>: ?
      </bdi>`;
    } else {
      let resolve: TextVKType = {
        location: locOrStr,
        vkMod: mod,
        text: '',
      };
      let info: Partial<LookupInfo> = {};
      if (texts.length && texts[i]) [resolve, info] = texts[i];
      const { location, vkMod: module, text } = resolve;
      if (module && module in G.Tab && location.book) {
        const { direction, label, labelClass } = G.Tab[module];
        const crref = ['crref'];
        const crtext = ['crtext'];
        if (direction !== G.ProgramConfig.direction) {
          crtext.push('opposing-program-direction');
        }
        const fntext = ['fntext'];
        if (direction !== G.ProgramConfig.direction) {
          fntext.push('opposing-program-direction');
        }
        const altlabel = ['altlabel', labelClass];
        const cc: Array<keyof LookupInfo> = ['alternate', 'anytab'];
        cc.forEach((c) => {
          if (info[c]) altlabel.push(c);
        });
        const alt = cc.some((c) => info[c])
          ? ` <bdi><span class="${altlabel.join(' ')}">(${label})</span></bdi>`
          : '';
        const crdata: HTMLData = { type: 'crref', location, context: module };
        const crd = JSON_attrib_stringify(crdata);
        const q = info.possibleV11nMismatch
          ? '<span class="possibleV11nMismatch">?</span>'
          : '';
        h += `
          <bdi>
            <a class="${crref.join(' ')}" data-data="${crd}">
              ${new VerseKey(location, renderPromise).readable(locale)}
            </a>
            ${q}${text ? ': ' : ''}
          </bdi>
          <bdi>
            <span class="${crtext.join(' ')}">${text}${alt}</span>
          </bdi>`;
      }
    }
    html.push(h);
  });
  return html.join('<span class="cr-sep"></span>');
}

export function moduleInfoHTML(
  configs: SwordConfType[],
  renderPromise: RenderPromise,
): string {
  const esc = (s: string): string => {
    if (!s) return '';
    return s.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#039;';
      }
    });
  };
  const gethtml = (c: SwordConfType): string => {
    const fields: Array<keyof SwordConfType> = [
      'Lang',
      'moduleType',
      'module',
      'Version',
      'sourceRepository',
      'ShortPromo',
      'ShortCopyright',
      'About',
      'UnlockInfo',
      'Description',
      'DistributionLicense',
      'Copyright',
      'CopyrightDate',
      'CopyrightHolder',
      'CopyrightNotes',
      'CopyrightContactName',
      'CopyrightContactAddress',
      'CopyrightContactEmail',
      'CopyrightContactNotes',
      'History',
    ];
    const sc = C.SwordConf;
    const lang = G.i18n.language;
    let about: string;
    if (c.About) about = lang in c.About ? c.About[lang] : c.About.en;
    return fields
      .map((f) => {
        let description;
        const rv = c[f] as SwordConfLocalized;
        if (f === 'Description' && rv)
          description = lang in rv ? rv[lang] : rv.en;
        if (c[f] && !(description && description === about)) {
          const sf = f as any;
          let value: string;
          if (sc.localization.includes(sf as never)) {
            const v = c[f] as SwordConfLocalized;
            value = lang in v ? v[lang] : v.en;
            if (sf.startsWith('CopyrightContact')) {
              value = `${sf.substring('CopyrightContact'.length)}: ${value}`;
            }
          } else if (sc.repeatable.includes(sf as never)) {
            const v = c[f] as string[];
            value = v.join(', ');
          } else if (sc.integer.includes(sf as never)) {
            const v = c[f] as number;
            value = v.toString();
          } else if (sf === 'moduleType') {
            const v = c[f] as ModTypes;
            const tt =
              (v in C.SupportedTabTypes && C.SupportedTabTypes[v]) || '';
            value = GI.i18n.t('', renderPromise, tt || 'Genbks');
          } else if (sf === 'Lang') {
            const v = c[f] as string;
            const [l, s] = v.split('-');
            value = getLangReadable(l, renderPromise);
            if (s) value += ` (${s})`;
          } else if (sf === 'History') {
            const v = c[f] as Array<[string, SwordConfLocalized]>;
            value = v
              .sort((a, b) => versionCompare(a[0], b[0]))
              .map((x) => {
                const vers = esc(x[0]);
                const desc = esc(lang in x[1] ? x[1][lang] : x[1].en);
                return `<div>Version ${vers}: ${desc}</div>`;
              })
              .join('');
          } else if (sf === 'sourceRepository') {
            const v = c[f] as Repository;
            value = localizeString(v.name, renderPromise) || '';
          } else value = c[f]?.toString() || '';

          if (![sc.htmllink, 'History'].flat().includes(sf as never)) {
            value = esc(value);
          } else {
            value = value.replace(/<a[^>]*>/g, (m) => {
              if (m.includes('target="_blank"')) return m;
              return m.replace(/( target="[^"]*"|(?=>))/, ' target="_blank"');
            });
          }
          if (sc.rtf.includes(sf as never)) {
            value = value.replace(
              /\\qc([^\\]+)(?=\\)/g,
              '<div class="rtf-qc">$1</div>',
            );
            value = value.replaceAll('\\pard', '');
            value = value.replaceAll('\\par', '<br>');
          }
          return `<div class="${f}">${value}</div>`;
        }
        return '';
      })
      .join('');
  };
  const html: string[] = [];
  configs.forEach((conf) => {
    html.push(gethtml(conf));
  });
  return `<div class="module-info">${html.join(
    '<div class="separator"></div>',
  )}</div>`;
}

// Replace stylesheet and other CSS with inline CSS.
export function computed2inlineStyle(
  elemx: HTMLElement | ChildNode,
  ignore?: CSSStyleDeclaration,
): HTMLElement | null {
  const elem = elemx as HTMLElement;
  const style = getComputedStyle(elem);
  // Computed style is Chrome specific, so apply some simple replacements to
  // make inline CSS more portable.
  if (elem.parentElement) {
    let replacement;
    if (style.display === 'none' || style.visibility === 'hidden') {
      replacement = 'span';
    } else if (elem.classList.contains('head-line-break')) {
      replacement = 'br';
    }
    if (replacement) {
      elem.parentElement.insertBefore(
        document.createElement(replacement),
        elem,
      );
      elem.parentElement.removeChild(elem);
    }
  }
  const ign = ignore || style;
  for (let i = 0; i < style.length; i += 1) {
    const name = style[i];
    const value = style.getPropertyValue(name);
    if (value && ign.getPropertyValue(name) !== value) {
      elem.style.setProperty(name, value, style.getPropertyPriority(name));
    }
  }
  // Remove all attributes except style
  elem.getAttributeNames().forEach((name) => {
    if (name !== 'style') elem.removeAttribute(name);
  });
  Array.from(elem.children).forEach((c) => computed2inlineStyle(c, ign));
  return elem;
}

// Filter div element children (such as from LibSword HTML output)
// to just the given range of verses.
export function htmlVerses(
  div: HTMLElement,
  verse: number,
  lastverse: number | null, // null means last verse of chapter
): HTMLElement {
  let keeping = lastverse === null;
  Array.from(div.children)
    .reverse()
    .forEach((ch) => {
      const child = ch as HTMLElement;
      const info = getElementData(child);
      if (info.type === 'vs' && info.location) {
        const { verse: vs, lastverse: lv } = info.location;
        const v = lv ?? (vs || 0);
        if (v <= (lastverse || verse || 0)) keeping = true;
        if (v < (verse || 0)) keeping = false;
      }
      if (!keeping) {
        div.removeChild(child);
      }
    });
  return div;
}

// Convert LibSword HTML into plain text.
export function elem2text(div: HTMLElement): string {
  let html = div.innerHTML;
  html = html.replace(/\s*<sup[^>]*>([\d-]+)<\/sup>\s*/gi, ' [$1] ');
  html = html.replace(/<br>/gi, C.SYSTEMNEWLINE);
  html = html.replace(/<\/div>/gi, C.SYSTEMNEWLINE);
  html = html.replace(/ *(<[^>]+> *)+/g, ' ');
  html = html.replace(/&nbsp;/gi, ' ');
  html = html.replace(/(&rlm;|&lrm;)/g, '');
  html = html.replace(/([\n\r]+ *){3,}/g, C.SYSTEMNEWLINE + C.SYSTEMNEWLINE);
  return html;
}

// Use in conjunction with callResultCompress to decompress G request results
// transmitted over the Internet.
export function callResultDecompress<V extends Record<string, any>>(
  val: V,
  valType: keyof typeof C.CompressibleCalls.common,
): V {
  const common = C.CompressibleCalls.common[valType];
  return Object.entries(common).reduce((p, entry) => {
    const [k, v] = entry;
    if (!(k in p)) (p as any)[k] = v;
    return p;
  }, val as V);
}
