/******************************************************************************
 *  versemgr.cpp	- implementation of class VerseMgr used for managing
 *  					versification systems
 *
 * $Id: versemgr.cpp 2108 2007-10-13 20:35:02Z scribe $
 *
 * Copyright 1998 CrossWire Bible Society (http://www.crosswire.org)
 *	CrossWire Bible Society
 *	P. O. Box 2528
 *	Tempe, AZ  85280-2528
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation version 2.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 */

#include <versemgr.h>
#include <vector>
#include <map>
#include <treekey.h>
#include <canon.h>		// KJV internal versification system
#include <swlog.h>
#include <algorithm>

#include <canon_null.h>		// null v11n system

#include <canon_leningrad.h>	// Leningrad Codex (WLC) v11n system
#include <canon_mt.h>		// Masoretic Text (MT) v11n system
#include <canon_kjva.h>		// KJV + Apocrypha v11n system
#include <canon_nrsv.h>		// NRSV v11n system
#include <canon_nrsva.h>	// NRSVA + Apocrypha v11n system
#include <canon_synodal.h>	// Russian Synodal v11n system
#include <canon_vulg.h>		// Vulgate v11n system
#include <canon_german.h>	// German v11n system
#include <canon_luther.h>	// Luther v11n system
#include <canon_east.h>
#include <canon_synodalprot.h>

using std::vector;
using std::map;
using std::distance;
using std::lower_bound;

SWORD_NAMESPACE_START


VerseMgr *VerseMgr::getSystemVerseMgr() {
	if (!systemVerseMgr) {
		systemVerseMgr = new VerseMgr();
		systemVerseMgr->registerVersificationSystem("KJV", otbooks, ntbooks, vm);
		systemVerseMgr->registerVersificationSystem("Leningrad", otbooks_leningrad, ntbooks_null, vm_leningrad);
		systemVerseMgr->registerVersificationSystem("MT", otbooks_mt, ntbooks_null, vm_mt);
		systemVerseMgr->registerVersificationSystem("KJVA", otbooks_kjva, ntbooks, vm_kjva);
		systemVerseMgr->registerVersificationSystem("NRSV", otbooks, ntbooks, vm_nrsv);
		systemVerseMgr->registerVersificationSystem("NRSVA", otbooks_nrsva, ntbooks, vm_nrsva);
		systemVerseMgr->registerVersificationSystem("Synodal", otbooks_synodal, ntbooks_synodal, vm_synodal);
		systemVerseMgr->registerVersificationSystem("Vulg", otbooks_vulg, ntbooks_vulg, vm_vulg);
		systemVerseMgr->registerVersificationSystem("German", otbooks_german, ntbooks_german, vm_german);
		systemVerseMgr->registerVersificationSystem("Luther", otbooks_luther, ntbooks_luther, vm_luther);
		systemVerseMgr->registerVersificationSystem("EASTERN", otbooks_eastern, ntbooks_eastern, vm_eastern);
		systemVerseMgr->registerVersificationSystem("SynodalProt", otbooks_synodalprot, ntbooks_synodalprot, vm_synodalprot);
	}
	return systemVerseMgr;
}


class VerseMgr::System::Private {
public:
	/** Array[chapmax] of maximum verses in chapters */
	vector<Book> books;
	map<SWBuf, int> osisLookup;

	Private() {
	}
	Private(const VerseMgr::System::Private &other) {
		books = other.books;
		osisLookup = other.osisLookup;
	}
	VerseMgr::System::Private &operator =(const VerseMgr::System::Private &other) {
		books = other.books;
		osisLookup = other.osisLookup;
		return *this;
	}
};


class VerseMgr::Book::Private {
friend struct BookOffsetLess;
public:
	/** Array[chapmax] of maximum verses in chapters */
	vector<int> verseMax;
	vector<long> offsetPrecomputed;

	Private() {
		verseMax.clear();
	}
	Private(const VerseMgr::Book::Private &other) {
		verseMax.clear();
		verseMax = other.verseMax;
		offsetPrecomputed = other.offsetPrecomputed;
	}
	VerseMgr::Book::Private &operator =(const VerseMgr::Book::Private &other) {
		verseMax.clear();
		verseMax = other.verseMax;
		offsetPrecomputed = other.offsetPrecomputed;
		return *this;
	}
};

