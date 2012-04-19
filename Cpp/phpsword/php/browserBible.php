<?php require_once("php/Common.php"); ?>
<?php require_once('php/Phrases_browserBible.php'); ?>
<?php

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
/*
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 9) $UpgradeBrowser = 1;
}
*/

$Sword = new phpsword($REPOSITORIES);
$Modlist = $Sword->getModuleList();
if	(!preg_match("/(^|<nx>)".$defaultbible[$Language].";Biblical Texts(<nx>|$)/", $Modlist)) {
	$firstbible = array();
	preg_match("/(^|<nx>)([^;]+);Biblical Texts/", $Modlist, $firstbible);
	if (count($firstbible)) $defaultbible[$Language] = $firstbible[2];
}

$Default= array('mod'=>$defaultbible[$Language], 'mod2'=>$defaultbible[$Language], 'cmp'=>'0', 'loc'=>'Gen.1.1.1',
					'hdg'=>'1', 'ftn'=>'1', 'crn'=>'1', 'dtl'=>'1', 'wcr'=>'1', 'vsn'=>'1', 
					'hvp'=>'1', 'hcn'=>'1', 'stn'=>'1', 'mlt'=>'1', 'mse'=>'1',
					'rmod'=>'', 'rtype'=>'', 'rlist'=>'');

// Do input checking and apply defaults
$PromptForBook = 0;
if (!isset($_GET['mod'])) {$PromptForBook = 1;}
$_GET = array_merge($Default, $_GET);

// GET names: bk, ch, vs, lv all override loc, but are then unset
$p = preg_split("/\./", $_GET['loc']);
if (isset($_GET['bk'])) {$p[0] = $_GET['bk']; $p[3] = $p[2] = $p[1] = 1;}
if (isset($_GET['ch'])) {$p[1] = $_GET['ch']; $p[3] = $p[2] = 1;}
if (isset($_GET['vs'])) {$p[2] = $_GET['vs']; $p[3] = $p[2];}
if (isset($_GET['lv'])) $p[3] = $_GET['lv'];
$_GET['loc'] = join(".", $p);

// Check that requested modules exist or revert to defaults
$matches = array();
if	(!preg_match("/(^|<nx>)".$_GET['mod'].";(.*?)(<nx>|$)/", $Modlist, $matches)) {
	$_GET['mod'] = $Default['mod'];
}
if ($_GET['mod2'] != "" && !preg_match("/(^|<nx>)".$_GET['mod2'].";(.*?)(<nx>|$)/", $Modlist, $matches)) {
	$_GET['mod2'] = "";
}
if ($_GET['mod2'] == "" && $_GET['cmp'] != 0) {
	$_GET['mod2'] = $defaultbible[$Language];
}
if ($_GET['mod2'] == "" || $_GET['cmp'] == 0) {
	unset($_GET['mod2']); 
}

// Remove all GET names not included in the Default list
$del = array_diff_key($_GET, $Default);
reset($del);
while (list($name, $val) = each($del)) {unset($_GET[$name]);}

// Check values of GET params
reset($_GET);
while (list($name, $val) = each($_GET)) {
	if (preg_match("/^(mod|mod2|loc|rmod|rlist)$/", $name)) continue;
	else if ($name == 'rtype') {
		if (!preg_match("/^(reflist|dictlist|stronglist)$/", $val)) {
			$_GET[$name] = $Default[$name];
		}
	}
	else if (!preg_match("/^(0|1)$/", $val)) {$_GET[$name] = $Default[$name];}
}

// Check and normalize page location
//echo "BEFORE=".$_GET['loc']."<br>";
$vsys = $Sword->getVerseSystem($_GET['mod']);
$_GET['loc']  = $Sword->convertLocation($vsys, $_GET['loc'], $vsys);
//echo "AFTER =".$_GET['loc']."<br>";

// Apply Sword options
$_GET['mlt'] = $_GET['stn']; // just synch these two together
reset($Option);
while (list($var, $val) = each($Option)) {$Sword->setGlobalOption($val, ($_GET[$var]==1 ? "On":"Off"));}
  
