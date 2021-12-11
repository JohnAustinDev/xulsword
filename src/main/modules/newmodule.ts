import { escapeRE } from 'common';
import nsILocalFile from '../components/nsILocalFile';

export function readParamFromConf(nsIFileConf: nsILocalFile, param: string) {
  if (!nsIFileConf) return null;
  if (nsIFileConf.leafName.search(/\.conf$/i) === -1) return null;

  const filedata = nsIFileConf.readFile();

  let retval;
  if (param === 'ModuleName') {
    const prm = new RegExp('^\\s*\\[(.*)\\]', 'm');
    retval = filedata.match(prm);
    if (retval) [, retval] = retval;
  } else {
    const prm = new RegExp(
      `^\\s*${escapeRE(param)}\\s*=\\s*(.*?)\\s*?[\\r\\n]`,
      'im'
    );
    retval = filedata.match(prm);
    if (retval) [, retval] = retval;
  }
  return retval;
}

export const tmp = 'foo';
