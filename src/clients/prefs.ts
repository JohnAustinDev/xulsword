import Rprefs, { type PrefsGType } from '../prefs.ts';
import log from './log.ts';

function setCookie(cname: string, cvalue: string, exdays: number) {
  const d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  const expires = 'expires=' + d.toUTCString();
  document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
}

function getCookie(cname: string): string | null {
  const name = cname + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

const cookieStorage = (aStore: string) => {
  return {
    exists: () => {
      return getCookie(aStore) !== null;
    },
    readFile: () => {
      return getCookie(aStore) || '';
    },
    writeFile: (data: string) => {
      setCookie(aStore, data, 30);
    },
  };
};

const Prefs = new Rprefs(cookieStorage, log);

export default Prefs as PrefsGType;
