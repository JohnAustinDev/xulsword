<?php require_once("php/Common.php"); ?>
<?php require_once('php/Phrases_browserBible.php'); ?>
<?php

$Media = ($handheld > 0 ? "handheld":"screen");
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

$Default = array('m1'=>$defaultbible[$Language], 'l'=>'Gen.1.1.1',
					'hdg'=>'1', 'ftn'=>'1', 'crn'=>'1', 'dtl'=>'1', 'wcr'=>'1', 'vsn'=>'1', 
					'hvp'=>'1', 'hcn'=>'1', 'stn'=>'1', 'mlt'=>'1', 'mse'=>'1',
					'rmod'=>'', 'rtype'=>'', 'rlist'=>'');
					
$QuerySort = array("m", "mc1", "mc2", "mc3", "mc4", "mc5", "mc6", "mc7", "mc8", "mc9", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "l", "g");

// New flags can be added to the end of this list, but the existing 
// order should never change (or else existing links will break!).
$Optord = array('hdg','ftn','crn','dtl','wcr','vsn','hvp','hcn','stn','mlt','mse');

$Redirect = 0;

$UpgradeBrowser = 0;

$IsInternetExplorer = false;
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 8) $UpgradeBrowser = 1;
	$IsInternetExplorer = true;
}

$_GET = internalGET($_GET);

// Go to "home" page if no mod is specified
$PromptForBook = 0;
if (!isset($_GET['m1'])) {$PromptForBook = 1;}

if (!extension_loaded("phpsword")) {
	header('Location: ' . $REDIRECT[$Language]);
}

$Sword = new phpsword($REPOSITORIES);
	
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

$PageFootnotes = htmlspecialchars($Sword->getFootnotes());
$PageCrossrefs = htmlspecialchars($Sword->getCrossRefs());
$c = 1;
while (isset($_GET['m'.$c])) {
	$BookIntro[$c]  = $Sword->getBookIntroduction($_GET['m'.$c], $_GET['l']);
	$ModInfo[$c] = moduleInfo($_GET['m'.$c]);
	$c++;
}
$_LOC = preg_split("/\./", $_GET['l']);


// We're done collecting all necessary data required for building a page!


////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////
// Various utility functions
//

function redirect($a) {
	header ('HTTP/1.1 301 Moved Permanently');
  header ('Location: '.currentFileName().'?'.http_build_query(publicGET($a)))."#sv";
  exit;	
}

// Converts an internal GET array into a canonical GET array for use in public URLs.
function publicGET($a) {
	global $Optord, $Default;
	$n = 0;
	$b = 1;
	for ($i=0; $i < count($Optord); $i++) {
		if (isset($a[$Optord[$i]])) {
			$v = $a[$Optord[$i]];
			unset($a[$Optord[$i]]);
		}
		else {$v = $Default[$Optord[$i]];}
		if ($v == '0') {$n += $b;}
		$b = $b << 1;
	}
	
	$del = array('rmod'=>'', 'rtype'=>'', 'rlist'=>'');
	$a = array_diff_key($a, $del);
	
	if (isset($a['l'])) $a['l'] = simpleloc($a['l']); 

	$a['g'] = dechex($n);
	
	// change identical mx entries into single mcx entry
	if (isset($a['m1']) && isset($a['m2'])) {
		$fmod = $a['m1'];
		reset($a);
		while (list($name, $val) = each($a)) {
			if ($fmod && preg_match('/^m\d+$/', $name) && $val != $fmod) $fmod = "";
		}
		if ($fmod) {
			$cnt = 0;
			reset($a);
			while (list($name, $val) = each($a)) {
				if (preg_match('/^m\d+$/', $name)) {
					$cnt++;
					unset($a[$name]);
				}
			}
			$a['mc'.$cnt] = $fmod;
		}
	}

	// change m1 entry into m entry	
	if (isset($a['m1'])) {
		$a['m'] = $a['m1'];
		unset($a['m1']);
	}

	uksort($a, "querysort");

	return $a;
}

