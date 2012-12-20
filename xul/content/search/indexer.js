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
  
  moduleName:prefs.getCharPref("DefaultVersion"),
  cipherKey:null,
  usesSecurity:false,
  inprogress:false,
  progressMeter:null,
  callback:null,
  indexer:null,

  create: function() {
    if (this.inprogress) return;
    
    this.inprogress = this.moduleName;

    // Check if our module needs xulsword to supply a cipherKey.
    // Params cipherKey and usesSecurity must be saved now before
    // LibSword is paused, because afterwards they are inaccesible.
    if (!LibSword.getModuleInformation(this.moduleName, "CipherKey")) {
      // a cipher key is needed, so get it...
      this.cipherKey = getPrefOrCreate("CipherKey" + this.moduleName, "Char", prefs.getCharPref("DefaultCK"));
      this.usesSecurity = LibSword.usesSecurityModule(this.moduleName);
    }
    
    // Must pause LibSword before indexer thread can be started because 
    // there can only be one instance of libsword in existence at a time.
    LibSword.pause(this);

  },
  
  libswordPauseComplete: function() {
        
    this.indexer = ChromeWorker("chrome://xulsword/content/search/indexWorker.js");
    this.indexer.onerror = this.error;
    this.indexer.onmessage = this.postMessage;
    
    // Worker threads cannot access the functions necessary to 
    // aquire the following data, so we just pass the data.
    // Calling postMessage starts the indexer...
    this.indexer.postMessage({ 
        modname:this.moduleName, 
        moddir:LibSword.ModuleDirectory, 
        libpath:LibSword.LibswordPath, 
        cipherKey:this.cipherKey, 
        usesSecurity:this.usesSecurity });
        
  },
  
  // NOTE: will be invoked by indexer as a function (this = global context!)
  error: function(error) {throw error;},

  // NOTE: will be invoked by indexer as a function (this = global context!)
  postMessage: function(event) {
    if ((/^jsdump/).test(event.data)) {jsdump(event.data); return;}
    
    if (event.data == -1) {
      Indexer.finished(); 
      return;
    }
    if (Indexer.progressMeter) Indexer.progressMeter.value = event.data;
  },

  terminate: function() {
    if (Indexer.inprogress) {
      if (Indexer.indexer) {
        //Indexer.indexer.terminate(); causes crash...
      }
      //Indexer.finished(); calling while indexing causes crash at LibSword.resume...
    }
  },

  finished: function() {
    LibSword.resume();
    
    // set up vars for next "create()"
    this.indexer = null;
    this.progressMeter = null;
    this.cipherKey = null;
    this.usessecurity = false;
    
    this.inprogress = false;
    
    if (this.callback && this.callback.onIndexerDone) this.callback.onIndexerDone();
    this.callback = null;
    
  }
  
};
