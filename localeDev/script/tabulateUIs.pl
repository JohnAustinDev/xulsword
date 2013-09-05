#!/usr/bin/perl
use File::Spec;
$NOCONSOLELOG = 1;

# usage: tabulateUIs.pl MK MKS locale-1 locale-2 ... locale-n

$LANGNAMES{"en-US"} = "English";
$LANGNAMES{"uz"} = "Uzbek Cyrillic";
$LANGNAMES{"ru"} = "Russian";

$DELIM = "\t";

$MK = shift;
$MKS = shift;
$LOCALE = "en-US";

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

if (!-e $LOCALEDIR) {&Log("ERROR: Locale \"$LOCALEDIR\" was not found"); die;}

&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%MapLine);
&read_UI_Files($LOCALE, \%EN_DescValue);

for (my $x=0; $x<@ARGV; $x++) {
  &read_UI_Files(@ARGV[$x], \%{$IN{@ARGV[$x]}});
}

open(OUTF, ">:encoding(UTF-8)", "./MK UI Translation.csv") || die;

print OUTF "MK location".$DELIM.$LANGNAMES{$LOCALE};
for (my $x=0; $x<@ARGV; $x++) {print OUTF $DELIM.$LANGNAMES{@ARGV[$x]};}
print OUTF "\n";

foreach my $d (sort keys %EN_DescValue) {
  if (&isSecondary($EN_DescValue{$d}, $d, \%MayBeMissing, \%MayBeEmpty)) {next;}
  
  print OUTF &q("[".$d."]: ").$DELIM.&q($EN_DescValue{$d});
  
  for (my $x=0; $x<@ARGV; $x++) {
    print OUTF $DELIM.&q($IN{@ARGV[$x]}{$d});
  }
  print OUTF "\n";
  
}

close(OUTF);

sub q($) {
  my $t = shift;
  if ($t =~ /\Q$DELIM\E/) {die;}
  return $t;
}

