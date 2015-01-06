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
  modInitial: null,
  newSelections: {},
  
  init: function() {
    initCSS();
    
    if (CommandTarget.mod) document.getElementById("chooseMod").version = CommandTarget.mod;
    
    this.modName = document.getElementById("chooseMod").version;
    
    this.setSelections();

    window.sizeToContent();
    
//jsdump(this.modName + ", " + uneval(this.start));
  },
  
  setSelections: function() {
    if (!this.newSelections.hasOwnProperty(this.modName)) {
      this.newSelections[this.modName] = {};
    }
    
    this.modInitial = {};
    for (var i=0; i<this.toUpdate.length; i++) {
      this.modInitial[this.toUpdate[i]] = ModuleConfigs[this.modName][this.toUpdate[i]];
    }
    
    var loc = LibSword.getModuleInformation(this.modName, "Lang");
    loc = (loc != NOTFOUND ? loc:DEFAULTLOCALE);
    
    var menulist = document.getElementById("fontFamily");
    FontBuilder.buildFontList(loc, this.modInitial["fontFamily"], menulist);
    
    // add dynamic fonts to the list as well
    for (var ff in FontFaceConfigs) {
      if (!(/string/i).test(typeof(FontFaceConfigs[ff]))) continue;
      if (!foption) menulist.firstChild.insertBefore(document.createElement("menuseparator"), menulist.firstChild.firstChild);
      var foption = document.createElement("menuitem");
      foption.setAttribute("label", ((/^file\:/i).test(FontFaceConfigs[ff]) ? ff:FontFaceConfigs[ff]));
      foption.setAttribute("value", ff);
      if (FontFaceConfigs.hasOwnProperty("disabled") && FontFaceConfigs.disabled.hasOwnProperty(ff)) {
        foption.setAttribute("disabled", FontFaceConfigs.disabled[ff]);
      }
      menulist.firstChild.insertBefore(foption, menulist.firstChild.firstChild);
    }
    
    if (menulist.selectedIndex == -1) {
      menulist.insertItemAt(0, "", "", "");
      menulist.selectedIndex = 0;
    }
    
    for (var i=0; i<this.toUpdate.length; i++) {
      var val = this.modInitial[this.toUpdate[i]];
      
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
  },
  
  update: function(e) {
    if (!this.modName) return; // update could be called before init?
    
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
    
    this.newSelections[this.modName][e.target.id] = ModuleConfigs[this.modName][e.target.id];
  },
  
  updatePreview: function() {
    if (!window.opener || !window.opener.ViewPort) return;
    
    ModuleConfigs[this.modName].StyleRule = createStyleRule(".cs-" + this.modName, ModuleConfigs[this.modName]);
    ModuleConfigs[this.modName].TreeStyleRule = createStyleRule("treechildren::-moz-tree-cell-text(m" + this.modName + ")", ModuleConfigs[this.modName]);

    window.opener.ViewPort.ownerDocument.defaultView.initCSS();
  },
  
  resetModuleConfigs: function() {
    // resets all global ModuleConfigs from current user prefs
    XS_window.ModuleConfigDefault = getModuleConfig("LTR_DEFAULT");
    for (var i=0; i<Tabs.length; i++) {
      ModuleConfigs[Tabs[i].modName] = getModuleConfig(Tabs[i].modName);
    }
  },
  
  closed: false,
  
  exit: function(button) {
    if (this.closed) return;
    
    if (button == "ok" && document.getElementById("restoreAllDefaults").checked) {
      var result = {};
      var dlg = window.openDialog("chrome://xulsword/content/dialogs/dialog/dialog.xul", "dlg", DLGSTD, result, 
          fixWindowTitle(getDataUI("restoreAllDefaults.label")),
          getDataUI("deleteconfirm.title"), 
          DLGQUEST,
          DLGYESNO);
      if (!result.ok) {
        document.getElementById("restoreAllDefaults").checked = false;
        return;
      }
    }
    
    this.resetModuleConfigs();
    
    if (button == "ok") {

      for (var mod in this.newSelections) {
        for (var i=0; i<this.toUpdate.length; i++) {
          if (!this.newSelections[mod].hasOwnProperty(this.toUpdate[i]) || 
              this.newSelections[mod][this.toUpdate[i]] == ModuleConfigs[this.modName][this.toUpdate[i]]) {
            continue;
          }
          prefs.setCharPref("user." + this.toUpdate[i] + "." + mod, this.newSelections[mod][this.toUpdate[i]]);
        }
      }

      if (document.getElementById("makeDefault").checked) {
        for (var i=0; i<this.toUpdate.length; i++) {
          var val = this.modInitial[this.toUpdate[i]];
          if (this.newSelections[this.modName].hasOwnProperty(this.toUpdate[i])) {
            val = this.newSelections[this.modName][this.toUpdate[i]];
          }
          prefs.setCharPref("user." + this.toUpdate[i] + ".default", val);
          prefs.clearUserPref("user." + this.toUpdate[i] + "." + this.modName);
        }
      }
      
      if (document.getElementById("restoreDefault").checked) {
        for (var i=0; i<this.toUpdate.length; i++) {
          prefs.clearUserPref("user." + this.toUpdate[i] + "." + this.modName);
        }
      }
      
      if (document.getElementById("restoreAllDefaults").checked) {
        for (var i=0; i<this.toUpdate.length; i++) {
          prefs.clearUserPref("user." + this.toUpdate[i] + ".default");
          for (var j=0; j<Tabs.length; j++) {
            prefs.clearUserPref("user." + this.toUpdate[i] + "." + Tabs[j].modName);
          }
        }
      }
      
      this.resetModuleConfigs(); // applies updated pref settings to ModuleConfigs
    }
    
    if (window.opener && window.opener.ViewPort)
        window.opener.ViewPort.ownerDocument.defaultView.initCSS();
    
    if (button == "ok") {
      for (var i=0; i<AllWindows.length; i++) {
        if (AllWindows[i] == window) continue;
        try {
          AllWindows[i].initCSS();
          AllWindows[i].ViewPort.ownerDocument.defaultView.initCSS();
        }
        catch (er) {}
      }
    }

    this.closed = true;
    closeWindowXS(window);
  }
  
};

function onRefUserUpdate(e, location, version) {
  //chooseFont.resetModuleConfigs(); // allow multiple mod changes?
  //chooserFont.newSelections = {};
  //window.opener.ViewPort.ownerDocument.defaultView.initCSS();
  chooseFont.modName = version;
  chooseFont.setSelections();
}
