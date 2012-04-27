<?php require_once("php/Common.php"); ?>
<?php require_once('php/Phrases_browserBible.php'); ?>
<?php

$MODCLEAN     = "/[^A-Za-z0-9_]/";
$LOCCLEAN     = "/[^A-Za-z0-9\.]/";
$REFLISTCLEAN = "/[^A-Za-z0-9\.\;\- ]/";
$OSISREFCLEAN = "/[^\w\-]/";

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
			
$UpgradeBrowser = 0;
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 8) $UpgradeBrowser = 1;
}

// Go to "home" page if no mod is specified
$PromptForBook = 0;
if (!isset($_GET['mod'])) {$PromptForBook = 1;}

if (!extension_loaded("phpsword")) {
	header('Location: ' . $REDIRECT[$Language]);
}

$Sword = new phpsword($REPOSITORIES);
	
$Modlist = $Sword->getModuleList();
if	(!preg_match("/(^|<nx>)".$defaultbible[$Language].";Biblical Texts(<nx>|$)/", $Modlist)) {
	$firstbible = array();
	preg_match("/(^|<nx>)([^;]+);Biblical Texts/", $Modlist, $firstbible);
	if (count($firstbible)) $defaultbible[$Language] = $firstbible[2];
}

$Default = array('mod'=>$defaultbible[$Language], 'mod2'=>$defaultbible[$Language], 'cmp'=>'0',
					'loc'=>'Gen.1.1.1',
					'hdg'=>'1', 'ftn'=>'1', 'crn'=>'1', 'dtl'=>'1', 'wcr'=>'1', 'vsn'=>'1', 
					'hvp'=>'1', 'hcn'=>'1', 'stn'=>'1', 'mlt'=>'1', 'mse'=>'1',
					'rmod'=>'', 'rtype'=>'', 'rlist'=>'');

// Do input checking and apply defaults
$_GET = array_merge($Default, $_GET);
if ($_GET['cmp'] == '0') $_GET['mod2'] = $Default['mod2'];
if (isset($_GET['noj'])) {
	$_GET['ftn'] = '0';
	$_GET['crn'] = '0';
	$_GET['dtl'] = '0';
	unset($_GET['noj']);	
}

// GET names: bk, ch, vs, lv all override loc, but are then unset
$p = preg_split("/\./", $_GET['loc']);
if (isset($_GET['bk'])) {$p[0] = $_GET['bk']; $p[3] = $p[2] = $p[1] = 1;}
if (isset($_GET['ch'])) {$p[1] = $_GET['ch']; $p[3] = $p[2] = 1;}
if (isset($_GET['vs'])) {$p[2] = $_GET['vs']; $p[3] = $p[2];}
if (isset($_GET['lv'])) $p[3] = $_GET['lv'];
$_GET['loc'] = join(".", $p);

// Remove all GET names not included in the Default list
$del = array_diff_key($_GET, $Default);
reset($del);
while (list($name, $val) = each($del)) {unset($_GET[$name]);}

// Check values of GET params
reset($_GET);

while (list($name, $val) = each($_GET)) {
	if (preg_match("/^(mod|mod2|rmod)$/", $name)) {
		$_GET[$name] = preg_replace($MODCLEAN, "", $val);
		if	(!preg_match("/(^|<nx>)".$val.";(.*?)(<nx>|$)/", $Modlist)) {
			$_GET[$name] = $Default[$name];
		}
		continue;
	}
	else if ($name == 'loc') {
		$_GET[$name] = preg_replace($LOCCLEAN, "", $val);
		continue;
	}
	else if ($name == 'rlist') {continue;} // handled by AJAX below
	else if ($name == 'rtype' && $val !== '') {
		if (!preg_match("/^(reflist|dictlist|stronglist)$/", $val)) {
			// Then cancel any un-supported AJAX requests
			$_GET['rmod'] = '';
			$_GET['rtype'] = '';
			$_GET['rlist'] = '';
		}
	}
	else if (!preg_match("/^(0|1)$/", $val)) {$_GET[$name] = $Default[$name];}
}

