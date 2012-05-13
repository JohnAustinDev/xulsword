#!/usr/bin/perl

use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

$MKDEV = "$MK/localeDev";
$MKSDEV = "$MKS/localeDev";
$MAPFILE   = "$MKDEV/UI-MAP.txt";
$FF2TO3MAP = "$MKDEV/FF2_to_FF3.txt";
$LOCALEDIR = ($locale ne "en-US" ? "$MKSDEV/$locale":"$MKDEV/$locale");
$LOCALECODE = "$LOCALEDIR/locale";
$FIREFOX3 = "$MKSDEV/Firefox3";

if (!-e $LOCALEDIR) {make_path($LOCALEDIR);}

# Get locale information
$ignoreShortCutKeys = "false";
if ($locale && $version && $localeALT && $firefox) {}
elsif ($locale) {
  my $ui = &UI_File($locale, 1);
  if (!open(INF, "<:encoding(UTF-8)", $ui)) {&Log("\n\nERROR UI-common.pl: could not open UI file \"$ui\".\n"); die;}
  while(<INF>) {
    if ($_ =~ /Locale=([^,]+),\s*Version=([^,]+),\s*Alternate_locale=([^,]+),\s*Firefox_locale=([^,]+)(,\s*Ignore_shortCut_keys=([^,\s]+))?\s*$/i) {
      $ltmp = $1;
      $version = $2;
      $localeALT = $3;
      $firefox = $4;
      $ignoreShortCutKeys = $6;
      if ($ignoreShortCutKeys ne "true") {$ignoreShortCutKeys = "false";}
      if ($ltmp ne $locale) {&Log("\n\nERROR UI-common.pl: Locale \"$locale\" is different than UI listing locale \"$ltmp\"!\n");}
      last;
    }
  }
  close(INF);
  if (!$version || !$localeALT || !$firefox) {&Log("\n\nERROR UI-common.pl: List file \"$ui\" header information is missing or malformed.\n"); die;}
}
else {&Log("ERROR UI-common.pl: Locale name was not provided.\n"); die;}

$locinfo = "Locale=$locale, Version=$version, Alternate_locale=$localeALT, Firefox_locale=$firefox, Ignore_shortCut_keys=$ignoreShortCutKeys\n";
  
# initialize sort variables
@sort1 = ("books","main-window","bookmark-window","search-window","search-help-window","dialog-window","file-chooser","error-reporter","splash-secure-window","configuration");
@sort2 = ("menu-file","menu-edit","menu-view","menu-options","menu-bookmarks","menu-windows","menu-help","tool-bar","context-menu","tree-column","tree","more-options");
$i=1; foreach (@sort1) {$Sort1{$_} = $i++;} $i=1; foreach (@sort2) {$Sort2{$_} = $i++;}

sub descsort {
  my $ad = $a; $ad =~ s/\:.*?$//;
  my $bd = $b; $bd =~ s/\:.*?$//;
  if ($dontsort eq "true") {
    return $MapFileEntryInfo{$MapDescInfo{$ad.":fileEntry"}.":line"} <=> $MapFileEntryInfo{$MapDescInfo{$bd.":fileEntry"}.":line"};
  }
  else {
    my $aa = $ad;
    my $bb = $bd;
    $aa =~ s/^([^\.]+)(\..*)?$/$1/;
    $bb =~ s/^([^\.]+)(\..*)?$/$1/;
    if (exists($Sort1{$aa})) {$aa = $Sort1{$aa};}
    else {$aa = 100;}
    if (exists($Sort1{$bb})) {$bb = $Sort1{$bb};}
    else {$bb = 100;}
    my $r = ($aa <=>$bb);
    if ($r != 0) {return $r;}
    $aa = $ad;
    $bb = $bd;
    $aa =~ s/^([^\.]+)\.([^\.]+)(\..*)?$/$2/;
    $bb =~ s/^([^\.]+)\.([^\.]+)(\..*)?$/$2/;
    if (exists($Sort2{$aa})) {$aa = $Sort2{$aa};}
    else {$aa = 100;}
    if (exists($Sort2{$bb})) {$bb = $Sort2{$bb};}
    else {$bb = 100;}
    if ($aa==100 && $ad =~ /_index/) {$aa = 101 + $MapDescInfo{$ad.":value"};}
    if ($bb==100 && $bd =~ /_index/) {$bb = 101 + $MapDescInfo{$bd.":value"};}
    return ($aa <=> $bb) || lc($ad) cmp lc($bd);
  }
}