struct BookOffsetLess {
	bool operator() (const VerseMgr::Book &o1, const VerseMgr::Book &o2) const { return o1.p->offsetPrecomputed[0] < o2.p->offsetPrecomputed[0]; }
	bool operator() (const long &o1, const VerseMgr::Book &o2) const { return o1 < o2.p->offsetPrecomputed[0]; }
	bool operator() (const VerseMgr::Book &o1, const long &o2) const { return o1.p->offsetPrecomputed[0] < o2; }
	bool operator() (const long &o1, const long &o2) const { return o1 < o2; }
};

void VerseMgr::Book::init() {
	p = new Private();
}

void VerseMgr::System::init() {
	p = new Private();
	BMAX[0] = 0;
	BMAX[1] = 0;
	ntStartOffset = 0;
}


VerseMgr::System::System(const System &other) {
	init();
	name = other.name;
	BMAX[0] = other.BMAX[0];
	BMAX[1] = other.BMAX[1];
	(*p) = *(other.p);
	ntStartOffset = other.ntStartOffset;
}

VerseMgr::System &VerseMgr::System::operator =(const System &other) {
	name = other.name;
	BMAX[0] = other.BMAX[0];
	BMAX[1] = other.BMAX[1];
	(*p) = *(other.p);
	ntStartOffset = other.ntStartOffset;
	return *this;
}


VerseMgr::System::~System() {
	delete p;
}

const VerseMgr::Book *VerseMgr::System::getBook(int number) const {
	return (number < (signed int)p->books.size()) ? &(p->books[number]) : 0;
}


int VerseMgr::System::getBookNumberByOSISName(const char *bookName) const {
	map<SWBuf, int>::const_iterator it = p->osisLookup.find(bookName);
	return (it != p->osisLookup.end()) ? it->second : -1;
}


void VerseMgr::System::loadFromSBook(const sbook *ot, const sbook *nt, int *chMax) {
	int chap = 0;
	int book = 0;
	long offset = 0;	// module heading
	offset++;			// testament heading
	while (ot->chapmax) {
		p->books.push_back(Book(ot->name, ot->osis, ot->prefAbbrev, ot->chapmax));
		offset++;		// book heading
		Book &b = p->books[p->books.size()-1];
		p->osisLookup[b.getOSISName()] = p->books.size();
		for (int i = 0; i < ot->chapmax; i++) {
			b.p->verseMax.push_back(chMax[chap]);
			offset++;		// chapter heading
			b.p->offsetPrecomputed.push_back(offset);
			offset += chMax[chap++];
		}
		ot++;
		book++;
	}
	BMAX[0] = book;
	book = 0;
	ntStartOffset = offset;
	offset++;			// testament heading
	while (nt->chapmax) {
		p->books.push_back(Book(nt->name, nt->osis, nt->prefAbbrev, nt->chapmax));
		offset++;		// book heading
		Book &b = p->books[p->books.size()-1];
		p->osisLookup[b.getOSISName()] = p->books.size();
		for (int i = 0; i < nt->chapmax; i++) {
			b.p->verseMax.push_back(chMax[chap]);
			offset++;		// chapter heading
			b.p->offsetPrecomputed.push_back(offset);
			offset += chMax[chap++];
		}
		nt++;
		book++;
	}
	BMAX[1] = book;

	// TODO: build offset speed array
}


VerseMgr::Book::Book(const Book &other) {
	longName = other.longName;
	osisName = other.osisName;
	prefAbbrev = other.prefAbbrev;
	chapMax = other.chapMax;
	init();
	(*p) = *(other.p);
}

VerseMgr::Book& VerseMgr::Book::operator =(const Book &other) {
	longName = other.longName;
	osisName = other.osisName;
	prefAbbrev = other.prefAbbrev;
	chapMax = other.chapMax;
	init();
	(*p) = *(other.p);
	return *this;
}


VerseMgr::Book::~Book() {
	delete p;
}


int VerseMgr::Book::getVerseMax(int chapter) const {
	chapter--;
	return (p && (chapter < (signed int)p->verseMax.size()) && (chapter > -1)) ? p->verseMax[chapter] : -1;
}


int VerseMgr::System::getBookCount() const {
	return (p ? p->books.size() : 0);
}


