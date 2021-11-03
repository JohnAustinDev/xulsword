/* eslint-disable @typescript-eslint/no-explicit-any */
import { GType, GPublic } from '../type';

// This G object is for use in renderer processes, and it shares the same
// interface as the main process G object. Properties of this object
// access data and objects via IPC to the main process G object. Local
// readonly data is cached.

const R = window.ipc.renderer;

const base: Pick<GType, 'reset' | 'cache'> = {
  cache: {},

  reset() {
    this.cache = {};
  },
};

const G = base as GType;

const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const gPublic = GPublic as any;
  const g = G as any;
  const [name, val] = entry;
  if (val === 'readonly') {
    Object.defineProperty(G, name, {
      get() {
        if (!(name in this.cache)) {
          this.cache[name] = R.sendSync('global', name);
        }
        return this.cache[name];
      },
    });
  } else if (typeof val === 'function') {
    g[name] = (...args: any[]) => {
      return R.sendSync('global', name, ...args);
    };
  } else if (typeof val === 'object') {
    const methods = Object.getOwnPropertyNames(val);
    methods.forEach((m) => {
      if (g[name] === undefined) {
        g[name] = {};
      }
      if (gPublic[name][m] === 'readonly') {
        const key = `${name}.${m}`;
        Object.defineProperty(g[name], m, {
          get() {
            if (!(key in G.cache)) {
              G.cache[key] = R.sendSync('global', name, m);
            }
            return G.cache[key];
          },
        });
      } else {
        g[name][m] = (...args: unknown[]) => {
          return R.sendSync('global', name, m, ...args);
        };
      }
    });
  } else {
    throw Error(`unhandled GPublic entry value ${val}`);
  }
});

export default G as unknown as GType;
