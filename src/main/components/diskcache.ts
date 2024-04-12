
import log from 'electron-log';
import { JSON_parse, JSON_stringify } from '../../common.ts';
import C from '../../constant.ts';
import { PrefObject } from '../../type.ts';
import Dirs from './dirs.ts';

// Cache to disk store PrefValue data referenced by key.
const DiskCache = {
  storage: {} as PrefObject,

  storesToBeSaved: [] as string[],

  has(key: string, store: string) {
    const aStore = this.getStore(store);
    return key in aStore;
  },

  read(key: string, store: string) {
    const aStore = this.getStore(store);
    return aStore[key];
  },

  // Throws if cache already exists, so check first.
  write(key: string, value: any, store: string) {
    if (C.SwordModuleCharsRE.test(store)) {
      const aStore = this.getStore(store);
      if (key in aStore) {
        throw Error(`Cache already exists: '${key}' in '${store}'`);
      }
      aStore[key] = value;
      if (!this.storesToBeSaved.includes(store)) {
        this.storesToBeSaved.push(store);
      }
    } else {
      log.error(`Invalid cache store (letters and numbers only): ${store}`);
    }
  },

  // Delete one or more cache keys and files. If neither key nor
  // store is specified, all disk caches will be deleted.
  delete(key?: string | null, store?: string) {
    if (key && store) {
      const aStore = this.getStore(store);
      if (key in aStore) delete aStore[key];
      if (Object.keys(aStore).length === 0) {
        const storeFile = Dirs.xsCache;
        storeFile.append(`${store}.json`);
        if (storeFile.exists()) storeFile.remove();
      }
    } else if (!key && store) {
      const storeFile = Dirs.xsCache;
      storeFile.append(`${store}.json`);
      if (storeFile.exists()) storeFile.remove();
      if (store in this.storage) delete this.storage[store];
    } else if (!key && !store) {
      const cacheDir = Dirs.xsCache;
      cacheDir.directoryEntries.forEach((d) => {
        const cacheFile = cacheDir.clone().append(d);
        cacheFile.remove();
      });
      this.storage = {};
    } else {
      throw new Error(`Store was not specified: '${key}'`);
    }
  },

  writeAllStores() {
    Object.entries(this.storage).forEach((entry) => {
      const [store, prefObj] = entry;
      if (this.storesToBeSaved.includes(store)) {
        this.storesToBeSaved.splice(this.storesToBeSaved.indexOf(store), 1);
        const cacheFile = Dirs.xsCache.append(`${store}.json`);
        if (prefObj && !Array.isArray(prefObj) && typeof prefObj === 'object') {
          cacheFile.writeFile(JSON_stringify(prefObj));
          log.verbose(`Persisted cache: ${cacheFile.path}`);
        } else {
          log.error(`Invalid cache prefObject: ${prefObj}`);
        }
      }
    });
  },

  getStore(store: string): PrefObject {
    if (store in this.storage) {
      const s = this.storage[store];
      if (s && !Array.isArray(s) && typeof s === 'object') return s;
    }
    const storeFile = Dirs.xsCache;
    storeFile.append(`${store}.json`);
    let s: PrefObject = {};
    if (storeFile.exists()) {
      s = JSON_parse(storeFile.readFile());
      if (!s && Array.isArray(s) && typeof s !== 'object') {
        s = {};
      }
    }
    this.storage[store] = s;
    return s;
  },
};

export default DiskCache as Omit<
  typeof DiskCache,
  'storage' | 'getStore' | 'storesToBeSaved'
>;
