/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

    xulSword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    xulSword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with xulSword.  If not, see <http://www.gnu.org/licenses/>.
*/

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
    this.indexer = null;
    Bible.resume();
    if (Indexer.exitfunc) Indexer.exitfunc();
  },


  indexer:null
};
