/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { JSON_stringify, GCacheKey, isCallCacheable, clone, invalidData } from '../common.ts';
import Cache from '../cache.ts';
import { GBuilder } from '../type.ts';
import { getWaitRetry } from './rutil.ts';
import { GCallsOrPromise } from './renderPromise.ts';
import log from './log.ts';
import CookiePrefs from './prefs.ts';

import type { GCallType, GIRendererType, GType, PrefValue } from '../type.ts';
import type RenderPromise from './renderPromise.ts';

async function asyncRequest(
  thecall: GCallType
) {
  if (!allowed(thecall)) {
    throw new Error(`Async G call unsupported in browser environment: ${JSON_stringify(thecall)}`);
  }
  const cacheable = isCallCacheable(GBuilder, thecall);
  const ckey = GCacheKey(thecall);
  if (cacheable && Cache.has(ckey)) return Promise.resolve(Cache.read(ckey));
  log.silly(`${ckey} ${JSON_stringify(thecall)} async ${cacheable ? 'miss' : 'uncacheable'}`);
  const call = window.processR.platform === 'browser' ? publicCall(thecall) : thecall;
  let result;
  try {
    result = await window.ipc.invoke('global', call);
    const invalid = invalidData(result, window.processR.platform);
    if (invalid) {
      error(`Invalid async data response: ${invalid}`);
      return undefined;
    }
    if (cacheable && !getWaitRetry(result)) Cache.write(result, ckey);
  } catch (er: any) {
    throw new Error(`Promise rejection in ${JSON_stringify(thecall)}:\n${er.toString()}`);
  }
  return result;
}

function request(
  thecall: GCallType
) {
  if (!allowed(thecall)) {
    throw new Error(`Sync G call unsupported in browser environment: ${JSON_stringify(thecall)}`);
  }
  const ckey = GCacheKey(thecall);
  const cacheable = isCallCacheable(GBuilder, thecall);
  if (cacheable && Cache.has(ckey)) return Cache.read(ckey);
  if (window.processR.platform === 'browser') {
    if (cacheable)
      throw new Error(`Cache must be preloaded in browser context: ${JSON_stringify(thecall)}`);
    else
      throw new Error(`This uncacheable call requires G.callBatch in browser context: ${JSON_stringify(thecall)}`);
  }
  log.silly(`${ckey} ${JSON_stringify(thecall)} sync ${cacheable ? 'miss' : 'uncacheable'}`);
  const result = window.ipc.sendSync('global', thecall);
  const invalid = invalidData(result, window.processR.platform);
  if (invalid) {
    error(`Invalid data response: ${invalid}`);
    return undefined;
  }
  if (cacheable) Cache.write(result, ckey);

  return result;
}

function allowed(thecall: GCallType): boolean {
  const [name, method, args] = thecall;
  if (name === 'callBatch') {
    if (args) {
      const alls = args[0].map((c: GCallType) => allowed(c));
      return alls.every((x: boolean) => x);
    }
    return false;
  }
  const is = name && GBuilder.internetSafe.find((x) => x[0] === name);
  if (window.processR.platform && window.processR.platform !== 'browser') return true;
  if (is !== undefined && !method && is[1].length === 0) return true;
  if (is !== undefined && (is[1] as any).includes(method)) return true;
  return false;
}

function publicCall(thecall: GCallType): GCallType {
  const [name, method] = thecall;
  let args = thecall[2];
  if (name === 'callBatch' && args) {
    const calls = args[0].map((call: GCallType) => {
      return publicCall(call);
    });
    return [name, method, [calls]];
  } else if (args) {
    // Add lng option to G.i18n.t() and G.i18n.exists().
    if (name === 'i18n' && typeof method === 'string'
        && ['t', 'exists'].includes(method)) {
      // Add language to all i18n calls, unless already present.
      const options = (args.length > 1 ? args[1] : {}) as Parameters<typeof G.i18n.t>[1];
      if (typeof options.lng !== 'string') {
        options.lng = G.Prefs.getCharPref('global.locale');
      }
      const newargs = clone(args);
      if (newargs.length) newargs[1] = options;
      return [name, method, newargs];
    }
  }
  return [name, method, args];
}

function error(er: any) {
  log.error(`${er.toString()}${'stack' in er ? ' ' + er.stack : ''}`);
}

