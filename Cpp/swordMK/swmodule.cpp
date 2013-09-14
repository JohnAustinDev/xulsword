/******************************************************************************
 *
 *  swmodule.cpp -	code for base class 'SWModule'. SWModule is the basis
 *			for all types of modules (e.g. texts, commentaries,
 *			maps, lexicons, etc.)
 *
 * $Id: swmodule.cpp 2976 2013-09-10 14:09:44Z scribe $
 *
 * Copyright 1999-2013 CrossWire Bible Society (http://www.crosswire.org)
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


#include <vector>

#include <swlog.h>
#include <sysdata.h>
#include <swmodule.h>
#include <utilstr.h>
#include <swfilter.h>
#include <versekey.h>	// KLUDGE for Search
#include <treekeyidx.h>	// KLUDGE for Search
#include <swoptfilter.h>
#include <filemgr.h>
#include <stringmgr.h>
#ifndef _MSC_VER
#include <iostream>
#endif

#ifdef USECXX11REGEX
#include <regex>
#ifndef REG_ICASE
#define REG_ICASE std::regex::icase
#endif
#else
#include <regex.h>	// GNU
#endif

#ifdef USELUCENE
#include <CLucene.h>

//Lucence includes
//#include "CLucene.h"
//#include "CLucene/util/Reader.h"
//#include "CLucene/util/Misc.h"
//#include "CLucene/util/dirent.h"

using namespace lucene::index;
using namespace lucene::analysis;
using namespace lucene::util;
using namespace lucene::store;
using namespace lucene::document;
using namespace lucene::queryParser;
using namespace lucene::search;
#endif

using std::vector;

SWORD_NAMESPACE_START

SWModule::StdOutDisplay SWModule::rawdisp;

typedef std::list<SWBuf> StringList;

/******************************************************************************
 * SWModule Constructor - Initializes data for instance of SWModule
 *
 * ENT:	imodname - Internal name for module
 *	imoddesc - Name to display to user for module
 *	idisp	 - Display object to use for displaying
 *	imodtype - Type of Module (All modules will be displayed with
 *			others of same type under their modtype heading
 *	unicode  - if this module is unicode
 */

SWModule::SWModule(const char *imodname, const char *imoddesc, SWDisplay *idisp, const char *imodtype, SWTextEncoding encoding, SWTextDirection direction, SWTextMarkup markup, const char *imodlang) {
	key       = createKey();
	entryBuf  = "";
	config    = &ownConfig;
	modname   = 0;
	error     = 0;
	moddesc   = 0;
	modtype   = 0;
	modlang   = 0;
	this->encoding = encoding;
	this->direction = direction;
	this->markup  = markup;
	entrySize= -1;
	disp     = (idisp) ? idisp : &rawdisp;
	stdstr(&modname, imodname);
	stdstr(&moddesc, imoddesc);
	stdstr(&modtype, imodtype);
	stdstr(&modlang, imodlang);
	stripFilters = new FilterList();
	rawFilters = new FilterList();
	renderFilters = new FilterList();
	optionFilters = new OptionFilterList();
	encodingFilters = new FilterList();
	skipConsecutiveLinks = true;
	procEntAttr = true;
}


/******************************************************************************
 * SWModule Destructor - Cleans up instance of SWModule
 */

SWModule::~SWModule()
{
	if (modname)
		delete [] modname;
	if (moddesc)
		delete [] moddesc;
	if (modtype)
		delete [] modtype;
	if (modlang)
		delete [] modlang;

	if (key) {
		if (!key->isPersist())
			delete key;
	}

	stripFilters->clear();
	rawFilters->clear();
	renderFilters->clear();
	optionFilters->clear();
	encodingFilters->clear();
	entryAttributes.clear();

	delete stripFilters;
	delete rawFilters;
	delete renderFilters;
	delete optionFilters;
	delete encodingFilters;
}


/******************************************************************************
 * SWModule::createKey - Allocates a key of specific type for module
 *
 * RET:	pointer to allocated key
 */

SWKey *SWModule::createKey() const
{
	return new SWKey();
}


