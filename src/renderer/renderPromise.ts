
import { GCacheKey, JSON_stringify, isCallCacheable } from "../common.ts";
import Cache from '../cache.ts';
import { GBuilder } from "../type.ts";
import C from "../constant.ts";
import G from '../renderer/rg.ts';

import type { GCallType, PrefValue } from "../type.ts";
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
  calls: GCallType[],
  defaultValues?: PrefValue[],
  promise?: RenderPromise | null,
): PrefValue[] {
  if (window.processR.platform !== 'browser') {
    const results = calls.map((call) => getCallFromCache(call));
    callBatchThenCacheSync(calls.filter((_gc, i) => results[i] === undefined));
    return getCallsFromCacheAndClear(calls);
  } else if (promise) {
    const presults = getCallsFromCacheAndClear(calls);
    if (presults.some((r) => r === undefined)) {
      const pcalls = calls.filter((_call, i) => presults[i] === undefined);
      promise.calls.push(...pcalls);
    }
    return presults.map((r, i) => defaultValues && r === undefined ? defaultValues[i] : r);
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

  getGlobalRenderPromises(): RenderPromise[] {
    if (Cache.has('renderPromises')) {
      return Cache.read('renderPromises') as RenderPromise[];
    } else return [];
  }

  setGlobalRenderPromises(rps: RenderPromise[]): void {
    if (Cache.has('renderPromises')) Cache.clear('renderPromises');
    Cache.write(rps, 'renderPromises');
  }

  dispatch() {
    // Add calls to the global list, then wait a bit, request list results
    // from the server, cache the results, then re-render the requesting
    // components.
    const { calls } = this;
    if (calls.length) {
      const rps = this.getGlobalRenderPromises();
      rps.push(this);
      this.setGlobalRenderPromises(rps);
      setTimeout(() => {
        const calls: GCallType[] = [];
        const components: React.Component[] = [];
        const rps = this.getGlobalRenderPromises();
        this.setGlobalRenderPromises([]);
        rps.forEach((rp) => {
          if (rp.calls.length) {
            if (!components.find((c) => c === rp.component)) {
              components.push(rp.component);
            }
            while(rp.calls.length) calls.push(rp.calls.shift() as GCallType);
          }
        });

        const callsStillNeeded = calls.filter((call) => {
          return !isCallCacheable(GBuilder, call) || !Cache.has(promiseCacheKey(call))
        });

        callBatchThenCache(callsStillNeeded).then(() => {
          components.forEach((component) => {
            component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
          });
        });

      }, C.UI.Window.networkRequestBatchDelay);
    }
  }
}

export function callBatchThenCacheSync(
  calls: GCallType[]
) {
  if (calls.length) {
    const disallowed = disallowedAsCallBatch(calls);
    if (!disallowed) {
      const results = G.callBatchSync(prune(calls));
      if (results.length !== calls.length) {
        throw new Error(`callBatch sync did not return the correct data.`);
      }
      calls.forEach((call, i) => writeCallToCache(call, results[i]));
    } else if (typeof disallowed === 'string') {
      throw new Error(disallowed);
    }
  }
}

export async function callBatchThenCache(
  calls: GCallType[],
): Promise<boolean> {
  if (calls.length) {
    const disallowed = disallowedAsCallBatch(calls);
    if (!disallowed) {
      const results = await G.callBatch(prune(calls));
      if (results.length !== calls.length) {
        throw new Error(`callBatch async did not return the correct data.`);
      }
      calls.forEach((call, i) => writeCallToCache(call, results[i]));
    } else if (typeof disallowed === 'string') {
      throw new Error(disallowed);
    }
  }

  return true;
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
function getCallsFromCacheAndClear(calls: GCallType[]): PrefValue[] {
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
  if (call && result !== undefined) {
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
  if (isCallCacheable(GBuilder, acall)) return ckey;
  // Non-cacheable data will be cached and used and then deleted after some delay.
  return `x-${ckey}`;
}

// Remove duplicate calls from a batch.
function prune(calls: GCallType[]): GCallType[] {
  for (let i = 0; i < calls.length; i++) {
    if (calls[i]) {
      const ckey = promiseCacheKey(calls[i]);
      const x = calls.findIndex((c, i2) => i2 > i && promiseCacheKey(c) === ckey);
      if (x !== -1) calls.splice(x, 1);
    }
  }
  return calls;
}
