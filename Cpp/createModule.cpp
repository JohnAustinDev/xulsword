/******************************************************************************
 *  swmgr.cpp   - implementaion of class SWMgr used to interact with an install
 *				base of sword modules.
 *
 * $Id: swmgr.cpp 2680 2012-02-21 08:08:39Z scribe $
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
 
 /* This is just an exact copy of SWMgr's createModule, with an additional
 *  versification check added in for backward compatibility.
 */

#include <swmgr.h>
#include <rawtext.h>
#include <rawtext4.h>
#include <filemgr.h>
#include <rawgenbook.h>
#include <rawcom.h>
#include <rawcom4.h>
#include <hrefcom.h>
#include <rawld.h>
#include <rawld4.h>
#include <utilstr.h>
#include <gbfplain.h>
#include <thmlplain.h>
#include <osisplain.h>
#include <teiplain.h>
#include <papyriplain.h>
#include <gbfstrongs.h>
#include <gbffootnotes.h>
#include <gbfheadings.h>
#include <gbfredletterwords.h>
#include <gbfmorph.h>
#include <osisheadings.h>
#include <osisfootnotes.h>
#include <osisstrongs.h>
#include <osismorph.h>
#include <osislemma.h>
#include <osisredletterwords.h>
#include <osismorphsegmentation.h>
#include <osisruby.h>
#include <osisscripref.h>
#include <thmlstrongs.h>
#include <thmlfootnotes.h>
#include <thmlheadings.h>
#include <thmlmorph.h>
#include <thmlvariants.h>
#include <thmllemma.h>
#include <thmlscripref.h>
#include <cipherfil.h>
#include <rawfiles.h>
#include <ztext.h>
#include <zld.h>
#include <zcom.h>
#include <lzsscomprs.h>
#include <utf8greekaccents.h>
#include <utf8cantillation.h>
#include <utf8hebrewpoints.h>
#include <utf8arabicpoints.h>
#include <greeklexattribs.h>
#include <swfiltermgr.h>
#include <swcipher.h>
#include <swoptfilter.h>
#include <rtfhtml.h>

#include <swlog.h>

#include <iterator>

#ifndef EXCLUDEZLIB
#include "zipcomprs.h"
#endif


#ifdef _ICU_
#include <utf8transliterator.h>
#endif

SWORD_NAMESPACE_START