// Converts a get array into an internally correct GET array. Requests
// a redirect if the starting get array is not in compressed form.
function internalGET($a) {
	global $Redirect, $NumCols, $IsInternetExplorer;
	
	// Request redirect to compressed URL if this one is uncompressed
	if (isset($a['g'])) {$a = queryArrUncompress($a);}
	else {$Redirect = 1;}

	// Handle any 'mc' param for flow-columns
	for ($c=1; $c<=9; $c++) {
		if (isset($a['mc'.$c])) {
			for ($m=1; $m<=9; $m++) {
				if ($m == 1) $a['m'.$m] = $a['mc'.$c];
				elseif ($m <= $c && !$IsInternetExplorer) $a['m'.$m] = $a['mc'.$c];
				elseif (isset($a['m'.$m])) unset($a['m'.$m]);
			}
			unset($a['mc'.$c]);
		}
	}

	// Insure all m params are sequential. Limit is 9 columns.
	if (isset($a['m'])) {
		$a['m1'] = $a['m'];
		unset($a['m']);
	}
	$ms = array();
	for ($c=1; $c<=9; $c++) {
		if (isset($a['m'.$c])) {
			array_push($ms, $a['m'.$c]);
			unset($a['m'.$c]);
		}
	}
	$NumCols = 0;
	for ($c=1; $c<=count($ms); $c++) {$a['m'.$c] = $ms[$c-1]; $NumCols++;}
	
	return $a;
}

function querysort($a, $b) {
	global $QuerySort;
	$an = array_search($a, $QuerySort);
	if ($an === false) $an = 99;
	$bn = array_search($b, $QuerySort);
	if ($bn === false) $bn = 99;
	if ($an < $bn) return -1;
	if ($an > $bn) return 1;
	return 0;
}

function simpleloc($loc) {
	global $Sword, $_GET;
	$p = preg_split("/\./", $loc);
	if (isset($p[3]) && $p[3]==$p[2] || 
			($p[2]==1 && $p[3]==$Sword->getMaxVerse($_GET['m1'], $loc))) {
		unset($p[3]);
		if (isset($p[2]) && $p[2]==1) {
			unset($p[2]);
			if (isset($p[1]) && $p[1]==1) {
				unset($p[1]);
			}
		}
	}
	return join(".", $p);
}

// This uncompresses the 'g' query string to get global settings
function queryArrUncompress($a) {
	global $Optord;
	if (isset($a['g'])) {
		$n = hexdec($a['g']);

		for ($i=0; $i < count($Optord); $i++) {
			$a[$Optord[$i]] = "1";
			if ($n & 1) {$a[$Optord[$i]] = "0";}
			$n = $n >> 1;
		}
		unset($a['g']);	
	}
	
	return $a;
}

// Tries to set 'l' to a valid location for the given module.
// NOTE that if Scope is not available $_GET['l'] is returned unchanged.
function validLocation($mod) {
	global $Sword, $NOT_FOUND, $_GET;
	$loc = $_GET['l'];
	$scope = $Sword->getModuleInformation($mod, "Scope");
	if ($scope != $NOT_FOUND) {
		$scope = preg_split("/\s+/", $scope);
		$scope = $scope[0];
		$vsys = $Sword->getVerseSystem($mod);
		$p = $Sword->convertLocation($vsys, $scope, $vsys);
		$p = preg_split("/\./", $p);
		$loc = $p[0].".1.1";
	}
	return $loc;
}

// Returns human readable localized Bible reference
function loc2UI($loc) {
	global $_GET, $Sword, $Book, $Language;
	$p = preg_split("/\./", $loc);
	$ret = $Book[$Language][$p[0]]." ".$p[1];
	if ($p[2]==1 && $p[3]==$Sword->getMaxVerse($_GET['m1'], $loc)) {
		return $ret;
	}
	if ($p[3] == $p[2]) return $ret.":".$p[2];
	return $ret.":".$p[2]."-".$p[3];
} 

// Returns anchor pointing to new location within current page
function sreflink($loc, $locUI) {
	global $_GET;
	return '<a href="'.pageURL(array('l' => $loc), 1, 0).'">'.loc2UI($locUI).'</a>';
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
	$loc = preg_split("/\./", $_GET['l']);
	$loc[1] = $loc[1] + $d;
	$loc[2] = 1;
	$loc[3] = 1;
	$loc = $Sword->convertLocation($MasterVsys, join(".", $loc), $MasterVsys);
	return $loc;	
}

