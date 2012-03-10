/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is The JavaScript Debugger.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Ginda, <rginda@netscape.com>, original author
 *   Gijs Kruitbosch <gijskruitbosch@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/* components defined in this file */
const CLINE_SERVICE_CTRID =
    "@mozilla.org/commandlinehandler/general-startup;1?type=venkman";
const CLINE_SERVICE_CID =
    Components.ID("{18269616-1dd2-11b2-afa8-b612439bda27}");
const JSDPROT_HANDLER_CTRID =
    "@mozilla.org/network/protocol;1?name=x-jsd";
const JSDPROT_HANDLER_CID =
    Components.ID("{12ec790d-304e-4525-89a9-3e723d489d14}");
const JSDCNT_HANDLER_CTRID =
    "@mozilla.org/uriloader/content-handler;1?type=x-application-jsd";
const JSDCNT_HANDLER_CID =
    Components.ID("{306670f0-47bb-466b-b53b-613235623bbd}");

/* components used by this file */
const STRING_STREAM_CTRID = "@mozilla.org/io/string-input-stream;1";
const MEDIATOR_CTRID =
    "@mozilla.org/appshell/window-mediator;1";
const ASS_CONTRACTID =
    "@mozilla.org/appshell/appShellService;1";
const SIMPLEURI_CTRID = "@mozilla.org/network/simple-uri;1";

const nsIWindowMediator    = Components.interfaces.nsIWindowMediator;
const nsIAppShellService   = Components.interfaces.nsIAppShellService;
const nsIContentHandler    = Components.interfaces.nsIContentHandler;
const nsIProtocolHandler   = Components.interfaces.nsIProtocolHandler;
const nsIURI               = Components.interfaces.nsIURI;
const nsIURL               = Components.interfaces.nsIURL;
const nsIStringInputStream = Components.interfaces.nsIStringInputStream;
const nsIChannel           = Components.interfaces.nsIChannel;
const nsIRequest           = Components.interfaces.nsIRequest;
const nsIProgressEventSink = Components.interfaces.nsIProgressEventSink;
const nsISupports          = Components.interfaces.nsISupports;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;

function findDebuggerWindow ()
{
    var windowManager =
        Components.classes[MEDIATOR_CTRID].getService(nsIWindowMediator);
    return windowManager.getMostRecentWindow("mozapp:venkman");
}

function openDebuggerWindow(args)
{
    var ass = Components.classes[ASS_CONTRACTID].getService(nsIAppShellService);
    var window = ass.hiddenDOMWindow;
    window.openDialog("chrome://venkman/content/venkman.xul", "_blank",
                      "chrome,menubar,toolbar,status,resizable,dialog=no",
                      args);
}

