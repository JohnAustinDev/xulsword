import { session } from 'electron';
import fpath from 'path';
import log from 'electron-log';
import FTP from 'ftp';
import GUNZIP from 'gunzip-maybe';
import TAR from 'tar-stream';
import { Readable } from 'stream';
import {
  keyToDownload,
  randomID,
  normalizeDownloadURL,
  unknown2String,
} from '../common.ts';
import C from '../constant.ts';
import LocalFile from './components/localFile.ts';

import type { ListingElement } from 'ftp';
import type { Stream } from 'stream';
import type { HTTPDownload } from '../type.ts';

export type ListingElementR = ListingElement & { subdir: string };

const OperationTimeoutFTP = 5000;

let MaxDomainConnections: Record<string, number> = {};

const FtpCancelable: Record<
  string,
  {
    cause: 'canceled' | Error | null;
    // callbacks is array of [ operation-id, callback[] ]
    callbacks: Array<[string, Array<() => void>]>;
  }
> = {};

const HttpCancelable: Record<
  string,
  { canceled: boolean; callback: () => void }
> = {};

export function logid(
  downloadkey: string,
  id?: string | null,
  printCancelInfo?: boolean,
): string {
  const dl = keyToDownload(downloadkey);
  const { type } = dl;
  let did = dl.domain;
  if (type === 'ftp') did = dl.file;
  else if (type === 'module') did = dl.module;
  else if (type === 'http') did = dl.http;
  let cbi = '';
  if (printCancelInfo) {
    if (downloadkey in FtpCancelable) {
      const { callbacks, cause } = FtpCancelable[downloadkey];
      const s0: string[] = [];
      callbacks.forEach((x) => {
        s0.push(`${x[1].length}`);
      });
      const causestr = cause ? cause.toString() : 'null';
      cbi = `cause=${causestr} cb='${s0.join(' ')}'`;
    } else if (downloadkey in HttpCancelable) {
      const { canceled, callback } = HttpCancelable[downloadkey];
      cbi = `canceled=${canceled} cb=${Boolean(callback)}`;
    }
  }
  return [did, id, cbi].filter(Boolean).join(' ');
}

// Before starting the operation represented by cancelkey, this function
// must be run to initialize cancelability and check that a previous
// operation with the same cancelkey is not still being canceled. If non-
// zero is returned from this call, then there are still registered cancel
// functions from a previous operation with the cancelkey.
export function ftpCancelableInit(cancelkey: string): number {
  if (cancelkey in FtpCancelable) {
    if (FtpCancelable[cancelkey].callbacks.length) {
      log.error(
        `Init failed, previous is incomplete: ${logid(cancelkey, null, true)}`,
      );
      return FtpCancelable[cancelkey].callbacks.length;
    }
  }
  log.debug(`Init: ${logid(cancelkey)}`);
  FtpCancelable[cancelkey] = { callbacks: [], cause: null };
  return 0;
}

// id = ftpCancelable(key) - Throws if the key has been canceled, or returns
// a unique id to be associated with an operation.
export function ftpCancelable(key: string) {
  if (!key) return '';

  const { cause } = (key in FtpCancelable && FtpCancelable[key]) || {};
  if (
    cause && // null cause means not canceled
    key &&
    key in FtpCancelable
  ) {
    // Run downloadCancel in case new cancel functions were added
    // since the last ftpCancel call.
    downloadCancel(key, cause);
    if (typeof cause === 'string') throw new Error(cause);
    if (cause) throw cause;
  }

  // Return a unique operation id
  return randomID();
}

