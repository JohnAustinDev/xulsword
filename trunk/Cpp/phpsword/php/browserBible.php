<?php /* 
		This file is part of phpsword.

    Copyright 2012 John Austin (gpl.programs.info@gmail.com)

    phpsword is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    phpsword is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with phpsword.  If not, see <http://www.gnu.org/licenses/>.
*/ ?>

<?php require_once('php/browserBible_common.php'); ?>
<?php 

/*  YOU MUST CREATE YOUR OWN Phrases_browserBible.php AND SET ALL   
		THE FOLLOWING VARIABLES EITHER THERE OR SOMEWHERE PREVIOUS. */
	
	require_once('php/Phrases_browserBible.php');

/*  IMPORTANT: WHERE "<Language>" APPEARS BELOW, SUCH CODE MUST BE  
		REPEATED FOR EACH LANGUAGE WHICH YOU WISH TO SUPPORT. */
	
	//$Language = <Active language code>;
	
	//$rep1 = <full path to SWORD repository #1>;
	//$rep2 = <full path to SWORD repository #2>;
	
	//$REDIRECT[<Language>] = <URL to redirect to if PHPSWORD extension does not load>;

/*	DEFAULT SWORD MODULES: */

	//$defaultbible[<Language>] = <SWORD module for default Bible>;
	//$StrongsHebrewModule[<Language>] = <SWORD module for Strong's Hebrew descriptions>;
	//$StrongsGreekModule[<Language>] = <SWORD module for Strong's Greek descriptions>;
	//$GreekParseModule[<Language>] = <SWORD module for Greek Parse descriptions>;
	
/*	INCLUDED SWORD BIBLE MODULES: 
		PUSH, IN THE ORDER IN WHICH THEY SHOULD BE LISTED, AN 
		ARRAY FOR EACH BIBLE MODULE (IN EACH UI LANGUAGE). LISTED
		MODULES MUST BE INCLUDED IN ONE OF $rep1 OR $rep2 (see above). */

	//$Mlist[<Language>] = array();
	//array_push($Mlist[<Language>], array(<Module readable name>, <Module code>));

/*	NOTE: SWORD'S BUILT IN LOCALE IS 
		CURRENTLY NOT USED FOR THE FOLLOWING BOOK 
		NAMES BECAUSE ICU THEN BECOMES NECESSARY, 
		AND SINCE ICU IS OTHERWISE NOT REQUIRED. */
		
	//$Book[<Language>][<OSIS Bible book code>] = <localized name of this Bible book>;

/*	NOTE: SWORD'S BUILT IN VERSE SYSTEMS ARE 
		NOT CURRENTLY USED TO RETRIEVE THE 
		FOLLOWING BOOK ORDER INFORMATION, TO 
		IMPROVE SPEED. BUT DATA IS IDENTICAL. */
		
	//$Booki[<Each supported SWORD verse system>][<index (starting at 0)>] = <OSIS Bible book code>;
	
?>

<?php

$Media = "screen"; // this has not been thought out or implemented yet

$MODCLEAN     = "/[^A-Za-z0-9_]/";
$LOCCLEAN     = "/[^A-Za-z0-9\.]/";
$REFLISTCLEAN = "/[^A-Za-z0-9\.\;\- ]/";
$OSISREFCLEAN = "/[^\w\-]/";

$NOT_FOUND = "Not Found";

$Option["hdg"] = "Headings";
$Option["ftn"] = "Footnotes";
$Option["crn"] = "Cross-references";
$Option["dtl"] = "Dictionary";
$Option["vsn"] = "Verse Numbers";
$Option["stn"] = "Strong's Numbers";
$Option["mlt"] = "Morphological Tags";
$Option["wcr"] = "Words of Christ in Red";
$Option["hvp"] = "Hebrew Vowel Points";
$Option["hcn"] = "Hebrew Cantillation";
$Option["mse"] = "Morpheme Segmentation";

