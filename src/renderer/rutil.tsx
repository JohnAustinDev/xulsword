/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import React from 'react';
import { Icon, TreeNodeInfo } from '@blueprintjs/core';
import Cache from '../cache';
import {
  diff,
  isAudioVerseKey,
  JSON_parse,
  keep,
  versionCompare,
  getStatePref as getStatePref2,
  bookmarkItemIconPath,
  audioConfNumbers,
  gbPaths,
  localizeString,
} from '../common';
import C from '../constant';
import S from '../defaultPrefs';
import G from './rg';
import { getElementData, verseKey } from './htmlData';
import log from './log';

import type {
  AudioPath,
  BookmarkItemType,
  BookmarkTreeNode,
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
} from '../type';

export function component(
  comp: any
): { displayName: string; props: any } | null {
  const c1 = comp as React.Component;
  const p = c1 && typeof c1 === 'object' && 'props' in c1 ? c1.props : null;
  const c2 = comp as any;
  const displayName: string =
    (c2 && typeof c2 === 'object' && 'type' in c2 && c2.type.displayName) || '';
  if (p) {
    return { displayName, props: p };
  }
  return null;
}

// Read the window's given argument ID and use it to retrieve a property
// value from the window's Data.
export function windowArguments(prop?: undefined): WindowDescriptorPrefType;
export function windowArguments(prop: string): PrefValue;
export function windowArguments(
  prop: string | undefined
): PrefValue | WindowDescriptorPrefType {
  const dataID = window.processR.argv().at(-1);
  if (typeof dataID === 'string' && G.Data.has(dataID)) {
    const data = G.Data.read(dataID) as WindowDescriptorPrefType;
    if (prop) {
      const { additionalArguments } = data;
      if (additionalArguments && prop in additionalArguments) {
        return additionalArguments[prop];
      }
    } else return data;
  }
  return prop ? undefined : { type: 'xulsword' };
}

// Read libsword data-src attribute file URLs and convert them into src inline data.
export function libswordImgSrc(container: HTMLElement) {
  Array.from(container.getElementsByTagName('img')).forEach((img) => {
    if (img.dataset.src) {
      let src: string | undefined;
      const m = img.dataset.src.match(/^file:\/\/(.*)$/i);
      if (m) {
        if (m[1].match(/^(\w:[/\\]|\/)/)) src = G.inlineFile(m[1], 'base64');
        else {
          log.error(`Image source is not absolute: ${m[1]}`);
        }
      }
      if (src) {
        img.src = src;
      } else {
        img.src = G.inlineFile(
          [G.Dirs.path.xsAsset, 'icons', '20x20', 'media.svg'].join(C.FSSEP),
          'base64'
        );
        img.classList.add('image-not-found');
      }
      img.removeAttribute('data-src');
    }
  });
}