// ftpCancelableOperation(key, id, func) - Register arbitrary cancelation functions
// for the operation, which will be called only if the key associated with the
// operation id is canceled.
//
// ftpCancelableOperation(key, id) - Once the operation for which the id was created
// has finished without error, call this to remove all registered cancel functions
// for that id.
export function ftpCancelableOperation(
  key: string,
  id: string,
  func?: () => void,
) {
  // Remove cancel functions for an operation id
  if (!func) {
    if (key in FtpCancelable) {
      const j = FtpCancelable[key].callbacks.findIndex((x) => x[0] === id);
      if (j !== -1) {
        FtpCancelable[key].callbacks.splice(j, 1);
      }
    }
    return id;
  }

  // Add another cancel function for an operation id
  if (!(key in FtpCancelable)) {
    throw new Error(`FtpCancelable key was not initialized: ${key}`);
  }
  let j = FtpCancelable[key].callbacks.findIndex((x) => x[0] === id);
  if (j === -1) {
    FtpCancelable[key].callbacks.push([id, []]);
    j = FtpCancelable[key].callbacks.length - 1;
  }
  FtpCancelable[key].callbacks[j][1].push(func);
  return id;
}

export function downloadCancel(
  cancelKey: string | string[],
  cause?: 'canceled' | Error,
): number {
  let cnt = 0;
  cnt += httpCancel(cancelKey);
  cnt += ftpCancel(cancelKey, cause);
  return cnt;
}

// Issue a cancellation for all operations assocaited with the cancelkey.
// This function may be run multiple times during cancelation, but only
// the cause given for the first call will be reported. The default cause
// is 'canceled' by user, but stream errors etc. can also initiate a
// cancellation, and then such an error should be passed as the cause.
export function ftpCancel(
  cancelkey: string | string[],
  cause?: 'canceled' | Error,
): number {
  let n = 0;
  const keys = Array.isArray(cancelkey) ? cancelkey : [cancelkey];
  // Add cancel cause to each before running any callbacks, because cause
  // signals that the key has been canceled.
  keys.forEach((k) => {
    if (!FtpCancelable[k].cause) {
      FtpCancelable[k].cause = cause || 'canceled';
      n += 1;
    }
  });
  keys.forEach((k) => {
    if (FtpCancelable[k].callbacks.length) {
      log.debug(`FTP canceled FTP=${logid(k, null, true)}`);
    }
    FtpCancelable[k].callbacks.reverse().forEach((x) => {
      x[1].reverse().forEach((f) => {
        try {
          f();
        } catch (er) {
          // ignore
        }
        n += 1;
      });
    });
    FtpCancelable[k].callbacks = [];
  });
  return n;
}

// The cancelkey for XSM audio modules need not be exactly the downloadkey,
// but rather having an http URL without a specific bk, ch or vs. In this case
// keys are truncated and multiple downloads may be canceled by the one cancelkey.
// HttpCancelable should be regsitered and unregistered directly by each a cancelable
// downloading function.
export function httpCancel(cancelkey?: string | string[]): number {
  let canceled = 0;
  const callCallback = (value: (typeof HttpCancelable)[string]) => {
    canceled += 1;
    value.canceled = true;
    value.callback();
  };
  if (!cancelkey) {
    Object.entries(HttpCancelable).forEach((entry) => {
      log.debug(`HTTP canceled '${entry[0]}'`);
      callCallback(entry[1]);
    });
    return canceled;
  }
  const keys = Array.isArray(cancelkey) ? cancelkey : [cancelkey];
  keys.forEach((k) => {
    const cancelkeydl = normalizeDownloadURL(keyToDownload(k));
    if ('http' in cancelkeydl) {
      Object.entries(HttpCancelable).forEach((entry) => {
        const keyobj = normalizeDownloadURL(
          keyToDownload(entry[0]),
        ) as HTTPDownload;
        if (cancelkeydl.http === keyobj.http) {
          log.debug(`Canceled HTTP '${keyobj.http}'`);
          callCallback(entry[1]);
        }
      });
    }
  });
  return canceled;
}

