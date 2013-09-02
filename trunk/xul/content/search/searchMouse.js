/*  This file is part of xulSword.

    Copyright 2013 John Austin (gpl.programs.info@gmail.com)

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

SearchMouse = {

	DblClick: function (e) {

		// Get module this event occurred in
		var mod = window.frameElement.ownerDocument.defaultView.Search.result.translate;
		
		// Get selected text
		var selob = window.getSelection();
		var sel = selob.toString();
		sel = cleanDoubleClickSelection(sel);
		if (!sel || sel.search(/^\s*$/)!=-1) return; //return of nothing or white-space

		// Do a search for selected word in mod. Use cmd_xs_search because 
		// its much faster than cmd_xs_searchForSelection and can be used
		// because our selection is only a single word.
		MainWindow.XulswordController.doCommand("cmd_xs_search", { search:{ mod:mod, searchtext:sel, type:"SearchAnyWord" }});
		
		e.stopPropagation(); // block any higher handlers
	},

	popupOverClasses: /^(dt|dtl|sn)(\-|\s|$)/,
	
	popupOver: function(e) {

		// Bail if another mouse operation is already happening...
		var mainContextMenu = frameElement.ownerDocument.getElementById("contextScriptBox");
		if (mainContextMenu && mainContextMenu.getAttribute("value") == "open") return;
				
		// Filter out events without mousover functionality, but move up the
		// DOM tree to catch mousovers inside interesting elements.
		var elem = e.target;
		var type;
		while(elem) {
			if (elem.id && (/^(npopup)$/).test(elem.id)) break; // don't go higher than certain containers
			if (elem.className) {
				type = elem.className.match(this.popupOverClasses);
				if (type) break;
			}
			elem = elem.parentNode;
		}
		if (!elem || !type) return;
		type = type[1];

		// Get the location of this event
		var w = (NW + 1); // which means search results window
		var cw = elem;
		while(cw && (!cw.id || (!(/^npopup$/).test(cw.id)))) {
			cw = cw.parentNode;
		}
		if (cw && cw.id == "npopup") w = 0; // which means popup window
		
		if (!w) return; // this also excludes Popup which is w==0

		var p = getElementInfo(elem);
		
	//jsdump("type:" + type + " title:" + elem.title + " class:" + elem.className + "\n");
		var okay = false;
		switch (type) {
		case "dt":
		case "dtl":
			okay = Popup.activate(elem, e);
			break;
			
		case "sn":
			if (prefs.getCharPref("Strong's Numbers") == "On") {
				okay = Popup.activate(elem, e);
			}
			break;
		}
		if (!okay) {
			// report the problem for debugging
			if (okay === false) {var t = "w=" + (w !== null ? w:"null") + "\nclass=" + elem.className; for (var m in p) {t += "\n" + m + "=" + (p[m] ? p[m]:"null");} jsdump(t);}
			elem.style.cursor = (okay === false ? "help":"default");
		}
		
		e.stopPropagation(); // block any higher handlers
	},
	
	popupOut: function(e) {if (Popup && Popup.showPopupID) window.clearTimeout(Popup.showPopupID);},
	
	popupClickClasses: /^(sn|dt|dtl|snbut|popupBackLink|popupCloseLink)(\-|\s|$)/,
	
	popupClick: function(e) {
		
		// Only proceed for events with click functionality, but move up the
		// DOM tree to catch clicks inside interesting elements.
		var elem = e.target;
		var type;
		while(elem) {
			if (elem.id && (/^(npopup)$/).test(elem.id)) {
				e.stopPropagation();
				break; // don't go higher than certain containers
			}
			if (elem.className) {
				type = elem.className.match(this.popupClickClasses);
				if (type) break;
			}
			elem = elem.parentNode;
		}
		if (!elem || !type) return;
		type = type[1];
		
		var p = getElementInfo(elem); 

		switch (type) {
			
		case "sn":
			Popup.activate(elem, e);
			break;
			
		case "dt":
		case "dtl":
			Popup.activate(elem, e);
			break;
			
		case "snbut":
			MainWindow.XulswordController.doCommand("cmd_xs_search", { search:{ mod:p.mod, searchtext:"lemma: " + p.ch, type:"SearchAdvanced" }});
			break;
    
		case "popupBackLink":
			Popup.activate(elem, e);
			break;
			
		case "popupCloseLink":
			Popup.close();
			break;
			
		}
		
		e.stopPropagation(); // block any higher handlers
	}

}