// The master verse system/module is the verse system of the URL location
$MasterMod = $_GET['mod']; // left most text, like "Holy Bible" program
$MasterVsys = $Sword->getVerseSystem($MasterMod);

// Check and normalize page location
$_GET['loc']  = $Sword->convertLocation($MasterVsys, $_GET['loc'], $MasterVsys);

// Apply Sword options
$_GET['mlt'] = $_GET['stn']; // just synch these two together
reset($Option);
while (list($var, $val) = each($Option)) {$Sword->setGlobalOption($val, ($_GET[$var] == '1' ? "On":"Off"));}
  

// Handle any AJAX request
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
			$p[1] = decodeutf8(preg_replace($OSISREFCLEAN, "", $p[1]));
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
	}
	echo $html;
	exit;
}
unset($_GET['rtype']);
unset($_GET['rlist']);
unset($_GET['rmod']);




// Finally read and save chapter text, footnotes and other script variables
$Biblelist = getBibleList();

if ($_GET['cmp'] == '0') {	
	$PageText = $Sword->getChapterText($_GET['mod'], $_GET['loc']);
	if (strlen($PageText) < 64) {
		$_GET['loc'] = validLocation($_GET['mod']);
		$PageText = $Sword->getChapterText($_GET['mod'], $_GET['loc']);		
	}
	$PageFootnotes = htmlspecialchars($Sword->getFootnotes());
	$PageCrossrefs = htmlspecialchars($Sword->getCrossRefs());
	$BookIntro1 = $Sword->getBookIntroduction($_GET['mod'], $_GET['loc']);
	$BookIntro2 = "";
	$ModInfo1 = moduleInfo($_GET['mod']);
	$ModInfo2 = "";
}
else {
	$PageText = $Sword->getChapterTextMulti($_GET['mod'].",".$_GET['mod2'], $_GET['loc'], true);
	$PageFootnotes = htmlspecialchars($Sword->getFootnotes());
	$PageCrossrefs = htmlspecialchars($Sword->getCrossRefs());
	$BookIntro1  = $Sword->getBookIntroduction($_GET['mod'], $_GET['loc']);
	$BookIntro2 = $Sword->getBookIntroduction($_GET['mod2'], $_GET['loc']);
	$ModInfo1 = moduleInfo($_GET['mod']);
	$ModInfo2 = moduleInfo($_GET['mod2']);
}
$P_LOC = preg_split("/\./", $_GET['loc']);



//
// Various utility functions
//

// Tries to set 'loc' to a valid location for the given module.
// NOTE that if Scope is not available $_GET['loc'] is returned unchanged.
function validLocation($mod) {
	global $Sword, $NOT_FOUND, $_GET;
	$loc = $_GET['loc'];
	$scope = $Sword->getModuleInformation($mod, "Scope");
	if ($scope != $NOT_FOUND) {
		$scope = preg_split("/\s+/", $scope);
		$scope = $scope[0];
		$vsys = $Sword->getVerseSystem($mod);
		$p = $Sword->convertLocation($vsys, $scope, $vsys);
		$p = preg_split("/\./", $p);
		$loc = $p[0].".1.1.1";
	}
	return $loc;
}

// Returns human readable localized Bible reference
function loc2UI($loc) {
	global $_GET, $Sword, $Book, $Language;
	$p = preg_split("/\./", $loc);
	$ret = $Book[$Language][$p[0]]." ".$p[1];
	if ($p[2]==1 && $p[3]==$Sword->getMaxVerse($_GET['mod'], $loc)) {
		return $ret;
	}
	if ($p[3] == $p[2]) return $ret.":".$p[2];
	return $ret.":".$p[2]."-".$p[3];
} 

