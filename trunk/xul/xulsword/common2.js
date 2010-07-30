/*  This file is part of xulSword.

    Copyright 2009 John Austin (gpl.programs.info@gmail.com)

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


/************************************************************************
 * Retrieve some common globals from the Main Window for use locally 
 ***********************************************************************/ 
if (window.name != "main-window") {
  switch (UseBibleObjectFrom) {
  case "BMManagerBible":
    Bible               = MainWindow.BMManagerBible;
    //jsdump(window.name + " is using MainWindow.BMManagerBible...\n");
    break;
  
  case "none":
    Bible               = null;
    //jsdump(window.name + " is using null Bible...\n");
    break;
    
  case "GetSearchBible":
    var MySearchBible = {bible: null, index: null};
    for (var i=0; i<MainWindow.SearchBibles.length; i++) {
      if (!MainWindow.SearchBiblesOut[i] && MainWindow.SearchBibles[i]) {
        MySearchBible = {bible: MainWindow.SearchBibles[i], index: i};
        MainWindow.SearchBiblesOut[i] = true;
      }
    }
    Bible               = MySearchBible.bible;
    //jsdump(window.name + " is using SearchBible #" + MySearchBible.index + "...\n");
    break;
    
  case "MainWindowBible":
    Bible               = MainWindow.Bible;
    //jsdump(window.name + " is using MainWindow Bible...\n");
    break;
    
  case "Opener":
    Bible               = window.opener.Bible;
    //jsdump(window.name + " is using Bible of window.opener...\n");
    break;
  }

  LocaleConfigs         = MainWindow.LocaleConfigs;
  VersionConfigs        = MainWindow.VersionConfigs;
  StyleRules            = MainWindow.StyleRules;
  LocaleDirectionEntity = MainWindow.LocaleDirectionEntity;
  LocaleDirectionChar   = MainWindow.LocaleDirectionChar
  
  Book                  = MainWindow.Book;
  OrigModuleNT          = MainWindow.OrigModuleNT;
  OrigModuleOT          = MainWindow.OrigModuleOT;

  Tabs                  = MainWindow.Tabs;
  Tab                   = MainWindow.Tab;

  LocaleList            = MainWindow.LocaleList;
  LocaleDefaultVersion  = MainWindow.LocaleDefaultVersion;
}

if (!UseBibleObjectFrom) unlockAllModules(Bible, window.name == "main-window");
