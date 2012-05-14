#!/usr/bin/perl

use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

$MKDEV = "$MK/localeDev";
$MKSDEV = "$MKS/localeDev";
$MAPFILE   = "$MKDEV/UI-MAP.txt";
$LOCALEDIR = ($locale ne "en-US" ? "$MKSDEV/$locale":"$MKDEV/$locale");
$LOCALECODE = "$LOCALEDIR/locale";
$FIREFOX = "$MKSDEV/$firefoxDirName";

if (!-e $LOCALEDIR) {make_path($LOCALEDIR);}

# Get locale information
$ignoreShortCutKeys = 0;
if ($locale && $version && $localeALT) {}
elsif ($locale) {
  my $ui = &UI_File($locale, 1);
  if (!open(INF, "<:encoding(UTF-8)", $ui)) {&Log("\n\nERROR UI-common.pl: could not open UI file \"$ui\".\n"); die;}
  while(<INF>) {
    if ($_ =~ /\s*\#?\s*Locale=([^,]+),\s*Version=([^,]+),\s*Alternate_locale=([^,]+),\s*Firefox_locale=([^,]+)(,\s*Ignore_shortCut_keys=([^,\s]+))?\s*$/i) {
      $ltmp = $1;
      $version = $2;
      $localeALT = $3;
      $firefox = $4;
      $ignoreShortCutKeys = ($6 eq "true" ? 1:0);
      if ($ltmp ne $locale) {&Log("\n\nERROR UI-common.pl: Locale \"$locale\" is different than UI listing locale \"$ltmp\"!\n");}
      last;
    }
  }
  close(INF);
  if (!$version || !$localeALT || !$firefox) {&Log("\n\nERROR UI-common.pl: List file \"$ui\" header information is missing or malformed.\n"); die;}
}
else {&Log("ERROR UI-common.pl: Locale name was not provided.\n"); die;}

$locinfo = "# Locale=$locale, Version=$version, Alternate_locale=$localeALT, Firefox_locale=$locale, Ignore_shortCut_keys=$ignoreShortCutKeys\n";

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
    if ($_ =~ /^\s*$/) {next;}
    if ($_ =~ /^\s*\#/) {next;}
    if ($_ !~ /^\[(.*?)\]:\s*(.*?)\s*$/) {&Log("ERROR $f line $line: Could not parse line $_\n"); next;}
    my $d = $1;
    my $v = $2;
    if ($v eq "_NOT_FOUND_") {&Log("WARNING $fn line $line: Value for $d was \"_NOT_FOUND_\"\n"); $v = "";}
    if (exists($descValuesP->{$d})) {&Log("WARNING $fn line $line: Overwriting \"".$descValuesP->{$d}."\" with \"".$v."\" in \"$d\".\n");}
    $descValuesP->{$d} = $v;
  }
  close(UI);
}