$Default = array('m1'=>$defaultbible[$Language], 'l'=>'Gen.1.1.1',
					'hdg'=>'1', 'ftn'=>'1', 'crn'=>'1', 'dtl'=>'1', 'wcr'=>'1', 'vsn'=>'1', 
					'hvp'=>'1', 'hcn'=>'1', 'stn'=>'1', 'mlt'=>'1', 'mse'=>'1',
					'rmod'=>'', 'rtype'=>'', 'rlist'=>'');
					
$QuerySort = array("m", "mc1", "mc2", "mc3", "mc4", "mc5", "mc6", "mc7", "mc8", "mc9", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "l", "g");

// New flags can be added to the end of this list, but the existing 
// order should never change (or else existing bookmark links will break!).
$Optord = array('hdg','ftn','crn','dtl','wcr','vsn','hvp','hcn','stn','mlt','mse');

$Redirect = 0;

$UpgradeBrowser = 0;

$IsInternetExplorer = false;
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 8) $UpgradeBrowser = 1;
	$IsInternetExplorer = true;
}

// A canonical URL is too compressed to be directly usefull. So here the
// URL is decoded into a larger and more usefull set of $_GET variables.
$_GET = internalGET($_GET);

// Go to "home" page if no mod is specified
$PromptForBook = 0;
if (!isset($_GET['m1'])) {$PromptForBook = 1;}

if (!extension_loaded("phpsword")) {
	header('Location: ' . $REDIRECT[$Language]);
}

$Sword = new phpsword($rep1.", ".$rep2);
	
$Modlist = $Sword->getModuleList();
if (!preg_match("/(^|<nx>)".$defaultbible[$Language].";Biblical Texts(<nx>|$)/", $Modlist)) {
	$firstbible = array();
	preg_match("/(^|<nx>)([^;]+);Biblical Texts/", $Modlist, $firstbible);
	if (count($firstbible)) $defaultbible[$Language] = $firstbible[2];
}

// Do input checking and apply defaults
$_GET = array_merge($Default, $_GET);
$c = 1;
while(isset($_GET['m'.$c])) {
		if (!$_GET['m'.$c]) $_GET['m'.$c] = $defaultbible[$Language];
		$c++;
}

// If Javascript is known to be disabled, 
// then turn off global options which are non-functional without it.
if (isset($_GET['noj'])) {
	$_GET['ftn'] = '0';
	$_GET['crn'] = '0';
	$_GET['dtl'] = '0';
	$_GET['stn'] = '0';
	unset($_GET['noj']);	
}

// GET names: bk, ch, vs, lv all override loc, but are then unset
$p = preg_split("/\./", $_GET['l']);
if (isset($_GET['bk'])) {$p[0] = $_GET['bk']; $p[3] = $p[2] = $p[1] = 1; $Redirect = 1;}
if (isset($_GET['ch'])) {$p[1] = $_GET['ch']; $p[3] = $p[2] = 1;  $Redirect = 1;}
if (isset($_GET['vs'])) {$p[2] = $_GET['vs']; $p[3] = $p[2];  $Redirect = 1;}
if (isset($_GET['lv'])) {$p[3] = $_GET['lv'];  $Redirect = 1;}
if (!isset($p[2])) $p[2] = 1; // should work without this, but this is a libxulsword bug workaround (bug now fixed)
$_GET['l'] = join(".", $p);

// Now remove all GET names which are not included in the Default list
$del = array_diff_key($_GET, $Default);
reset($del);
while (list($name, $val) = each($del)) {if (!preg_match("/^m\d+$/", $name)) unset($_GET[$name]);}

// Check values of GET params
reset($_GET);
while (list($name, $val) = each($_GET)) {
	if (preg_match("/^(m\d|rmod)$/", $name)) {
		$_GET[$name] = preg_replace($MODCLEAN, "", $val);
		if	(!preg_match("/(^|<nx>)".$val.";(.*?)(<nx>|$)/", $Modlist)) {
			$_GET[$name] = $Default[$name];
		}
		continue;
	}
	else if ($name == 'l') {
		$_GET[$name] = preg_replace($LOCCLEAN, "", $val);
		continue;
	}
	else if ($name == 'rlist') {continue;} // handled by AJAX below
	else if ($name == 'rtype' && $val !== '') {
		if (!preg_match("/^(chapter|reflist|dictlist|stronglist)$/", $val)) {
			// Then cancel any un-supported AJAX requests
			$_GET['rmod'] = '';
			$_GET['rtype'] = '';
			$_GET['rlist'] = '';
		}
	}
	else if (!preg_match("/^(0|1)$/", $val)) {$_GET[$name] = $Default[$name];}
}

