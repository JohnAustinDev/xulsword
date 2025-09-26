/* eslint-disable no-console */
import { JSON_parse, JSON_stringify } from '../common.ts';
import log from './log.ts';

// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class must be initialized with a globalThis tag function
// that aggregates analytics data, or if initialized with null, then recorded
// events will simply be logged to the console.

// Each event is assigned an action.
const analyticsEventActionMap = {
  chapter: 'view',
  verse: 'view',
  glossary: 'view',
  search: 'search',
  print: 'print',
  download: 'download',
  playAudio: 'stream',
  playVideo: 'stream',
  installApp: 'click',
} as const;

// This is the type of expected globalThis analytics aggregation function.
export type AnalyticsTag = (
  type: 'event',
  name: AnalyticsEvents,
  info: AnalyticsObject,
) => void;

// AnalyticsObject is the data that must be supplied when recording any event
// using the globalThis analytics aggregation function. If using GTM and Google
// Analytics for instance, a tag for each event in AnalyticsEvents must be
// created and variables for each key of AnalyticsObject must be created and
// assigned as a parameter to each tag.
export type AnalyticsObject = {
  event: AnalyticsEvents;
  action: AnalyticsActions;
  [eventParam: string]: string | number | boolean;
};

export type AnalyticsEvents = keyof typeof analyticsEventActionMap;

type AnalyticsActions = (typeof analyticsEventActionMap)[AnalyticsEvents];

export type AnalyticsInfoFinal = AnalyticsInfo & {
  origin: string;
  webapp: boolean;
};

// One of these AnalyticsInfo types is required to generate a standardized
// label. The info is sent to the server which will respond with an informative
// label. Since events happen absolutely everywhere, varied and different data
// is available at the source of the event, thus relying on the all knowing
// server is the best way to produce complete and standardized labels.
export type AnalyticsInfo = {
  event: AnalyticsEvents;
  setting?: string;
} & (
  | DownloadLinkInfo
  | BibleBrowserEventInfo
  | {
      event: keyof Pick<typeof analyticsEventActionMap, 'playAudio'>;
      AudioCode: string;
      book: string;
      chapter: number | string;
    }
  | {
      event: keyof Pick<typeof analyticsEventActionMap, 'playAudio'>;
      AudioCode: string;
      locationky: string;
    }
  | {
      event: keyof Pick<typeof analyticsEventActionMap, 'playAudio'>;
      mid: number | string;
    }
  | {
      event: keyof Pick<typeof analyticsEventActionMap, 'download'>;
      mid: number;
      chapter1?: number | string;
      chapters?: number | string;
    }
  | {
      event: keyof Pick<
        typeof analyticsEventActionMap,
        'playVideo' | 'installApp'
      >;
      nid: number | string;
      type: 'android' | 'ios' | 'kinescope' | 'youtube' | 'vimeo' | string;
      url?: string;
    }
);
export type DownloadLinkInfo = {
  event: keyof Pick<typeof analyticsEventActionMap, 'download'>;
  link: string;
  url: string;
  nid: number | string;
  setting?: string;
};
export type BibleBrowserEventInfo = {
  event: keyof Pick<
    typeof analyticsEventActionMap,
    'chapter' | 'verse' | 'search' | 'print' | 'glossary'
  >;
  module: string;
  setting?: string;
  locationvk?: string;
  locationky?: string;
  extref?: string;
  searchtxt?: string;
};

export class Analytics {
  private tag: AnalyticsTag | null;

  private settings: { [key: string]: Partial<AnalyticsInfo> };

  // A data-info attribute may have been encoded as JSON or as key value
  // pairs like data-info="mid: 1234, chapter1: 8".
  static decodeInfo = (attributeString: string) => {
    const x = JSON_parse(decodeURIComponent(attributeString));
    let info = (typeof x === 'object' && (x as Partial<AnalyticsInfo>)) || null;
    if (!info || !Object.keys(info).length) {
      info = {};
      // data-info attributes may also be encoded as key value pairs.
      attributeString.split(/\s*,\s*/).forEach((seg) => {
        const m = seg.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
        if (m) {
          const [, k, v] = m;
          (info as any)[k] = decodeURIComponent(v);
        }
      });

      return Analytics.validateInfo(info);
    }
    return info;
  };

  static encodeInfo = (info: Partial<AnalyticsInfo>) => {
    return encodeURIComponent(JSON_stringify(Analytics.validateInfo(info)));
  };

