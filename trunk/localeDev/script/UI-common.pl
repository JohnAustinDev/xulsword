#!/usr/bin/perl

use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

$mapFile   = "$MK/localeDev/UI-MAP.txt";
$ff2to3MAP = "$MK/localeDev/FF2_to_FF3.txt";
$listFile  = "$MKS/localeDev/$locale/UI-".$locale.".txt";
$listFile2 = "$MKS/localeDev/$locale/UI-".$locale."_2.txt";

# Get locale information
$ignoreShortCutKeys = "false";
if ($locale && $version && $localeALT && $firefox) {}
elsif ($locale) {
  if (!open(INF, "<:encoding(UTF-8)", "$listFile")) {&Log("\n\nERROR UI-common.pl: could not open UI file \"$listFile\".\n"); die;}
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
  if (!$version || !$localeALT || !$firefox) {&Log("\n\nERROR UI-common.pl: List file \"$listFile\" header information is missing or malformed.\n"); die;}
}
else {&Log("ERROR UI-common.pl: Locale name was not provided.\n"); die;}
$locinfo = "Locale=$locale, Version=$version, Alternate_locale=$localeALT, Firefox_locale=$firefox, Ignore_shortCut_keys=$ignoreShortCutKeys\n";

if (!-e "$MKS/localeDev") {make_path("$MKS/localeDev");}
if (!-e "$MKS/localeDev/$locale") {make_path("$MKS/localeDev/$locale");}
  
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
    if ($v eq "_NOT_FOUND_") {&Log("WARNING $fn line $line: Value for $d was \"_NOT_FOUND_\"\n"); next;}
    if (exists($descValuesP->{$d})) {&Log("WARNING $fn line $line: Overwriting \"".$descValuesP->{$d}."\" with \"".$v."\" in \"$d\".\n");}
    $descValuesP->{$d} = $v;
  }
  close(UI);
}

