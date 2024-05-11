/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { JSON_stringify, GCacheKey, isCallCacheable } from '../common.ts';
import Cache from '../cache.ts';
import { GBuilder } from '../type.ts';
import log from './log.ts';
import CookiePrefs from './prefs.ts';

import type { GAType, GCallType, GType } from '../type.ts';

async function asyncRequest(
  ckey: string,
  thecall: GCallType
) {
  if (!allowed(thecall)) {
    throw new Error(`Async G call unsupported in browser environment: ${JSON_stringify(thecall)}`);
  }
  if (Cache.has(ckey)) return Promise.resolve(Cache.read(ckey));
  const cacheable = isCallCacheable(thecall);
  log.silly(`${ckey} ${JSON_stringify(thecall)} async ${cacheable ? 'miss' : 'uncacheable'}`);
  return window.ipc
    .invoke('global', thecall)
    .then((result: unknown) => {
      if (cacheable) Cache.write(result, ckey);
      return result;
    })
    .catch((er: any) => {
      log.warn(`Promise rejection in ${JSON_stringify(thecall)}:\n${er.toString()}`);
    });
}

function request(
  ckey: string,
  thecall: GCallType
) {
  if (!allowed(thecall)) {
    throw new Error(`Sync G call unsupported in browser environment: ${JSON_stringify(thecall)}`);
  }
  if (Cache.has(ckey)) return Cache.read(ckey);
  const cacheable = isCallCacheable(thecall);
  if (window.processR.platform === 'browser') {
    if (cacheable)
      throw new Error(`Cache must be preloaded in browser context: ${JSON_stringify(thecall)}`);
    else
      throw new Error(`The GA version of this method must be used in browser context: ${JSON_stringify(thecall)}`);
  }
  log.silly(`${ckey} ${JSON_stringify(thecall)} sync ${cacheable ? 'miss' : 'uncacheable'}`);
  const result = window.ipc.sendSync('global', thecall);
  if (cacheable) Cache.write(result, ckey);
  return result;
}

function allowed(thecall: GCallType): boolean {
  const [name, method] = thecall;
  const is = name && GBuilder.internetSafe.find((x) => x[0] === name);
  if (window.processR.platform && window.processR.platform !== 'browser') return true;
  if (is && !method && is[1].length === 0) return true;
  if (is && (is[1] as any).includes(method)) return true;
  return false;
}

// This G object is used in renderer processes, and shares the same
// interface as a main process G object. Properties of this object
// access data and objects via IPC from the main process G object.
// All getter and cacheable data is cached locally.
// - IPC via the Internet cannot access electron functionality and
// is subject to security restrictions, so in this context certain
// G functions will throw an error.
// - IPC via the Internet also requires G functionality to be
// completely async. To accomodate this requirement, a GA object
// is provided having the same interface as G, but only Internet
// safe methods are provided and all responses are asynchronous.
// - Although IPC via Internet is async, it is possible to preload
// data to the cache asynchronously and retrieve it synchronously
// using G. Just use G.callBatch() to load the cache before any
// synchronous G calls.
const G = {} as GType;
export const GA = {} as GAType;
const { asyncFuncs } = GBuilder;
Object.entries(GBuilder).forEach((entry) => {
  if (!([
    'gtype',
    'asyncFuncs',
    'includeCallingWindow',
    'internetSafe'
  ] as (keyof typeof GBuilder)[]).includes(entry[0] as any)) {
    const gBuilder = GBuilder as any;
    const g = G as any;
    const ga = GA as any;
    const name = entry[0] as keyof Omit<typeof GBuilder,
      'gtype' |
      'asyncFuncs' |
      'includeCallingWindow' |
      'internetSafe'>;
    const value = entry[1] as any;
    if (value === 'getter') {
      const acall: GCallType = [name, null, undefined];
      const ckey = GCacheKey(acall);
      Object.defineProperty(G, name, {
        get() {
          return request(ckey, acall);
        },
      });
      Object.defineProperty(GA, name, {
        get() {
          return asyncRequest(ckey, acall);
        },
      });
    } else if (typeof value === 'function') {
      g[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, args];
        const ckey = GCacheKey(acall);
        if (asyncFuncs.some((en) => en[0] === name)) {
          return asyncRequest(ckey, acall);
        }
        return request(ckey, acall);
      };
      ga[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, args];
        const ckey = GCacheKey(acall);
        return asyncRequest(ckey, acall);
      };
    } else if (typeof value === 'object') {
      const methods = Object.getOwnPropertyNames(value);
      methods.forEach((m) => {
        if (g[name] === undefined) {
          g[name] = {};
          ga[name] = {};
        }
        if (gBuilder[name][m] === 'getter') {
          const acall: GCallType = [name, m, undefined];
          const ckey = GCacheKey(acall);
          Object.defineProperty(g[name], m, {
            get() {
              return request(ckey, acall);
            },
          });
          Object.defineProperty(ga[name], m, {
            get() {
              return asyncRequest(ckey, acall);
            },
          });
        } else if (typeof gBuilder[name][m] === 'function') {
          if (name !== 'Prefs' || window.processR.platform !== 'browser') {
            g[name][m] = (...args: unknown[]) => {
              const acall: GCallType = [name, m, args];
              const ckey = GCacheKey(acall);
              if (
                (asyncFuncs as [string, string[]][]).some(
                  (en) => en[0] === name && en[1].includes(m)
                )
              ) {
                return asyncRequest(ckey, acall);
              }
              return request(ckey, acall);
            };
            ga[name][m] = (...args: unknown[]) => {
              const acall: GCallType = [name, m, args];
              const ckey = GCacheKey(acall);
              return asyncRequest(ckey, acall);
            };
          } else {
            // Then use Prefs cookie rather than server file.
            g.Prefs[m] = (...args: unknown[]) => {
              if (
                (asyncFuncs as [string, string[]][]).some(
                  (en) => en[0] === name && en[1].includes(m)
                )
              ) {
                throw new Error(`G async cookie Pref methods not implemented: ${m}`);
              }
              return (CookiePrefs as any)[m](...args);
            };
            ga.Prefs[m] = g.Prefs[m];
          }
        } else {
          throw Error(
            `Unhandled GBuilder ${name}.${m} type ${typeof gBuilder[name][m]}`
          );
        }
      });
    } else {
      throw Error(`Unhandled GBuilder ${name} value ${value}`);
    }
  }
});

export default G;
