const Commands = {
  addRepositoryModule() {
    console.log(`Action not implemented: addRepositoryModule`);
  },

  addLocalModule() {
    console.log(`Action not implemented: addLocalModule`);
  },

  removeModule() {
    console.log(`Action not implemented: removeModule`);
  },

  exportAudio() {
    console.log(`Action not implemented: exportAudio`);
  },

  importAudio() {
    console.log(`Action not implemented: importAudio`);
  },

  pageSetup() {
    console.log(`Action not implemented: pageSetup`);
  },

  printPreview() {
    console.log(`Action not implemented: printPreview`);
  },

  printPassage() {
    console.log(`Action not implemented: printPassage`);
  },

  print() {
    console.log(`Action not implemented: print`);
  },

  edit(which: string, ...args: any) {
    switch (which) {
      case 'undo':
        this.undo(...args);
        break;
      case 'redo':
        this.redo(...args);
        break;
      case 'cut':
        this.cut(...args);
        break;
      case 'copy':
        this.copy(...args);
        break;
      case 'paste':
        this.paste(...args);
        break;
      default:
    }
  },

  undo(...args: any) {
    console.log(`Action not implemented: undo()`);
  },

  redo(...args: any) {
    console.log(`Action not implemented: redo()`);
  },

  cut(...args: any) {
    console.log(`Action not implemented: cut()`);
  },

  copy(...args: any) {
    console.log(`Action not implemented: copy()`);
  },

  paste(...args: any) {
    console.log(`Action not implemented: paste()`);
  },

  search() {
    console.log(`Action not implemented: search()`);
  },

  copyPassage() {
    console.log(`Action not implemented: copyPassage`);
  },

  openFontsColors() {
    console.log(`Action not implemented: openFontsColors`);
  },

  openBookmarksManager() {
    console.log(`Action not implemented: openBookmarksManager()`);
  },

  openNewBookmarkDialog() {
    console.log(`Action not implemented: openNewBookmarkDialog()`);
  },

  openNewUserNoteDialog() {
    console.log(`Action not implemented: openNewUserNoteDialog()`);
  },

  openHelp() {
    console.log(`Action not implemented: openHelp()`);
  },
};

export default Commands;
