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
var Bible = MainWindow.Bible;
var mlist = Bible.getModuleList();
if (mlist == "No Modules" || mlist.search(BIBLE)==-1) Bible=null;

if (window.name != "main-window") {
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

if (window.name == "main-window") unlockAllModules(Bible, true);
