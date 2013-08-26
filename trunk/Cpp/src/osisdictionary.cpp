/******************************************************************************
 * 
 * OSISDictionary
 *			modified:	2009 by John Austin
 *			SWFilter descendant to toggle links to words found in
 *			a dictionary.
 */


#include <stdlib.h>
#include <osisdictionary.h>
#include <utilxml.h>
#include <swmodule.h>


SWORD_NAMESPACE_START

const char oName[] = "Dictionary";
const char oTip[] = "Toggles links to words found in a dictionary.";

const SWBuf choices[3] = {"Off", "On", ""};
const StringList oValues(&choices[0], &choices[2]);

OSISDictionary::OSISDictionary() : SWOptionFilter(oName, oTip, &oValues) {
	setOptionValue("On");
}


OSISDictionary::~OSISDictionary() {
}


char OSISDictionary::processText(SWBuf &text, const SWKey *key, const SWModule *module) {
	if (option)
		return 0;
	
	SWBuf token;
	bool intoken		= false;
	bool stripThisToken = false;

	SWBuf orig = text;
	const char *from = orig.c_str();

	//taken out of the loop
	const char* start = 0;
	const char* end = 0;
		
	for (text = ""; *from; from++) {
		if (*from == '<') {
			intoken = true;
			token = "";
			continue;
		}
		else if (*from == '>') {	// process tokens
			intoken = false;
			if (strncmp(token, "reference", 9) && strncmp(token.c_str(), "/reference", 10)) {
				text.append('<');
				text.append(token);
				text.append('>');
			}
			else {
				XMLTag tag;
				tag = token;
				if (!tag.isEndTag() && tag.getAttribute("type") && !strcmp(tag.getAttribute("type"), "x-glossary")) {
					stripThisToken = true; 
					continue;
				}
				else if (tag.isEndTag() && stripThisToken) {
					stripThisToken = false; 
					continue;
				}
				text.append('<');
				text.append(token);
				text.append('>');
			}
			continue;
		}
		
		if (intoken) { //copy token
			token.append(*from);
		}
		else { //copy text which is not inside a token
			text.append(*from);
		}
	}
	return 0;
}

SWORD_NAMESPACE_END