sub UI_File($$) {
  my $loc = shift;
  my $n = shift;
  if ($n == 1) {$n = "";}
  else {$n = "_$n";}
  my $ldir = ($loc ne "en-US" ? "$MKSDEV/$loc":"$MKDEV/$loc");
  return "$ldir/UI-$loc$n.txt"; 
}

sub read_UI_Files($%) {
  my $loc = shift;
  my $descValuesP = shift;
  my $n = 1;
  my $f;
  do {
    $f = &UI_File($loc, $n++);
    if (-e $f) {&read_UI_File($f, $descValuesP);}
  } while (-e $f);
}

sub read_UI_File($%) {
  my $f = shift;
  my $descValuesP = shift;

  if (!open(UI, "<:encoding(UTF-8)", "$f")) {&Log("Could not open UI file \"$f\".\nFinished.\n"); die;}
  my $fn = $f;
  $fn =~ s/^.*?\/([^\/]+)$/$1/;
  &Log("INFO: Reading UI file: \"$fn\"\n");
  my $line = 0;
  while(<UI>) {
    $line++;
    if ($line == 1) {next;}
    if ($_ =~ /^\s*$/) {next;}
    if ($_ !~ /^\[(.*?)\]:\s*(.*?)\s*$/) {&Log("ERROR $f line $line: Could not parse line $_\n"); next;}
    my $d = $1;
    my $v = $2;
    if ($v eq "_NOT_FOUND_") {&Log("WARNING $fn line $line: Value for $d was \"_NOT_FOUND_\"\n"); $v = "";}
    if (exists($descValuesP->{$d})) {&Log("WARNING $fn line $line: Overwriting \"".$descValuesP->{$d}."\" with \"".$v."\" in \"$d\".\n");}
    $descValuesP->{$d} = $v;
  }
  close(UI);
}

sub readMAP($\%\%\%) {
  my $f = shift;
  my $FileEntryDescP = shift;
  my $MayBeMissingP = shift;
  my $MayBeEmptyP = shift;
  
  if (!open(INF, "<:encoding(UTF-8)", $f)) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  my $line = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*?)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $fe = $1;
    my $d = $2;
    
    if ($d =~ s/^\?\?//) {$MayBeMissingP->{$d}++;}
    if ($d =~ s/^\?//) {$MayBeEmptyP->{$d}++;}
    $FileEntryDescP->{$fe} = $d;
  }
}

sub matchDescToMapFileEntry($$$) {
  my $f = shift;
  my $d = shift;
  my $loc = shift;
  
  if (!open(INF, "<:encoding(UTF-8)", "$f")) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  while(<INF>) {
    if ($_ =~ /^\s*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*?)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $me = $1;
    my $md = $2;
    $me =~ s/\\/\//g;
    $md =~ s/^\??(<[^>]*>|\s)*//;
    $md =~ s/\*/(.*)/;
    if ($d =~ /^$md$/) {
      my $rep = $1;
      $me =~ s/\*/$rep/;
      return $me;
    }
  }
  close(INF);
  
  &Log("ERROR: Description \"$d\" not found in MAP\n");
  return "";
}

sub escfile($) {
  my $n = shift;
  
  if ("$^O" =~ /MSWin32/i) {$n = "\"".$n."\"";}
  elsif ("$^O" =~ /linux/i) {$n =~ s/([ \(\)])/\\$1/g;}
  else {&Log("Please add file escape function for your platform.\n");}
  return $n;
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  if ($p =~ /error/i) {$p = "\n$p\n";}
  if ((!$NOCONSOLELOG && $h!=-1) || !$LOGFILE || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
  if ($LOGFILE && $h!=2) {
    open(LOGF, ">>:encoding(UTF-8)", $LOGFILE) || die "Could not open log file \"$LOGFILE\"\n";
    # don't log absolute file names
    $p =~ s/\Q$MK//g;
    $p =~ s/\Q$MKS//g;
    print LOGF $p;
    close(LOGF);
  }
}

1;
