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
convertLocation             tested

getModuleInformation        tested
getModuleList               tested

getBookIntroduction         tested
getDictionaryEntry          tested
getAllDictionaryKeys        tested
getGenBookTableOfContents   tested
getGenBookChapterText       tested
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

function jsdump(str)
{
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

var NumFailed = 0;
if (Bible.getModuleList() == "No Modules") Bible = null;

Bible.setBiblesReference("ESV", "Matt.4");
testLocs(1, "ESV", "Matt", 4, 1, 25, "KJV");
jsdump("\n");

Bible.setBiblesReference("ESV", "Matt.2.3");
testLocs(2, "ESV", "Matt", 2, 3, 3, "KJV");
jsdump("\n");

Bible.setBiblesReference("ESV", "Matt.3.5.8");
testLocs(3, "ESV", "Matt", 3, 5, 8, "KJV");
jsdump("\n");

Bible.setBiblesReference("ESV", "Ps.119");
testLocs(4, "UZV", "Ps", 118, 1, 176, "Synodal");
jsdump("\n");

Bible.setBiblesReference("ESV", "Ps.25.3");
testLocs(5, "UZV", "Ps", 24, 3, 3, "Synodal");
jsdump("\n");

Bible.setBiblesReference("ESV", "Ps.22.9.12");
testLocs(6, "UZV", "Ps", 21, 10, 13, "Synodal");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps.118");
testLocs(7, "ESV", "Ps", 119, 1, 176, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps.24.3");
testLocs(8, "ESV", "Ps", 25, 3, 3, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps.21.10.13");
testLocs(9, "ESV", "Ps", 22, 9, 12, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps.114.1-Ps.114.2");
testLocs(10, "ESV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps.114.1 - Ps.114.2");
testLocs(11, "ESV", "Ps", 116, 1, 2, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps 109");
testLocs(12, "ESV", "Ps", 110, 1, 7, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps 110:6");
testLocs(13, "ESV", "Ps", 111, 6, 6, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps 113:2-7");
testLocs(14, "ESV", "Ps", 114, 2, 7, "KJV");
jsdump("\n");

Bible.setBiblesReference("UZV", "Ps 113:10-Ps 113:20");
testLocs(15, "ESV", "Ps", 115, 2, 12, "KJV");
jsdump("\n");

test (16, Bible.getModuleInformation("UZV", "GlobalOptionFilter"), "OSISFootnotes<nx>OSISHeadings<nx>OSISScripref<nx>OSISDictionary");

test(46, Bible.convertLocation("KJV", "Matt.4", "Synodal"), "Matt.4.1.25");
jsdump("\n");

test(47, Bible.convertLocation("KJV", "Matt.2.3", "Synodal"), "Matt.2.3.3");
jsdump("\n");

test(48, Bible.convertLocation("KJV", "Matt.3.5.8", "Synodal"), "Matt.3.5.8");
jsdump("\n");

test(49, Bible.convertLocation("KJV", "Ps.119", "Synodal"), "Ps.118.1.176");
jsdump("\n");

test(50, Bible.convertLocation("KJV", "Ps.25.3", "Synodal"), "Ps.24.3.3");
jsdump("\n");

test(51, Bible.convertLocation("KJV", "Ps.22.9.12", "Synodal"), "Ps.21.10.13");
jsdump("\n");

test(52, Bible.convertLocation("Synodal", "Ps.118", "KJV"), "Ps.119.1.176");
jsdump("\n");

test(53, Bible.convertLocation("Synodal", "Ps.24.3", "KJV"), "Ps.25.3.3");
jsdump("\n");

test(54, Bible.convertLocation("Synodal", "Ps.21.10.13", "KJV"), "Ps.22.9.12");
jsdump("\n");

test(55, Bible.convertLocation("Synodal", "1Kgs.6.1-1Kgs.6.18", "KJV"), "1Kgs.6.1.18");
jsdump("\n");

test(56, Bible.convertLocation("Synodal", "Ps.114.1 - Ps.114.2", "KJV"), "Ps.116.1.2");
jsdump("\n");

test(57, Bible.convertLocation("Synodal", "Ps 109", "KJV"), "Ps.110.1.7");
jsdump("\n");

test(58, Bible.convertLocation("Synodal", "Ps 110:6", "KJV"), "Ps.111.6.6");
jsdump("\n");

test(59, Bible.convertLocation("Synodal", "Ps 113:2-7", "KJV"), "Ps.114.2.7");
jsdump("\n");

test(60, Bible.convertLocation("Synodal", "Ps 113:10-Ps 113:20", "KJV"), "Ps.115.2.12");
jsdump("\n");

Bible.setBiblesReference("ESV", "Rev 12:2");
Bible.setVerse("ESV", 6, 8);
test(61, Bible.getChapter("ESV"), "Rev 12");
test(62, Bible.getVerseNumber("ESV"), "6");
test(63, Bible.getLastVerseNumber("ESV"), "8");
jsdump("\n");

Bible.setVerse("ESV", 6, 5);
test(64, Bible.getChapter("ESV"), "Rev 12");
test(65, Bible.getVerseNumber("ESV"), "6");
test(66, Bible.getLastVerseNumber("ESV"), "6");
jsdump("\n");

Bible.setVerse("ESV", 6, 6);
test(67, Bible.getChapter("ESV"), "Rev 12");
test(68, Bible.getVerseNumber("ESV"), "6");
test(69, Bible.getLastVerseNumber("ESV"), "6");
jsdump("\n");

Bible.setVerse("ESV", -1, 6);
test(70, Bible.getChapter("ESV"), "Rev 12");
test(71, Bible.getVerseNumber("ESV"), "17");
test(72, Bible.getLastVerseNumber("ESV"), "17");
jsdump("\n");

Bible.setVerse("ESV", 1, -1);
test(73, Bible.getChapter("ESV"), "Rev 12");
test(74, Bible.getVerseNumber("ESV"), "1");
test(75, Bible.getLastVerseNumber("ESV"), "17");
jsdump("\n");

Bible.setVerse("ESV", 0, 0);
test(76, Bible.getChapter("ESV"), "Rev 12");
test(77, Bible.getVerseNumber("ESV"), "0");
test(78, Bible.getLastVerseNumber("ESV"), "0");
jsdump("\n");

Bible.setVerse("ESV", 3, 9);
test(79, Bible.getChapter("ESV"), "Rev 12");
test(80, Bible.getVerseNumber("ESV"), "3");
test(81, Bible.getLastVerseNumber("ESV"), "9");
jsdump("\n");

test(82, Bible.getMaxVerse("ESV", "Ps 119"), 176);
test(83, Bible.getMaxVerse("ESV", "Ps 119:4"), 176);
test(84, Bible.getMaxVerse("ESV", "Ps 119:6-10"), 176);
test(85, Bible.getMaxVerse("ESV", "Ps.119"), 176);
test(86, Bible.getMaxVerse("ESV", "Ps.119.24"), 176);
test(87, Bible.getMaxVerse("ESV", "Ps.119.100.120"), 176);
test(88, Bible.getMaxVerse("UZV", "Ps 118"), 176);
test(89, Bible.getMaxVerse("UZV", "Ps 118:4"), 176);
test(90, Bible.getMaxVerse("UZV", "Ps 118:6-10"), 176);
test(91, Bible.getMaxVerse("UZV", "Ps.118"), 176);
test(92, Bible.getMaxVerse("UZV", "Ps.118.24"), 176);
test(93, Bible.getMaxVerse("UZV", "Ps.118.100.120"), 176);

function testLocs(tn, vers, bk, ch, vs, lv, sys) {
  test(tn + "a", Bible.getChapter(vers), bk + " " + ch);
  test(tn + "b", Bible.getBookName(vers), bk);
  test(tn + "c", Bible.getChapterNumber(vers), ch);
  test(tn + "d", Bible.getVerseNumber(vers), vs);
  test(tn + "e", Bible.getLastVerseNumber(vers), lv);
  test(tn + "f", Bible.getLocation(vers), bk + "." + ch + "." + vs + "." +lv);
  test(tn + "g", Bible.getVerseSystem(vers), sys);
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

jsdump("getModuleList=" + Bible.getModuleList());
jsdump("getBookIntroduction=" + Bible.getBookIntroduction("UZV", "Matt"));
jsdump("getDictionaryEntry БАШАН=" + Bible.getDictionaryEntry("UZDOT", "БАШАН"));
jsdump("getAllDictionaryKeys=" + Bible.getAllDictionaryKeys("UZDOT"));
jsdump("getGenBookTableOfContents=" + Bible.getGenBookTableOfContents("Pilgrim"));
jsdump("getGenBookChapterText=" + Bible.getGenBookChapterText("Pilgrim", "/Pilgrim/PART II/PREFACE"));
