/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import C from '../../constant';

export default class nsILocalFile {
  // The file system location for this nsILocalFile instance.
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

  // Set the absolute path of the nsILocalFile
  initWithPath(aPath: string, createType?: number) {
    if (path.isAbsolute(aPath)) {
      this.path = aPath;
      if (createType) {
        this.create(createType);
      }
    } else {
      throw new Error(
        `ERROR: initWithPath requires an absolute path: ${aPath}`
      );
    }
  }

  // Append a relative path string to the current path
  append(relPath: string) {
    this.path = path.join(this.path, relPath);
    return this;
  }

  // Copy this.path to a directory as leafName. If leafName is null, then
  // this.leafName will be used. Destination file will be overwritten if it
  // already exists.
  copyTo(dirObj: nsILocalFile, leafName: string) {
    const name = leafName || this.leafName;

    const newFile = new nsILocalFile(
      path.join(dirObj.path, name),
      nsILocalFile.NO_CREATE
    );

    if (this.exists() && dirObj.exists()) {
      fs.copyFileSync(this.path, newFile.path);
    } else {
      throw new Error(
        `ERROR: copyTo source and destination dir must exist: ${this.path} -> ${dirObj.path}`
      );
    }

    // Return the new nsILocalFile
    if (!newFile.exists()) {
      throw Error(`ERROR: copyTo failed: ${newFile.path}`);
    }

    return newFile;
  }

  // Create a new directory or en empty file for this.path, depending on the
  // requested type. It does nothing if this.path already exists. The type
  // must be supplied or an error is thrown.
  create(type: number, permissions?: number) {
    if (this.path) {
      if (!this.exists()) {
        if (type === nsILocalFile.DIRECTORY_TYPE) {
          fs.mkdirSync(this.path);
        } else if (type === nsILocalFile.NORMAL_FILE_TYPE) {
          fs.writeFileSync(this.path, '');
        } else {
          throw Error(`Unsupported file type ${type}`);
        }
      }
    } else {
      throw Error(`Cannot create before initWithPath`);
    }

    if (!this.exists()) {
      throw Error(`Failed to create ${this.path}`);
    }
  }

  // Creates a file. If it already exists, another name is tried (up to
  // max files) so as to create a unique file name. True is returned if
  // sucessful, false otherwise.
  createUnique(type: number, permissions: number) {
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
        this.create(type, permissions);
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

  get directoryEntries(): string[] | null {
    if (!this.isDirectory()) {
      return null;
    }
    return fs.readdirSync(this.path, { encoding: 'utf-8' });
  }

  // This was not part of nsILocalFile, but added for convenience. Reads UTF-8
  // encoded file contents and returns as string.
  readFile(): string {
    return fs.readFileSync(this.path, { encoding: 'utf-8' });
  }

  remove(recursive = false) {
    fs.rmSync(this.path, { recursive });
  }

  stats(options?: any): fs.Stats {
    return fs.statSync(this.path, options);
  }

  // This was not part of nsILocalFIle, but added for convenience. Writes UTF-8
  // encoded string to file.
  writeFile(str: string, options?: any) {
    const o = options || { encoding: 'utf8', mode: C.FPERM };
    fs.writeFile(this.path, str, o);
  }

  // Return the file name as a string.
  get leafName() {
    return path.basename(this.path);
  }

  // Return the parent directory as an nsILocalFile.
  get parent() {
    return new nsILocalFile(path.dirname(this.path), nsILocalFile.NO_CREATE);
  }
}
