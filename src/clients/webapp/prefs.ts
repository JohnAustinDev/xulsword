import Rprefs, { type PrefsGType } from '../../prefs.ts';
import log from '../log.ts';

let UsingStorage: 'none' | 'localStorage' | 'sessionStorage';
function storageAvailable(type: 'localStorage' | 'sessionStorage') {
  let storage;
  try {
    storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    if (
      e instanceof DOMException &&
      e.name === 'QuotaExceededError' &&
      // acknowledge QuotaExceededError only if there's something already stored
      storage &&
      storage.length !== 0
    ) {
      storage.clear();
      return true;
    }
    return false;
  }
}

function storageType(): 'none' | 'localStorage' | 'sessionStorage' {
  if (UsingStorage) return UsingStorage;
  let storage: 'none' | 'localStorage' | 'sessionStorage';
  if (storageAvailable('localStorage')) storage = 'localStorage';
  else if (storageAvailable('sessionStorage')) storage = 'sessionStorage';
  else storage = 'none';
  UsingStorage = storage;
  log[UsingStorage === 'none' ? 'error' : 'debug'](
    `Using storage type ${UsingStorage}.`,
  );
  return UsingStorage;
}

function setStorage(cname: string, cvalue: string): boolean {
  const storagetype = storageType();
  if (storagetype !== 'none') {
    try {
      window[storagetype].setItem(cname, cvalue);
    } catch (er) {
      log.error(`Storage ${storageType} write failed: ${er}`);
      return false;
    }
    return true;
  }
  return false;
}

// Return null if the storage does not exist, or if no storage is available.
function getStorage(cname: string): string | null {
  const storagetype = storageType();
  let result: string | null = null;
  if (storagetype !== 'none') {
    try {
      result = window[storagetype].getItem(cname);
    } catch (er) {
      log.error(`Storage ${storageType} read failed: ${er}`);
      result = null;
    }
  }
  return result;
}

function getStore(aStore: string) {
  return {
    exists: () => {
      return getStorage(aStore) !== null;
    },
    readFile: () => {
      return getStorage(aStore) || '';
    },
    writeFile: (data: string) => {
      setStorage(aStore, data);
    },
    supported: () => {
      return localStorageType() !== 'none';
    },
  };
}

export function localStorageType(): 'none' | 'localStorage' | 'sessionStorage' {
  return Build.isDevelopment ? 'none' : storageType();
}

const Prefs = new Rprefs(
  { type: localStorageType(), getStore, id: '' },
  log,
  true,
);

export default Prefs as PrefsGType;
