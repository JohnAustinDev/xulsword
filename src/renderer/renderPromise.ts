
import { GCacheKey, JSON_stringify, isCallCacheable } from "../common.ts";
import Cache from '../cache.ts';
import { GBuilder } from "../type.ts";
import C from "../constant.ts";
import { GA } from "./rg";
import log from "./log.ts";

import type { GAType, GCallType, GType, PrefValue } from "../type.ts";
import type { GetBooksInVKModules } from "../main/minit.ts";

export interface RenderPromiseComponent {
  renderPromise: RenderPromise;
}

export type RenderPromiseState = {
  renderPromiseID: number;
}

// In browser context, no synchronous G calls are allowed, so either the
// data must be preloaded into the cache, or must be returned with a promise.
// This function first looks for each call in the cache. For calls that are not
// in the cache, the result is retrieved syncronously using G.callBatch when sync
// is allowed. Or, when sync is not allowed, calls that are not in the cache are
// added to the parent component's renderPromise call list, and a default value
// is returned.
export function trySyncOrPromise(
  G: GType,
  promise: RenderPromise | null,
  calls: GCallType[],
  defaultValues?: PrefValue[]
): PrefValue[] {
  if (window.processR.platform !== 'browser') {
    const results = calls.map((call) => getCallFromCache(call));
    callBatchThenCacheSync(G, calls.filter((_gc, i) => results[i] === undefined));
    return getCallsFromCacheAndClear(calls);
  } else if (promise) {
    const results = getCallsFromCacheAndClear(calls);
    promise.calls.push(...calls.filter((_gc, i) => results[i] === undefined));
    return results.map((r, i) => defaultValues && r === undefined ? defaultValues[i] : r);
  }
  throw new Error(`In this context trySyncOrPromise requires the promise argument: ${JSON_stringify(calls)}`);
}

export default class RenderPromise {
  component: React.Component;

  calls = [] as GCallType[];

  constructor(component: React.Component) {
    this.component = component;
  }

  waiting(): boolean {
    return !!(this.calls.length);
  }

  dispatch() {
    // Add calls to the global list, then wait a bit, request list results
    // from the server, cache the results, then re-render the requesting
    // components.
    window.renderPromises.push(this);
    setTimeout(async () => {
      const calls: GCallType[] = [];
      const components: React.Component[] = [];
      const renders: (() => void)[] = [];
      window.renderPromises.forEach((rp) => {
        calls.concat(rp.calls);
        if (!components.find((c) => c === rp.component)) {
          components.push(rp.component);
          renders.push(() => {
            if (window.processR.XULSWORD_ENV() === 'development') {
              console.log(`Component reload: ${JSON_stringify(calls)}`);
            }
            rp.component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
          });
        }
      });
      window.renderPromises = [];

      const calls2 = calls.filter((call) => {
        return !isCallCacheable(GBuilder, call) || !Cache.has(promiseCacheKey(call))
      });
      if (calls2.length) await callBatchThenCache(GA, calls2);
      renders.forEach((r) => r());
    }, C.UI.Window.networkRequestBatchDelay);
  }
}

export function callBatchThenCacheSync(
  G: GType,
  calls: GCallType[]
) {
  const disallowed = disallowedAsCallBatch(calls);
  if (!disallowed) {
    const results = G.callBatch(calls);
    if (results.length !== calls.length) {
      throw new Error(`callBatch sync did not return the correct data.`);
    }
    calls.forEach((call, i) => writeCallToCache(call, results[i]));
  } else if (typeof disallowed === 'string') {
    throw new Error(disallowed);
  }
}

export async function callBatchThenCache(
  GA: GAType,
  calls: GCallType[],
): Promise<void> {

  const disallowed = disallowedAsCallBatch(calls);
  if (!disallowed) {
    let results;
    try {
      results = await GA.callBatch(calls);
    } catch (er) {
      log.error(er);
      results = [];
    }
    if (results.length !== calls.length) {
      throw new Error(`callBatch async did not return the correct data.`);
    }
    calls.forEach((call, i) => writeCallToCache(call, results[i]));
  } else if (typeof disallowed === 'string') {
    throw new Error(disallowed);
  }
}

function disallowedAsCallBatch(calls: GCallType[]): string | boolean {
  // All callBatch calls must be synchronous capable, so check.
  const { asyncFuncs } = GBuilder;
  const asyncCall = calls.find(
    (c) => asyncFuncs.find(
      (a) => a[0] === c[0] && (!c[1] || (a[1] as any).includes(c[1]))
    )
  );
  if (asyncCall !== undefined) {
    return `G.callBatch member must not be async: ${asyncCall}`;
  }

  if (calls.some((call) => call[0] === 'callBatch')) {
    return `Calling a batch of batches is not allowed.`;
  }

  return false;
}

// Even 'uncacheable' G data is cached for a time. Then if all
// values are succesfully returned, the 'uncacheable' data is cleared
// from the cache after a delay.
function getCallsFromCacheAndClear(calls: GCallType[]) {
  const results = calls.map((call) => getCallFromCache(call));
  const success = !results.some((r) => r === undefined);
  if (success) {
    calls.forEach((call) => {
      const cacheKey = promiseCacheKey(call);
      if (!isCallCacheable(GBuilder, call)) setTimeout(
        () => Cache.clear(cacheKey),
        C.UI.Window.networkRequestMinCache
      );
    });
  }

  return results;
}

function getCallFromCache(call: GCallType | null): PrefValue | undefined {
  let result: (PrefValue | undefined) = undefined;
  if (call) {
    const cacheKey = promiseCacheKey(call);
    if (Cache.has(cacheKey)) result = Cache.read(cacheKey);
  }
  return result;
}

// Even 'uncacheable' G data is cached for a time. Then if all
// values are succesfully returned, the 'uncacheable' data is cleared
// from the cache at that time.
function writeCallToCache(call: GCallType | null, result: any) {
  if (call) {
    const cacheKey = promiseCacheKey(call);
    if (!Cache.has(cacheKey)) Cache.write(result, cacheKey);

    // Some calls will return data that is identical to other calls, so preload the cache
    // for those others as well.
    if (call[0] === 'GetBooksInVKModules') {
      Object.entries(result as ReturnType<typeof GetBooksInVKModules>).forEach((entry) => {
        const [module, bookArray] = entry;
        const k = GCacheKey(['getBooksInVKModule', null, [module]]);
        if (!Cache.has(k)) Cache.write(bookArray, k);
      });
    }
  }
}

function promiseCacheKey(acall: GCallType): string {
  const ckey = GCacheKey(acall);
  const cacheable = isCallCacheable(GBuilder, acall);
  if (cacheable) return ckey;
  // Non-cacheable data will be cached and used and then deleted after some delay.
  return `x-${ckey}`;
}
