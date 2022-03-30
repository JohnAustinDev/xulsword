/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { clone, diff, JSON_parse, JSON_stringify } from '../../common';
import Subscription from '../../subscription';
import nsILocalFile from '../components/nsILocalFile';
import Dirs from './dirs';
import { jsdump } from '../mutil';

import type { GType, PrefObject, PrefValue } from '../../type';

export type PrefCallbackType = (
  callingWin: BrowserWindow | null,
  key: string,
  value: any,
  store?: string
) => void;

type StoreType = {
  [i in string | 'prefs']: {
    file: nsILocalFile;
    data: any;
  };
};

type PrefsPrivate = {
  writeOnChange: boolean;
  store: StoreType;
  setPref: (
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any' | 'merge',
    value: PrefValue,
    aStore: string | undefined,
    callingWin: BrowserWindow
  ) => boolean;
  writeStore: (aStore: string) => boolean;
  getStore: (aStore: string) => PrefObject;
  getKeyValueFromStore(
    key: string,
    throwIfMissing: boolean,
    store: string
  ): PrefValue;
  isType: (
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    value: PrefValue
  ) => boolean;
};

const Prefs: GType['Prefs'] & PrefsPrivate = {
  // True means write sources to disk after every change
  writeOnChange: false,

  // Cache all persistent data
  store: {},

  has(key, type, aStore?) {
    const value = this.getKeyValueFromStore(key, false, aStore || 'prefs');
    if (value === undefined) return false;
    if (!this.isType(type, value)) return false;
    return true;
  },

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref(key, aStore?) {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  },

  // Set a string pref value. Error if key is not String.
  setCharPref(key, value, aStore?) {
    const w = arguments[3];
    return this.setPref(key, 'string', value, aStore, w);
  },

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref(key, aStore?) {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  },

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref(key, value, aStore?) {
    const w = arguments[3];
    return this.setPref(key, 'boolean', value, aStore, w);
  },

  // Get a number pref value (does no need to be an integer). Error if key is not a number, or is missing from store.
  getIntPref(key, aStore?) {
    return this.getPrefOrCreate(key, 'number', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setIntPref(key, value, aStore?) {
    const w = arguments[3];
    return this.setPref(key, 'number', value, aStore, w);
  },

  // Get a complex pref value. Error if key is not complex, or is missing from store.
  getComplexValue(key, aStore?) {
    return this.getPrefOrCreate(key, 'complex', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setComplexValue(key, value, aStore?) {
    const w = arguments[3];
    return this.setPref(key, 'complex', value, aStore, w);
  },

  // Sets individual properties of a key, leaving the others untouched.
  mergeValue(key, obj, aStore?) {
    const callingWin = arguments[3];
    this.setPref(key, 'merge', obj, aStore, callingWin);
  },

  // Remove the key from a store
  deleteUserPref(key, aStore?) {
    const w = arguments[2];
    return this.setPref(key, 'any', undefined, aStore, w);
  },

  // Get a pref value and throw an error if it does not match type. If the key
  // is not found in the store, it will be added having value defval, and defval
  // will be returned. If defval is required but not supplied, an error is thrown.
  getPrefOrCreate(key, type, defval, store?) {
    const aStore = store || 'prefs';
    const w = arguments[4];
    const value = this.getKeyValueFromStore(key, defval === undefined, aStore);

    const newval = value !== undefined ? value : defval;
    if (newval !== value) {
      this.setPref(key, type, newval, aStore, w);
    } else if (!this.isType(type, newval)) {
      throw Error(
        `type '${typeof newval}' expected '${type}': key='${key}' of store='${aStore}'`
      );
    }

    return newval;
  },

  // Get persistent data from source json files
  getStore(aStore) {
    // Create a new store if needed
    if (this.store === null || !(aStore in this.store)) {
      this.store = {
        ...this.store,
        [aStore]: {
          file: new nsILocalFile(
            path.join(Dirs.path.xsPrefD, aStore.concat('.json')),
            nsILocalFile.NO_CREATE
          ),
          data: null,
        },
      };
    }

    const s = this.store[aStore];

    // Read the data unless it has already been read
    if (!s.data || typeof s.data !== 'object') {
      // If there is no store file, copy the default or create one.
      if (!s.file.exists()) {
        const defFile = new nsILocalFile(
          path.join(Dirs.path.xsPrefDefD, aStore.concat('.json')),
          nsILocalFile.NO_CREATE
        );
        if (defFile.exists()) {
          defFile.copyTo(s.file.parent, s.file.leafName);
        } else if (aStore === 'prefs') {
          throw Error(`Default prefs file is missing: ${defFile.path}`);
        } else {
          s.file.writeFile('{}');
        }
      }

      if (s.file.exists()) {
        const data = fs.readFileSync(s.file.path);
        if (data && data.length) {
          const json = JSON_parse(data.toString());
          if (json && typeof json === 'object') {
            s.data = json;
          }
        } else {
          throw Error(`ERROR: failed to read store ${aStore}`);
        }
      }

      if (s.data === null) {
        throw Error(`ERROR: failed to read prefs from: ${s.file.path}`);
      }
    }

    return s.data;
  },

  getKeyValueFromStore(key, throwIfMissing, aStore) {
    const stobj = this.getStore(aStore);
    if (stobj === null) {
      if (throwIfMissing) throw Error(`missing store: '${aStore}'`);
      return undefined;
    }
    let keyExists = true;
    let keyvalue = stobj as PrefObject | PrefValue;
    key.split('.').forEach((d) => {
      if (
        !keyExists ||
        !keyvalue ||
        typeof keyvalue !== 'object' ||
        Array.isArray(keyvalue) ||
        !(d in keyvalue)
      ) {
        if (throwIfMissing) {
          throw Error(`missing key: '${key}' of '${aStore}' store`);
        }
        keyExists = false;
      } else {
        keyvalue = keyvalue[d] as PrefValue;
      }
    });
    return keyExists ? keyvalue : undefined;
  },

  isType(type, value) {
    if (type !== 'any') {
      const type2 = type === 'complex' ? 'object' : type;
      if (typeof value !== type2) {
        return false;
      }
    }
    return true;
  },

  // Write persistent data to source json files. If there is no data object
  // for the store, then there have been no set/gets on the store, and nothing
  // will be written. True is returned on success.
  writeStore(aStore = 'prefs') {
    if (!this.store) return false;

    const s = this.store[aStore];
    if (!s.data || typeof s.data !== 'object') return false;

    const json = JSON_stringify(s.data, null, 2);
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
  // be removed from the store. An error is thrown if the value is not of the
  // specified type. If this.writeOnChange is set, then the store will be saved
  // to disk immediately. Supported types are PrefValue. If a change was made,
  // any registered subscription callbacks will be called after setting the new
  // value.
  setPref(key, type, value, store, callingWin) {
    // Get the store.
    const aStore = store || 'prefs';
    let p = this.getStore(aStore);
    if (p === null) {
      jsdump(`WARN: failed to set key ${key} in ${aStore}`);
      return false;
    }
    // Test the value.
    let valueobj: PrefObject | undefined;
    if (type === 'merge') {
      if (
        (value === undefined || typeof value === 'object') &&
        !Array.isArray(value) &&
        value !== null
      ) {
        valueobj = value;
      } else {
        throw Error(`Prefs: merge value is not a data object: ${value}`);
      }
    } else if (!this.isType(type, value)) {
      jsdump(`WARN: setPref wrong type: ${key}: ${typeof value} !== ${type}`);
      return false;
    }
    // Get (or create) the parent object of the key.
    let k = key;
    key.split('.').forEach((d, i, a) => {
      k = d;
      if (i + 1 === a.length) return;
      if (!(d in p)) p[d] = {};
      const np = p[d];
      if (np) {
        if (typeof np !== 'object' || Array.isArray(np)) {
          throw Error(
            `Parent key is not a PrefObject: '${a.slice(0, i + 1).join('.')}'`
          );
        }
        p = np;
      }
    });
    // Check the current value and set to the new value only if needed.
    if (value === undefined) {
      if (k in p) delete p[k];
      else return true;
    } else if (diff(p[k], value) === undefined) {
      return true;
    } else if (type === 'merge') {
      let pp = p[k];
      if (!pp) pp = {};
      if (typeof pp === 'object' && !Array.isArray(pp)) {
        p[k] = { ...pp, ...clone(valueobj) };
      } else {
        throw Error(`Prefs: merge target is not a PrefObject: '${pp}'`);
      }
    } else p[k] = clone(value);
    // If not writeOnChange, then data is persisted only when app is closed.
    let success = true;
    if (this.writeOnChange) {
      success = this.writeStore(aStore);
    }
    // Call any registered callbacks if value was successfully changed.
    if (success) {
      const args: Parameters<PrefCallbackType> = [
        callingWin,
        key,
        value,
        aStore,
      ];
      Subscription.publish('setPref', ...args);
    }

    return success;
  },
};

export default Prefs as GType['Prefs'];