// When some async error throws, it usually causes all operations associated with
// the cancelkey to be canceled, throwing other cancelation errors which may
// arrive first. In this case, failCause reports the root error.
export function failCause(cancelkey: string, er?: Error | string): string {
  let ret: Error | string = er || 'unknown';
  if (cancelkey && cancelkey in FtpCancelable) {
    const { cause } = FtpCancelable[cancelkey];
    if (cause) ret = cause;
    if (ret === 'canceled') {
      ret = C.UI.Manager.cancelMsg;
    }
  }
  const str = typeof ret === 'string' ? ret : ret.message;
  const { domain } = keyToDownload(cancelkey);
  const cause = `(${domain} ${logid(cancelkey)}) ${str}`;
  log.debug(cause);
  if (str === C.UI.Manager.cancelMsg) return C.UI.Manager.cancelMsg;
  return cause;
}

// Close and free FTP connections to a particular domain, or all domains. Also
// reset MaxDomainConnections.
export function destroyFTPconnections(domain?: string | null) {
  if (domain) {
    if (domain in activeConnections) {
      Object.keys(FtpCancelable).forEach((key) => {
        const { domain: d } = keyToDownload(key);
        if (domain === d) downloadCancel(key);
      });
      activeConnections[domain].forEach((c) => {
        abortP(c)
          .then(() => {
            c.destroy();
          })
          .catch((er) => {
            log.debug(er);
          });
      });
      activeConnections[domain] = [];
      waitingConnections[domain].forEach((c) => {
        abortP(c)
          .then(() => {
            c.destroy();
          })
          .catch((er) => {
            log.debug(er);
          });
      });
      waitingConnections[domain] = [];
    }
  } else {
    Object.keys(activeConnections).forEach((d) => {
      destroyFTPconnections(d);
    });
  }
  MaxDomainConnections = {};
}

// Move a connection from active to waiting.
function freeConnection(c: FTP, domain: string) {
  waitingConnections[domain].push(c);
  const i = activeConnections[domain]?.indexOf(c);
  if (i !== undefined && i !== -1) {
    activeConnections[domain].splice(i, 1);
    log.debug(
      `Freed 1 connection to ${domain}; ${activeConnections[domain].length} still active.`,
    );
  }
}

// Remove a connection from active and waiting.
function forgetConnection(c: FTP, domain: string) {
  const i0 = waitingConnections[domain]?.indexOf(c);
  if (i0 !== undefined && i0 !== -1) {
    waitingConnections[domain].splice(i0, 1);
  }
  const i1 = activeConnections[domain]?.indexOf(c);
  if (i1 !== undefined && i1 !== -1) {
    activeConnections[domain].splice(i1, 1);
  }
}

// Create a new authenticated FTP connection to a domain, or return
// 'too-many-connections' if a new connection to the domain cannot
// be made. The returned connection is ready to issue FTP commands.
// NOTE: Any connection operation must be aborted before the connection
// is destroyed, or else 'Failure writing network stream' unhandled
// errors will result.
async function createActiveConnection(
  domain: string,
  cancelkey: string,
): Promise<FTP | 'too-many-connections'> {
  return await new Promise((resolve, reject) => {
    let c: FTP | undefined;
    let id: string;
    try {
      const max = MaxDomainConnections[domain] || C.FTPMaxConnections;
      if (
        activeConnections[domain].length + waitingConnections[domain].length <
          max &&
        Object.values(activeConnections)
          .concat(Object.values(waitingConnections))
          .flat().length < max
      ) {
        id = ftpCancelable(cancelkey);
        log.debug(`Connecting: ${domain}`);
        c = new FTP();
        activeConnections[domain].push(c);
        c.connect({
          host: domain,
          user: 'anonymous',
          password: C.FTPPassword,
          connTimeout: C.FTPConnectTimeout,
        });
        ftpCancelableOperation(cancelkey, id, () => {
          if (c) {
            abortP(c)
              .then(() => c?.destroy())
              .catch((er) => {
                log.debug(er);
              });
            forgetConnection(c, domain);
            reject(C.UI.Manager.cancelMsg);
          }
        });
      } else resolve('too-many-connections');
    } catch (er: unknown) {
      reject(er);
    }

    if (c) {
      const cc = c;
      cc.on('error', (er: Error) => {
        log.debug(`ftp connect on-error ${domain}: '${er.toString()}'.`);
        abortP(cc)
          .then(() => {
            cc.destroy();
          })
          .catch((err) => {
            log.debug(err);
          });
        if (er.message.includes('too many connections')) {
          MaxDomainConnections[domain] = activeConnections[domain].length;
          resolve('too-many-connections');
        } else {
          reject(er);
        }
      });
      cc.on('close', (er: boolean) => {
        log.silly(`ftp connect on-close ${domain} ${er}'.`);
        forgetConnection(cc, domain);
      });
      cc.on('end', () => {
        log.silly(`ftp connect on-end ${domain}.`);
      });
      cc.on('greeting', (msg: string) => {
        log.silly(`ftp connect on-greeting ${domain}: '${msg}'.`);
      });
      cc.on('ready', () => {
        log.silly(`ftp connect on-ready ${domain}.`);
        if (id) ftpCancelableOperation(cancelkey, id);
        resolve(cc);
      });
    }
  });
}

