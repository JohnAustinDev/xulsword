var POPUPDELAY = 300
var PopupElement, PopupShadowElement;
var PopupEvent;
var ShowPopupID;
var EventInProgress;
var Selverse, Selchap, Selbook;

var ajax = new XMLHttpRequest();

function init() {
	PopupElement = document.getElementById("npopup");
	PopupShadowElement = document.getElementById("npopupSH");
	Selverse = document.getElementById("selverse");
	Selchap = document.getElementById("selchap");
	Selbook = document.getElementById("selbook");
}

var classes = new RegExp("^(fn|cr|sr|dt|dtl|sn|introlink|infolink)$");
function mouseHandler(e) {
	if (EventInProgress || !PopupElement) return;
	EventInProgress = true;
	
	var elem = (e.target ? e.target:e.srcElement);

	var type = null;
	while (elem && (!elem.className || elem.className != "script")) {
		if (elem.className) {
			type = elem.className.replace(/\-.*$/, "");
			if (classes.test(type)) break;
		}
		elem = elem.parentNode;
	}
	 
	if (!elem || !classes.test(type)) {EventInProgress = false; return;}
//window.alert("type=" + type + ", elem.id=" + elem.id);

	// IE can't handle simple PopupEvent = e;
	if (PopupEvent && PopupEvent.savedTitle) PopupEvent.target.title = PopupEvent.savedTitle;
	PopupEvent = {};
	for (var m in e) {PopupEvent[m] = e[m];}
	PopupEvent.target = elem;
//var a=""; for (var m in e.srcElement) {a += m + " = " + e.srcElement[m] + ", ";} document.getElementById("test").innerHTML = a; //window.alert(a);

	if (PopupEvent.target.title) {
		PopupEvent.savedTitle = PopupEvent.target.title;
		 // remove bothersome tool tips that cause popup to close if touched
		if (PopupEvent.type == "mouseover") PopupEvent.target.title = "";
	}
	
	activatePopup(type, PopupEvent.savedTitle);
}

var RNF;
function activatePopup(type, title) {
	var mod = getMod(PopupEvent);
	RNF = {doRequest:false, content:title, back:"", type:type, key:mod + "." + type + "." + title, list:title, modName:mod};
//var a=""; for (var m in RNF) {a += m + " = " + RNF[m] + ", ";} window.alert(a);	
	RNF.back += "<div style=\"margin-bottom:20px;\">";
	if (PopupElement.style.visibility == "visible") {
		RNF.back += "<a class=\"popupBackLink\" onclick=\"popupBack(this)\">";
		RNF.back += document.getElementById("ui.back").innerHTML + "</a>";
		RNF.back += "<div style=\"display:none;\">" + PopupElement.innerHTML + "</div>";
		hidePopup(null, true);
	}
	else {
		RNF.back += "<a class=\"popupBackLink\" onclick=\"hidePopup(null, null)\">";
		RNF.back += document.getElementById("ui.close").innerHTML + "</a>";
	}
	RNF.back += "</div>";
	
	getContent(RNF);

	if (RNF.content) {
//window.alert(RNF.content);
		PopupElement.innerHTML = RNF.back + RNF.content;
		if (PopupEvent.type == "click") showPopup();
		else ShowPopupID = window.setTimeout("showPopup();", POPUPDELAY);
	}
	else EventInProgress = false;
}

function getMod(e) {
	// get modname either from "mod" element, or from parent node class
	var mod = document.getElementById("mod").value;
	var re = new RegExp("(^| )(text|interV(\\d+))( |$)");
	var el = e.target;
	while(el && (!el.className || el.className.search(re)==-1)) {
		el = el.parentNode;
	}
	if (!el || !el.className) return mod;
	var m = el.className.match(re);
	if (!m || !m[3] || m[3] == 1) return mod;
	return document.getElementById("mod2").value;	
}

function popupBack(elem) {
	var tmp = elem.nextSibling.innerHTML;
	if (!tmp) tmp = elem.nextSibling.nextSibling.innerHTML;
	PopupElement.innerHTML = tmp;
	showPopup(true);
}

function showPopup(keepPos) {
	var win = winSize();
	var pupclick = PopupEvent.type=="click" && RNF.type.search("link") == -1;
	
	var top, left;
	if (!keepPos) {
		top = PopupEvent.clientY - (pupclick ? PopupElement.offsetHeight/2:10);
		left = (pupclick ? PopupElement.offsetLeft:PopupEvent.clientX - (PopupElement.offsetWidth/2));
	}
	else {
		top = PopupElement.offsetTop;
		left = PopupElement.offsetLeft;
	}
	
	var txtarea = findPos(document.getElementById("pagebox"));
	
	var maxY = win.height-10;
	var minY = 0;
	var maxX = win.width-20;
	var minX = txtarea.left+20;

	if (top + PopupElement.offsetHeight > maxY) top = maxY - PopupElement.offsetHeight;
	if (top < minY) top = minY;

	if (left + PopupElement.offsetWidth > maxX) left = maxX - PopupElement.offsetWidth;
	if (left < minX) left = minX;	
	
	PopupElement.style.top = top + "px";
	PopupElement.style.left = left + "px";
	PopupElement.style.visibility = "visible";
	shadowPup();
	PopupShadowElement.style.visibility = "visible";
	EventInProgress = false;
	
	if (RNF.doRequest) doRequest(RNF.type, RNF.key, RNF.list, RNF.modName); 
}

