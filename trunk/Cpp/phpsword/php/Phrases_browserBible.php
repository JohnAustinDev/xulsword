<?php require_once("php/Common.php"); ?>
<?php 
$NOT_FOUND ="Not Found";

// RUSSIAN PHRASES
if ($Language == "RU") {
$defaultbible["RU"] ="RSP";
$headings["RU"] ="RHeadings";
$footnotes["RU"] ="RFootnotes";
$crossRefs["RU"] ="RCross-Refs";
$dictLinks["RU"] ="RDictionary Links";
$verseNumbers["RU"] ="RVerse Numbers";
$strongsNumbers["RU"] ="RStrongs";
$redWords["RU"] ="RRed Words";

}

// ENGLISH PHRASES
if ($Language == "EN") {
$defaultbible["EN"] ="KJV";
$headings["EN"] ="Headings";
$footnotes["EN"] ="Footnotes";
$crossRefs["EN"] ="Cross-Refs";
$dictLinks["EN"] ="Dictionary Links";
$verseNumbers["EN"] ="Verse Numbers";
$strongsNumbers["EN"] ="Strongs";
$redWords["EN"] ="Red Words";

}

// GERMAN PHRASES
if ($Language == "DE") {
$defaultbible["DE"] ="RSP";
$headings["DE"] ="GHeadings";
$footnotes["DE"] ="GFootnotes";
$crossRefs["DE"] ="GCross-Refs";
$dictLinks["DE"] ="GDictionary Links";
$verseNumbers["DE"] ="GVerse Numbers";
$strongsNumbers["DE"] ="GStrongs";
$redWords["DE"] ="GRed Words";

}

$StrongsHebrewModule["RU"] ="StrongsHebrewRU";
$StrongsGreekModule["RU"] ="StrongsGreekRU";
$GreekParseModule["RU"] ="Robinson";
$StrongsHebrewModule["EN"] ="StrongsHebrew";
$StrongsGreekModule["EN"] ="StrongsGreek";
$GreekParseModule["EN"] ="Robinson";
$StrongsHebrewModule["DE"] ="StrongsHebrew";
$StrongsGreekModule["DE"] ="StrongsGreek";
$GreekParseModule["DE"] ="Robinson";

// SWORD locale was not used because ICU then becomes necessary
if ($Language == "RU") {
$Book["RU"]["Gen"]="Бытие";
$Book["RU"]["Exod"]="Исход";
$Book["RU"]["Lev"]="Левит";
$Book["RU"]["Num"]="Числа";
$Book["RU"]["Deut"]="Второзаконие";
$Book["RU"]["Josh"]="Иисус Навин";
$Book["RU"]["Judg"]="Судьи";
$Book["RU"]["Ruth"]="Руфь";
$Book["RU"]["1Sam"]="1. Царств";
$Book["RU"]["2Sam"]="2. Царств";
$Book["RU"]["1Kgs"]="3. Царств";
$Book["RU"]["2Kgs"]="4. Царств";
$Book["RU"]["1Chr"]="1. Паралипоменон";
$Book["RU"]["2Chr"]="2. Паралипоменон";
$Book["RU"]["Ezra"]="Ездра";
$Book["RU"]["Neh"]="Неемия";
$Book["RU"]["Esth"]="Есфирь";
$Book["RU"]["Job"]="Иов";
$Book["RU"]["Ps"]="Псалтирь";
$Book["RU"]["Prov"]="Притчи";
$Book["RU"]["Eccl"]="Екклесиаст";
$Book["RU"]["Song"]="Песня Песней";
$Book["RU"]["Isa"]="Исаия";
$Book["RU"]["Jer"]="Иеремия";
$Book["RU"]["Lam"]="Плач Иеремии";
$Book["RU"]["Ezek"]="Иезекииль";
$Book["RU"]["Dan"]="Даниил";
$Book["RU"]["Hos"]="Осия";
$Book["RU"]["Joel"]="Иоиль";
$Book["RU"]["Amos"]="Амос";
$Book["RU"]["Obad"]="Авдий";
$Book["RU"]["Jonah"]="Иона";
$Book["RU"]["Mic"]="Михей";
$Book["RU"]["Nah"]="Наум";
$Book["RU"]["Hab"]="Аввакум";
$Book["RU"]["Zeph"]="Софония";
$Book["RU"]["Hag"]="Аггей";
$Book["RU"]["Zech"]="Захария";
$Book["RU"]["Mal"]="Малахия";
$Book["RU"]["Matt"]="От Матфея";
$Book["RU"]["Mark"]="От Марка";
$Book["RU"]["Luke"]="От Луки";
$Book["RU"]["John"]="От Иоанна";
$Book["RU"]["Acts"]="Деяния";
$Book["RU"]["Rom"]="К Римлянам";
$Book["RU"]["1Cor"]="1. Коринфянам";
$Book["RU"]["2Cor"]="2. Коринфянам";
$Book["RU"]["Gal"]="К Галатам";
$Book["RU"]["Eph"]="К Ефесянам";
$Book["RU"]["Phil"]="К Филиппийцам";
$Book["RU"]["Col"]="К Колоссянам";
$Book["RU"]["1Thess"]="1. Фессалоникийцам";
$Book["RU"]["2Thess"]="2. Фессалоникийцам";
$Book["RU"]["1Tim"]="1. Тимофею";
$Book["RU"]["2Tim"]="2. Тимофею";
$Book["RU"]["Titus"]="К Титу";
$Book["RU"]["Phlm"]="К Филимону";
$Book["RU"]["Heb"]="К Евреям";
$Book["RU"]["Jas"]="Иакова";
$Book["RU"]["1Pet"]="1. Петра";
$Book["RU"]["2Pet"]="2. Петра";
$Book["RU"]["1John"]="1. Иоанна";
$Book["RU"]["2John"]="2. Иоанна";
$Book["RU"]["3John"]="3. Иоанна";
$Book["RU"]["Jude"]="Иуды";
$Book["RU"]["Rev"]="Откровение";
}

