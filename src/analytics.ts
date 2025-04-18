// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class is initialized with a third party tag function
// that aggregates analytics data. Or when initialized with null, all events
// are simply logged to the console.

import { JSON_parse, JSON_stringify } from './common.ts';

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

  // A null tag will log hits to the console, instead of reporting them.
  constructor(tag: AnalyticsTag | null) {
    this.tag = tag;
  }

  // Record an event triggered by any HTML element.
  recordElementEvent(
    name: string,
    elem: HTMLElement,
    info: (elem: HTMLElement) => AnalyticsInfo,
  ) {
    this.recordEvent(name, info(elem));
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