export function clearPending(
  obj: any,
  name: string[] | string,
  isInterval = false
) {
  const names = Array.isArray(name) ? name : [name];
  names.forEach((n) => {
    if (n in obj) {
      const cl = obj[n];
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
  percent = 30
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

export function audioConfig(module?: string): SwordConfType | undefined {
  let audioConf;
  if (module) {
    audioConf = G.AudioConfs[module];
    if (!audioConf && module in G.Tab) {
      const codes = G.Tab[module].conf.AudioCode || [];
      const i = codes.findIndex((code) => code in G.AudioConfs);
      if (i !== -1) audioConf = G.AudioConfs[codes[i]];
    }
  }
  return audioConf;
}

// Return an audio file for the given VerseKey module, book and chapter,
// or null if there isn't one.
export function verseKeyAudioFile(
  swordModule: string,
  book?: OSISBookType,
  chapter?: number
): VerseKeyAudioFile | null {
  const audioConf = audioConfig(swordModule);
  if (audioConf) {
    const { AudioChapters } = audioConf;
    let boolarray: boolean[] = [];
    if (AudioChapters && isAudioVerseKey(AudioChapters)) {
      const ac = AudioChapters as VerseKeyAudio;
      let bk = book;
      let ch = chapter === undefined ? -1 : chapter;
      if (!bk) {
        const entry = Object.entries(ac)[0];
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
  key: string
): GenBookAudioFile | null {
  const audioConf = audioConfig(swordModule);
  if (audioConf) {
    const { AudioChapters } = audioConf;
    if (AudioChapters && !isAudioVerseKey(AudioChapters)) {
      const ac = AudioChapters as GenBookAudioConf;
      if (!Cache.has('readGenBookAudioConf', swordModule)) {
        Cache.write(
          readGenBookAudioConf(ac, swordModule),
          'readGenBookAudioConf',
          swordModule
        );
      }
      const ac2 = Cache.read(
        'readGenBookAudioConf',
        swordModule
      ) as GenBookAudio;
      if (key in ac2) {
        return {
          audioModule: audioConf.module,
          swordModule,
          key,
          path: ac2[key],
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
  key: string
): boolean {
  let afile: GenBookAudioFile | null = null;
  if (!G.Tab[module].isVerseKey && G.Tab[module].tabType === 'Genbks' && key) {
    afile = genBookAudioFile(module, key);
  }
  if (afile) {
    node.nodeData = afile;
    node.className = 'audio-icon';
    node.icon = 'volume-up';
    return true;
  }
  return false;
}

export function audioIcon(
  module: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  audioHandler: (audio: VerseKeyAudioFile | GenBookAudioFile) => void
): JSX.Element | null {
  let afile: VerseKeyAudioFile | GenBookAudioFile | null = null;
  if (G.Tab[module].isVerseKey) {
    const book = bookOrKey as OSISBookType;
    afile = verseKeyAudioFile(module, book, chapter);
  } else if (G.Tab[module].tabType === 'Genbks' && bookOrKey) {
    afile = genBookAudioFile(module, bookOrKey);
  }
  if (afile) {
    const handler = ((ax: VerseKeyAudioFile | GenBookAudioFile) => {
      return (e: React.SyntheticEvent) => {
        e.stopPropagation();
        audioHandler(ax);
      };
    })(afile);
    return (
      <div className="audio-icon" onClick={handler}>
        <Icon icon="volume-up" />
      </div>
    );
  }
  return null;
}

// Returns the audio files listed in a config file as GenBookAudio.
export function readGenBookAudioConf(
  audio: GenBookAudioConf,
  gbmod: string
): GenBookAudio {
  const r: GenBookAudio = {};
  const allGbKeys = gbPaths(G.DiskCache, G.LibSword, gbmod);
  Object.entries(audio).forEach((entry) => {
    const [pathx, str] = entry;
    const px = pathx.split('/').filter(Boolean);
    const parentPath: AudioPath = [];
    px.forEach((p, i) => {
      parentPath[i] = Number(p);
    });
    audioConfNumbers(str).forEach((n) => {
      const pp = parentPath.slice() as AudioPath;
      pp.push(n);
      const kx = Object.entries(allGbKeys).find((e) => !diff(pp, e[1]));
      if (kx) r[kx[0]] = pp;
    });
  });
  return r;
}

// Does location surely exist in the module? It's assumed if a book is included,
// then so are all of its chapters and verses.
export function isValidVKM(location: LocationVKType, module: string): boolean {
  if (!isValidVK(location)) return false;
  if (!module || !(module in G.Tab)) return false;
  if (!G.getBooksInVKModule(module).includes(location.book as any)) {
    return false;
  }
  return true;
}

// Does location actually exist in v11n?
export function isValidVK(location: LocationVKType): boolean {
  const { book, chapter, v11n, verse, lastverse } = location;
  if (!book || !v11n) return false;
  if (chapter < 1 || chapter > getMaxChapter(v11n, book)) {
    return false;
  }
  const maxv = getMaxVerse(v11n, `${book} ${chapter}`);
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

// LibSword.getMaxChapter returns an erroneous number if vkeytext's
// book is not part of v11n, so it would be necessary to check here
// first. But a LibSword call is unnecessary with G.BooksInV11n.
// NOTE: main process has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  if (!(v11n in G.BkChsInV11n)) return 0;
  const b = G.BkChsInV11n[v11n].find((x) => x[0] === book);
  return b ? b[1] : 0;
}

// LibSword.getMaxVerse returns an erroneous number if vkeytext's
// chapter is not part of v11n, so check here first.
// NOTE: main process has this same function.
export function getMaxVerse(v11n: V11nType, vkeytext: string) {
  const { chapter } = verseKey(vkeytext, v11n);
  const maxch = getMaxChapter(v11n, vkeytext);
  return chapter <= maxch && chapter > 0
    ? G.LibSword.getMaxVerse(v11n, vkeytext)
    : 0;
}

export function getCompanionModules(mod: string) {
  const cms = G.LibSword.getModuleInformation(mod, 'Companion');
  if (cms !== C.NOTFOUND) return cms.split(/\s*,\s*/);
  return [];
}

// Return and persist the key/value pairs of component state Prefs. Component
// state Prefs are permanently persisted component state values recorded in
// a prefs json file whose key begins with the component id.
export function getStatePref(
  store: keyof typeof S,
  id: string | null
): PrefObject;
export function getStatePref<P extends PrefObject>(
  store: keyof typeof S,
  id: string | null,
  defaultPrefs: P
): P;
export function getStatePref<P extends PrefObject>(
  store: keyof typeof S,
  id: string | null,
  defaultPrefs?: P
): P | PrefObject {
  if (defaultPrefs) return getStatePref2(G.Prefs, store, id, defaultPrefs) as P;
  return getStatePref2(G.Prefs, store, id) as PrefObject;
}

// Push state changes of statePrefKeys value to Prefs.
export function setStatePref(
  store: PrefStoreType,
  id: string | null,
  prevState: { [key: string]: any } | null,
  state: { [key: string]: any },
  statePrefKeys?: string[] // default is all applicable S keys
) {
  let keys = statePrefKeys?.slice();
  if (!keys) {
    const st = store in S ? (S as any)[store] : null;
    if (st) keys = Object.keys(id ? st[id] : st);
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
  defaultPrefs?: { [prefkey: string]: PrefValue } // default is all
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
  return window.ipc.on('update-state-from-pref', updateStateFromPref);
}

let languageNames: {
  en: { [code: string]: string };
  self: { [code: string]: string };
};
export function getLangReadable(code: string): string {
  if (/^en(-*|_*)$/.test(code)) return 'English';
  if (!code || code === '?' || /^\s*$/.test(code)) return '?';
  if (!languageNames) {
    const path = `${G.Dirs.path.xsAsset}/locales/languageNames.json`;
    const json = G.inlineFile(path, 'utf8', true);
    languageNames = JSON_parse(json);
  }
  let name = code;
  const code2 = code.replace(/-.*$/, '');
  if (G.i18n.language.split('-').shift() === 'en') {
    name =
      code2 in languageNames.en
        ? languageNames.en[code2]
        : languageNames.self[code2];
  } else {
    name =
      code2 in languageNames.self
        ? languageNames.self[code2]
        : languageNames.en[code2];
  }
  return name || code;
}

export function bookmarkItemIcon(
  item: BookmarkTreeNode | BookmarkItemType
): JSX.Element {
  const path = bookmarkItemIconPath(G, item);
  return <img className="bmicon" src={G.inlineFile(path)} />;
}

export function moduleInfoHTML(configs: SwordConfType[]): string {
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
    const fields: (keyof SwordConfType)[] = [
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
          if (sc.localization.includes(sf)) {
            const v = c[f] as SwordConfLocalized;
            value = lang in v ? v[lang] : v.en;
            if (sf.startsWith('CopyrightContact')) {
              value = `${sf.substring('CopyrightContact'.length)}: ${value}`;
            }
          } else if (sc.repeatable.includes(sf)) {
            const v = c[f] as string[];
            value = v.join(', ');
          } else if (sc.integer.includes(sf)) {
            const v = c[f] as number;
            value = v.toString();
          } else if (sf === 'moduleType') {
            const v = c[f] as ModTypes;
            const tt =
              (v in C.SupportedTabTypes && C.SupportedTabTypes[v]) || '';
            value = G.i18n.t(tt || 'Genbks');
          } else if (sf === 'Lang') {
            const v = c[f] as string;
            const [l, s] = v.split('-');
            value = getLangReadable(l);
            if (s) value += ` (${s})`;
          } else if (sf === 'History') {
            const v = c[f] as [string, SwordConfLocalized][];
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
            value = localizeString(G.i18n, v.name) || '';
          } else value = c[f]?.toString() || '';

          if (![sc.htmllink, 'History'].flat().includes(sf)) {
            value = esc(value);
          } else {
            value = value.replace(/<a[^>]*>/g, (m) => {
              if (m.includes('target="_blank"')) return m;
              return m.replace(/( target="[^"]*"|(?=>))/, ' target="_blank"');
            });
          }
          if (sc.rtf.includes(sf)) {
            value = value.replace(
              /\\qc([^\\]+)(?=\\)/g,
              '<div class="rtf-qc">$1</div>'
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
    '<div class="separator"></div>'
  )}</div>`;
}

// Replace stylesheet and other CSS with inline CSS.
export function computed2inlineStyle(
  elemx: HTMLElement | ChildNode,
  ignore?: CSSStyleDeclaration
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
        elem
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
  lastverse: number | null // null means last verse of chapter
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
