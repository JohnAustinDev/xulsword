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

  error = '';

  // Optionally create an empty directory or file
  constructor(aPath: string, createType?: number) {
    if (aPath) {
      if (!this.initWithPath(aPath, createType)) throw new Error(this.error);
    }
  }

  // Set the absolute path of the LocalFile
  initWithPath(aPath: string, createType?: number): boolean {
    if (path.isAbsolute(aPath)) {
      this.path = aPath;
      if (createType) {
        if (!this.create(createType)) return false;
      }
    } else {
      throw new Error(`initWithPath requires an absolute path: "${aPath}"`);
    }

    return true;
  }

  // Append a relative path string to the current path
  append(relPath: string) {
    this.path = path.normalize(path.join(this.path, relPath));
    return this;
  }

  // Copy this.path to a directory as leafName. If leafName is falsey, then
  // this.leafName will be used. If recursive is set, a directory's contents
  // will be copied. Destination file will be overwritten if it already exists.
  copyTo(dir: LocalFile, leafName?: string | null, recursive = false): boolean {
    this.error = '';
    const name = leafName || this.leafName;

    const newFile = new LocalFile(
      path.join(dir.path, name),
      LocalFile.NO_CREATE,
    );

    if (this.exists()) {
      if (dir.exists()) {
        if (this.isDirectory()) {
          if (newFile.create(LocalFile.DIRECTORY_TYPE)) {
            if (recursive) {
              this.directoryEntries.forEach((d) => {
                const f = this.clone().append(d);
                // continue on error...
                f.copyTo(newFile, null, true);
              });
            }
          } else this.error = `Failed creating dir: ${newFile.path}`;
        } else {
          fs.copyFileSync(this.path, newFile.path);
        }
      } else {
        this.error = `Destination dir must exist: ${this.path} -> ${dir.path}`;
        return false;
      }
    } else {
      this.error = `Source must exist: ${this.path} -> ${dir.path}`;
      return false;
    }

    // Return the new LocalFile
    if (!newFile.exists()) {
      this.error = `Failed to create: ${newFile.path}`;
    }

    return !this.error;
  }

  // Create a new directory or an empty file for this.path, depending on the
  // requested type. It does nothing if this.path already exists. The type
  // must be supplied or an error is thrown. If the file exists before return,
  // true is returned, false otherwise.
  create(
    type: number,
    options?: fs.MakeDirectoryOptions | fs.WriteFileOptions,
  ): boolean {
    this.error = '';
    if (this.path) {
      if (!this.exists()) {
        if (type === LocalFile.DIRECTORY_TYPE) {
          fs.mkdirSync(this.path, options);
        } else if (type === LocalFile.NORMAL_FILE_TYPE) {
          fs.writeFileSync(this.path, '');
        } else {
          throw new Error(`Unsupported file type ${type}`);
        }
      }
    } else {
      throw new Error(`Cannot create before initWithPath`);
    }
    if (!this.exists()) this.error = `File was not created: ${this.path}.`;
    return !this.error;
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
    this.error = '';
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
        // continue on error...
        this.create(type, options);
        return fs.existsSync(p);
      }
      return false;
    }
    throw new Error(`Cannot createUnique before initWithPath`);
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

  rename(newName: string) {
    const newpath = path.join(path.dirname(this.path), newName);
    fs.renameSync(this.path, newpath);
    this.path = newpath;
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
    return true;
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
