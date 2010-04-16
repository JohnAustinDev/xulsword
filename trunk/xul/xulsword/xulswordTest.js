// JavaScript Document
/*
getLocation                 tested
getBookName                 tested
getChapterNumber            tested
getVerseSystem              tested
setBiblesReference              tested
setVerse                    tested
getChapter                  tested
getVerseNumber              tested
getLastVerseNumber          tested
getChapterText              tested
getChapterTextMulti         tested                    
getVerseText                tested
getMaxVerse                 tested
convertLocation             tested

getModuleInformation        tested
getModuleList               test with MK

getBookIntroduction         test with MK
getDictionaryEntry          test with MK
getAllDictionaryKeys        test with MK
getGenBookTableOfContents   test with MK
getGenBookChapterText       test with MK
getFootnotes                test with MK
getCrossRefs                test with MK
getNotes                    test with MK

search                      test with MK
searchIndexBuild            test with MK
getSearchTexts              test with MK
searchIndexDelete           test with MK (close search window during index creation, and lucene folder should be deleted)
luceneEnabled               test with MK (does "create index" button appear when it should?)

setGlobalOption             test with MK
getGlobalOption             test with MK

setCipherKey                test with MK
*/


var NumFailed = 0;
var B = Components.classes["@xulsword.com/xulsword/xulsword;1"].createInstance(Components.interfaces.ixulsword);
if (B.getModuleList() == "No Modules") B=null;

B.setBiblesReference("ESV", "Matt.4");
testLocs(1, "ESV", "Matt", 4, 1, 25, "KJV");
jsdump("\n");

B.setBiblesReference("ESV", "Matt.2.3");
testLocs(2, "ESV", "Matt", 2, 3, 3, "KJV");
jsdump("\n");

B.setBiblesReference("ESV", "Matt.3.5.8");
testLocs(3, "ESV", "Matt", 3, 5, 8, "KJV");
jsdump("\n");

B.setBiblesReference("ESV", "Ps.119");
testLocs(4, "UZV", "Ps", 118, 1, 176, "EASTERN");
jsdump("\n");

B.setBiblesReference("ESV", "Ps.25.3");
testLocs(5, "UZV", "Ps", 24, 3, 3, "EASTERN");
jsdump("\n");

B.setBiblesReference("ESV", "Ps.22.9.12");
testLocs(6, "UZV", "Ps", 21, 10, 13, "EASTERN");
jsdump("\n");

