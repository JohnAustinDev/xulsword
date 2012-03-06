importScripts("chrome://xulsword/content/libsword.js");

onmessage = function(event) {
  var data = event.data;

  Bible.ModuleDirectory = data.moddir;
  Bible.LibswordPath = data.libpath;

  var re = new RegExp("(^|<nx>)" + data.modname + ";");
  if (re.test(Bible.getModuleList())) {
    if (data.cipherkey) Bible.setCipherKey(data.modname, data.cipherkey, data.usesecurity);

    Bible.searchIndexDelete(data.modname);
    if (data.cipherKey) {Bible.setCipherKey(data.modname, data.cipherkey, data.usesecurity);}
    Bible.searchIndexBuild(data.modname);
  }
  
  Bible.quitLibsword();
  postMessage(-1);
}
