/*
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

#ifdef _MSC_VER
	#pragma warning( disable: 4251 )
#endif

#include <string>
#include <vector>
#include <fstream>
#include <iostream>
#include <rawld.h>
#include <rawld4.h>
#include <zld.h>
#include <zipcomprs.h>
#include <stdio.h>

using std::string;

#ifndef NO_SWORD_NAMESPACE
using namespace sword;
#endif


int main(int argc, char **argv) {

	const char * helptext ="imp2ld 1.0 Lexicon/Dictionary/Daily Devotional/Glossary module creation tool for the SWORD Project\n  usage:\n   %s <filename> [modname] [ 4 (default) | 2 | z - module driver] [entries per compression block]\n";

	signed long i = 0;
	string keybuffer;
	string entbuffer;
	string linebuffer;
	char modname[16];
	char links = 0;
	long blockCount = 30;
	std::vector<string> linkbuffer;

	if (argc > 2) {
		strcpy (modname, argv[2]);
	}
	else if (argc > 1) {
		for (i = 0; (i < 16) && (argv[1][i]) && (argv[1][i] != '.'); i++) {
			modname[i] = argv[1][i];
		}
		modname[i] = 0;
	}
	else {
		fprintf(stderr, helptext, argv[0]);
		exit(-1);
	}

	std::ifstream infile(argv[1]);

	char mode = 1;
	if (argc > 3) {
		switch (*argv[3]) {
			case 'z': mode = 3; break;
			case '2': mode = 2; break;
			default: mode = 1;
		}
	}

	if (argc > 4) {
		long bcTemp = atoi(argv[4]);
		if (bcTemp > 0) {
			blockCount = bcTemp;
		}
	}

	SWModule *mod = 0;
	SWKey *key, *linkKey;

	switch (mode) {
	case 3:
#ifndef EXCLUDEZLIB
		zLD::createModule(modname);
		mod = new zLD(modname, 0, 0, blockCount, new ZipCompress());
#else
		fprintf(stderr, "ERROR: %s: SWORD library not compiled with ZIP compression support.\n\tBe sure libzip is available when compiling SWORD library", *argv);
		exit(-2);
#endif
		break;
	case 2:
		RawLD::createModule(modname);
		mod = new RawLD(modname);
		break;
	case 1:
		RawLD4::createModule(modname);
		mod = new RawLD4(modname);
		break;
	}

	key = mod->CreateKey();
	linkKey = mod->CreateKey();
	key->Persist(1);
	mod->setKey(key);

	while (!infile.eof()) {
		std::getline(infile, linebuffer);
		if (linebuffer.size() > 3 && linebuffer.substr(0,3) == "$$$") {
			if (keybuffer.size() && entbuffer.size()) {
				std::cout << keybuffer << std::endl;
				*key = keybuffer.c_str();

				mod->setEntry(entbuffer.c_str(), entbuffer.size());
				for (i = 0; i < links; i++) {
					std::cout << "Linking: " << linkbuffer[i] << std::endl;
					*linkKey = linkbuffer[i].c_str();
					mod->linkEntry(linkKey);
				}
			}
			if (linebuffer.size() > 3)
				keybuffer = linebuffer.substr(3,linebuffer.size());

			entbuffer.resize(0);
			linkbuffer.clear();
			links = 0;
		}
		else if (linebuffer.size() > 3 && linebuffer.substr(0,3) == "%%%") {
			linkbuffer.push_back(linebuffer.substr(3,linebuffer.size()));
			links++;
		}
		else {
			entbuffer += linebuffer;
		}
	}

	//handle final entry
	if (keybuffer.size() && entbuffer.size()) {
		std::cout << keybuffer << std::endl;
		*key = keybuffer.c_str();

		mod->setEntry(entbuffer.c_str(), entbuffer.size());
		for (i = 0; i < links; i++) {
			std::cout << "Linking: " << linkbuffer[i] << std::endl;
			*linkKey = linkbuffer[i].c_str();
			mod->linkEntry(linkKey);
		}
	}

	infile.close();

	delete linkKey;
	delete key;
	delete mod;

	return 0;
}
