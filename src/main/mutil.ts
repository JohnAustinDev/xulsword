/* eslint-disable new-cap */
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import C from 'constant';
import nsILocalFile from './components/nsILocalFile';

// creates only allowable file types
export function createSafeFile(
  nsIFile: nsILocalFile,
  perm: number,
  createUnique = false
) {
  if (!nsIFile) return false;

  // only create a file if it has one of these file extensions
  if (!/\.(txt|xsb|rdf|conf|xpi)$/i.test(nsIFile.leafName)) {
    return false;
  }

  if (createUnique) nsIFile.createUnique(nsILocalFile.NORMAL_FILE_TYPE, perm);
  else nsIFile.create(nsILocalFile.NORMAL_FILE_TYPE, perm);

  return true;
}

// writes to only allowable file types
export function writeSafeFile(
  nsIFile: nsILocalFile,
  str: string,
  overwrite: boolean,
  toEncoding = 'utf8'
) {
  if (!nsIFile) return false;

  // only write to a file if it has one of these file extensions
  if (!/\.(txt|xsb|rdf|conf)$/i.test(nsIFile.leafName)) {
    return false;
  }

  if (nsIFile.exists()) {
    if (!overwrite) return false;
    nsIFile.remove(true);
  }
  createSafeFile(nsIFile, C.FPERM);

  nsIFile.writeFile(str, { encoding: toEncoding, mode: C.FPERM });

  return true;
}

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}
