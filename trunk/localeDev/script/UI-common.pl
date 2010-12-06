#!/usr/bin/perl

$mapFile   = "$MK\\localeDev\\UI-MAP.txt";
$ff2to3MAP = "$MK\\localeDev\\FF2_to_FF3.txt";
$listFile  = "$MKS\\localeDev\\$locale\\UI-".$locale.".txt";
$listFile2 = "$MKS\\localeDev\\$locale\\UI-".$locale."_2.txt";

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

sub readDescriptionsFromUI($%) {
  my $f = shift;
  my $descValuesP = shift;

  if (!open(UI, "<$f")) {&Log("Could not open UI file \"$f\".\nFinished.\n"); die;}
  my $line = 0;
  while(<UI>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ =~ /Locale:(.*?), Version:(.*?) \(Alternate locale:(.*?)\)/) {
      $version = $2;
      $localeALT = $3;
      if ($locale ne $1) {&Log("WARNING $f line $line: Locale label \"$1\" does not match locale directory \"$locale\"\n");}
      next;
    }
    if ($_ !~ /^\[(.*?)\]:\s*(.*?)\s*$/) {&Log("ERROR $f line $line: Could not parse line $_\n"); next;}
    my $d = $1;
    my $v = $2;
    if ($v eq "_NOT_FOUND_") {&Log("WARNING $f line $line: Value for $d was \"$v\"\n"); next;}
    if (exists($descValuesP->{$d})) {&Log("WARNING $f line $line: Overwriting \"".$descValuesP->{$d}."\" with \"".$v."\" in \"$d\".\n");}
    $descValuesP->{$d} = $v;
  }
  close(UI);
}

sub loadMAP($%%%$) {
  my $f = shift;
  my $mapDescInfoP = shift;
  my $mapFileEntryInfoP = shift;
  my $codeFileEntryValueP = shift;
  my $supressWarn = shift;
  
  my @values;
  my @wildms;
  
  if (!open(INF, "<$f")) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  my $line = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^[\s]*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $fileEntry = $1;
    my $desc = $2;
    
    my $fileReqd = "true";
    if ($fileEntry =~ s/\\\?([^\\]*)$/\\$1/) {$fileReqd = "false";}

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
    # this routines usually returns only one value, but when the "*" wildcard is present in the entry, it needs to return all matching entries plus the wild match...
    &readValuesFromFile(\@values, \@wildms, $fileEntry, $codeFileEntryValueP, $supressWarn, $fileReqd);
    
    my $i;
    for ($i = 0; $i < @values; $i++) {
      my $d = $desc;
      if (exists($wildms[$i]) && $wildms[$i] ne "") {
        $d =~ s/\*/$wildms[$i]/;
        $fileEntry =~ s/\*/$wildms[$i]/;
      }
      
      # save fileEntry and its information
      $mapFileEntryInfoP->{$fileEntry.":desc"}       = $d;
      $mapFileEntryInfoP->{$fileEntry.":line"}       = $line;
      $mapFileEntryInfoP->{$fileEntry.":unused"}     = $unused;
      $mapFileEntryInfoP->{$fileEntry.":optional"}   = $optional;
    
      if (exists($mapDescInfoP->{$d.":value"})) {
        if    ($values[$i] eq "_NOT_FOUND_") {next;}
        elsif ($mapDescInfoP->{$d.":value"} eq "_NOT_FOUND_") {}
        elsif ($unused eq "true") {next;}
        elsif ($mapFileEntryInfoP->{$mapDescInfoP->{$d.":fileEntry"}.":unused"} eq "true") {}
        elsif ($sourceFF3 ne "true" && $fileEntry !~ /^xulsword\\/) {next;}
        elsif ($sourceFF3 eq "true" && $fileEntry =~ /^xulsword\\/ && (!exists($FF2_to_FF3{$fileEntry}) || $FF2_to_FF3{$fileEntry} =~ /<unavailable>/))  {next;}

        if ($supressWarn ne "true" && $mapDescInfoP->{$d.":value"} ne $values[$i]) {
          &Log("WARNING line $line: Changing \"".$d."\" from \"".$mapDescInfoP->{$d.":value"}."\" to \"".$values[$i]."\"\n");
        }
      }

      $mapDescInfoP->{$d.":value"}     = $values[$i];
      $mapDescInfoP->{$d.":fileEntry"} = $fileEntry;
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
  $re =~ s/\\\*/(.*)/;

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
  my $fr = shift;
  
  # look in locale, if file is not found, then look in alternate locale
  my $ff = &getFileFromLocale($f, $locale);
  if ($ff eq "") {$ff = &getFileFromLocale($f, $localeALT);}
  if ($ff eq "" && $fr eq "false") {return;}
  elsif ($ff eq "") {&Log("ERROR readFile  \"$f\": Could not locate code file. Tried \"$locale\" and \"$localeALT\".\nFinished.\n"); die;}

  my $t = $ff;
  $t =~ s/^.*\.//;
  if (!open(CFL, "<$ff")) {&Log("ERROR readFile \"$f\": Could not open code file $ff\nFinished.\n"); die;}
  while(<CFL>) {
    #utf8::upgrade($_);
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
sub getFileFromLocale($$) {
  my $f = shift;
  my $l = shift;
  my $ff3 = "";
  opendir(DIR, "$MKS\\localeDev\\$l");
  @files = readdir(DIR);
  foreach (@files) {if ($_ =~ /^(.*?)\.lnk/ && -e "$MKS\\localeDev\\Firefox3\\$1") {$ff3 = $1;}}
  close(DIR);
  if ($ff3 eq "") {&Log("ERROR line $line: Missing shortcut to base locale in $l.\nFinished.\n"); die;}
  my $f1 = ""; my $f2 = "";
  if ($f =~ s/^\[locale-browser\]\\//) {$f1 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$f";}
  elsif ($f =~ s/^\[locale-global\]\\//) {$f1 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$ff3\\$f";}
  elsif ($f =~ /^xulsword\\/) {
    if ($l eq "en-US") {
      $f1 = "$MK\\xul\\en-US.xs\\en-US-xulsword\\$f";
    }
    else {$f1 = "$MKS\\localeDev\\$l\\locale\\$f";}
  }
  else {
    if ($sourceFF3 ne "true") {
      if ($l eq "en-US") {$f1 = "$MK\\xul\\en-US.xs\\en-US-xulsword\\$f";}
      else {$f1 = "$MKS\\localeDev\\$l\\locale\\$f";}
    }
    $f2 = "$MKS\\localeDev\\Firefox3\\$ff3\\locale\\$ff3\\$f";
  }

  if (-e $f1) {return $f1;}
  if (-e $f2) {return $f2;}
  return "";
}

sub Print($) {
  my $p = shift;
  print OUTF $p;
}

sub Log($) {
  my $p = shift;
  if ($SupressLog eq "true") {return;}
  if ($logFile ne "") {print LOG $p;}
  else {print $p;}
}

1;