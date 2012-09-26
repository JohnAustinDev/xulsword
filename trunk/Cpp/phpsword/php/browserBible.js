/* 
		This file is part of phpsword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

    phpsword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    phpsword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with phpsword.  If not, see <http://www.gnu.org/licenses/>.
*/

var POPUPDELAY = 300
var PopupElement;
var PopupEvent, InfoElement;
var ShowPopupID;
var EventInProgress;
var Selverse, Selchap, Selbook;
var FSMargin = 40;
var Media = "screen";
var InitDone = false;

var ajax = new XMLHttpRequest();
var FillWin = false;

function init() {
	PopupElement = document.getElementById("npopup");
	InfoElement = document.getElementsByTagName("body")[0];
	Selverse = document.getElementById("selverse");
	Selchap = document.getElementById("selchap");
	Selbook = document.getElementById("selbook");
	Media = document.getElementById("media").getAttribute("value");
	
	if (document.getElementById("flowcolumn") && 
			Media != "handheld" && 
	    !(/flowcol1/).test(document.getElementsByTagName("body")[0].className)) {
		FillWin = {addchaps:[true]};
		
		// allow columns to fill their fixed column height ("balance" is specified in CSS for non-Javascript browsers)
		document.getElementById("flowcolumn").setAttribute("style", "-moz-column-fill:auto; -webkit-column-fill:auto; column-fill:auto;");
	}
	
	resize();
	InitDone = true;
}

function resize() {
	if (FillWin === false) return;
	
	var w = winSize();
	var t = document.getElementById("text");

	// flowcol feature uses fixed column height of browser window.
	document.getElementById("flowcolumn").style.height = Number(w.height - 245) + "px";
	
	// flowcol feature uses full browser width format
	var maxw = Number( w.width - (2*FSMargin) );
	t.style.width = maxw + "px";
	t.style.left = "-" + Math.floor(35 + (t.offsetWidth - 650)/2) + "px";
	
	// should another chapter be added to the resulting browser window?
	if (t.scrollWidth <= t.offsetWidth &&
			FillWin.addchaps[FillWin.addchaps.length-1] && 
			FillWin.addchaps.length < 12) {

		FillWin.addchaps[FillWin.addchaps.length-1] = false; // never allow another addition until and unless this one finishes
		
		// get another chapter to fill the page
		ajax.open("GET", getQuery() + "&rtype=chapter&rlist=" + (FillWin.addchaps.length) + "&rmod=" + document.getElementById("m1").value, true);
		ajax.onreadystatechange = function() {
			if (ajax.responseText != "<none>" && ajax.readyState==4 && ajax.status==200) {
				
				// add new data to page
				var data = ajax.responseText.split("<separator/>");
				document.getElementById("flowcolumn").innerHTML += data[0];
				document.getElementById("fnnotes").innerHTML    += data[1];
				document.getElementById("crnotes").innerHTML    += data[2];
				
				// schedule a new resize to occur AFTER the current addition is already displayed.
				FillWin.addchaps.push(true);
				window.setTimeout("resize();", 1)
			}
		}
		ajax.send();		
	}
	
}

var classes = new RegExp("^(fn|cr|sr|dt|dtl|sn|introlink|infolink)$");
function mouseHandler(e) {
	if (Media == "handheld" && e.type == "mouseover") return;
	if (EventInProgress || !InitDone) return;
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
	if (Media == "handheld") {
		RNF.back += "<a class=\"popupBackLink\" href=\"" + window.location + getQuery() + "\">";
		RNF.back += document.getElementById("ui.back").innerHTML + "</a>";
	}
	else if (PopupElement.style.visibility == "visible") {
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
//var a=""; for (var m in RNF) {a += m + " = " + RNF[m] + ", ";} window.alert(a);	
		if (Media == "handheld") {

		}
		
		PopupElement.innerHTML = RNF.back + RNF.content;
		if (PopupEvent.type == "click") showPopup();
		else ShowPopupID = window.setTimeout("showPopup();", POPUPDELAY);
	}
	else EventInProgress = false;
}

function getMod(e) {
	// get modname either from "mod" element, or from parent node class
	var mod = document.getElementById("m1").value;
	var re = new RegExp("(^| )(text|interV(\\d+))( |$)");
	var el = e.target;
	while(el && (!el.className || el.className.search(re)==-1)) {
		el = el.parentNode;
	}
	if (!el || !el.className) return mod;
	var m = el.className.match(re);
	if (!m || !m[3] || m[3] == 1) return mod;
	return document.getElementById("m" + m[3]).value;	
}

function popupBack(elem) {
	var tmp = elem.nextSibling.innerHTML;
	if (!tmp) tmp = elem.nextSibling.nextSibling.innerHTML;
	(Media != "handheld" ? PopupElement:InfoElement).innerHTML = tmp;
	if (Media != "handheld") showPopup(true);
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
	if (FillWin) txtarea.left = (FSMargin - 40);
	
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
	EventInProgress = false;
	
	if (RNF.doRequest) doRequest(RNF.type, RNF.key, RNF.list, RNF.modName); 
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
      //if (fnp[0] == rnf.modName + "." + rnf.type + "." + rnf.list) {
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
			if (fnp[0] == rnf.type + "." + rnf.list+ "." + rnf.modName) {
      //if (fnp[0] == rnf.modName + "." + rnf.type + "." + rnf.list) {
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
	var req = getQuery();
	req += "&rtype=" + type + "&rlist=" + list + "&rmod=" + modName;
//window.alert(req);
	ajax.open("GET", req, true);
	ajax.rkey = key;
	ajax.onreadystatechange = function() {
	if (ajax.readyState==4 && ajax.status==200) {
			RequestData[ajax.rkey] = ajax.responseText;
//window.alert(ajax.responseText);
			PopupElement.innerHTML = RNF.back + ajax.responseText;
			if (RNF.doRequest) RNF.doRequest = false;
			showPopup(true);
		}
	}
	ajax.send();
}

function getQuery() {
	var ret = window.location.pathname;
	var set = document.getElementById("settings");
	set = set.firstChild;
	var sep = "?";
	while(set) {
		if (set.id) {
			ret += sep + set.id + "=" + set.value;
			sep = "&";
		}
		set = set.nextSibling;
	}
	return ret;
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
		try {var cp = fixedCharCodeAt (t, i);}
		catch (er) {cp = false;}
		if (cp === false) continue;
		if (cp > 127) {
			t = t.substring(0,i) + "_" + cp + "_" + t.substr(i+1);		
		}	
	}
	return t;
}

function fixedCharCodeAt(str, idx) {  
	// ex. fixedCharCodeAt ('\uD800\uDC00', 0); // 65536  
	// ex. fixedCharCodeAt ('\uD800\uDC00', 1); // 65536  
	idx = idx || 0;  
	var code = str.charCodeAt(idx);  
	var hi, low;  
	if (0xD800 <= code && code <= 0xDBFF) { // High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters)  
		hi = code;  
		low = str.charCodeAt(idx+1);  
		if (isNaN(low)) {  
			throw 'High surrogate not followed by low surrogate in fixedCharCodeAt()';  
		}  
		return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;  
	}  
	if (0xDC00 <= code && code <= 0xDFFF) { // Low surrogate  
		// We return false to allow loops to skip this iteration since should have already handled high surrogate above in the previous iteration  
		return false;  
		/*hi = str.charCodeAt(idx-1); 
		low = code; 
		return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;*/  
	}  
	return code;  
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
