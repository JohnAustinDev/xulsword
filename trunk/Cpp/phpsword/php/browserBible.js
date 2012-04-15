var POPUPDELAY = 300
var PopupElement, PopupShadowElement;
var PopupEvent;
var ShowPopupID;
var EventInProgress;

var ajax = new XMLHttpRequest();

function init() {
	PopupElement = document.getElementById("npopup");
	PopupShadowElement = document.getElementById("npopupSH");
}

function mouseHandler(e) {
	if (EventInProgress || !PopupElement) return;
	EventInProgress = true;
	var elem = (e.target ? e.target:e.srcElement);

	if (!elem || !elem.className) {EventInProgress = false; return;}
	var type = elem.className.replace(/\-.*$/, "");
//document.getElementById("test").innerHTML = type + " <> " + elem.id;
	var re = new RegExp("^(fn|cr|sr|dt|dtl|sn)$");
	if (!re.test(type)) {EventInProgress = false; return;}

	// IE can't handle simple PopupEvent = e;
	PopupEvent = {};
	for (var m in e) {PopupEvent[m] = e[m];}
	//var a=""; for (var m in e) {a += m + " = " + e[m] + ", ";} window.alert(a);
	
	activatePopup(type, elem.title);
}

var RNF;
function activatePopup(type, data) {
	RNF = {doRequest:false, content:data, back:"", type:type, key:type + data, list:data};
	
	if (PopupElement.style.visibility == "visible") {
		RNF.back += "<div style=\"margin-bottom:20px;\">";
		RNF.back += "<a class=\"popupBackLink\" onclick=\"popupBack(this)\">";
		RNF.back += document.getElementById("ui.back").innerHTML + "</a>";
		RNF.back += "<div style=\"display:none;\">" + PopupElement.innerHTML + "</div>";
		RNF.back += "</div>";
		hidePopup(null, true);
	}
	
	getContent(RNF);

	if (RNF.content) {
//window.alert(RNF.back);
		PopupElement.innerHTML = RNF.back + RNF.content;
		if (PopupEvent.type == "click") showPopup();
		else ShowPopupID = window.setTimeout("showPopup();", POPUPDELAY);
	}
	else EventInProgress = false;
}

function popupBack(elem) {
	var tmp = elem.nextSibling.innerHTML;
	PopupElement.innerHTML = tmp;
	shadowPup();
}

function showPopup() {
	var mp = document.getElementById("mainPage");
	var os = findPos(mp);
	var top;
	if (typeof(pageYOffset) != "undefined")
		top = pageYOffset + PopupEvent.clientY - (PopupEvent.type=="click" ? PopupElement.offsetHeight/2:10);
	else 
		top = os[1] + PopupEvent.y - (PopupEvent.type=="click" ? PopupElement.offsetHeight/2:10);

	var left = Number(PopupEvent.clientX) - (PopupElement.offsetWidth/2);
	var osm = os[1] + mp.offsetHeight - PopupElement.offsetHeight;
	if (top > osm) top = osm;
	if (top < os[1]) top = os[1];
	if (left < os[0]) left = os[0];
	osm = os[0] + mp.offsetWidth - PopupElement.offsetWidth;
	if (left > osm) left = osm;
	PopupElement.style.top = top + "px";
	PopupElement.style.left = left + "px";
	PopupElement.style.visibility = "visible";
	shadowPup();
	PopupShadowElement.style.visibility = "visible";
	EventInProgress = false;
	if (RNF.doRequest) doRequest(RNF.type, RNF.key, RNF.list); 
}

function shadowPup() {
	PopupShadowElement.style.width  = String(PopupElement.offsetWidth) + "px";
	PopupShadowElement.style.left   = String(PopupElement.offsetLeft + 8) + "px";
	PopupShadowElement.style.top    = String(PopupElement.offsetTop + 8) + "px";
	PopupShadowElement.style.height = String(PopupElement.offsetHeight) + "px";	
}

function hidePopup(e, keepInProgress) {
	//if (PopupEvent.type == "click" && EventInProgress) {return;} // for goofy IE
	if (ShowPopupID) window.clearTimeout(ShowPopupID);
	ShowPopupID = null;
	if (!keepInProgress) {
		EventInProgress = false;
		if (e) {
			var mo = (e.relatedTarget ? e.relatedTarget:e.toElement);
			while (mo) {
				if (mo.id && mo.id == "npopup") return;
				mo = mo.parentNode;
			}
		}
	}
	if (PopupElement && PopupElement.style.visibility == "visible") {
		if (ajax.readyState!=4 || ajax.status!=200) ajax.abort();
		PopupElement.style.visibility = "hidden";
		PopupShadowElement.style.visibility = "hidden";
	}
}

var RequestData = {};
function getContent(rnf) {
	if (RequestData[rnf.key]) {
		rnf.content = RequestData[rnf.key];
		return;
	}
	switch (rnf.type) {
	case "fn":
		var fns = document.getElementById("fnnotes1").innerHTML;
		if (!fns) {rnf.content = ""; return;}
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0].substr(fnp[0].indexOf(".")+1) == rnf.list) {
				RequestData[rnf.key] = fnp[1];
				rnf.content = fnp[1];
				break;
			}
		}
		break;
	case "cr":
		var fns = document.getElementById("crnotes1").innerHTML;
		if (!fns) {rnf.content = ""; return;}
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0].substr(fnp[0].indexOf(".")+1) == rnf.list) {
				rnf.doRequest = true;
				rnf.type = "reflist";
				rnf.list = fnp[1];
				rnf.content = fnp[1];
				break;
			}
		}
		break;
	case "sr":
		rnf.doRequest = true;
		rnf.type = "reflist";
		break;
	case "dt":
	case "dtl":
		rnf.doRequest = true;
		rnf.type = "dictlist";
		rnf.list = encodeutf8(rnf.list); // IE doesn't transmit utf8!
		break;
	case "sn":
		rnf.doRequest = true;
		var elem = (PopupEvent.target ? PopupEvent.target:PopupEvent.srcElement);
		rnf.content = elem.innerHTML + "." + rnf.list;
		rnf.list = encodeutf8(rnf.content);
		rnf.type = "stronglist";
		break;
	}
	return;
}

function doRequest(type, key, list) {
	var req = window.location.pathname + "?rtype=" + type + "&rlist=" + list;
	req += "&mod=" + document.getElementById("mod").value;
	req += "&typ=" + document.getElementById("typ").value;
	ajax.open("GET", req, true);
	ajax.rkey = key;
	ajax.onreadystatechange = function() {
	if (ajax.readyState==4 && ajax.status==200) {
			RequestData[ajax.rkey] = ajax.responseText;
			PopupElement.innerHTML = RNF.back + ajax.responseText;
			shadowPup();
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

function findPos(obj) {
	var curleft = curtop = 0;
	if (obj.offsetParent) {
	do {
		curleft += obj.offsetLeft;
		curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
	}
	return [curleft,curtop];
}

function encodeutf8(t) {
	for (var i=0; i<t.length; i++) {
		if (t.charCodeAt(i) > 255) {
			t = t.substring(0,i) + "_" + t.charCodeAt(i) + "_" + t.substr(i+1);		
		}	
	}
	return t;
}