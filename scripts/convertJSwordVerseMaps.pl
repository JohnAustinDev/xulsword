#!/usr/bin/perl

use strict;
use Sword;
use Data::Dumper;

my $ConvertExistingCppMaps = shift;

# JSword maps that are missing in SWORD are converted and added to SWORD, with
# the corrections below (which this script discovered).

# The following SWORD maps do not fit their v11ns, but the JSword maps do, so
# corrected JSword maps will be used to replace the SWORD maps.
my $OverwriteExistingCppMapAP = ['NRSV', 'Segond'];

# The Synodal SWORD/JSword map differences are:
# - SWORD is missing 1Sam.20.43=1Sam.20.42
# - SWORD is missing 2Cor.11.32=2Cor.11.33
# - SWORD has Acts.19.40=Acts.19.40-Acts.19.41
# - SWORD has 3John.1.14-3John.1.15=3John.1.14
# - SWORD includes the extra books and Daniel mappings
# - SWORD and JSword Psalms maps seem to be the same other than verse 0 handling.
# For these reasons, the JSword map is NOT being used to replace Synodal, and
# instead the missing rules are simply added to the SWORD map.

# Since SWORD Synodal map (with additions) is being used, the SynodalProt map
# will come from SWORD Synodal, with the following changes:
# - extra books are removed
# - Daniel mappings are removed
# - Added Dan.3.31-Dan.3.33=Dan.4.1-Dan.4.3
# - book numbers are then updated
my %JustUpdateSwordRules = (
  'Synodal' => {
    'from' => 'Synodal',
    'addRules' => [
      "9,   20,  43,  0,   20,  42,  0,",
      "66,  11,  32,  0,   11,  33,  0,"
    ]
  },
  'SynodalProt' => {
    'from' => 'Synodal',
    'removeExtraBooks' => 1,
    'removeBooks' => [15, 18, 29, 20, 27, 28, 32, 33, 35, 48, 49, 50, 51],
    'addRules' => [
      "9,   20,  43,  0,   20,  42,  0,",
      "35,   3,  31,  33,   4,   1,  3,",
      "66,  11,  32,  0,   11,  33,  0,"
    ],
  },
  'LXX' => {
    'from' => '??',
    'addRules' => [
      "10,   19,   1,   0,   18,   33,   0",
      "10,   19,   2,   0,   19,    1,   0",
    ]
  }
);

my $SWORDSRC = "../Cpp/sword-versification-maps";
my $SWORDIN = "$SWORDSRC/sword-commit-3900";
my $SWORDOUT = "$SWORDSRC/sword";
my $INCLUDEJS = "../../jsword/src/main/resources/org/crosswire/jsword/versification";
my $MGRSRC = "src/mgr/versificationmgr.cpp";

my $JSwordSynodalAndSynodalProtFixes = [
  ["Ps.12.6=Ps.13.5-Ps.12.6", "Ps.12.6=Ps.13.5-Ps.13.6"],
  [
    "Ps.89.1-Ps.89.17=Ps.90.0-Ps.90.17",
    "Ps.89.1-Ps.89.5=Ps.90.0-Ps.90.4\nPs.89.6=Ps.90.5-Ps.90.6"
  ],
  ["Hos.14.10=Hos.14.9", ""] # unnecessary since included in previous Hos entry
];

