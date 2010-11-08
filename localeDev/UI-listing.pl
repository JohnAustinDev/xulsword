#!/usr/bin/perl
use Encode;
#usage UI-listing.pl MK MKS locale version alternateLocale sourcingFromFirefox3(true|false)

$MK = shift;
$MKS = shift;
$locale = shift;
$version = shift;
$localeALT = shift;
$sourceFF3 = shift;

$logFile = "listing_log.txt";
$dontsort = "true";
require "$MK\\localeDev\\script\\UI-common.pl";
if (!-e "$MKS\\localeDev\\$locale") {mkdir("$MKS\\localeDev\\$locale");}
if ($logFile ne "") {if (!open(LOG, ">$MKS\\localeDev\\$locale\\$logFile")) {&Log("Could not open log file $logFile\nFinished.\n"); die;}}
if (-e $listFile)  {&Log("Listing file \"$listFile\" already exists.\nFinished.\n"); die;}
if (-e $listFile2) {&Log("Listing file \"$listFile2\" already exists.\nFinished.\n"); die;}

# read Firefox 2 to Firefox 3 map if needed
if ($sourceFF3 eq "true") {
  if (!open(FF2, "<$ff2to3MAP")) {&Log("Could not open Firefox 2 to 3 MAP file \"$ff2to3MAP\"\nFinished.\n"); die;}
  $line = 0;
  while(<FF2>) {
    $line++;
    if ($_ =~ /^[\s]*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*)\s*$/) {&Log("ERROR $ff2to3MAP line $line: Could not parse FF2 to FF3 MAP entry \"$_\"\n"); next;}
    $FF2_to_FF3{$1} = $2;
  }
  close(FF2);
}

# read the MAP and code file contents into memory structures
&loadMAP($mapFile, \%MapDescInfo, \%MapFileEntryInfo, \%CodeFileEntryValue);

# print the listing to UI file(s)...
if (!open(OUTF, ">$listFile")) {&Log("Could not open output file $listFile.\nFinished.\n"); die;}
$File2 = "Locale:$locale, Version:$version (Alternate locale:$localeALT)\n";
&Print($File2);
for $di (sort descsort keys %MapDescInfo) {
  if ($di !~ /\:value$/) {next;}
  $d = $di; $d =~ s/\:value$//;
  $e = $MapDescInfo{"$d:fileEntry"};
  $list[0] = $d;
  my @wildm; # not used here
  if ($e =~ /:.*\*/) {&getMatchingEntries(\@list, \@wildm, $e, \%CodeFileEntryValue);}
  &saveListing(\@list, \%MapDescInfo, \%MapFileEntryInfo);
}
close(OUTF);

if ($File2 ne "Locale:$locale, Version:$version (Alternate locale:$localeALT)\n") {
  if (!open(OUTF, ">$listFile2")) {&Log("Could not open output file $listFile2.\nFinished.\n"); die;}
  print OUTF $File2;
  close(OUTF);
}

&Log("$outdated\n");
&Log("\nCODE FILES THAT WERE READ:\n");
for $f (sort keys %Readfiles) {&Log($Readfiles{$f}."\n");}
&Log("\nFinished.\n");
if ($logFile ne "") {close(LOG);}

################################################################################
################################################################################

sub saveListing(@%%) {
  my $listP = shift;
  my $mapDescInfoP = shift;
  my $mapFileEntryInfoP = shift;
  
  foreach (@{$listP}) {
    my $p = "[$_]: ".$MapDescInfo{"$_:value"}."\n";

    # a second file is used for things which UI translators don't need to worry about
    if    ($mapDescInfoP->{"$_:value"} =~ /^\s*$/)   {$File2 = $File2.$p;}
    elsif ($_ =~ /^search-help-window\..*_term$/)    {$File2 = $File2.$p;}
    elsif ($_ =~ /^locale_direction/)                {$File2 = $File2.$p;}
    elsif ($_ =~ /^books\..*_index/)                 {$File2 = $File2.$p;}
    elsif ($_ =~ /print-preview.p\d+/)               {$File2 = $File2.$p;}
    elsif ($_ =~ /\.(ak|sc|ck|kb)$/)                 {$File2 = $File2.$p;}
    elsif ($mapFileEntryInfoP->{$mapDescInfoP->{$_.":fileEntry"}.":unused"}   eq "true") {$File2 = $File2.$p;}
    elsif ($mapFileEntryInfoP->{$mapDescInfoP->{$_.":fileEntry"}.":optional"} eq "true") {$File2 = $File2.$p;}
    else {&Print($p);}
  }
}
