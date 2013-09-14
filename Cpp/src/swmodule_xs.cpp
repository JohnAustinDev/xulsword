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

#include "CLucene/StdHeader.h"
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

ListKey &SWModuleXS::search(const char *istr, int searchType, int flags, SWKey *scope, bool *justCheckIfSupported, void (*percent)(char, void *), void *percentUserData) {

	listKey.clear();
	SWBuf term = istr;
	bool includeComponents = false;	// for entryAttrib e.g., /Lemma.1/ 

#ifdef USELUCENE
	SWBuf target = getConfigEntry("AbsoluteDataPath");
	if (!target.endsWith("/") && !target.endsWith("\\")) {
		target.append('/');
	}
	target.append("lucene");
#endif
	if (justCheckIfSupported) {
		*justCheckIfSupported = (searchType >= -3);
#ifdef USELUCENE
		if ((searchType == -4) && (IndexReader::indexExists(target.c_str()))) {
			*justCheckIfSupported = true;
		}
#endif
		return listKey;
	}
	
	SWKey *saveKey   = 0;
	SWKey *searchKey = 0;
	SWKey *resultKey = createKey();
	SWKey *lastKey   = createKey();
	SWBuf lastBuf = "";

#ifdef USECXX11REGEX
	std::locale oldLocale;
	std::locale::global(std::locale("en_US.UTF-8"));

	std::regex preg;
#else
	regex_t preg;
#endif

	vector<SWBuf> words;
	vector<SWBuf> window;
	const char *sres;
	terminateSearch = false;
	char perc = 1;
	bool savePEA = isProcessEntryAttributes();

	// determine if we might be doing special strip searches.  useful for knowing if we can use shortcuts
	bool specialStrips = (getConfigEntry("LocalStripFilter")
			|| (getConfig().has("GlobalOptionFilter", "UTF8GreekAccents"))
			|| (getConfig().has("GlobalOptionFilter", "UTF8HebrewPoints"))
			|| (getConfig().has("GlobalOptionFilter", "UTF8ArabicPoints"))
			|| (strchr(istr, '<')));

	setProcessEntryAttributes(searchType == -3);
	

	if (!key->isPersist()) {
		saveKey = createKey();
		*saveKey = *key;
	}
	else	saveKey = key;

	searchKey = (scope)?scope->clone():(key->isPersist())?key->clone():0;
	if (searchKey) {
		searchKey->setPersist(true);
		setKey(*searchKey);
	}

	(*percent)(perc, percentUserData);

	*this = BOTTOM;
	long highIndex = key->getIndex();
	if (!highIndex)
		highIndex = 1;		// avoid division by zero errors.
	*this = TOP;
	if (searchType >= 0) {
#ifdef USECXX11REGEX
		preg = std::regex((SWBuf(".*")+istr+".*").c_str(), std::regex_constants::extended & flags);
#else
		flags |=searchType|REG_NOSUB|REG_EXTENDED;
		regcomp(&preg, istr, flags);
#endif
	}

	(*percent)(++perc, percentUserData);


#ifdef USELUCENE
	if (searchType == -4) {	// lucene
		
		lucene::index::IndexReader    *ir = 0;
		lucene::search::IndexSearcher *is = 0;
		Query                         *q  = 0;
		Hits                          *h  = 0;
		SWTRY {
			ir = IndexReader::open(target);
			is = new IndexSearcher(ir);
			(*percent)(10, percentUserData);

			const TCHAR *stopWords[] = { 0 };
			standard::StandardAnalyzer analyzer(stopWords);
			//q = QueryParser::parse((wchar_t *)utf8ToWChar(istr).getRawData(), _T("content"), &analyzer);
			
			// SWORD's utf8ToWChar() relies on getUniCharFromUTF8() which assumes that 
			// wchar_t is a 32 bit UTF-32 character (like Linux). But Window's wchar_t is 
			// instead a 16 bit UTF-16LE character (when compiled with _UNICODE). So 
			// CLucene's lucene_utf8towcs() is used instead because it works on all platforms.

			wchar_t wbuff[5000];
			lucene_utf8towcs(wbuff, istr, 5000);
			q = QueryParser::parse(wbuff, _T("content"), &analyzer);
                        
			(*percent)(20, percentUserData);
			//h = is->search(q);
			if ((flags & 2048) == 2048) {h = is->search(q, lucene::search::Sort::RELEVANCE );}
			else {h = is->search(q, lucene::search::Sort::INDEXORDER );}
			(*percent)(80, percentUserData);

			// iterate thru each good module position that meets the search
			bool checkBounds = getKey()->isBoundSet();
			for (unsigned long i = 0; i < (unsigned long)h->length(); i++) {
				Document &doc = h->doc(i);

				// set a temporary verse key to this module position
				char buff[5000];
				lucene_wcstoutf8(buff, doc.get(_T("key")), 5000); //TODO Does a key always accept utf8?
				*resultKey = buff;

				// check to see if it sets ok (within our bounds) and if not, skip
				if (checkBounds) {
					*getKey() = *resultKey;
					if (*getKey() != *resultKey) {
						continue;
					}
				}
				listKey << *resultKey;
				listKey.getElement()->userData = (__u64)((__u32)(h->score(i)*100));
			}
			(*percent)(98, percentUserData);
		}
		SWCATCH (...) {
			q = 0;
			// invalid clucene query
		}
		delete h;
		delete q;

		delete is;
		if (ir) {
			ir->close();
		}
	}
#endif

	// some pre-loop processing
	switch (searchType) {

	// phrase
	case -1:
		// let's see if we're told to ignore case.  If so, then we'll touppstr our term
		if ((flags & REG_ICASE) == REG_ICASE) toupperstr(term);
		break;

	// multi-word
	case -2:
	case -5:
		// let's break the term down into our words vector
		while (1) {
			const char *word = term.stripPrefix(' ');
			if (!word) {
				words.push_back(term);
				break;
			}
			words.push_back(word);
		}
		if ((flags & REG_ICASE) == REG_ICASE) {
			for (unsigned int i = 0; i < words.size(); i++) {
				toupperstr(words[i]);
			}
		}
		break;

	// entry attributes
	case -3:
		// let's break the attribute segs down.  We'll reuse our words vector for each segment
		while (1) {
			const char *word = term.stripPrefix('/');
			if (!word) {
				words.push_back(term);
				break;
			}
			words.push_back(word);
		}
		if ((words.size()>2) && words[2].endsWith(".")) {
			includeComponents = true;
			words[2]--;
		}
		break;
	}


	// our main loop to iterate the module and find the stuff
	perc = 5;
	(*percent)(perc, percentUserData);

	
	while ((searchType != -4) && !popError() && !terminateSearch) {
		long mindex = key->getIndex();
		float per = (float)mindex / highIndex;
		per *= 93;
		per += 5;
		char newperc = (char)per;
		if (newperc > perc) {
			perc = newperc;
			(*percent)(perc, percentUserData);
		}
		else if (newperc < perc) {
#ifndef _MSC_VER
			std::cerr << "Serious error: new percentage complete is less than previous value\n";
			std::cerr << "index: " << (key->getIndex()) << "\n";
			std::cerr << "highIndex: " << highIndex << "\n";
			std::cerr << "newperc ==" << (int)newperc << "%" << "is smaller than\n";
			std::cerr << "perc == "  << (int )perc << "% \n";
#endif
		}
		if (searchType >= 0) {
			SWBuf textBuf = stripText();
#ifdef USECXX11REGEX
			if (std::regex_match(std::string(textBuf.c_str()), preg)) {
#else
			if (!regexec(&preg, textBuf, 0, 0, 0)) {
#endif
				*resultKey = *getKey();
				resultKey->clearBound();
				listKey << *resultKey;
				lastBuf = "";
			}
#ifdef USECXX11REGEX
			else if (std::regex_match(std::string((lastBuf + ' ' + textBuf).c_str()), preg)) {
#else
			else if (!regexec(&preg, lastBuf + ' ' + textBuf, 0, 0, 0)) {
#endif
				lastKey->clearBound();
				listKey << *lastKey;
				lastBuf = textBuf;
			}
			else {
				lastBuf = textBuf;
			}
		}

		// phrase
		else {
			SWBuf textBuf;
			switch (searchType) {

			// phrase
			case -1:
				textBuf = stripText();
				if ((flags & REG_ICASE) == REG_ICASE) toupperstr(textBuf);
				sres = strstr(textBuf.c_str(), term.c_str());
				if (sres) { //it's also in the stripText(), so we have a valid search result item now
					*resultKey = *getKey();
					resultKey->clearBound();
					listKey << *resultKey;
				}
				break;

			// multiword
			case -2: { // enclose our allocations
				int loopCount = 0;
				unsigned int foundWords = 0;
				do {
					textBuf = ((loopCount == 0)&&(!specialStrips)) ? getRawEntry() : stripText();
					foundWords = 0;
					
					for (unsigned int i = 0; i < words.size(); i++) {
						if ((flags & REG_ICASE) == REG_ICASE) toupperstr(textBuf);
						sres = strstr(textBuf.c_str(), words[i].c_str());
						if (!sres) {
							break; //for loop
						}
						foundWords++;
					}
					
					loopCount++;
				} while ( (loopCount < 2) && (foundWords == words.size()));
				
				if ((loopCount == 2) && (foundWords == words.size())) { //we found the right words in both raw and stripped text, which means it's a valid result item
					*resultKey = *getKey();
					resultKey->clearBound();
					listKey << *resultKey;
				}
				}
				break;

			// entry attributes
			case -3: {
				renderText();	// force parse
				AttributeTypeList &entryAttribs = getEntryAttributes();
				AttributeTypeList::iterator i1Start, i1End;
				AttributeList::iterator i2Start, i2End;
				AttributeValue::iterator i3Start, i3End;

				if ((words.size()) && (words[0].length())) {
// cout << "Word: " << words[0] << endl;
				for (i1Start = entryAttribs.begin(); i1Start != entryAttribs.end(); ++i1Start) {
// cout << "stuff: " << i1Start->first.c_str() << endl;
				}
					i1Start = entryAttribs.find(words[0]);
					i1End = i1Start;
					if (i1End != entryAttribs.end()) {
						i1End++;
					}
				}
				else {
					i1Start = entryAttribs.begin();
					i1End   = entryAttribs.end();
				}
				for (;i1Start != i1End; i1Start++) {
					if ((words.size()>1) && (words[1].length())) {
						i2Start = i1Start->second.find(words[1]);
						i2End = i2Start;
						if (i2End != i1Start->second.end())
							i2End++;
					}
					else {
						i2Start = i1Start->second.begin();
						i2End   = i1Start->second.end();
					}
					for (;i2Start != i2End; i2Start++) {
						if ((words.size()>2) && (words[2].length()) && (!includeComponents)) {
							i3Start = i2Start->second.find(words[2]);
							i3End = i3Start;
							if (i3End != i2Start->second.end())
								i3End++;
						}
						else {
							i3Start = i2Start->second.begin();
							i3End   = i2Start->second.end();
						}
						for (;i3Start != i3End; i3Start++) {
							if ((words.size()>3) && (words[3].length())) {
								if (includeComponents) {
									SWBuf key = i3Start->first.c_str();
									key = key.stripPrefix('.', true);
									// we're iterating all 3 level keys, so be sure we match our
									// prefix (e.g., Lemma, Lemma.1, Lemma.2, etc.)
									if (key != words[2]) continue;
								}
								if (flags & SEARCHFLAG_MATCHWHOLEENTRY) {
									bool found = !(((flags & REG_ICASE) == REG_ICASE) ? sword::stricmp(i3Start->second.c_str(), words[3]) : strcmp(i3Start->second.c_str(), words[3]));
									sres = (found) ? i3Start->second.c_str() : 0;
								}
								else {
									sres = ((flags & REG_ICASE) == REG_ICASE) ? stristr(i3Start->second.c_str(), words[3]) : strstr(i3Start->second.c_str(), words[3]);
								}
								if (sres) {
									*resultKey = *getKey();
									resultKey->clearBound();
									listKey << *resultKey;
									break;
								}
							}
						}
						if (i3Start != i3End)
							break;
					}
					if (i2Start != i2End)
						break;
				}
				break;
			}
			case -5:
				AttributeList &words = getEntryAttributes()["Word"];
				SWBuf kjvWord = "";
				SWBuf bibWord = "";
				for (AttributeList::iterator it = words.begin(); it != words.end(); it++) {
					int parts = atoi(it->second["PartCount"]);
					SWBuf lemma = "";
					SWBuf morph = "";
					for (int i = 1; i <= parts; i++) {
						SWBuf key = "";
						key = (parts == 1) ? "Lemma" : SWBuf().setFormatted("Lemma.%d", i).c_str();
						AttributeValue::iterator li = it->second.find(key);
						if (li != it->second.end()) {
							if (i > 1) lemma += " ";
							key = (parts == 1) ? "LemmaClass" : SWBuf().setFormatted("LemmaClass.%d", i).c_str();
							AttributeValue::iterator lci = it->second.find(key);
							if (lci != it->second.end()) {
								lemma += lci->second + ":";
							}
							lemma += li->second;
						}
						key = (parts == 1) ? "Morph" : SWBuf().setFormatted("Morph.%d", i).c_str();
						li = it->second.find(key);
						// silly.  sometimes morph counts don't equal lemma counts
						if (i == 1 && parts != 1 && li == it->second.end()) {
							li = it->second.find("Morph");
						}
						if (li != it->second.end()) {
							if (i > 1) morph += " ";
							key = (parts == 1) ? "MorphClass" : SWBuf().setFormatted("MorphClass.%d", i).c_str();
							AttributeValue::iterator lci = it->second.find(key);
							// silly.  sometimes morph counts don't equal lemma counts
							if (i == 1 && parts != 1 && lci == it->second.end()) {
								lci = it->second.find("MorphClass");
							}
							if (lci != it->second.end()) {
								morph += lci->second + ":";
							}
							morph += li->second;
						}
						// TODO: add src tags and maybe other attributes
					}
					while (window.size() < (unsigned)flags) {
						
					}
				}
				break;
			} // end switch
		}
		*lastKey = *getKey();
		(*this)++;
	}
	

	// cleaup work
	if (searchType >= 0) {
#ifdef USECXX11REGEX
		std::locale::global(oldLocale);
#else
		regfree(&preg);
#endif
	}

	setKey(*saveKey);

	if (!saveKey->isPersist())
		delete saveKey;

	if (searchKey)
		delete searchKey;
	delete resultKey;
	delete lastKey;

	listKey = TOP;
	setProcessEntryAttributes(savePEA);


	(*percent)(100, percentUserData);


	return listKey;
}


signed char SWModuleXS::createSearchFramework(void (*percent)(char, void *), void *percentUserData) {

#ifdef USELUCENE
	SWBuf target = getConfigEntry("AbsoluteDataPath");
	if (!target.endsWith("/") && !target.endsWith("\\")) {
		target.append('/');
	}
	target.append("lucene");
	int status = FileMgr::createParent(target+"/dummy");
	if (status) return -1;

	SWKey *saveKey = 0;
	SWKey *searchKey = 0;
	SWKey textkey;
	SWBuf c;

	const int MAX_CONV_SIZE = 1024 * 1024;

	// buffer used by lucene_utf8towcs
	const int MAX_FIELD_SIZE = 1024 * 128;
	wchar_t wbuff[MAX_FIELD_SIZE];

	// turn all filters to default values
	StringList filterSettings;
	for (OptionFilterList::iterator filter = optionFilters->begin(); filter != optionFilters->end(); filter++) {
		filterSettings.push_back((*filter)->getOptionValue());
		(*filter)->setOptionValue(*((*filter)->getOptionValues().begin()));

		if ( (!strcmp("Greek Accents", (*filter)->getOptionName())) ||
			(!strcmp("Hebrew Vowel Points", (*filter)->getOptionName())) ||
			(!strcmp("Arabic Vowel Points", (*filter)->getOptionName()))
		   ) {
			(*filter)->setOptionValue("Off");
		}
	}


	// be sure we give CLucene enough file handles
	FileMgr::getSystemFileMgr()->flush();

	// save key information so as not to disrupt original
	// module position
	if (!key->isPersist()) {
		saveKey = createKey();
		*saveKey = *key;
	}
	else	saveKey = key;

	searchKey = (key->isPersist())?key->clone():0;
	if (searchKey) {
		searchKey->setPersist(1);
		setKey(*searchKey);
	}

	RAMDirectory *ramDir = 0;
	IndexWriter *coreWriter = 0;
	IndexWriter *fsWriter = 0;
	Directory *d = 0;

	const TCHAR *stopWords[] = { 0 };
	standard::StandardAnalyzer *an = new standard::StandardAnalyzer(stopWords);
	bool includeKeyInSearch = getConfig().has("SearchOption", "IncludeKeyInSearch");

	ramDir = new RAMDirectory();
	coreWriter = new IndexWriter(ramDir, an, true);
	coreWriter->setMaxFieldLength(MAX_CONV_SIZE);




	char perc = 1;
	VerseKey *vkcheck = 0;
	vkcheck = SWDYNAMIC_CAST(VerseKey, key);
	VerseKey *chapMax = 0;
	if (vkcheck) chapMax = (VerseKey *)vkcheck->clone();

	TreeKeyIdx *tkcheck = 0;
	tkcheck = SWDYNAMIC_CAST(TreeKeyIdx, key);


	*this = BOTTOM;
	long highIndex = key->getIndex();
	if (!highIndex)
		highIndex = 1;		// avoid division by zero errors.

	bool savePEA = isProcessEntryAttributes();
	setProcessEntryAttributes(true);

	// prox chapter blocks
	// position module at the beginning
	*this = TOP;

	SWBuf proxBuf;
	SWBuf proxLem;
	SWBuf proxMorph;
	SWBuf strong;
	SWBuf morph;

	char err = popError();
	while (!err) {
		long mindex = key->getIndex();

		proxBuf = "";
		proxLem = "";
		proxMorph = "";

		// computer percent complete so we can report to our progress callback
		float per = (float)mindex / highIndex;
		// between 5%-98%
		per *= 93; per += 5;
		char newperc = (char)per;
		if (newperc > perc) {
			perc = newperc;
			(*percent)(perc, percentUserData);
		}

		// get "content" field
		const char *content = stripText();

		bool good = false;

		// start out entry
		Document *doc = new Document();
		// get "key" field
		SWBuf keyText = (vkcheck) ? vkcheck->getOSISRef() : getKeyText();
		if (content && *content) {
			good = true;


			// build "strong" field
			AttributeTypeList::iterator words;
			AttributeList::iterator word;
			AttributeValue::iterator strongVal;
			AttributeValue::iterator morphVal;

			strong="";
			morph="";
			words = getEntryAttributes().find("Word");
			if (words != getEntryAttributes().end()) {
				for (word = words->second.begin();word != words->second.end(); word++) {
					int partCount = atoi(word->second["PartCount"]);
					if (!partCount) partCount = 1;
					for (int i = 0; i < partCount; i++) {
						SWBuf tmp = "Lemma";
						if (partCount > 1) tmp.appendFormatted(".%d", i+1);
						strongVal = word->second.find(tmp);
						if (strongVal != word->second.end()) {
							// cheeze.  skip empty article tags that weren't assigned to any text
							if (strongVal->second == "G3588") {
								if (word->second.find("Text") == word->second.end())
									continue;	// no text? let's skip
							}
							strong.append(strongVal->second);
							morph.append(strongVal->second);
							morph.append('@');
							SWBuf tmp = "Morph";
							if (partCount > 1) tmp.appendFormatted(".%d", i+1);
							morphVal = word->second.find(tmp);
							if (morphVal != word->second.end()) {
								morph.append(morphVal->second);
							}
							strong.append(' ');
							morph.append(' ');
						}
					}
				}
			}

			lucene_utf8towcs(wbuff, keyText.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("key"), wbuff, Field::STORE_YES | Field::INDEX_UNTOKENIZED));

			if (includeKeyInSearch) {
				c = keyText;
				c += " ";
				c += content;
				content = c.c_str();
			}

			lucene_utf8towcs(wbuff, content, MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("content"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));

			if (strong.length() > 0) {
				lucene_utf8towcs(wbuff, strong.c_str(), MAX_FIELD_SIZE);
				doc->add(*_CLNEW Field(_T("lemma"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
				lucene_utf8towcs(wbuff, morph.c_str(), MAX_FIELD_SIZE);
				doc->add(*_CLNEW Field(_T("morph"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
//printf("setting fields (%s).\ncontent: %s\nlemma: %s\n", (const char *)*key, content, strong.c_str());
			}

//printf("setting fields (%s).\n", (const char *)*key);
//fflush(stdout);
		}
		// don't write yet, cuz we have to see if we're the first of a prox block (5:1 or chapter5/verse1

		// for VerseKeys use chapter
		if (vkcheck) {
			*chapMax = *vkcheck;
			// we're the first verse in a chapter
			if (vkcheck->getVerse() == 1) {
				*chapMax = MAXVERSE;
				VerseKey saveKey = *vkcheck;
				while ((!err) && (*vkcheck <= *chapMax)) {
//printf("building proxBuf from (%s).\nproxBuf.c_str(): %s\n", (const char *)*key, proxBuf.c_str());
//printf("building proxBuf from (%s).\n", (const char *)*key);

					content = stripText();
					if (content && *content) {
						// build "strong" field
						strong = "";
						morph = "";
						AttributeTypeList::iterator words;
						AttributeList::iterator word;
						AttributeValue::iterator strongVal;
						AttributeValue::iterator morphVal;

						words = getEntryAttributes().find("Word");
						if (words != getEntryAttributes().end()) {
							for (word = words->second.begin();word != words->second.end(); word++) {
								int partCount = atoi(word->second["PartCount"]);
								if (!partCount) partCount = 1;
								for (int i = 0; i < partCount; i++) {
									SWBuf tmp = "Lemma";
									if (partCount > 1) tmp.appendFormatted(".%d", i+1);
									strongVal = word->second.find(tmp);
									if (strongVal != word->second.end()) {
										// cheeze.  skip empty article tags that weren't assigned to any text
										if (strongVal->second == "G3588") {
											if (word->second.find("Text") == word->second.end())
												continue;	// no text? let's skip
										}
										strong.append(strongVal->second);
										morph.append(strongVal->second);
										morph.append('@');
										SWBuf tmp = "Morph";
										if (partCount > 1) tmp.appendFormatted(".%d", i+1);
										morphVal = word->second.find(tmp);
										if (morphVal != word->second.end()) {
											morph.append(morphVal->second);
										}
										strong.append(' ');
										morph.append(' ');
									}
								}
							}
						}
						proxBuf += content;
						proxBuf.append(' ');
						proxLem += strong;
						proxMorph += morph;
						if (proxLem.length()) {
							proxLem.append("\n");
							proxMorph.append("\n");
						}
					}
					(*this)++;
					err = popError();
				}
				err = 0;
				*vkcheck = saveKey;
			}
		}

		// for TreeKeys use siblings if we have no children
		else if (tkcheck) {
			if (!tkcheck->hasChildren()) {
				if (!tkcheck->previousSibling()) {
					do {
//printf("building proxBuf from (%s).\n", (const char *)*key);
//fflush(stdout);

						content = stripText();
						if (content && *content) {
							// build "strong" field
							strong = "";
							morph = "";
							AttributeTypeList::iterator words;
							AttributeList::iterator word;
							AttributeValue::iterator strongVal;
							AttributeValue::iterator morphVal;

							words = getEntryAttributes().find("Word");
							if (words != getEntryAttributes().end()) {
								for (word = words->second.begin();word != words->second.end(); word++) {
									int partCount = atoi(word->second["PartCount"]);
									if (!partCount) partCount = 1;
									for (int i = 0; i < partCount; i++) {
										SWBuf tmp = "Lemma";
										if (partCount > 1) tmp.appendFormatted(".%d", i+1);
										strongVal = word->second.find(tmp);
										if (strongVal != word->second.end()) {
											// cheeze.  skip empty article tags that weren't assigned to any text
											if (strongVal->second == "G3588") {
												if (word->second.find("Text") == word->second.end())
													continue;	// no text? let's skip
											}
											strong.append(strongVal->second);
											morph.append(strongVal->second);
											morph.append('@');
											SWBuf tmp = "Morph";
											if (partCount > 1) tmp.appendFormatted(".%d", i+1);
											morphVal = word->second.find(tmp);
											if (morphVal != word->second.end()) {
												morph.append(morphVal->second);
											}
											strong.append(' ');
											morph.append(' ');
										}
									}
								}
							}

							proxBuf += content;
							proxBuf.append(' ');
							proxLem += strong;
							proxMorph += morph;
							if (proxLem.length()) {
								proxLem.append("\n");
								proxMorph.append("\n");
							}
						}
					} while (tkcheck->nextSibling());
					tkcheck->parent();
					tkcheck->firstChild();
				}
				else tkcheck->nextSibling();	// reposition from our previousSibling test
			}
		}

		if (proxBuf.length() > 0) {
			lucene_utf8towcs(wbuff, proxBuf.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("prox"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED));
			good = true;
		}
		if (proxLem.length() > 0) {
			lucene_utf8towcs(wbuff, proxLem.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("proxlem"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED) );
			lucene_utf8towcs(wbuff, proxMorph.c_str(), MAX_FIELD_SIZE);
			doc->add(*_CLNEW Field(_T("proxmorph"), wbuff, Field::STORE_NO | Field::INDEX_TOKENIZED) );
			good = true;
		}
		if (good) {
//printf("writing (%s).\n", (const char *)*key);
//fflush(stdout);
			coreWriter->addDocument(doc);
		}
		delete doc;

		(*this)++;
		err = popError();
	}

	// Optimizing automatically happens with the call to addIndexes
	//coreWriter->optimize();
	coreWriter->close();

#ifdef CLUCENE2
	d = FSDirectory::getDirectory(target.c_str());
#endif
	if (IndexReader::indexExists(target.c_str())) {
#ifndef CLUCENE2
		d = FSDirectory::getDirectory(target.c_str(), false);
#endif
		if (IndexReader::isLocked(d)) {
			IndexReader::unlock(d);
		}
		fsWriter = new IndexWriter( d, an, false);
	}
	else {
#ifndef CLUCENE2
		d = FSDirectory::getDirectory(target.c_str(), true);
#endif
		fsWriter = new IndexWriter(d, an, true);
	}

	Directory *dirs[] = { ramDir, 0 };
#ifdef CLUCENE2
	lucene::util::ConstValueArray< lucene::store::Directory *>dirsa(dirs, 1);
	fsWriter->addIndexes(dirsa);
#else
	fsWriter->addIndexes(dirs);
#endif
	fsWriter->close();

	delete ramDir;
	delete coreWriter;
	delete fsWriter;
	delete an;

	// reposition module back to where it was before we were called
	setKey(*saveKey);

	if (!saveKey->isPersist())
		delete saveKey;

	if (searchKey)
		delete searchKey;

	delete chapMax;

	setProcessEntryAttributes(savePEA);

	// reset option filters back to original values
	StringList::iterator origVal = filterSettings.begin();
	for (OptionFilterList::iterator filter = optionFilters->begin(); filter != optionFilters->end(); filter++) {
		(*filter)->setOptionValue(*origVal++);
	}

	return 0;
#else
	return SWSearchable::createSearchFramework(percent, percentUserData);
#endif
}

SWORD_NAMESPACE_END