// Returns anchor pointing to new location within current page
function sreflink($loc, $locUI) {
	global $_GET;
	return '<a href="'.pageURL(array('loc' => $loc)).'">'.loc2UI($locUI).'</a>';
}

function decodeutf8($ref) {
	$res = preg_replace_callback("/_(\d+)_/", "deOSISRef", $ref);
	return $res;
}

function deOSISRef($m) {return chrUTF8($m[1]);}

function chrUTF8($num) {
	if($num<=0x7F)       return chr($num);
	if($num<=0x7FF)      return chr(($num>>6)+192).chr(($num&63)+128);
	if($num<=0xFFFF)     return chr(($num>>12)+224).chr((($num>>6)&63)+128).chr(($num&63)+128);
	if($num<=0x1FFFFF)   return chr(($num>>18)+240).chr((($num>>12)&63)+128).chr((($num>>6)&63)+128).chr(($num&63)+128);
	return '';
}

function imgpath($m) {return '<img '.$m[1].'src="'.filepath2url($m[2]).'"';}

// Returns new location after applying given chapter delta 
function chapterDelta($d) {
	global $Sword, $MasterVsys;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[1] = $loc[1] + $d;
	$loc[2] = 1;
	$loc[3] = 1;
	$loc = $Sword->convertLocation($MasterVsys, join(".", $loc), $MasterVsys);
	return $loc;	
}

// Returns new location after applying given verse delta
function verseDelta($d) {
	global $Sword, $MasterVsys;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[2] = $loc[2] + $d;;
	$loc[3] = $loc[2];
	$loc = $Sword->convertLocation($MasterVsys, join(".", $loc), $MasterVsys);
	return $loc;	
}

function globalToggleAnchor($name, $phrase) {
	global $Sword, $Option;
	$gval = $Sword->getGlobalOption($Option[$name]);
	$new = array($name => ($gval == "On" ? "0":"1"));
	return anchor("b".$name, $new, 'button', $phrase, $name, '1');
}

// Return anchor with id, class, title, href, and innerHTML
function anchor($id, $new, $class, $phrase, $enName, $enVal) {
	global $_GET;
	$ret = '<a id="'.$id.'" class="'.$class;
	if ($enName && $enVal && $new[$enName] == $enVal) {
		$ret .= ' disabled';
	}
	$ret .= '" title="'.$phrase.'" href="'.pageURL($new).'" >';
	$ret .= '<span>'.$phrase.'</span></a>'."\n";
	return $ret;
}

// Return a complete URL with $new data overwriting current page URL data.
//		ADDS an anchor target to selected verse because without this,
//			form controls can never scroll to selected verse.
//		SKIPS AJAX params
//		SKIPS params having a value of "<unset>"
//		SKIPS params with default values to reduce URL length,
//			which also means that changes to defaults will apply 
//			retro-actively to bookmarked URLS.
function pageURL($new) {
	global $_GET, $Default;
	$url = array_merge($_GET, $new);
	$s = "";
	$h = "";
	while (list($name, $val) = each($url)) {
		if ($val == "<unset>") continue;
		if (preg_match("/^(rtype|rlist|rmod)$/", $name)) continue;
		// Keep 'mod' because otherwise we'll go to "home" page!
		if ($name != 'mod' && $val == $Default[$name]) continue;
		$h .= $s.$name.'='.$val;
		$s = "&";	
	}
	$h .= "#sv";
	return urlencode(currentFileName())."?".htmlentities($h);		
}

function currentFileName() {
	global $EntryPage;
	$parts = Explode('/', $EntryPage);
	return $parts[count($parts) - 1];
}