const activeConnections: Record<string, FTP[]> = {};
const waitingConnections: Record<string, FTP[]> = {};
async function getActiveConnection(
  domain: string,
  cancelkey: string,
): Promise<FTP> {
  if (!(domain in activeConnections)) {
    activeConnections[domain] = [];
    waitingConnections[domain] = [];
  }

  const activeConnection = async (): Promise<FTP | 'too-many-connections'> => {
    let c: FTP | null | 'too-many-connections' =
      waitingConnections[domain][0] || null;
    if (c) {
      log.silly(`ftp connect on-ready-free ${domain}.`);
      waitingConnections[domain].shift();
      activeConnections[domain].push(c);
      return c;
    }
    try {
      c = await createActiveConnection(domain, cancelkey);
    } catch (er: unknown) {
      const cause: Error | 'canceled' | undefined =
        (er as Error | 'canceled') ?? undefined;
      downloadCancel(cancelkey, cause);
      return await Promise.reject(er);
    }
    try {
      ftpCancelable(cancelkey);
    } catch (er) {
      return await Promise.reject(er);
    }
    return c;
  };

  let c: FTP | 'too-many-connections';
  const cint = 10000;
  let cmsg = cint;
  for (;;) {
    try {
      c = await activeConnection();
    } catch (er: unknown) {
      const cause: Error | 'canceled' | undefined =
        (er as Error | 'canceled') ?? undefined;
      downloadCancel(cancelkey, cause);
      return await Promise.reject(er);
    }
    try {
      ftpCancelable(cancelkey);
    } catch (er) {
      return await Promise.reject(er);
    }
    if (c === 'too-many-connections') {
      cmsg -= 100;
      if (cmsg < 0) {
        log.silly(`Waiting for a free connection to ${domain}.`);
        cmsg = cint;
      }
      await new Promise((resolve) =>
        setTimeout(() => {
          resolve(true);
        }, 100),
      );
      try {
        ftpCancelable(cancelkey);
      } catch (er) {
        return await Promise.reject(er);
      }
    } else {
      break;
    }
  }
  return c;
}

// Run an arbitrary function using an FTP connection to a server.
export async function ftp<Retval>(
  domain: string,
  func: (c: FTP) => Promise<Retval>,
  cancelkey = '', // '' is uncancelable
): Promise<Retval> {
  const id = ftpCancelable(cancelkey);
  let c: FTP;
  try {
    c = await getActiveConnection(domain, cancelkey);
  } catch (er: unknown) {
    const cause: Error | 'canceled' | undefined =
      (er as Error | 'canceled') ?? undefined;
    downloadCancel(cancelkey, cause);
    return await Promise.reject(er);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }

  ftpCancelableOperation(cancelkey, id, () => {
    abortP(c).catch((err) => {
      log.debug(err);
    });
    freeConnection(c, domain);
  });

  let result: Retval;
  try {
    result = await func(c);
    freeConnection(c, domain);
  } catch (er) {
    abortP(c)
      .then(() => {
        c.destroy();
      })
      .catch((err) => {
        log.debug(err);
      });
    forgetConnection(c, domain);
    return await Promise.reject(er);
  } finally {
    ftpCancelableOperation(cancelkey, id); // never throws
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }

  return result;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const buf: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      // log.silly(`data: ${chunk.length} bytes`);
      buf.push(chunk);
    });
    stream.on('end', () => {
      resolve(Buffer.concat(buf));
    });
    stream.on('error', (er) => {
      reject(er);
    });
  });
}

