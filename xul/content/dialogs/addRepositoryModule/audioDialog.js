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

var data = window.arguments[0];

var bookList, chapterList, lastChapterList;

function onLoad() {
  initCSS();

  document.title = fixWindowTitle(getDataUI("menu.importAudio.label"));

  bookList = document.getElementById("book");
  chapterList = document.getElementById("chapter");
  lastChapterList = document.getElementById("lastChapter");
  
  // create book elements
  for (var b=0; b<Book.length; b++) {
    for (var c=0; c<data.audio.length; c++) {if (data.audio[c].bk == Book[b].sName) {break;}}
    if (c == data.audio.length) continue;
    bookList.appendItem(Book[b].bNameL, Book[b].sName);
  }
  
  // create chapter elements, all hidden
  for (var c=1; c<=150; c++) {
    var item = chapterList.appendItem(dString(c), c);
    if (c > 1) item.setAttribute("hidden", "true");
    
    item = lastChapterList.appendItem(dString(c), c);
    if (c > 1) item.setAttribute("hidden", "true");
  }
  
  // select a book to update dialog
  if (bookList.selectedIndex == 0) updateChapterList(null);
  else bookList.selectedIndex = 0;
}

function updateChapterList(e) {
  for (var c=1; c<150; c++) {
    var item = chapterList.getItemAtIndex(c-1);
    item.setAttribute("hidden", "true");
  }
  
  // make available chapters visible
  var firstCh = null;
  var bk = bookList.selectedItem.value;
  for (var d=0; d<data.audio.length; d++) {
    if (data.audio[d].bk != bk) continue;
    for (var c=data.audio[d].ch1; c<=data.audio[d].ch2; c++) {
      if (firstCh === null) firstCh = c;
      item = chapterList.getItemAtIndex(c-1);
      item.removeAttribute("hidden");
    }
  }
  
  // select first option
  if (firstCh !== null) {
    if (chapterList.selectedIndex == (firstCh-1)) updateLastChapterList(null);
    else chapterList.selectedIndex = (firstCh-1); 
  }
  else chapterList.selectedIndex = -1;
}

function updateLastChapterList(e) {
  for (var c=1; c<150; c++) {
    var item = lastChapterList.getItemAtIndex(c-1);
    item.setAttribute("hidden", "true");
  }
  
  // make available chapters visible
  var ch = chapterList.selectedIndex + 1;
  if (ch == 0) ch = 1;
  var firstCh = null;
  var bk = bookList.selectedItem.value;
  for (var d=0; d<data.audio.length; d++) {
    if (data.audio[d].bk != bk) continue;
    for (var c=data.audio[d].ch1; c<=data.audio[d].ch2; c++) {
      if (c<ch) continue;
      if (firstCh === null) firstCh = c;
      item = lastChapterList.getItemAtIndex(c-1);
      item.removeAttribute("hidden");
    }
  }
  
  if (firstCh !== null) lastChapterList.selectedIndex = (firstCh-1);
  else lastChapterList.selectedIndex = -1;
}

function accept() {
  data.ok = true; 
  data.bk = bookList.selectedItem.value;
  data.ch = chapterList.selectedItem.value;
  data.cl = lastChapterList.selectedItem.value;
  return true;
}

function cancel() {
  data.ok = false; 
  data.bk = null;
  data.ch = null;
  data.cl = null;
  return true;
}
