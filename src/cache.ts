/* eslint-disable @typescript-eslint/no-explicit-any */

// Cache data with a string key
const Cache = {
  storage: {} as { [i: string]: any },

  has(name: string) {
    return name in this.storage;
  },

  read(name: string) {
    return this.storage[name];
  },

  write(name: string, value: any) {
    if (name in this.storage) throw Error(`Cache already exists: '${name}'`);
    this.storage[name] = value;
  },

  clear(name?: string) {
    if (!name) this.storage = {};
    else if (name in this.storage) {
      delete this.storage[name];
    }
  },
};

export default Cache;