sub loadMAP($%%%$) {
  my $f = shift;
  
  # "real" below means any wild cards have been replaced with real values
  # all-code-files-in-map:real-entries:(real-description|line|unused|optional) = corresponding value
  my $mapFileEntryInfoP = shift;
  
  # real-description:(final-value|final-code-file-and-real-entry) = corresponding value
  my $mapDescInfoP = shift;
  
  # all-code-files-in-map:each-entry-in-located-code-file = UI phrase
  my $codeFileEntryValueP = shift;
  
  my $supressWarn = shift;
  
  my @values;
  my @wildms;
  
  if (!open(INF, "<:encoding(UTF-8)", "$f")) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  my $line = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*?)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $fileEntry = $1;
    my $desc = $2;
    
    $fileEntry =~ s/\\/\//g;
    
    my $fileReqd = "true";
    if ($fileEntry =~ s/\/\?([^\/]*)$/\/$1/) {$fileReqd = "false";}

    # capture and remove any special <> or ? markers
    $desc =~ s/^(\??(<[^>]+>)*)//;
    my $tmp = $1;
    my $unused = "false"; my $maxversion = ""; my $optional = "false";
    if ($tmp =~ s/^\?//) {$optional = "true";}
    while ($tmp =~ s/^<([^>]+)>\s*//) {
      my $i = $1;
      if ($i =~ /^unused$/) {$unused = "true";}
      elsif ($i =~ /[\d\.]/) {
        $maxversion = $i;
        if ($maxversion < $version) {$outdated = $outdated . "WARNING line $line: skipping outdated entry - $desc\n"; $tmp="next"; last;}
      }
      else {&Log("ERROR line $line: Could not parse description code - $i\n");}
    }
    if ($tmp eq "next") {next;}

    # get and save description's value when applicable...
    undef(@values);
    undef(@wildms);
    # this routine usually returns only one value, but when the "*" wildcard is present in the entry, it needs to return all matching entries plus the wild match...
    &readValuesFromFile(\@values, \@wildms, $fileEntry, $codeFileEntryValueP, $supressWarn, $fileReqd);
    
    my $i;
    for ($i = 0; $i < @values; $i++) {
      my $d = $desc;
      my $fe = $fileEntry;
      if (exists($wildms[$i]) && $wildms[$i] ne "") {
        $d =~ s/\*/$wildms[$i]/;
        $fe =~ s/\*/$wildms[$i]/;
      }
      
      # save fileEntry and its information
      $mapFileEntryInfoP->{$fe.":desc"}       = $d;
      $mapFileEntryInfoP->{$fe.":line"}       = $line;
      $mapFileEntryInfoP->{$fe.":unused"}     = $unused;
      $mapFileEntryInfoP->{$fe.":optional"}   = $optional;
    
      if (exists($mapDescInfoP->{$d.":value"})) {
        if    ($values[$i] eq "_NOT_FOUND_") {next;}
        elsif ($mapDescInfoP->{$d.":value"} eq "_NOT_FOUND_") {}
        elsif ($unused eq "true") {next;}
        elsif ($mapFileEntryInfoP->{$mapDescInfoP->{$d.":fileEntry"}.":unused"} eq "true") {}
        elsif ($sourceFF3 ne "true" && $fe !~ /^xulsword\//) {next;}
        elsif ($sourceFF3 eq "true" && $fe =~ /^xulsword\// && (!exists($FF2_to_FF3{$fe}) || $FF2_to_FF3{$fe} =~ /<unavailable>/))  {next;}

        if ($supressWarn ne "true" && $mapDescInfoP->{$d.":value"} ne $values[$i]) {
          &Log("WARNING line $line: Changing \"".$d."\" from \"".$mapDescInfoP->{$d.":value"}."\" to \"".$values[$i]."\"\n");
        }
      }

      $mapDescInfoP->{$d.":value"}     = $values[$i];
      $mapDescInfoP->{$d.":fileEntry"} = $fe;
    }
  }
  close(INF);
}

# Reads all values in the file (if file has not already been read) into
# associative array. Returns requested value.
sub readValuesFromFile(@@$%$$) {
  my $valuesP = shift;
  my $wildmsP = shift;
  my $fe = shift;
  my $codeFileEntryValueP = shift;
  my $supressWarn = shift;
  my $fReqd = shift;
  
  my $te = $fe;
  # if we're sourcing from ff3 and we have a matching MAP entry, transform the file to ff3
  my $fr = ""; my $to = ""; my $ap = "";
  if ($sourceFF3 eq "true" && exists($FF2_to_FF3{$fe}) && $FF2_to_FF3{$fe} !~ /<unavailable>/) {
    $te = $FF2_to_FF3{$fe};
    if ($te =~ s/\s*<change (.*?) to (.*?)>\s*//) {$fr = $1; $to = $2;}
    if ($te =~ s/\s*<append (.*?)>\s*//) {$ap = $1;}
  }
  $te =~ /^(.*?)\:/;
  my $f = $1;
  
  if (!exists($Readfiles{$f})) {&readFile($f, $codeFileEntryValueP, $fReqd);}

  my @entries;
  $entries[0] = $te;
  if ($te =~ /:.*\*/) {&getMatchingEntries(\@entries, $wildmsP, $te, $codeFileEntryValueP);}
  my $i = 0;
  foreach (@entries) {
    # wildcard (multiple) entries cannot be mapped from FF2_to_FF3 and we know they exist in the $codeFileEntryValueP already, so they skip the following block
    if (@entries == 1 && !exists($codeFileEntryValueP->{$_})) {
      # if this was a mapped file, but the entry was missing, look in the original file for the entry
      if ($_ ne $fe) {
        $_ = $fe;
        $_ =~ /^(.*?)\:/;
        $f = $1;
        if (!exists($Readfiles{$f})) {&readFile($f, $codeFileEntryValueP, $fReqd);}
      }
      if (!exists($codeFileEntryValueP->{$_})) {
        if ($supressWarn ne "true") {
          &Log("WARNING readValuesFromFile was \"_NOT_FOUND_\": \"$_\"\n");
        }
        $valuesP->[$i++] = "_NOT_FOUND_";
        return;
      }
    }

    if ($fr ne "") {$codeFileEntryValueP->{$_} =~ s/\Q$fr/$to/;}
    if ($ap ne "") {$codeFileEntryValueP->{$_} = $codeFileEntryValueP->{$_}." ".$ap;}
    $valuesP->[$i++] = $codeFileEntryValueP->{$_};
  }
}

sub getMatchingEntries(@@$%) {
  my $listP = shift;
  my $wildmatchesP = shift;
  my $e = shift;
  my $codeFileEntryValueP = shift;

  $re = quotemeta($e);
  if ($re =~ s/\\\*/(.*)/) {$got=1;}
  else {$got=0;}

  my $i = 0;
  for $ee (keys %{$codeFileEntryValueP}) {
    if ($ee !~ /$re/) {next;}
    my $s = $1;
    my $eee = $ee;
    $eee =~ s/\*/$s/;
    $listP->[$i] = $eee;
    $wildmatchesP->[$i] = $s;
    $i++;
  }
}

sub readFile($%$) {
  my $f = shift;
  my $codeFileEntryValueP = shift;
  my $fileRequired = shift;
  
  # look in locale, if file is not found, then look in alternate locale, if still not found, then use en-US and report WARNING
  my $ff = &getFileFromLocale($f, $locale, $firefox);
  if (!-e $ff) {$ff = &getFileFromLocale($f, $localeALT, $firefox);}
  if (!-e $ff && $fileRequired eq "false") {return;}
  if (!-e $ff) {$ff = &getFileFromLocale($f, "en-US", "en-US"); &Log("WARNING: Resorting to en-US for file \"$f\".\n");}
  if (!-e $ff) {&Log("ERROR readFile \"$f\": Could not locate code file. Tried \"$locale\", \"$localeALT\" and \"en-US\".\nFinished.\n"); die;}

  my $t = $ff;
  $t =~ s/^.*\.//;
  if (!open(CFL, "<:encoding(UTF-8)", "$ff")) {&Log("ERROR readFile \"$f\": Could not open code file $ff\nFinished.\n"); die;}
  while(<CFL>) {
    my $e = "";
    my $v = "";
    if ($t =~ /^properties$/i) {
      if ($_ =~ /^\s*\#/) {next;}
      elsif ($_ =~ /^\s*([^=]+?)\s*\=\s*(.*?)\s*$/) {$e = $1; $v = $2;}
      else {next;}
    }
    elsif ($t =~ /^dtd$/i) {
      if ($_ =~ /^\s*<\!--/) {next;}
      elsif ($_ =~ /<\!ENTITY\s+([^\"]+?)\s*\"(.*?)\"\s*>/) {$e = $1; $v = $2;}
      else {next;}
    }
    else {&Log("ERROR readFile \"$f\": Unknown file type $t\nFinished.\n"); die;}

    if (exists($codeFileEntryValueP->{$f.":".$e})) {&Log("ERROR readFile \"$f\": Multiple instances of $e in $f\n");}
    else {$codeFileEntryValueP->{$f.":".$e} = $v;}
  }
  $Readfiles{$f} = $ff;
  close(CFL);
}

# decode the file path and locale name into a real path and return that path
sub getFileFromLocale($$$) {
  my $f = shift;
  my $l = shift;
  my $ffl = shift;
  
  if ($f =~ /^xulsword\//) {
    if ($l ne "en-US") {
      $fr = "$MKS/localeDev/$l/locale/$f";
    }
    else {
      $f =~ s/^xulsword\///; # this path was changed...
      $fr = "$MK/xul/locale/en-US/$f";
    }
  }
  elsif ($sourceFF3 eq "true" && $f =~ s/^\[locale-browser\]\///) {$fr = "$MKS/localeDev/Firefox3/$ffl/locale/$f";}
  elsif ($sourceFF3 eq "true" && $f =~ s/^\[locale-global\]\///)  {$fr = "$MKS/localeDev/Firefox3/$ffl/locale/$ffl/$f";}
  else {
    if ($l ne "en-US") {$fr = "$MKS/localeDev/$l/locale/$f";}
    else {$fr = "$MK/xul/locale/en-US/$f";}
    if ($sourceFF3 eq "true" || !-e $fr) {$fr = "$MKS/localeDev/Firefox3/$ffl/locale/$ffl/$f";}  
  }

  return $fr;
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
      if ($me !~ /^xulsword[\\\/]/) {
        &Log("ERROR: description \"$d\" matched file \"$fe\" but file is not in xulsword directory.\n");
        die;
      }
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
  if ((!$NOCONSOLELOG && $h!=-1) || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
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
