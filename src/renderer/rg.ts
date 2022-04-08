/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GTypeR } from '../type';
import { GPublic } from '../type';

// This G object is for use in renderer processes, and it shares the same
// interface as a main process G object. Both G objects are built auto-
// matically at runtime from the same GPublic declaration. Properties of
// this object access data and objects via IPC to the main process G object.
// Local getter data is cached.
const G = {
  cache: {},

  reset() {
    this.cache = {};
  },
} as GTypeR;

const asyncFunc = ['getSystemFonts', 'installXulswordModules'];
const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const gPublic = GPublic as any;
  const Gx = G as any;
  const name = entry[0] as keyof GTypeR;
  const value = entry[1] as any;
  if (value === 'getter') {
    Object.defineProperty(G, name, {
      get() {
        if (!(name in G.cache)) {
          G.cache[name] = window.ipc.renderer.sendSync('global', name);
        }
        return G.cache[name];
      },
    });
  } else if (typeof value === 'function') {
    Gx[name] = (...args: any[]) => {
      if (asyncFunc.includes(name)) {
        return window.ipc.renderer
          .invoke('global', name, ...args)
          .catch((e: any) => console.error(e));
      }
      return window.ipc.renderer.sendSync('global', name, ...args);
    };
  } else if (typeof value === 'object') {
    const methods = Object.getOwnPropertyNames(value);
    methods.forEach((m) => {
      if (G[name] === undefined) {
        Gx[name] = {};
      }
      if (gPublic[name][m] === 'getter') {
        const key = `${name}.${m}`;
        Object.defineProperty(Gx[name], m, {
          get() {
            if (!(key in G.cache)) {
              G.cache[key] = window.ipc.renderer.sendSync('global', name, m);
            }
            return G.cache[key];
          },
        });
      } else {
        Gx[name][m] = (...args: unknown[]) => {
          if (asyncFunc.includes(m)) {
            return window.ipc.renderer
              .invoke('global', name, m, ...args)
              .catch((e: any) => console.error(e));
          }
          return window.ipc.renderer.sendSync('global', name, m, ...args);
        };
      }
    });
  } else {
    throw Error(`unhandled GPublic entry value ${value}`);
  }
});

export default G as unknown as GTypeR;
