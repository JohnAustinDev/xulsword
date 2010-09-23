#!/usr/bin/perl
use Encode;
#usage UI-listing.pl MK MKS locale version alternateLocale sourcingFromFirefox3(true|false) [logFile]

$MK = shift;
$MKS = shift;
$locale = shift;
$version = shift;
$localeALT = shift;
$sourceFF3 = shift;
$logFile = shift;

$dontsort = "true";
require "$MK\\localeDev\\script\\UI-common.pl";
if ($logFile ne "") {if (!open(LOG, ">$logFile")) {&Log("Could not open lof file $logFile\nFinished.\n"); die;}}
if (!-e "$MKS\\localeDev\\$locale") {mkdir("$MKS\\localeDev\\$locale");}
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
&Print("Locale:$locale, Version:$version (Alternate locale:$localeALT)\n");
for $di (sort descsort keys %MapDescInfo) {
  if ($di !~ /\:value$/) {next;}
  $d = $di; $d =~ s/\:value$//;
  $p = "[$d]: ".$MapDescInfo{$di}."\n";
  
  # a second file is used for things which UI translators don't need to worry about
  if    ($MapDescInfo{$di} =~ /^\s*$/)             {$file2 = $file2.$p;}
  elsif ($d =~ /^search-help-window\..*_term$/)    {$file2 = $file2.$p;}
  elsif ($d =~ /^locale_direction/)                {$file2 = $file2.$p;}
  elsif ($d =~ /^books\..*_index/)                 {$file2 = $file2.$p;}
  elsif ($d =~ /print-preview.p\d+/)               {$file2 = $file2.$p;}
  elsif ($d =~ /\.(ak|sc|ck|kb)$/)                 {$file2 = $file2.$p;}
  elsif ($MapFileEntryInfo{$MapDescInfo{$d.":fileEntry"}.":unused"}   eq "true") {$file2 = $file2.$p;}
  elsif ($MapFileEntryInfo{$MapDescInfo{$d.":fileEntry"}.":optional"} eq "true") {$file2 = $file2.$p;}
  else {&Print($p);}
}
close(OUTF);

if ($file2 ne "") {
  if (!open(OUTF, ">$listFile2")) {&Log("Could not open output file $listFile2.\nFinished.\n"); die;}
  print OUTF $file2;
  close(OUTF);
}

&Log("$outdated\n");
&Log("\nCODE FILES THAT WERE READ:\n");
for $f (sort keys %Readfiles) {&Log($Readfiles{$f}."\n");}
&Log("\nFinished.\n");
if ($logFile ne "") {close(LOG);}
