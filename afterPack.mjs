/*global process */
import fs from 'fs';
import path from 'path';
import macSign from './scripts/macSign.mjs';

const keepLocales = ['en', 'ru', 'fa', 'ko'];
const localeDirName = 'locales';

export default async function (context) {
  // Chrome dev-tools and audio element requires a locale pak!
  console.log(`Running ./afterPack.mjs ... `);
  const dir = path.join(context.appOutDir, localeDirName);
  let deleted = 0;
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((pak) => {
      if (!keepLocales.find((l) => pak.startsWith(l))) {
        const pakpath = path.join(dir, pak);
        const stats = fs.statSync(pakpath);
        deleted += stats.size;
        fs.rmSync(pakpath);
      }
    });
    console.log(
      `Deleted ${Math.round(deleted / 1000000)} MB of unnecessary Chrome locales from ${dir}.`,
    );
  }

  // electron-builder only signs MacOS apps when running on MacOS.
  if (
    context.electronPlatformName === 'darwin' &&
    process.platform !== 'darwin'
  ) {
    await macSign(context);
  }

  return true;
}
