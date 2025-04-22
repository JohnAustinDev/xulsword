/* eslint-disable @typescript-eslint/naming-convention */
import { JSON_parse, JSON_stringify } from './common.ts';

import type logobj from './clients/log.ts';

// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class is initialized with a third party tag function
// that aggregates analytics data. Or when initialized with null, all events
// are simply logged to the console.

// Type of the third party analytics function.
export type AnalyticsTag = (
  type: 'event',
  name: string,
  info: AnalyticsData,
) => void;

export type AnalyticsActions =
  | 'download'
  | 'stream'
  | 'view'
  | 'print'
  | 'search'
  | 'install';

export type AnalyticsEvents =
  | 'bb-chapter'
  | 'bb-verse'
  | 'bb-glossary'
  | 'bb-search'
  | 'bb-print'
  | 'download'
  | 'play-audio'
  | 'play-video'
  | 'install-app';

// One of these object types is required to generate a standardized label.
export type DownloadLinkInfo = {
  action: 'download';
  event: 'download';
  link: string;
  href: string;
  nid?: number;
};
export type BibleBrowserEventInfo = {
  action: 'view' | 'print' | 'search';
  event: 'bb-chapter' | 'bb-verse' | 'bb-search' | 'bb-print' | 'bb-glossary';
  module: string;
  target: string;
};
export type AnalyticsLabelInfo = {
  action: AnalyticsActions;
  event: AnalyticsEvents;
} & (
  | DownloadLinkInfo
  | BibleBrowserEventInfo
  | {
      action: 'stream';
      event: 'play-audio';
      AudioCode: string;
      book: string;
      chapter: number;
    }
  | {
      action: 'stream';
      event: 'play-audio';
      AudioCode: string;
      key: string;
    }
  | {
      action: 'stream';
      event: 'play-audio';
      mid: number;
    }
  | {
      action: 'download';
      event: 'download';
      mid: number;
      chapter1?: number;
      chapters?: number;
    }
  | {
      action: 'stream' | 'install';
      event: 'play-video' | 'install-app';
      nid: number;
    }
);

// Analytics information to be supplied along with the event.
export type AnalyticsData = {
  action: AnalyticsActions;
  label: string;
};

export type TypeOfAnalytics = typeof Analytics;

export default class Analytics {
  private tag: AnalyticsTag | null;

  static decodeInfo = (attributeString: string) => {
    const x = JSON_parse(decodeURIComponent(attributeString));
    const info = (typeof x === 'object' && (x as AnalyticsLabelInfo)) || null;
    if (info) {
      // data-info attributes may also be encoded as key value pairs.
      if (!Object.keys(info).length) {
        attributeString.split(/\s*,\s*/).forEach((seg) => {
          const m = seg.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
          if (m) {
            const [, k, v] = m;
            (info as any)[k] =
              typeof v === 'string' ? decodeURIComponent(v) : v;
          }
        });
      }

      return Analytics.validateInfo(info);
    }
    return {};
  };

  static encodeInfo = (info: AnalyticsLabelInfo) => {
    return encodeURIComponent(JSON_stringify(Analytics.validateInfo(info)));
  };

  static validateInfo = (info: AnalyticsLabelInfo) => {
    Object.entries(info).forEach((entry) => {
      const [k, v] = entry;
      if (
        !/^[A-Za-z0-9_-]+$/.test(k) ||
        (Array.isArray(v) &&
          v.filter(
            (x) =>
              !['string', 'boolean', 'number', 'undefined'].includes(typeof x),
          ).length) ||
        (!Array.isArray(v) &&
          !['string', 'boolean', 'number', 'undefined'].includes(typeof v))
      ) {
        delete (info as any)[k];
      }
    });

    return info;
  };