// The master verse system/module is the verse system of the URL location
$MasterVsys = $Sword->getVerseSystem($_GET['m1']);

// Check and normalize the page location
$p = preg_split("/\./", $_GET['l']);
$c = preg_split("/\./", $_GET['l']);
if (!isset($p[3]) || !is_numeric($p[3])) $p[3] = 1;
if (!isset($p[2]) || !is_numeric($p[2])) $p[2] = 1;
if (!isset($p[1]) || !is_numeric($p[1])) $p[1] = 1;

$maxch = $Sword->getMaxChapter($_GET['m1'], $p[0]);
if ($p[1] < 1) $p[1] = 1;
if ($p[1] > $maxch) $p[1] = $maxch;

$maxvs = $Sword->getMaxVerse($_GET['m1'], $p[0]." ".$p[1]);
if ($p[2] < 1) $p[2] = 1;
if ($p[2] > $maxvs) $p[2] = $maxvs;

if ($p[3] < $p[2]) $p[3] = $p[2];
if ($p[3] > $maxvs) $p[3] = $maxvs;

$_GET['l']  = $Sword->convertLocation($MasterVsys, implode(".", $p), $MasterVsys);

// Redirect to the new location if the requested location did not exist
$p = preg_split("/\./", $_GET['l']);
if (isset($c[3]) && $c[3] != $p[3]) $Redirect = 1;
if (isset($c[2]) && $c[2] != $p[2]) $Redirect = 1;
if (isset($c[1]) && $c[1] != $p[1]) $Redirect = 1;
if (isset($c[0]) && $c[0] != $p[0]) $Redirect = 1;

// Apply Sword options
$_GET['mlt'] = $_GET['stn']; // just synch these two together
reset($Option);
while (list($var, $val) = each($Option)) {$Sword->setGlobalOption($val, ($_GET[$var] == '1' ? "On":"Off"));}
  

// Handle any AJAX request
// All AJAX data must be ASCII, so javascript must encode using _cp_ encoding for Unicode chars
if ($_GET['rmod'] && $_GET['rtype'] && $_GET['rlist']) {
	$html = "";
	switch($_GET['rtype']) {
	case "reflist":
		$_GET['rlist'] = preg_replace($REFLISTCLEAN, "", $_GET['rlist']);
		$sep = "";
		$refs = preg_split("/\s*;\s*/", $_GET['rlist']);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$vsys = $Sword->getVerseSystem($_GET['rmod']);
			$refs[$i] = $Sword->convertLocation($vsys, $refs[$i], $vsys);
			$loc = $Sword->convertLocation($vsys, $refs[$i], $MasterVsys);
			$html .= $sep.sreflink($loc, $refs[$i]);
			$vss = $Sword->getVerseText($_GET['rmod'], $loc);
			if ($vss) {$html .= ": ".$vss;}
			else {
				$vsys2 = $Sword->getVerseSystem($defaultbible[$Language]);
				$loc2 = $Sword->convertLocation($vsys, $refs[$i], $vsys2);
				$vss = $Sword->getVerseText($defaultbible[$Language], $loc2);
				$html .= ': '.$vss.'(';
				if ($refs[$i] != $loc2) {$html .= loc2UI($loc2).', ';}
				$html .= getLangName($defaultbible[$Language]);
				$html .= ')';
			}
			$sep = "<br><hr>";
		}
		break;
		
	case "dictlist":
		$sep = "";
		$refs = preg_split("/\s+/", $_GET['rlist']);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$p = preg_split("/\./", $refs[$i]);
			if (count($p) != 2) {$p = preg_split("/:/", $refs[$i]);}
			$p[0] = preg_replace($MODCLEAN, "", $p[0]);
			$p[1] = decodeutf8($p[1]);
			$ent = $Sword->getDictionaryEntry($p[0], $p[1]);
			if ($ent) {
				$ent = preg_replace_callback("/<img ([^>]*)src=\"File:\/\/(.*?)\"/", "imgpath", $ent);
				$html .= $sep."<b>".$p[1]."</b>: ".$ent;
			}
			$sep = "<br><hr>";
		}
		break;
		
	case "stronglist":
		$html = getLemmaHTML(decodeutf8($_GET['rlist']));
		break;
		
	case "chapter":
		$mod = ($_GET['rmod'] != "<none>" ? $_GET['rmod']:$_GET['m1']);
		$loc = preg_split("/\./", $_GET['l']);
		$ch = (int)$loc[1] + (int)$_GET['rlist'];
		if ($ch < 1 || $ch > $Sword->getMaxChapter($_GET['rmod'], $_GET['l'])) {
			$html = "<none>";
		}
		else {
			$sep = "<separator/>";
			$html  = ($_GET['hdg']=='1' ? "<div class=\"chapnum followon\">".$ch."</div>":"").$Sword->getChapterText($_GET['rmod'], $loc[0].$ch);
			$html .= $sep.htmlspecialchars($Sword->getFootnotes());
			$html .= $sep.htmlspecialchars($Sword->getCrossRefs());
		}
		break;
	}
	echo $html;
	exit;
}
unset($_GET['rtype']);
unset($_GET['rlist']);
unset($_GET['rmod']);

