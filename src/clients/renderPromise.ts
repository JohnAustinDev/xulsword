import {
  GCacheKey,
  JSON_stringify,
  gcallResultCompression,
  isCallCacheable,
} from '../common.ts';
import Cache from '../cache.ts';
import { GBuilder } from '../type.ts';
import C from '../constant.ts';
import { G } from './G.ts';
import log from './log.ts';
import { callResultDecompress } from './common.ts';

import type {
  BookType,
  GCallType,
  GType,
  PrefValue,
  ServerWait,
  TabType,
} from '../type.ts';
import type { getBooksInVKModules } from '../servers/common.ts';

export type RenderPromiseComponent = {
  renderPromise: RenderPromise;
  loadingRef: React.RefObject<HTMLElement>;
};

export type RenderPromiseState = {
  renderPromiseID: number;
};

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
  const cached = calls.map((call) => getCallFromCache(call));
  const notCached = calls.filter((_gc, i) => cached[i] === undefined);
  if (notCached.length === 0) return getCallsFromCacheAndClear(calls);
  else if (Build.isElectronApp) {
    callBatchThenCacheSync(notCached);
    return getCallsFromCacheAndClear(calls);
  }
  if (promise) {
    const { callback } = promise;
    if (callback !== null) {
      const presults = getCallsFromCacheAndClear(calls);
      if (presults.some((r) => r === undefined)) {
        const pcalls = calls.filter((_call, i) => presults[i] === undefined);
        promise.calls.push(...pcalls);
      }
      return presults.map((r, i) =>
        defaultValues && r === undefined ? defaultValues[i] : r,
      );
    }
    throw new Error(
      `A null renderPromise was passed in a context that requires a non-null render promise:  ${JSON_stringify(calls)}`,
    );
  }
  throw new Error(
    `In this context trySyncOrPromise requires the promise argument: ${JSON_stringify(calls)}`,
  );
}

// A RenderPromise is associated with a React component or a callback function.
// A RenderPromise promises to re-render the component, or call the callback,
// each time the RenderPromise's calls are resolved. When data is required that
// is not available in the cache, a call for that data is then added to the
// RenderPromise, which must at some point be dispatched. At scheduled times,
// all dispatched RenderPromises are periodically processed at the same time.
// A batch of required data is requested from the server and each component is
// guaranteed to be re-rendered, or each callback called, at least once, after
// its RenderPromise data becomes available.
export default class RenderPromise {
  calls: GCallType[];

  callback: (() => void) | null;

  loadingRef: React.RefObject<HTMLElement>;

  pendingCalls: GCallType[];

  loadingSelector: string;

  type: 'classComponent' | 'functionComponent' | 'callback';

  static renderPromises: RenderPromise[] = [];

  static dispatchTO: NodeJS.Timeout | undefined;

  static retryDelay: number | undefined;

  static batchDispatch() {
    if (RenderPromise.dispatchTO) {
      clearTimeout(RenderPromise.dispatchTO);
    }
    RenderPromise.dispatchTO = setTimeout(
      () => RenderPromise.doBatchDispatch(),
      RenderPromise.retryDelay || C.Server.networkRequestBatchDelay,
    );
  }

  static doBatchDispatch() {
    RenderPromise.dispatchTO = undefined;
    const { renderPromises } = RenderPromise;
    if (renderPromises.length) {
      const pendingRPs = renderPromises.map((rp) => {
        const { callback, loadingRef, loadingSelector } = rp;
        const nrp = new RenderPromise(callback, loadingRef, loadingSelector);
        nrp.calls = rp.calls;
        rp.pendingCalls.push(...rp.calls);
        rp.calls = [];
        return nrp;
      });
      RenderPromise.renderPromises = [];

      const nextBatch = pendingRPs.reduce<GCallType[]>((p, c) => {
        const calls = c.calls.filter((call) => {
          return (
            !isCallCacheable(GBuilder, call) ||
            !Cache.has(promiseCacheKey(call))
          );
        });
        p.push(...calls);
        return p;
      }, []);

      callBatchThenCache(flatPrune(nextBatch))
        .then((pleaseWait) => {
          if (!pleaseWait) {
            RenderPromise.retryDelay = undefined;
            const callbackDone: Array<React.Component | (() => void)> = [];
            pendingRPs.forEach((prp, i) => {
              const { callback } = prp;
              if (callback && !callbackDone.includes(callback)) {
                // Resolve pendingCalls before callback so that the callback
                // can read correct renderPromise.waiting() value.
                resolveRP(renderPromises[i], prp);
                callback();
                callbackDone.push(callback);
                setLoadingClass(prp, false);
              }
            });
          } else {
            // The server has asked us to wait and try again!
            renderPromises.forEach((rp) => {
              rp.calls.push(...rp.pendingCalls);
              rp.pendingCalls = [];
              const { renderPromises } = RenderPromise;
              // rp may have been dispatched again during callBatchThenCache,
              // so check we aren't adding duplicate instances to the list.
              if (!renderPromises.includes(rp)) renderPromises.push(rp);
            });
            if (!RenderPromise.retryDelay) {
              RenderPromise.retryDelay = 2500;
            } else if (pleaseWait === 'RATE LIMITED') {
              const { retryDelay } = RenderPromise;
              if (retryDelay < 24 * 60 * 60 * 1000)
                RenderPromise.retryDelay = 2 * retryDelay;
            }
            log.verbose(
              `Retrying dispatch after ${pleaseWait} ${RenderPromise.retryDelay} ms.`,
            );
            RenderPromise.batchDispatch();
          }
        })
        .catch((er) => {
          log.error(er);
        });
    }
  }

