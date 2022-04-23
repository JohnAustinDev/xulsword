/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import { GType, MasterRepoEntry, SwordConfType } from 'type';
import LocalFile from './localFile';

// import type { ZipEntryType } from 'type';

const Client = require('ftp');
const AdmZip = require('adm-zip');

const Downloader: GType['Downloader'] = {
  async crossWireMasterRepoList(tmpdir: string) {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: '/pub/sword/',
      file: 'masterRepoList.conf',
      regex: 'FTPSource=([^|]+)\\|([^|]+)\\|([^|]+)\\s*[\\n\\r]',
    };
    const { domain, path, file, regex } = mr;
    const tmpFile = new LocalFile(tmpdir).append(file);
    const c = new Client();
    return new Promise((resolve, reject) => {
      c.on('ready', () => {
        c.get(`${path}${file}`, (err: Error, stream: any) => {
          if (err) reject(err);
          stream.once('close', () => {
            c.end();
            const result: MasterRepoEntry[] = [];
            const fstring = tmpFile.readFile();
            fstring.match(new RegExp(regex, 'g'))?.forEach((mx) => {
              const m = mx.match(new RegExp(regex));
              if (m) {
                result.push({
                  name: m[1],
                  domain: m[2],
                  path: m[3],
                });
              }
            });
            resolve(result);
          });
          stream.pipe(fs.createWriteStream(tmpFile.path));
        });
      });
      try {
        c.connect({ host: domain });
      } catch (er) {
        reject(er);
      }
    });
  },

  async repositoryListing(repo, tmpdir) {
    return new Promise((resolve, reject) => {
      const result: SwordConfType[] = [];

      resolve(result);
    });
  },
};

export default Downloader;
