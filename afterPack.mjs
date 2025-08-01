/*global process */
import fs from 'fs';
import path from 'path';

const keepLocales = ['en', 'ru', 'fa', 'ko'];
const localeDirName = 'locales';

export default async function (context) {
  // Chrome dev-tools requires these locales!
  if (process.env.NODE_ENV !== 'development') {
    console.log(`Running ./afterPack.mjs ... `);
    // Remove 7 MB from AppImage by removing unnecessary Chrome locales
    const dir = path.join(context.appOutDir, localeDirName);
    const deleted = [];
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((pak) => {
        if (!keepLocales.includes(pak.replace(/\.pak$/, ''))) {
          fs.rmSync(path.join(dir, pak));
          deleted.push(pak);
        }
      });
      console.log(`Deleted ${deleted.length} unnecessary Chrome locales.`);
    }
  }
  return true;
}
