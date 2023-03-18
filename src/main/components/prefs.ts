/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { S } from '../../constant';
import { clone, diff, JSON_parse, JSON_stringify } from '../../common';
import Subscription from '../../subscription';
import LocalFile from './localFile';
import Dirs from './dirs';

import type { PrefObject, PrefStoreType, PrefValue } from '../../type';

export type PrefCallbackType = (
  callingWinID: number,
  store: PrefStoreType,
  key: string,
  value: PrefValue
) => void;

const Prefs = {
  // True means write sources to disk after every change
  writeOnChange: false,

  // Cache all persistent data
  stores: {} as {
    [i in string | PrefStoreType]: {
      file: LocalFile;
      data: any;
    };
  },

  has(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    aStore?: PrefStoreType
  ): boolean {
    const value = this.getKeyValueFromStore(key, true, aStore || 'prefs');
    if (value === undefined) return false;
    if (!this.isType(type, value)) return false;
    return true;
  },

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref(key: string, aStore?: PrefStoreType): string {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  },

  // Set a string pref value. Error if key is not String.
  setCharPref(key: string, value: string, aStore?: PrefStoreType): boolean {
    return this.setPref(key, 'string', value, aStore, arguments[3] ?? -1);
  },

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref(key: string, aStore?: PrefStoreType): boolean {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  },

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref(key: string, value: boolean, aStore?: PrefStoreType): boolean {
    return this.setPref(key, 'boolean', value, aStore, arguments[3] ?? -1);
  },

  // Get a number pref value (does no need to be an integer). Error if key is
  // not a number, or is missing from store.
  getIntPref(key: string, aStore?: PrefStoreType): number {
    return this.getPrefOrCreate(key, 'number', undefined, aStore) as number;
  },

  // Set a Boolean pref value. Error if key is not an number.
  setIntPref(key: string, value: number, aStore?: PrefStoreType): boolean {
    return this.setPref(key, 'number', value, aStore, arguments[3] ?? -1);
  },

  // Get a complex pref value. Error if key is not complex, or is missing from store.
  getComplexValue(key: string, aStore?: PrefStoreType): unknown {
    return this.getPrefOrCreate(key, 'complex', undefined, aStore);
  },

  // Set a Boolean pref value. Error if key is not an number.
  setComplexValue(key: string, value: any, aStore?: PrefStoreType): boolean {
    return this.setPref(key, 'complex', value, aStore, arguments[3] ?? -1);
  },

  // Sets individual properties of a key, leaving the others untouched.
  mergeValue(
    key: string,
    obj: { [i: string]: any },
    aStore?: PrefStoreType,
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
  deleteUserPref(key: string, aStore?: PrefStoreType): boolean {
    return this.setPref(key, 'any', undefined, aStore, arguments[2] ?? -1);
  },

  // Return the pref value of the given type. If the key is not found in the
  // store, or its value is of the wrong type, it will be reset to a default
  // value. The default value will be the first found of:
  // 1) defval argument (unless undefined)
  // 2) current store_default value (if it exists)
  // 3) value from S global variable.
  // Finally, if no default value is found, an exception is thrown.
  getPrefOrCreate(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex',
    defval: PrefValue,
    store?: PrefStoreType
  ): PrefValue {
    if (defval !== undefined && !this.isType(type, defval)) {
      throw new Error(
        `Default pref has wrong type. Expected '${type}', got '${typeof defval}'.`
      );
    }
    const aStore = store || 'prefs';
    const storeValue = this.getKeyValueFromStore(key, true, aStore);
    let value = storeValue;
    if (storeValue === undefined) value = defval;
    if (value !== undefined && value !== storeValue) {
      this.setPref(key, type, value, aStore, arguments[4] ?? -1);
    }
    if (!this.isType(type, value)) {
      // A program update may have caused a pref type change, so delete
      // the existing value and replace it with a default value. Reading
      // after delete causes the store_default to be read.
      this.deleteUserPref(key, store);
      const ks = key.split('.');
      let s = S as any;
      while (typeof s === 'object' && ks[0] in s) s = s[ks.shift() as string];
      if (ks.length > 0) s = undefined;
      value = this.getKeyValueFromStore(key, s !== undefined, aStore);
      if (value === undefined) value = s;
      this.setPref(key, type, value, aStore, arguments[4] ?? -1);
    }

    return value;
  },

  // Get persistent data from source json files
  getStore(aStorex: string, getDefaultStore = false): PrefObject {
    // Create a new store if needed
    const aStore = getDefaultStore ? `${aStorex}_default` : aStorex;
    const pdir = getDefaultStore ? Dirs.path.xsPrefDefD : Dirs.path.xsPrefD;
    if (this.stores === null || !(aStore in this.stores)) {
      this.stores = {
        ...this.stores,
        [aStore]: {
          file: new LocalFile(
            path.join(pdir, aStorex.concat('.json')),
            LocalFile.NO_CREATE
          ),
          data: null,
        },
      };
    }

    const s = this.stores[aStore];

    // Read the data unless it has already been read
    if (!s.data) {
      if (getDefaultStore && !s.file.exists()) {
        s.data = {};
      } else {
        if (!s.file.exists()) {
          // If there is no store file, copy the default or create one.
          const defFile = new LocalFile(
            path.join(Dirs.path.xsPrefDefD, aStorex.concat('.json')),
            LocalFile.NO_CREATE
          );
          if (defFile.exists()) {
            defFile.copyTo(s.file.parent, s.file.leafName);
          } else {
            s.file.writeFile('{}');
          }
        }
        if (!s.file.exists()) {
          throw new Error(`Failed to create pref store: ${s.file.path}`);
        }
        const data = fs.readFileSync(s.file.path);
        if (data && data.length) {
          const json = JSON_parse(data.toString());
          if (json && typeof json === 'object') {
            s.data = json;
          }
        }
      }
    }
    if (!s.data || typeof s.data !== 'object' || Array.isArray(s.data)) {
      throw Error(
        `Read of JSON Prefs store did not return a PrefObject (store='${s.file.path}', contents='${s.data}').`
      );
    }

    return s.data;
  },

  getKeyValueFromStore(
    key: string,
    noErrorOnMissingKey: boolean,
    aStore: string,
    getDefaultStore = false
  ): PrefValue {
    const stobj = this.getStore(aStore, getDefaultStore);
    let keyExists = true;
    let keyvalue = stobj as PrefObject | PrefValue;
    key.split('.').forEach((d) => {
      if (
        keyExists &&
        keyvalue &&
        typeof keyvalue === 'object' &&
        !Array.isArray(keyvalue) &&
        d in keyvalue
      ) {
        keyvalue = keyvalue[d] as PrefValue;
      } else {
        keyExists = false;
      }
    });
    if (!keyExists) {
      if (!getDefaultStore) {
        return this.getKeyValueFromStore(
          key,
          noErrorOnMissingKey,
          aStore,
          true
        );
      }
      if (noErrorOnMissingKey) return undefined;
      throw Error(`Missing Prefs key: '${key}' of '${aStore}' store`);
    }
    return keyvalue;
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
  writeStore(aStore: PrefStoreType = 'prefs') {
    if (!this.stores) return false;

    const s = this.stores[aStore];
    if (!s.data || typeof s.data !== 'object') return false;

    // Prune unrecognized or outdated pref values
    const allStoreKeys = Object.keys(S[aStore]);
    Object.keys(s.data).forEach((k) => {
      if (!allStoreKeys.includes(k)) delete s.data[k];
    });

    const json = JSON_stringify(s.data, 2);
    if (json) {
      fs.writeFileSync(s.file.path, json);
      log.verbose(`Persisted store: ${s.file.path}`);
    } else {
      throw Error(`Failed to write Prefs store: ${s.file.path}`);
    }

    return true;
  },

  writeAllStores(): void {
    if (!this.writeOnChange && this.stores !== null) {
      Object.keys(this.stores).forEach((store: PrefStoreType | string) => {
        if (!store.endsWith('_default')) {
          this.writeStore(store as PrefStoreType);
        }
      });
    }
  },

  // Write a key value pair to a store, and return true if succesfull. If the
  // value is undefined, the key will be removed from the store. If the value
  // does not match the given type, false is returned, and nothing is set and no
  // error is thrown. If this.writeOnChange is set, then the store will be saved
  // to disk immediately. Supported types are PrefValue. If a change was made,
  // any registered subscription callbacks will be called after setting the new
  // value.
  setPref(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any' | 'merge',
    value: PrefValue,
    store: PrefStoreType | undefined,
    callingWinID: number,
    clearRendererCaches?: boolean
  ): boolean {
    // Get the store.
    const aStore = store || 'prefs';
    let p = this.getStore(aStore);
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
        throw Error(
          `Prefs merge failed because value is not a PrefObject (value='${value}', key='${key}', store='${aStore}').`
        );
      }
    } else if (!this.isType(type, value)) {
      log.warn(
        `Prefs was given the wrong type (expected='${type}', given='${value}', key='${key}', store='${aStore}').`
      );
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
            `Prefs parent key is not a PrefObject: '${a
              .slice(0, i + 1)
              .join('.')}'`
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
        throw Error(
          `Prefs merge failed because the key does not contain a PrefObject (key-value='${pp}', key='${key}', store='${aStore}').`
        );
      }
    } else p[k] = clone(value);
    // If not writeOnChange, then data is persisted only when app is closed.
    let success = true;
    if (this.writeOnChange) {
      success = this.writeStore(aStore);
    }
    // Reset renderer caches if requested. When pref values are being pushed
    // to renderer windows that are incompatible with currently cached data,
    // such as global.locale, caches must be cleared before prefs are updated!
    if (clearRendererCaches) {
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('cache-reset');
      });
    }
    // Call any registered callbacks if value was successfully changed.
    if (success) {
      const args: Parameters<PrefCallbackType> = [
        callingWinID,
        aStore,
        key,
        value,
      ];
      Subscription.publish.prefsChanged(...args);
    }

    return success;
  },
};

export type PrefsGType = Omit<
  typeof Prefs,
  | 'writeOnChange'
  | 'stores'
  | 'getStore'
  | 'getKeyValueFromStore'
  | 'isType'
  | 'writeStore'
  | 'setPref'
>;

export default Prefs as PrefsGType;