my %JSwordMapCorrections = (
  'Segond' => [
    # JSword Segond 2Chr 13 and 14 mappings are missing from the existing Cpp
    # map, but JSword also needs fixes and removals that do not fit the Cpp
    # v11n and are additions to the Cpp map.
    # Fixes:
    ["Ps.22.1=Ps.21.1!pv", "Ps.22.1=Ps.22.1!pv"],
    ["Ps.22.2=Ps.21.1!v", "Ps.22.2=Ps.22.1!v"],
    ["Ps.68.2=Ps.68.2!v", "Ps.68.2=Ps.68.1!v"],
    ["Ps.69.2=Ps.69.2!v", "Ps.69.2=Ps.69.1!v"],
    # Removals:
    ["Mark.10.52=Mark.10.52!a", ""],
    ["Mark.10.53=Mark.10.52!b". ""]
  ],
  'Synodal' => [@{$JSwordSynodalAndSynodalProtFixes}],
  'SynodalProt' => [
    @{$JSwordSynodalAndSynodalProtFixes},
    # Additions:
    [
      "Num.13.1-Num.13.34=Num.12.16-Num.13.33", # <- this is just to insert Lev additions
      "Lev.14.55=Lev.14.55-Lev.14.56\nNum.13.1-Num.13.34=Num.12.16-Num.13.33"
    ],
    # Removals:
    ["1Kgs.18.33=1Kgs.18.33!a", ""],
    ["1Kgs.18.34=1Kgs.18.33!b-1Kgs.18.34", ""]
  ],
  'Catholic' => [
    # Fixes:
    ["Hos.12.2-Hos.12.15=Hos.1.1-Hos.1.14", "Hos.12.2-Hos.12.15=Hos.12.1-Hos.12.14"]
  ],
  'Catholic2' => [
    # Fixes:
    ["Hos.12.2-Hos.12.15=Hos.1.1-Hos.1.14", "Hos.12.2-Hos.12.15=Hos.12.1-Hos.12.14"]
  ]
);

###############################################################################

open(VMGI, "<:encoding(UTF-8)", "$SWORDIN/$MGRSRC") || die "$SWORDIN/$MGRSRC";
if (-e "$SWORDOUT") {`rm -rf "$SWORDOUT/"*`}
`mkdir -p "$SWORDOUT/src/mgr"`;
`mkdir -p "$SWORDOUT/include"`;
open(VMGO, ">:encoding(UTF-8)", "$SWORDOUT/$MGRSRC") || die "$SWORDOUT/$MGRSRC";

my ($CANON, $CNEW, $JMAP);
while (<VMGI>) {
  my $line = $_;
  if ($line =~ /^\s*systemVersificationMgr\->registerVersificationSystem\("(.*?)", (\w+), (\w+), \w+(, \w+)?\);/) {
    $CANON = $1;
    my $hasCppMap = $4;

    $CNEW = "$SWORDIN/include/canon_" . lc($CANON) . ".h";
    $JMAP = "$INCLUDEJS/$CANON.properties";

    my $skipJSword = !grep($_ eq $CANON, @{$OverwriteExistingCppMapAP}) &&
      (substr($CANON, 0, 3) eq 'KJV' || ($hasCppMap && !$ConvertExistingCppMaps));

    if (!$skipJSword || exists($JustUpdateSwordRules{$CANON})) {
      print "\nINFO: CREATING $CANON MAP: canon_" . lc($CANON) . ".h\n";
    }

    if (exists($JustUpdateSwordRules{$CANON})) {
      if (!$hasCppMap) {&addCanonMapToMgr(\$line);}
      &updateSwordRules($JustUpdateSwordRules{$CANON});
    }
    elsif ($skipJSword) {}
    elsif (-e "$JMAP") {
      if (!$hasCppMap) {&addCanonMapToMgr(\$line);}
      if ($hasCppMap) {
        print "WARNING: Overwriting original SWORD C++ map for $CANON.\n";
      }

      my $canonBooksHP = &readCanonHeaderBooks($CANON);
      # print Dumper($canonBooksHP);

      my $mapAP = &convertJSwordMap($JMAP, $canonBooksHP);
      $mapAP = &pruneVerseMap($mapAP);
      # print Dumper($mapAP);

      my $file = $CNEW; $file =~ s/^.*\/([^\/]+)$/$1/;
      my $outfile = "$SWORDOUT/include/$file";
      open(INF, "<:encoding(UTF-8)", $CNEW) || die $CNEW;
      open(OUTF, ">:encoding(UTF-8)", $outfile) || die $outfile;
      print "INFO: Writing to $outfile\n";
      my $inf = join('', <INF>);
      $inf =~ s/unsigned char mappings_.*?\};//sg;
      foreach (split(/\n/, $inf)) {
        if (/SWORD_NAMESPACE_END/) {
          print OUTF "unsigned char mappings_" . lc($CANON) . "[] = {\n    0,\n";
          foreach my $aP (@{$mapAP}) {
            print OUTF "    ";
            for (my $i = 0; $i < @{$aP}; $i++) {
              my $v = @{$aP}[$i];
              my $str = "$v,";
              if ($i < @{$aP} - 1) {while (length($str) < 5) {$str .= ' ';}}
              print OUTF $str;
            }
            print OUTF "\n";
          }
          print OUTF "    0\n};\n";
        }
        print OUTF "$_\n";
      }
      close(OUTF);
    } else {print "WARNING: SKIPPED BECAUSE OF MISSING JSWORD MAP:$CANON\n";}
  }

  print VMGO $line;
}
close(VMGI);
close(VMGO);

