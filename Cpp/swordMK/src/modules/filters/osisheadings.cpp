/******************************************************************************
 *
 *osisheadings -	SWFilter descendant to hide or show headings
 *			in an OSIS module.
 *
 *
 * Copyright 2009 CrossWire Bible Society (http://www.crosswire.org)
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

#include <stdlib.h>
#include <stdio.h>
#include <osisheadings.h>
#include <swmodule.h>
#include <utilxml.h>
#include <utilstr.h>

SWORD_NAMESPACE_START

const char oName[] = "Headings";
const char oTip[] = "Toggles Headings On and Off if they exist";

const SWBuf choices[3] = {"Off", "On", ""};
const StringList oValues(&choices[0], &choices[2]);

OSISHeadings::OSISHeadings() : SWOptionFilter(oName, oTip, &oValues) {
	setOptionValue("Off");
}


OSISHeadings::~OSISHeadings() {
}


char OSISHeadings::processText(SWBuf &text, const SWKey *key, const SWModule *module) {
	SWBuf token;
	bool intoken    = false;
	bool hide       = false;
	bool preverse   = false;
	bool withinTitle = false;
	bool withinPreverseDiv = false;
	SWBuf preverseDivID = "";
	const char *pvDID = 0;
	bool canonical  = false;
	SWBuf header;
	int headerNum   = 0;
	int pvHeaderNum = 0;
	char buf[254];
	XMLTag startTag;

	SWBuf orig = text;
	const char *from = orig.c_str();
	
	XMLTag tag;

	for (text = ""; *from; ++from) {
		if (*from == '<') {
			intoken = true;
			token = "";
			
			continue;
		}
		if (*from == '>') {	// process tokens
			intoken = false;
			tag = token;
			
			if (!strcmp(tag.getName(), "title")) {withinTitle = !tag.isEndTag();}

			// <title> </title> <div subType="x-preverse"> (</div> ## when in previous)
			if ( (!withinPreverseDiv && !strcmp(tag.getName(), "title")) || 
				(!strcmp(tag.getName(), "div") &&
					((withinPreverseDiv && (tag.isEndTag(pvDID))) ||
					 (tag.getAttribute("subType") && !strcmp(tag.getAttribute("subType"), "x-preverse")))
				)) {

				//withinTitle = (!tag.isEndTag(pvDID));
				if (!strcmp(tag.getName(), "div")) {
					withinPreverseDiv = (!tag.isEndTag(pvDID));
					if (!pvDID) {
						preverseDivID = tag.getAttribute("sID");
						pvDID = (preverseDivID.length())? preverseDivID.c_str() : 0;
					}
				}
				
				if (!tag.isEndTag(pvDID)) { //start tag
					if (!tag.isEmpty() || pvDID) {
						startTag = tag;
					}
				}
				
				if ( !tag.isEndTag(pvDID) && (withinPreverseDiv 
					|| (tag.getAttribute("subType") && !stricmp(tag.getAttribute("subType"), "x-preverse"))
					|| (tag.getAttribute("subtype") && !stricmp(tag.getAttribute("subtype"), "x-preverse"))	// deprecated
						)) {
					hide = true;
					preverse = true;
					header = "";
					canonical = (tag.getAttribute("canonical") && (!stricmp(tag.getAttribute("canonical"), "true")));
					continue;
				}
				if (!tag.isEndTag(pvDID)) { //start tag
					hide = true;
					header = "";
					if (option || canonical) {	// we want the tag in the text
						text.append('<');
						text.append(token);
						text.append('>');
					}
					continue;
				}
				if (hide && tag.isEndTag(pvDID)) {
					if (module->isProcessEntryAttributes() && ((option || canonical) || (!preverse))) {
						if (preverse) {
							sprintf(buf, "%i", pvHeaderNum++);
							module->getEntryAttributes()["Heading"]["Preverse"][buf] = header;
						}
						else {
							sprintf(buf, "%i", headerNum++);
							module->getEntryAttributes()["Heading"]["Interverse"][buf] = header;
							if (option || canonical) {	// we want the tag in the text
								text.append(header);
							}
						}
						
						StringList attributes = startTag.getAttributeNames();
						for (StringList::const_iterator it = attributes.begin(); it != attributes.end(); it++) {
							module->getEntryAttributes()["Heading"][buf][it->c_str()] = startTag.getAttribute(it->c_str());
						}
					}
					
					hide = false;
					if (!(option || canonical) || preverse) {	// we don't want the tag in the text anymore
						preverse = false;
						continue;
					}
					preverse = false;
					pvDID = 0;
				}
			}

			if (withinTitle && strcmp(tag.getName(), "title")) {
				header.append('<');
				header.append(token);
				header.append('>');
			} else {
				// if not a heading token, keep token in text
				if (!hide) {
					text.append('<');
					text.append(token);
					text.append('>');
				}
			}
			continue;
		}
		if (intoken) { //copy token
			token.append(*from);
		}
		else if (!hide) { //copy text which is not inside a token
			text.append(*from);
		}
		else header.append(*from);
	}
	return 0;
}

SWORD_NAMESPACE_END

