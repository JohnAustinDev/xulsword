importScripts("chrome://xulsword/content/libsword.js");
var prog=1;
var interval;
onmessage = function(event) {
  var data = event.data;

  Bible.ModuleDirectory = data.moddir;
  Bible.LibswordPath = data.libpath;
  
  Bible.searchIndexDelete(data.modname);
  if (data.cipherKey) {Bible.setCipherKey(data.modname, data.cipherkey, data.usesecurity);}
  Bible.searchIndexBuild(data.modname);
}
