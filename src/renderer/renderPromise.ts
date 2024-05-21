
import { GCacheKey, JSON_stringify, isCallCacheable } from "../common.ts";
import Cache from '../cache.ts';
import { GBuilder } from "../type.ts";
import C from "../constant.ts";
import G from './rg.ts';

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
export function GCallsOrPromise(
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

// A render promise is associated with a React component. When rendering of that
// component requires data that is not available in the cache, a call for that data
// is added to the component's render promise. Render promises from all components
// are periodically processed, all at the same time. A batch of required data is
// requested from the server and each component is guaranteed to be re-rendered at
// least once after all its required data is available.
export default class RenderPromise {
  component: React.Component;

  calls = [] as GCallType[];

  static batchDispatch() {
    const docalls: GCallType[] = [];
    const dorender: React.Component[] = [];
    RenderPromise.getGlobalRenderPromises().forEach((rp) => {
      if (rp.calls.length) {
        if (!dorender.find((c) => c === rp.component)) {
          dorender.push(rp.component);
        }
        while(rp.calls.length) docalls.push(rp.calls.shift() as GCallType);
      }
    });
    RenderPromise.setGlobalRenderPromises([]);

    const nextBatch = docalls.filter((call) => {
      return !isCallCacheable(GBuilder, call) || !Cache.has(promiseCacheKey(call))
    });

    callBatchThenCache(flatPrune(nextBatch)).then((_success) => {
      dorender.forEach((component) => {
        component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
      });
    });
  }

  static getGlobalRenderPromises(): RenderPromise[] {
    if (Cache.has('renderPromises')) {
      return Cache.read('renderPromises') as RenderPromise[];
    } else return [];
  }

  static setGlobalRenderPromises(rps: RenderPromise[]): void {
    if (Cache.has('renderPromises')) Cache.clear('renderPromises');
    Cache.write(rps, 'renderPromises');
  }

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
    const { calls } = this;
    if (calls.length) {
      const rps = RenderPromise.getGlobalRenderPromises();
      rps.push(this);
      RenderPromise.setGlobalRenderPromises(rps);
      setTimeout(() => RenderPromise.batchDispatch(), C.UI.Window.networkRequestBatchDelay);
    }
  }
}

export function callBatchThenCacheSync(
  calls: GCallType[]
) {
  if (calls.length) {
    const disallowed = disallowedAsCallBatch(calls);
    if (!disallowed) {
      const results = G.callBatchSync(calls);
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
      const results = await G.callBatch(calls);
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
  // Non-cacheable data will be cached and then deleted after some delay.
  return isCallCacheable(GBuilder, acall) ? ckey : `x-${ckey}`;
}

function flatcalls(calls: GCallType[]): GCallType[] {
  const flat: GCallType[] = [];
  for (let i = 0; i < calls.length; i++) {
    if (['callBatch', 'callBatchSync'].includes(calls[i][0])) {
      const args = calls[i][2];
      if (Array.isArray(args)) {
        const batchcalls = args[1] as GCallType[];
        flat.push(...batchcalls);
      }
    } else flat.push(calls[i]);
  }
  return flat;
}


function flatPrune(calls: GCallType[]): GCallType[] {
  const flat = flatcalls(calls);
  for (let i = 0; i < flat.length; i++) {
    if (flat[i]) {
      const ckey = promiseCacheKey(flat[i]);
      for(;;) {
        const x = flat.findIndex((c, i2) => i2 > i && promiseCacheKey(c) === ckey);
        if (x === -1) break;
        flat.splice(x, 1);
      }
    }
  }
  return flat;
}
