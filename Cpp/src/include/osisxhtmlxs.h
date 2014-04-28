/******************************************************************************
 *
 *  osisxhtml.h -	Render filter for classed XHTML of an OSIS module
 *
 * $Id: osisxhtml.h 2833 2013-06-29 06:40:28Z chrislit $
 *
 * Copyright 2011-2013 CrossWire Bible Society (http://www.crosswire.org)
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

#ifndef OSISXHTMLXS_H
#define OSISXHTMLXS_H

#include <swbasicfilter.h>

SWORD_NAMESPACE_START

/** this filter converts OSIS text to classed XHTML
 */
class OSISXHTMLXS : public SWBasicFilter {
protected:

	class TagStack;
	// used by derived classes so we have it in the header
	virtual BasicFilterUserData *createUserData(const SWModule *module, const SWKey *key);
	virtual bool handleToken(SWBuf &buf, const char *token, BasicFilterUserData *userData);


	class MyUserDataXS : public BasicFilterUserData {
	public:
		bool osisQToTick;
		bool inXRefNote;
		bool BiblicalText;
		int suspendLevel;
		SWBuf wordsOfChristStart;
		SWBuf wordsOfChristEnd;
		bool wordsOfChrist;
		TagStack *quoteStack;
		TagStack *hiStack;
		TagStack *titleStack;
		TagStack *lineStack;
		int consecutiveNewlines;
		SWBuf lastTransChange;
		SWBuf w;
		SWBuf fn;
		SWBuf version;

		// variables unique to OSISXHTMLXS
		SWBuf referenceTag;
		TagStack *htmlTagStack; // used to insure rendered HTML tags are all closed
		TagStack *pStack; // used for OSIS <p subType="x-???"> to render them as HTML <p>

		MyUserDataXS(const SWModule *module, const SWKey *key);
		~MyUserDataXS();
	};

public:
	OSISXHTMLXS();
	void outHtmlTag(const char * t, SWBuf &o, MyUserDataXS *u);

	// redefinition of virtual function defined in SWBasicFilter
	char processText(SWBuf &text, const SWKey *key = 0, const SWModule *module = 0);
};

SWORD_NAMESPACE_END
#endif
