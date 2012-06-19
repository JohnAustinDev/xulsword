<?php require_once("php/Common.php"); ?>
<?php 
$NOT_FOUND ="Not Found";

$defaultbible["RU"] ="RSP";
$defaultbible["EN"] ="KJV";

$StrongsHebrewModule["RU"] ="StrongsHebrewRU";
$StrongsGreekModule["RU"] ="StrongsGreekRU";
$GreekParseModule["RU"] ="Robinson";
$StrongsHebrewModule["EN"] ="StrongsHebrew";
$StrongsGreekModule["EN"] ="StrongsGreek";
$GreekParseModule["EN"] ="Robinson";

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

// SWORD was not used in order to increase speed
$Booki["Synodal"][0] = "Gen";
$Booki["Synodal"][1] = "Exod";
$Booki["Synodal"][2] = "Lev";
$Booki["Synodal"][3] = "Num";
$Booki["Synodal"][4] = "Deut";
$Booki["Synodal"][5] = "Josh";
$Booki["Synodal"][6] = "Judg";
$Booki["Synodal"][7] = "Ruth";
$Booki["Synodal"][8] = "1Sam";
$Booki["Synodal"][9] = "2Sam";
$Booki["Synodal"][10] = "1Kgs";
$Booki["Synodal"][11] = "2Kgs";
$Booki["Synodal"][12] = "1Chr";
$Booki["Synodal"][13] = "2Chr";
$Booki["Synodal"][14] = "Ezra";
$Booki["Synodal"][15] = "Neh";
$Booki["Synodal"][16] = "Esth";
$Booki["Synodal"][17] = "Job";
$Booki["Synodal"][18] = "Ps";
$Booki["Synodal"][19] = "Prov";
$Booki["Synodal"][20] = "Eccl";
$Booki["Synodal"][21] = "Song";
$Booki["Synodal"][22] = "Isa";
$Booki["Synodal"][23] = "Jer";
$Booki["Synodal"][24] = "Lam";
$Booki["Synodal"][25] = "Ezek";
$Booki["Synodal"][26] = "Dan";
$Booki["Synodal"][27] = "Hos";
$Booki["Synodal"][28] = "Joel";
$Booki["Synodal"][29] = "Amos";
$Booki["Synodal"][30] = "Obad";
$Booki["Synodal"][31] = "Jonah";
$Booki["Synodal"][32] = "Mic";
$Booki["Synodal"][33] = "Nah";
$Booki["Synodal"][34] = "Hab";
$Booki["Synodal"][35] = "Zeph";
$Booki["Synodal"][36] = "Hag";
$Booki["Synodal"][37] = "Zech";
$Booki["Synodal"][38] = "Mal";
$Booki["Synodal"][39] = "Matt";
$Booki["Synodal"][40] = "Mark";
$Booki["Synodal"][41] = "Luke";
$Booki["Synodal"][42] = "John";
$Booki["Synodal"][43] = "Acts";
$Booki["Synodal"][44] = "Jas";
$Booki["Synodal"][45] = "1Pet";
$Booki["Synodal"][46] = "2Pet";
$Booki["Synodal"][47] = "1John";
$Booki["Synodal"][48] = "2John";
$Booki["Synodal"][49] = "3John";
$Booki["Synodal"][50] = "Jude";
$Booki["Synodal"][51] = "Rom";
$Booki["Synodal"][52] = "1Cor";
$Booki["Synodal"][53] = "2Cor";
$Booki["Synodal"][54] = "Gal";
$Booki["Synodal"][55] = "Eph";
$Booki["Synodal"][56] = "Phil";
$Booki["Synodal"][57] = "Col";
$Booki["Synodal"][58] = "1Thess";
$Booki["Synodal"][59] = "2Thess";
$Booki["Synodal"][60] = "1Tim";
$Booki["Synodal"][61] = "2Tim";
$Booki["Synodal"][62] = "Titus";
$Booki["Synodal"][63] = "Phlm";
$Booki["Synodal"][64] = "Heb";
$Booki["Synodal"][65] = "Rev";

$Booki["KJV"][0] = "Gen";
$Booki["KJV"][1] = "Exod";
$Booki["KJV"][2] = "Lev";
$Booki["KJV"][3] = "Num";
$Booki["KJV"][4] = "Deut";
$Booki["KJV"][5] = "Josh";
$Booki["KJV"][6] = "Judg";
$Booki["KJV"][7] = "Ruth";
$Booki["KJV"][8] = "1Sam";
$Booki["KJV"][9] = "2Sam";
$Booki["KJV"][10] = "1Kgs";
$Booki["KJV"][11] = "2Kgs";
$Booki["KJV"][12] = "1Chr";
$Booki["KJV"][13] = "2Chr";
$Booki["KJV"][14] = "Ezra";
$Booki["KJV"][15] = "Neh";
$Booki["KJV"][16] = "Esth";
$Booki["KJV"][17] = "Job";
$Booki["KJV"][18] = "Ps";
$Booki["KJV"][19] = "Prov";
$Booki["KJV"][20] = "Eccl";
$Booki["KJV"][21] = "Song";
$Booki["KJV"][22] = "Isa";
$Booki["KJV"][23] = "Jer";
$Booki["KJV"][24] = "Lam";
$Booki["KJV"][25] = "Ezek";
$Booki["KJV"][26] = "Dan";
$Booki["KJV"][27] = "Hos";
$Booki["KJV"][28] = "Joel";
$Booki["KJV"][29] = "Amos";
$Booki["KJV"][30] = "Obad";
$Booki["KJV"][31] = "Jonah";
$Booki["KJV"][32] = "Mic";
$Booki["KJV"][33] = "Nah";
$Booki["KJV"][34] = "Hab";
$Booki["KJV"][35] = "Zeph";
$Booki["KJV"][36] = "Hag";
$Booki["KJV"][37] = "Zech";
$Booki["KJV"][38] = "Mal";
$Booki["KJV"][39] = "Matt";
$Booki["KJV"][40] = "Mark";
$Booki["KJV"][41] = "Luke";
$Booki["KJV"][42] = "John";
$Booki["KJV"][43] = "Acts";
$Booki["KJV"][44] = "Rom";
$Booki["KJV"][45] = "1Cor";
$Booki["KJV"][46] = "2Cor";
$Booki["KJV"][47] = "Gal";
$Booki["KJV"][48] = "Eph";
$Booki["KJV"][49] = "Phil";
$Booki["KJV"][50] = "Col";
$Booki["KJV"][51] = "1Thess";
$Booki["KJV"][52] = "2Thess";
$Booki["KJV"][53] = "1Tim";
$Booki["KJV"][54] = "2Tim";
$Booki["KJV"][55] = "Titus";
$Booki["KJV"][56] = "Phlm";
$Booki["KJV"][57] = "Heb";
$Booki["KJV"][58] = "Jas";
$Booki["KJV"][59] = "1Pet";
$Booki["KJV"][60] = "2Pet";
$Booki["KJV"][61] = "1John";
$Booki["KJV"][62] = "2John";
$Booki["KJV"][63] = "3John";
$Booki["KJV"][64] = "Jude";
$Booki["KJV"][65] = "Rev";

?>
