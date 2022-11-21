/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { clone, diff, JSON_parse, JSON_stringify } from '../../common';
import Subscription from '../../subscription';
import LocalFile from './localFile';
import Dirs from './dirs';

import type { GAddCaller, PrefObject, PrefValue } from '../../type';

export type PrefCallbackType = (
  callingWinID: number,
  key: string,
  value: any,
  store?: string
) => void;

const Prefs = {
  // True means write sources to disk after every change
  writeOnChange: false,

  // Cache all persistent data
  store: {} as {
    [i in string | 'prefs']: {
      file: LocalFile;
      data: any;
    };
  },

  has(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    aStore?: string
  ): boolean {
    const value = this.getKeyValueFromStore(key, false, aStore || 'prefs');
    if (value === undefined) return false;
    if (!this.isType(type, value)) return false;
    return true;
  },

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref(key: string, aStore?: string): string {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  },

  // Set a string pref value. Error if key is not String.
  setCharPref(key: string, value: string, aStore?: string): boolean {
    return this.setPref(key, 'string', value, aStore, arguments[3] ?? -1);
  },

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref(key: string, aStore?: string): boolean {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  },

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref(key: string, value: boolean, aStore?: string): boolean {
    return this.setPref(key, 'boolean', value, aStore, arguments[3] ?? -1);
  },

  // Get a number pref value (does no need to be an integer). Error if key is
  // not a number, or is missing from store.
  getIntPref(key: string, aStore?: string): number {
    return this.getPrefOrCreate(key, 'number', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setIntPref(key: string, value: number, aStore?: string): boolean {
    return this.setPref(key, 'number', value, aStore, arguments[3] ?? -1);
  },

  // Get a complex pref value. Error if key is not complex, or is missing from store.
  getComplexValue(key: string, aStore?: string): unknown {
    return this.getPrefOrCreate(key, 'complex', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setComplexValue(key: string, value: any, aStore?: string): boolean {
    return this.setPref(key, 'complex', value, aStore, arguments[3] ?? -1);
  },

  // Sets individual properties of a key, leaving the others untouched.
  mergeValue(
    key: string,
    obj: { [i: string]: any },
    aStore?: string,
    clearRendererCaches?: boolean
  ): void {
    this.setPref(
      key,
      'merge',
      obj,
      aStore,
      arguments[4] ?? -1,
      clearRendererCaches
    );
  },

  // Remove the key from a store
  deleteUserPref(key: string, aStore?: string): boolean {
    return this.setPref(key, 'any', undefined, aStore, arguments[2] ?? -1);
  },

  // Get a pref value and throw an error if it does not match type. If the key
  // is not found in the store, it will be added having value defval, and defval
  // will be returned. If defval is required but not supplied, an error is thrown.
  getPrefOrCreate(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex',
    defval: any,
    store?: string
  ): PrefValue {
    const aStore = store || 'prefs';
    const value = this.getKeyValueFromStore(key, defval === undefined, aStore);

    const newval = value !== undefined ? value : defval;
    if (newval !== value) {
      this.setPref(key, type, newval, aStore, arguments[4] ?? -1);
    } else if (!this.isType(type, newval)) {
      throw Error(
        `type '${typeof newval}' expected '${type}': key='${key}' of store='${aStore}'`
      );
    }

    return newval;
  },

  // Get persistent data from source json files
  getStore(aStore: string): PrefObject {
    // Create a new store if needed
    if (this.store === null || !(aStore in this.store)) {
      this.store = {
        ...this.store,
        [aStore]: {
          file: new LocalFile(
            path.join(Dirs.path.xsPrefD, aStore.concat('.json')),
            LocalFile.NO_CREATE
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
        const defFile = new LocalFile(
          path.join(Dirs.path.xsPrefDefD, aStore.concat('.json')),
          LocalFile.NO_CREATE
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

  getKeyValueFromStore(
    key: string,
    throwIfMissing: boolean,
    aStore: string
  ): PrefValue {
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

  isType(
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    value: PrefValue
  ): boolean {
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
      log.verbose(`Persisted store: ${s.file.path}`);
    } else {
      throw Error(`failed to write store: ${s.file.path}`);
    }

    return true;
  },

  writeAllStores(): void {
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
  setPref(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any' | 'merge',
    value: PrefValue,
    store: string | undefined,
    callingWinID: number,
    clearRendererCaches?: boolean
  ): boolean {
    // Get the store.
    const aStore = store || 'prefs';
    let p = this.getStore(aStore);
    if (p === null) {
      log.warn(`Failed to set key ${key} in ${aStore}`);
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
      log.warn(`setPref wrong type: ${key}: ${typeof value} !== ${type}`);
      return false;
    }
    // Get (or create) the parent object of the key.
    let k = key;
    key.split('.').forEach((d, i, a) => {
      k = d;
      if (i + 1 === a.length) return;
      if (!(d in p)) p[d] = {};
      const pd = p[d];
      if (pd) {
        if (typeof pd !== 'object' || Array.isArray(pd)) {
          throw Error(
            `Parent key is not a PrefObject: '${a.slice(0, i + 1).join('.')}'`
          );
        }
        p = pd;
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
    // Reset renderer caches if requested. When pref values are being pushed
    // to renderer windows that are incompatible with currently cached data,
    // caches must be cleared before the prefs are updated!
    if (clearRendererCaches) {
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('cache-reset');
      });
    }
    // Call any registered callbacks if value was successfully changed.
    if (success) {
      const args: Parameters<PrefCallbackType> = [
        callingWinID,
        key,
        value,
        aStore,
      ];
      Subscription.publish.setPref(...args);
    }

    return success;
  },
};

export type PrefsGType = Omit<
  typeof Prefs,
  | 'writeOnChange'
  | 'store'
  | 'getStore'
  | 'getKeyValueFromStore'
  | 'isType'
  | 'writeStore'
  | 'setPref'
>;

export default Prefs as PrefsGType;
