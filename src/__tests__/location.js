/* eslint-disable no-continue */
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

/* ***********************************************************************
 * GLOBAL Bible Location
 ********************************************************************** */

/*
  This object holds and accesses the global Scripture location referenced
  by all of xulsword's unpinned windows etc.
*/

import LibSword from '../main/modules/libsword';
import C from '../constant';

const Location = {
  modname: null,
  modvsys: null,
  book: null,
  chapter: null,
  verse: null,
  lastverse: null,

  convertLocation(vsys1, xsref, vsys2) {
    if (!vsys1 || !xsref || !vsys2) return null;
    let p = xsref.split('.');
    let vzero = false;
    if (p && (p.length === 3 || p.length === 4) && p[2] === '0') {
      // libxulsword convertLocation was changed to always return valid
      // references (verse=0 is never returned any more). So the old
      // behaviour is enforced here to keep xulsword happy.
      vzero = true;
      p[2] = 1;
      p[3] = 1;
    }

    // SWORD crashes for some null inputs, so filter them out
    const p2 = [];
    for (let i = 0; i < p.length; i += 1) {
      if (p[i]) {
        p2.push(p[i]);
        continue;
      }
      break;
    }
    if (!p2.length) return null;
    const xsref2 = p2.join('.');

    const loc = LibSword.convertLocation(vsys1, xsref2, vsys2);
    if (!vzero) return loc;

    p = loc.split('.');
    p[2] = 0;
    p[3] = 0;
    return p.join('.');
  },

  setLocation(modname, xsref) {
    this.modname = modname;
    this.modvsys = LibSword.getVerseSystem(modname);
    /*
    // dont highlight entire chapter unless specifically requested
    if ((/^[^\s\.]+\.\d+$/).test(xsref)) xsref += ".1.1";
*/
    const loc = this.convertLocation(this.modvsys, xsref, this.modvsys);

    if (loc) {
      const p = loc.split('.');

      [this.book, this.chapter, this.verse, this.lastverse] = p;
    }

    return this.modvsys;
  },

  setVerse(modname, verse, lastverse) {
    const loc = this.getLocation(modname);
    const p = loc.split('.');
    const maxv = LibSword.getMaxVerse(modname, loc);

    if (verse === -1 || verse > maxv) p[2] = maxv;
    else if (verse < 0) p[2] = 0;
    else p[2] = verse;

    if (lastverse === -1 || lastverse > maxv) p[3] = maxv;
    else if (lastverse < verse) p[3] = verse;
    else p[3] = lastverse;

    this.setLocation(modname, p.join('.'));

    return this.modvsys;
  },

  getLocation(modname) {
    if (!this.modname) {
      this.setLocation(C.WESTERNVS, 'Gen.1.1.1');
    }
    const r = this.convertLocation(
      LibSword.getVerseSystem(this.modname),
      `${this.book}.${this.chapter}.${this.verse}.${this.lastverse}`,
      LibSword.getVerseSystem(modname)
    );
    return r;
  },

  getChapter(modname) {
    const p = this.getLocation(modname).split('.');
    return `${p[0]} ${p[1]}`;
  },

  getBookName() {
    return this.getLocation(this.modname).split('.')[0];
  },

  getChapterNumber(modname) {
    return this.getLocation(modname).split('.')[1];
  },

  getVerseNumber(modname) {
    return this.getLocation(modname).split('.')[2];
  },

  getLastVerseNumber(modname) {
    return this.getLocation(modname).split('.')[3];
  },
};

export default Location;
