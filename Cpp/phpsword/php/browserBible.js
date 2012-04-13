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
	if (EventInProgress) return;
	EventInProgress = true;
	var elem = e.target;
	if (!elem || !elem.className) {EventInProgress = false; return;}
	var type = elem.className.replace(/\-.*$/, "");
	//document.getElementById("test").innerHTML = type + " <> " + elem.title;
	var re = new RegExp("^(fn|cr|sr|dt|dtl|sn)$");
	if (!re.test(type)) {EventInProgress = false; return;}
	PopupEvent = e;
	activatePopup(type, elem.title);
}

function activatePopup(type, data) {
	var html = "";
	if (PopupElement.style.visibility == "visible") {
		html += "<div style=\"margin-bottom:20px;\">";
		html += "<a title=\"popupBackLink\" class=\"popupBackLink\">" + document.getElementById("ui.back").innerHTML + "</a>";
		html += "<div style=\"display:none;\">" + PopupElement.offsetTop + "</div>"; 
		html += "<div style=\"display:none;\">" + PopupElement.innerHTML + "</div>";
		html += "</div>";
		hidePopup(); 
	}
	var res = answerRequest(type, data);
	if (res) {
		PopupElement.innerHTML = html + "<div id=\"innerpup\">" + res + "</div>";
		ShowPopupID = window.setTimeout("showPopup();", POPUPDELAY);
	}
	else EventInProgress = false;
}

function showPopup() {
	var top = Number(PopupEvent.clientY) - 10 + pageYOffset;
	var left = Number(PopupEvent.clientX) - (PopupElement.offsetWidth/2);
	var mp = document.getElementById("mainPage");
	var os = findPos(mp);
	var osm = os[1] + mp.offsetHeight - PopupElement.offsetHeight;
	if (top > osm) top = osm;
	if (top < os[1]) top = os[1];
	if (left < os[0]) left = os[0];
	osm = os[0] + mp.offsetWidth - PopupElement.offsetWidth;
	if (left > osm) left = osm;
	PopupElement.style.top = top + "px";
	PopupElement.style.left = left + "px";
	PopupElement.style.visibility = "visible";
	PopupShadowElement.style.width  = String(PopupElement.offsetWidth) + "px";
	PopupShadowElement.style.left   = String(PopupElement.offsetLeft + 8) + "px";
	PopupShadowElement.style.top    = String(PopupElement.offsetTop + 8) + "px";
	PopupShadowElement.style.height = String(PopupElement.offsetHeight) + "px";
	PopupShadowElement.style.visibility = "visible";
	EventInProgress = false;
}

function hidePopup(e) {
	if (ShowPopupID) window.clearTimeout(ShowPopupID);
	ShowPopupID = null;
	if (e) {
		var mo = e.relatedTarget;
		while (mo) {
			if (mo.id && mo.id == "npopup") return;
			mo = mo.parentNode;
		}
		PopupElement.style.visibility = "hidden";
		PopupShadowElement.style.visibility = "hidden";
	}
}

var RequestData = {};
function answerRequest(type, data) {
	var key = type + data;
	if (RequestData[key]) return RequestData[key];
	switch (type) {
	case "fn":
		var fns = document.getElementById("fnnotes1").innerHTML;
		if (!fns) return "";
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0].substr(fnp[0].indexOf(".")+1) == data) {
				RequestData[key] = fnp[1];
				break;
			}
		}
		break;
	case "cr":
		var fns = document.getElementById("crnotes1").innerHTML;
		if (!fns) return "";
		fns = decodeHTML(fns).split("<nx>");
		for (var i=0; i<fns.length; i++) {
			if (!fns[i]) continue;
			var fnp = fns[i].split("<bg>");
			if (fnp[0].substr(fnp[0].indexOf(".")+1) == data) {
				RequestData[key] = fnp[1];
				completeRequest("reflist", key, fnp[1]);
				break;
			}
		}
		break;
	case "sr":
		RequestData[key] = data;
		completeRequest("reflist", key, data);
		break;
	case "dt":
	case "dtl":
		RequestData[key] = data;
		completeRequest("dictlist", key, data);
		break;
	case "sn":
		RequestData[key] = data;
		completeRequest("stronglist", key, data);
		break;
	}
	
	return RequestData[key];
}

function completeRequest(type, key, list) {
	var req = window.location.pathname + "?rtype=" + type + "&rlist=" + list + "&t=" + Math.random();
	req += "&mod=" + document.getElementById("mod").value;
	req += "&typ=" + document.getElementById("typ").value;
	ajax.open("GET", req, true);	
	ajax.rkey = key;
	ajax.onreadystatechange = function() {
	if (ajax.readyState==4 && ajax.status==200) {
			RequestData[ajax.rkey] = ajax.responseText;
			document.getElementById("innerpup").innerHTML = ajax.responseText;
		}
	}
	ajax.send();
}

function decodeHTML(t) {
	t = t.replace("&amp;", "&", "g");
	t = t.replace("&quot;", "\"", "g");
	t = t.replace("&#039;", "'", "g");
	t = t.replace("&lt;", "<", "g");
	t = t.replace("&gt;", ">", "g");
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