// Redirect to canonical URL if needed
if ($Redirect && !$PromptForBook) redirect($_GET);

// Now read the actual textual data from the SWORD repository
$BookIntro = array();
$ModInfo = array();
$FlowCols = 1;

$mods = $_GET['m1'];
$flowmod = $_GET['m1'];
if (isset($_GET['m2'])) {
	// ...then we have multiple columns...
	
	$c=2;
	
	// Determine if flowing columns are to be displayed, and how many
	while (isset($_GET['m'.$c])) {
		if ($_GET['m'.$c] == $flowmod) $FlowCols++;
		$mods .= ",".$_GET['m'.$c];
		$c++;
	}
	
	// Activate flowing columns if we're not IE (IE can't do them) and
	// if all columns are the same text version.
	if (!$IsInternetExplorer && $FlowCols == --$c) {
		$PageText = $Sword->getChapterText($flowmod, $_GET['l']);	
		if (strlen($PageText) < 64) {
			$before = $_GET['l'];
			$_GET['l'] = validLocation($_GET['m1']);
			if ($_GET['l'] != $before) redirect($_GET);
		}
		$ch = preg_split("/\./", $_GET['l']);
		$ch = $ch[1];
		$head = ($_GET['hdg']=='1' ? "<div class=\"chapnum\">".$ch."</div>":"");
		$PageText = $head.$PageText;
	}
	
	// Show each text in its own column
	else {
		$FlowCols = 1;
		$PageText = $Sword->getChapterTextMulti($mods, $_GET['l'], true);
	}
}

else {
	// ...then we have a single column
	$PageText = $Sword->getChapterText($mods, $_GET['l']);
	if (strlen($PageText) < 64) {
		$before = $_GET['l'];
		$_GET['l'] = validLocation($_GET['m1']);
		if ($_GET['l'] != $before) redirect($_GET);	
	}
}

// Save all footnotes, cross-references, introductions, and module infos
$PageFootnotes = htmlspecialchars($Sword->getFootnotes());
$PageCrossrefs = htmlspecialchars($Sword->getCrossRefs());
$c = 1;
while (isset($_GET['m'.$c])) {
	$BookIntro[$c]  = $Sword->getBookIntroduction($_GET['m'.$c], $_GET['l']);
	$ModInfo[$c] = moduleInfo($_GET['m'.$c]);
	$c++;
}

// This is just a handy global variable for our URL's book, chap, and verse location.
$_LOC = preg_split("/\./", $_GET['l']);


// We're done collecting all necessary data required for building a page!

?>



