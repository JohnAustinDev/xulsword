/* eslint-disable prettier/prettier */
import LibSword from '../main/components/libsword';
import Location from './location';

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
luceneEnabled               test with xulsword (does 'create index' button appear when it should?)

setGlobalOption             test with xulsword
getGlobalOption             test with xulsword

setCipherKey                test with xulsword
*/

jest.mock('../main/modules/dirs');

beforeAll(() => {
  LibSword.init();
});
afterAll(() => {
  LibSword.quit();
});

test('Modules loaded',      () => { expect(LibSword.getModuleList()).not.toMatch(/No Modules/); });
test('KJV module required', () => { expect(LibSword.getModuleList()).toMatch(/.*KJV;Biblical Texts.*/); });
test('UZV module required', () => { expect(LibSword.getModuleList()).toMatch(/.*UZV;Biblical Texts.*/); });

// Tests setting libxulsword bible locations
/**
 * Assign and verify a bible location in either the specified version or the corresponding location
 * in a different one.
 * @param {number} testNumber - a zero-based integer indicating the test number
 * @param {string} setVersion - the version where the location is specified
 * @param {string} getVersion - the version used to verify proper setting (may be a mapped location)
 * @param {string} location - the location set in refence to the setVersion
 * @param {string} book - the location's expected book
 * @param {number} chapter - the location's expected chapter
 * @param {number} verse - the location's expected verse
 * @param {number} lastVerse - the last verse in the getVersion's chapter
 * @param {string} system - the getVersion's system
 */
function testLocation(testNumber, setVersion, getVersion, location, book, chapter, verse, lastVerse, system) {
  Location.setLocation(setVersion, location);
  // TODO: for a reason I have yet to understand, embedding the following Location commands directly
  // into the expect statements below results in false negative test results.  It must have
  // something to do with jest's order of test execution along with the Location packages internal
  // state.
  const xsChapter         = Location.getChapter(getVersion);
  const xsBookName        = Location.getBookName(getVersion);
  const xsChapterNumber   = Location.getChapterNumber(getVersion);
  const xsVerseNumber     = Location.getVerseNumber(getVersion);
  const xsLastVerseNumber = Location.getLastVerseNumber(getVersion);
  const xsLocation        = Location.getLocation(getVersion);

  test(`location ${  testNumber}`, () => {
    expect(xsChapter).toBe(`${book  } ${  chapter}`);
    expect(xsBookName).toBe(book);
    expect(xsChapterNumber).toBe(String(chapter));
    expect(xsVerseNumber).toBe(String(verse));
    expect(xsLastVerseNumber).toBe(String(lastVerse));
    expect(xsLocation).toBe(`${book}.${chapter}.${verse}.${lastVerse}`);
    expect(LibSword.getVerseSystem(getVersion)).toBe(system);
  });
}

// testNumber, setVersion, getVersion, location, book, chapter, verse, lastVerse, system
const testLocations = [
  [ 0, 'KJV', 'KJV', 'Matt.4',              'Matt',   4,  1,  25, 'KJV'],
  [ 1, 'KJV', 'KJV', 'Matt.2.3',            'Matt',   2,  3,   3, 'KJV'],
  [ 2, 'KJV', 'KJV', 'Matt.3.5.8',          'Matt',   3,  5,   8, 'KJV'],
  [ 3, 'KJV', 'UZV', 'Ps.119',              'Ps',   118,  1, 176, 'SynodalProt'],
  [ 4, 'KJV', 'UZV', 'Ps.25.3',             'Ps',    24,  3,   3, 'SynodalProt'],
  [ 5, 'KJV', 'UZV', 'Ps.22.9.12',          'Ps',    21, 10,  13, 'SynodalProt'],
  [ 6, 'UZV', 'KJV', 'Ps.118',              'Ps',   119,  1, 176, 'KJV'],
  [ 7, 'UZV', 'KJV', 'Ps.24.3',             'Ps',    25,  3,   3, 'KJV'],
  [ 8, 'UZV', 'KJV', 'Ps.21.10.13',         'Ps',    22,  9,  12, 'KJV'],
  [ 9, 'UZV', 'KJV', 'Ps.114.1-Ps.114.2',   'Ps',   116,  1,   2, 'KJV'],
  [10, 'UZV', 'KJV', 'Ps.114.1 - Ps.114.2', 'Ps',   116,  1,   2, 'KJV'],
  [11, 'UZV', 'KJV', 'Ps 109',              'Ps',   110,  1,   7, 'KJV'],
  [12, 'UZV', 'KJV', 'Ps 110:6',            'Ps',   111,  6,   6, 'KJV'],
  [13, 'UZV', 'KJV', 'Ps 113:2-7',          'Ps',   114,  2,   7, 'KJV'],
  [14, 'UZV', 'KJV', 'Ps 113:10-Ps 113:20', 'Ps',   115,  2,  12, 'KJV'],
];

