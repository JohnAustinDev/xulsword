/* eslint-disable prefer-rest-params */
import S from './defaultPrefs.ts';
import { clone, diff, JSON_parse, JSON_stringify, mapp } from './common.ts';
import Subscription from './subscription.ts';

import type { BrowserWindow } from 'electron';
import type ElectronLog from 'electron-log';
import type LocalFile from './servers/components/localFile.ts';
import type { PrefObject, PrefStoreType, PrefValue } from './type.ts';

// Permanent storage of user preferences and settings. In Electron apps, the
// local file system is used as storage. In web apps, browser cookies are used
// as storage.

export type PrefCallbackType = (
  callingWinID: number,
  store: PrefStoreType,
  key: string,
  value: PrefValue,
) => void;

export type PrefStorage = {
  exists: LocalFile['exists'];
  writeFile: LocalFile['writeFile'];
  readFile: LocalFile['readFile'];
};

export type PrefsGType = Omit<
  Prefs,
  | 'writeOnChange'
  | 'browserWindow'
  | 'storage'
  | 'log'
  | 'stores'
  | 'getStore'
  | 'getKeyValueFromStore'
  | 'isType'
  | 'writeStore'
  | 'setPref'
  | 'findDefaultValue'
  | 'findDefaultValueInS'
>;

export default class Prefs {
  // True writes sources to permanent storage after every change
  writeOnChange = false as boolean;

  browserWindow = null as typeof BrowserWindow | null;

  storage = null as ((aStore: string) => PrefStorage) | null;

  log = null as ElectronLog.LogFunctions | null;

  // Cache all persistent data
  stores = {} as {
    [i in string | PrefStoreType]: {
      store: PrefStorage;
      data: PrefObject | null;
    };
  };

  constructor(
    storage: Prefs['storage'],
    log: ElectronLog.LogFunctions,
    writeOnChange?: Prefs['writeOnChange'],
    browserWindow?: Prefs['browserWindow'],
  ) {
    this.storage = storage;
    this.log = log;
    this.writeOnChange = writeOnChange ?? Build.isWebApp;
    this.browserWindow = browserWindow ?? null;
  }

  has(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    aStore?: PrefStoreType,
  ): boolean {
    const value = this.getKeyValueFromStore(key, aStore || 'prefs', true);
    if (value === undefined) return false;
    if (!this.isType(type, value)) return false;
    return true;
  }

  // Get a string pref value. Error if key is not String, or is missing from store.
  getCharPref(key: string, aStore?: PrefStoreType): string {
    return this.getPrefOrCreate(key, 'string', undefined, aStore) as string;
  }

  // Set a string pref value. Error if key is not String.
  setCharPref(key: string, value: string, aStore?: PrefStoreType): boolean {
    return this.setPref(
      key,
      'string',
      value,
      aStore,
      (arguments[3] as number) ?? -1,
    );
  }

  // Get a Boolean pref value. Error if key is not Boolean, or is missing from store.
  getBoolPref(key: string, aStore?: PrefStoreType): boolean {
    return this.getPrefOrCreate(key, 'boolean', undefined, aStore) as boolean;
  }

  // Set a Boolean pref value. Error if key is not Boolean.
  setBoolPref(key: string, value: boolean, aStore?: PrefStoreType): boolean {
    return this.setPref(
      key,
      'boolean',
      value,
      aStore,
      (arguments[3] as number) ?? -1,
    );
  }

  // Get a number pref value (does no need to be an integer). Error if key is
  // not a number, or is missing from store.
  getIntPref(key: string, aStore?: PrefStoreType): number {
    return this.getPrefOrCreate(key, 'number', undefined, aStore) as number;
  }

  // Set a Boolean pref value. Error if key is not a number.
  setIntPref(key: string, value: number, aStore?: PrefStoreType): boolean {
    return this.setPref(
      key,
      'number',
      value,
      aStore,
      (arguments[3] as number) ?? -1,
    );
  }

  // Get a complex pref value. Error if key is not complex, or is missing from store.
  getComplexValue(key: string, aStore?: PrefStoreType): unknown {
    return this.getPrefOrCreate(key, 'complex', undefined, aStore);
  }

  // Set a Boolean pref value. Error if key is not an number.
  setComplexValue(
    key: string,
    value: PrefValue,
    aStore?: PrefStoreType,
  ): boolean {
    return this.setPref(
      key,
      'complex',
      value,
      aStore,
      (arguments[3] as number) ?? -1,
    );
  }

