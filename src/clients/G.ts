import {
  JSON_stringify,
  GCacheKey,
  isCallCacheable,
  clone,
  isInvalidWebAppData,
} from '../common.ts';
import Cache from '../cache.ts';
import { GBuilder } from '../type.ts';
import { getWaitRetry } from './common.ts';
import { GCallsOrPromise } from './renderPromise.ts';
import log from './log.ts';
import CookiePrefs from './webapp/prefs.ts';

import type Viewport from './webapp/viewport.ts';
import type { GCallType, GIType, GType, PrefValue } from '../type.ts';
import type RenderPromise from './renderPromise.ts';

// G and GI objects are used to seamlessly share complex data and functionality
// between servers and clients. Methods and properties of these objects send
// and return data via Inter Process Communication with the server's own G or
// GI objects. All getter and cacheable data is cached locally on both ends.
//
// What's the difference between G and GI, and why are there two?
// - IPC via the Internet cannot access electron functionality and is subject
// to security restrictions, so in web app context certain G functions will
// throw an error.
// - IPC via the Internet also requires G functionality to be completely
// asynchronous, so synchronous G methods can't be used in web apps.
// - Although IPC via Internet is asynchronous, it is possible to preload
// data to the cache asynchronously and then retrieve it synchronously using G.
// This is done using callBatchThenCache(). If a synchronous G method call is
// made in a web app, without it having first having been cached, an exception
// is thrown.
// - The GI object shares the same interface as G, but only has the synchronous
// Internet-allowed G methods available and so is always safe to use in any
// environment; but additionally, two extra initial arguments are required for
// each GI call (and even G getters require these two arguments) plus a
// renderPromise must be added to the parent component. Extra arguments are:
//   1) A default value to use when the requested value cannot be obtained
//      synchronously via the cache.
//   2) A RenderPromise to collect all un-cached synchronous calls, to dispatch
//      them periodically and then to re-render the renderPromise's parent
//      component once the requested values have been obtained.
//
// THE UPSHOT:
// - Electron App Clients: can use G or GI, but should prefer G, since it is
// simpler and faster, requiring fewer arguments and supporting synchronous
// calls.
// - Web app clients can always use GI and may use G for Internet-allowed
// methods but only after callBatchThenCache() was made for any synchronous
// calls. For common calls like G.Tabs etc. cache preloading should be used,
// because it is simpler and faster than GI. When promises can be awaited (such
// as in event handlers) then another approach is likely prefered, using
// await G.callBatch([theCall]) which allows a web app client to make allowed G
// synchronous calls asynchronously, without the GI and renderPromise overhead.
// - Electron App Server must only use G, or an exception is thrown.
// - Web App Server must only use GI, or an excetion is thrown. Note: the server
// GI object is also used when responding to any allowed client G calls.

export const G = {} as GType;

export const GI = {} as GIType;

const { asyncFuncs } = GBuilder;
Object.entries(GBuilder).forEach((entry) => {
  if (
    !(
      ['gtype', 'asyncFuncs', 'includeCallingWindow', 'internetSafe'] as Array<
        keyof typeof GBuilder
      >
    ).includes(entry[0] as never)
  ) {
    const gBuilder = GBuilder as any;
    const g = G as any;
    const gi = GI as any;
    const name = entry[0] as keyof Omit<
      typeof GBuilder,
      'gtype' | 'asyncFuncs' | 'includeCallingWindow' | 'internetSafe'
    >;
    const value = entry[1] as any;
    if (value === 'getter') {
      const acall: GCallType = [name, null, undefined];
      Object.defineProperty(G, name, {
        get() {
          let req;
          try {
            req = request(acall);
          } catch (er: any) {
            error(er);
          }
          return req;
        },
      });
      gi[name] = (def: PrefValue, rp: RenderPromise) => {
        let req;
        try {
          [req] = GCallsOrPromise([acall], [def], rp);
        } catch (er: any) {
          error(er);
        }
        return req;
      };
    } else if (typeof value === 'function') {
      const isAsync = asyncFuncs.some((en) => name && en[0] === name);
      g[name] = (...args: unknown[]) => {
        const acall: GCallType = [name, null, args];
        let req;
        try {
          if (isAsync) req = asyncRequest(acall);
          else req = request(acall);
        } catch (er: any) {
          error(er);
        }
        return req;
      };
      if (!isAsync) {
        gi[name] = (def: PrefValue, rp: RenderPromise, ...args: unknown[]) => {
          const acall: GCallType = [name, null, args];
          let req;
          try {
            [req] = GCallsOrPromise([acall], [def], rp);
          } catch (er: any) {
            error(er);
          }
          return req;
        };
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
                if (name === 'i18n' && m === 'language' && Build.isWebApp) {
                  req = G.Prefs.getCharPref('global.locale');
                } else {
                  req = request(acall);
                }
              } catch (er: any) {
                error(er);
              }
              return req;
            },
          });
          gi[name][m] = (def: PrefValue, rp: RenderPromise) => {
            let req;
            try {
              [req] = GCallsOrPromise([acall], [def], rp);
            } catch (er: any) {
              error(er);
            }
            return req;
          };
        } else if (typeof gBuilder[name][m] === 'function') {
          const isAsync = (asyncFuncs as Array<[string, string[]]>).some(
            (asf) => name && m && asf[0] === name && asf[1].includes(m),
          );
          // Special Cases: Prefs and Viewport use same-process replacements in
          // web apps.
          if (Build.isWebApp && ['Prefs', 'Viewport'].includes(name)) {
            if (name === 'Prefs') {
              // Web apps use Prefs cookie rather than a server file.
              g.Prefs[m] = (...args: unknown[]) => {
                let req;
                if (isAsync) {
                  error(`G async web app Prefs methods not implemented: ${m}`);
                } else {
                  try {
                    req = (CookiePrefs as any)[m](...args);
                  } catch (er: any) {
                    error(er);
                  }
                }
                return req;
              };
            } else {
              g.Viewport[m] = (...args: unknown[]) => {
                let req;
                if (isAsync) {
                  error(
                    `G async web app Viewport methods not implemented: ${m}`,
                  );
                } else {
                  try {
                    const viewport = Cache.read(
                      'ClientsViewport',
                    ) as typeof Viewport;
                    req = (viewport as any)[m](...args);
                  } catch (er: any) {
                    error(er);
                  }
                }
                return req;
              };
            }
          } else {
            g[name][m] = (...args: unknown[]) => {
              const acall: GCallType = [name, m, args];
              let req;
              try {
                if (isAsync) req = asyncRequest(acall);
                else req = request(acall);
              } catch (er: any) {
                error(er);
              }
              return req;
            };
            if (!isAsync) {
              gi[name][m] = (
                def: PrefValue,
                rp: RenderPromise,
                ...args: unknown[]
              ) => {
                const acall: GCallType = [name, m, args];
                let req;
                try {
                  [req] = GCallsOrPromise([acall], [def], rp);
                } catch (er: any) {
                  error(er);
                }
                return req;
              };
            }
          }
        } else {
          error(
            `Unhandled GBuilder ${name}.${m} type ${typeof gBuilder[name][m]}`,
          );
        }
      });
    } else {
      error(`Unhandled GBuilder ${name} value ${value}`);
    }
  }
});

