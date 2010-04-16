osis2mod.cpp:
Added the following line to the beginning of the "writeLinks()" routine:
if (!strcmp(currentVerse.getVersificationSystem(), "EASTERN")) {return;} // Don't link EASTERN mods for backward compatibility to pre MK 2.13 versions

emptyvss.cpp:
Added "<< "shortName=" << vkey->getBookAbbrev()" to output logging so that shortName could be parsed out.