/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataPublic } from '../../type';

// Store temporary renderer data for use in the main process, and vice versa.
const Data: typeof DataPublic & { datastore: any } = {
  datastore: undefined,

  write(data: any) {
    this.datastore = data;
  },

  get data() {
    return this.datastore || {};
  },

  read() {
    return this.data;
  },

  readOnce() {
    const r = this.data;
    this.datastore = undefined;
    return r;
  },
};

export default Data;