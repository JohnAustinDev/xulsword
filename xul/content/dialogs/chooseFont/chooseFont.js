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

chooseFont = {
	toUpdate: ["fontFamily", "fontSize", "lineHeight", "color", "background"],
	
	modName: null,
	start: {},
	
	chooseMod: function() {return document.getElementById("chooseMod");},
	
	loaded: function() {
		initCSS();
		
		if (CommandTarget.mod) this.chooseMod().version = CommandTarget.mod;
		
		this.modName = this.chooseMod().version;
		
		for (var i=0; i<this.toUpdate.length; i++) {
			this.start[this.toUpdate[i]] = ModuleConfigs[this.modName][this.toUpdate[i]];
		}
		
		var loc = LibSword.getModuleInformation(this.modName, "Lang");
		loc = (loc != NOTFOUND ? loc:"en-US");
		
		var menulist = document.getElementById("fontFamily");
		FontBuilder.buildFontList(loc, this.start["fontFamily"], menulist);
		
		if (menulist.selectedIndex == -1) {
			menulist.insertItemAt(0, "", "", "");
			menulist.selectedIndex = 0;
		}
		
		for (var i=0; i<this.toUpdate.length; i++) {
			var val = this.start[this.toUpdate[i]];
			
			switch(this.toUpdate[i]) {
			case "fontFamily":
				val = val.replace(/(^'|'$)/g, "");
			case "fontSize":
			case "lineHeight":
				if (val == "unspecified") val = "1em";
				document.getElementById(this.toUpdate[i]).value = val;
				break;
			case "color":
			case "background":
				if (val == "unspecified") continue;
				document.getElementById(this.toUpdate[i]).color = val;
				break;
			}
		}

		window.sizeToContent();
		
//jsdump(this.modName + ", " + uneval(this.start));
	},
	
	update: function(e) {
		if (!this.modName) return;
		
		var dl = "";
		var val;
		
		switch (e.target.id) {
		case "fontFamily":
			dl = "'";
		case "fontSize":
		case "lineHeight":
			if (e.target.selectedIndex == -1) return;
			val = e.target.selectedItem.value;
			break;
		case "color":
		case "background":
			val = e.target.color;
			break;
		}

		ModuleConfigs[this.modName][e.target.id] = dl + val + dl;
		this.updatePreview();
	},
	
	updatePreview: function() {
		if (!window.opener || !window.opener.ViewPort) return;
		
		ModuleConfigs[this.modName].StyleRule = createStyleRule(".cs-" + this.modName, ModuleConfigs[this.modName]);
		ModuleConfigs[this.modName].TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(m" + this.modName + ")", ModuleConfigs[this.modName]);
		window.opener.ViewPort.ownerDocument.defaultView.initCSS();
	},
	
	buttonHandler: function(button) {
		switch (button) {
		case "makeDefault":
			if (document.getElementById('makeDefault').checked) 
					this.chooseMod().setAttribute("disabled", "true");
			else this.chooseMod().removeAttribute("disabled");
			return;
			break;
		case "ok":
			// save user choices permanently in user prefs
			var targ = (document.getElementById("makeDefault").checked ? "default":this.modName);
			for (var i=0; i<this.toUpdate.length; i++) {
				if (ModuleConfigs[this.modName][this.toUpdate[i]]) {
					prefs.setCharPref("user." + this.toUpdate[i] + "." + targ, ModuleConfigs[this.modName][this.toUpdate[i]]);
					if (targ == "default") prefs.clearUserPref("user." + this.toUpdate[i] + "." + this.modName);
				}
			}
			break;
		}
		
		// reset ModuleConfigs
		ModuleConfigDefaultCSS = getModuleConfigDefaultCSS();
		for (var i=0; i<Tabs.length; i++) {
			ModuleConfigs[Tabs[i].modName] = getModuleConfig(Tabs[i].modName);
		}
		
		if (button == "ok") {
			// update all windows with new CSS
			for (var i=0; i<AllWindows.length; i++) {
				if (!AllWindows[i]) continue;
				if (AllWindows[i].initCSS) AllWindows[i].initCSS();
				if (AllWindows[i].ViewPort) AllWindows[i].ViewPort.ownerDocument.defaultView.initCSS();
			}
		}
		else window.opener.ViewPort.ownerDocument.defaultView.initCSS();

		window.close();
	}
	
};

function onRefUserUpdate(e, location, version) {chooseFont.modName = version;}