// Convert the callback FTP API to promise.
async function abortP(c: FTP): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => {
      reject(new Error('timeout'));
    }, OperationTimeoutFTP);
    c.abort((er: Error) => {
      clearTimeout(to);
      if (er) reject(er);
      else resolve();
    });
  });
}

// Convert the callback FTP API to promise.
async function listP(c: FTP, dirpath: string): Promise<ListingElement[]> {
  return await new Promise((resolve, reject) => {
    log.silly(`START listP=${dirpath}`);
    const to = setTimeout(() => {
      abortP(c).catch((err) => {
        log.debug(err);
      });
      reject(new Error('timeout'));
    }, OperationTimeoutFTP);
    c.list(dirpath, false, (er: Error, listing: ListingElement[]) => {
      clearTimeout(to);
      if (er) {
        log.silly(`END (fail:${er.toString()}) listP=${dirpath}`);
        reject(er);
      } else if (listing) {
        log.silly(
          `END listP=${dirpath} listing=${listing.map((l) => l.name).join(', ')}`,
        );
        resolve(listing);
      } else {
        reject(C.UI.Manager.cancelMsg);
      }
    });
  });
}

// Convert the callback FTP API to promise.
async function sizeP(c: FTP, filepath: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      abortP(c).catch((err) => {
        log.debug(err);
      });
      reject(new Error('timeout'));
    }, OperationTimeoutFTP);
    c.size(filepath, (er: unknown, size: number) => {
      clearTimeout(to);
      if (er) {
        reject(er);
      } else resolve(size);
    });
  });
}

// Convert the callback FTP API to promise.
async function getP(c: FTP, filepath: string): Promise<NodeJS.ReadableStream> {
  return await new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      abortP(c).catch((err) => {
        log.debug(err);
      });
      reject(new Error('timeout'));
    }, OperationTimeoutFTP);
    c.get(filepath, (er: Error, stream: NodeJS.ReadableStream) => {
      clearTimeout(to);
      if (er) reject(new Error(`${er.message} ${filepath}`));
      else {
        resolve(stream);
      }
    });
  });
}

