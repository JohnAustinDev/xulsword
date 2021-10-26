/* eslint-disable class-methods-use-this */
const LibSword: { [i: string]: any } = {
  getMaxChapter(modname: string, vkeytext: string): number {
    return 99;
  },

  getMaxVerse(modname: string, vkeytext: string): number {
    return 88;
  },

  getModuleInformation(modname: string, key: string): string {
    return `This is ${key} of ${modname}`;
  },

  getModuleList(): string {
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

export default LibSword;
