/* eslint-disable @typescript-eslint/naming-convention */
import { JSON_parse, JSON_stringify } from './common.ts';

// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class must be initialized with a globalThis tag function
// that aggregates analytics data, or else if initialized with null, recorded
// events will simply be logged to the console.

// Each event is assigned an action.
const analyticsEventActionMap = {
  'bb-chapter': 'view',
  'bb-verse': 'view',
  'bb-glossary': 'view',
  'bb-search': 'search',
  'bb-print': 'print',
  download: 'download',
  'play-audio': 'stream',
  'play-video': 'stream',
  'install-app': 'click',
} as const;

// This is the type of expected globalThis analytics aggregation function.
export type AnalyticsTag = (
  type: 'event',
  name: AnalyticsEvents,
  info: AnalyticsData,
) => void;

// AnalyticsData is the data that must be supplied when recording any event
// using the globalThis analytics aggregation function. If using GTM and Google
// Analytics for instance, a tag for each event in AnalyticsEvents must be
// created and variables for each key of AnalyticsData must be created and
// assigned as a parameter to each tag.
export type AnalyticsData = {
  event: AnalyticsEvents;
  action: AnalyticsActions;
  label: string;
};

export type AnalyticsEvents = keyof typeof analyticsEventActionMap;

type AnalyticsActions = (typeof analyticsEventActionMap)[AnalyticsEvents];

// One of these AnalyticsLabelInfo types is required to generate a standardized
// label. The info is sent to the server which will respond with an informative
// label. Since events happen absolutely everywhere, varied and different data
// is available at the source of the event, thus relying on the all knowing
// server is the easiest way to produce complete and standardized labels.
export type DownloadLinkInfo = {
  event: 'download';
  link: string;
  href: string;
  nid: number | string;
};
export type BibleBrowserEventInfo = {
  event: 'bb-chapter' | 'bb-verse' | 'bb-search' | 'bb-print' | 'bb-glossary';
  module: string;
  target: string;
};
export type AnalyticsLabelInfo = {
  event: AnalyticsEvents;
} & (
  | DownloadLinkInfo
  | BibleBrowserEventInfo
  | {
      event: 'play-audio';
      AudioCode: string;
      book: string;
      chapter: number | string;
    }
  | {
      event: 'play-audio';
      AudioCode: string;
      key: string;
    }
  | {
      event: 'play-audio';
      mid: number | string;
    }
  | {
      event: 'download';
      mid: number;
      chapter1?: number | string;
      chapters?: number | string;
    }
  | {
      event: 'play-video' | 'install-app';
      nid: number | string;
    }
);

export class Analytics {
  private tag: AnalyticsTag | null;

  // A data-info attribute may have been encoded as JSON or as key value
  // pairs like data-info="mid: 1234, chapter1: 8".
  static decodeInfo = (attributeString: string) => {
    const x = JSON_parse(decodeURIComponent(attributeString));
    const info =
      (typeof x === 'object' && (x as Partial<AnalyticsLabelInfo>)) || null;
    if (info) {
      // data-info attributes may also be encoded as key value pairs.
      if (!Object.keys(info).length) {
        attributeString.split(/\s*,\s*/).forEach((seg) => {
          const m = seg.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
          if (m) {
            const [, k, v] = m;
            (info as any)[k] = decodeURIComponent(v);
          }
        });
      }

      return Analytics.validateInfo(info);
    }
    return {};
  };

  static encodeInfo = (info: Partial<AnalyticsLabelInfo>) => {
    return encodeURIComponent(JSON_stringify(Analytics.validateInfo(info)));
  };

  // Remove any info that is not an expected type.
  static validateInfo = (info: Partial<AnalyticsLabelInfo>) => {
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
    info: Partial<AnalyticsLabelInfo>,
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
    } as Partial<AnalyticsLabelInfo>);
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
    let info = {} as Partial<AnalyticsLabelInfo>;
    switch (element.localName) {
      case 'a': {
        info = {
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

  // Pass an AnalyticsLabelInfo object to the server which will respond
  // with a complete standardized label for reporting to analytics.
  static async getLabel(info: AnalyticsLabelInfo): Promise<string> {
    const infoValToString = (val: string | number | boolean): string => {
      return encodeURIComponent(val.toString());
    };

    const replyToUnicode = (encstr: string): string => {
      return encstr.replace(/\\u([\dA-F]{4})/gi, function(_match, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
    }

    // framehost
    let host = window.location.hostname;
    const parentWin = frameElement?.ownerDocument?.defaultView as
      | Window
      | undefined;
    if (parentWin) ({ referrer: host } = document);

    const allinfo: AnalyticsLabelInfo & { webapp?: boolean; host?: string } = {
      ...info,
      webapp: Build.isWebApp,
      host
    };

    return new Promise((resolve) => {
      const ajax = new XMLHttpRequest();
      ajax.open(
        'GET',
        '/eventlabel?' +
          Object.entries(allinfo)
            .map((en) => `${en[0]}=${infoValToString(en[1])}`)
            .join('&'),
      );
      ajax.responseType = 'text';
      ajax.onload = () => {
        if (ajax.readyState == ajax.DONE && ajax.status === 200) {
          // Server response is '"' surrounded \u0022 encoded Unicode!
          resolve(replyToUnicode(ajax.responseText.replace(/(^"|"$)/g, '')));
        }
        resolve(`Error ${ajax.status}`);
      };
      ajax.send(null);
    });
  }

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null) {
    this.tag = tag;
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(info: Partial<AnalyticsLabelInfo>, elem: HTMLElement) {
    let i = Analytics.elementInfo(elem);
    if (info) i = { ...i, ...info } as AnalyticsLabelInfo;
    // The combination of the element's attribute info ('i') and 'info' must be
    // a complete AnalyticsLabelInfo object or an error may result during
    // getLabel. But object completeness is not checked here.
    const fullInfo = i as AnalyticsLabelInfo;
    const { event } = fullInfo;
    Analytics.getLabel(fullInfo)
      .then((label) => {
        this.recordEvent(event, label);
      })
      .catch((er) => {
        // eslint-disable-next-line no-console
        console.log(er);
      });
  }

  recordEvent(event: AnalyticsEvents, label: string) {
    // convert to final form
    const data: AnalyticsData = {
      event,
      action: analyticsEventActionMap[event],
      label,
    };

    // Send it!
    if (typeof this.tag === 'function') this.tag('event', event, data);
    else if (Build.isWebApp || Build.isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('recordEvent: ', event, data);
    }
  }
}

let tagfunc = null;
if (typeof (globalThis as any).gtag === 'function')
  tagfunc = (globalThis as any).gtag as AnalyticsTag;

const analytics = new Analytics(tagfunc);

export default analytics;
