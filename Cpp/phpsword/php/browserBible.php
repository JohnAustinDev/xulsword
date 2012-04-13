<?php include('php/Phrases_browserBible.php'); ?>
<?php
$Option["hdg"] = "Headings";
$Option["ftn"] = "Footnotes";
$Option["crn"] = "Cross-references";
$Option["dtl"] = "Dictionary";
$Option["vsn"] = "Verse Numbers";
$Option["stn"] = "Strong's Numbers";
$Option["wcr"] = "Words of Christ in Red";
$Option["hvp"] = "Hebrew Vowel Points";
$Option["hcn"] = "Hebrew Cantillation";
$Option["mlt"] = "Morphological Tags";
$Option["mse"] = "Morpheme Segmentation";
			
// Versions of IE < 9 cannot fully utilize this page
$UpgradeBrowser = 0;
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 9) $UpgradeBrowser = 1;
}
  
$Sword = new phpsword("/home/dale/ibt.org.ru/modsword/raw");
$Modlist = $Sword->getModuleList();

$Default= array('typ'=>'Biblical Texts', 'mod'=>'UZV', 'loc'=>'Gen.1.1.1', 'hdg'=>'On', 
					'ftn'=>'On', 'crn'=>'On', 'dtl'=>'On', 'wcr'=>'On', 'vsn'=>'On', 
					'hvp'=>'On', 'hcn'=>'On', 'stn'=>'On', 'mlt'=>'On', 'mse'=>'On',
					'rtype'=>'', 'rlist'=>'', 't'=>'');

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
	if (preg_match("/^(mod|typ|loc|rlist|t)$/", $name)) continue;
	if ($name == 'rtype') {
		if (!preg_match("/^(reflist|dictlist|stronglist)$/", $val)) {$_GET[$name] = $Default[$name];}
	}
	else if (!preg_match("/^(On|Off)$/", $val)) {$_GET[$name] = $Default[$name];}
}
reset($_GET);
$_GET['loc']  = $Sword->convertLocation($_GET['mod'], $_GET['loc'] , $_GET['mod']);
	
// Apply Sword options
reset($Option);
while (list($var, $val) = each($Option)) {$Sword->setGlobalOption($val, $_GET[$var]);} 
  
// Is this an AJAX request?
function loc2href($r) {
	$h1 = urlencode(currentFileName());
	$s = ""; $h2 = "";
	reset($_GET);
	while (list($name, $val) = each($_GET)) {
		if (preg_match("/^(t|rtype|rlist)$/", $name)) continue;
		if ($name == 'loc') {$val = $r;}
		$h2 .= $s.$name.'='.$val;
		$s = "&";	
	}
	return $h1."?".htmlentities($h2);	
}
function loc2UI($r) {return $r;} 
function sreflink($ref) {return '<a href="'.loc2href($ref).'">'.loc2UI($ref).'</a>';}
function deOSISRef($m) {return chr($m[1]);}
function decodeOSISRef($ref) {return preg_replace_callback("/_(\d+)_/", "deOSISRef", $ref);}
function imgpath($m) {return '<img '.$m[1].'src="'.filepath2url($m[2]).'"';}
if ($_GET['rtype'] && $_GET['rlist'] && $_GET['t']) {
	$type = $_GET['rtype'];
	$list = $_GET['rlist'];
	$html = "";
	switch($type) {
	case "reflist":
		$sep = "";
		$refs = preg_split("/\s*;\s*/", $list);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$html .= $sep.sreflink($refs[$i]);
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
			$p = preg_split("/:/", $refs[$i]);
			$p[1] = decodeOSISRef($p[1]);
			$html .= $sep."<b>".$p[1]."</b>";
			$ent = $Sword->getDictionaryEntry($p[0], $p[1]);
			if ($ent) {
				$ent = preg_replace_callback("/<img ([^>]*)src=\"File:\/\/(.*?)\"/", "imgpath", $ent);
				$html .= ": ".$ent;
			}
			$sep = "<br><hr>";
		}
		break;
	case "stronglist":
		break;
	}
	echo $html;
	exit;
}

function changeChapter($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[1] = $loc[1] + $d;
	$loc[2] = 1;
	$loc[3] = 1;
	return $Sword->convertLocation($_GET['mod'], join(".", $loc), $_GET['mod']);	
}

function changeVerse($d) {
	global $Sword;
	$loc = preg_split("/\./", $_GET['loc']);
	$loc[2] = $loc[2] + $d;
	$loc[3] = $loc[2];
	return $Sword->convertLocation($_GET['mod'], join(".", $loc), $_GET['mod']);	
}
	
?>