  static pleaseWait(result: unknown) {
    let pleaseWait: ServerWait['pleaseWait'] | '' = '';
    if (result && typeof result === 'object' && 'pleaseWait' in result)
      ({ pleaseWait } = result as ServerWait);
    return pleaseWait;
  }

  // If componentOrCallback is null, then an error will be thrown if the
  // runtime context requires a promise.
  constructor(
    componentOrCallback:
      | (React.Component & RenderPromiseComponent)
      | (() => void)
      | null,
    loadingRef?: React.RefObject<HTMLElement> | null,
    loadingSelector?: string,
  ) {
    this.loadingRef = loadingRef || { current: null };
    this.calls = [];
    this.pendingCalls = [];
    this.loadingSelector = loadingSelector || '';
    if (componentOrCallback && 'setState' in componentOrCallback) {
      this.type = 'classComponent';
      this.callback = () => {
        componentOrCallback.setState({
          renderPromiseID: Math.random(),
        } as RenderPromiseState);
      };
    } else if (typeof componentOrCallback === 'function') {
      this.type = 'callback';
      this.callback = componentOrCallback;
    } else {
      this.type = 'functionComponent';
      this.callback = null;
    }
  }

  waiting(): number {
    return this.calls.length + this.pendingCalls.length;
  }

  dispatch() {
    // Add calls to the global list, then wait a bit, request list results
    // from the server, cache the results, then re-render the requesting
    // components, or call the callbacks.
    const { calls, callback } = this;
    if (calls.length) {
      if (callback === null) {
        throw new Error(
          `A null callback was passed in a context that requires a non-null callback:  ${JSON_stringify(calls)}`,
        );
      }
      setLoadingClass(this, true);
      const { renderPromises } = RenderPromise;
      if (!renderPromises.includes(this)) renderPromises.push(this);
      RenderPromise.batchDispatch();
    }
  }
}

// Remove resolveRP's calls from originalRP's pendingCalls.
function resolveRP(originalRP: RenderPromise, resolvedRP: RenderPromise) {
  resolvedRP.calls.forEach((call: GCallType) => {
    const { pendingCalls } = originalRP;
    const index = pendingCalls.indexOf(call);
    if (index !== -1) pendingCalls.splice(index, 1);
    else log.error(`Failed to remove dispatched call: ${JSON_stringify(call)}`);
  });
}

function callBatchThenCacheSync(calls: GCallType[]) {
  if (Build.isElectronApp && calls.length) {
    const disallowed = disallowedAsCallBatch(calls);
    if (disallowed) throw new Error(disallowed);
    const results = (G as GType).callBatchSync(calls);
    if (!results || results.length !== calls.length) {
      throw new Error(`callBatch sync did not return the correct data.`);
    }
    calls.forEach((call, i) => {
      writeCallToCache(call, results[i]);
    });
  }
}

// Return true on success or false if server requested we wait.
async function callBatchThenCache(
  calls: GCallType[],
): Promise<ServerWait['pleaseWait']> {
  if (calls.length) {
    const disallowed = disallowedAsCallBatch(calls);
    if (disallowed) throw new Error(disallowed);
    const results = await G.callBatch(calls);
    const pleaseWait = RenderPromise.pleaseWait(results);
    if (pleaseWait) return pleaseWait;
    if (!results || results.length !== calls.length) {
      throw new Error(`callBatch async did not return the correct data.`);
    }
    calls.forEach((call, i) => {
      writeCallToCache(call, results[i]);
    });
  }

  return '';
}

function disallowedAsCallBatch(calls: GCallType[]): string {
  // All callBatch calls must be synchronous capable, so check.
  const { asyncFuncs } = GBuilder;
  const asyncCall = calls.find((c) =>
    asyncFuncs.find(
      (a) => a[0] === c[0] && (!c[1] || (a[1] as any).includes(c[1])),
    ),
  );
  if (asyncCall !== undefined) {
    return `G.callBatch member must not be async: ${asyncCall.toString()}`;
  }

  if (calls.some((call) => call[0] === 'callBatch')) {
    return `Calling a batch of batches is not allowed.`;
  }

  return '';
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
      if (!isCallCacheable(GBuilder, call))
        setTimeout(() => {
          Cache.clear(cacheKey);
        }, C.Server.networkRequestMinCache);
    });
  }

  return results;
}

