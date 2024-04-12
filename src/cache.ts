
// Cache any data according to string keys. Calling noclear on a key will prevent it
// from being cleared when Cache.clear() is called, but it may always be cleared if
// cleared explicitly, ie. Cache.clear(name).
const Cache = {
  storage: {} as { [i: string]: any },

  noclears: [] as string[],

  has(...args: string[]) {
    return args.join('+') in this.storage;
  },

  read(...args: string[]) {
    return this.storage[args.join('+')];
  },

  write(value: any, ...cacheName: string[]) {
    const name = cacheName.join('+');
    if (name in this.storage) throw Error(`Cache already exists: '${name}'`);
    this.storage[name] = value;
  },

  noclear(...args: string[]) {
    const name = args.length ? args.join('+') : '';
    if (name) {
      this.noclears.push(name);
    }
  },

  // If args is undefined, all caches will be cleared except those marked as 'noclear'.
  // If args is provided, all caches matching the same arguments will be cleared
  // (including those set with 'noclear'). So if a cache is ['foo', 'bar'] then
  // clear('foo') will clear that as well as any other cache whose first argument is 'foo'.
  clear(...args: string[]) {
    const name = args.length ? args.join('+') : '';
    if (!args.length) {
      Object.keys(this.storage).forEach((k) => {
        if (!this.noclears.includes(k)) delete this.storage[k];
      });
    } else if (name in this.storage) {
      delete this.storage[name];
    } else {
      Object.keys(this.storage).forEach((k) => {
        if (k.startsWith(`${name}+`)) delete this.storage[k];
      });
    }
  },
};

export default Cache as Omit<typeof Cache, 'storage' | 'noclears'>;
