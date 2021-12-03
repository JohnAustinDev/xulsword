// JavaScript Document
/*
getLocation                 tested
getBookName                 tested
getChapterNumber            tested
getVerseSystem              tested
setBiblesReference          tested
setVerse                    tested
getChapter                  tested
getVerseNumber              tested
getLastVerseNumber          tested
getChapterText              tested
getChapterTextMulti         tested                    
getVerseText                tested
getMaxVerse                 tested
getMaxChapter               tested
convertLocation             tested

getModuleInformation        tested
getModuleList               tested

getIntroductions            tested
getDictionaryEntry          tested
getAllDictionaryKeys        tested
getGenBookTableOfContents   tested
getGenBookChapterText       tested
getFootnotes                test with xulsword
getCrossRefs                test with xulsword
getNotes                    test with xulsword

search                      test with xulsword
searchIndexBuild            test with xulsword
getSearchResults            test with xulsword
searchIndexDelete           test with xulsword (close search window during index creation, and lucene folder should be deleted)
luceneEnabled               test with xulsword (does "create index" button appear when it should?)

setGlobalOption             test with xulsword
getGlobalOption             test with xulsword

setCipherKey                test with xulsword
*/
require('../../../napi/libsword');
require('../location');


function jsdump(str) {
  console.log(str);
}

LibSword.initLibsword();

var NumFailed = 0;
if (LibSword.getModuleList() == "No Modules") {
  LibSword.quitLibsword();
  throw("No Modules loaded.");
}

jsdump("Need KJV and UZV, have " + LibSword.getModuleList());

Location.setLocation("KJV", "Matt.4");
testLocs(1, "KJV", "Matt", 4, 1, 25, "KJV");
jsdump("\n");

Location.setLocation("KJV", "Matt.2.3");
testLocs(2, "KJV", "Matt", 2, 3, 3, "KJV");
jsdump("\n");

Location.setLocation("KJV", "Matt.3.5.8");
testLocs(3, "KJV", "Matt", 3, 5, 8, "KJV");
jsdump("\n");

Location.setLocation("KJV", "Ps.119");
testLocs(4, "UZV", "Ps", 118, 1, 176, "Synodal");
jsdump("\n");

Location.setLocation("KJV", "Ps.25.3");
testLocs(5, "UZV", "Ps", 24, 3, 3, "Synodal");
jsdump("\n");

Location.setLocation("KJV", "Ps.22.9.12");
testLocs(6, "UZV", "Ps", 21, 10, 13, "Synodal");
jsdump("\n");

