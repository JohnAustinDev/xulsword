/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';

const FPERM = 0o666;
const DPERM = 0o666;

export default class LocalFile {
  // The file system location for this LocalFile instance.
  path = '';

  static NO_CREATE = 0;

  static DIRECTORY_TYPE = 1;

  static NORMAL_FILE_TYPE = 2;

  // Optionally create an empty directory or file
  constructor(aPath: string, createType?: number) {
    if (aPath) {
      this.initWithPath(aPath, createType);
    }
  }

  // Set the absolute path of the LocalFile
  initWithPath(aPath: string, createType?: number) {
    if (path.isAbsolute(aPath)) {
      this.path = aPath;
      if (createType) {
        this.create(createType);
      }
    } else {
      throw new Error(
        `ERROR: initWithPath requires an absolute path: "${aPath}"`
      );
    }
  }

  // Append a relative path string to the current path
  append(relPath: string) {
    this.path = path.join(this.path, relPath);
    return this;
  }

  // Copy this.path to a directory as leafName. If leafName is falsey, then
  // this.leafName will be used. If recursive is set, a directory's contents
  // will be copied. Destination file will be overwritten if it already exists.
  copyTo(dir: LocalFile, leafName?: string | null, recursive = false) {
    const name = leafName || this.leafName;

    const newFile = new LocalFile(
      path.join(dir.path, name),
      LocalFile.NO_CREATE
    );

    if (this.exists() && dir.exists()) {
      if (this.isDirectory()) {
        newFile.create(LocalFile.DIRECTORY_TYPE);
        if (recursive) {
          this.directoryEntries.forEach((d) => {
            const f = this.clone().append(d);
            f.copyTo(newFile, null, true);
          });
        }
      } else {
        fs.copyFileSync(this.path, newFile.path);
      }
    } else {
      throw new Error(
        `ERROR: copyTo source and destination dir must exist: ${this.path} -> ${dir.path}`
      );
    }

    // Return the new LocalFile
    if (!newFile.exists()) {
      throw Error(`ERROR: copyTo failed: ${newFile.path}`);
    }

    return newFile;
  }

  // Create a new directory or en empty file for this.path, depending on the
  // requested type. It does nothing if this.path already exists. The type
  // must be supplied or an error is thrown. If the file is created, true is
  // returned, false otherwise.
  create(type: number, options?: any): boolean {
    if (this.path) {
      if (!this.exists()) {
        if (type === LocalFile.DIRECTORY_TYPE) {
          fs.mkdirSync(this.path, options);
        } else if (type === LocalFile.NORMAL_FILE_TYPE) {
          fs.writeFileSync(this.path, '');
        } else {
          throw Error(`Unsupported file type ${type}`);
        }
      }
    } else {
      throw Error(`Cannot create before initWithPath`);
    }
    return this.exists();
  }

  clone(): LocalFile {
    return new LocalFile(this.path);
  }

  // Creates a file. If it already exists, another name is tried (up to
  // max files) so as to create a unique file name. True is returned if
  // sucessful, false otherwise.
  createUnique(type: number, options?: any) {
    if (this.path) {
      const max = 999;
      let n = 0;
      let p;
      do {
        p = this.path;
        if (n) p.replace(/([^.]*)$/, 'n.$1');
        if (!fs.existsSync(this.path)) break;
        n += 1;
      } while (n <= max);
      if (!fs.existsSync(p)) {
        this.path = p;
        this.create(type, options);
        return fs.existsSync(p);
      }
      return false;
    }
    throw Error(`Cannot createUnique before initWithPath`);
  }

  // Return boolean value of true if this file or directory exists.
  exists() {
    return fs.existsSync(this.path);
  }

  isDirectory(): boolean {
    const stats = this.stats();
    return stats.isDirectory();
  }

  get directoryEntries(): string[] {
    if (!this.isDirectory()) {
      return [];
    }
    return fs.readdirSync(this.path, { encoding: 'utf-8' });
  }

  // This was not part of LocalFile, but added for convenience. Reads UTF-8
  // encoded file contents and returns as string.
  readFile(options?: any): string {
    const ops = options || {};
    ops.encoding = 'utf-8';
    return fs.readFileSync(this.path, ops) as unknown as string;
  }

  // This was not part of LocalFile, but added for convenience.
  readBuf(options?: any): Buffer {
    const ops = options || {};
    ops.encoding = null;
    return fs.readFileSync(this.path, ops);
  }

  remove(recursive = false) {
    fs.rmSync(this.path, { recursive });
  }

  stats(options?: any): fs.Stats {
    return fs.statSync(this.path, options);
  }

  // This was not part of LocalFile, but added for convenience. Writes UTF-8
  // encoded string to file.
  writeFile(data: string | Buffer, options?: any) {
    const o = options || { mode: FPERM };
    if (typeof data === 'string' && !o.encoding) {
      o.encoding = 'utf8';
    }
    fs.writeFileSync(this.path, data, o);
  }

  // Return the file name as a string.
  get leafName() {
    return path.basename(this.path);
  }

  // Return the parent directory as a LocalFile.
  get parent() {
    return new LocalFile(path.dirname(this.path), LocalFile.NO_CREATE);
  }
}

// creates only allowable file types
export function createSafeFile(
  nsIFile: LocalFile,
  perm: number,
  createUnique = false
) {
  if (!nsIFile) return false;

  // only create a file if it has one of these file extensions
  if (!/\.(txt|xsb|rdf|conf|xpi)$/i.test(nsIFile.leafName)) {
    return false;
  }

  if (createUnique) nsIFile.createUnique(LocalFile.NORMAL_FILE_TYPE, perm);
  else nsIFile.create(LocalFile.NORMAL_FILE_TYPE, perm);

  return true;
}

// writes to only allowable file types
export function writeSafeFile(
  nsIFile: LocalFile,
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
  createSafeFile(nsIFile, FPERM);

  nsIFile.writeFile(str, { encoding: toEncoding, mode: FPERM });

  return true;
}

export function inlineFile(
  fpath: string,
  encoding = 'base64' as BufferEncoding
): string {
  const file = new LocalFile(fpath);
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    ttf: 'font/ttf',
    otf: 'font/otf',
    css: 'text/css',
  } as any;
  const contentType =
    // eslint-disable-next-line no-useless-escape
    mimeTypes[fpath.replace(/^.*\.([^\.]+)$/, '$1').toLowerCase()];
  if (!file.exists() || !contentType) return '';
  const rawbuf = file.readBuf();
  return `data:${contentType};${encoding},${rawbuf.toString(encoding)}`;
}
