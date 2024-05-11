
import { GCacheKey, JSON_stringify, clone, diff, isCallCacheable } from "../common.ts";
import Cache from '../cache.ts';
import { GBuilder } from "../type.ts";
import C from "../constant.ts";
import G, { GA } from "./rg";

import type { GAType, GCallType, GType, PrefValue } from "../type.ts";
import type { GetBooksInVKModules } from "../main/minit.ts";

export interface RenderPromiseComponent {
  renderPromise: RenderPromise;
}

export type RenderPromiseState = {
  renderPromiseID: number;
}

export default class RenderPromise {
  component: React.Component;

  calls = [] as GCallType[];

  uncacheableCalls = {} as {
    [key: string]: {
      promise: Promise<any>;
      resolved: any;
    };
  };

  constructor(component: React.Component) {
    this.component = component;
  }

  waiting(): boolean {
    return !!(this.calls.length || Object.keys(this.uncacheableCalls).length);
  }

  dispatch() {
    Object.entries(this.uncacheableCalls).forEach((entry) => {
      const [key, v] = entry;
      v.promise.then((r) => {
        this.uncacheableCalls[key].resolved = r;
        if (window.processR.XULSWORD_ENV() === 'development') {
          console.log(`Component reload: ${key}`);
        }
        this.component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
      });
    });

    // Add cacheable calls to global queue, wait a bit, then handle
    // them all-together.
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
      if (calls.length) {
        await callBatchThenCache(GA, calls);
        renders.forEach((r) => r());
      }
    }, C.UI.Window.networkRequestBatchDelay);
  }
}

type PreloadGCallType = { call: GCallType; def: any };

type PreloadCheckType = { check: { [variable: string]: any }};

export class PreloadData {
  calls: { call: GCallType; def: any }[];

  adds: number[];

  addsCheck: PreloadCheckType[];

  results: any[];

  renderPromise: RenderPromise | null;

  dispatched: boolean;

  constructor(renderPromise: RenderPromise | null) {
    this.calls = [];
    this.results = [];
    this.adds = [];
    this.addsCheck = [];
    this.renderPromise = renderPromise;
    this.dispatched = false;
  }

  dispatch() {
    const results = trySyncOrRenderPromise(
      G,
      GA,
      ['callBatch', null, [this.calls.map((c: PreloadData['calls'][number]) => c.call)]],
      this.renderPromise
    ) as PrefValue[] | undefined;
    this.results = results === undefined
      ? this.calls.map(() => undefined)
      : results;
    this.dispatched = true;
  }

  used() {
    return this.calls.length > 0;
  }

  use(...argsx: (PreloadGCallType | PreloadCheckType)[]) {
    const args = argsx.filter((x) => 'call' in x) as PreloadGCallType[];
    const checksx = argsx.filter((x) => 'check' in x) as PreloadCheckType[];
    const check = { check: {} } as PreloadCheckType;
    checksx.forEach((ch) => {
      Object.entries(ch.check).forEach((entry) => {
        const [variable, val] = entry;
        check.check[variable] = val;
      });
    });
    if (!this.dispatched) {
      this.calls.push(...args);
      this.adds.push(args.length);
      this.addsCheck.push(clone(check));
      return args.map(() => undefined);
    } else {
      if (!this.adds.length) {
        throw new Error(`All PreloadData has been used.`);
      }
      const count = this.adds.shift();
      const calls = this.calls.splice(0, count);
      if (calls.length !== count) {
        throw new Error(`Improper PreloadData usage. Call mismatch: '${
          calls.length}' !== '${count}'`);
      }
      const results = this.results.splice(0, count);
      if (results.length !== count) {
        throw new Error(`Improper PreloadData usage. Result mismatch: '${
          results.length}' !== '${count}'`);
      }
      const checks = this.addsCheck.shift();
      if (checks && Object.keys(check.check).length) {
        Object.entries(checks.check).forEach((entry) => {
          const [origVar, origVal] = entry;
          if (diff(check.check[origVar], origVal) !== undefined) {
            throw new Error(`PreloadData argument value changed: ${origVar} was '${
              JSON_stringify(origVal)}' is '${JSON_stringify(check.check[origVar])}'`);
          }
        });
      }

      return results.map((r, x) => r === undefined ? calls[x].def : r);
    }
  }

}

