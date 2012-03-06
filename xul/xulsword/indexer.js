var Indexer = {
  inprogress:false,

  error: function(error) {throw error;},

  progress: function(event) {
    document.getElementById("progress").value = event.data;
    if (event.data == -1) {Indexer.finished();}
  },

  create: function() {
    var modname = prefs.getCharPref("SearchVersion");
    var cipherkey = null;
    var usesecurity = null;
    if (!Bible.getModuleInformation(modname, "CipherKey")) {
      try {cipherkey = getPrefOrCreate("CipherKey" + modname, "Char", prefs.getCharPref("DefaultCK"));}
      catch(er) {cipherkey = null;}
      usesecurity = usesSecurityModule(Bible, modname);
    }
    Bible.pause();

    if (!this.indexer) {
      this.indexer = ChromeWorker("chrome://xulsword/content/indexWorker.js");
      this.indexer.onerror = this.error;
      this.indexer.onmessage = this.progress;
    }

    this.indexer.postMessage({modname:modname, moddir:Bible.ModuleDirectory, libpath:Bible.LibswordPath, cipherkey:cipherkey, usesecurity:usesecurity});
    this.inprogress = modname;
  },

  terminate: function() {
    if (Indexer.inprogress) {
      if (Indexer.indexer) {
        Indexer.indexer.terminate();
        Indexer.indexer = null;
      }
      Indexer.finished();
    }
  },

  finished: function() {
    Indexer.inprogress = false;
    Bible.resume();
    indexerFinished();
  },

  indexer:null,
};