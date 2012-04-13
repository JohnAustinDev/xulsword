<?php include('php/Phrases_browserBible.php'); ?>
<?php
$swordOption["Headings"] = "Headings";
$swordOption["Footnotes"] = "Footnotes";
$swordOption["Cross_references"] = "Cross-references";
$swordOption["Dictionary"] = "Dictionary";
$swordOption["Verse_Numbers"] = "Verse Numbers";
$swordOption["Strongs_Numbers"] = "Strong's Numbers";
$swordOption["Words_of_Christ_in_Red"] = "Words of Christ in Red";
			
// Versions of IE < 9 cannot fully utilize this page
$UpgradeBrowser = 0;
$test = array();
if (preg_match('/MSIE (\\d+)/', $_SERVER['HTTP_USER_AGENT'], $test)) {
	if ($test[1] < 9) $UpgradeBrowser = 1;
}
  
$Bible = new phpsword("/home/dale/ibt.org.ru/modsword/raw");
  
session_start();
  
// Populate all session info if this is a new session
if (!isset($_SESSION['Location'])) {
	$_SESSION['Location'] = "Matt.1.1.1";
	$_SESSION['Modname'] = "UZV";
	$_SESSION['Headings'] = "On";
	$_SESSION['Footnotes'] = "On";
	$_SESSION['Cross_references'] = "On";
	$_SESSION['Dictionary'] = "On";
	$_SESSION['Words_of_Christ_in_Red'] = "On";
	$_SESSION['Verse_Numbers'] = "On";
	$_SESSION['Hebrew_Vowel_Points'] = "On";
	$_SESSION['Hebrew_Cantillation'] = "On";
	$_SESSION['Strongs_Numbers'] = "On";
	$_SESSION['Morphological_Tags'] = "On";
	$_SESSION['Morpheme_Segmentation'] = "On";
}

function setVars($name, $val) {
	global $Bible;
	switch($name) {
	case "LNG":
		$_SESSION['Modname'] = $val;
		break;
	case "LOC":
		$_SESSION['Location'] = $val;
		break;
	case "CHN":
		$loc = preg_split("/\./", $Bible->convertLocation($_SESSION['Modname'], $_SESSION['Location'], $_SESSION['Modname']));
		$loc[1] = $loc[1] + $val;
		$loc[2] = 1;
		$loc[3] = 1;
		$_SESSION['Location'] = join(".", $loc);
		break;
	case "VSN":
		$loc = preg_split("/\./", $Bible->convertLocation($_SESSION['Modname'], $_SESSION['Location'], $_SESSION['Modname']));
		$loc[2] = $loc[2] + $val;
		$loc[3] = $loc[2];
		$_SESSION['Location'] = join(".", $loc);
		break;
	default:
		if (preg_match("/^(On|Off)$/", $val)) {
			$_SESSION[$name] = $val;
		}
		break;
	}	
}

// Adjust session info if GET has been made to this page
if ($_GET) {while (list ($name, $val) = each ($_GET)) {setVars($name, $val);}}

// Normalize user input Bible location
$_SESSION['Location'] = $Bible->convertLocation($_SESSION['Modname'], $_SESSION['Location'], $_SESSION['Modname']);

// Apply Bible options according to current session
$Bible->setGlobalOption("Headings", $_SESSION['Headings']);
$Bible->setGlobalOption("Footnotes", $_SESSION['Footnotes']);
$Bible->setGlobalOption("Cross-references", $_SESSION['Cross_references']);
$Bible->setGlobalOption("Dictionary", $_SESSION['Dictionary']);
$Bible->setGlobalOption("Words of Christ in Red", $_SESSION['Words_of_Christ_in_Red']);
$Bible->setGlobalOption("Verse Numbers", $_SESSION['Verse_Numbers']);
$Bible->setGlobalOption("Hebrew Vowel Points", $_SESSION['Hebrew_Vowel_Points']);
$Bible->setGlobalOption("Hebrew Cantillation", $_SESSION['Hebrew_Cantillation']);
$Bible->setGlobalOption("Strong's Numbers", $_SESSION['Strongs_Numbers']);
$Bible->setGlobalOption("Morphological Tags", $_SESSION['Morphological_Tags']);
$Bible->setGlobalOption("Morpheme Segmentation", $_SESSION['Morpheme_Segmentation']);
  
// Is this an AJAX request?
function loc2UI($r) {return $r;}
function sreflink($ref) {return "<a>".loc2UI($ref)."</a>";}
function deOSISRef($m) {return chr($m[1]);}
function decodeOSISRef($ref) {return preg_replace_callback("/_(\d+)_/", "deOSISRef", $ref);}
function imgpath($m) {return '<img '.$m[1].'src="'.filepath2url($m[2]).'"';}
if (isset($_GET['rtype']) && isset($_GET['rkey']) && isset($_GET['rlist']) && isset($_GET['t'])) {
	$type = $_GET['rtype'];
	$key = $_GET['rkey'];
	$list = $_GET['rlist'];
	$html = "";
	switch($type) {
	case "reflist":
		$sep = "";
		$refs = preg_split("/\s*;\s*/", $list);
		for ($i=0; $i<count($refs); $i++) {
			if (!$refs[$i]) continue;
			$html .= $sep.sreflink($refs[$i]);
			$vss = $Bible->getVerseText($_SESSION['Modname'], $refs[$i]);
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
			$ent = $Bible->getDictionaryEntry($p[0], $p[1]);
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
?>