async function asyncRequest(thecall: GCallType) {
  if (!allowed(thecall)) {
    throw new Error(
      `Async G call unsupported in browser environment: ${JSON_stringify(thecall)}`,
    );
  }
  const cacheable = isCallCacheable(GBuilder, thecall);
  const ckey = GCacheKey(thecall);
  if (cacheable && Cache.has(ckey))
    return await Promise.resolve(Cache.read(ckey));
  log.silly(
    `${ckey} ${JSON_stringify(thecall)} async ${cacheable ? 'miss' : 'uncacheable'}`,
  );
  const call = Build.isWebApp ? publicCall(thecall) : thecall;
  let result;
  try {
    result = await window.IPC.invoke('global', call);
    const invalid = Build.isWebApp && isInvalidWebAppData(result);
    if (invalid) {
      error(`Invalid async data response: ${invalid}`);
      return undefined;
    }
    if (cacheable && !getWaitRetry(result)) Cache.write(result, ckey);
  } catch (er: any) {
    throw new Error(
      `Promise rejection in ${JSON_stringify(thecall)}:\n${er.toString()}`,
    );
  }
  return result;
}

function request(thecall: GCallType) {
  if (!allowed(thecall)) {
    throw new Error(
      `Sync G call unsupported in browser environment: ${JSON_stringify(thecall)}`,
    );
  }
  const ckey = GCacheKey(thecall);
  const cacheable = isCallCacheable(GBuilder, thecall);
  if (cacheable && Cache.has(ckey)) return Cache.read(ckey);
  if (Build.isWebApp) {
    if (cacheable)
      throw new Error(
        `Cache must be preloaded in browser context: ${JSON_stringify(thecall)}`,
      );
    else
      throw new Error(
        `This uncacheable call requires G.callBatch in browser context: ${JSON_stringify(thecall)}`,
      );
  }
  log.silly(
    `${ckey} ${JSON_stringify(thecall)} sync ${cacheable ? 'miss' : 'uncacheable'}`,
  );
  const result = window.IPC.sendSync('global', thecall);
  const invalid = Build.isWebApp && isInvalidWebAppData(result);
  if (invalid) {
    error(`Invalid data response: ${invalid}`);
    return undefined;
  }
  if (cacheable) Cache.write(result, ckey);

  return result;
}

function allowed(thecall: GCallType): boolean {
  if (Build.isElectronApp) return true;
  const [name, method, args] = thecall;
  if (name === 'callBatch') {
    if (args) {
      const alls = args[0].map((c: GCallType) => allowed(c));
      return alls.every((x: boolean) => x);
    }
    return false;
  }
  const is = name && GBuilder.internetSafe.find((x) => x[0] === name);
  if (is !== undefined && !method && is[1].length === 0) return true;
  if (is !== undefined && (is[1] as any).includes(method)) return true;
  return false;
}

function publicCall(thecall: GCallType): GCallType {
  const [name, method] = thecall;
  const [, , args] = thecall;
  if (name === 'callBatch' && args) {
    const calls = args[0].map((call: GCallType) => {
      return publicCall(call);
    });
    return [name, method, [calls]];
  } else if (args) {
    // Add lng option to G.i18n.t() and G.i18n.exists().
    if (
      name === 'i18n' &&
      typeof method === 'string' &&
      ['t', 'exists'].includes(method)
    ) {
      // Add language to all i18n calls, unless already present.
      const options = args.length > 1 ? args[1] : {};
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
