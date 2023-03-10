/* eslint-disable @typescript-eslint/no-explicit-any */

// Store anything transferable for sharing between any processes.
// NOTE: Don't use this in renderer processes unless data needs
// to be shared between processes, otherwise it is better to use
// the Cache module, which never uses IPC.
const Data = {
  datastore: {} as { [i: string]: any },

  has(name: string): boolean {
    return name in this.datastore;
  },

  // Argument order matches Cache, which may take multiple name args
  write(data: any, name: string): void {
    this.datastore[name] = data;
  },

  read(name: string): any {
    return name && name in this.datastore ? this.datastore[name] : null;
  },

  delete(name: string): void {
    delete this.datastore[name];
  },

  readAndDelete(name: string): any {
    const r = this.datastore[name];
    delete this.datastore[name];
    return r;
  },
};

export type DataType = Omit<typeof Data, 'datastore'>;

export default Data as DataType;
