/* eslint-disable @typescript-eslint/no-explicit-any */
import { GType } from '../../type';

// Store anything transferable for sharing between any processes.
// NOTE: Don't use this in renderer processes unless data needs
// to be shared between processes, otherwise it is better to use
// the Cache module, which never uses IPC.
const Data: GType['Data'] & { datastore: { [i: string]: any } } = {
  datastore: {},

  has(name: string) {
    return name in this.datastore;
  },

  // Argument order matches Cache, which may take multiple name args
  write(data: any, name: string) {
    this.datastore[name] = data;
  },

  read(name: string) {
    return name && name in this.datastore ? this.datastore[name] : null;
  },

  readAndDelete(name: string) {
    const r = this.datastore[name];
    delete this.datastore[name];
    return r;
  },
};

export default Data;