  // Sets individual properties of a key or a store, leaving the others untouched.
  mergeValue(
    key: string | null,
    obj: PrefObject,
    aStore?: PrefStoreType,
    skipCallbacks?: boolean | undefined, // undefined means skip if no change
    clearRendererCaches?: boolean,
  ): boolean {
    return this.setPref(
      key,
      'merge',
      obj,
      aStore,
      (arguments[5] as number) ?? -1,
      skipCallbacks,
      clearRendererCaches,
    );
  }

  // Remove the key from a store
  deleteUserPref(key: string, aStore?: PrefStoreType): boolean {
    return this.setPref(
      key,
      'any',
      undefined,
      aStore,
      (arguments[2] as number) ?? -1,
    );
  }

  // Find the S default value of any key in any store. If the store is not part
  // of S, undefined is returned.
  findDefaultValueInS(key: string, store: PrefStoreType): PrefValue {
    if (store in S) {
      const ks = key.split('.');
      let s: any;
      if (store in S) s = (S as any)[store];
      while (s && ks[0] && typeof s === 'object' && ks[0] in s) {
        s = s[ks.shift() as string];
      }
      if (ks.length > 0) s = undefined;
      return s;
    }
    return undefined;
  }

  // Return the default value for a key. If store is in S and no default is
  // found, an error is thrown. If store is not in S and no default is found,
  // undefined is returned. The default value will be the first found of:
  // 1) defaultValue argument (unless undefined)
  // 2) current store value (if is exists)
  // 3) current store_default value (if it exists and isElectronApp)
  // 4) value from S global variable.
  // 5) undefined, or throw if key is in S
  findDefaultValue(
    key: string,
    defaultValue: PrefValue,
    store: PrefStoreType,
  ): PrefValue {
    if (defaultValue === undefined) {
      const s = this.findDefaultValueInS(key, store);
      const throwOnFail = store in S && s === undefined;
      const value = this.getKeyValueFromStore(key, store, !throwOnFail);
      if (value === undefined) return s;
      return value;
    }
    return defaultValue;
  }

  isType(
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    value: PrefValue,
  ): boolean {
    if (type !== 'any') {
      const type2 = type === 'complex' ? 'object' : type;
      if (typeof value !== type2) {
        return false;
      }
    }
    return true;
  }

  // Return a pref key's value, checking its type. Or if the key has not been
  // set yet, create it and set it to defval. Exceptions are thrown if:
  // - defval is provided but has the wrong type.
  // - store is in S, but the requested key is not.
  // - store is in S and the default is needed, but a default cannot be found.
  // - pref creation fails.
  // Important: If the key is not found in a store which is in S, or if its
  // value is of the wrong type, then it, along with all of its unset
  // ancestors, will be reset to a default value.
  getPrefOrCreate(
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex',
    defvalx: PrefValue,
    storex?: PrefStoreType,
  ): PrefValue {
    const callingWinID = (arguments[4] as number) ?? -1;
    // Check input values
    if (defvalx !== undefined && !this.isType(type, defvalx)) {
      throw new Error(
        `Default pref has wrong type. Expected '${type}', got '${typeof defvalx}'.`,
      );
    }
    const defval = clone(defvalx);
    const store = storex || 'prefs';
    const [rootkey] = key.split('.');
    if (store in S && !Object.keys(S[store]).includes(rootkey)) {
      throw new Error(
        `Pref root key '${rootkey}' is unrecognized in '${store}'.`,
      );
    }
    // Read the store to get the key value (without throwing if the key is
    // missing).
    let storeValue = this.getKeyValueFromStore(key, store, true, null);
    if (store in S && storeValue === undefined) {
      // This key has never been set, so look for the left-most unset
      // ancestor key in the store.
      const ks = key.split('.');
      let i;
      for (i = ks.length - 1; i > 0; i -= 1) {
        if (
          this.getKeyValueFromStore(ks.slice(0, i).join('.'), store, true, null)
        ) {
          break;
        }
      }
      // If found, get the ancestor key's S value.
      if (ks.length === 1 || i !== ks.length - 1) {
        const ancestorKey = ks.slice(0, i + 1).join('.');
        const ancestorSVal = this.findDefaultValueInS(
          ancestorKey,
          store,
        ) as PrefObject;
        if (ancestorSVal === undefined) {
          throw new Error(
            `Pref ancestor has no default: key='${key}', store='${store}', ancestorKey='${ancestorKey}'`,
          );
        }
        // Override S values with default store values, if any
        const ancestorDefVal = mapp(ancestorSVal, (k: string) =>
          this.findDefaultValue([ancestorKey, k].join('.'), undefined, store),
        );
        if (
          !this.setPref(
            ancestorKey,
            'any',
            ancestorDefVal,
            store,
            callingWinID,
            true,
          )
        ) {
          throw new Error(
            `Failed setting ancestor default: key='${key}', store='${store}', ancestorKey='${ancestorKey}'`,
          );
        }
      }
    }
    if (storeValue === undefined) {
      storeValue = this.getKeyValueFromStore(key, store, true);
    }
    let value = storeValue;
    // Use the default if store value is undefined
    if (storeValue === undefined) value = defval;
    // If a valid default was used, write it to the store
    if (value !== undefined && value !== storeValue) {
      if (!this.setPref(key, type, value, store, callingWinID, true)) {
        throw new Error(
          `Failed to persist default value: key='${key}', store='${store}', value='${value?.toString()}'`,
        );
      }
    }
    if (value === undefined || !this.isType(type, value)) {
      // A program update may have caused a pref type change, so delete
      // the existing value and replace it with a default value.
      this.deleteUserPref(key, store);
      value = this.findDefaultValue(key, defval, store);
      if (!this.setPref(key, type, value, store, callingWinID, true)) {
        throw new Error(
          `Failed to reset to default value: key='${key}', store='${store}', value='${value?.toString()}'`,
        );
      }
    }

    return value;
  }