if ($Language == "EN") {
$Book["EN"]["Gen"]="Genesis";
$Book["EN"]["Exod"]="Exodus";
$Book["EN"]["Lev"]="Leviticus";
$Book["EN"]["Num"]="Numbers";
$Book["EN"]["Deut"]="Deuteronomy";
$Book["EN"]["Josh"]="Joshua";
$Book["EN"]["Judg"]="Judges";
$Book["EN"]["Ruth"]="Ruth";
$Book["EN"]["1Sam"]="1 Samuel";
$Book["EN"]["2Sam"]="2 Samuel";
$Book["EN"]["1Kgs"]="1 Kings";
$Book["EN"]["2Kgs"]="2 Kings";
$Book["EN"]["1Chr"]="1 Chronicles";
$Book["EN"]["2Chr"]="2 Chronicles";
$Book["EN"]["Ezra"]="Ezra";
$Book["EN"]["Neh"]="Nehemiah";
$Book["EN"]["Esth"]="Esther";
$Book["EN"]["Job"]="Job";
$Book["EN"]["Ps"]="Psalms";
$Book["EN"]["Prov"]="Proverbs";
$Book["EN"]["Eccl"]="Ecclesiastes";
$Book["EN"]["Song"]="Song of Songs";
$Book["EN"]["Isa"]="Isaiah";
$Book["EN"]["Jer"]="Jeremiah";
$Book["EN"]["Lam"]="Lamentations";
$Book["EN"]["Ezek"]="Ezekiel";
$Book["EN"]["Dan"]="Daniel";
$Book["EN"]["Hos"]="Hosea";
$Book["EN"]["Joel"]="Joel";
$Book["EN"]["Amos"]="Amos";
$Book["EN"]["Obad"]="Obadiah";
$Book["EN"]["Jonah"]="Jonah";
$Book["EN"]["Mic"]="Micah";
$Book["EN"]["Nah"]="Nahum";
$Book["EN"]["Hab"]="Habakkuk";
$Book["EN"]["Zeph"]="Zephaniah";
$Book["EN"]["Hag"]="Haggai";
$Book["EN"]["Zech"]="Zechariah";
$Book["EN"]["Mal"]="Malachi";
$Book["EN"]["Matt"]="Matthew";
$Book["EN"]["Mark"]="Mark";
$Book["EN"]["Luke"]="Luke";
$Book["EN"]["John"]="John";
$Book["EN"]["Acts"]="Acts";
$Book["EN"]["Jas"]="James";
$Book["EN"]["1Pet"]="1 Peter";
$Book["EN"]["2Pet"]="2 Peter";
$Book["EN"]["1John"]="1 John";
$Book["EN"]["2John"]="2 John";
$Book["EN"]["3John"]="3 John";
$Book["EN"]["Jude"]="Jude";
$Book["EN"]["Rom"]="Romans";
$Book["EN"]["1Cor"]="1st Corinthians";
$Book["EN"]["2Cor"]="2nd Corinthians";
$Book["EN"]["Gal"]="Galatians";
$Book["EN"]["Eph"]="Ephesians";
$Book["EN"]["Phil"]="Philippians";
$Book["EN"]["Col"]="Colossians";
$Book["EN"]["1Thess"]="1st Thessalonians";
$Book["EN"]["2Thess"]="2nd Thessalonians";
$Book["EN"]["1Tim"]="1 Timothy";
$Book["EN"]["2Tim"]="2 Timothy";
$Book["EN"]["Titus"]="Titus";
$Book["EN"]["Phlm"]="Philemon";
$Book["EN"]["Heb"]="Hebrews";
$Book["EN"]["Rev"]="Revelation";
}