for (let testNumber = 0; testNumber < testLocations.length; testNumber += 1) {
  testLocation(...testLocations[testNumber]);
}


// Test(s) setting libxulsword Global Options Filter
test('GlobalOptionFilter', () => {
  expect(LibSword.getModuleInformation('KJV', 'GlobalOptionFilter'))
  .toBe('OSISLemma<nx>OSISStrongs<nx>OSISMorph<nx>OSISFootnotes<nx>OSISHeadings<nx>OSISRedLetterWords')
});



// Tests for converting locations between various translations
 test('convertLocation 0', () => {
  expect(Location.convertLocation('KJV', 'Matt.4', 'Synodal')).toBe('Matt.4.1.25');
});

test('convertLocation 1', () => {
  expect(Location.convertLocation('KJV', 'Matt.2.3', 'Synodal')).toBe('Matt.2.3.3');
});

test('convertLocation 2', () => {
  expect(Location.convertLocation('KJV', 'Matt.3.5.8', 'Synodal')).toBe('Matt.3.5.8');
});

test('convertLocation 3', () => {
  expect(Location.convertLocation('KJV', 'Ps.119', 'Synodal')).toBe('Ps.118.1.176');
});

test('convertLocation 4', () => {
  expect(Location.convertLocation('KJV', 'Ps.25.3', 'Synodal')).toBe('Ps.24.3.3');
});

test('convertLocation 5', () => {
  expect(Location.convertLocation('KJV', 'Ps.22.9.12', 'Synodal')).toBe('Ps.21.10.13');
});

test('convertLocation 6', () => {
  expect(Location.convertLocation('Synodal', 'Ps.118', 'KJV')).toBe('Ps.119.1.176');
});

test('convertLocation 7', () => {
  expect(Location.convertLocation('Synodal', 'Ps.24.3', 'KJV')).toBe('Ps.25.3.3');
});

test('convertLocation 8', () => {
  expect(Location.convertLocation('Synodal', 'Ps.21.10.13', 'KJV')).toBe('Ps.22.9.12');
});

test('convertLocation 9', () => {
  expect(Location.convertLocation('Synodal', '1Kgs.6.1-1Kgs.6.18', 'KJV')).toBe('1Kgs.6.1.18');
});

test('convertLocation 10', () => {
  expect(Location.convertLocation('Synodal', 'Ps.114.1 - Ps.114.2', 'KJV')).toBe('Ps.116.1.2');
});

test('convertLocation 11', () => {
  expect(Location.convertLocation('Synodal', 'Ps 109', 'KJV')).toBe('Ps.110.1.7');
});

test('convertLocation 12', () => {
  expect(Location.convertLocation('Synodal', 'Ps 110:6', 'KJV')).toBe('Ps.111.6.6');
});

test('convertLocation 13', () => {
  expect(Location.convertLocation('Synodal', 'Ps 113:2-7', 'KJV')).toBe('Ps.114.2.7');
});

test('convertLocation 14', () => {
  expect(Location.convertLocation('Synodal', 'Ps 113:10-Ps 113:20', 'KJV')).toBe('Ps.115.2.12');
});

// Tests setting libxulsword bible verses
function testVerse(testNumber, setChapter, setVerse, getChapter, getVerse, getLastVerse) {
  Location.setVerse('KJV', setChapter, setVerse);
  // TODO: see note above
  const xsChapter         = Location.getChapter('KJV');
  const xsVerseNumber     = Location.getVerseNumber('KJV');
  const xsLastVerseNumber = Location.getLastVerseNumber('KJV');

  test(`verse ${  testNumber}`, () => {
    expect(xsChapter).toBe(getChapter);
    expect(xsVerseNumber).toBe(String(getVerse));
    expect(xsLastVerseNumber).toBe(String(getLastVerse));
  });
}

// testNumber, setChapter, setVerse, getChapter, getVerse, getLastVerse
const testVerses = [
  [ 0,  6,  8, 'Rev 12',  '6',  '8'],
  [ 1,  6,  5, 'Rev 12',  '6',  '6'],
  [ 2,  6,  6, 'Rev 12',  '6',  '6'],
  [ 3, -1,  6, 'Rev 12', '17', '17'],
  [ 4,  1, -1, 'Rev 12',  '1', '17'],
  [ 5,  0,  0, 'Rev 12',  '0',  '0'],
  [ 6,  3,  9, 'Rev 12',  '3',  '9'],
];

