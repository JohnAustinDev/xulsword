var Indexer = {
  inprogress:false,
  
  progressMeter:null,

  exitfunc:null,

  error: function(error) {throw error;},

  progress: function(event) {
    if (Indexer.progressMeter) Indexer.progressMeter.value = event.data;
    if (event.data == -1) {Indexer.finished();}
  },

  create: function() {
    this.allWindowsModal(true);
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
        //Indexer.indexer.terminate(); causes crash...
      }
      //Indexer.finished(); calling while indexing causes crash at Bible.resume...
    }
  },

  finished: function() {
    Indexer.inprogress = false;
    Bible.resume();
    Indexer.allWindowsModal(false);
    if (Indexer.exitfunc) Indexer.exitfunc();
  },
  
  allWindowsModal: function(setModal) {
    for (var i=0; i<SearchWins.length; i++) {
      Indexer.windowModal(SearchWins[i], setModal);
    }
    if (ManagerWindow)
      Indexer.windowModal(ManagerWindow, setModal);
    Indexer.windowModal(window, setModal);
  },

  stopevent: function(event) {event.stopPropagation(); event.preventDefault();},
  
  windowModal: function(win, setModal) {
    var events = ["click", "mouseover", "mouseout", "mousemove", "mousedown",
              "mouseup", "dblclick", "select", "keydown", "keypress", "keyup"];
    if (setModal) {
      for (var i=0; i<events.length; i++){
        win.addEventListener(events[i], Indexer.stopevent, true);
      }
    }
    else {
      for (var i=0; i<events.length; i++){
        win.removeEventListener(events[i], Indexer.stopevent, true);
      }
    }
  },

  indexer:null,
};