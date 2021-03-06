#!/usr/bin/perl

use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

$MKDEV = "$MK/localeDev";
$MKSDEV = "$MKS/localeDev";
$MAPFILE   = "$MKDEV/UI-MAP.txt";
$LOCALEDIR = &localeDirectory($LOCALE);
$LOCALECODE = "$LOCALEDIR/locale";
$SHORTCUT = "(\\.accesskey|\\.commandkey|\\.keybinding|\\.key|\\.sc|\\.sh|\\:LanguageMenuAccKey|\\:SearchAccKey)\$";

if (!-e $LOCALEDIR) {&Log("ERROR UI-common.pl: Locale directory does not exist \"$LOCALEDIR\".\n"); die;}

# Get locale information
$IGNORE_SHORTCUT_KEYS = 0;
if ($LOCALE && $VERSION && $LOCALE_ALT) {}
elsif ($LOCALE) {
  my $ui = &UI_File($LOCALE, 1);
  if (!open(INF, "<:encoding(UTF-8)", $ui)) {&Log("ERROR UI-common.pl: could not open UI file \"$ui\".\n"); die;}
  while(<INF>) {
    if ($_ =~ /\s*\#?\s*Locale=([^,]+),\s*Version=([^,]+),\s*Alternate_locale=([^,]+),\s*Firefox_locale=([^,]+)(,\s*Ignore_shortCut_keys=([^,\s]+))?\s*$/i) {
      $ltmp = $1;
      $VERSION = $2;
      $LOCALE_ALT = $3;
      $LOCALE_FF = $4;
      $IGNORE_SHORTCUT_KEYS = ($6 eq "true" ? 1:0);
      if ($ltmp ne $LOCALE) {&Log("\n\nERROR UI-common.pl: Locale \"$LOCALE\" is different than UI listing locale \"$ltmp\"!\n");}
      last;
    }
  }
  close(INF);
  if (!$VERSION || !$LOCALE_ALT || !$LOCALE_ALT) {&Log("\n\nERROR UI-common.pl: List file \"$ui\" header information is missing or malformed.\n"); die;}
}
else {&Log("ERROR UI-common.pl: Locale name was not provided.\n"); die;}

$LOCINFO = "# Locale=$LOCALE, Version=$VERSION, Alternate_locale=$LOCALE_ALT, Firefox_locale=$LOCALE_FF, Ignore_shortCut_keys=$IGNORE_SHORTCUT_KEYS\n";

# Get MAP file max and min xulsword versions
if (!open(INF, "<:encoding(UTF-8)", "$MKDEV/UI-MAP.txt")) {&Log("ERROR: UI-common.pl: could not open UI-MAP.txt file \"$MKDEV/UI-MAP.txt\".\n"); die;}
while (<INF>) {
  if ($_ !~ /^\# MIN_XULSWORD_VERSION:(.*?), MAX_XULSWORD_VERSION:(.*?)\s*$/) {
    &Log("ERROR: UI-MAP.txt versions not found.\n");
    die;
  }
  $MAP_MIN_VERSION = $1;
  $MAP_MAX_VERSION = $2;
  last;
}
close(INF);

sub UI_File($$) {
  my $loc = shift;
  my $n = shift;
  if ($n == 1) {$n = "";}
  else {$n = "_$n";}
  my $ldir = &localeDirectory($loc);
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
    if ($_ =~ /^([^\:]+\.([^\.\:\s]+))\s*=\s*(chrome\:\/\/.*?)\s*$/) {
      my $xsFile = $1;
      my $ffFile = $3;
      $OVERRIDES{$3} = $1;
      next;
    }
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
        elsif (exists($isFEWild{$fe}) && $uiDescValueP->{$d} =~ /^\s*$/) {next;}
        elsif ($uiDescValueP->{$d} =~ /^\s*$/ && 
						(!exists($mayBeEmptyP->{$fileEntryDescP->{$fe}}) && !exists($mayBeMissingP->{$fileEntryDescP->{$fe}}))) {
          &Log("WARNING $fe2: Value is empty.\n");
        }
      
        $codeFileEntryValuesP->{$fe2} = $uiDescValueP->{$d};
        
        if (!exists($isFEWild{$fe})) {
					$fileEntryDescP->{$fe} = "<uSEd>";
				}
      }
    }
  }

  # insure every code file entry has a value
  for my $fe (keys %{$fileEntryDescP}) {
    # handle MAP file-entries which need to exist, but which are not used by the UI (and so are not in the UI files)
    if ($fileEntryDescP->{$fe} =~ /^"(.*)"$/) {
      $codeFileEntryValuesP->{$fe} = $1;
      $fileEntryDescP->{$fe} = "<uSEd>";
    }
    elsif (exists($isFEWild{$fe})) {next;} # Don't want wildcard expressions to have their own values
    elsif (!exists($codeFileEntryValuesP->{$fe})) {$codeFileEntryValuesP->{$fe} = "";}
  }

  # clear and report any ERRORS
  &clearErrors($uiDescValueP, $fileEntryDescP, $codeFileEntryValuesP, $mayBeMissingP, $mayBeEmptyP, $matchedDescriptionsP);
}