Location.setLocation('KJV', 'Rev 12:2');
for (let testNumber = 0; testNumber < testVerses.length; testNumber += 1) {
  testVerse(...testVerses[testNumber]);
}

// Tests extracting the last verse number in the chapter of the reference bible chapter/verse.
function testMaxVerse(testNumber, version, verse, lastVerse) {
  // TODO: see note above
  const xsMaxVerse = LibSword.getMaxVerse(version, verse);
  test(`max verse ${  testNumber}`, () => { expect(xsMaxVerse).toBe(lastVerse); });
}

// testNumber, setChapter, setVerse, getChapter, getVerse, getLastVerse
const testMaxVerses = [
  [ 0, 'KJV', 'Ps 119',         176],
  [ 1, 'KJV', 'Ps 119:4',       176],
  [ 2, 'KJV', 'Ps 119:6-10',    176],
  [ 3, 'KJV', 'Ps.119',         176],
  [ 4, 'KJV', 'Ps.119.24',      176],
  [ 5, 'KJV', 'Ps.119.100.120', 176],
  [ 6, 'UZV', 'Ps 118',         176],
  [ 7, 'UZV', 'Ps 118:4',       176],
  [ 8, 'UZV', 'Ps 118:6-10',    176],
  [ 9, 'UZV', 'Ps.118',         176],
  [10, 'UZV', 'Ps.118.24',      176],
  [11, 'UZV', 'Ps.118.100.120', 176],
];

for (let testNumber = 0; testNumber < testMaxVerses.length; testNumber += 1) {
  testMaxVerse(...testMaxVerses[testNumber]);
}

// Tests extracting the last chapter number in the book of the reference bible book/chapter.
function testMaxChapter(testNumber, version, chapter, lastChapter) {
  const xsMaxChapter = LibSword.getMaxChapter(version, chapter);
  test(`max chapter ${  testNumber}`, () => { expect(xsMaxChapter).toBe(lastChapter); });
}


// testNumber, setChapter, setVerse, getChapter, getVerse, getLastVerse
const testMaxChapters = [
  [0, 'KJV',    'Ps', 150],
  [1, 'KJV', 'Ps.49', 150],
  [2, 'UZV',    'Ps', 150],
  [3, 'UZV', 'Ps.49', 150],
];

for (let testNumber = 0; testNumber < testMaxChapters.length; testNumber += 1) {
  testMaxChapter(...testMaxChapters[testNumber]);
}

// Search tests
test('search 0', () => {
  expect(LibSword.search('KJV', 'be.*t.*', 'John', 0 /* regex */, 0, true)).toBe(296);
});
test('search 1', () => {
  expect(LibSword.getSearchResults('KJV', 2, 1, false).match(/title="[^"]+"/g)[0]).toBe('title="John.1.7.KJV"');
});

const results = [
  'title="John.2.22.KJV"',
  'title="John.3.34.KJV"',
  'title="John.4.41.KJV"',
  'title="John.4.50.KJV"',
  'title="John.5.24.KJV"',
  'title="John.5.38.KJV"',
];

for (let index = 0; index < LibSword.search('KJV', 'word', 'John', 1, 0, true); index += 1) {
  const searchResult = LibSword.getSearchResults('KJV', index, 1, false, 0, false);
  test(`search ${  2 + index}`, () => {
    expect(searchResult.match(/title="[^"]+"/g)[0]).toBe(results[index]);
  });
  if (index > 4) break;
}

test('search 8', () => {
  expect(LibSword.search('KJV', 'shineth in darkness', 'John', 2 /* multi */, 0, true)).toBe(1);
});


test('search 10', () => {
  expect(LibSword.getSearchResults('KJV', 0, 1, false).match(/title="[^"]+"/g)[0]).toBe('title="John.1.5.KJV"');
});

// Misc tests
test('getIntroductions', () => {
  expect(LibSword.getIntroductions('UZV', 'Matt').length).toBe(4332);
});
test('getDictionaryEntry', () => {
  expect(LibSword.getDictionaryEntry('UZDOT', 'БАШАН').length).toBe(321);
});
test('getAllDictionaryKeys', () => {
  expect(LibSword.getAllDictionaryKeys('UZDOT').length).toBe(2385);
});
test('getGenBookTableOfContents', () => {
  expect(LibSword.getGenBookTableOfContents('Pilgrim').length).toBe(9774);
});
test('getGenBookChapterText', () => {
  expect(LibSword.getGenBookChapterText('Pilgrim', '/PART II/PREFACE').length).toBe(23339);
});
