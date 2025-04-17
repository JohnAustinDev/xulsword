// The Analytics class allows analytics data to be collected during use of the
// App or WebApp. The class is initialized with a third party tag function
// that aggregates analytics data. Or when initialized with null, all events
// are simply logged to the console.

// Type of the third party analytics function.
export type AnalyticsTag = (
  type: 'event',
  name: string,
  info: AnalyticsInfo,
) => void;

// Analytics functions available to event handlers.
export type AnalyticsType = {
  recordElementEvent: (
    name: string,
    elem: HTMLElement,
    info: (elem: HTMLElement) => AnalyticsInfo,
  ) => void;
};

// Analytics information to be supplied along with the event.
export type AnalyticsInfo = {
  [k: string]: string | string[] | boolean | undefined;
};

export default class Analytics implements AnalyticsType {
  private tag: AnalyticsTag | null;

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
