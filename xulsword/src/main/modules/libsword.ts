/* eslint-disable class-methods-use-this */
import { LibSwordPublic } from '../../type';

const LibSword: typeof LibSwordPublic = {
  getMaxChapter(modname, vkeytext) {
    return 99;
  },

  getMaxVerse(modname, vkeytext) {
    return 88;
  },

  getModuleInformation(modname, key) {
    return `This is ${key} of ${modname}`;
  },

  getModuleList() {
    return 'KJV<nx>SYN';
  },

  getVerseText(
    modname: string,
    vkeytext: string,
    keepTextNotes: boolean
  ): string {
    return 'This is some verse text!';
  },
};

export default LibSword as typeof LibSwordPublic;