sub clearErrors(\%\%\%\%\%\%) {
  my $uiDescValueP = shift;
  my $fileEntryDescP = shift;
  my $codeFileEntryValuesP = shift;
  my $mayBeMissingP = shift;
  my $mayBeEmptyP = shift;
  my $matchedDescriptionsP = shift;

  # report any UI listing phrases which were not in MAP, and remove them.
  for my $d (sort keys %{$uiDescValueP}) {
    if (!exists($matchedDescriptionsP->{$d})) {
      &Log("ERROR: Description \"$d = \"".$uiDescValueP->{$d}."\" was not found in the MAP.\n");
      delete($uiDescValueP->{$d});
    }
  }

  # report any MAP file entries which were not matched, and add alternate place holders
  my %NotMatched;
  for my $fe (sort keys %{$fileEntryDescP}) {
    if (exists($mayBeMissingP->{$fileEntryDescP->{$fe}})) {next;}
    if (&isWild($fe, 1)) {next;}
    if ($fileEntryDescP->{$fe} ne "<uSEd>") {

      $uiDescValueP->{$fileEntryDescP->{$fe}} = "";

      if (!( $mayBeEmptyP->{$fileEntryDescP->{$fe}} || ($IGNORE_SHORTCUT_KEYS && ($fe =~ /$SHORTCUT/)) )) {
				if (!(%UIDescValueALT)) {
					# read the alternate locale UI
					&read_UI_Files($LOCALE_ALT, \%UIDescValueALT);
				}
				
				# use alternate value in code file if alternate value exists
				if (exists($UIDescValueALT{$fileEntryDescP->{$fe}})) {
					$codeFileEntryValuesP->{$fe} = $UIDescValueALT{$fileEntryDescP->{$fe}};
					$NotMatched{$fileEntryDescP->{$fe}} = $UIDescValueALT{$fileEntryDescP->{$fe}};
				}
				else {
					$NotMatched{$fileEntryDescP->{$fe}} = "";
					&Log("ERROR: No Alternate value for \"".$fileEntryDescP->{$fe}."\"\n");
				}
      }
      
    }
  }
  
  foreach my $desc (sort keys %NotMatched) {
		&Log("MISSING: [".$desc."]: ".$NotMatched{$desc}."\n");
	}
  
}

sub translateValue($$$$) {
  my $v = shift;
  my $floc = shift;
  my $tloc = shift;
  my $ffdir = shift;

  my $f_ffpath = &localeDirectory($floc);
  $f_ffpath =~ s/\Q$floc$/$ffdir/;
  my $t_ffpath = &localeDirectory($tloc);
  $t_ffpath =~ s/\Q$tloc$/$ffdir/;

  # look for a matching value in from-locale and return its file-entry
  if (!-e "$f_ffpath/$floc") {
    &Log("Cannot translate: No Firefox locale: \"$f_ffpath/$floc\".\n");
    return "";
  }

  if (!-e "$t_ffpath/$tloc") {
    &Log("Cannot translate: No Firefox locale: \"$t_ffpath/$tloc\".\n");
    return "";
  }

  my $elps = decode("utf8", "…");
  $v =~ s/\.\.\./$elps/g;

  my $v2 =           &xtrans($v, "$f_ffpath/$floc", 0, $floc, $tloc, $ffdir);
  if (!$v2) {$v2 =   &xtrans($v, "$f_ffpath/$floc", 1, $floc, $tloc, $ffdir);}
  if (!$v2 && $v =~ s/($elps)$// || $v =~ s/(\W+)$//) {
    my $nw = $1;
    $v2 =            &xtrans($v, "$f_ffpath/$floc", 0, $floc, $tloc, $ffdir);
    if (!$v2) {$v2 = &xtrans($v, "$f_ffpath/$floc", 1, $floc, $tloc, $ffdir);}
    if ($v2) {&Log("GOTONE=$nw !!!!!!!!!!\n"); $v2 .= $nw;}
  }

  return $v2;
}