B.setBiblesReference("UZV", "Ps.118");
testLocs(7, "ESV", "Ps", 119, 1, 176, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps.24.3");
testLocs(8, "ESV", "Ps", 25, 3, 3, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps.21.10.13");
testLocs(9, "ESV", "Ps", 22, 9, 12, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps.114.1-Ps.114.2");
testLocs(10, "ESV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps.114.1 - Ps.114.2");
testLocs(11, "ESV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps 109");
testLocs(12, "ESV", "Ps", 110, 1, 7, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps 110:6");
testLocs(13, "ESV", "Ps", 111, 6, 6, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps 113:2-7");
testLocs(14, "ESV", "Ps", 114, 2, 7, "KJV");
jsdump("\n");

B.setBiblesReference("UZV", "Ps 113:10-Ps 113:20");
testLocs(15, "ESV", "Ps", 115, 2, 12, "KJV");
jsdump("\n");

test (16, B.getModuleInformation("UZV", "GlobalOptionFilter"), "OSISFootnotes<nx>OSISHeadings<nx>OSISScripref<nx>OSISDictionary");

test(46, B.convertLocation(WESTERNVS, "Matt.4", EASTERNVS), "Matt.4.1.25");
jsdump("\n");

test(47, B.convertLocation(WESTERNVS, "Matt.2.3", EASTERNVS), "Matt.2.3.3");
jsdump("\n");

test(48, B.convertLocation(WESTERNVS, "Matt.3.5.8", EASTERNVS), "Matt.3.5.8");
jsdump("\n");

test(49, B.convertLocation(WESTERNVS, "Ps.119", EASTERNVS), "Ps.118.1.176");
jsdump("\n");

test(50, B.convertLocation(WESTERNVS, "Ps.25.3", EASTERNVS), "Ps.24.3.3");
jsdump("\n");

test(51, B.convertLocation(WESTERNVS, "Ps.22.9.12", EASTERNVS), "Ps.21.10.13");
jsdump("\n");

test(52, B.convertLocation(EASTERNVS, "Ps.118", WESTERNVS), "Ps.119.1.176");
jsdump("\n");

test(53, B.convertLocation(EASTERNVS, "Ps.24.3", WESTERNVS), "Ps.25.3.3");
jsdump("\n");

test(54, B.convertLocation(EASTERNVS, "Ps.21.10.13", WESTERNVS), "Ps.22.9.12");
jsdump("\n");

test(55, B.convertLocation(EASTERNVS, "1Kgs.6.1-1Kgs.6.18", WESTERNVS), "1Kgs.6.1.18");
jsdump("\n");

test(56, B.convertLocation(EASTERNVS, "Ps.114.1 - Ps.114.2", WESTERNVS), "Ps.116.1.2");
jsdump("\n");

test(57, B.convertLocation(EASTERNVS, "Ps 109", WESTERNVS), "Ps.110.1.7");
jsdump("\n");

test(58, B.convertLocation(EASTERNVS, "Ps 110:6", WESTERNVS), "Ps.111.6.6");
jsdump("\n");

test(59, B.convertLocation(EASTERNVS, "Ps 113:2-7", WESTERNVS), "Ps.114.2.7");
jsdump("\n");

test(60, B.convertLocation(EASTERNVS, "Ps 113:10-Ps 113:20", WESTERNVS), "Ps.115.2.12");
jsdump("\n");

B.setBiblesReference("ESV", "Rev 12:2");
B.setVerse("ESV", 6, 8);
test(61, B.getChapter("ESV"), "Rev 12");
test(62, B.getVerseNumber("ESV"), "6");
test(63, B.getLastVerseNumber("ESV"), "8");
jsdump("\n");

B.setVerse("ESV", 6, 5);
test(64, B.getChapter("ESV"), "Rev 12");
test(65, B.getVerseNumber("ESV"), "6");
test(66, B.getLastVerseNumber("ESV"), "6");
jsdump("\n");

B.setVerse("ESV", 6, 6);
test(67, B.getChapter("ESV"), "Rev 12");
test(68, B.getVerseNumber("ESV"), "6");
test(69, B.getLastVerseNumber("ESV"), "6");
jsdump("\n");

B.setVerse("ESV", -1, 6);
test(70, B.getChapter("ESV"), "Rev 12");
test(71, B.getVerseNumber("ESV"), "17");
test(72, B.getLastVerseNumber("ESV"), "17");
jsdump("\n");

B.setVerse("ESV", 1, -1);
test(73, B.getChapter("ESV"), "Rev 12");
test(74, B.getVerseNumber("ESV"), "1");
test(75, B.getLastVerseNumber("ESV"), "17");
jsdump("\n");

B.setVerse("ESV", 0, 0);
test(76, B.getChapter("ESV"), "Rev 12");
test(77, B.getVerseNumber("ESV"), "1");
test(78, B.getLastVerseNumber("ESV"), "1");
jsdump("\n");

B.setVerse("ESV", 3, 9);
test(79, B.getChapter("ESV"), "Rev 12");
test(80, B.getVerseNumber("ESV"), "3");
test(81, B.getLastVerseNumber("ESV"), "9");
jsdump("\n");

test(82, B.getMaxVerse("ESV", "Ps 119"), 176);
test(83, B.getMaxVerse("ESV", "Ps 119:4"), 176);
test(84, B.getMaxVerse("ESV", "Ps 119:6-10"), 176);
test(85, B.getMaxVerse("ESV", "Ps.119"), 176);
test(86, B.getMaxVerse("ESV", "Ps.119.24"), 176);
test(87, B.getMaxVerse("ESV", "Ps.119.100.120"), 176);
test(88, B.getMaxVerse("UZV", "Ps 118"), 176);
test(89, B.getMaxVerse("UZV", "Ps 118:4"), 176);
test(90, B.getMaxVerse("UZV", "Ps 118:6-10"), 176);
test(91, B.getMaxVerse("UZV", "Ps.118"), 176);
test(92, B.getMaxVerse("UZV", "Ps.118.24"), 176);
test(93, B.getMaxVerse("UZV", "Ps.118.100.120"), 176);

function testLocs(tn, vers, bk, ch, vs, lv, sys) {
  test(tn + "a", B.getChapter(vers), bk + " " + ch);
  test(tn + "b", B.getBookName(vers), bk);
  test(tn + "c", B.getChapterNumber(vers), ch);
  test(tn + "d", B.getVerseNumber(vers), vs);
  test(tn + "e", B.getLastVerseNumber(vers), lv);
  test(tn + "f", B.getLocation(vers), bk + "." + ch + "." + vs + "." +lv);
  test(tn + "g", B.getVerseSystem(vers), sys);
}

function test(testNum, result, expectedResult) {
  if (result == expectedResult) jsdump("Test #:" + testNum + " Passed (" + result + ")\n");
  else {
    jsdump("Test #:" + testNum + " FAILED (expected:" + expectedResult + " got:" + result + ")\n");
    NumFailed++;
  }
}

if (NumFailed) 
  jsdump("xulswordText.js " + NumFailed + " FAILURES found.\n");
else 
  jsdump("CONGRATS!!!! ITS WORKING PERFECTLY!!!!\n");


