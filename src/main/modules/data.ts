/* eslint-disable @typescript-eslint/no-explicit-any */
import { GType } from '../../type';

// Store temporary renderer data for use in the main process, and vice
// versa. NOTE: Unless data needs to be shared between processes, it
// is better to use the faster Cache module.
const Data: GType['Data'] & { datastore: { [i: string]: any } } = {
  datastore: {},

  write(name: string, data: any) {
    this.datastore[name] = data;
  },

  read(name: string) {
    return this.datastore[name];
  },

  readAndDelete(name: string) {
    const r = this.datastore[name];
    delete this.datastore[name];
    return r;
  },
};

export default Data;