// In browser context, synchronous G calls are not allowed, so either the
// data must be preloaded into the cache, or must be returned with a promise.
// This function checks the cache and renderPromises for the data and returns
// it if it is found. Otherwise if not in browser context, the data is retrieved
// syncronously using G, or when sync is not allowed, it returns a promise for
// the data which will be obtained asynchronously. Promises for cacheable data
// are not dispatched until handleRenderPromises() is called to dispatch them
// together, requiring fewer network traversals to obtain the data. But non
// cacheable data is dispatched immediately, and saved locally, and consumed
// after the component is re-rendered.
function trySyncOrRenderPromise(
  G: GType,
  GA: GAType,
  gcall: GCallType,
  promise: RenderPromise | null,
): PrefValue | undefined {
  const key = GCacheKey(gcall);
  if (promise?.uncacheableCalls[key]?.resolved) {
    const result = promise.uncacheableCalls[key]?.resolved;
    delete promise.uncacheableCalls[key];
    return result; // previous uncacheable data's promise is resolved!
  }
  if (Cache.has(key)) return Cache.read(key); // data in the cache!
  if (window.processR.platform !== 'browser') {
    const [name, _method, args] = gcall;
    let calls;
    if (name === 'callBatch' && Array.isArray(args)) {
      calls = args[0] as GCallType[];
    } else calls = [gcall];
    return callBatchThenCacheSync(G, calls);
  } else if (promise) {
    const g: any = GA;
    const [name, method, args] = gcall;
    if (name in g) {
      if (!method && typeof args === undefined) {
        promise.calls.push(gcall)
      } else if (!method && Array.isArray(args)) {
        const cacheable = GBuilder[name]();
        if (cacheable) promise.calls.push(gcall);
        else if (!(key in promise.uncacheableCalls)) {
          promise.uncacheableCalls[key] = {
            promise: g[name](...args),
            resolved: undefined,
          };
        }
      } else if (typeof method === 'string' && method in g[name] && args === undefined) {
        promise.calls.push(gcall)
      } else if (typeof method === 'string' && method in g[name] && Array.isArray(args)) {
        const cacheable = GBuilder[name][method]();
        if (cacheable) promise.calls.push(gcall);
        else if (!(key in promise.uncacheableCalls)) {
          promise.uncacheableCalls[key] = {
            promise: g[name][method](...args),
            resolved: undefined,
          };
        }
      }
      return undefined; // must wait for the data!
    }
    throw new Error(`Bad gtype=${g.gtype} call: ${gcall}`);
  }
  throw new Error(`In this context trySyncOrPromise requires the promise argument: ${gcall}`);
}

export function callBatchThenCacheSync(
  G: GType,
  calls: GCallType[]
): any[] {
  // All calls must be synchronous, so check.
  const { asyncFuncs } = GBuilder;
  const asyncCall = calls.find(
    (c) => asyncFuncs.find(
      (a) => a[0] === c[0] && (!c[1] || (a[1] as any).includes(c[1]))
    )
  );
  if (asyncCall !== undefined) {
    throw new Error(`G.callBatch member must not be async: ${asyncCall}`);
  }

  const resp = getCallsFromCache(calls);

  if (calls.find((c) => c !== null)) {
    const respSync = G.callBatch(calls);
    if (respSync.length !== calls.length) {
      throw new Error(`callBatch sync did not return the correct data.`);
    }
    respSync.forEach((v, x) => {if (v !== null) resp[x] = v});
  }

  writeCallsToCache(calls, resp);

  return resp;
}

export async function callBatchThenCache(
  GA: GAType,
  calls: GCallType[]
): Promise<any[]> {
  // The calls must be synchronous, so check.
  const { asyncFuncs } = GBuilder;
  const asyncCall = calls.find(
    (c) => asyncFuncs.find(
      (a) => a[0] === c[0] && (!c[1] || (a[1] as any).includes(c[1]))
    )
  );
  if (asyncCall !== undefined) {
    throw new Error(`G.callBatch member must not be async: ${asyncCall}`);
  }

  const resp = getCallsFromCache(calls);

  if (calls.find((c) => c !== null)) {
    const respAsync = await GA.callBatch(calls);
    if (respAsync.length !== calls.length) {
      throw new Error(`callBatch async did not return the correct data.`);
    }
    respAsync.forEach((v, x) => {if (v !== null) resp[x] = v});
  }

  writeCallsToCache(calls, resp);

  return resp;
}

function getCallsFromCache(calls: (GCallType | null)[]): (PrefValue | undefined)[] {
  const results: (PrefValue | undefined)[] = [];
  for (let x = 0; x < calls.length; x++) {
    let result = undefined;
    const call = calls[x];
    if (call && isCallCacheable(call)) {
      const cacheKey = GCacheKey(call);
      if (Cache.has(cacheKey)) {
        result = Cache.read(cacheKey);
        calls[x] = null;
      }
    }
    results.push(result);
  }

  return results;
}

function writeCallsToCache(calls: (GCallType | null)[], resp: any[]) {
  for (let x = 0; x < calls.length; x++) {
    const acall = calls[x];
    const aresult = resp[x];
    if (acall) {
      if (isCallCacheable(acall)) {
        const cacheKey = GCacheKey(acall);
        Cache.write(aresult, cacheKey);
      }

      // Some calls return data that is identical to other calls, so preload the cache
      // for those others as well.
      if (acall[0] === 'GetBooksInVKModules') {
        Object.entries(aresult as ReturnType<typeof GetBooksInVKModules>).forEach((entry) => {
          const [module, bookArray] = entry;
          const k = GCacheKey(['getBooksInVKModule', null, [module]]);
          Cache.write(bookArray, k);
        });
      }
    }
  }
}