function getCallFromCache(call: GCallType | null): PrefValue | undefined {
  let result: PrefValue | undefined;
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
    if (!Cache.has(cacheKey)) {
      if (Build.isWebApp)
        result = gcallResultCompression(call, result, callResultDecompress);

      Cache.write(result, cacheKey);

      // Some calls will return data that is identical to other calls, so preload the cache
      // for those others as well.

      // BooksInVKModules
      if (call[0] === 'BooksInVKModules') {
        Object.entries(
          result as ReturnType<typeof getBooksInVKModules>,
        ).forEach((entry) => {
          const [module, bookArray] = entry;
          const k = GCacheKey(['getBooksInVKModule', null, [module]]);
          if (!Cache.has(k)) Cache.write(bookArray, k);
        });

        // LibSword.getFirstDictionaryEntry
      } else if (
        call[0] === 'LibSword' &&
        call[1] === 'getFirstDictionaryEntry'
      ) {
        const args = call[2] as Parameters<
          GType['LibSword']['getFirstDictionaryEntry']
        >;
        const [, , options] = args;
        const { mod, key } = result as ReturnType<
          GType['LibSword']['getFirstDictionaryEntry']
        >;
        const nckey = GCacheKey([
          'LibSword',
          'getDictionaryEntry',
          [mod, key, options],
        ]);
        if (!Cache.has(nckey)) Cache.write(result, nckey);

        // Tabs
      } else if (call[0] === 'Tabs') {
        const nckey = GCacheKey(['Tab', null, undefined]);
        if (!Cache.has(nckey)) {
          Cache.write(
            (result as typeof G.Tabs).reduce(
              (p, c) => {
                p[c.module] = c;
                return p;
              },
              {} as Record<string, TabType>,
            ),
            nckey,
          );
        }

        // getBooks
      } else if (call[0] === 'getBooks') {
        const r = result as ReturnType<typeof G.getBooks>;
        const nckey = GCacheKey(call);
        if (!Cache.has(nckey)) Cache.write(r, nckey);
        const book: ReturnType<typeof G.getBook> = r.reduce(
          (p, c) => {
            p[c.code] = c;
            return p;
          },
          {} as Record<string, BookType>,
        );
        const nckey2 = GCacheKey(['getBook', null, [G.i18n.language]]);
        if (!Cache.has(nckey2)) Cache.write(book, nckey2);

        // ModuleConfs
      } else if (call[0] === 'ModuleConfs') {
        Object.entries(result as GType['ModuleConfs']).forEach((entry) => {
          const [m, c] = entry;
          const nckey = GCacheKey(['getModuleConf', null, [m]]);
          if (!Cache.has(nckey)) Cache.write(c, nckey);
        });

        // AudioConfs
      } else if (call[0] === 'AudioConfs') {
        Object.entries(result as GType['AudioConfs']).forEach((entry) => {
          const [m, c] = entry;
          const nckey = GCacheKey(['getAudioConf', null, [m]]);
          if (!Cache.has(nckey)) Cache.write(c, nckey);
        });

        // getLocaleDigits
      } else if (call[0] === 'getLocaleDigits') {
        const args = call[2] as Parameters<typeof G.getLocaleDigits>;
        if (args.length && args[0] === G.i18n.language) {
          const nckey = GCacheKey(['getLocaleDigits', null, []]);
          if (!Cache.has(nckey)) Cache.write(result, nckey);
        } else if (!args.length) {
          const nckey = GCacheKey(['getLocaleDigits', null, [G.i18n.language]]);
          if (!Cache.has(nckey)) Cache.write(result, nckey);
        }
      }
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
      const [, , args] = calls[i];
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
      for (;;) {
        const x = flat.findIndex(
          (c, i2) => i2 > i && promiseCacheKey(c) === ckey,
        );
        if (x === -1) break;
        flat.splice(x, 1);
      }
    }
  }
  return flat;
}

export function setLoadingClass(
  renderPromise: RenderPromise,
  setUnset: boolean,
): void {
  const { loadingRef, loadingSelector, type } = renderPromise;
  if (loadingRef) {
    let targelem: HTMLElement | null = null;
    const { current } = loadingRef;
    if (current) {
      targelem = loadingSelector
        ? current.querySelector(loadingSelector)
        : current;
    }
    if (targelem) {
      if (setUnset) {
        targelem.classList.add('rp-loading');
      } else targelem.classList.remove('rp-loading');
      log.silly(
        `${setUnset ? 'set' : 'unset'} loading selector: ${targelem.classList}`,
      );
    } else if (type === 'functionComponent') {
      // classComponents may be replaced with new instances thereby creating false errors
      // here. So only report functionalComponents, which would be real errors.
      log[setUnset ? 'debug' : 'error'](
        `FAILED to ${setUnset ? 'set' : 'unset'} a loading selector: ${loadingSelector}`,
      );
    }
  }
}