  // Remove any info that is not an expected type.
  static validateInfo = (info: Partial<AnalyticsInfo>) => {
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

  // Add to (or replace) the data-info attribute of an element.
  static addInfo = (
    info: Partial<AnalyticsInfo>,
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
    } as Partial<AnalyticsInfo>);
  };

  // Find the top level element associated with a nested element's data. Since
  // elementInfo() searches ancestors looking for data-info attributes to merge
  // data with, adding info to the top element provides necessary data for all
  // the descendants.
  static topInfoElement = (element: HTMLElement) => {
    let el: HTMLElement | null = element;
    while (el && !el.classList.contains('view-row')) el = el.parentElement;
    return el || element;
  };

  // Collect analytics information for an HTML element. Anchor link text, and
  // data-history-node-id and data-info attributes of self or ancestors.
  static elementInfo = (element: HTMLElement) => {
    // element specific info
    let info = {} as Partial<AnalyticsInfo>;
    let el: HTMLElement | null = element;
    findTypeBlock: {
      for (; el; ) {
        switch (el.localName) {
          case 'a': {
            info = {
              link: el.textContent || '',
              url: (el as HTMLAnchorElement).href,
            };
            break findTypeBlock;
          }
          case 'iframe': {
            info = { url: (el as HTMLIFrameElement).src };
            break findTypeBlock;
          }
        }
        el = el.parentElement;
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

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null) {
    this.tag = tag;
    this.settings = {};

    // GT will not send data to GA from a third-party iframe without this:
    if (tag) {
      (tag as any)('set', 'cookie_flags', 'SameSite=None;Secure');
    }
  }

  set(key: string, value: Partial<AnalyticsInfo>) {
    this.settings[key] = value;
  }

  record(info: AnalyticsInfo) {
    this.getAnalytics(info)
      .then((analytics) => {
        const { event } = analytics;
        // Send it!
        if (typeof this.tag === 'function') this.tag('event', event, analytics);
        else if (Build.isDevelopment) {
          console.log('recordEvent: ', event, analytics);
        }
      })
      .catch((er) => this.error(er));
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(info: Partial<AnalyticsInfo>, elem: HTMLElement) {
    let i = Analytics.elementInfo(elem);
    if (info) i = { ...i, ...info } as AnalyticsInfo;
    // The combination of the element's attribute info ('i') and 'info' must be
    // a complete AnalyticsInfo object or an error may result. But object
    // completeness is not checked here.
    const fullInfo = i as AnalyticsInfo;
    this.record(fullInfo);
  }

  // Send an AnalyticsInfo object to the server which will respond
  // with a complete analytics object to report.
  async getAnalytics(info: AnalyticsInfo): Promise<AnalyticsObject> {
    const infoValToString = (
      val: string | number | boolean | undefined,
    ): string => {
      if (!['string', 'number', 'boolean'].includes(typeof val)) return '';
      return encodeURIComponent((val as string | number | boolean).toString());
    };

    const replyToUnicode = (encstr: string): string => {
      return encstr.replace(/\\u([\dA-F]{4})/gi, function (_match, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
    };
    const { event } = info;
    // framehost
    const origins = window.location.ancestorOrigins ?? [];
    const origin = origins[origins.length - 1] ?? 'unknown';

    // Apply any Analytics settings specified by our info.
    const setting =
      info.setting && info.setting in this.settings
        ? this.settings[info.setting]
        : {};
    info.setting = undefined;

    const send: AnalyticsInfoFinal & { action: AnalyticsActions } = {
      ...setting,
      ...info,
      action: analyticsEventActionMap[event],
      webapp: Build.isWebApp,
      origin,
    };
    Object.entries(send).forEach((entry) => {
      if (typeof entry[1] === 'undefined') delete (send as any)[entry[0]];
    });

    if (Build.isElectronApp) return send;

    return new Promise((resolve) => {
      const ajax = new XMLHttpRequest();
      ajax.open(
        'GET',
        '/eventlabel?' +
          Object.entries(send)
            .map((en) => `${en[0]}=${infoValToString(en[1])}`)
            .join('&'),
      );
      ajax.responseType = 'text';
      ajax.onload = () => {
        if (ajax.readyState == ajax.DONE && ajax.status === 200) {
          // Server response is '"' surrounded \u0022 encoded Unicode!
          const obj = JSON_parse(
            replyToUnicode(ajax.responseText.replace(/(^"|"$)/g, '')),
          ) as AnalyticsObject;
          resolve({ ...obj, event, action: analyticsEventActionMap[event] });
        } else {
          resolve({
            event,
            action: analyticsEventActionMap[event],
            error: ajax.status,
          });
        }
      };
      ajax.send(null);
    });
  }

  error(er: any) {
    if (window.ProcessInfo.socket) log.error(er);
    else console.log('Error', er);
  }
}

let tagfunc = null;
if (typeof (globalThis as any).gtag === 'function')
  tagfunc = (globalThis as any).gtag as AnalyticsTag;

const analytics = new Analytics(tagfunc);

export default analytics;