  static addInfo = (
    info: Record<string, string | number | boolean | undefined>,
    element: HTMLElement,
    replace = false,
  ) => {
    const init =
      !replace && element.dataset.info
        ? Analytics.decodeInfo(element.dataset.info)
        : {};
    element.dataset.info = Analytics.encodeInfo({
      ...init,
      ...info,
    } as AnalyticsLabelInfo);
  };

  static topInfoElement = (element: HTMLElement) => {
    let el: HTMLElement | null = element;
    while (el && !el.classList.contains('view-row')) el = el.parentElement;
    return el || element;
  };

  // Collect analytics information for an HTML element. Anchor link text, and
  // data-history-node-id and data-info attributes of self or ancestors.
  static elementInfo = (element: HTMLElement) => {
    // element specific info
    let info = {} as AnalyticsLabelInfo;
    switch (element.localName) {
      case 'a': {
        info = {
          action: 'download',
          event: 'download',
          link: element.textContent || '',
          href: (element as HTMLAnchorElement).href,
        };
        break;
      }
    }

    // context node within Drupal page or frame
    let p: HTMLElement | null = element;
    while (p && !p.hasAttribute('data-history-node-id')) p = p.parentElement;
    if (!p && frameElement) {
      p = frameElement as HTMLIFrameElement;
      while (p && !p.hasAttribute('data-history-node-id')) p = p.parentElement;
    }
    if (p) {
      (info as DownloadLinkInfo).nid =
        Number(p.getAttribute('data-history-node-id')) || 0;
    }

    // merge data-info attributes of self and ancestors
    let elem: HTMLElement | null = element;
    while (elem) {
      if (Analytics && elem.dataset.info) {
        const i = Analytics.decodeInfo(elem.dataset.info);
        if (i && typeof i === 'object') {
          Object.entries(i).forEach((entry) => {
            if (!(entry[0] in info) || !(info as any)[entry[0]]) {
              (info as any)[entry[0]] = entry[1] as any;
            }
          });
        }
      }
      elem = elem.parentElement;
    }

    return Analytics.validateInfo(info) || {};
  };

  static async getLabel(info: AnalyticsLabelInfo): Promise<string[]> {
    return new Promise((resolve) => {
      const ajax = new XMLHttpRequest();
      ajax.open(
        'GET',
        '/eventlabel?' +
          Object.entries(info)
            .map((en) => `${en[0]}=${encodeURIComponent(en[1])}`)
            .join('&'),
      );
      ajax.responseType = 'text';
      ajax.onload = () => {
        if (ajax.readyState == ajax.DONE && ajax.status === 200) {
          resolve(ajax.responseText.split('++'));
        }
        resolve([`Error ${ajax.status}`]);
      };
      ajax.send(null);
    });
  }

  log: typeof logobj;

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null, log: typeof logobj) {
    this.tag = tag;
    this.log = log;
  }

  setLog(log: typeof logobj) {
    this.log = log;
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(info: AnalyticsLabelInfo, elem: HTMLElement) {
    let i = Analytics.elementInfo(elem);
    if (info) i = { ...i, ...info };
    const { action, event } = info;
    Analytics.getLabel(i)
      .then((labels) => {
        this.recordEvent(action, event, labels);
      })
      .catch((er) => {
        this.log.error(er);
      });
  }

  recordEvent(
    action: AnalyticsActions,
    eventName: AnalyticsEvents,
    labels: string[],
  ) {
    // webapp
    if (Build.isWebApp) labels.push('webapp');

    // framehost
    const parentWin = frameElement?.ownerDocument?.defaultView as
      | Window
      | undefined;
    if (parentWin) {
      const { referrer } = document;
      if (referrer !== window.location.hostname) labels.push(referrer);
    }

    // convert to final form
    const label = labels.join('+');
    const data: AnalyticsData = {
      action,
      label,
    };

    // Send it!
    if (typeof this.tag === 'function') this.tag('event', eventName, data);
    else if (Build.isWebApp || Build.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('recordEvent: ', eventName, data);
    }
  }
}