// Returns available books in $mod, including all $mod vsys book 
// names which are listed as values in the $incbks array. The 
// returned array's keys are keys to $Booki[$mod's vsys] and values 
// are book abbreviations. NOTE: 1) if $mod's vsys is not Synodal
// or KJV then all books in KJV are returned. 2) if Scope is not
// supplied then ALL books in $mod's vsys are returned. 
function availableBooks($mod, $incbks) {
	global $Sword, $NOT_FOUND, $Booki;
	$books = array();
	$vsys = $Sword->getVerseSystem($mod);
	foreach ($incbks as $bk) {
		$i = indexOfBook($vsys, $bk);
		if ($i != -1) $books[$i] = $bk;
	}
	$scope = $Sword->getModuleInformation($mod, "Scope");
	if ($scope != $NOT_FOUND && ($vsys == "Synodal" || $vsys == "KJV")) {
		$scope = preg_split("/ /", $scope);
		for ($i=0; $i<count($scope); $i++) {
			$bks = preg_split("/\-/", $scope[$i]);
			$lst = 0;
			for ($x=0; $x<count($bks); $x++) {
				$bks[$x] = preg_replace("/\..*$/", "", $bks[$x]);
				$idx = indexOfBook($vsys, $bks[$x]);
				if ($idx == -1) continue;
				if ($lst == 0) {$lst = $idx;}
				else {
					for ($y=$lst+1; $y<$idx; $y++) {
						$books[$y] = $Booki[$vsys][$y];	
					}	
				}
				if (!in_array($bks[$x], $books)) {
					$mi = indexOfBook($vsys, $bks[$x]);
					if ($mi != -1) $books[$mi] = $bks[$x];		
				}
			}		
		}
	}
	else {
		// Then just return all books...
		if ($vsys != "Synodal") $vsys = "KJV";
		for ($i=0; $i<count($Booki[$vsys]); $i++) {
			$books[$i] = $Booki[$vsys][$i];	
		}
	}
	return $books;	
}

function indexOfBook($vsys, $bk) {
	global $Booki;
	$key = array_search($bk, $Booki[$vsys]);
	if ($key === false) return -1;
	return $key;
}

// Returns human readable name corresponding to $mod name
// Uses $Language specific name if available
// Otherwise uses mono-lingual name if available
// Otherwise uses module's Abbreviation name if available
// Otherwise uses module name itself
function getLangName($mod) {
	global $NOT_FOUND, $Language, $languageNames, $Sword;
	if (isset($languageNames[$mod][$Language])) {
		return $languageNames[$mod][$Language];
	}
	if (isset($languageNames[$mod]['All'])) {
		return $languageNames[$mod]['All'];
	}
	$n = $Sword->getModuleInformation($mod, "Abbreviation");
	if ($n != $NOT_FOUND) return $n;
	return $mod;
}

// Returns a sorted array of available Bible modules. Each
// array value is an array: 0=>human-readable name, 1=>mod-name
function getBibleList() {
	global $Modlist;
	$ret = array();	
	$mods = preg_split("/<nx>/", $Modlist);
	for ($m=0; $m < count($mods); $m++) {
		$mod = preg_split("/;/", $mods[$m]);
		if ($mod[1] != "Biblical Texts") continue;
		array_push($ret, getLangName($mod[0]).'<nx>'.$mod[0]);
	}
	sort($ret, SORT_STRING);
	for ($i=0; $i<count($ret); $i++) {
		$r = preg_split("/<nx>/", $ret[$i]);
		$ret[$i] = $r;	
	}
	return $ret;
}