# Translates value $v by locating it in any locale file under $dir, and
# returning the corresponding value from another locale: $tloc.
my %Entry, %Value;
sub xtrans($$$$$$) {
  my $v = shift;
  my $dir = shift;
  my $nocase = shift;
  my $floc = shift;
  my $tloc = shift;
  my $ffdir = shift;

  my $f_ffpath = &localeDirectory($floc);
  $f_ffpath =~ s/\Q$floc$/$ffdir/;
  my $t_ffpath = &localeDirectory($tloc);
  $t_ffpath =~ s/\Q$tloc$/$ffdir/;

  my $v2 = "";
  if (!opendir(CDIR, $dir)) {&Log("ERROR: Could not open \"$dir\".\n"); die;}
  my @files = readdir(CDIR);
  closedir(CDIR);

  foreach my $f (@files) {
    if ($f =~ /^\./) {next;}
    my $p = "$dir/$f";

    # skip if this file is not in alternate locale
    my $np = $p;
    $np =~ s/\Q$f_ffpath\E//;
    $np =~ s/\/\Q$floc\E(\/|$)/\/$tloc\//g;
    $np = "$t_ffpath$np";
    if (!-e $np) {next;}

    if (-d $p) {$v2 = &xtrans($v, $p, $nocase, $floc, $tloc, $ffdir);}
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

sub readCode($\%\%) {
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

      if ($e) {
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

sub readLocaleOverrideFile($$$$\%) {
  my $localeXS = shift;
  my $localeFF = shift;
  my $chrome = shift;
  my $target = shift;
  my $codeFileEntryValuesP = shift;

  &Log("INFO: Reading chrome locale override file \"$chrome\"\n");

  my $versionFF = $target;
  if ($versionFF !~ /\/ff([^\/]+)\//) {die "Bad override target \"$target\"\n";}
  $versionFF = $1;

  # get the Firefox file's path
  my $FirefoxPath = &localeDirectory("Firefox$versionFF/$localeFF");
  if (!-e "$FirefoxPath") {
    &Log("ERROR: Missing directory \"$MKDEV/Firefox$versionFF/$localeFF\". Skipping locale override.\n");
    return;
  }
  if ($chrome !~ /^chrome\:\/\/([^\/]+)\/locale\/(.*?)$/) {
    &Log("ERROR: Malformed chrome URL \"$chrome\". Skipping locale override.\n");
    return;
  }
  my $tkdir = $1;
  my $tkpath = $2;
  my $override = "$FirefoxPath/$tkdir/$tkpath";
  if (!-e $override) {
    &Log("ERROR: Chrome override file not found \"$override\". Skipping locale override.\n");
    return;
  }
  my $defoverride = "$MKDEV/Firefox$versionFF/en-US/$tkdir/$tkpath";
  if (!-e $defoverride) {
    &Log("ERROR: Chrome en-US override file not found \"$defoverride\". Skipping locale override.\n");
    return;
  }

  # compare contents of this override with en-US because missing entries
  # could cause Firefox or xulsword to malfunction in some circumstances
  my %entries, %defentries, %values, %defvalues;
  &readCode($override, \%values, \%entries);
  &readCode($defoverride, \%defvalues, \%defentries);
  my $ok = 1;
  foreach my $e (keys %{$defentries{$defoverride}}) {
    if (!exists(${$entries{$override}}{$e})) {
      &Log("ERROR: entry \"$e\" was not found in \"$override\". Skipping locale override.\n");
      $ok = 0;
    }
  }
  if (!$ok) {return;}

  # now save .dtd and .properties override file contents
  if ($target =~ /\.(dtd|properties)$/) {
    foreach my $e (keys %{$entries{$override}}) {
      if ($e eq "<rEAd>") {next;}
      $codeFileEntryValuesP->{"$target:$e"} = $entries{$override}{$e};
    }
  }
  else {
    # then just copy the whole file to destination
    my $dest = &localeDirectory($localeXS)."/locale/$target";
    my $parent = $dest;
    $parent =~ s/^(.*?)\/[^\/]+$/$1/;
    if (!-e $parent) {make_path($parent);}
    cp($override, $dest);
  }

}

sub localeDirectory($) {
	my $subdir = shift;
	my $path1 = "$MKDEV/$subdir";
	my $path2 = "$MKSDEV/$subdir";
	if (-e $path1) {return $path1;}
	elsif (-e $path2) {return $path2;}
	else {&Log("ERROR: entry locale directory \"".$path1."\" not found.\n");}
	return $path1;
}

# copies a directory recursively
sub copy_dir($$$$) {
  my $id = shift;
  my $od = shift;
  my $incl = shift;
  my $skip = shift;

  if (!-e $id || !-d $id) {
    &Log("ERROR copy_dir: Source does not exist or is not a direcory: $id\n");
    return 0;
  }

  opendir(DIR, $id) || die "Could not open dir $id\n";
  my @fs = readdir(DIR);
  closedir(DIR);

  if (!-e $od) {make_path($od);}

  for(my $i=0; $i < @fs; $i++) {
    if ($fs[$i] =~ /^\.+$/) {next;}
    my $if = "$id/".$fs[$i];
    my $of = "$od/".$fs[$i];
    if ($incl && $if !~ /$incl/i) {next;}
    if ($skip && $if =~ /$skip/i) {next;}
    if (-d $if) {
      &copy_dir($if, $of, $incl, $skip);
    }
    else {
      &copy_file($if, $of);
    }
  }
  return 1;
}

sub copy_file($$) {
  my $if = shift;
  my $of = shift;
  if ("$^O" =~ /MSWin32/i) {cp($if, $of);}
  elsif ("$^O" =~ /(linux|darwin)/i) {
    my $cmd = "cp -p ".&escfile($if)." ".&escfile($of);
    `$cmd`;
  }
}

sub makeZIP($$$$) {
  my $zf = shift;
  my $di = shift;
  my $updateExisting = shift;
  my $logfile = shift;

  my $cmd = "";
  my $cwd = "";
  my $zd = $zf;
  $zd =~ s/[\/\\][^\/\\]+$//;
  if (!-e $zd) {make_path($zd);}
  if ("$^O" =~ /MSWin32/i) {
    $zf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    my $a = ($updateExisting ? "u":"a");
    $cmd = "7za $a -tzip ".&escfile($zf)." -r ".&escfile($di)." -x!.svn";
    if ($logfile) {
      my $lf = $zf;
      $lf =~ s/[^\/\\]+$/$logfile/;
      $cmd .= " > $lf";
    }
    #&Log("$cmd\n");
    `$cmd`;
  }
  elsif ("$^O" =~ /(linux|darwin)/i) {
    $cwd = `echo $PWD`; $cwd =~ s/\s*$//;
    my $dip = $di;
    $dip =~ s/\/([^\/]*)$//;
    $d = $1;
    if (!$d || $d =~ /^\s*\*\s*$/) {$d = "*";}
    chdir($dip);
    my $a = ($updateExisting ? "-u ":"");
    $cmd = "zip -r ".$a.&escfile($zf)." ".$d." -x '*/.svn/*'";
  }
  else {
    &Log("ERROR: Please update common.pl->makeZIP() to include your platform.\n");
  }

  if ($cmd && $logfile) {
    my $lf = $zf;
    $lf =~ s/[^\/\\]+$/$logfile/;
    $cmd .= " > $lf";
  }
  #&Log("$cmd\n");
  if ($cmd) {`$cmd`;}
  if ($cwd) {chdir($cwd);}
}


sub escfile($) {
  my $n = shift;

  if ("$^O" =~ /MSWin32/i) {$n = "\"".$n."\"";}
  elsif ("$^O" =~ /(linux|darwin)/i) {$n =~ s/([ \(\)])/\\$1/g;}
  else {&Log("Please add file escape function for your platform.\n");}
  return $n;
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  #if ($p =~ /error/i) {$p = "\n$p\n";}
  if ((!$NOCONSOLELOG && $h!=-1) || !$LOGFILE || $h>=1 || $p =~ /ERROR/) {print encode("utf8", "$p");}
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
