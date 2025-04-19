// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class is initialized with a third party tag function
// that aggregates analytics data. Or when initialized with null, all events
// are simply logged to the console.

import { clone, drupalSetting, JSON_parse, JSON_stringify } from './common.ts';

// Type of the third party analytics function.
export type AnalyticsTag = (
  type: 'event',
  name: string,
  info: AnalyticsInfo,
) => void;

// Analytics information to be supplied along with the event.
export type AnalyticsInfo = {
  [k: string]: string | boolean | undefined | (string | boolean | undefined)[];
};

export type TypeOfAnalytics = typeof Analytics;

export default class Analytics {
  private tag: AnalyticsTag | null;

  static decodeInfo = (attributeString: string) => {
    const x = JSON_parse(decodeURIComponent(attributeString));
    const info = (typeof x === 'object' && (x as AnalyticsInfo)) || {};

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

  static validateInfo = (info: AnalyticsInfo) => {
    Object.entries(info).forEach((entry) => {
      const [k, v] = entry;
      if (
        !/^[A-Za-z0-9_-]+$/.test(k) ||
        (Array.isArray(v) &&
          v.filter(
            (x) => !['string', 'boolean', 'undefined'].includes(typeof x),
          ).length) ||
        (!Array.isArray(v) &&
          !['string', 'boolean', 'undefined'].includes(typeof v))
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
  // any element type attribute is recorded, as is any data-info attribute. If
  // context or data-info contain nid or mid, information for the referenced
  // node or media item will be included.
  static elementInfo = (element: HTMLElement) => {
    // element specific info
    const info: AnalyticsInfo = {};
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
              info[entry[0]] = entry[1] as AnalyticsInfo[string];
            }
          });
        }
      }
      elem = elem.parentElement;
    }

    // drupalSettings data associated nid and mid (will not overwrite data-info,
    // but must happen later because nid and/or mid are required).
    ['nid', 'mid'].forEach((idkey) => {
      const entType = idkey.startsWith('n') ? 'node' : 'media';
      const id = idkey in info ? info[idkey] : '';
      const ds = drupalSetting(`${entType}.${id}`);
      if (typeof ds === 'object') {
        Object.entries(ds).forEach((entry) => {
          if (!(entry[0] in info) || info[entry[0]] === '_undefined_') {
            info[entry[0]] = entry[1] as AnalyticsInfo[string];
          }
        });
      }
    });

    // type attribute
    if (element.getAttribute('type')) {
      info.typeAttr = element.getAttribute('type') as string;
    }

    // Web App?
    if (Build.isWebApp) info.webapp = true;

    // Iframe parent hostname
    const parentWin = frameElement?.ownerDocument?.defaultView as Window | undefined;
    if (parentWin) {
      const { hostname } = parentWin.location;
      if (hostname !== window.location.hostname) info.hostname = hostname;
    }

    return Analytics?.validateInfo(info) || {};
  };

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null) {
    this.tag = tag;
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(name: string, elem: HTMLElement, info?: AnalyticsInfo) {
    let i = Analytics.elementInfo(elem);
    if (info) i = { ...i, ...info };
    this.recordEvent(name, i);
  }

  recordEvent(name: string, info: AnalyticsInfo) {
    Object.entries(info).forEach((entry) => {
      const [k, v] = entry;
      if (Array.isArray(v))
        info[k] = v
          .filter((x) => typeof x === 'string' && x !== '_undefined_')
          .join(', ');
      else if (typeof v === 'boolean') info[k] = v ? 'true' : 'false';
      else if (typeof v === 'undefined') delete info[k];
      else if (typeof v === 'string' && v === '_undefined_') delete info[k];
    });
    if (typeof this.tag === 'function') this.tag('event', name, info);
    // eslint-disable-next-line no-console
    else console.log('recordEvent: ', name, info);
  }
}