/******************************************************************************
 * SWModule::popError - Gets and clears error status
 *
 * RET:	error status
 */

char SWModule::popError()
{
	char retval = error;

	error = 0;
	return retval;
}


/******************************************************************************
 * SWModule::Name - Sets/gets module name
 *
 * ENT:	imodname - value which to set modname
 *		[0] - only get
 *
 * RET:	pointer to modname
 */

const char *SWModule::getName() const {
	return modname;
}


/******************************************************************************
 * SWModule::Description - Sets/gets module description
 *
 * ENT:	imoddesc - value which to set moddesc
 *		[0] - only get
 *
 * RET:	pointer to moddesc
 */

const char *SWModule::getDescription() const {
	return moddesc;
}


/******************************************************************************
 * SWModule::Type - Sets/gets module type
 *
 * ENT:	imodtype - value which to set modtype
 *		[0] - only get
 *
 * RET:	pointer to modtype
 */

const char *SWModule::getType() const {
	return modtype;
}

/******************************************************************************
 * SWModule::getDirection - Sets/gets module direction
 *
 * ENT:	newdir - value which to set direction
 *		[-1] - only get
 *
 * RET:	char direction
 */
char SWModule::getDirection() const {
	return direction;
}


/******************************************************************************
 * SWModule::Disp - Sets/gets display driver
 *
 * ENT:	idisp - value which to set disp
 *		[0] - only get
 *
 * RET:	pointer to disp
 */

SWDisplay *SWModule::getDisplay() const {
	return disp;
}

void SWModule::setDisplay(SWDisplay *idisp) {
	disp = idisp;
}

/******************************************************************************
 *  * SWModule::Display - Calls this modules display object and passes itself
 *   *
 *    * RET:   error status
 *     */

char SWModule::display() {
	disp->display(*this);
	return 0;
}

/******************************************************************************
 * SWModule::getKey - Gets the key from this module that points to the position
 *			record
 *
 * RET:	key object
 */

SWKey *SWModule::getKey() const {
	return key;
}


/******************************************************************************
 * SWModule::setKey - Sets a key to this module for position to a particular
 *			record
 *
 * ENT:	ikey - key with which to set this module
 *
 * RET:	error status
 */

char SWModule::setKey(const SWKey *ikey) {
	SWKey *oldKey = 0;

	if (key) {
		if (!key->isPersist())	// if we have our own copy
			oldKey = key;
	}

	if (!ikey->isPersist()) {		// if we are to keep our own copy
		 key = createKey();
		*key = *ikey;
	}
	else	 key = (SWKey *)ikey;		// if we are to just point to an external key

	if (oldKey)
		delete oldKey;

	return 0;
}


/******************************************************************************
 * SWModule::setPosition(SW_POSITION)	- Positions this modules to an entry
 *
 * ENT:	p	- position (e.g. TOP, BOTTOM)
 *
 * RET: *this
 */

void SWModule::setPosition(SW_POSITION p) {
	*key = p;
	char saveError = key->popError();

	switch (p) {
	case POS_TOP:
		(*this)++;
		(*this)--;
		break;

	case POS_BOTTOM:
		(*this)--;
		(*this)++;
		break;
	}

	error = saveError;
}


/******************************************************************************
 * SWModule::increment	- Increments module key a number of entries
 *
 * ENT:	increment	- Number of entries to jump forward
 *
 * RET: *this
 */

void SWModule::increment(int steps) {
	(*key) += steps;
	error = key->popError();
}


/******************************************************************************
 * SWModule::decrement	- Decrements module key a number of entries
 *
 * ENT:	decrement	- Number of entries to jump backward
 *
 * RET: *this
 */

void SWModule::decrement(int steps) {
	(*key) -= steps;
	error = key->popError();
}


