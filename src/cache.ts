/* eslint-disable @typescript-eslint/no-explicit-any */

// Cache any data according to string keys.
const Cache = {
  storage: {} as { [i: string]: any },

  has(...args: string[]) {
    return args.join('+') in this.storage;
  },

  read(...args: string[]) {
    return this.storage[args.join('+')];
  },

  write(value: any, ...args: string[]) {
    const name = args.join('+');
    if (name in this.storage) throw Error(`Cache already exists: '${name}'`);
    this.storage[name] = value;
  },

  clear(...args: string[]) {
    const name = args.length ? args.join('+') : '';
    if (!name) this.storage = {};
    else if (name in this.storage) {
      delete this.storage[name];
    }
  },
};

export default Cache;