sub readMAP($\%\%\%\%\%) {
  my $f = shift;
  my $fileEntryDescP = shift;
  my $mayBeMissingP = shift;
  my $mayBeEmptyP = shift;
  my $mapLineP = shift;
  
  if (!open(INF, "<:encoding(UTF-8)", $f)) {&Log("Could not open MAP file $f.\nFinished.\n"); die;}
  my $line = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ =~ /^\s*\#/) {next;}
    if ($_ !~ /^\s*([^=]+?)\s*\=\s*(.*?)\s*$/) {&Log("ERROR line $line: Could not parse UI-MAP entry \"$_\"\n"); next;}
    my $fe = $1;
    my $d = $2;
    
    if ($d =~ s/^\?\?//) {$mayBeMissingP->{$d}++;}
    if ($d =~ s/^\?//) {$mayBeEmptyP->{$d}++;}
    $fileEntryDescP->{$fe} = $d;
    $mapLineP->{$fe} = $line;
    $mapLineP->{$d} = $line;
  }
}

sub correlateUItoMAP(\%\%\%\%\%\%) {
  my $uiDescValueP = shift;
  my $fileEntryDescP = shift;
  my $mayBeMissingP = shift;
  my $mayBeEmptyP = shift;
  my $codeFileEntryValuesP = shift;
  my $isShortcutKeyP = shift;
  my $matchedDescriptionsP = shift;

  my %isFEWild;
  for my $d (sort keys %{$uiDescValueP}) {
    for my $fe (keys %{$fileEntryDescP}) {
      my $fed = quotemeta($fileEntryDescP->{$fe});
      if ($fed =~ s/\\\*/(.*)/) {$isFEWild{$fe}++;}
      if ($d =~ /^$fed$/) {
        my $w = $1;
        my $fe2 = $fe;
        if (exists($isFEWild{$fe})) {
          $fe2 =~ s/\*/$w/;
        }
        $matchedDescriptionsP->{$d}++;
        if ($fe2 !~ /^(.+?)\:(.+)\s*$/) {&Log("ERROR: Malformed file:entry \"$fe2\"\n"); next;}
        $codeFileEntryValuesP->{$fe2} = $uiDescValueP->{$d};
        $isShortcutKeyP->{$fe2} = ($d =~ /\.(ak|ck)$/ ? 1:0);
        if (exists($isFEWild{$fe})) {next;}
        if ($uiDescValueP->{$d} =~ /^\s*$/ && !exists($mayBeEmptyP->{$fileEntryDescP->{$fe}})) {
          &Log("WARNING $fe2: Value is empty.\n");
        }
        $fileEntryDescP->{$fe} = "<uSEd>";
      }
    }
  }
  
  # handle MAP file-entries which need to exist, but which are not used by the UI (and so are not in the UI files)
  for my $fe (keys %{$fileEntryDescP}) {
    if ($fileEntryDescP->{$fe} =~ /^"(.*)"$/) {
      $codeFileEntryValuesP->{$fe} = $1;
      $fileEntryDescP->{$fe} = "<uSEd>";
    }
  }
  
  # clear and report any ERRORS
  &clearErrors($uiDescValueP, $fileEntryDescP, $mayBeMissingP, $matchedDescriptionsP);
}

sub clearErrors(\%\%\%\%\%) {
  my $uiDescValueP = shift;
  my $fileEntryDescP = shift;
  my $mayBeMissingP = shift;
  my $matchedDescriptionsP = shift;
  
  # report any UI listing phrases which were not in MAP, and remove them.
  for my $d (sort keys %{$uiDescValueP}) {
    if (!exists($matchedDescriptionsP->{$d})) {
      &Log("ERROR: Description \"$d = \"".$uiDescValueP->{$d}."\" was not found in the MAP.\n");
      delete($uiDescValueP->{$d});
    }
  }

  # report any MAP file entries which were not matched, and add empty place holders
  for my $fe (keys %{$fileEntryDescP}) {
    if (exists($mayBeMissingP->{$fileEntryDescP->{$fe}})) {next;}
    if (&isWild($fe, 1)) {next;}
    if ($fileEntryDescP->{$fe} ne "<uSEd>") {
      &Log("ERROR: MAP file entry was not matched: \"$fe = ".$fileEntryDescP->{$fe}."\".\n");
      $uiDescValueP->{$fileEntryDescP->{$fe}} = "";
    }
  }
}

sub translateValue($$$) {
  my $v = shift;
  my $floc = shift;
  my $tloc = shift;

  # look for a matching value in from-locale and return its file-entry
  if (!-e "$FIREFOX/$floc") {
    &Log("Cannot translate: No Firefox locale: \"$FIREFOX/$floc\".\n");
    return "";
  }
  
  if (!-e "$FIREFOX/$tloc") {
    &Log("Cannot translate: No Firefox locale: \"$FIREFOX/$tloc\".\n");
    return "";
  }
  
  my $elps = decode("utf8", "…");
  $v =~ s/\.\.\./$elps/g;
  
  my $v2 =           &xtrans($v, "$FIREFOX/$floc", 0, $floc, $tloc);
  if (!$v2) {$v2 =   &xtrans($v, "$FIREFOX/$floc", 1, $floc, $tloc);}
  if (!$v2 && $v =~ s/($elps)$// || $v =~ s/(\W+)$//) {
    my $nw = $1;
    $v2 =            &xtrans($v, "$FIREFOX/$floc", 0, $floc, $tloc);
    if (!$v2) {$v2 = &xtrans($v, "$FIREFOX/$floc", 1, $floc, $tloc);}
    if ($v2) {&Log("GOTONE=$nw !!!!!!!!!!\n"); $v2 .= $nw;}
  }
  
  return $v2;
}

my %Entry, %Value;
sub xtrans($$$$$) {
  my $v = shift;
  my $dir = shift;
  my $nocase = shift;
  my $floc = shift;
  my $tloc = shift;

  my $v2 = "";
  if (!opendir(CDIR, $dir)) {&Log("ERROR: Could not open \"$dir\".\n"); die;}
  my @files = readdir(CDIR);
  closedir(CDIR);
  
  foreach my $f (@files) {
    if ($f =~ /^\./) {next;}
    my $p = "$dir/$f";
  
    # skip if this file is not in alternate locale
    my $np = $p;
    $np =~ s/\Q$FIREFOX\E//;
    $np =~ s/\/\Q$floc\E(\/|$)/\/$tloc\//g;
    $np = "$FIREFOX$np";
    if (!-e $np) {next;}
    
    if (-d $p) {$v2 = &xtrans($v, $p, $nocase, $floc, $tloc);}
    else {
      my $e;
      
      if (!$Entry{$p}{"<rEAd>"}) {&readCode($p, \%Entry, \%Value);}
      
      if (!$nocase) {if ($Entry{$p}{$v}) {$e = $Entry{$p}{$v};}}
      else {
        foreach my $mv (keys %{$Entry{$p}}) {
          if ($v =~ /^\Q$mv\E$/i) {
            $e = $Entry{$p}{$mv};
            &Log("INFO: Success with case insensetive match: $v <> $mv.\n");
            last;
          }
        }
      }
      
      if ($e) {
        if (!$Value{$np}{"<rEAd>"}) {&readCode($np, \%Entry, \%Value);}
        if ($Value{$np}{$e}) {$v2 = $Value{$np}{$e};}
      }
      
    }
    
    if ($v2) {last;}
  }
 
  return $v2;
}

sub readCode($\%$) {
  my $f = shift;
  my $feP = shift;
  my $vP = shift;

  if (open(INF, "<:encoding(UTF-8)", $f)) {
    while(<INF>) {
      my $e = "";
      my $v = "";
      if ($f =~ /\.properties$/i) {
        if ($_ =~ /^\s*\#/) {next;}
        elsif ($_ =~ /^\s*([^=]+?)\s*\=\s*(.*?)\s*$/) {$e = $1; $v = $2;}
        else {next;}
      }
      elsif ($f =~ /\.dtd$/i) {
        if ($_ =~ /^\s*<\!--/) {next;}
        elsif ($_ =~ /<\!ENTITY\s+([^\"]+?)\s*\"(.*?)\"\s*>/) {$e = $1; $v = $2;}
        else {next;}
      }

      if ($e && $v) {
        $feP->{$f}{$v} = $e;
        $vP->{$f}{$e} = $v;
      }
    }
    close(INF);
    
    $feP->{$f}{"<rEAd>"}++;
    $vP->{$f}{"<rEAd>"}++;
  }
  else {&Log("ERROR: Could not open code file \"$f\".\n");}
}

sub saveLocaleCode($$) {
  my $loc = shift;
  my $srcf = shift;
  my $destd = shift;
  
  $srcf = "$MKSDEV/$loc/$srcf";
  $destd = "$MKSDEV/$loc/$destd";
  $destf = "$MKSDEV/$loc/$srcf";
  $destf =~ s/^.*?\/([^\/]+)$/$1/;
  $destf = "$destd/$destf";
  
  if (-e $srcf) {
    my $in;
    if (-e $destf) {
      print "\n\nFile Exists:\nsrc =$srcf\ndest=$destf:\n\tOverwrite existing? (Y/N):"; 
      $in = <>;
    }
    else {$in = "y";}
      
    if ($in =~ /^\s*y\s*$/i) {
      if (!-e $destd) {make_path($destd);}
      cp($srcf, $destd);
    }
    
  }
}

sub isSecondary($$\%\%) {
  my $v = shift;
  my $d = shift;
  my $mayBeMissingP = shift;
  my $mayBeEmptyP = shift;
  
  my $s = 0;
  if ($v =~ /^\s*$/)                              {$s = 1;}
  elsif ($d =~ /^search\-help\-window\..*_term$/) {$s = 1;}
  elsif ($d =~ /^locale_direction/)               {$s = 1;}
  elsif ($d =~ /^books\..*_index/)                {$s = 1;}
  elsif ($d =~ /^numeral-/)                       {$s = 1;}
  elsif ($d =~ /\.(ak|ck)$/)                      {$s = 1;}
  elsif ($mayBeMissingP->{$d})                    {$s = 1;}
  elsif ($mayBeEmptyP->{$d})                      {$s = 1;}
  elsif (&isWild($d, 0))                          {$s = 1;}
  
  return $s;
}

sub isWild($$) {
  my $t = shift;
  my $isfe = shift;
  
  if ($t =~ /\*/) {return 1;}
  if ($isfe) {
    if (!keys(%WildFE)) {&getWilds();}
    foreach my $w (keys %WildFE) {if ($t =~ /^($w)$/) {return $1;}}
  }
  else {
    if (!keys(%WildD)) {&getWilds();}
    foreach my $w (keys %WildD) {if ($t =~ /^($w)$/) {return $1;}}  
  }
  return 0;
}

sub getWilds() {
  if (!open(WLD, "<:encoding(UTF-8)", $MAPFILE)) {$die;}
  while (<WLD>) {
    if ($_ =~ /^([^=]+?)\s*\=\s*\?*(.*?)\s*$/) {
      my $fe = $1;
      my $d = $2;
      if ($d =~ /^".*"$/) {next;}
      $fe =~ s/^.*?://;
      if ($fe =~ /\*/) {
        $fe = quotemeta($fe);
        $fe =~ s/\\\*/(.*)/;
        $WildFE{$fe}++;
      }
      if ($d =~ /\*/) {
        $d = quotemeta($d);
        $d =~ s/\\\*/(.*)/;
        $WildD{$d}++;
      }
    }
  }
  close(WLD);
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
