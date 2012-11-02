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
 * Globals defined in MainWindow to be re-used everywhere else
 ***********************************************************************/ 
var Bible                 = MainWindow.Bible;
var Location              = MainWindow.Location;

var LocaleConfigs         = MainWindow.LocaleConfigs;
var VersionConfigs        = MainWindow.VersionConfigs;

var Book                  = MainWindow.Book;
var OrigModuleNT          = MainWindow.OrigModuleNT;
var OrigModuleOT          = MainWindow.OrigModuleOT;

var Tabs                  = MainWindow.Tabs;
var Tab                   = MainWindow.Tab;
var HaveOriginalTab       = MainWindow.HaveOriginalTab;

var LocaleList            = MainWindow.LocaleList;
var LocaleDefaultVersion  = MainWindow.LocaleDefaultVersion;

var BM                    = MainWindow.BM;
var BMDS                  = MainWindow.BMDS;
var BookmarkFuns          = MainWindow.BookmarkFuns;

var AllWindows            = MainWindow.AllWindows;

var LanguageStudyModules  = MainWindow.LanguageStudyModules;

// defined in viewport.html but used globally
if (typeof(ViewPort) == "undefined")
    var ViewPort          = MainWindow.ViewPort;
if (typeof(Texts) == "undefined")
    var Texts             = MainWindow.Texts;
if (typeof(BibleTexts) == "undefined")
    var BibleTexts        = MainWindow.BibleTexts;
if (typeof(DictTexts) == "undefined")
  var DictTexts           = MainWindow.DictTexts;
if (typeof(GenBookTexts) == "undefined")
  var GenBookTexts        = MainWindow.GenBookTexts;
if (typeof(CommTexts) == "undefined")
  var CommTexts           = MainWindow.CommTexts;