###############################################################################
###############################################################################

sub addCanonMapToMgr {
  my $lineP = shift;
  if ($$lineP !~ s/\);/my $r = ", mappings_" . lc($CANON) . ");";/e) {
    print "ERROR: Failed to update versificationmgr to use $CANON map.\n";
  }
}

# Read C++ canon headers to determine indexes of the books in the canon.
my $MGR;
sub readCanonHeaderBooks {
  my $canon = shift;

  if (!$MGR) {
    open(XMGR, "<:encoding(UTF-8)", "$SWORDIN/$MGRSRC") || die "$SWORDIN/$MGRSRC";
    $MGR = join('', <XMGR>);
    close(XMGR);
  }

  if ($MGR !~ /^\s*systemVersificationMgr\->registerVersificationSystem\("$canon", (\w+), (\w+), \w+(, \w+)?\);/m) {
    print "ERROR: Failed to find $canon in $SWORDIN/$MGRSRC\n";
  }
  my $fileOT = "$SWORDIN/include/canon" . ($1 eq 'otbooks' ? '' : '_' . lc(substr($1, 8))) . ".h";
  my $fileNT = "$SWORDIN/include/canon" . ($2 eq 'ntbooks' ? '' : '_' . lc(substr($2, 8))) . ".h";

  my %result;
  my $bkn = 0;
  foreach my $ident ('otbooks', 'ntbooks') {
    my $file = $ident eq 'otbooks' ? $fileOT : $fileNT;
    open(HFL, "<:encoding(UTF-8)", $file) || die $file;
    my @hfl = (<HFL>);
    close(HFL);

    my $re = "struct sbook $ident";

    my $start = 0;
    foreach (@hfl) {
      if (/$re/) {$start = 1; next;}
      #   {"Genesis", "Gen", "Gen", 50},
      if ($start && /^\s*\{\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*(\d+)\s*\},?\s*$/) {
        my $osis = $3; my $numchaps = $4;
        if (!$numchaps) {$start = 0; next;}
        $bkn++;
        $result{$osis} = $bkn;
      }
    }

    if (!$bkn && $file !~ /canon_null\.h$/) {
      print "ERROR: Failed to find books in header: $file\n";
    }
  }

  return \%result;
}

