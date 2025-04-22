import Analytics from '../analytics.ts';
import log from './log.ts';
import type { AnalyticsTag } from '../analytics.ts';

let tagfunc = null;
if (typeof (globalThis as any).gtag === 'function')
  tagfunc = (globalThis as any).gtag as AnalyticsTag;

const analytics = new Analytics(tagfunc, log);

export default analytics;