function shadowPup() {
	PopupShadowElement.style.width  = String(PopupElement.offsetWidth) + "px";
	PopupShadowElement.style.left   = String(PopupElement.offsetLeft + 8) + "px";
	PopupShadowElement.style.top    = String(PopupElement.offsetTop + 8) + "px";
	PopupShadowElement.style.height = String(PopupElement.offsetHeight) + "px";	
}

function hidePopup(e, keepInProgress) {
//document.getElementById("test").innerHTML = (e.srcElement && e.srcElement.id ? e.srcElement.id:"NOPE");
	if (ShowPopupID) window.clearTimeout(ShowPopupID);
	ShowPopupID = null;
	if (!keepInProgress) {
		EventInProgress = false;
		if (e && onPopup(e)) return;
	}
	if (PopupElement && PopupElement.style.visibility == "visible") {
		if (ajax.readyState!=4 || ajax.status!=200) ajax.abort();
		PopupElement.style.visibility = "hidden";
		PopupShadowElement.style.visibility = "hidden";
	}
}

function onPopup(e) {
	var mo = (e.relatedTarget ? e.relatedTarget:e.toElement);
	while (mo) {
		if (mo.id && mo.id == "npopup") return true;;
		mo = mo.parentNode;	
	}
	return false;
}

var RequestData = {};
var loading = "<div class='loading'></div>";
function getContent(rnf) {
	if (RequestData[rnf.key]) {
		rnf.content = RequestData[rnf.key];
		return;
	}
	switch (rnf.type) {
	case "fn":
		var fns = document.getElementById("fnnotes").innerHTML;
		if (!fns) {rnf.content = ""; return;}
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0] == rnf.type + "." + rnf.list + "." + rnf.modName) {
				RequestData[rnf.key] = fnp[1];
				rnf.content = fnp[1];
				break;
			}
		}
		break;
	case "cr":
		var fns = document.getElementById("crnotes").innerHTML;
		if (!fns) {rnf.content = ""; return;}
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0] == rnf.type + "." + rnf.list + "." + rnf.modName) {
				rnf.doRequest = true;
				rnf.type = "reflist";
				rnf.list = fnp[1];
				rnf.content = fnp[1];
				rnf.content += loading;
				break;
			}
		}
		break;
	case "sr":
		rnf.doRequest = true;
		rnf.type = "reflist";
		rnf.content += loading;
		break;
	case "dt":
	case "dtl":
		rnf.doRequest = true;
		rnf.type = "dictlist";
		rnf.list = encodeutf8(rnf.list); // IE doesn't transmit utf8!
		rnf.content += loading;
		break;
	case "sn":
		rnf.doRequest = true;
		var elem = PopupEvent.target;
		rnf.content = elem.innerHTML + "." + rnf.list;
		rnf.list = encodeutf8(rnf.content);
		rnf.type = "stronglist";
		rnf.content += loading;
		break;
	case "introlink":
		RequestData[rnf.key] = document.getElementById("bkintro." + rnf.modName).innerHTML;
		rnf.content = RequestData[rnf.key];
		break;
	case "infolink":
		RequestData[rnf.key] = document.getElementById("modinfo." + rnf.modName).innerHTML;
		rnf.content = RequestData[rnf.key];
		break;
	}
	return;
}

function doRequest(type, key, list, modName) {
	var req = window.location.pathname;
	var set = document.getElementById("settings");
	set = set.firstChild;
	var sep = "?";
	while(set) {
		if (set.id) {
			req += sep + set.id + "=" + set.value;
			sep = "&";
		}
		set = set.nextSibling;
	}
	req += "&rtype=" + type + "&rlist=" + list + "&rmod=" + modName;
//window.alert(req);
	ajax.open("GET", req, true);
	ajax.rkey = key;
	ajax.onreadystatechange = function() {
	if (ajax.readyState==4 && ajax.status==200) {
			RequestData[ajax.rkey] = ajax.responseText;
			PopupElement.innerHTML = RNF.back + ajax.responseText;
			if (RNF.doRequest) RNF.doRequest = false;
			showPopup(true);
		}
	}
	ajax.send();
}

function decodeHTML(t) {
	t = t.replace(/&amp;/g, "&");
	t = t.replace(/&quot;/g, "\"");
	t = t.replace(/&#039;/g, "'");
	t = t.replace(/&lt;/g, "<");
	t = t.replace(/&gt;/g, ">");
	return t;
}

function winSize() {
	var winW = 630, winH = 460;
	if (document.body && document.body.offsetWidth) {
	 winW = document.body.offsetWidth;
	 winH = document.body.offsetHeight;
	}
	if (document.compatMode=='CSS1Compat' &&
	    document.documentElement &&
	    document.documentElement.offsetWidth ) {
	 winW = document.documentElement.offsetWidth;
	 winH = document.documentElement.offsetHeight;
	}
	if (window.innerWidth && window.innerHeight) {
	 winW = window.innerWidth;
	 winH = window.innerHeight;
	}
	
	return {width:winW, height:winH};
}

function encodeutf8(t) {
	for (var i=0; i<t.length; i++) {
		if (t.charCodeAt(i) > 255) {
			t = t.substring(0,i) + "_" + t.charCodeAt(i) + "_" + t.substr(i+1);		
		}	
	}
	return t;
}

function resetloc(elem) {
	if (elem.id == "selbook") {
		Selchap.value = 1;
		Selverse.value = 1;
	}
	else if (elem.id == "selchap") 
		Selverse.value = 1;
}

function findPos(obj) {
	var curleft, curtop;
	curleft = curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	}
	return {left:curleft, top:curtop};
}
