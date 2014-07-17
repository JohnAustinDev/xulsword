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

function loaded() {
  var bid = prefs.getCharPref("BuildID");
  if (LibSword && !LibSword.loadFailed) bid += LibSword.LibswordPath.match(/libxulsword\-(.*?)\.[^\.]+$/)[1];
  document.getElementById("info").value = XSBundle.getFormattedString('Version', [prefs.getCharPref("Version"), bid]);

  try {var contribs = prefs.getCharPref("ContributorList");}
  catch (er) {}
  if (contribs) {
    contribs = contribs.split("\n");
    for (var i=0; i<contribs.length; i++) {
      if (!contribs[i]) contribs[i] = " ";
      var label = document.createElement("label");
      label.setAttribute("value", contribs[i]);
      document.getElementById("contributorList").appendChild(label);
    }
    document.getElementById("show-contributors-button").removeAttribute("hidden");
  }
  window.sizeToContent();
}

var ContribScroll;
var ContribScrollTop = 9999;
function showContributors() {
  document.getElementById('mainbox').setAttribute('showingContributors', 'true'); 
  ContribScroll = window.setInterval(function () {scrollContributors();}, 50);
}

function scrollContributors() {
  var box = document.getElementById("contributors");
  var list = document.getElementById("contributorList");
  if (ContribScrollTop > box.boxObject.height + list.boxObject.height - (2*255)) ContribScrollTop = 0;
  ContribScrollTop += 1;
  box.scrollTop = ContribScrollTop;
}