// Take an FTP connection and return a single FTP file download
// as a promise Buffer. Reports progress if a progress function
// and size is provided.
async function getFileP(
  c: FTP,
  filepath: string,
  cancelkey: string,
  progress?: (prog: number) => void,
  size?: number,
): Promise<Buffer> {
  let dead = false;
  const killstream = async (s: any) => {
    if (!dead) {
      if (s && 'destroy' in s && typeof s.destroy === 'function') {
        dead = true;
        try {
          await abortP(c);
          await s.destroy();
          log.silly(`Killed FTP stream: ${filepath}`);
        } catch (er) {
          log.error(er);
        }
      } else log.error(`Stream was not destroyable: ${filepath}`);
    }
  };

  let stream: NodeJS.ReadableStream;
  const id = ftpCancelable(cancelkey);
  log.silly(`START getFileP=${filepath} FTP=${logid(cancelkey, id)}`);
  try {
    stream = await getP(c, filepath);
    log.silly(`START stream=${filepath} FTP=${logid(cancelkey)}`);
  } catch (er: unknown) {
    const cause: Error | 'canceled' | undefined =
      (er as Error | 'canceled') ?? undefined;
    downloadCancel(cancelkey, cause);
    return await Promise.reject(er);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }

  ftpCancelableOperation(cancelkey, id, () => {
    killstream(stream).catch((er) => {
      log.error(er);
    });
  });

  let buf: Buffer;
  try {
    buf = await new Promise((resolve, reject) => {
      const resolve2 = (v: Buffer | PromiseLike<Buffer>) => {
        log.silly(`END stream=${filepath} FTP=${logid(cancelkey)}`);
        resolve(v);
      };
      const reject2 = (v: unknown) => {
        log.silly(
          `END (fail:${unknown2String(v)}) stream=${filepath} FTP=${logid(cancelkey)}`,
        );
        reject(v);
      };
      if (stream) {
        stream.on('error', (er) => {
          killstream(stream).catch((er) => {
            log.error(er);
          });
          reject2(er);
        });
        stream.on('data', () => {
          try {
            ftpCancelable(cancelkey);
          } catch (er) {
            killstream(stream).catch((er) => {
              log.error(er);
            });
            reject2(er);
          }
        });
        if (progress && size) {
          progress(0);
          let current = 0;
          stream.on('data', (chunk: Buffer) => {
            current += chunk.length;
            progress(current / size);
          });
        }
        streamToBuffer(stream)
          .then((r) => {
            resolve2(r);
          })
          .catch((er) => {
            reject2(er);
          });
      } else reject2(new Error(`No stream: ${filepath}`));
    });
  } catch (er: unknown) {
    const cause: Error | 'canceled' | undefined =
      (er as Error | 'canceled') ?? undefined;
    downloadCancel(cancelkey, cause); // cancel if stream fails
    return await Promise.reject(er);
  } finally {
    if (progress && size) progress(-1);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }
  log.silly(`END getFileP=${filepath} FTP=${logid(cancelkey, id)}`);
  ftpCancelableOperation(cancelkey, id); // never throws
  return buf;
}

// Return a buffer promise for the FTP download of domain/filepath.
// Progress is reported if a progress function is provided.
export async function getFile(
  domain: string,
  filepath: string,
  cancelkey: string,
  progress?: (p: number) => void,
): Promise<Buffer> {
  log.silly(`START getFile=${filepath} FTP=${logid(cancelkey)}`);
  const bufferPromise = await ftp(
    domain,
    async (c: FTP) => {
      let size;
      if (progress) {
        try {
          size = await sizeP(c, filepath);
        } catch (er: unknown) {
          const cause: Error | 'canceled' | undefined =
            (er as Error | 'canceled') ?? undefined;
          downloadCancel(cancelkey, cause);
          return await Promise.reject(er);
        }
        try {
          ftpCancelable(cancelkey);
        } catch (er) {
          return await Promise.reject(er);
        }
      }
      const r = await getFileP(c, filepath, cancelkey, progress, size);
      try {
        ftpCancelable(cancelkey);
      } catch (er) {
        return await Promise.reject(er);
      }
      return r;
    },
    cancelkey,
  );
  log.silly(`END getFile=${filepath} FTP=${logid(cancelkey)}`);
  return bufferPromise;
}

// FTP download an array of files from a domain, returning a Buffer array
// promise. If a progress function is provided, it will be used to report
// progress.
export async function getFiles(
  domain: string,
  files: string[],
  cancelkey: string,
  progress?: ((prog: number) => void) | null,
): Promise<Buffer[]> {
  log.silly(`START getFiles=${files.length} FTP=${logid(cancelkey)}`);
  if (progress) progress(0);
  const total = files.length;
  let prog = 0;
  const bufpromises = files.map(async (f) => {
    let b;
    try {
      b = await getFile(domain, f, cancelkey);
    } catch (er: unknown) {
      if (progress) progress(-1);
      const cause: Error | 'canceled' | undefined =
        (er as Error | 'canceled') ?? undefined;
      downloadCancel(cancelkey, cause);
      return await Promise.reject(er);
    }
    try {
      ftpCancelable(cancelkey);
    } catch (er) {
      return await Promise.reject(er);
    }
    prog += 1;
    if (progress) progress(prog / total);
    return b;
  });
  // IMPORTANT: allSettled (vs all) waits until all results are
  // in, so that progress cannot be reverted after a rejection!
  const bufferArrayP = await Promise.allSettled(bufpromises).then((pres) => {
    if (progress) progress(-1);
    const bufs: Buffer[] = [];
    pres.forEach((pre) => {
      if (pre.status === 'fulfilled') {
        bufs.push(pre.value);
      } else {
        throw pre.reason;
      }
    });

    return bufs;
  });
  log.silly(`END getFiles=${files.length} FTP=${logid(cancelkey)}`);
  return bufferArrayP;
}

