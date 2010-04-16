/******************************************************************************
 *
 * $Id: gbfhtmlhref.h 1688 2005-01-01 04:42:26Z scribe $
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
 * modified:  2009 by John Austin  
 *
 */

#ifndef GBFHTMLXUL_H
#define GBFHTMLXUL_H

#include <swbasicfilter.h>

SWORD_NAMESPACE_START

/** this filter converts GBF  text to HTML text with hrefs
 */
class SWDLLEXPORT GBFHTMLXUL : public SWBasicFilter {
protected:
	class MyUserData : public BasicFilterUserData {
	public:
		MyUserData(const SWModule *module, const SWKey *key);
		bool hasFootnotePreTag;
		SWBuf version;
	};
	virtual BasicFilterUserData *createUserData(const SWModule *module, const SWKey *key) {
		return new MyUserData(module, key);
	}
	virtual bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);
	//void getLastStrongsTag(SWBuf &buf, const char *token, bool *success, bool *append, int *p1, int *p2);
public:
	GBFHTMLXUL();
};

SWORD_NAMESPACE_END
#endif
