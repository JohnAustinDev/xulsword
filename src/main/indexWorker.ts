import fs from 'fs';

const { libxulsword } = require('libxulsword');

// Libxulsword requires both these callbacks to be defined.
global.ToUpperCase = (aString) => {
  if (aString) {
    return aString.toUpperCase();
  }
  return '';
};
global.ReportSearchIndexerProgress = (percent) => {
  if (typeof process?.send === 'function') {
    process.send({ msg: 'working', percent });
  }
};

process.on('message', (obj: { modsd: string, modcode: string }) => {
  const { modsd, modcode } = obj;
  let success = false;
  if (Array.isArray(modsd)) {
    const mf = modsd.filter((p) => fs.existsSync(p));
    if (mf.length) {
      success = libxulsword.GetXulsword(mf.join(', '));
    }
  }
  if (success) {
    const mods = libxulsword
      .GetModuleList()
      .split('<nx>')
      .map((s: string) => s.split(';')[0]);
    if (mods.includes(modcode)) {
      if (libxulsword.LuceneEnabled(modcode)) {
        success = libxulsword.SearchIndexDelete(modcode);
      }
      if (success) success = libxulsword.SearchIndexBuild(modcode);
    }
  }
  if (typeof process?.send === 'function') {
    if (success) {
      process.send({ msg: 'finished', percent: 100 });
    } else process.send({ msg: 'failed', percent: 100 });
    process.disconnect();
  }
});
