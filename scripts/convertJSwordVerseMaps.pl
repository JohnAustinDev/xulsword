#!/usr/bin/perl

use strict;
use Sword;
use Data::Dumper;

my $SWORDSRC = "../Cpp/sword-versification-maps";
my $SWORDIN = "$SWORDSRC/sword-commit-3900";
my $SWORDOUT = "$SWORDSRC/sword";
my $INCLUDEJS = "../../jsword/src/main/resources/org/crosswire/jsword/versification";

my %JSwordMapChanges = (
  'SynodalProt' => [
      # Fixes:
      ["Ps.12.6=Ps.13.5-Ps.12.6", "Ps.12.6=Ps.13.5-Ps.13.6"],
      [
        "Ps.89.1-Ps.89.17=Ps.90.0-Ps.90.17",
        "Ps.89.1-Ps.89.5=Ps.90.0-Ps.90.4\nPs.89.6=Ps.90.5-Ps.90.6"
      ],
      # Additions:
      [
        "Num.13.1-Num.13.34=Num.12.16-Num.13.33",
        "Lev.14.55=Lev.14.55-Lev.14.56\nNum.13.1-Num.13.34=Num.12.16-Num.13.33"
      ],
      # Removals:
      ["1Sam.20.43=1Sam.20.42", ""],
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

my $mgrsrc = "src/mgr/versificationmgr.cpp";
open(VMGI, "<:encoding(UTF-8)", "$SWORDIN/$mgrsrc") || die "$SWORDIN/$mgrsrc";
if (-e "$SWORDOUT/$mgrsrc") {unlink "$SWORDOUT/$mgrsrc";}
open(VMGO, ">:encoding(UTF-8)", "$SWORDOUT/$mgrsrc") || die "$SWORDOUT/$mgrsrc";

my ($CANON, $CNEW, $COT, $CNT, $JMAP);
while (<VMGI>) {
  my $line = $_;
  if ($line =~ /^\s*systemVersificationMgr\->registerVersificationSystem\("(.*?)", (\w+), (\w+), \w+\);/) {
    $CANON = $1;
    $COT = "$SWORDIN/include/canon" . ($2 eq 'otbooks' ? '' : '_' . lc(substr($2, 8))) . ".h";
    $CNT = "$SWORDIN/include/canon" . ($3 eq 'ntbooks' ? '' : '_' . lc(substr($3, 8))) . ".h";

    $CNEW = "$SWORDIN/include/canon_" . lc($CANON) . ".h";
    $JMAP = "$INCLUDEJS/$CANON.properties";

    if (substr($CANON, 0, 3) eq 'KJV') {print VMGO $line; next}
    if (-e "$JMAP") {
      print "\nINFO: CREATING $CANON MAP: canon_" . lc($CANON) . ".h\n";

      if ($line !~ s/\);/my $r = ", mappings_" . lc($CANON) . ");";/e) {
        print "ERROR: Failed to update versificationmgr to use $CANON map.\n";
      }

      my $otBooksHP = &readCanonHeaderBooks($COT, 'otbooks_');
      my $ntBooksHP = &readCanonHeaderBooks($CNT, 'ntbooks_');
      # print Dumper($otBooksHP);
      # print Dumper($ntBooksHP);

      my $mapAP = &convertJSwordMap($JMAP, $otBooksHP, $ntBooksHP);
      $mapAP = &pruntVerseMap($mapAP);
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

# Read C++ canon header to determine indexes of the books in the canon.
sub readCanonHeaderBooks {
  my $file = shift;
  my $ident = shift;

  open(HFL, "<:encoding(UTF-8)", $file) || die $file;

  my $re = "struct sbook $ident";
  print "INFO: Looking for '$re' in $file\n";

  my $start = 0;
  my %result;
  my $bkn = 1;
  while (<HFL>) {
    if (/$re/) {$start = 1; next;}
    #   {"Genesis", "Gen", "Gen", 50},
    if ($start && /^\s*\{\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*(\d+)\s*\},?\s*$/) {
      my $osis = $3; my $numchaps = $4;
      if (!$numchaps) {$start = 0; next;}
      $result{$osis} = $bkn++;
    }
  }
  close(HFL);

  $result{'count'} = $bkn - 1;

  return \%result;
}

# Parse a JSword canon map file and convert it into its C++ map implentation.
sub convertJSwordMap {
  my $file = shift;
  my $otBooksHP = shift;
  my $ntBooksHP = shift;

  open(JSF, "<:encoding(UTF-8)", $file) || die $file;
  my $filec = join('', <JSF>);
  close(JSF);

  print "INFO: Reading JSword mapping file: $file\n";

  # Apply any fixes/changes/additions to the JSword map.
  if (exists($JSwordMapChanges{$CANON})) {
    foreach my $changeAP (@{$JSwordMapChanges{$CANON}}) {
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
      my $bkn = exists($otBooksHP->{$kjvHP->{'bk'}})
        ? $otBooksHP->{$kjvHP->{'bk'}}
        : $otBooksHP->{'count'} + $ntBooksHP->{$kjvHP->{'bk'}};
      for (;;) {
        my $ckjv = &verseCount($kjvHP);
        my $csys = &verseCount($sysHP);
        my @rule = (
          $bkn,
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

# Parse an individual JSword map verse range.
sub parseVerses {
  my $vstr = shift;
  my $v11n = shift;

  my %result;
  if ($vstr =~ /^([^.]+)\.(\d+)\.(\d+)(!(a|b|intro|verse))?(-\1\.(\d+)\.(\d+)(!(a|b|intro|verse))?)?$/) {
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
      print "ERROR: No increment progress: " .
        $pHP->{'bk'} . '.' . $pHP->{'chs'} . '.' . $pHP->{'vss'} . "\n";
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

# Remove redundant and unnecessary C++ map rules.
sub pruntVerseMap {
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
