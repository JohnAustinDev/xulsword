import fs from 'fs';
import path from 'path';

const FPERM = 0o666;
// const DPERM = 0o666;

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
        `ERROR: initWithPath requires an absolute path: "${aPath}"`,
      );
    }
  }

  // Append a relative path string to the current path
  append(relPath: string) {
    this.path = path.normalize(path.join(this.path, relPath));
    return this;
  }

  // Copy this.path to a directory as leafName. If leafName is falsey, then
  // this.leafName will be used. If recursive is set, a directory's contents
  // will be copied. Destination file will be overwritten if it already exists.
  copyTo(dir: LocalFile, leafName?: string | null, recursive = false) {
    const name = leafName || this.leafName;

    const newFile = new LocalFile(
      path.join(dir.path, name),
      LocalFile.NO_CREATE,
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
        `ERROR: copyTo source and destination dir must exist: ${this.path} -> ${dir.path}`,
      );
    }

    // Return the new LocalFile
    if (!newFile.exists()) {
      throw Error(`ERROR: copyTo failed: ${newFile.path}`);
    }

    return newFile;
  }

  // Create a new directory or an empty file for this.path, depending on the
  // requested type. It does nothing if this.path already exists. The type
  // must be supplied or an error is thrown. If the file exists before return,
  // true is returned, false otherwise.
  create(
    type: number,
    options?: fs.MakeDirectoryOptions | fs.WriteFileOptions,
  ): boolean {
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
  createUnique(
    type: number,
    options?: fs.MakeDirectoryOptions | fs.WriteFileOptions,
  ) {
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
    return (stats && stats.isDirectory()) ?? false;
  }

  get directoryEntries(): string[] {
    if (!this.isDirectory()) {
      throw new Error(
        `LocalFile directoryEntries expected a directory: ${this.path}`,
      );
    }
    return fs.readdirSync(this.path, { encoding: 'utf-8' });
  }

  // This was not part of LocalFile, but added for convenience. Reads UTF-8
  // encoded file contents and returns as string.
  readFile(options?: Parameters<typeof fs.readFileSync>[1]): string {
    if (this.isDirectory()) {
      throw new Error(`LocalFile readFile expected a file: ${this.path}`);
    }
    let opts = options;
    if (opts && typeof opts === 'object' && !('encoding' in opts)) {
      opts.encoding = 'utf-8';
    }
    if (!opts) opts = { encoding: 'utf-8' };
    return fs.readFileSync(this.path, opts) as string;
  }

  // This was not part of LocalFile, but added for convenience.
  readBuf(options?: Parameters<typeof fs.readFileSync>[1]): Buffer {
    if (this.isDirectory()) {
      throw new Error(`LocalFile readBuf expected a file: ${this.path}`);
    }
    if (options && typeof options === 'string') options = undefined;
    if (options && typeof options === 'object' && 'encoding' in options) {
      options.encoding = null;
    }
    return fs.readFileSync(this.path, options) as Buffer;
  }

  remove(recursive = false) {
    fs.rmSync(this.path, { recursive });
  }

  stats(options?: Parameters<typeof fs.statSync>[1]) {
    if (!this.exists()) return null;
    return fs.statSync(this.path, options);
  }

  // This was not part of LocalFile, but added for convenience. Writes UTF-8
  // encoded string to file.
  writeFile(data: string | Buffer, options?: fs.WriteFileOptions) {
    if (this.isDirectory()) {
      throw new Error(`LocalFile writeFile expected a file: ${this.path}`);
    }
    const o = options || { mode: FPERM };
    if (typeof o !== 'string' && typeof data === 'string' && !o.encoding) {
      o.encoding = 'utf8';
    }
    fs.writeFileSync(this.path, data as any, o);
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
