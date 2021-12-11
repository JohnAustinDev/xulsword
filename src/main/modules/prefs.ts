/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import path from 'path';
import fs from 'fs';
import { PrefsPublic } from '../../type';
import nsILocalFile from '../components/nsILocalFile';
import Dirs from './dirs';
import { jsdump } from '../mutil';

const Prefs: typeof PrefsPublic & PrefsPrivate = {
  // True means write sources to disk after every change
  writeOnChange: false,

  // Cache all persistent data
  store: {},

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref(key, aStore = 'default') {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  },

  // Set a string pref value. Error if key is not String.
  setCharPref(key, value, aStore = 'default') {
    return this.setPref(key, 'string', value, aStore);
  },

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref(key, aStore = 'default') {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  },

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref(key, value, aStore = 'default') {
    return this.setPref(key, 'boolean', value, aStore);
  },

  // Get a number pref value (does no need to be an integer). Error if key is not a number, or is missing from store.
  getIntPref(key, aStore = 'default') {
    return this.getPrefOrCreate(key, 'number', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setIntPref(key, value, aStore = 'default') {
    return this.setPref(key, 'number', value, aStore);
  },

  // Get a complex pref value. Error if key is not complex, or is missing from store.
  getComplexValue(key, aStore = 'default') {
    return this.getPrefOrCreate(key, 'complex', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setComplexValue(key, value, aStore = 'default') {
    return this.setPref(key, 'complex', value, aStore);
  },

  // Remove the key from a store
  clearUserPref(key, aStore = 'default') {
    return this.setPref(key, 'undefined', undefined, aStore);
  },

  // Get a pref value and throw an error if it does not match type. If the key
  // is not found in the store, it will be added having value defval, and defval
  // will be returned. If defval is required but not supplied, an error is thrown.
  getPrefOrCreate(key, type, defval, aStore = 'default') {
    const p = this.getStore(aStore);
    if (p === null) return undefined;

    let val = defval;

    if (key in p) {
      val = p[key];
    } else {
      if (defval === undefined) {
        throw Error(`no key and no default: ${key} of ${aStore} store`);
      }
      this.setPref(key, type, val, aStore);
    }

    if (
      (type !== 'complex' && typeof val !== type) ||
      (type === 'complex' && typeof val !== 'object')
    ) {
      throw Error(`type not ${type}: ${key} of ${aStore} store`);
    }

    return val;
  },

  // Get persistent data from source json files
  getStore(aStore = 'default') {
    // Create a new store if needed
    if (this.store === null || !(aStore in this.store)) {
      const name = aStore === 'default' ? 'prefs' : aStore;
      this.store = {
        ...this.store,
        [aStore]: {
          file: new nsILocalFile(
            path.join(Dirs.path.xsPrefD, name.concat('.json')),
            nsILocalFile.NO_CREATE
          ),
          data: null,
        },
      };
    }

    const s = this.store[aStore];

    // Read the data unless it has already been read
    if (!s.data || typeof s.data !== 'object') {
      // If there is no source file, copy the default
      if (!s.file.exists()) {
        const name = aStore === 'default' ? 'prefs' : aStore;
        const defFile = new nsILocalFile(
          path.join(Dirs.path.xsPrefDefD, name.concat('.json')),
          nsILocalFile.NO_CREATE
        );

        if (!defFile.exists())
          throw Error(`Default pref file is missing: ${defFile.path}`);

        defFile.copyTo(s.file.parent, s.file.leafName);
      }

      if (s.file.exists()) {
        const data = fs.readFileSync(s.file.path);
        if (data && data.length) {
          const json = JSON.parse(data.toString());
          if (json && typeof json === 'object') {
            s.data = json;
          }
        } else {
          throw Error(`ERROR: failed to read store ${aStore}`);
          s.data = null;
        }
      }

      if (s.data === null) {
        throw Error(`ERROR: failed to read prefs from: ${s.file.path}`);
        return null;
      }
    }

    return s.data as { [index: string]: boolean | string | number };
  },

  // Write persistent data to source json files. If there is no data object
  // for the store, then there have been no set/gets on the store, and nothing
  // will be written. True is returned on success.
  writeStore(aStore = 'default') {
    if (!this.store) return false;

    const s = this.store[aStore];
    if (!s.data || typeof s.data !== 'object') return false;

    const json = JSON.stringify(s.data, null, 2);
    if (json) {
      fs.writeFileSync(s.file.path, json);
      jsdump(`NOTE: Persisted store: ${s.file.path}`);
    } else {
      throw Error(`failed to write store: ${s.file.path}`);
    }

    return true;
  },

  writeAllStores() {
    if (!this.writeOnChange && this.store !== null) {
      Object.keys(this.store).forEach((key) => this.writeStore(key));
    }
  },

  // Write a key value pair to a store. If the value is undefined, the key will
  // be removed from the store. An error is thrown if the value is not
  // of the specified type. If this.writeOnChange is set, then the store will
  // be saved to disk immediately. Supported types are Javascript primitive
  // types and 'complex' for anything else.
  setPref(key, type, value, aStore = 'default') {
    const p = this.getStore(aStore);
    if (p === null) {
      jsdump(`WARN: failed to set key ${key} in ${aStore}`);
      return false;
    }

    if (
      (type === 'complex' && typeof value !== 'object') ||
      (type !== 'complex' && typeof value !== type)
    ) {
      jsdump(`WARN: setPref to wrong type: ${typeof value} !== ${type}`);
      return false;
    }

    if (value === undefined) {
      delete p[key];
    } else {
      p[key] = value;
    }

    // If not writeOnChange, then data is persisted only when app is closed.
    if (this.writeOnChange) {
      return this.writeStore(aStore);
    }

    return true;
  },
};

type PrefsPrivate = {
  writeOnChange: boolean;

  store: { [i: string]: any };

  setPref: (
    key: string,
    type: string,
    value: string | number | boolean | undefined,
    aStore: string
  ) => boolean;

  writeStore: (aStore: string) => boolean;
};

export default Prefs as typeof PrefsPublic;