  // Get persistent data from storage json data. Note, only the Electron app
  // supports default stores.
  getStore(aStorex: string, useDefaultStore = false): PrefObject {
    // Create a new store if needed
    let aStore = aStorex;
    if (Build.isElectronApp && useDefaultStore) aStore = `${aStorex}_default`;
    if (this.stores === null || !(aStore in this.stores)) {
      if (this.storage) {
        this.stores = {
          ...this.stores,
          [aStore]: {
            store: this.storage(aStore),
            data: null,
          },
        };
      } else throw new Error('Prefs has not been initialized!');
    }

    const s = this.stores[aStore];

    // Read the data unless it has already been read
    const { store } = s;
    let { data } = s;
    if (!data) {
      if (store.exists()) {
        const readData = store.readFile();
        if (readData?.length) {
          const json = JSON_parse(readData.toString());
          if (json && typeof json === 'object') {
            data = json as PrefObject;
            s.data = data;
          }
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw Error(
            `Read of JSON Prefs store did not return a PrefObject (store='${aStore}', contents='${JSON_stringify(data)}').`,
          );
        }
      } else s.data = {};
    }

    return data ?? {};
  }

  // Return the key value of a given store. Note: useDefaultStore is only
  // supported within an Electron app and if set to true with a non-Electron
  // app, an error with be thrown. If getDefaultStore is null, only the
  // store will be searched, if it is false, the store will be searched
  // followed by the default store. If it is true, only the default store
  // will be searched or an error will be thrown if not an Electron app.
  getKeyValueFromStore(
    key: string,
    aStore: string,
    noErrorOnMissingKey: boolean,
    useDefaultStore = false as boolean | null,
  ): PrefValue {
    if (useDefaultStore && !Build.isElectronApp) {
      throw new Error(`Can only set useDefaultStore in Electron app.`);
    }
    const stobj = this.getStore(aStore, !!useDefaultStore);
    let keyExists = true;
    let keyvalue = stobj as PrefObject | PrefValue;
    key.split('.').forEach((d) => {
      if (
        !keyExists ||
        !keyvalue ||
        Array.isArray(keyvalue) ||
        typeof keyvalue !== 'object' ||
        !(d in keyvalue)
      ) {
        keyExists = false;
      } else {
        keyvalue = keyvalue[d] as PrefValue;
      }
    });
    if (!keyExists && Build.isElectronApp) {
      if (useDefaultStore === false) {
        return this.getKeyValueFromStore(
          key,
          aStore,
          noErrorOnMissingKey,
          true,
        );
      }
      if (noErrorOnMissingKey) return undefined;
      throw Error(`Missing Prefs key: '${key}' of '${aStore}' store`);
    }
    return clone(keyvalue);
  }

