//@line 39 "e:\builds\moz2_slave\mozilla-1.9.1-win32-xulrunner\build\toolkit\components\printing\content\printPreviewProgress.js"

// dialog is just an array we'll use to store various properties from the dialog document...
var dialog;

// the printProgress is a nsIPrintProgress object
var printProgress = null; 

// random global variables...
var targetFile;

var docTitle = "";
var docURL   = "";
var progressParams = null;

function elipseString(aStr, doFront)
{
  if (aStr.length > 3 && (aStr.substr(0, 3) == "..." || aStr.substr(aStr.length-4, 3) == "..."))
    return aStr;

  var fixedLen = 64;
  if (aStr.length <= fixedLen)
    return aStr;

  if (doFront)
    return "..." + aStr.substr(aStr.length-fixedLen, fixedLen);
  
  return aStr.substr(0, fixedLen) + "...";
}

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {

  onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
  {
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      window.close();
  },
  
  onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
  {
    if (!progressParams)
      return;
    var docTitleStr = elipseString(progressParams.docTitle, false);
    if (docTitleStr != docTitle) {
      docTitle = docTitleStr;
      dialog.title.value = docTitle;
    }
    var docURLStr = elipseString(progressParams.docURL, true);
    if (docURLStr != docURL && dialog.title != null) {
      docURL = docURLStr;
      if (docTitle == "")
        dialog.title.value = docURLStr;
    }
  },

  onLocationChange: function (aWebProgress, aRequest, aLocation) {},
  onSecurityChange: function (aWebProgress, aRequest, state) {},

  onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage)
  {
    if (aMessage)
      dialog.title.setAttribute("value", aMessage);
  },

  QueryInterface: function (iid)
  {
    if (iid.equals(Components.interfaces.nsIWebProgressListener) || iid.equals(Components.interfaces.nsISupportsWeakReference))
      return this;   
    throw Components.results.NS_NOINTERFACE;
  }
}

function onLoad() {
  // EDIT!!
  updateCSSBasedOnCurrentLocale(["window", "button", "menuitem"]);
  document.title = fixWindowTitle(document.title);
 
  // Set global variables.
  printProgress = window.arguments[0];
  if (window.arguments[1]) {
    progressParams = window.arguments[1].QueryInterface(Components.interfaces.nsIPrintProgressParams)
    if (progressParams) {
      docTitle = elipseString(progressParams.docTitle, false);
      docURL   = elipseString(progressParams.docURL, true);
    }
  }

  if (!printProgress) {
    dump( "Invalid argument to printPreviewProgress.xul\n" );
    window.close()
    return;
  }

  dialog         = new Object;
  dialog.strings = new Array;
  dialog.title   = document.getElementById("dialog.title");
  dialog.titleLabel = document.getElementById("dialog.titleLabel");

  dialog.title.value = docTitle;

  // set our web progress listener on the helper app launcher
  printProgress.registerListener(progressListener);
  moveToAlertPosition();

  //We need to delay the set title else dom will overwrite it
  window.setTimeout(doneIniting, 100);
}

function onUnload() 
{
  if (!printProgress)
    return;
  try {
    printProgress.unregisterListener(progressListener);
    printProgress = null;
  }
  catch(e) {}
}

function getString (stringId) {
  // Check if we've fetched this string already.
  if (!(stringId in dialog.strings)) {
    // Try to get it.
    var elem = document.getElementById( "dialog.strings."+stringId);
    try {
      if (elem && elem.childNodes && elem.childNodes[0] &&
          elem.childNodes[0].nodeValue)
        dialog.strings[stringId] = elem.childNodes[0].nodeValue;
      // If unable to fetch string, use an empty string.
      else
        dialog.strings[stringId] = "";
    } catch (e) { dialog.strings[stringId] = ""; }
  }
  return dialog.strings[stringId];
}

// If the user presses cancel, tell the app launcher and close the dialog...
function onCancel () 
{
  // Cancel app launcher.
  try {
    printProgress.processCanceledByUser = true;
  }
  catch(e) {return true;}
    
  // don't Close up dialog by returning false, the backend will close the dialog when everything will be aborted.
  return false;
}

function doneIniting() 
{
  // called by function timeout in onLoad
  printProgress.doneIniting();
}