function moduleInfo($modname) {
	global $Sword, $NOT_FOUND;
		$h  = '<div class="script head1">'.getLangName($modname).'</div>'."\n";
	$v  = $Sword->getModuleInformation($modname, "ShortPromo");
	if ($v != $NOT_FOUND) {
		$h .= '<div class="script head1">'.$v.'</div>'."\n";
	}
	$v  = $Sword->getModuleInformation($modname, "Description");
	$v2 = $Sword->getModuleInformation($modname, "About");
	if ($v != $NOT_FOUND) {
		$h .= '<span>'.parseRTF($v).'</span>'."\n";
	}
	if ($v2 != $NOT_FOUND && $v2 != $v) {
		$h .= '<span>'.parseRTF($v2).'</span>'."\n";
	}
	$v = $Sword->getModuleInformation($modname, "DistributionLicense");
	$v2 = $Sword->getModuleInformation($modname, "Copyright");
	$s = "";
		$h .= '<br><hr><br><div style="text-align:center;">';
	if ($v != $NOT_FOUND) {
		$h .= $v;
		$s = ": ";
	}
	if ($v2 != $NOT_FOUND) {
		$h .= $s.$v2;
	}
		$h .= '</div>'."\n";
		$h .= '<div style="text-align:center;"><br><div>'."\n";
	$v  = $Sword->getModuleInformation($modname, "CopyrightHolder");
	if ($v != $NOT_FOUND) {
		$h .= '<b>'.$v.'</b><br>'."\n";
	}	
	$v  = $Sword->getModuleInformation($modname, "CopyrightContactAddress");
	if ($v != $NOT_FOUND) {
		$h .= '<b>'.$v.'</b><br>'."\n";
	}
	$v  = $Sword->getModuleInformation($modname, "CopyrightContactEmail");
	if ($v != $NOT_FOUND) {
		$h .= '<b>'.$v.'</b><br>'."\n";
	}			
		$h .= '</div></div>'."\n";
		
	return $h;
}
function parseRTF($t) {
	$t = preg_replace("/\\\\par/", "<br>", $t);
	$t = preg_replace("/\\\\qc(.*?)\\\\pard/", "<div style='text-align:center;'>$1</div>", $t);
	$t = preg_replace_callback("/\\\\u\{(\d+)\}(?)/", "chrUTF8CB", $t);
	return $t;
}
function chrUTF8CB($m) {return chrUTF8($m[1]);}


// Builds HTML text which displays lemma information.
//    list form is: (S|WT|SM|RM):(G|H)#
function getLemmaHTML($list) {
	global $Sword, $Language, $StrongsHebrewModule, $StrongsGreekModule, $GreekParseModule, $OSISREFCLEAN;
	$pad = "00000";
	$list = preg_split("/\./", $list);
	$matchingPhrase = array_shift($list);
	$matchingPhrase = htmlspecialchars(preg_replace("/<[^>]*>/", "", $matchingPhrase));
	$html = "<b>" . $matchingPhrase . "</b>: ";
	$sep = "";
	for ($i=0; $i<count($list); $i++) {
		$parts = preg_split("/:/", $list[$i]);
		if (!count($parts) || !$parts[1]) continue;
		$module = "";
		$key = preg_replace($OSISREFCLEAN, "", $parts[1]);
		$saveKey = $key;
		switch ($parts[0]) {
		case "S":
			if (substr($key, 0, 1) == "H") {
				$module = $StrongsHebrewModule[$Language];
			}
			else if (substr($key, 0, 1) == "G") {
				$module = $StrongsGreekModule[$Language];
				if (intval(substr($key, 1)) >= 5627) continue; // SWORD filters these out- not valid it says
			}
			$len = 5-strlen($key)+1;
			if ($len < 0) $len = 0;
			$key = substr($pad, 0, $len) . substr($key, 1);
			break;
		case "RM":
			$module = $GreekParseModule[$Language];
			break;
		case "SM":
			$saveKey = "SM" . $key;
			break;
		case "WT":
			$saveKey = "WT" . $key;
			break;     
		}

		if ($module) {
			if ($key == $pad) continue; // G tags with no number
			$entry = $Sword->getDictionaryEntry($module, $key);
			if ($entry) $html .= $sep . $entry;
			else $html .= $sep . $key;
		}
		else $html .= $sep . $saveKey;
		
		$sep = "<hr>";
		if ($html && $module) {
			$html = "<div>" . $html . "</div>";
		}
	}
	
	return $html;
}

?>