SWModule *SWMgrXS::createModule(const char *name, const char *driver, ConfigEntMap &section)
{
	SWBuf description, datapath, misc1;
	ConfigEntMap::iterator entry;
	SWModule *newmod = 0;
	SWBuf lang, sourceformat, encoding;
	signed char direction, enc, markup;

	description  = ((entry = section.find("Description")) != section.end()) ? (*entry).second : (SWBuf)"";
	lang  = ((entry = section.find("Lang")) != section.end()) ? (*entry).second : (SWBuf)"en";
 	sourceformat = ((entry = section.find("SourceType"))  != section.end()) ? (*entry).second : (SWBuf)"";
 	encoding = ((entry = section.find("Encoding"))  != section.end()) ? (*entry).second : (SWBuf)"";
	datapath = prefixPath;
	if ((prefixPath[strlen(prefixPath)-1] != '\\') && (prefixPath[strlen(prefixPath)-1] != '/'))
		datapath += "/";

	SWBuf versification = ((entry = section.find("Versification"))  != section.end()) ? (*entry).second : (SWBuf)"KJV";

//EDIT!
	// FOR BACKWARD COMPATIBILITY
	// sword-1.6.1 Synodal canon was missing Psalms 114:9, but we need to detect and it continue its support
	if (versification == "Synodal") {
		SWBuf minvers = ((entry = section.find("MinimumVersion"))  != section.end()) ? (*entry).second : (SWBuf)"1.6.1";
		if (minvers == "1.6.1") {versification = "Synodal0";}
	}
//EDIT-END

	// DataPath - relative path to data used by module driver.  May be a directory, may be a File.
	//   Typically not useful by outside world.  See AbsoluteDataPath, PrefixPath, and RelativePrefixPath
	//   below.
	misc1 += ((entry = section.find("DataPath")) != section.end()) ? (*entry).second : (SWBuf)"";
	char *buf = new char [ strlen(misc1.c_str()) + 1 ];
	char *buf2 = buf;
	strcpy(buf, misc1.c_str());
//	for (; ((*buf2) && ((*buf2 == '.') || (*buf2 == '/') || (*buf2 == '\\'))); buf2++);
	for (; ((*buf2) && ((*buf2 == '/') || (*buf2 == '\\'))); buf2++);
	if (!strncmp(buf2, "./", 2)) { //remove the leading ./ in the module data path to make it look better
		buf2 += 2;
	}
	// PrefixPath - absolute directory path to the repository in which this module was found
	section["PrefixPath"] = datapath;
	if (*buf2)
		datapath += buf2;
	delete [] buf;

	section["AbsoluteDataPath"] = datapath;

	if (!stricmp(sourceformat.c_str(), "GBF"))
		markup = FMT_GBF;
	else if (!stricmp(sourceformat.c_str(), "ThML"))
		markup = FMT_THML;
	else if (!stricmp(sourceformat.c_str(), "OSIS"))
		markup = FMT_OSIS;
	else if (!stricmp(sourceformat.c_str(), "TEI"))
		markup = FMT_TEI;
	else
		markup = FMT_GBF;

	if (!stricmp(encoding.c_str(), "UTF-8")) {
		enc = ENC_UTF8;
	}
	else enc = ENC_LATIN1;

	if ((entry = section.find("Direction")) == section.end()) {
		direction = DIRECTION_LTR;
	}
	else if (!stricmp((*entry).second.c_str(), "rtol")) {
		direction = DIRECTION_RTL;
	}
	else if (!stricmp((*entry).second.c_str(), "bidi")) {
		direction = DIRECTION_BIDI;
	}
	else {
		direction = DIRECTION_LTR;
	}

	if ((!stricmp(driver, "zText")) || (!stricmp(driver, "zCom"))) {
		SWCompress *compress = 0;
		int blockType = CHAPTERBLOCKS;
		misc1 = ((entry = section.find("BlockType")) != section.end()) ? (*entry).second : (SWBuf)"CHAPTER";
		if (!stricmp(misc1.c_str(), "VERSE"))
			blockType = VERSEBLOCKS;
		else if (!stricmp(misc1.c_str(), "CHAPTER"))
			blockType = CHAPTERBLOCKS;
		else if (!stricmp(misc1.c_str(), "BOOK"))
			blockType = BOOKBLOCKS;

		misc1 = ((entry = section.find("CompressType")) != section.end()) ? (*entry).second : (SWBuf)"LZSS";
#ifndef EXCLUDEZLIB
		if (!stricmp(misc1.c_str(), "ZIP"))
			compress = new ZipCompress();
		else
#endif
		if (!stricmp(misc1.c_str(), "LZSS"))
			compress = new LZSSCompress();

		if (compress) {
			if (!stricmp(driver, "zText"))
				newmod = new zText(datapath.c_str(), name, description.c_str(), blockType, compress, 0, enc, direction, markup, lang.c_str(), versification);
			else	newmod = new zCom(datapath.c_str(), name, description.c_str(), blockType, compress, 0, enc, direction, markup, lang.c_str(), versification);
		}
	}

	if (!stricmp(driver, "RawText")) {
		newmod = new RawText(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawText4")) {
		newmod = new RawText4(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	// backward support old drivers
	if (!stricmp(driver, "RawGBF")) {
		newmod = new RawText(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str());
	}

	if (!stricmp(driver, "RawCom")) {
		newmod = new RawCom(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawCom4")) {
		newmod = new RawCom4(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), versification);
	}

	if (!stricmp(driver, "RawFiles")) {
		newmod = new RawFiles(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str());
	}

	if (!stricmp(driver, "HREFCom")) {
		misc1 = ((entry = section.find("Prefix")) != section.end()) ? (*entry).second : (SWBuf)"";
		newmod = new HREFCom(datapath.c_str(), misc1.c_str(), name, description.c_str());
	}

        int pos = 0;  //used for position of final / in AbsoluteDataPath, but also set to 1 for modules types that need to strip module name
	if (!stricmp(driver, "RawLD")) {
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		newmod = new RawLD(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), caseSensitive);
                pos = 1;
        }

	if (!stricmp(driver, "RawLD4")) {
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		newmod = new RawLD4(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), caseSensitive);
                pos = 1;
        }

	if (!stricmp(driver, "zLD")) {
		SWCompress *compress = 0;
		int blockCount;
		bool caseSensitive = ((entry = section.find("CaseSensitiveKeys")) != section.end()) ? (*entry).second == "true": false;
		misc1 = ((entry = section.find("BlockCount")) != section.end()) ? (*entry).second : (SWBuf)"200";
		blockCount = atoi(misc1.c_str());
		blockCount = (blockCount) ? blockCount : 200;

		misc1 = ((entry = section.find("CompressType")) != section.end()) ? (*entry).second : (SWBuf)"LZSS";
#ifndef EXCLUDEZLIB
		if (!stricmp(misc1.c_str(), "ZIP"))
			compress = new ZipCompress();
		else
#endif
		if (!stricmp(misc1.c_str(), "LZSS"))
			compress = new LZSSCompress();

		if (compress) {
			newmod = new zLD(datapath.c_str(), name, description.c_str(), blockCount, compress, 0, enc, direction, markup, lang.c_str(), caseSensitive);
		}
		pos = 1;
	}

	if (!stricmp(driver, "RawGenBook")) {
		misc1 = ((entry = section.find("KeyType")) != section.end()) ? (*entry).second : (SWBuf)"TreeKey";
		newmod = new RawGenBook(datapath.c_str(), name, description.c_str(), 0, enc, direction, markup, lang.c_str(), misc1.c_str());
		pos = 1;
	}

	if (pos == 1) {
		SWBuf &dp = section["AbsoluteDataPath"];
		for (int i = dp.length() - 1; i; i--) {
			if (dp[i] == '/') {
				dp.setSize(i);
				break;
			}
		}
/*
		SWBuf &rdp = section["RelativeDataPath"];
		for (int i = rdp.length() - 1; i; i--) {
			if (rdp[i] == '/') {
				rdp.setSize(i);
				break;
			}
		}
*/
	}

	if (newmod) {
		// if a specific module type is set in the config, use this
		if ((entry = section.find("Type")) != section.end())
			newmod->Type(entry->second.c_str());

		newmod->setConfig(&section);
	}

	return newmod;
}

SWORD_NAMESPACE_END