// This G object is used in renderer processes, and shares the same
// interface as a main process G object. Properties of this object
// access data and objects via IPC from the main process G object.
// All getter and cacheable data is cached locally.
// - IPC via the Internet cannot access electron functionality and
// is subject to security restrictions, so in this context certain
// G functions will throw an error.
// - IPC via the Internet also requires G functionality to be
// completely async. To accomodate this requirement, syncronous
// must be made via G.callBatch() which is asyncronous.
// - Although IPC via Internet is async, it is possible to preload
// data to the cache asynchronously and then retrieve it synchronously
// using G. Just use callBatchThenCache to load the cache before any
// of these synchronous G calls.
// - To accommodate all this, a GI object is provided which shares the
// same interface as G, but with only the synchronous Internet-allowed
// G methods available, plus two extra arguments are required for every
// call (and even G getters require these extra arguments):
//   1) A default value to use when the requested value cannot be obtained
//      synchronously.
//   2) A RenderPromise to collect the unobtained synchronous calls, and
//      dispatch them later, to be followed by component re-endering
//      once the requested values have been obtained asynchronously.
const G = {} as GType;
export const GI = {} as GIRendererType;
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
    const gi = GI as any;
    const name = entry[0] as keyof Omit<typeof GBuilder,
      'gtype' |
      'asyncFuncs' |
      'includeCallingWindow' |
      'internetSafe'>;
    const value = entry[1] as any;
    if (value === 'getter') {
      const acall: GCallType = [name, null, undefined];
      Object.defineProperty(G, name, {
        get() {
          let req;
          try {req = request(acall)} catch (er: any) {error(er)}
          return req;
        },
      });
      gi[name] = (def: PrefValue, rp: RenderPromise) => {
        let req;
        try {
          req = GCallsOrPromise([acall], [def], rp)[0];
        } catch (er: any) {error(er)}
        return req;
      }
    } else if (typeof value === 'function') {
      const isAsync = asyncFuncs.some((en) => name && en[0] === name);
      g[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, args];
        let req;
        try {
          if (isAsync) req = asyncRequest(acall);
          else req = request(acall);
        } catch (er: any) {error(er)}
        return req;
      };
      if (!isAsync) {
        gi[name] = (def: PrefValue, rp: RenderPromise, ...args: unknown[]) => {
          const acall: GCallType = [name, null, args];
          let req;
          try {
            req = GCallsOrPromise([acall], [def], rp)[0];
          } catch (er: any) {error(er)}
          return req;
        }
      }
    } else if (typeof value === 'object') {
      const methods = Object.getOwnPropertyNames(value);
      methods.forEach((m) => {
        if (g[name] === undefined) g[name] = {};
        if (gi[name] === undefined) gi[name] = {};
        if (gBuilder[name][m] === 'getter') {
          const acall: GCallType = [name, m, undefined];
          Object.defineProperty(g[name], m, {
            get() {
              // In Browsers, i18n.language is never used, rather global.locale pref
              // is specified in all i18n calls, so return it in this special case.
              let req;
              try {
                if (name === 'i18n' && m === 'language'
                    && window.processR.platform === 'browser') {
                  req = G.Prefs.getCharPref('global.locale')
                } else {
                  req = request(acall);
                }
              } catch (er: any) {error(er)}
              return req;
            },
          });
          gi[name][m] = (def: PrefValue, rp: RenderPromise) => {
            let req;
            try {
              req = GCallsOrPromise([acall], [def], rp)[0];
            } catch (er: any) {error(er)}
            return req;
          };
        } else if (typeof gBuilder[name][m] === 'function') {
          const isAsync = (asyncFuncs as [string, string[]][]).some(
            (asf) => name && m && asf[0] === name && asf[1].includes(m)
          );
          if (name !== 'Prefs' || window.processR.platform !== 'browser') {
            g[name][m] = (...args: unknown[]) => {
              const acall: GCallType = [name, m, args];
              let req;
              try {
                if (isAsync) req = asyncRequest(acall);
                else req = request(acall);
              } catch (er: any) {error(er)}
              return req;
            };
            if (!isAsync) {
              gi[name][m] = (def: PrefValue, rp: RenderPromise, ...args: unknown[]) => {
                const acall: GCallType = [name, m, args];
                let req;
                try {
                  req = GCallsOrPromise([acall], [def], rp)[0];
                } catch (er: any) {error(er)}
                return req;
              };
            }
          } else {
            // Then use Prefs cookie rather than server file.
            g.Prefs[m] = (...args: unknown[]) => {
              let req;
              if (
                (asyncFuncs as [string, string[]][]).some(
                  (en) => en[0] === name && en[1].includes(m)
                )
              ) {
                error(`G async cookie Pref methods not implemented: ${m}`);
              } else {
                try {
                  req = (CookiePrefs as any)[m](...args);
                } catch (er: any) {error(er)}
              }
              return req;
            };
          }
        } else {
          error(
            `Unhandled GBuilder ${name}.${m} type ${typeof gBuilder[name][m]}`
          );
        }
      });
    } else {
      error(`Unhandled GBuilder ${name} value ${value}`);
    }
  }
});

export default G;