  // Write persistent data to source json files. If there is no data object
  // for the store, then there have been no set/gets on the store, and nothing
  // will be written. True is returned on success.
  writeStore(aStore: PrefStoreType = 'prefs') {
    if (!this.stores) {
      this.log?.warn(`Failed to write to non-existent store: '${aStore}.`);
      return false;
    }

    const s = this.stores[aStore];
    const { data } = s;
    if (!data || typeof data !== 'object') {
      this.log?.warn(
        `No data written to store: store='${aStore}', PrefValue='${data}'`,
      );
      return false;
    }

    // Prune unrecognized or outdated pref values
    const allStoreKeys = aStore in S ? Object.keys(S[aStore]) : [];
    Object.keys(data).forEach((k) => {
      if (!allStoreKeys.includes(k)) {
        if (s?.data && k in s.data) delete s.data[k];
        this.log?.info(
          `Deleting outdated user preference: key='${k}', store='${aStore}'`,
        );
      }
    });

    const json = JSON_stringify(s.data, 2);
    if (json) {
      s.store.writeFile(json);
      this.log?.verbose(`Persisted store: ${aStore}`);
    } else {
      this.log?.warn(
        `Failed to write to store: '${aStore}' PrefValue did not stringify.`,
      );
      return false;
    }

    return true;
  }

  writeAllStores(): void {
    if (!this.writeOnChange && this.stores !== null) {
      Object.keys(this.stores).forEach((store: PrefStoreType | string) => {
        if (!store.endsWith('_default')) {
          this.writeStore(store as PrefStoreType);
        }
      });
    }
  }

  // Write a key value pair to a store, and return true if succesfull. If the
  // value is undefined, the key will be removed from the store. If the value
  // does not match the given type, an error is thrown if type is not complex.
  // If this.writeOnChange is set, then the store will be saved to disk
  // immediately. If a change was made, any registered subscription callbacks
  // will be called after setting the new value unless skipCallbacks is set.
  setPref(
    key: string | null, // null only if type is merge and target is store
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any' | 'merge',
    value: PrefValue,
    storex: PrefStoreType | undefined,
    callingWinID: number,
    skipCallbacks?: boolean,
    clearRendererCaches?: boolean,
  ): boolean {
    if (key === null && type !== 'merge')
      throw new Error(`Pref key is null. Must use merge.`);
    // Get the store.
    const store = storex || 'prefs';
    let p = this.getStore(store);
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
        throw new Error(
          `Prefs merge failed because value is not a PrefObject (${store}.${key}='${JSON_stringify(value)}').`,
        );
      }
    } else if (!this.isType(type, value)) {
      const msg = `Prefs was given the wrong type: ${store}.${key}=${JSON_stringify(value)}, expected='${type}'`;
      if (type === 'complex') this.log?.warn(msg);
      else throw new Error(msg);
    }
    // Get (or create) the parent object of the key.
    let k = key;
    if (key !== null) {
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
                .join('.')}'`,
            );
          }
          p = pd;
        }
      });
    }
    // Check the current value and set to the new value only if needed.
    let valueChanged = true;
    if (k !== null && value === undefined) {
      if (k in p) delete p[k];
      else valueChanged = false;
    } else if (k !== null && diff(p[k], value) === undefined) {
      valueChanged = false;
    } else if (k === null || type === 'merge') {
      // already asserted the type <=> merge connection above
      const pp = k === null ? this.stores[store].data : p[k];
      if (typeof pp === 'object' && !Array.isArray(pp)) {
        valueobj = diff(pp, valueobj);
        if (valueobj !== undefined) {
          const merged = { ...pp, ...clone(valueobj) };
          if (k === null) this.stores[store].data = merged;
          else p[k] = merged;
        } else valueChanged = false;
      } else {
        throw new Error(
          `Prefs merge failed because the key does not contain a PrefObject (key-value='${pp?.toString()}', key='${key}', store='${store}').`,
        );
      }
    } else p[k] = clone(value);
    // If not writeOnChange, then data is persisted only when app is closed.
    let success = true;
    if (valueChanged && this.writeOnChange) success = this.writeStore(store);
    if (success) {
      // Reset renderer caches if requested. When pref values are being pushed
      // to renderer windows that are incompatible with currently cached data,
      // such as global.locale, caches must be cleared before prefs are updated!
      if (clearRendererCaches && this.browserWindow) {
        this.browserWindow.getAllWindows().forEach((w) => {
          this.log?.debug(
            `Prefs is clearing renderer caches: clearRendererCaches=true`,
          );
          w.webContents.send('cache-reset');
        });
      }
      // Call any registered callbacks if value was successfully changed.
      if (
        (skipCallbacks === undefined && valueChanged) ||
        skipCallbacks === false
      ) {
        let keys: string[] = [];
        if (key === null) {
          if (valueobj) keys = Object.keys(valueobj);
        } else keys = [key];
        keys.forEach((ks) => {
          const args: Parameters<PrefCallbackType> = [
            callingWinID,
            store,
            ks,
            value,
          ];
          Subscription.publish.prefsChanged(...args);
        });
      }
    }

    return success;
  }
}
