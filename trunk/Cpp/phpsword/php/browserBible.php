<?php include('php/Phrases_browserBible.php'); ?>
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
			
// Versions of IE < 9 cannot fully utilize this page
$UpgradeBrowser = 0;
/*
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 9) $UpgradeBrowser = 1;
}
*/

$defbible = "RSP";
$Sword = new phpsword($REPOSITORY);
$Modlist = $Sword->getModuleList();
if	(!preg_match("/(^|<nx>)".$defbible.";Biblical Texts(<nx>|$)/", $Modlist)) {
	$firstbible = array();
	preg_match("/(^|<nx>)([^;]+);Biblical Texts/", $Modlist, $firstbible);
	if (count($firstbible)) $defbible = $firstbible[2];
}

$Default= array('typ'=>'Biblical Texts', 'mod'=>$defbible, 'loc'=>'Gen.1.1.1', 'hdg'=>'1', 
					'ftn'=>'1', 'crn'=>'1', 'dtl'=>'1', 'wcr'=>'1', 'vsn'=>'1', 
					'hvp'=>'1', 'hcn'=>'1', 'stn'=>'1', 'mlt'=>'1', 'mse'=>'1',
					'rtype'=>'', 'rlist'=>'');

// Do input checking and apply defaults
$_GET = array_merge($Default, $_GET);
if	(!preg_match("/(^|<nx>)".$_GET['mod'].";".$_GET['typ']."(<nx>|$)/", $Modlist)) {
	$_GET['mod'] = $Default['mod'];
	$_GET['typ'] = $Default['typ'];
}
$del = array_diff_key($_GET, $Default);
reset($del);
while (list($name, $val) = each($del)) {unset($_GET[$name]);}
reset($_GET);
while (list($name, $val) = each($_GET)) {
	if (preg_match("/^(mod|typ|loc|rlist)$/", $name)) continue;
	if ($name == 'rtype') {
		if (!preg_match("/^(reflist|dictlist|stronglist)$/", $val)) {
			$_GET[$name] = $Default[$name];
		}
	}
	else if (!preg_match("/^(0|1)$/", $val)) {$_GET[$name] = $Default[$name];}
}
$vsys = $Sword->getVerseSystem($_GET['mod']);
$_GET['loc']  = $Sword->convertLocation($vsys, $_GET['loc'], $vsys);
	
// Apply Sword options
$_GET['mlt'] = $_GET['stn']; // just synch these two together
reset($Option);
while (list($var, $val) = each($Option)) {$Sword->setGlobalOption($val, ($_GET[$var]==1 ? "On":"Off"));}
  
// Handle any AJAX request
if ($_GET['rtype'] && $_GET['rlist']) {
	$type = $_GET['rtype'];
	$list = $_GET['rlist'];
	$html = "";
	switch($type) {
	case "reflist":
		$sep = "";
		$refs = preg_split("/\s*;\s*/", $list);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$vsys = $Sword->getVerseSystem($_GET['mod']);
			$html .= $sep.sreflink($Sword->convertLocation($vsys, $refs[$i], $vsys));
			$vss = $Sword->getVerseText($_GET['mod'], $refs[$i]);
			if ($vss) {$html .= ": ".$vss;}
			$sep = "<br><hr>";
		}
		break;
	case "dictlist":
		$sep = "";
		$refs = preg_split("/\s+/", $list);
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
		$html = getLemmaHTML(decodeutf8($list));
		break;
	}
	echo $html;
	exit;
}

// Finally read and save chapter text and footnotes
$ChapterText = $Sword->getChapterText($_GET['mod'], $_GET['loc']);
if (!$ChapterText || strlen($ChapterText) < 64) $ChapterText = validBook($_GET);
$ChapterFootnotes = htmlspecialchars($Sword->getFootnotes());
$ChapterCrossrefs = htmlspecialchars($Sword->getCrossRefs());


//
// Various utility functions
//

function validBook() {
	global $Sword, $NOT_FOUND, $_GET;
	$scope = $Sword->getModuleInformation($_GET['mod'], "Scope");
	if ($scope != $NOT_FOUND) {
		$scope = preg_split("/\s+/", $scope);
		$scope = $scope[0];
		$vsys = $Sword->getVerseSystem($_GET['mod']);
		$p = $Sword->convertLocation($vsys, $scope, $vsys);
		$p = preg_split("/\./", $p);
		$_GET['loc'] = $p[0].".1.1.1";
	}
	else {
		$books = availableBooks();
		if (count($books)) {$_GET['loc'] = $books[0].".1.1.1";}
	}
	return $Sword->getChapterText($_GET['mod'], $_GET['loc']);		
}

function loc2href($r) {
	global $Sword;
	$s = ""; $h2 = "";
	reset($_GET);
	while (list($name, $val) = each($_GET)) {
		if (preg_match("/^(t|rtype|rlist)$/", $name)) continue;
		if ($name == 'loc') {
			$vsys = $Sword->getVerseSystem($_GET['mod']);
			$val = $Sword->convertLocation($vsys, $r, $vsys);
		}
		$h2 .= $s.$name.'='.$val;
		$s = "&";	
	}
	return urlencode(currentFileName())."?".htmlentities($h2);	
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

function sreflink($ref) {return '<a href="'.loc2href($ref).'#sv">'.loc2UI($ref).'</a>';}

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

function changeChapter($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[1] = $loc[1] + $d;
	$loc[2] = 1;
	$loc[3] = 1;
	$vsys = $Sword->getVerseSystem($_GET['mod']);
	return $Sword->convertLocation($vsys, join(".", $loc), $vsys);	
}

function changeVerse($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[2] = $loc[2] + $d;
	$loc[3] = $loc[2];
	$vsys = $Sword->getVerseSystem($_GET['mod']);
	return $Sword->convertLocation($vsys, join(".", $loc), $vsys);	
}
	
function optionButton($name, $phrase) {
	global $Sword, $Option;
	$gval = $Sword->getGlobalOption($Option[$name]);
	echo '<button type="submit" name="'.$name.'" ';
	if ($gval == "On") echo 'class="optenabled" ';
	echo 'value="'.($gval=="On" ? "0":"1").'" >';
	echo $phrase;
	echo "</button>\n";
}

// This function runs slowly as is, and so should be used very sparingly if at all!
function availableBooks() {
	global $Sword, $_GET;
	$books = array();
	$loc = "Gen.1.1.1";
	do {
		$p = preg_split("/\./", $loc);
		$b = $p[0];
		if (strlen($Sword->getChapterText($_GET['mod'], $loc)) > 64) {
			array_push($books, $p[0]);
		}
		$p[1] = $Sword->getMaxChapter($_GET['mod'], $loc);
		$p[2] = $Sword->getMaxVerse($_GET['mod'], $loc) + 1;
		$p[3] = $p[2];
		$vsys = $Sword->getVerseSystem($_GET['mod']);
		$loc = $Sword->convertLocation($vsys, join(".", $p), $vsys);
	} while($b != "Rev");
	return $books;	
}

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
