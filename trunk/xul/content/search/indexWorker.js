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


// This script is used to create a ChromeWorker object which runs
// on its own thread in the background. It creates new search indexes 
// for SWORD modules.

var LibSword;

importScripts("chrome://xulsword/content/libsword.js");

onmessage = function(event) {
  var data = event.data;

  LibSword.ModuleDirectory = data.moddir;
  LibSword.LibswordPath = data.libpath;

  var re = new RegExp("(^|<nx>)" + data.modname + ";");
  if (re.test(LibSword.getModuleList())) {
    
    if (data.cipherKey) LibSword.setCipherKey(data.modname, data.cipherKey, data.usesSecurity);
    
    if (LibSword.luceneEnabled(data.modname)) LibSword.searchIndexDelete(data.modname);
        
    LibSword.searchIndexBuild(data.modname);
    
  }
  
  LibSword.quitLibsword(); // the call to LibSword.getModuleList started libsword

  postMessage(-1); // this means we're done!
}
