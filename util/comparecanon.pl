#!/usr/bin/perl
# Usage: comparecanon.pl canon1.h canon2.h

# Compares two canon.h header files and reports all differences in names/numbers of books, chapters, and verses

$canon1 = "sword-svn/include/canon.h"; #shift;
$canon2 = "sword-svn/include/canon_synodalprot.h"; #shift;

readCanonFile($canon1, \%data1);
readCanonFile($canon2, \%data2);

print "\n\n";
foreach $key (sort keys %data1) {
  if ($key !~ /maxchap-/) {next;}
  if ($data1{$key} ne $data2{$key}) {
    $key =~ /maxchap-(.*)/;
    if (!exists($data2{$key})) {print "Canon #2 is missing $key\n";}
    else {print $1." maxchapter differs: ".$data1{$key}.", ".$data2{$key}."\n";}
  }
  $data1{$key} = "checked";
}
foreach $key (sort keys %data2) {
  if ($key !~ /maxchap-/) {next;}
  if ($data1{$key} eq "checked") {next;}
  if ($data1{$key} ne $data2{$key}) {
    $key =~ /maxchap-(.*)/;
    if (!exists($data1{$key})) {print "Canon #1 is missing $key\n";}
    else {print $1." maxchapter differs: ".$data1{$key}.", ".$data2{$key}."\n";}
  }
  $data2{$key} = "checked";
}

print "\n\nComparing values of #1 against #2\n";
foreach $key (sort {&locSortV($a,$b);} keys %data1) {
  if ($key !~ /maxverse-/ || !exists($data2{$key})) {next;}
  if ($data1{$key} ne $data2{$key}) {
    $key =~ /maxverse-([^-]+)-(\d+)/;
    print $1." ".$2.": last-verse = ".$data1{$key}.", ".$data2{$key}."\n";
  }
  $data1{$key} = "checked";
}
print "\n\nComparing unchecked values of #2 against #1\n";
foreach $key (sort {&locSortV($a,$b);} keys %data2) {
  if ($key !~ /maxverse-/ || !exists($data1{$key})) {next;}
  if ($data1{$key} eq "checked") {next;}
  if ($data1{$key} ne $data2{$key}) {
    $key =~ /maxverse-([^-]+)-(\d+)/;
    print $1." ".$2.": last-verse = ".$data1{$key}.", ".$data2{$key}."\n";
  }
  $data2{$key} = "checked";
}

sub locSortV($$) {
  my $a = shift;
  my $b = shift;
  if ($a !~ /maxverse-([^-]+)-(\d+)/) {return $a cmp $b;}
  my $ab = $1;
  my $ac = $2*1;
  if ($b !~ /maxverse-([^-]+)-(\d+)/) {return $a cmp $b;}
  my $bb = $1;
  my $bc = $2*1;
  if ($ab eq $bb) {return $ac <=> $bc;}
  return $a cmp $b;
}

sub readCanonFile($) {
  my $file = shift;
  my $dataPTR = shift;
  
  my $sbook;
  my $vm;
  my @books;
  
  open(INF, "<$file") || die "Cannot open $file.\n";
  my $line = 0;
  my $ch = 1;
  my $bknum = 0;
  while(<INF>) {
    $line++;
    if ($_ =~ /^\s*(\/\/.*)?$/) {next;}
    if ($_ =~ /struct sbook/) {$sbook = "true"; next;}
    if ($_ =~ /int vm/) {$vm = "true"; next;}
    if ($_ =~ /^\s*\};/) {$sbook = ""; $vm=""; next;}
    
    if ($sbook eq "true") {
      if ($_ =~ /^\s*\{\s*"([\w\d\s]+)",\s*"([\w\d]+)",\s*"([\w\d]+)",\s*(\d+)\s*\}\s*,/) {
        my $bk = $2;
        my $mc = $4;
        push(@books, $bk);
        $dataPTR->{"maxchap-".$bk} = $mc;
      }
      else {print "Skipping sbook line $line: $_\n";}
    }
    if ($vm eq "true") {
      if ($_ =~ /^\s*([\d\s,]+?)\s*,?\s*$/) {
        my @verses = split(/\s*,\s*/, $1);
        my $d = 0;
        while ($verses[$d] > 0) {
          if ($ch > $dataPTR->{"maxchap-".$books[$bknum]}) {$ch = 1; $bknum++;}
          $dataPTR->{"maxverse-".$books[$bknum]."-".$ch} = $verses[$d];
          $ch++;
          $d++;
        }
      }
      else {print "Skipping vm line $line: $_\n";}
    }
  }
  close(INF);
}
