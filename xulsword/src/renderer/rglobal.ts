import { GClass, GPublic } from '../type';

const R = window.ipc.renderer;

const G: { [i: string]: any } = {
  cache: {} as { [i: string]: any },

  reset() {
    G.cache = {};
  },
};

const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const [name, v] = entry;
  if (v === 'readonly') {
    Object.defineProperty(G, name, {
      get() {
        if (!(name in G.cache)) {
          G.cache[name] = R.sendSync('global', name);
        }
        return G.cache[name];
      },
    });
  } else if (typeof v === 'object') {
    const methods = Object.getOwnPropertyNames(v);
    methods.forEach((m) => {
      if (G[name] === undefined) {
        G[name] = {};
      }
      if (GPublic[name][m] === 'readonly') {
        const key = `${name}.${m}`;
        Object.defineProperty(G[name], m, {
          get() {
            if (!(key in G.cache)) {
              G.cache[key] = R.sendSync('global', name, m);
            }
            return G.cache[key];
          },
        });
      } else {
        G[name][m] = (...args) => {
          return R.sendSync('global', name, m, ...args);
        };
      }
    });
  } else {
    throw Error(`unhandled GPublic entry value ${v}`);
  }
});

export default G as GClass;
