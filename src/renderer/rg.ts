/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stringHash } from '../common';
import Cache from '../cache';
import { GPublic, GType } from '../type';
import log from './log';

// This G object is for use in renderer processes, and it shares the same
// interface as a main process G object. Both G objects are built auto-
// matically at runtime from the same GPublic declaration. Properties of
// this object access data and objects via IPC of the main process G object.
// All getter and cacheable data is cached locally.
const G = {} as typeof GPublic;

const asyncFuncs: [
  [keyof GType, (keyof GType['getSystemFonts'])[]],
  [keyof GType, (keyof GType['Commands'])[]],
  [keyof GType, (keyof GType['Module'])[]],
  [keyof GType, (keyof GType['LibSword'])[]]
] = [
  ['getSystemFonts', []],
  ['Commands', ['installXulswordModules']],
  [
    'Module',
    [
      'download',
      'installDownloads',
      'remove',
      'move',
      'crossWireMasterRepoList',
      'repositoryListing',
    ],
  ],
  ['LibSword', ['searchIndexBuild', 'search']],
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
        if (!Cache.has(ckey)) {
          log.silly(`${ckey} miss`);
          Cache.write(window.ipc.renderer.sendSync('global', name), ckey);
        }
        return Cache.read(ckey);
      },
    });
  } else if (typeof value === 'function') {
    const cacheable = value();
    Gx[name] = (...args: unknown[]) => {
      const ckey = `G.${name}(${stringHash(...args)})${
        cacheable ? ' cache' : ''
      }`;
      if (!cacheable) Cache.clear(ckey);
      if (!Cache.has(ckey)) {
        log.silly(
          `${
            (asyncFuncs as [string, string[]][]).some((en) => en[0] === name)
              ? 'async '
              : ''
          }${ckey}${cacheable ? ' miss' : ''}`
        );
        if ((asyncFuncs as [string, string[]][]).some((en) => en[0] === name)) {
          return window.ipc.renderer
            .invoke('global', name, ...args)
            .then((result: unknown) => {
              if (!Cache.has(ckey)) Cache.write(result, ckey);
              return result;
            });
        }
        Cache.write(
          window.ipc.renderer.sendSync('global', name, ...args),
          ckey
        );
      }
      const retval = Cache.read(ckey);
      return (asyncFuncs as [string, string[]][]).some((en) => en[0] === name)
        ? Promise.resolve(retval)
        : retval;
    };
  } else if (typeof value === 'object') {
    const methods = Object.getOwnPropertyNames(value);
    methods.forEach((m) => {
      if (G[name] === undefined) {
        Gx[name] = {};
      }
      if (GPublicx[name][m] === 'getter') {
        const ckey = `G.${name}.${m} cache`;
        Object.defineProperty(Gx[name], m, {
          get() {
            if (!Cache.has(ckey)) {
              log.silly(`${ckey} miss`);
              Cache.write(
                window.ipc.renderer.sendSync('global', name, m),
                ckey
              );
            }
            return Cache.read(ckey);
          },
        });
      } else if (typeof GPublicx[name][m] === 'function') {
        const cacheable = GPublicx[name][m]();
        Gx[name][m] = (...args: unknown[]) => {
          const ckey = `G.${name}.${m}(${stringHash(...args)})${
            cacheable ? ' cache' : ''
          }`;
          if (!cacheable) Cache.clear(ckey);
          if (!Cache.has(ckey)) {
            log.silly(
              `${
                (asyncFuncs as [string, string[]][]).some(
                  (en) => en[0] === name && en[1].includes(m)
                )
                  ? 'async '
                  : ''
              }${ckey}${cacheable ? ' miss' : ''}`
            );
            if (
              (asyncFuncs as [string, string[]][]).some(
                (en) => en[0] === name && en[1].includes(m)
              )
            ) {
              return window.ipc.renderer
                .invoke('global', name, m, ...args)
                .then((result: unknown) => {
                  if (!Cache.has(ckey)) Cache.write(result, ckey);
                  return result;
                });
            }
            Cache.write(
              window.ipc.renderer.sendSync('global', name, m, ...args),
              ckey
            );
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
          `Unhandled GPublic ${name}.${m} type ${typeof GPublicx[name][m]}`
        );
      }
    });
  } else {
    throw Error(`Unhandled GPublic ${name} value ${value}`);
  }
});

export default G;