// Lists a directory path on a domain using FTP and returns a promise for
// a recursive listing of the directory's contents (unless norecurse is set
// which will only list the contents of the directory itself).
export async function getListing(
  domain: string,
  dirpath: string,
  cancelkey: string,
  basepath = '',
  maxdepth = 5,
  depth = 1,
): Promise<ListingElementR[]> {
  const promises: Array<Promise<ListingElementR[]>> = [];
  let listing: ListingElement[];
  try {
    listing = await ftp(
      domain,
      async (c: FTP) => {
        log.silly(`START getListing: ${dirpath} FTP=${logid(cancelkey)}`);
        return await listP(c, dirpath);
      },
      cancelkey,
    );
  } catch (er: unknown) {
    const cause: Error | 'canceled' | undefined =
      (er as Error | 'canceled') ?? undefined;
    downloadCancel(cancelkey, cause);
    return await Promise.reject(er);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }
  const listingR = listing as ListingElementR[];
  listingR.forEach((file) => {
    file.subdir = basepath;
  });
  promises.push(Promise.resolve(listingR));
  if (depth < maxdepth) {
    listingR
      .filter((f) => f.type === 'd')
      .forEach((f) =>
        promises.push(
          getListing(
            domain,
            fpath.posix.join(dirpath, f.name),
            cancelkey,
            fpath.posix.join(basepath, f.name),
            maxdepth,
            depth + 1,
          ),
        ),
      );
  }

  const listElementArray = await Promise.all(promises);
  const flat = listElementArray
    .map((lists) => {
      return lists.flat();
    })
    .flat();
  log.silly(
    `END getListing=${dirpath} n=${flat.length} FTP=${logid(cancelkey)}`,
  );
  return flat;
}

// FTP downloads a directory from a domain using FTP, returning it as path/data
// object promise. If a progress function is provided, it will be used to report
// progress.
export async function getDir(
  domain: string,
  dirpath: string,
  skipPathRegex: RegExp,
  cancelkey: string,
  progress?: ((prog: number) => void) | null,
): Promise<Array<{ listing: ListingElementR; buffer: Buffer }>> {
  let listing: ListingElementR[];
  log.silly(`START getDir=${dirpath} FTP=${logid(cancelkey)}`);
  try {
    listing = await getListing(domain, dirpath, cancelkey);
  } catch (er) {
    downloadCancel(cancelkey);
    return await Promise.reject(er);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }
  const files = listing.filter(
    (l) =>
      l.type === '-' &&
      !skipPathRegex.test(fpath.posix.join(dirpath, l.subdir, l.name)),
  );
  let buffers: Buffer[];
  try {
    buffers = await getFiles(
      domain,
      files.map((l) => fpath.posix.join(dirpath, l.subdir, l.name)),
      cancelkey,
      progress,
    );
  } catch (er: unknown) {
    const cause: Error | 'canceled' | undefined =
      (er as Error | 'canceled') ?? undefined;
    downloadCancel(cancelkey, cause);
    return await Promise.reject(er);
  }
  try {
    ftpCancelable(cancelkey);
  } catch (er) {
    return await Promise.reject(er);
  }
  const ret: Array<{ listing: ListingElementR; buffer: Buffer }> = [];
  if (buffers) {
    files.forEach((l, i) => {
      ret.push({ listing: l, buffer: buffers[i] });
    });
  }
  log.silly(`END getDir=${dirpath} FTP=${logid(cancelkey)}`);
  return ret;
}

