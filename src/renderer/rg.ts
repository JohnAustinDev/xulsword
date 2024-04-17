/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { JSON_stringify, GCacheKey } from '../common.ts';
import Cache from '../cache.ts';
import { GBuilder } from '../type.ts';
import log from './log.ts';

import type { GAType, GCallType, GType } from '../type.ts';

const context = window.processR?.platform || 'browser';

async function asyncRequest(
  ckey: string,
  cacheable: boolean,
  thecall: GCallType
) {
  if (!cacheable) Cache.clear(ckey);
  if (Cache.has(ckey)) return Promise.resolve(Cache.read(ckey));
  log.silly(`${ckey} miss`);
  return window.ipc
    .invoke('global', thecall)
    .then((result: unknown) => {
      Cache.write(result, ckey);
      return result;
    })
    .catch(() => {
      const [name, m, args] = thecall;
      const msg = `${asyncFuncs.some((en) => en[0] === name) ? 'async ' : ''
      }G.${name}${m ? `.${m}` : ''
      }(${JSON_stringify(args).substring(0, 64)}...)${cacheable ? ' cache miss' : ''}`;
      log.warn(`Promise rejection in ${msg}`);
    });
}

function request(
  ckey: string,
  cacheable: boolean,
  thecall: GCallType
) {
  if (!cacheable) Cache.clear(ckey);
  if (Cache.has(ckey)) return Cache.read(ckey);
  if (context === 'browser') {
    if (cacheable)
      throw new Error(`Cache must be preloaded in browser context: ${thecall}`);
    else
      throw new Error(`The GA version of this method must be used in browser context: ${thecall}`);
  }
  log.silly(`${ckey} miss`);
  return window.ipc.sendSync('global', thecall);
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
// using G. Just use G.cachePreload() to load the cache before any
// synchronous G calls.
const G = {} as GType;
const GA = {} as GAType;
const { asyncFuncs } = GBuilder;
Object.entries(GBuilder).forEach((entry) => {
  if ([
    'asyncFuncs',
    'includeCallingWindow',
    'internetFuncs'
  ].includes(entry[0])) return;
  const gBuilder = GBuilder as any;
  const g = G as any;
  const ga = GA as any;
  const name = entry[0] as keyof typeof GBuilder;
  const value = entry[1] as any;
  if (context !== 'browser' || gBuilder.internetFuncs.includes(name)) {
    if (value === 'getter') {
      const acall: GCallType = [name, null];
      const ckey = GCacheKey(acall);
      Object.defineProperty(G, name, {
        get() {
          return request(ckey, true, acall);
        },
      });
      Object.defineProperty(GA, name, {
        get() {
          return asyncRequest(ckey, true, acall);
        },
      });
    } else if (typeof value === 'function') {
      const cacheable = value();
      g[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, ...args];
        const ckey = GCacheKey(acall);
        if (asyncFuncs.some((en) => en[0] === name)) {
          return asyncRequest(ckey, cacheable, acall);
        }
        return request(ckey, cacheable, acall);
      };
      ga[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, ...args];
        const ckey = GCacheKey(acall);
        return asyncRequest(ckey, cacheable, acall);
      };
    } else if (typeof value === 'object') {
      const methods = Object.getOwnPropertyNames(value);
      methods.forEach((m) => {
        if (g[name] === undefined) {
          g[name] = {};
          ga[name] = {};
        }
        if (gBuilder[name][m] === 'getter') {
          const acall: GCallType = [name, m];
          const ckey = GCacheKey(acall);
          Object.defineProperty(g[name], m, {
            get() {
              return request(ckey, true, acall);
            },
          });
          Object.defineProperty(ga[name], m, {
            get() {
              return asyncRequest(ckey, true, acall);
            },
          });
        } else if (typeof gBuilder[name][m] === 'function') {
          const cacheable = gBuilder[name][m]();
          g[name][m] = (...args: unknown[]) => {
            const acall: GCallType = [name, m, ...args];
            const ckey = GCacheKey(acall);
            if (
              (asyncFuncs as [string, string[]][]).some(
                (en) => en[0] === name && en[1].includes(m)
              )
            ) {
              return asyncRequest(ckey, cacheable, acall);
            }
            return request(ckey, cacheable, acall);
          };
          ga[name][m] = (...args: unknown[]) => {
            const acall: GCallType = [name, m, ...args];
            const ckey = GCacheKey(acall);
            return asyncRequest(ckey, cacheable, acall);
          };
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
