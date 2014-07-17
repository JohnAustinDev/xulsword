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

var UserObj = window.arguments[0];
var Title = window.arguments[1];
var Label = window.arguments[2];
var Type = window.arguments[3];
var OnCancel = window.arguments[4];
var OnUnload = window.arguments[5];
  
var Progress, LabelElem, ButtonElem;

// workProgress.xul can be displayed before the XS_window, so
// program-wide globals CANNOT be assumed to be defined!
function Load() {

  document.title = fixWindowTitle(Title);
  
  UserObj.ok=false;

  Progress = document.getElementById("progress");
  LabelElem = document.getElementById("label");
  ButtonElem = document.getElementById("stop");

  switch (Type) {
  case PMNORMAL:
    break;
  case PMSTOP:
    ButtonElem.setAttribute("hidden", "false");
    break;
  }
  
  LabelElem.setAttribute("label", Label);

  window.setTimeout(function () {sizeToContent();}, 1);
  window.setTimeout(function () {finishedLoading();}, 1);
  
  if (UserObj.afterload) window.setTimeout(function () {UserObj.afterload();}, 1);
}

function finishedLoading() {
  try {window.opener.setProgressMeterLoaded();}
  catch (er) {}
}

function cancel() {
  if (OnCancel) OnCancel();
  closeWindowXS(window);
}