// Returns new location after applying given verse delta
function verseDelta($d) {
	global $Sword, $MasterVsys;
	$loc = preg_split("/\./", $_GET['l']);
	$loc[2] = $loc[2] + $d;;
	$loc[3] = $loc[2];
	$loc = $Sword->convertLocation($MasterVsys, join(".", $loc), $MasterVsys);
	return $loc;	
}

// Return a toggle type anchor used for global settings
function globalToggleAnchor($name, $phrase) {
	global $Sword, $Option;
	$gval = $Sword->getGlobalOption($Option[$name]);
	$new = array($name => ($gval == "On" ? "0":"1"));
	$disable = ($new[$name] == "1");
	return anchor("b".$name, $new, 'button', $phrase, $disable, "");
}

// Return anchor with id, class, title, href, and innerHTML
function anchor($id, $new, $class, $phrase, $disable, $attribs) {
	global $_GET;
	$ret = '<a '.$attribs.'id="'.$id.'" class="'.$class;
	if ($disable) $ret .= ' disabled';
	$ret .= '" title="'.$phrase.'" href="'.pageURL($new, 1, 0).'" >';
	$ret .= '<span>'.$phrase.'</span></a>'."\n";
	return $ret;
}

// Return a complete URL with $new data overwriting current page URL data.
//		ADDS an anchor target to selected verse because without this,
//			form controls can never scroll to selected verse.
//		SKIPS AJAX params
//		SKIPS params having a value of "<unset>"
function pageURL($new, $useHtmlEntities, $query) {
	global $_GET, $Default;
	$a = array_merge($_GET, $new);
	
	reset($a);
	while (list($name, $val) = each($a)) {
		if ($val == "<unset>") unset($a[$name]);
		if (preg_match("/^(rtype|rlist|rmod)$/", $name)) unset($a[$name]);
	}

	$h = http_build_query(publicGET($a));
	
	if ($useHtmlEntities) {$h = htmlentities($h);}
	
	if ($query) {return $h;}
	else {
		return urlencode(currentFileName())."?".$h."#sv";	
	}	
}

function currentFileName() {
	global $EntryPage;
	$parts = Explode('/', $EntryPage);
	return $parts[count($parts) - 1];
}

// Returns available books in $mod, also including $incbk. The 
// returned array's keys are string keys to $Booki[$mod's vsys] and values 
// are book abbreviations. NOTE: 1) if $mod's vsys is not Synodal
// or KJV then all books in KJV are returned. 2) if Scope is not
// available then ALL books in $mod's vsys are returned. 
function availableBooks($mod, $incbk) {
	global $Sword, $NOT_FOUND, $Booki;
	$books = array();
	$vsys = $Sword->getVerseSystem($mod);
	
	$i = indexOfBook($vsys, $incbk);
	if ($i != -1) $books['b'.$i] = $incbk;

	$scope = $Sword->getModuleInformation($mod, "Scope");
	if ($scope != $NOT_FOUND && ($vsys == "Synodal" || $vsys == "KJV")) {
		$scope = preg_split("/ /", $scope);
		for ($i=0; $i<count($scope); $i++) {
			$bks = preg_split("/\-/", $scope[$i]);
			$lst = -1;
			for ($x=0; $x<count($bks); $x++) {
				$bks[$x] = preg_replace("/\..*$/", "", $bks[$x]);
				$idx = indexOfBook($vsys, $bks[$x]);
				if ($idx == -1) continue;
				if ($lst == -1) {$lst = $idx;}
				else {
					for ($y=$lst+1; $y<$idx; $y++) {
						$books['b'.$y] = $Booki[$vsys][$y];	
					}	
				}
				if (!in_array($bks[$x], $books)) {
					$mi = indexOfBook($vsys, $bks[$x]);
					if ($mi != -1) $books['b'.$mi] = $bks[$x];		
				}
			}		
		}
	}
	else {
		// Then just return all books...
		if ($vsys != "Synodal") $vsys = "KJV";
		for ($i=0; $i<count($Booki[$vsys]); $i++) {
			$books['b'.$i] = $Booki[$vsys][$i];	
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
// Uses module's Abbreviation name if available
// Otherwise uses module name itself
function getLangName($mod) {
	global $NOT_FOUND, $Language, $Sword;
	$n = $Sword->getModuleInformation($mod, "Abbreviation");
	if ($n != $NOT_FOUND) return $n;
	return $mod;
}

// Returns HTML with the module's conf information.
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
