/* eslint-disable @typescript-eslint/naming-convention */
// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class is initialized with a third party tag function
// that aggregates analytics data. Or when initialized with null, all events
// are simply logged to the console.

import { drupalSetting, JSON_parse, JSON_stringify } from './common.ts';

// Type of the third party analytics function.
export type AnalyticsTag = (
  type: 'event',
  name: string,
  info: AnalyticsInfo,
) => void;

export type AnalyticsEvents =
  | 'bb-chapter-bible'
  | 'bb-chapter-genbk'
  | 'bb-verse'
  | 'bb-introduction'
  | 'bb-glossary'
  | 'bb-search'
  | 'bb-print'
  | 'bb-print-preview'
  | 'bb-print-to-pdf'
  | 'download'
  | 'audio-play'
  | 'app-install';

// Analytics information to be supplied along with the event.
export type AnalyticsInfo = {
  module?: string;
  AudioCode?: string;
  target?: string;
  mid?: string;
  mtype?: string;
  nid?: string;
  ntype?: string;
  ntitle?: string;
  iso?: string;
  link?: string;
  href?: string;
  typeAttr?: string;
  framehost?: string;
  webapp?: boolean;
  // Multi-chapter downloads
  chapter1?: number;
  chapters?: number;
  // Drupal media
  field_type?: string[];
  field_bible_scope?: string;
  field_script?: string;
  field_format?: string;
  // Bible audio
  field_osis_book?: string;
  field_chapter?: string;
  // Genbk audio
  field_path_order?: string;
  field_path_name?: string;
  // JavaME
  field_series?: string;
  field_character_set?: string;
  field_javame_format?: string;
  // MK
  version?: string;
};

export type AnalyticsInfoType = {
  [k: string]:
    | boolean
    | string
    | number
    | undefined
    | (boolean | string | number | undefined)[];
};

export type TypeOfAnalytics = typeof Analytics;

export class Analytics {
  private tag: AnalyticsTag | null;

  static decodeInfo = (attributeString: string) => {
    const x = JSON_parse(decodeURIComponent(attributeString));
    const info = (typeof x === 'object' && (x as AnalyticsInfoType)) || {};

    // data-info attributes may also be encoded as key value pairs.
    if (!Object.keys(info).length) {
      attributeString.split(/\s*,\s*/).forEach((seg) => {
        const m = seg.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
        if (m) info[m[1]] = decodeURIComponent(m[2]);
      });
    }

    return Analytics.validateInfo(info);
  };

  static encodeInfo = (info: AnalyticsInfo) => {
    return encodeURIComponent(JSON_stringify(Analytics.validateInfo(info)));
  };

  static validateInfo = (info: AnalyticsInfoType) => {
    Object.entries(info).forEach((entry) => {
      const [k, v] = entry;
      if (
        !/^[A-Za-z0-9_-]+$/.test(k) ||
        (Array.isArray(v) &&
          v.filter(
            (x) => !['string', 'boolean', 'number', 'undefined'].includes(typeof x),
          ).length) ||
        (!Array.isArray(v) &&
          !['string', 'boolean', 'number', 'undefined'].includes(typeof v))
      ) {
        delete info[k];
      }
    });

    return info;
  };

  static addInfo = (
    info: AnalyticsInfo,
    element: HTMLElement,
    replace = false,
  ) => {
    const init =
      !replace && element.dataset.info
        ? Analytics.decodeInfo(element.dataset.info)
        : {};
    element.dataset.info = Analytics.encodeInfo({ ...init, ...info });
  };

  static topInfoElement = (element: HTMLElement) => {
    let el: HTMLElement | null = element;
    while (el && !el.classList.contains('view-row')) el = el.parentElement;
    return el || element;
  };

  // Collect analytics information for an HTML element. Anchor link text and
  // any element type attribute are recorded, as are any data-info attributes
  // of self or ancestors. If data-history-node-id or data-info supply nid or
  // mid, then information about the referenced node or media item will be
  // included.
  static elementInfo = (element: HTMLElement) => {
    // element specific info
    const info: AnalyticsInfoType = {};
    switch (element.localName) {
      case 'a': {
        info.link = element.textContent || '';
        info.href = (element as HTMLAnchorElement).href;
        break;
      }
    }

    // context node within Drupal page
    let p: HTMLElement | null = element;
    while (p && !p.hasAttribute('data-history-node-id')) p = p.parentElement;
    if (!p && frameElement) {
      p = frameElement as HTMLIFrameElement;
      while (p && !p.hasAttribute('data-history-node-id')) p = p.parentElement;
    }
    if (p) {
      info.nid = p.getAttribute('data-history-node-id') || '';
    }

    // merge data-info attributes of self and ancestors
    let elem: HTMLElement | null = element;
    while (elem) {
      if (Analytics && elem.dataset.info) {
        const i = Analytics.decodeInfo(elem.dataset.info);
        if (i && typeof i === 'object') {
          Object.entries(i).forEach((entry) => {
            if (!(entry[0] in info) || info[entry[0]] === '') {
              info[entry[0]] = entry[1] as AnalyticsInfoType[string];
            }
          });
        }
      }
      elem = elem.parentElement;
    }

    // type attribute
    if (element.getAttribute('type')) {
      info.typeAttr = element.getAttribute('type') as string;
    }

    return Analytics.validateInfo(info) || {};
  };

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null) {
    this.tag = tag;
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(
    name: AnalyticsEvents,
    elem: HTMLElement,
    info?: AnalyticsInfo,
  ) {
    let i = Analytics.elementInfo(elem);
    if (info) i = { ...i, ...info };
    this.recordEvent(name, i);
  }

  recordEvent(name: AnalyticsEvents, info: AnalyticsInfoType) {
    // drupalSettings data lookup (will not overwrite info).
    Object.entries({
      AudioCode: 'sword.AudioCode',
      module: 'sword.module',
      nid: 'node',
      mid: 'media',
    }).forEach((entry) => {
      const [k, v] = entry;
      if (k in info && info[k]) {
        const ds = drupalSetting(`${v}.${info[k]}`);
        if (typeof ds === 'object') {
          Object.entries(ds).forEach((entry) => {
            if (!(entry[0] in info) || info[entry[0]] === '_undefined_') {
              info[entry[0]] = entry[1] as AnalyticsInfoType[string];
            }
          });
        }
      }
    });

    // webapp
    if (Build.isWebApp) info.webapp = true;

    // framehost
    const parentWin = frameElement?.ownerDocument?.defaultView as
      | Window
      | undefined;
    if (parentWin) {
      const { hostname } = parentWin.location;
      if (hostname !== window.location.hostname) info.framehost = hostname;
    }

    info = Analytics.validateInfo(info);

    // convert to final form
    Object.entries(info).forEach((entry) => {
      const [k, v] = entry;
      if (Array.isArray(v))
        info[k] = v
          .filter((x) => typeof x !== 'undefined' && x !== '_undefined_')
          .join(', ');
      else if (typeof v === 'undefined' || v === '_undefined_') delete info[k];
    });

    // Send it!
    if (typeof this.tag === 'function') this.tag('event', name, info);
    else if (Build.isWebApp || Build.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('recordEvent: ', name, info);
    }
  }
}

let tagfunc = null;
if (typeof (globalThis as any).gtag === 'function')
  tagfunc = (globalThis as any).gtag as AnalyticsTag;

const analytics = new Analytics(tagfunc);

export default analytics;