// Handle any AJAX request
if ($_GET['rmod'] && $_GET['rtype'] && $_GET['rlist']) {
	$html = "";
	switch($_GET['rtype']) {
	case "reflist":
		$sep = "";
		$refs = preg_split("/\s*;\s*/", $_GET['rlist']);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$vsys = $Sword->getVerseSystem($_GET['rmod']);
			$html .= $sep.sreflink($_GET['rmod'], $Sword->convertLocation($vsys, $refs[$i], $vsys));
			$vss = $Sword->getVerseText($_GET['rmod'], $refs[$i]);
			if ($vss) {$html .= ": ".$vss;}
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
	}
	echo $html;
	exit;
}
unset($_GET['rtype']);
unset($_GET['rlist']);
unset($_GET['rmod']);

// Finally read and save chapter text, footnotes and other script variables
$Biblelist = getBibleList();

if (!isset($_GET['mod2'])) {	
	$PageText = $Sword->getChapterText($_GET['mod'], $_GET['loc']);
	if (strlen($PageText) < 64) {$PageText = validBook($_GET['mod']);}
	$PageFootnotes = htmlspecialchars($Sword->getFootnotes());
	$PageCrossrefs = htmlspecialchars($Sword->getCrossRefs());
	$BookIntro1 = $Sword->getBookIntroduction($_GET['mod'], $_GET['loc']);
	$BookIntro2 = "";
	$ModInfo1 = moduleInfo($_GET['mod']);
	$ModInfo2 = "";
}
else {
	$PageText = $Sword->getChapterTextMulti($_GET['mod2'].",".$_GET['mod'], $_GET['loc'], true);
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

function validBook($mod) {
	global $Sword, $NOT_FOUND, $_GET;
	$scope = $Sword->getModuleInformation($mod, "Scope");
	if ($scope != $NOT_FOUND) {
		$scope = preg_split("/\s+/", $scope);
		$scope = $scope[0];
		$vsys = $Sword->getVerseSystem($mod);
		$p = $Sword->convertLocation($vsys, $scope, $vsys);
		$p = preg_split("/\./", $p);
		$_GET['loc'] = $p[0].".1.1.1";
	}
	else {
		$books = availableBooks($mod, array());
		if (count($books)) {$_GET['loc'] = $books[0].".1.1.1";}
	}
	return $Sword->getChapterText($mod, $_GET['loc']);		
}

function loc2href($mod, $normref) {
	global $Sword, $_GET;
	$new = array('loc'=>$normref);
	return pageURL($_GET, $new);
}

function loc2UI($r) {
	global $_GET, $Sword, $Book, $Language;
	$loc = $Sword->convertLocation($_GET['mod'], $r, $_GET['mod']);
	$loc = preg_split("/\./", $loc);
	$ret = $Book[$Language][$loc[0]]." ".$loc[1];
	if ($loc[2]==1 && ($loc[3]==1 || $loc[3]==$Sword->getMaxVerse($_GET['mod'], $r))) {
		return $ret;
	}
	if ($loc[3]==$loc[2]) return $ret.":".$loc[2];
	return $ret.":".$loc[2]."-".$loc[3];
} 

function sreflink($mod, $ref) {return '<a href="'.loc2href($mod, $ref).'">'.loc2UI($ref).'</a>';}

function chrUTF8($num) {
	if($num<=0x7F)       return chr($num);
	if($num<=0x7FF)      return chr(($num>>6)+192).chr(($num&63)+128);
	if($num<=0xFFFF)     return chr(($num>>12)+224).chr((($num>>6)&63)+128).chr(($num&63)+128);
	if($num<=0x1FFFFF)   return chr(($num>>18)+240).chr((($num>>12)&63)+128).chr((($num>>6)&63)+128).chr(($num&63)+128);
	return '';
}

function deOSISRef($m) {return chrUTF8($m[1]);}

function decodeutf8($ref) {
	$res = preg_replace_callback("/_(\d+)_/", "deOSISRef", $ref);
	return $res;
}
function imgpath($m) {return '<img '.$m[1].'src="'.filepath2url($m[2]).'"';}

function chapter($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[1] = $loc[1] + $d;
	$loc[2] = 1;
	$loc[3] = 1;
	$vsys = $Sword->getVerseSystem($_GET['mod']);
	$loc = $Sword->convertLocation($vsys, join(".", $loc), $vsys);
	$loc = preg_split("/\./", $loc);
	return $loc[1];	
}

function verse($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[2] = $loc[2] + $d;;
	$loc[3] = $loc[2];
	$vsys = $Sword->getVerseSystem($_GET['mod']);
	$loc = $Sword->convertLocation($vsys, join(".", $loc), $vsys);
	$loc = preg_split("/\./", $loc);
	return $loc[2];	
}

function globalToggleAnchor($name, $phrase) {
	global $Sword, $Option;
	$gval = $Sword->getGlobalOption($Option[$name]);
	$new = array($name => ($gval == "On" ? "0":"1"));
	return anchor("b".$name, $new, 'button', $phrase, $name, '1');
}

function anchor($id, $new, $class, $phrase, $enName, $enVal) {
	global $_GET;
	$ret = '<a id="'.$id.'" class="'.$class;
	if ($enName && $enVal && $new[$enName] == $enVal) {
		$ret .= ' disabled';
	}
	$ret .= '" title="'.$phrase.'" href="'.pageURL($_GET, $new).'" >';
	$ret .= '<span>'.$phrase.'</span></a>'."\n";
	return $ret;
}

function pageURL($base, $new) {
	$url = array_merge($base, $new);
	$s = "";
	$h = "";
	while (list($name, $val) = each($url)) {
		if (preg_match("/^(rtype|rlist|rmod)$/", $name)) continue;
		$h .= $s.$name.'='.$val;
		$s = "&";	
	}
	$h .= "#sv";
	return urlencode(currentFileName())."?".htmlentities($h);		
}

function availableBooks($mod, $incbks) {
	global $Sword, $NOT_FOUND, $Booki;
	$books = array();
	$vsys = $Sword->getVerseSystem($mod);
	foreach ($incbks as $bk) {
		$books[indexOfBook($vsys, $bk)] = $bk;
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
				if ($lst == 0) {$lst = $idx;}
				else {
					for ($y=$lst+1; $y<$idx; $y++) {
						$books[$y] = $Booki[$vsys][$y];	
					}	
				}
				if (!in_array($bks[$x], $books)) {
					$books[indexOfBook($vsys, $bks[$x])] = $bks[$x];		
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
	for ($i=0; $i<count($Booki[$vsys]); $i++) {if ($bk == $Booki[$vsys][$i]) return $i;}
	return 0;
}

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
		$h .= '<span>'.parseRTF($v).'</span'."\n";
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
		$h .= '<div style="text-align:center;"><div>'."\n";
	$v  = $Sword->getModuleInformation($modname, "CopyrightHolder");
	if ($v != $NOT_FOUND) {
		$h .= '<h3>'.$v.'</h3>'."\n";
	}	
	$v  = $Sword->getModuleInformation($modname, "CopyrightContactAddress");
	if ($v != $NOT_FOUND) {
		$h .= '<h3>'.$v.'</h3>'."\n";
	}
	$v  = $Sword->getModuleInformation($modname, "CopyrightContactEmail");
	if ($v != $NOT_FOUND) {
		$h .= '<h3>'.$v.'</h3>'."\n";
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


// Builds HTML text which displays lemma information
//    list form: (S|WT|SM|RM):(G|H)#
function getLemmaHTML($list) {
	global $Sword, $Language, $StrongsHebrewModule, $StrongsGreekModule, $GreekParseModule;
	$pad = "00000";
	$styleModule = "Program";
	$list = preg_split("/\./", $list);
	$matchingPhrase = array_shift($list);
	$html = "<b>" . $matchingPhrase . "</b>: ";
	$sep = "";
	for ($i=0; $i<count($list); $i++) {
		$parts = preg_split("/:/", $list[$i]);
		if (!count($parts) || !$parts[1]) continue;
		$module = "";
		$key = $parts[1];
		$key = preg_replace("/ /", "", $key);
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
			if ($styleModule == "Program") $styleModule = $module;
			if ($key == $pad) continue; // G tags with no number
			$entry = $Sword->getDictionaryEntry($module, $key);
			if ($entry) $html .= $sep . $entry;
			else $html .= $sep . $key;
		}
		else $html .= $sep . $saveKey;
		
		$sep = "<hr>";
		if ($html && $module) {
			$html = "<div class=\"vstyle" . $module . "\">" . $html . "</div>";
		}
	}
	
	return $html;
}

?>