// Take a tar.gz or tar file as a Buffer or else a file path string,
// and decode it, returning the contents as an array of
// { header, content } objects.
export async function untargz(
  input: Buffer | string,
): Promise<Array<{ header: TAR.Headers; content: Buffer }>> {
  const result: Array<{ header: TAR.Headers; content: Buffer }> = [];
  let stream: Stream | null = null;
  if (typeof input === 'string') {
    const file = new LocalFile(input);
    if (file.exists() && !file.isDirectory()) {
      stream = Readable.from(file.readBuf());
    }
  } else {
    stream = Readable.from(input);
  }
  if (stream) {
    const extract = TAR.extract();
    stream.pipe(GUNZIP()).pipe(extract);
    return await new Promise((resolve, reject) => {
      extract.on(
        'entry',
        (header: TAR.Headers, stream2: Readable, next: () => void) => {
          log.silly(`untargz received stream2.`);
          streamToBuffer(stream2)
            .then((content) => {
              return content && result.push({ header, content });
            })
            .catch((er) => {
              reject(er);
            });
          stream2.on('end', () => {
            next();
          });
          stream2.resume(); // just auto drain the stream
        },
      );
      extract.on('finish', () => {
        resolve(result);
      });
    });
  }
  return result;
}

export async function getFileHTTP(
  url: string,
  dest: LocalFile | string,
  cancelkey?: string,
  progress?: ((p: number) => void) | null,
): Promise<LocalFile> {
  return await new Promise((resolve, reject) => {
    let rejected = false;
    const rejectme = (er: unknown) => {
      if (!rejected) {
        if (progress) progress(-1);
        reject(er);
      }
      rejected = true;
    };
    const canceled = () => {
      if (
        cancelkey &&
        cancelkey in HttpCancelable &&
        HttpCancelable[cancelkey].canceled
      ) {
        rejectme({ message: C.UI.Manager.cancelMsg });
        return true;
      }
      return false;
    };
    if (!canceled()) {
      const ses = session.fromPartition(randomID(), { cache: false });
      const destpath = typeof dest === 'string' ? dest : dest.path;
      const destFile = new LocalFile(destpath);
      ses.on('will-download', (ev, item) => {
        if (progress) progress(0);
        if (cancelkey) {
          HttpCancelable[cancelkey] = {
            canceled: false,
            callback: () => {
              item.cancel();
              ev.preventDefault();
              rejectme({ message: C.UI.Manager.cancelMsg });
            },
          };
        }
        item.setSavePath(destpath);
        item.on('updated', (ev2, state) => {
          if (state === 'interrupted') {
            item.cancel();
            rejectme(new Error('Download was interrupted'));
          } else if (state === 'progressing') {
            if (item.isPaused()) {
              item.cancel();
              ev2.preventDefault();
              rejectme(new Error('Download was paused'));
            } else if (progress) {
              progress(item.getReceivedBytes() / item.getTotalBytes());
            }
          }
        });
        item.once('done', (_e, state) => {
          if (progress) progress(-1);
          if (cancelkey) delete HttpCancelable[cancelkey];
          if (state === 'completed') {
            if (!canceled()) {
              resolve(destFile);
            }
          } else if (state === 'cancelled') {
            rejectme({ message: C.UI.Manager.cancelMsg });
          } else {
            rejectme(new Error(`Download failed '${state}'`));
          }
        });
      });
      try {
        ses.setUserAgent(C.HTTPUserAgent);
        ses.setDownloadPath(fpath.dirname(destpath));
        ses.downloadURL(url);
      } catch (er) {
        if (!canceled()) {
          rejectme(er);
        }
      }
    }
  });
}