Location.setLocation("UZV", "Ps.118");
testLocs(7, "KJV", "Ps", 119, 1, 176, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps.24.3");
testLocs(8, "KJV", "Ps", 25, 3, 3, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps.21.10.13");
testLocs(9, "KJV", "Ps", 22, 9, 12, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps.114.1-Ps.114.2");
testLocs(10, "KJV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps.114.1 - Ps.114.2");
testLocs(11, "KJV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps 109");
testLocs(12, "KJV", "Ps", 110, 1, 7, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps 110:6");
testLocs(13, "KJV", "Ps", 111, 6, 6, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps 113:2-7");
testLocs(14, "KJV", "Ps", 114, 2, 7, "KJV");
jsdump("\n");

Location.setLocation("UZV", "Ps 113:10-Ps 113:20");
testLocs(15, "KJV", "Ps", 115, 2, 12, "KJV");
jsdump("\n");

test (16, LibSword.getModuleInformation("UZV", "GlobalOptionFilter"), "OSISFootnotes<nx>OSISHeadings<nx>OSISScripref<nx>OSISDictionary");

test(46, Location.convertLocation("KJV", "Matt.4", "Synodal"), "Matt.4.1.25");
jsdump("\n");

test(47, Location.convertLocation("KJV", "Matt.2.3", "Synodal"), "Matt.2.3.3");
jsdump("\n");

test(48, Location.convertLocation("KJV", "Matt.3.5.8", "Synodal"), "Matt.3.5.8");
jsdump("\n");

test(49, Location.convertLocation("KJV", "Ps.119", "Synodal"), "Ps.118.1.176");
jsdump("\n");

test(50, Location.convertLocation("KJV", "Ps.25.3", "Synodal"), "Ps.24.3.3");
jsdump("\n");

test(51, Location.convertLocation("KJV", "Ps.22.9.12", "Synodal"), "Ps.21.10.13");
jsdump("\n");

test(52, Location.convertLocation("Synodal", "Ps.118", "KJV"), "Ps.119.1.176");
jsdump("\n");

test(53, Location.convertLocation("Synodal", "Ps.24.3", "KJV"), "Ps.25.3.3");
jsdump("\n");

test(54, Location.convertLocation("Synodal", "Ps.21.10.13", "KJV"), "Ps.22.9.12");
jsdump("\n");

test(55, Location.convertLocation("Synodal", "1Kgs.6.1-1Kgs.6.18", "KJV"), "1Kgs.6.1.18");
jsdump("\n");

test(56, Location.convertLocation("Synodal", "Ps.114.1 - Ps.114.2", "KJV"), "Ps.116.1.2");
jsdump("\n");

test(57, Location.convertLocation("Synodal", "Ps 109", "KJV"), "Ps.110.1.7");
jsdump("\n");

test(58, Location.convertLocation("Synodal", "Ps 110:6", "KJV"), "Ps.111.6.6");
jsdump("\n");

test(59, Location.convertLocation("Synodal", "Ps 113:2-7", "KJV"), "Ps.114.2.7");
jsdump("\n");

test(60, Location.convertLocation("Synodal", "Ps 113:10-Ps 113:20", "KJV"), "Ps.115.2.12");
jsdump("\n");

Location.setLocation("KJV", "Rev 12:2");
Location.setVerse("KJV", 6, 8);
test(61, Location.getChapter("KJV"), "Rev 12");
test(62, Location.getVerseNumber("KJV"), "6");
test(63, Location.getLastVerseNumber("KJV"), "8");
jsdump("\n");

Location.setVerse("KJV", 6, 5);
test(64, Location.getChapter("KJV"), "Rev 12");
test(65, Location.getVerseNumber("KJV"), "6");
test(66, Location.getLastVerseNumber("KJV"), "6");
jsdump("\n");

Location.setVerse("KJV", 6, 6);
test(67, Location.getChapter("KJV"), "Rev 12");
test(68, Location.getVerseNumber("KJV"), "6");
test(69, Location.getLastVerseNumber("KJV"), "6");
jsdump("\n");

Location.setVerse("KJV", -1, 6);
test(70, Location.getChapter("KJV"), "Rev 12");
test(71, Location.getVerseNumber("KJV"), "17");
test(72, Location.getLastVerseNumber("KJV"), "17");
jsdump("\n");

Location.setVerse("KJV", 1, -1);
test(73, Location.getChapter("KJV"), "Rev 12");
test(74, Location.getVerseNumber("KJV"), "1");
test(75, Location.getLastVerseNumber("KJV"), "17");
jsdump("\n");

Location.setVerse("KJV", 0, 0);
test(76, Location.getChapter("KJV"), "Rev 12");
test(77, Location.getVerseNumber("KJV"), "0");
test(78, Location.getLastVerseNumber("KJV"), "0");
jsdump("\n");

Location.setVerse("KJV", 3, 9);
test(79, Location.getChapter("KJV"), "Rev 12");
test(80, Location.getVerseNumber("KJV"), "3");
test(81, Location.getLastVerseNumber("KJV"), "9");
jsdump("\n");

test(82, LibSword.getMaxVerse("KJV", "Ps 119"), 176);
test(83, LibSword.getMaxVerse("KJV", "Ps 119:4"), 176);
test(84, LibSword.getMaxVerse("KJV", "Ps 119:6-10"), 176);
test(85, LibSword.getMaxVerse("KJV", "Ps.119"), 176);
test(86, LibSword.getMaxVerse("KJV", "Ps.119.24"), 176);
test(87, LibSword.getMaxVerse("KJV", "Ps.119.100.120"), 176);
test(88, LibSword.getMaxVerse("UZV", "Ps 118"), 176);
test(89, LibSword.getMaxVerse("UZV", "Ps 118:4"), 176);
test(90, LibSword.getMaxVerse("UZV", "Ps 118:6-10"), 176);
test(91, LibSword.getMaxVerse("UZV", "Ps.118"), 176);
test(92, LibSword.getMaxVerse("UZV", "Ps.118.24"), 176);
test(93, LibSword.getMaxVerse("UZV", "Ps.118.100.120"), 176);

test(94, LibSword.getMaxChapter("KJV", "Ps"), 150);
test(95, LibSword.getMaxChapter("KJV", "Ps.49"), 150);
test(96, LibSword.getMaxChapter("UZV", "Ps"), 151);
test(97, LibSword.getMaxChapter("UZV", "Ps.49"), 151);

test(98, LibSword.search("KJV", "be.*t.*",             "John",  0 /* regex */,  0, true), 296);
test(99, LibSword.getSearchResults("KJV", 2, 1, false).match(/title=\"[^\"]+\"/g)[0], 'title="John.1.7.KJV"');

results = [
  'title="John.2.22.KJV"',
  'title="John.3.34.KJV"',
  'title="John.4.41.KJV"',
  'title="John.4.50.KJV"',
  'title="John.5.24.KJV"'
];


for (let index = 0; index < LibSword.search("KJV", "word", "John",  1, 0, true); index++) {
  var searchResult = LibSword.getSearchResults("KJV", index, 1, false, 0, false);
  test(100, searchResult.match(/title=\"[^\"]+\"/g)[0], results[index]);
  if (index > 4) break;
}

test(101, LibSword.search("KJV", "shineth in darkness", "John",  2 /* multi */,  0, true),   1);
test(102, LibSword.getSearchPointer(), 1);

// char *getSearchResults(const char *mod, int first, int num, bool keepStrongs, ListKey *searchPointer = NULL, bool referencesOnly = false);
test(103, LibSword.getSearchResults("KJV", 0, 1, false), "bogus");

function testLocs(tn, vers, bk, ch, vs, lv, sys) {
  test(tn + "a", Location.getChapter(vers), bk + " " + ch);
  test(tn + "b", Location.getBookName(vers), bk);
  test(tn + "c", Location.getChapterNumber(vers), ch);
  test(tn + "d", Location.getVerseNumber(vers), vs);
  test(tn + "e", Location.getLastVerseNumber(vers), lv);
  test(tn + "f", Location.getLocation(vers), bk + "." + ch + "." + vs + "." +lv);
  test(tn + "g", LibSword.getVerseSystem(vers), sys);
}

function test(testNum, result, expectedResult) {
  if (result == expectedResult) jsdump("Test #:" + testNum + " Passed (" + result + ")\n");
  else {
    jsdump("Test #:" + testNum + " FAILED (expected:" + expectedResult + " got:" + result + ")\n");
    NumFailed++;
  }
}

if (NumFailed) {
  jsdump("xulswordText.js " + NumFailed + " FAILURES found.\n");
}
else {
  jsdump("CONGRATS!!!! ITS WORKING PERFECTLY!!!!\n");
}

jsdump("getModuleList=" + LibSword.getModuleList());
jsdump("getIntroductions=" + LibSword.getIntroductions("UZV", "Matt"));
jsdump("getDictionaryEntry БАШАН=" + LibSword.getDictionaryEntry("UZDOT", "БАШАН"));
jsdump("getAllDictionaryKeys=" + LibSword.getAllDictionaryKeys("UZDOT"));
jsdump("getGenBookTableOfContents=" + LibSword.getGenBookTableOfContents("Pilgrim"));
jsdump("getGenBookChapterText=" + LibSword.getGenBookChapterText("Pilgrim", "/PART II/PREFACE"));

LibSword.quitLibsword();