long VerseMgr::System::getOffsetFromVerse(int book, int chapter, int verse) const {
	long  offset = -1;
	chapter--;

	const Book *b = getBook(book);

	if (!b)                                        return -1;	// assert we have a valid book
	if ((chapter > -1) && (chapter >= (signed int)b->p->offsetPrecomputed.size())) return -1;	// assert we have a valid chapter

	offset = b->p->offsetPrecomputed[(chapter > -1)?chapter:0];
	if (chapter < 0) offset--;

/* old code
 *
	offset = offsets[testament-1][0][book];
	offset = offsets[testament-1][1][(int)offset + chapter];
	if (!(offset|verse)) // if we have a testament but nothing else.
		offset = 1;

*/

	return (offset + verse);
}


char VerseMgr::System::getVerseFromOffset(long offset, int *book, int *chapter, int *verse) const {

	if (offset < 1) {	// just handle the module heading corner case up front (and error case)
		(*book) = -1;
		(*chapter) = 0;
		(*verse) = 0;
		return offset;	// < 0 = error
	}

	// binary search for book
	vector<Book>::iterator b = lower_bound(p->books.begin(), p->books.end(), offset, BookOffsetLess());
	if (b == p->books.end()) b--;
	(*book)    = distance(p->books.begin(), b)+1;
	if (offset < (*(b->p->offsetPrecomputed.begin()))-((((!(*book)) || (*book)==BMAX[0]+1))?2:1)) { // -1 for chapter headings
		(*book)--;
		if (b != p->books.begin()) {
			b--;	
		}
	}
	vector<long>::iterator c = lower_bound(b->p->offsetPrecomputed.begin(), b->p->offsetPrecomputed.end(), offset);

	// if we're a book heading, we are lessthan chapter precomputes, but greater book.  This catches corner case.
	if (c == b->p->offsetPrecomputed.end()) {
		c--;
	}
	if ((offset < *c) && (c == b->p->offsetPrecomputed.begin())) {
		(*chapter) = (offset - *c)+1;	// should be 0 or -1 (for testament heading)
		(*verse) = 0;
	}
	else {
		if (offset < *c) c--;
		(*chapter) = distance(b->p->offsetPrecomputed.begin(), c)+1;
		(*verse)   = (offset - *c);
	}
	return ((*chapter > 0) && (*verse > b->getVerseMax(*chapter))) ? KEYERR_OUTOFBOUNDS : 0;
}


/***************************************************
 * VerseMgr
 */

class VerseMgr::Private {
public:
	Private() {
	}
	Private(const VerseMgr::Private &other) {
		systems = other.systems;
	}
	VerseMgr::Private &operator =(const VerseMgr::Private &other) {
		systems = other.systems;
		return *this;
	}
	map<SWBuf, System> systems;
};
// ---------------- statics -----------------
VerseMgr *VerseMgr::systemVerseMgr = 0;

class __staticsystemVerseMgr {
public:
	__staticsystemVerseMgr() { }
	~__staticsystemVerseMgr() { delete VerseMgr::systemVerseMgr; }
} _staticsystemVerseMgr;


void VerseMgr::init() {
	p = new Private();
}


VerseMgr::~VerseMgr() {
	delete p;
}


void VerseMgr::setSystemVerseMgr(VerseMgr *newVerseMgr) {
	if (systemVerseMgr)
		delete systemVerseMgr;
	systemVerseMgr = newVerseMgr;
}


const VerseMgr::System *VerseMgr::getVersificationSystem(const char *name) const {
	map<SWBuf, System>::const_iterator it = p->systems.find(name);
	return (it != p->systems.end()) ? &(it->second) : 0;
}


void VerseMgr::registerVersificationSystem(const char *name, const sbook *ot, const sbook *nt, int *chMax) {
	p->systems[name] = name;
	System &s = p->systems[name];
	s.loadFromSBook(ot, nt, chMax);
}


void VerseMgr::registerVersificationSystem(const char *name, const TreeKey *tk) {
}


const StringList VerseMgr::getVersificationSystems() const {
	StringList retVal;
	for (map<SWBuf, System>::const_iterator it = p->systems.begin(); it != p->systems.end(); it++) {
		retVal.push_back(it->first);
	}
	return retVal;
}


SWORD_NAMESPACE_END