/******************************************************************************
 * SWModule::Search 	- Searches a module for a string
 *
 * ENT:	istr		- string for which to search
 * 	searchType	- type of search to perform
 *				>=0 - regex
 *				-1  - phrase
 *				-2  - multiword
 *				-3  - entryAttrib (eg. Word//Lemma./G1234/)	 (Lemma with dot means check components (Lemma.[1-9]) also)
 *				-4  - clucene
 *				-5  - multilemma window; flags = window size
 * 	flags		- options flags for search
 *	justCheckIfSupported	- if set, don't search, only tell if this
 *							function supports requested search.
 *
 * RET: ListKey set to verses that contain istr
 */

ListKey &SWModule::search(const char *istr, int searchType, int flags, SWKey *scope, bool *justCheckIfSupported, void (*percent)(char, void *), void *percentUserData) {
#include "../src/swmodule_search.cpp"
}


/******************************************************************************
 * SWModule::stripText() 	- calls all stripfilters on current text
 *
 * ENT:	buf	- buf to massage instead of this modules current text
 * 	len	- max len of buf
 *
 * RET: this module's text at current key location massaged by Strip filters
 */

const char *SWModule::stripText(const char *buf, int len) {
	static SWBuf local;
	local = renderText(buf, len, false);
	return local.c_str();
}


/** SWModule::getRenderHeader()	- Produces any header data which might be
 *	useful which associated with the processing done with this filter.
 *	A typical example is a suggested CSS style block for classed
 *	containers.
 */
const char *SWModule::getRenderHeader() const {
	FilterList::const_iterator first = getRenderFilters().begin();
	if (first != getRenderFilters().end()) {
		return (*first)->getHeader();
	}
	return "";
}


/******************************************************************************
 * SWModule::renderText 	- calls all renderfilters on current text
 *
 * ENT:	buf	- buffer to Render instead of current module position
 *
 * RET: this module's text at current key location massaged by renderText filters
 */

 SWBuf SWModule::renderText(const char *buf, int len, bool render) {
	bool savePEA = isProcessEntryAttributes();
	if (!buf) {
		entryAttributes.clear();
	}
	else {
		setProcessEntryAttributes(false);
	}

	SWBuf local;
	if (buf)
		local = buf;

	SWBuf &tmpbuf = (buf) ? local : getRawEntryBuf();
	SWKey *key = 0;
	static const char *null = "";

	if (tmpbuf) {
		unsigned long size = (len < 0) ? ((getEntrySize()<0) ? strlen(tmpbuf) : getEntrySize()) : len;
		if (size > 0) {
			key = (SWKey *)*this;

			optionFilter(tmpbuf, key);
	
			if (render) {
				renderFilter(tmpbuf, key);
				encodingFilter(tmpbuf, key);
			}
			else	stripFilter(tmpbuf, key);
		}
	}
	else {
		tmpbuf = null;
	}

	setProcessEntryAttributes(savePEA);

	return tmpbuf;
}


/******************************************************************************
 * SWModule::renderText 	- calls all renderfilters on current text
 *
 * ENT:	tmpKey	- key to use to grab text
 *
 * RET: this module's text at current key location massaged by RenderFilers
 */

SWBuf SWModule::renderText(const SWKey *tmpKey) {
	SWKey *saveKey;
	const char *retVal;

	if (!key->isPersist()) {
		saveKey = createKey();
		*saveKey = *key;
	}
	else	saveKey = key;

	setKey(*tmpKey);

	retVal = renderText();

	setKey(*saveKey);

	if (!saveKey->isPersist())
		delete saveKey;

	return retVal;
}


/******************************************************************************
 * SWModule::stripText 	- calls all StripTextFilters on current text
 *
 * ENT:	tmpKey	- key to use to grab text
 *
 * RET: this module's text at specified key location massaged by Strip filters
 */

const char *SWModule::stripText(const SWKey *tmpKey) {
	SWKey *saveKey;
	const char *retVal;

	if (!key->isPersist()) {
		saveKey = createKey();
		*saveKey = *key;
	}
	else	saveKey = key;

	setKey(*tmpKey);

	retVal = stripText();

	setKey(*saveKey);

	if (!saveKey->isPersist())
		delete saveKey;

	return retVal;
}