if ($Language == "DE") {
$Book["DE"]["Gen"]="1. Mose";
$Book["DE"]["Exod"]="2. Mose";
$Book["DE"]["Lev"]="3. Mose";
$Book["DE"]["Num"]="4. Mose";
$Book["DE"]["Deut"]="5. Mose";
$Book["DE"]["Josh"]="Josua";
$Book["DE"]["Judg"]="Richter";
$Book["DE"]["Ruth"]="Rut";
$Book["DE"]["1Sam"]="1. Samuel";
$Book["DE"]["2Sam"]="2. Samuel";
$Book["DE"]["1Kgs"]="1. Könige";
$Book["DE"]["2Kgs"]="2. Könige";
$Book["DE"]["1Chr"]="1. Chronik";
$Book["DE"]["2Chr"]="2. Chronik";
$Book["DE"]["Ezra"]="Esra";
$Book["DE"]["Neh"]="Nehemia";
$Book["DE"]["Esth"]="Ester";
$Book["DE"]["Job"]="Hiob";
$Book["DE"]["Ps"]="Psalmen";
$Book["DE"]["Prov"]="Sprüche";
$Book["DE"]["Eccl"]="Prediger";
$Book["DE"]["Song"]="Hoheslied";
$Book["DE"]["Isa"]="Jesaja";
$Book["DE"]["Jer"]="Jeremia";
$Book["DE"]["Lam"]="Klagelieder";
$Book["DE"]["Ezek"]="Hesekiel";
$Book["DE"]["Dan"]="Daniel";
$Book["DE"]["Hos"]="Hosea";
$Book["DE"]["Joel"]="Joel";
$Book["DE"]["Amos"]="Amos";
$Book["DE"]["Obad"]="Obadja";
$Book["DE"]["Jonah"]="Jona";
$Book["DE"]["Mic"]="Micha";
$Book["DE"]["Nah"]="Nahum";
$Book["DE"]["Hab"]="Habakuk";
$Book["DE"]["Zeph"]="Zefanja";
$Book["DE"]["Hag"]="Haggai";
$Book["DE"]["Zech"]="Sacharja";
$Book["DE"]["Mal"]="Maleachi";
$Book["DE"]["Matt"]="Matthäus";
$Book["DE"]["Mark"]="Markus";
$Book["DE"]["Luke"]="Lukas";
$Book["DE"]["John"]="Johannes";
$Book["DE"]["Acts"]="Apostelgeschichte";
$Book["DE"]["Rom"]="Römer";
$Book["DE"]["1Cor"]="1. Korinther";
$Book["DE"]["2Cor"]="2. Korinther";
$Book["DE"]["Gal"]="Galater";
$Book["DE"]["Eph"]="Epheser";
$Book["DE"]["Phil"]="Philipper";
$Book["DE"]["Col"]="Kolosser";
$Book["DE"]["1Thess"]="1. Thessalonicher";
$Book["DE"]["2Thess"]="2. Thessalonicher";
$Book["DE"]["1Tim"]="1. Timotheus";
$Book["DE"]["2Tim"]="2. Timotheus";
$Book["DE"]["Titus"]="Titus";
$Book["DE"]["Phlm"]="Philemon";
$Book["DE"]["Heb"]="Hebräer";
$Book["DE"]["Jas"]="Jakobus";
$Book["DE"]["1Pet"]="1. Petrus";
$Book["DE"]["2Pet"]="2. Petrus";
$Book["DE"]["1John"]="1. Johannes";
$Book["DE"]["2John"]="2. Johannes";
$Book["DE"]["3John"]="3. Johannes";
$Book["DE"]["Jude"]="Judas";
$Book["DE"]["Rev"]="Offenbarung";
}

?>
