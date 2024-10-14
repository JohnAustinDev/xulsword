import { useEffect, useState, createRef } from 'react';
import Cache from '../cache.ts';
import Subscription from '../subscription.ts';
import {
  diff,
  isAudioVerseKey,
  keep,
  versionCompare,
  getStatePref as getStatePref2,
  audioConfNumbers,
  gbPaths,
  localizeString,
} from '../common.ts';
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import { G, GI } from './G.ts';
import RenderPromise from './renderPromise.ts';
import { getElementData, verseKey } from './htmlData.ts';
import log from './log.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  AudioPath,
  GenBookAudio,
  GenBookAudioConf,
  GenBookAudioFile,
  LocationVKType,
  ModTypes,
  OSISBookType,
  PrefObject,
  PrefStoreType,
  PrefValue,
  Repository,
  SwordConfLocalized,
  SwordConfType,
  V11nType,
  VerseKeyAudio,
  VerseKeyAudioFile,
  WindowDescriptorPrefType,
} from '../type.ts';

// Return a renderPromise for a React functional component. For React class
// components, instead implement RenderPromiseComponent and RenderPromiseState.
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

// Get this window's descriptor object and either retrieve the value of one of
// its additionalArguments, or return the entire descriptor object.
export function windowArguments(prop?: undefined): WindowDescriptorPrefType;
export function windowArguments(prop: string): PrefValue;
export function windowArguments(
  prop: string | undefined,
): PrefValue | WindowDescriptorPrefType {
  const dataID = window.ProcessInfo.argv().at(-1);
  if (typeof dataID === 'string' && G.Data.has(dataID)) {
    const data = G.Data.read(dataID) as WindowDescriptorPrefType;
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

// Read libsword data-src attribute file URLs and convert them into src inline data.
export function libswordImgSrc(container: HTMLElement) {
  Array.from(container.getElementsByTagName('img')).forEach((img) => {
    if (img.dataset.src) {
      let src: string | undefined;
      if (Build.isWebApp) {
        if (img.dataset.src.startsWith('/')) {
          ({ src } = img.dataset);
        }
      } else {
        const m = img.dataset.src.match(/^file:\/\/(.*)$/i);
        if (m) {
          if (m[1].match(/^(\w:[/\\]|\/)/)) src = G.inlineFile(m[1], 'base64');
          else {
            log.error(`Image source is not absolute: ${m[1]}`);
          }
        }
      }

      if (src) {
        img.src = src;
      } else {
        if (Build.isElectronApp) {
          img.src = G.inlineFile(
            [G.Dirs.path.xsAsset, 'icons', '20x20', 'media.svg'].join(C.FSSEP),
            'base64',
          );
        } else img.removeAttribute('src');
        img.classList.add('image-not-found');
      }
      img.removeAttribute('data-src');
    }
  });
}

export function getWaitRetry(result: any): number {
  return typeof result === 'object' && 'limitedDoWait' in result
    ? result.limitedDoWait
    : 0;
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

// Javascript's scrollIntoView() also scrolls ancestors in ugly
// ways. So this util sets scrollTop of all ancestors greater than
// ancestor away, to zero. At this time (Jan 2022) Electron (Chrome)
// scrollIntoView() arguments do not work. So percent 0 scrolls elem
// to the top, 50 to the middle and 100 to the bottom.
export function scrollIntoView(
  elem: HTMLElement,
  ancestor: HTMLElement,
  percent = 30,
) {
  elem.scrollIntoView();
  let st: HTMLElement | null = elem;
  let setToZero = false;
  let adjust = true;
  while (st) {
    const max = st.scrollHeight - st.clientHeight;
    if (!setToZero && adjust && st.scrollTop > 0 && st.scrollTop < max) {
      st.scrollTop -= (st.clientHeight - elem.offsetHeight) * (percent / 100);
      adjust = false;
    }
    if (setToZero && st.scrollTop) st.scrollTop = 0;
    if (st === ancestor) setToZero = true;
    st = st.parentNode as HTMLElement | null;
  }
}

export function audioConfig(
  module: string,
  renderPromise: RenderPromise,
): SwordConfType | undefined {
  let audioConf;
  if (module) {
    audioConf = GI.getAudioConf(null, renderPromise, module);
    if (!audioConf && module in G.Tab) {
      const codes = G.Tab[module].audioCodes || [];
      for (let i = 0; i < codes.length; i++) {
        audioConf = GI.getAudioConf(null, renderPromise, codes[i]);
        if (audioConf) break;
      }
    }
  }
  return audioConf ?? undefined;
}

// Change an auto-height iframe's height to match the height of a selected
// div. If elem is provided, any images it contains will be loaded before
// the height is changed. If clear is set then any height value previously
// placed set on the iframe is removed.
let OriginalHeight: string | null | undefined = null;
export function iframeAutoHeight(
  selector: string,
  clear?: boolean,
  elem?: HTMLElement,
) {
  if (
    Build.isWebApp &&
    frameElement &&
    frameElement.classList.contains('auto-height')
  ) {
    if (OriginalHeight === null) {
      OriginalHeight = (frameElement as HTMLIFrameElement).style.height;
    }
    if (!clear) {
      const so = document.querySelector(selector);
      const resize = () => {
        if (so) {
          (frameElement as HTMLIFrameElement).style.height =
            `${so.clientHeight}px`;
        }
      };
      if (elem) {
        const imgs = elem.querySelectorAll('img');
        if (imgs.length) imgs.forEach((img) => (img.onload = resize));
      }
      resize();
    } else {
      (frameElement as HTMLIFrameElement).style.height = OriginalHeight || '';
    }
  }
}

// Return an audio file for the given VerseKey module, book and chapter,
// or null if there isn't one.
export function verseKeyAudioFile(
  swordModule: string,
  book: OSISBookType,
  chapter: number,
  renderPromise: RenderPromise,
): VerseKeyAudioFile | null {
  const audioConf = audioConfig(swordModule, renderPromise);
  if (audioConf) {
    const { AudioChapters } = audioConf;
    let boolarray: boolean[] = [];
    if (AudioChapters && isAudioVerseKey(AudioChapters)) {
      const ac = AudioChapters as VerseKeyAudio;
      let bk = book;
      let ch = chapter === undefined ? -1 : chapter;
      if (!bk) {
        const [entry] = Object.entries(ac);
        if (entry) {
          [, boolarray] = entry;
          const [b] = entry;
          bk = b as OSISBookType;
          ch = -1;
        }
      } else if (bk in ac) {
        const acbk = ac[bk];
        if (acbk) boolarray = acbk;
      }
      if (bk && boolarray.length) {
        if (ch === -1) ch = boolarray.indexOf(true);
        if (ch !== -1 && boolarray[ch])
          return {
            audioModule: audioConf.module,
            swordModule,
            book: bk,
            chapter: ch,
            path: [bk, ch],
          };
      }
    }
  }
  return null;
}

// Return an audio file for the given GenBook module and key,
// or null if there isn't one.
export function genBookAudioFile(
  swordModule: string,
  key: string,
  renderPromise: RenderPromise,
): GenBookAudioFile | null {
  const audioConf = audioConfig(swordModule, renderPromise);
  if (audioConf) {
    const { AudioChapters } = audioConf;
    if (AudioChapters && !isAudioVerseKey(AudioChapters)) {
      const ac = AudioChapters as GenBookAudioConf;
      const gbaudio = getGenBookAudio(ac, swordModule, renderPromise);
      if (key in gbaudio) {
        return {
          audioModule: audioConf.module,
          swordModule,
          key,
          path: gbaudio[key],
        };
      }
    }
  }
  return null;
}

// Check a GenBook tree node to see if it has an audio file. If so,
// add the audio file information to the node and return true.
export function audioGenBookNode(
  node: TreeNodeInfo,
  module: string,
  key: string,
  renderPromise: RenderPromise,
): boolean {
  let afile: GenBookAudioFile | null = null;
  if (!G.Tab[module].isVerseKey && G.Tab[module].tabType === 'Genbks' && key) {
    afile = genBookAudioFile(module, key, renderPromise);
  }
  if (afile) {
    node.nodeData = afile;
    node.className = 'audio-icon';
    node.icon = 'volume-up';
    return true;
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
  const treeNodes = GI.genBookTreeNodes([], renderPromise, gbmod);
  if (treeNodes.length) {
    if (!Cache.has('readGenBookAudioConf', gbmod)) {
      const allGbKeys = gbPaths(treeNodes);
      const r: GenBookAudio = {};
      Object.entries(audio).forEach((entry) => {
        const [pathx, str] = entry;
        const px = pathx.split('/').filter(Boolean);
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
    v1: dString(chapter, locale, renderPromise),
    lng: locale,
    ns: 'books',
  };
  const tkExists = GI.i18n.exists(false, renderPromise, k1, toptions);
  const tk = tkExists ? GI.i18n.t(k1, renderPromise, k1, toptions) : '';
  const r2 = GI.i18n.t(k2, renderPromise, k2, toptions);
  const r1 = tkExists && !/^\s*$/.test(tk) && tk;
  return r1 || r2;
}

// converts any ASCII digits in a string into localized digits.
export function dString(
  string: string | number,
  locale?: string | null,
  renderPromise?: RenderPromise,
) {
  let s = string.toString();
  const digits = GI.getLocaleDigits(
    null,
    renderPromise,
    locale ?? G.i18n.language,
  );
  if (digits) {
    for (let i = 0; i <= 9; i += 1) {
      s = s.replaceAll(i.toString(), digits[i]);
    }
  }
  return s;
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
    !GI.getBooksInVKModule(['Gen'], renderPromise, module).includes(
      location.book as never,
    )
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
  const bkChsInV11n = GI.getBkChsInV11n([['Gen', 50]], renderPromise, v11n);
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
  const { chapter } = verseKey(vkeytext, v11n, undefined, renderPromise);
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
  if (defaultPrefs) return getStatePref2(G.Prefs, store, id, defaultPrefs) as P;
  return getStatePref2(G.Prefs, store, id);
}

// Push state changes of statePrefKeys value to Prefs.
export function setStatePref(
  store: PrefStoreType,
  id: string | null,
  prevState: Record<string, any> | null,
  state: Record<string, any>,
  statePrefKeys?: string[], // default is all applicable S keys
) {
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
    if (prevState === null) G.Prefs.mergeValue(id, newStatePref, store);
    else {
      const prvStatePref = keep(prevState, keys);
      const d = diff(prvStatePref, newStatePref);
      if (d) G.Prefs.mergeValue(id, d, store);
    }
  }
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
    log.debug(`Updating state from prefs:`, prefs, aStore);
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

export function moduleInfoHTML(
  configs: SwordConfType[],
  renderPromise?: RenderPromise,
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
            value = localizeString(G, v.name) || '';
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
