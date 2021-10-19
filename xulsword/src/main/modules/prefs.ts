/* eslint-disable new-cap */
import path from 'path';
import fs from 'fs';
import { jsdump } from '../../common0';
import nsILocalFile from '../components/nsILocalFile';
import { xsPrefD, xsPrefDefD } from './localPath';

export default class Prefs {
  [s: string]: unknown | ((s: string) => unknown);

  // True means write sources to disk after every change
  writeOnChange: boolean;

  // Cache all persistent data
  store: {
    [s: string]: {
      file: nsILocalFile;
      data: { [s: string]: boolean | string | number } | null;
    };
  } | null;

  constructor(writeOnChange: boolean) {
    this.writeOnChange = writeOnChange;
    this.store = {};
  }

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref = (key: string, aStore = 'default'): string => {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  };

  // Set a string pref value. Error if key is not String.
  setCharPref = (key: string, value: string, aStore = 'default'): boolean => {
    return this.setPref(key, 'string', value, aStore);
  };

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref = (key: string, aStore = 'default'): boolean => {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  };

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref = (key: string, value: string, aStore = 'default'): boolean => {
    return this.setPref(key, 'boolean', value, aStore);
  };

  // Get an integer pref value. Error if key is not an integer, or is missing from store.
  getIntPref = (key: string, aStore = 'default'): number => {
    return this.getPrefOrCreate(key, 'integer', undefined, aStore) as number;
  };

  // Set a Boolean pref value. Error if key is not an integer.
  setIntPref = (key: string, value: string, aStore = 'default'): boolean => {
    return this.setPref(key, 'integer', value, aStore);
  };

  // Remove the key from a store
  clearUserPref = (key: string, aStore = 'default'): boolean => {
    return this.setPref(key, 'undefined', undefined, aStore);
  };

  // Get persistent data from source json files
  getStore = (
    aStore = 'default'
  ): { [s: string]: boolean | string | number } | null => {
    // Create a new store if needed
    if (!this.store || !(aStore in this.store)) {
      const name = aStore === 'default' ? 'prefs' : aStore;
      this.store = {
        ...this.store,
        [aStore]: {
          file: new nsILocalFile(
            path.join(xsPrefD.path, name.concat('.json')),
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
          path.join(xsPrefDefD.path, name.concat('.json')),
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
  };

  // Write persistent data to source json files. If there is no data object
  // for the store, then there have been no set/gets on the store, and nothing
  // will be written. True is returned on success.
  writeStore = (aStore = 'default'): boolean => {
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
  };

  // Get a pref value and throw an error if it does not match type. If the key
  // is not found in the store, it will be added having value defval, and defval
  // will be returned. If defval is required but not supplied, an error is thrown.
  // Supported types are Javascript primitive types and 'integer'.
  getPrefOrCreate = (
    key: string,
    type: string,
    defval: boolean | string | number | undefined,
    aStore = 'default'
  ): unknown => {
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
      typeof val !== type &&
      !(typeof val === 'number' && type === 'integer')
    ) {
      throw Error(`type not ${type}: ${key} of ${aStore} store`);
    }

    return val;
  };

  // Write a key value pair to a store. If the value is undefined, the key will
  // be removed from the store. An error is thrown if the value is not
  // of the specified type. If this.writeOnChange is set, then the store will
  // be saved to disk immediately. Supported types are Javascript primitive
  // types and 'integer'.
  setPref = (
    key: string,
    type: string,
    value: string | number | boolean | undefined,
    aStore = 'default'
  ): boolean => {
    const p = this.getStore(aStore);
    if (p === null) {
      jsdump(`WARN: failed to set key ${key} in ${aStore}`);
      return false;
    }

    if (
      typeof value !== type &&
      !(typeof value === 'number' && type === 'integer')
    ) {
      jsdump(`WARN: setPref to wrong type: ${typeof value} !== ${type}`);
      return false;
    }

    if (
      typeof value === 'number' &&
      type === 'integer' &&
      Math.trunc(value) !== value
    ) {
      jsdump(`WARN: setPref to non-integer: ${Math.trunc(value)} != ${value}`);
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
  };
}
