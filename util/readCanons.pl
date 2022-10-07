#!/usr/bin/perl

use strict;

my @V11NS = (
  'KJV',
  'German',
  'KJVA',
  'Synodal',
  'Leningrad',
  'NRSVA',
  'Luther',
  'Vulg',
  'SynodalProt',
  'Orthodox',
  'LXX',
  'NRSV',
  'MT',
  'Catholic',
  'Catholic2',
  'DarbyFr',
  'Segond',
  'Calvin',
);

my $NT_IS_KJV = join('|', (
  'Calvin',
  'Catholic',
  'Catholic2',
  'DarbyFr',
  'German',
  'KJVA',
  'LXX',
  'Leningrad',
  'MT',
  'NRSV',
  'NRSVA',
  'Orthodox',
  'Segond',
  'SynodalProt'
));

my $OT_IS_KJV = join('|', (
  'Calvin',
  'NRSV',
  'Segond',
  'DarbyFr'
));

my $INDIR = "../Cpp/sword/include";
opendir(IND, $INDIR) || die;
my @files = readdir(IND);
closedir(IND);

my $data;
my $tests;
foreach my $f (sort @files) {
  if ($f eq 'canon_abbrevs.h') {next;} # not a v11n
  if ($f eq 'canon_null.h') {next;} # not a v11n
  if ($f =~ /^canon(_([^\.]+))?\.h/) {
    my $v11n = $1 ? $2 : 'kjv';
    # print "$f\n";
    foreach my $v (@V11NS) {
      if ($v && $v =~ /^$v11n$/i) {
        $v11n = $v;
        $v = '';
      }
    }
    my $ot = $v11n =~ /^($OT_IS_KJV)$/ ? 1 : 0;
    my $nt = $v11n =~ /^($NT_IS_KJV)$/ ? 1 : 0;
    my @m = map(
      '[\''.@{$_}[0].'\','.@{$_}[1].']',
      @{&readCanonFile("$INDIR/$f")}
    );

    $data .= "$v11n:[".join(',', @m)."],\n";
    $tests .= "$v11n: { ot: $ot, nt: $nt },\n";
  }
}

print $data;
print $tests;

foreach my $t (@V11NS) {
  if ($t) {print "ERROR: Did not read $t\n";}
}

###############################################################################

sub readCanonFile($) {
  my $file = shift;

  my $sbook;
  my $vm;
  my @books;

  open(INF, "<$file") || die "Cannot open $file.\n";
  while(<INF>) {
    if ($_ =~ /^\s*(\/\/.*)?$/) {next;}
    if ($_ =~ /struct sbook/) {$sbook = "true"; next;}
    if ($_ =~ /int vm/) {$vm = "true"; next;}
    if ($_ =~ /^\s*\};/) {$sbook = ""; $vm=""; next;}

    if ($sbook eq "true") {
      if ($_ =~ /\{\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*(\d+)\s*\}/) {
        my $bk = $2;
        my $mc = $4;
        my @a;
        push(@a, $bk);
        push(@a, $mc);
        push(@books, \@a);
      }
    }
  }
  close(INF);

  return \@books;
}