/******************************************************************************
 * SWModule::getBibliography	-Returns bibliographic data for a module in the
 *								requested format
 *
 * ENT: bibFormat format of the bibliographic data
 *
 * RET: bibliographic data in the requested format as a string (BibTeX by default)
 */

SWBuf SWModule::getBibliography(unsigned char bibFormat) const {
	SWBuf s;
	switch (bibFormat) {
	case BIB_BIBTEX:
		s.append("@Book {").append(modname).append(", Title = \"").append(moddesc).append("\", Publisher = \"CrossWire Bible Society\"}");
		break;
	}
	return s;
}

const char *SWModule::getConfigEntry(const char *key) const {
	ConfigEntMap::iterator it = config->find(key);
	return (it != config->end()) ? it->second.c_str() : 0;
}


void SWModule::setConfig(ConfigEntMap *config) {
	this->config = config;
}


bool SWModule::hasSearchFramework() {
#ifdef USELUCENE
	return true;
#else
	return SWSearchable::hasSearchFramework();
#endif
}

void SWModule::deleteSearchFramework() {
#ifdef USELUCENE
	SWBuf target = getConfigEntry("AbsoluteDataPath");
	if (!target.endsWith("/") && !target.endsWith("\\")) {
		target.append('/');
	}
	target.append("lucene");

	FileMgr::removeDir(target.c_str());
#else
	SWSearchable::deleteSearchFramework();
#endif
}


signed char SWModule::createSearchFramework(void (*percent)(char, void *), void *percentUserData) {
#include "../src/swmodule_createSearchFramework.cpp"
}

/** OptionFilterBuffer a text buffer
 * @param filters the FilterList of filters to iterate
 * @param buf the buffer to filter
 * @param key key location from where this buffer was extracted
 */
void SWModule::filterBuffer(OptionFilterList *filters, SWBuf &buf, const SWKey *key) const {
	OptionFilterList::iterator it;
	for (it = filters->begin(); it != filters->end(); it++) {
		(*it)->processText(buf, key, this);
	}
}

/** FilterBuffer a text buffer
 * @param filters the FilterList of filters to iterate
 * @param buf the buffer to filter
 * @param key key location from where this buffer was extracted
 */
void SWModule::filterBuffer(FilterList *filters, SWBuf &buf, const SWKey *key) const {
	FilterList::iterator it;
	for (it = filters->begin(); it != filters->end(); it++) {
		(*it)->processText(buf, key, this);
	}
}

signed char SWModule::createModule(const char*) {
	return -1;
}

void SWModule::setEntry(const char*, long) {
}

void SWModule::linkEntry(const SWKey*) {
}


/******************************************************************************
 * SWModule::prepText	- Prepares the text before returning it to external
 *					objects
 *
 * ENT:	buf	- buffer where text is stored and where to store the prep'd
 *				text.
 */

void SWModule::prepText(SWBuf &buf) {
	unsigned int to, from; 
	char space = 0, cr = 0, realdata = 0, nlcnt = 0;
	char *rawBuf = buf.getRawData();
	for (to = from = 0; rawBuf[from]; from++) {
		switch (rawBuf[from]) {
		case 10:
			if (!realdata)
				continue;
			space = (cr) ? 0 : 1;
			cr = 0;
			nlcnt++;
			if (nlcnt > 1) {
//				*to++ = nl;
				rawBuf[to++] = 10;
//				*to++ = nl[1];
//				nlcnt = 0;
			}
			continue;
		case 13:
			if (!realdata)
				continue;
//			*to++ = nl[0];
			rawBuf[to++] = 10;
			space = 0;
			cr = 1;
			continue;
		}
		realdata = 1;
		nlcnt = 0;
		if (space) {
			space = 0;
			if (rawBuf[from] != ' ') {
				rawBuf[to++] = ' ';
				from--;
				continue;
			}
		}
		rawBuf[to++] = rawBuf[from];
	}
	buf.setSize(to);

	while (to > 1) {			// remove trailing excess
		to--;
		if ((rawBuf[to] == 10) || (rawBuf[to] == ' '))
			buf.setSize(to);
		else break;
	}
}

SWORD_NAMESPACE_END
