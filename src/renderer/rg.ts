/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSON_stringify, stringHash } from '../common';
import Cache from '../cache';
import { GBuilder } from '../type';
import C from '../constant';
import log from './log';

import type { GType } from '../type';

function logtag(
  name: string,
  m: string | undefined,
  args: any,
  cacheable: boolean
) {
  return `${asyncFuncs.some((en) => en[0] === name) ? 'async ' : ''}G.${name}${
    m ? `.${m}` : ''
  }(${JSON_stringify(args).substring(0, 64)}...)${
    cacheable ? ' cache miss' : ''
  }`;
}

// This G object is used in renderer processes, and shares the same
// interface as a main process G object. Properties of this object
// access data and objects via IPC from the main process G object.
// All getter and cacheable data is cached locally.
const G = {} as GType;
const { asyncFuncs } = GBuilder;
Object.entries(GBuilder).forEach((entry) => {
  if (['asyncFuncs', 'includeCallingWindow'].includes(entry[0])) return;
  const gBuilder = GBuilder as any;
  const g = G as any;
  const name = entry[0] as keyof typeof GBuilder;
  const value = entry[1] as any;
  if (value === 'getter') {
    const ckey = `G.${name} cache`;
    Object.defineProperty(G, name, {
      get() {
        if (!Cache.has(ckey)) {
          log.silly(`${ckey} miss`);
          Cache.write(window.ipc.sendSync('global', name), ckey);
        }
        return Cache.read(ckey);
      },
    });
  } else if (typeof value === 'function') {
    const cacheable = value();
    g[name] = (...args: unknown[]) => {
      const ckey = `G.${name}(${stringHash(...args)})${
        cacheable ? ' cache' : ''
      }`;
      if (!cacheable) Cache.clear(ckey);
      if (!Cache.has(ckey)) {
        if (C.LogLevel === 'silly') {
          log.silly(logtag(name, undefined, args, cacheable));
        }
        if (asyncFuncs.some((en) => en[0] === name)) {
          return window.ipc
            .invoke('global', name, ...args)
            .then((result: unknown) => {
              if (!Cache.has(ckey)) Cache.write(result, ckey);
              return result;
            })
            .catch(() => {
              log.warn(
                `Promise rejection in ${logtag(
                  name,
                  undefined,
                  args,
                  cacheable
                )}`
              );
            });
        }
        Cache.write(window.ipc.sendSync('global', name, ...args), ckey);
      }
      const retval = Cache.read(ckey);
      return (asyncFuncs as [string, string[]][]).some((en) => en[0] === name)
        ? Promise.resolve(retval)
        : retval;
    };
  } else if (typeof value === 'object') {
    const methods = Object.getOwnPropertyNames(value);
    methods.forEach((m) => {
      if (g[name] === undefined) {
        g[name] = {};
      }
      if (gBuilder[name][m] === 'getter') {
        const ckey = `G.${name}.${m} cache`;
        Object.defineProperty(g[name], m, {
          get() {
            if (!Cache.has(ckey)) {
              log.silly(`${ckey} miss`);
              Cache.write(window.ipc.sendSync('global', name, m), ckey);
            }
            return Cache.read(ckey);
          },
        });
      } else if (typeof gBuilder[name][m] === 'function') {
        const cacheable = gBuilder[name][m]();
        g[name][m] = (...args: unknown[]) => {
          const ckey = `G.${name}.${m}(${stringHash(...args)})${
            cacheable ? ' cache' : ''
          }`;
          if (!cacheable) Cache.clear(ckey);
          if (!Cache.has(ckey)) {
            if (C.LogLevel === 'silly') {
              log.silly(logtag(name, m, args, cacheable));
            }
            if (
              (asyncFuncs as [string, string[]][]).some(
                (en) => en[0] === name && en[1].includes(m)
              )
            ) {
              return window.ipc
                .invoke('global', name, m, ...args)
                .then((result: unknown) => {
                  if (!Cache.has(ckey)) Cache.write(result, ckey);
                  return result;
                })
                .catch(() => {
                  log.warn(
                    `Promise rejection in: ${logtag(name, m, args, cacheable)}`
                  );
                });
            }
            Cache.write(window.ipc.sendSync('global', name, m, ...args), ckey);
          }
          const retval = Cache.read(ckey);
          return (asyncFuncs as [string, string[]][]).some(
            (en) => en[0] === name && en[1].includes(m)
          )
            ? Promise.resolve(retval)
            : retval;
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
});

export default G;