# Parse a JSword canon map file and convert it into its C++ map implentation.
sub convertJSwordMap {
  my $file = shift;
  my $canonBooksHP = shift;


  open(JSF, "<:encoding(UTF-8)", $file) || die $file;
  my $filec = join('', <JSF>);
  close(JSF);

  print "INFO: Reading JSword mapping file: $file\n";

  # Apply any fixes/changes/additions to the JSword map.
  if (exists($JSwordMapCorrections{$CANON})) {
    foreach my $changeAP (@{$JSwordMapCorrections{$CANON}}) {
      my $a = quotemeta($changeAP->[0]);
      my $b = $changeAP->[1];
      if ($filec =~ s/^$a\s*$/$b/gm) {
        print "INFO: Applied $CANON " . $changeAP->[0] . " => " . $changeAP->[1] . "\n";
      } else {
        print "ERROR: Failed to apply $CANON" . $changeAP->[0] . " => " . $changeAP->[1] . "\n";
      }
    }
  }

  my @result;
  foreach (split("\n", $filec)) {
    if (/^(!zerosUnmapped|#.*?|\s?)\s*$/) {next;}
    elsif (/^(\s*[^=]+\s*)=(\s*[^=]+\s*)$/) {
      my $sys = $1; my $kjv = $2;
      print "INFO: $_\n";
      my $kjvHP = &parseVerses($kjv, 'KJVA');
      if (!$kjvHP) {
        print "WARNING: SKIPPED map entry (failed to parse KJVA verse: $kjv)\n";
        next;
      }
      my $sysHP = &parseVerses($sys, $CANON);
      if (!$sysHP) {
        print "WARNING: SKIPPED map entry (failed to parse $CANON verse: $sys)\n";
        next;
      }
      if ($kjvHP->{'bk'} ne $sysHP->{'bk'}) {
        print "WARNING: SKIPPED map entry (mapped books are different: $_)\n";
        next;
      }
      for (;;) {
        my $ckjv = &verseCount($kjvHP);
        my $csys = &verseCount($sysHP);
        my @rule = (
          $canonBooksHP->{$kjvHP->{'bk'}},
          $sysHP->{'chs'},
          $sysHP->{'vss'},
          $csys != 1 && $csys != $ckjv ? $sysHP->{'vss'} + $csys - 1 : 0,
          $kjvHP->{'chs'},
          $kjvHP->{'vss'},
          $ckjv != 1 && $csys != $ckjv ? $kjvHP->{'vss'} + $ckjv - 1 : 0
        );
        push(@result, \@rule);
        if ($sysHP->{'chs'} == $sysHP->{'che'} && $sysHP->{'vss'} == $sysHP->{'vse'}) {
          last;
        }
        # So then we're mapping a verse range:
        # A rule may only pertain to the single chapter, so when either
        # vkjv or vsys cross chapter boundaries, add another rule.
        my $chkjv = $kjvHP->{'chs'};
        my $chsys = $sysHP->{'chs'};
        my $quit = 0;
        while ($kjvHP->{'chs'} == $chkjv &&  $sysHP->{'chs'} == $chsys) {
          # Quit entirely if we reach the last verse of the book, or if the
          # entire range has been handled.
          if (
            !&incrementStartVerse($kjvHP) || !&incrementStartVerse($sysHP) ||
            (
              $sysHP->{'chs'} == $sysHP->{'che'} &&
              $sysHP->{'vss'} == $sysHP->{'vse'}
            )
          ) {
            $quit = 1;
            last;
          }
        }
        if ($quit) {last;}
      }
    } else {
      print "ERROR: Failed to parse JSword mapping: $_\n";
    }
  }

  return \@result;
}

# Increment range start using getVerseMax rather than VerseKey increment,
# since increment does not support verse 0 even though the map does.
# Return 1 on success or 0 if there is no next verse.
sub incrementStartVerse {
  my $rangeHP = shift;

  my $vk = new Sword::VerseKey();
  $vk->setVersificationSystem($rangeHP->{'v11n'});
  $vk->setText($rangeHP->{'bk'} . '.' . $rangeHP->{'chs'} . '.1');
  if ($rangeHP->{'vss'} == $vk->getVerseMax()) {
    if ($rangeHP->{'chs'} == $vk->getChapterMax()) {return 0;}
    $rangeHP->{'vss'} = 1;
    $rangeHP->{'chs'}++;
  } else {$rangeHP->{'vss'}++;}

  return 1;
}

# Parse an individual JSword map entry verse range.
sub parseVerses {
  my $vstr = shift;
  my $v11n = shift;

  my %result;
  if ($vstr =~ /^([^.]+)\.(\d+)\.(\d+)(!(a|b|v|pv|intro|verse))?(-\1\.(\d+)\.(\d+)(!(a|b|v|pv|intro|verse))?)?$/) {
    $result{'bk'} = $1;
    $result{'chs'} = $2;
    $result{'vss'} = $3;
    $result{'parts'} = $5;
    $result{'che'} = $6 ? $7 : $2;
    $result{'vse'} = $6 ? $8 : $3;
    $result{'parte'} = $10;
    $result{'v11n'} = $v11n;
  } else {return 0;}

  return \%result;
}

# Count the number of verses in a range, including a verse 0 IF the range
# start's first verse is 0.
sub verseCount {
  my $ppHP = shift;

  my $pHP = {
    'bk' => $ppHP->{'bk'},
    'chs' => $ppHP->{'chs'},
    'vss' => $ppHP->{'vss'},
    'che' => $ppHP->{'che'},
    'vse' => $ppHP->{'vse'},
    'v11n' => $ppHP->{'v11n'}
  };

  # Check that verse start and end are in the verse system (allowing verse 0
  # which is not in the verse system but is allowed in the map).
  my $osisRef = $pHP->{'bk'} . '.' . $pHP->{'chs'} . '.' . $pHP->{'vss'};
  if ($pHP->{'vss'} != 0 && !&isOsisRefInV11n($osisRef, $pHP->{'v11n'})) {
    print "ERROR: Start verse is not in " . $pHP->{'v11n'} . ": $osisRef\n";
  }
  $osisRef = $pHP->{'bk'} . '.' . $pHP->{'che'} . '.' . $pHP->{'vse'};
  if ($pHP->{'vse'} != 0 && !&isOsisRefInV11n($osisRef, $pHP->{'v11n'})) {
    print "ERROR: Start end is not in " . $pHP->{'v11n'} . ": $osisRef\n";
  }

  my $count = 1;
  for (;; $count++) {
    if ($pHP->{'chs'} == $pHP->{'che'} && $pHP->{'vss'} == $pHP->{'vse'}) {
      last;
    }
    if (!&incrementStartVerse($pHP)) {
      print "ERROR: No increment progress during verse count at: " .
        $pHP->{'bk'} . '.' . $pHP->{'chs'} . '.' . $pHP->{'vss'};
      print ", starting with: \n" . Dumper($ppHP);
      last;
    }
    #print $pHP->{'v11n'} . ": $before -> " . $vkey->getOSISRef() . "\n";
  }

  return $count;
}

# Return 1 if the OsisRef exists in the Versification system.
sub isOsisRefInV11n {
  my $osisRef = shift;
  my $v11n = shift;

  my $vk = new Sword::VerseKey();
  $vk->setVersificationSystem($v11n);
  $vk->setText($osisRef);

  return $vk->getOSISRef() eq $osisRef;
}

# Remove redundant C++ map rules.
sub pruneVerseMap {
  my $mapAP = shift;

  # When book, chapter and delta are the same for consecutive rules, only the
  # first rule is necessary.
  my ($bk, $ch, $vd);
  foreach my $ruleAP (@{$mapAP}) {
    my $tbk = $ruleAP->[0];
    my $tch = $ruleAP->[1] . '->' . $ruleAP->[4];
    my $tvd = ($ruleAP->[5] > $ruleAP->[6] ? $ruleAP->[5] : $ruleAP->[6]) -
      ($ruleAP->[2] > $ruleAP->[3] ? $ruleAP->[2] : $ruleAP->[3]);
    if ($bk && $bk eq $tbk && $ch eq $tch && $vd == $tvd) {
      print "INFO: Pruning rule (consecutive):" . join(', ', @{$ruleAP}) . "\n";
      $ruleAP = 0;
    }
    $bk = $tbk;
    $ch = $tch;
    $vd = $tvd;
  }

  # Rules that map same-to-same are not necessary
  foreach my $ruleAP (@{$mapAP}) {
    if ($ruleAP &&
        $ruleAP->[1] == $ruleAP->[4] &&
        $ruleAP->[2] == $ruleAP->[5] &&
        $ruleAP->[3] == $ruleAP->[6]
    ) {
      print "INFO: Pruning rule (same-to-same):" . join(', ', @{$ruleAP}) . "\n";
      $ruleAP = 0;
    }
  }

  my @pruned = grep { $_ != 0 } @{$mapAP};

  return \@pruned;
}

# Update the mapping rules from a SWORD Cpp header.
sub updateSwordRules {
  my $upHP = shift;

  my $filename = $CNEW; $filename =~ s/^.*\/([^\/]+)$/$1/;
  my $outfile = "$SWORDOUT/include/$filename";

  my $sourceBooksHP = &readCanonHeaderBooks($upHP->{'from'});
  my $source = "$SWORDIN/include/canon_" . lc($upHP->{'from'}) . ".h";
  open(INF, "<:encoding(UTF-8)", "$source") || die $source;
  my $src = join('', <INF>);
  close(INF);
  $src =~ s/^.*(unsigned char mappings[^}]+\};).*$/$1/s;
  if ($src !~ s/(?<=unsigned char mappings_)\w+/lc($CANON)/e) {
    print "ERROR: Failed to replace mappings name: $CANON\n";
  }

  if ($upHP->{'removeExtraBooks'}) {
    $src =~ s/(?<=\{\s{0,5}\n).*?\n(\s*0,)/$1/s;
    $src =~ s/\n( *(\d+),){8} *//g;
  }

  if (exists($upHP->{"removeBooks"})) {
    print "INFO: Removing SWORD books in $outfile\n";
    foreach my $bkn (@{$upHP->{"removeBooks"}}) {
      $src =~ s/^\s*$bkn,[^\n]+\n//gm;
    }
  }

  if (exists($upHP->{"addRules"})) {
    print "INFO: Adding SWORD rules to $outfile\n";
    my $ruleRE = '^\s*(\d+),\s+(\d+),\s+(\d+),\s+(\d+),\s+(\d+),\s+(\d+),\s+(\d+),\s*$';
    my @rules = split(/\n/, $src);
    foreach my $srcRule (@rules) {
      if ($srcRule =~ /$ruleRE/) {
        my $bk = $1; my $ch = $2; my $vs = $3;
        foreach my $rule (@{$upHP->{"addRules"}}) {
          if ($rule =~ /$ruleRE/) {
            my $mbk = $1; my $mch = $2; my $mvs = $3;
            if (
              $bk > $mbk ||
              ($bk == $mbk && $ch > $mch) ||
              ($bk == $mbk && $ch == $mch && $vs > $mvs)
            ) {
              $srcRule = '    ' . $rule . "\n" . $srcRule;
              $rule = '';
            }
          }
        }
      }
    }
    foreach my $rule (@{$upHP->{"addRules"}}) {
      if ($rule ne '') {
        print "ERROR: Failed to add rule to $CANON SWORD map: $rule\n";
      }
    }
    $src = join("\n", @rules);
  }

  print "INFO: Updating rule book indexes in $outfile\n";
  my $canonBooksHP = &readCanonHeaderBooks($CANON);
  my @rules = split(/\n/, $src);
  foreach my $rule (@rules) {
    $rule =~ s/^(\s*)(\d+)(?=,(\s+\d+,){6}\s*$)/my $r = $1 . $canonBooksHP->{&bookAtIndex($2, $sourceBooksHP)};/mge;
  }
  $src = join("\n", @rules);

  open(INF, "<:encoding(UTF-8)", $CNEW) || die $CNEW;
  open(OUTF, ">:encoding(UTF-8)", $outfile) || die $outfile;
  my $outf = join('', <INF>);
  if ($outf !~ s/unsigned char mappings[^}]+\};/$src/s) {
    if ($outf !~ s/(?=\nSWORD_NAMESPACE_END)/$src/) {
      print "ERROR: failed to replace char mappings in $outfile\n";
    }
  }
  print OUTF $outf;
  close(INF);
  close(OUTF);
}

sub bookAtIndex {
  my $index = shift;
  my $canonBooksHP = shift;

  foreach my $osis (keys %{$canonBooksHP}) {
    if ($canonBooksHP->{$osis} == $index) {
      return $osis;
    }
  }

  return '';
}