function safeHTML(str)
{
    function replaceChars(ch)
    {
        switch (ch)
        {
            case "<":
                return "&lt;";
            
            case ">":
                return "&gt;";
                    
            case "&":
                return "&amp;";
                    
            case "'":
                return "&#39;";
                    
            case '"':
                return "&quot;";
        }

        return "?";
    };
        
    return String(str).replace(/[<>&"']/g, replaceChars);
}

/* Command Line handler service */
function CLineService()
{}

/* nsISupports */
CLineService.prototype.QueryInterface =
function handler_QI(iid)
{
    var ifaces = this.getInterfaces({});
    for (var face in ifaces)
    {
        if (iid.equals(ifaces[face]))
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

/* nsIClassInfo */
CLineService.prototype.getInterfaces =
function getInterfaces(aCount)
{
    var interfaces = [Components.interfaces.nsISupports,
                      Components.interfaces.nsIClassInfo,
                      Components.interfaces.nsIObserver,
                      Components.interfaces.nsICommandLineHandler];

    aCount.value = interfaces.length;
    return interfaces;
};

CLineService.prototype.getHelperForLanguage =
function getHelperForLanguage()
{
    return null;
};

CLineService.prototype.contractID = CLINE_SERVICE_CTRID;
CLineService.prototype.classDescription = "Venkman Commandline Service";
CLineService.prototype.classID = CLINE_SERVICE_CID;
CLineService.prototype.implementationLanguage = Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT;
CLineService.prototype.flags = Components.interfaces.nsIClassInfo.SINGLETON;
CLineService.prototype._xpcom_categories = [{
     category: "profile-after-change",
     entry: "aaa-venkman"
   },
   {
     category: "command-line-handler",
     entry: "m-venkman"
   }];

CLineService.prototype.prefNameForStartup = "general.startup.venkman";

/* nsICommandLineHandler */

CLineService.prototype.handle =
function handler_handle(cmdLine)
{
    // If the user called the host app with -venkman on the commandline or if
    // the pref general.startup.venkman is true, we open Venkman's main window.
    try
    {
        var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
        var prefValue = false;
        try {
            prefValue = prefService.getBoolPref(this.prefNameForStartup);
        } catch (ignore) {}

        if (cmdLine.handleFlag("venkman", false) || prefValue)
        {
            openDebuggerWindow(null);
            cmdLine.preventDefault = true;
        }
    }
    catch (e)
    {
        debug(e);
    }
}

CLineService.prototype.helpInfo =
 "  -venkman         Start with JavaScript debugger (Venkman).\n"

/* profile-after-change observer */

CLineService.prototype.observe =
function handler_observe(subject, topic, data)
{
    if (topic != "profile-after-change")
        return;

    // Check if the debugger service is on, turn it on/off based on the pref:
    // - If extensions.venkman.initJSDAtStartup is true, we enforce a running
    //   jsdIDebuggerService.
    // - If extensions.venkman.initJSDAtStartup is false, we need to turn the
    //   jsdIDebuggerService off.
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
    var shouldInitAtStartup = false;
    try
    {
        shouldInitAtStartup = prefService.getBoolPref("extensions.venkman.initJSDAtStartup");
    }
    catch (ignored) {}

    const JSD_CTRID = "@mozilla.org/js/jsd/debugger-service;1";
    const jsdIDebuggerService = Components.interfaces.jsdIDebuggerService;
    var jsds = Components.classes[JSD_CTRID].getService(jsdIDebuggerService);
    if (("initAtStartup" in jsds) && jsds.initAtStartup != shouldInitAtStartup)
    {
        // Attempt to correct the app-startup observer registration:
        // (initAtStartup was removed by bug 568691 on 2010-06-10
        jsds.initAtStartup = shouldInitAtStartup;
    }
    if (jsds.isOn != shouldInitAtStartup)
    {
        // mimic the missing app-startup observer call
        if (shouldInitAtStartup)
        {
            function onDebuggerActivated()
            {
                dump("Turned on JSD at startup\n");
            }

            if ("asyncOn" in jsds)
            {
                // asyncOn was introduced by bug 595243 on 2010-10-29
                jsds.asyncOn(onDebuggerActivated);
            }
            else
            {
                jsds.on();
                // This flag retired as of moz2:
                if ("DISABLE_OBJECT_TRACE" in jsds)
                    jsds.flags = jsds.DISABLE_OBJECT_TRACE;
                onDebuggerActivated();
            }
        }
        else
        {
            jsds.off();
            dump("Turned off JSD at startup\n");
        }
    }
}


/* x-jsd: protocol handler */

const JSD_DEFAULT_PORT = 2206; /* Dana's apartment number. */

function JSDURI (spec, charset)
{
    this.spec = this.prePath = spec;
    this.charset = this.originCharset = charset;
}

JSDURI.prototype.QueryInterface =
function jsdch_qi (iid)
{
    if (!iid.equals(nsIURI) && !iid.equals(nsIURL) &&
        !iid.equals(nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
}

JSDURI.prototype.scheme = "x-jsd";

JSDURI.prototype.fileBaseName =
JSDURI.prototype.fileExtension =
JSDURI.prototype.filePath  =
JSDURI.prototype.param     =
JSDURI.prototype.query     =
JSDURI.prototype.ref       =
JSDURI.prototype.directory =
JSDURI.prototype.fileName  =
JSDURI.prototype.username  =
JSDURI.prototype.password  =
JSDURI.prototype.hostPort  =
JSDURI.prototype.path      =
JSDURI.prototype.asciiHost =
JSDURI.prototype.userPass  = "";

JSDURI.prototype.port = JSD_DEFAULT_PORT;

JSDURI.prototype.schemeIs =
function jsduri_schemeis (scheme)
{
    return scheme.toLowerCase() == "x-jsd";
}

JSDURI.prototype.getCommonBaseSpec =
function jsduri_commonbase (uri)
{
    return "x-jsd:";
}

JSDURI.prototype.getRelativeSpec =
function jsduri_commonbase (uri)
{
    return uri;
}

JSDURI.prototype.equals =
function jsduri_equals (uri)
{
    return uri.spec == this.spec;
}

JSDURI.prototype.clone =
function jsduri_clone ()
{
    return new JSDURI (this.spec);
}

JSDURI.prototype.resolve =
function jsduri_resolve(path)
{
    //dump ("resolve " + path + " from " + this.spec + "\n");
    if (path[0] == "#")
        return this.spec + path;
    
    return path;
}

function JSDProtocolHandler()
{
    /* nothing here */
}

/* nsISupports */
JSDProtocolHandler.prototype.QueryInterface =
function jsdph_qi(iid)
{
    var ifaces = this.getInterfaces({});
    for (var face in ifaces)
    {
        if (iid.equals(ifaces[face]))
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

/* nsIClassInfo */
JSDProtocolHandler.prototype.getInterfaces =
function getInterfaces(aCount)
{
    var interfaces = [Components.interfaces.nsISupports,
                      Components.interfaces.nsIProtocolHandler,
                      Components.interfaces.nsIClassInfo];

    aCount.value = interfaces.length;
    return interfaces;
};

JSDProtocolHandler.prototype.getHelperForLanguage = function getHelperForLanguage() null;

JSDProtocolHandler.prototype.contractID = JSDPROT_HANDLER_CTRID;
JSDProtocolHandler.prototype.classDescription = "Venkman x-jsd Protocol Handler";
JSDProtocolHandler.prototype.classID = JSDPROT_HANDLER_CID;
JSDProtocolHandler.prototype.implementationLanguage = Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT;
JSDProtocolHandler.prototype.flags = 0;

/* nsIProtocolHandler */
JSDProtocolHandler.prototype.scheme = "x-jsd";
JSDProtocolHandler.prototype.defaultPort = JSD_DEFAULT_PORT;
JSDProtocolHandler.prototype.protocolFlags = nsIProtocolHandler.URI_NORELATIVE |
                                             nsIProtocolHandler.URI_NOAUTH;
if ("URI_DANGEROUS_TO_LOAD" in nsIProtocolHandler) {
  JSDProtocolHandler.prototype.protocolFlags |=
      nsIProtocolHandler.URI_DANGEROUS_TO_LOAD;
}

JSDProtocolHandler.prototype.allowPort =
function jsdph_allowport (aPort, aScheme)
{
    return false;
}

JSDProtocolHandler.prototype.newURI =
function jsdph_newuri (spec, charset, baseURI)
{
    var clazz = Components.classes[SIMPLEURI_CTRID];
    var uri = clazz.createInstance(nsIURI);
    uri.spec = spec;
    return uri;
}

JSDProtocolHandler.prototype.newChannel =
function jsdph_newchannel (uri)
{
    return new JSDChannel (uri);
}

function JSDChannel (uri)
{
    this.URI = uri;
    this.originalURI = uri;
    this._isPending = false;
    var clazz = Components.classes[STRING_STREAM_CTRID];
    this.stringStream = clazz.createInstance(nsIStringInputStream);
}

JSDChannel.prototype.QueryInterface =
function jsdch_qi (iid)
{

    if (!iid.equals(nsIChannel) && !iid.equals(nsIRequest) &&
        !iid.equals(nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
}

/* nsIChannel */
JSDChannel.prototype.loadAttributes = null;
JSDChannel.prototype.contentType = "text/html";
JSDChannel.prototype.contentLength = -1;
JSDChannel.prototype.owner = null;
JSDChannel.prototype.loadGroup = null;
JSDChannel.prototype.notificationCallbacks = null;
JSDChannel.prototype.securityInfo = null;

JSDChannel.prototype.open =
function jsdch_open()
{
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

JSDChannel.prototype.asyncOpen =
function jsdch_aopen (streamListener, context)
{
    this.streamListener = streamListener;
    this.context = context;
    this._isPending = true;
    
    if (!window && this.URI.spec == "x-jsd:debugger")
    {
        this.contentType = "x-application-jsd";
        this.contentLength = 0;
        streamListener.onStartRequest(this, context);
        return;
    }
    
    var window = findDebuggerWindow();
    var ary = this.URI.spec.match (/x-jsd:([^:]+)/);
    var exception;

    if (this.loadGroup)
        this.loadGroup.addRequest (this, null);

    if (window && "console" in window && ary)
    {
        try
        {
            window.asyncOpenJSDURL (this, streamListener, context);
            return;
        }
        catch (ex)
        {
            exception = ex;
        }
    }

    var str =
        "<html><head><title>Error</title></head><body>Could not load &lt;<b>" +
        safeHTML(this.URI.spec) + "</b>&gt;<br>";
    
    if (!ary)
    {
        str += "<b>Error parsing uri.</b>";
    }
    else if (exception)
    {
        str += "<b>Internal error: " + safeHTML(exception) + "</b><br><pre>" + 
            safeHTML(exception.stack);
    }
    else
    {
        str += "<b>Debugger is not running.</b>";
    }
    
    str += "</body></html>";
    
    this.respond (str);
}

JSDChannel.prototype.respond =
function jsdch_respond (str)
{
    this.streamListener.onStartRequest (this, this.context);

    var len = str.length;
    this.stringStream.setData (str, len);
    this.streamListener.onDataAvailable (this, this.context,
                                         this.stringStream, 0, len);
    this.streamListener.onStopRequest (this, this.context,
                                       Components.results.NS_OK);
    if (this.loadGroup)
        this.loadGroup.removeRequest (this, null, Components.results.NS_OK);
    this._isPending = false;    
}

/* nsIRequest */
JSDChannel.prototype.isPending =
function jsdch_ispending ()
{
    return this._isPending;
}

JSDChannel.prototype.status = Components.results.NS_OK;

JSDChannel.prototype.cancel =
function jsdch_cancel (status)
{
    if (this._isPending)
    {
        this._isPending = false;
        this.streamListener.onStopRequest (this, this.context, status);
        if (this.loadGroup)
        {
            try
            {
                this.loadGroup.removeRequest (this, null, status);
            }
            catch (ex)
            {
                debug ("we're not in the load group?\n");
            }
        }
    }
    
    this.status = status;
}

JSDChannel.prototype.suspend =
JSDChannel.prototype.resume =
function jsdch_notimpl ()
{
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

/*****************************************************************************/

/* x-application-jsd content handler */
function JSDContentHandler ()
{}

/* nsIClassInfo */
JSDContentHandler.prototype.getInterfaces =
function getInterfaces(aCount)
{
    var interfaces = [Components.interfaces.nsISupports,
                      Components.interfaces.nsIClassInfo,
                      Components.interfaces.nsICommandLineHandler];

    aCount.value = interfaces.length;
    return interfaces;
};

JSDContentHandler.prototype.getHelperForLanguage =
function getHelperForLanguage()
{
    return null;
};

JSDContentHandler.prototype.contractID = JSDCNT_HANDLER_CTRID;
JSDContentHandler.prototype.classDescription = "Venkman x-application-jsd Content Handler";
JSDContentHandler.prototype.classID = JSDCNT_HANDLER_CID;
JSDContentHandler.prototype.implementationLanguage = Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT;
JSDContentHandler.prototype.flags = 0;

JSDContentHandler.prototype.QueryInterface =
function jsdh_qi(iid)
{
    if (!iid.equals(nsIContentHandler) && !iid.equals(nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
}

JSDContentHandler.prototype.handleContent =
function jsdh_handle(contentType, windowTarget, request)
{
    var e;
    var channel = request.QueryInterface(nsIChannel);
    
    // prevent someone from invoking the debugger remotely by serving
    // up any old file with the x-application-jsd content type.
    if (channel.URI.spec != "x-jsd:debugger")
    {
        debug ("Not handling content from unknown location ``" +
               channel.URI.spec + "''");
        return;
    }
    
    var window = findDebuggerWindow()

    if (window)
    {
        window.focus();
    }
    else
    {
        var ass =
            Components.classes[ASS_CONTRACTID].getService(nsIAppShellService);
        window = ass.hiddenDOMWindow;

        var args = new Object();
        args.url = channel.URI.spec;

        openDebuggerWindow(args);
     }
}


// Stay backwards compatible, generate both NSGetFactory/NSGetModule
var components = [CLineService, JSDProtocolHandler, JSDContentHandler];

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.1 and 1.9.2 (Firefox 3.5/3.6).
*/
if ("generateNSGetFactory" in XPCOMUtils)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule(components);
