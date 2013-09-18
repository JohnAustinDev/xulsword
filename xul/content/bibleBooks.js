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

// The Book object holds information about all possible Bible books
// handled by xulsword. Currently the book list and information comes 
// from the current xulsword locale. LibSword may be used to get the
// book list and information in the future.

function getBibleBooks() {

	// default book order is KJV
  var allBooks = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", 
      "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", 
      "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", 
      "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", 
      "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Matt", "Mark", "Luke", 
      "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", 
      "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", 
      "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev"];

  var book = [];
  for (var i=0; i < allBooks.length; i++) {
		book.push( { sName:"", bName:"", bNameL:"" } );
  }

	var b = getCurrentLocaleBundle("common/books.properties");
  for (i=0; i < book.length; i++) {
    // implement book order from xulsword locale
    try {
			var x = b.GetStringFromName(allBooks[i] + "i");
			if ((/^\s*$/).test(x)) x = i;
			x = Number(x);
		}
    catch (er) {x = i;}
  
    if (book[x].sName) 
				throw "ERROR: Two books share the same index (" + x + "):" + book[x].sName + ", " + allBooks[i];
				
    book[x].sName = allBooks[i];
  }

  for (i=0; i < book.length; i++) {  
    var bName = b.GetStringFromName(book[i].sName);
    book[i].bName  = bName;
    book[i].bNameL = bName;
  }
    
  // Search locale for long books names, and save them
  var strings = b.getSimpleEnumeration();
  while (strings.hasMoreElements()) {
    var s = strings.getNext();
    s = s.QueryInterface(Components.interfaces.nsIPropertyElement);
    var isLong = s.key.match(/Long(.*?)\s*$/);
    if (!isLong) continue;
    
    var bookNum = findBookNum(isLong[1]);
    if (bookNum == null) continue;
    
    book[bookNum].bNameL = b.GetStringFromName(s.key);
  }
  
  return book;
}
