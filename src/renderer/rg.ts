/* eslint-disable @typescript-eslint/no-explicit-any */
import { stringHash } from 'common';
import Cache from '../cache';
import { GPublic } from '../type';
import log from './log';

// This G object is for use in renderer processes, and it shares the same
// interface as a main process G object. Both G objects are built auto-
// matically at runtime from the same GPublic declaration. Properties of
// this object access data and objects via IPC to the main process G object.
// All getter and readonly data is cached locally.
const G = {} as typeof GPublic;

// These global functions and object methods are asynchronous and return promises.
const asyncFuncs = [
  'getSystemFonts',
  'installXulswordModules',
  'crossWireMasterRepoList',
  'repositoryListing',
  'ftp',
  'untargz',
];

const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const GPublicx = GPublic as any;
  const Gx = G as any;
  const name = entry[0] as keyof typeof GPublic;
  const value = entry[1] as any;
  if (value === 'getter') {
    const ckey = `G.${name} cache`;
    Object.defineProperty(G, name, {
      get() {
        log.silly(`${ckey}${!Cache.has(ckey) ? ' miss' : ''}`);
        if (!Cache.has(ckey)) {
          Cache.write(window.ipc.renderer.sendSync('global', name), ckey);
        }
        return Cache.read(ckey);
      },
    });
  } else if (typeof value === 'function') {
    const readonly = value();
    Gx[name] = (...args: unknown[]) => {
      const ckey = `G.${name}(${stringHash(...args)})${
        readonly ? ' cache' : ''
      }`;
      log.silly(`${ckey}${readonly && !Cache.has(ckey) ? ' miss' : ''}`);
      if (!readonly) Cache.clear(ckey);
      if (!Cache.has(ckey)) {
        if (asyncFuncs.includes(name)) {
          return window.ipc.renderer
            .invoke('global', name, ...args)
            .then((result: unknown) => {
              Cache.write(result, ckey);
              return result;
            })
            .catch((err: Error) => log.error(err));
        }
        Cache.write(
          window.ipc.renderer.sendSync('global', name, ...args),
          ckey
        );
      }
      const retval = Cache.read(ckey);
      return asyncFuncs.includes(name) ? Promise.resolve(retval) : retval;
    };
  } else if (typeof value === 'object') {
    const methods = Object.getOwnPropertyNames(value);
    methods.forEach((m) => {
      if (G[name] === undefined) {
        Gx[name] = {};
      }
      if (GPublicx[name][m] === 'getter') {
        const ckey = `G.${name}.${m} cache`;
        log.silly(`${ckey}${!Cache.has(ckey) ? ' miss' : ''}`);
        Object.defineProperty(Gx[name], m, {
          get() {
            if (!Cache.has(ckey)) {
              Cache.write(
                window.ipc.renderer.sendSync('global', name, m),
                ckey
              );
            }
            return Cache.read(ckey);
          },
        });
      } else if (typeof GPublicx[name][m] === 'function') {
        const readonly = GPublicx[name][m]();
        Gx[name][m] = (...args: unknown[]) => {
          const ckey = `G.${name}.${m}(${stringHash(...args)})${
            readonly ? ' cache' : ''
          }`;
          log.silly(`${ckey}${readonly && !Cache.has(ckey) ? ' miss' : ''}`);
          if (!readonly) Cache.clear(ckey);
          if (!Cache.has(ckey)) {
            if (asyncFuncs.includes(m)) {
              return window.ipc.renderer
                .invoke('global', name, m, ...args)
                .then((result: unknown) => {
                  Cache.write(result, ckey);
                  return result;
                })
                .catch((err: Error) => log.error(err));
            }
            Cache.write(
              window.ipc.renderer.sendSync('global', name, m, ...args),
              ckey
            );
          }
          const retval = Cache.read(ckey);
          return asyncFuncs.includes(name) ? Promise.resolve(retval) : retval;
        };
      } else {
        throw Error(
          `Unhandled GPublic ${name}.${m} type ${typeof GPublicx[name][m]}`
        );
      }
    });
  } else {
    throw Error(`Unhandled GPublic ${name} value ${value}`);
  }
});

export default G;
