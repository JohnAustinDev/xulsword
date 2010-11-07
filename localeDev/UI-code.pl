#!/usr/bin/perl
use Encode;
#usage: UI-code.pl MK MKS locale noKeys(true|false) [logFile]

$MK = shift;
$MKS = shift;
$locale = shift;
$nokeys = shift;

$logFile = "code_log.txt";
require "$MK\\localeDev\\script\\UI-common.pl";
if ($logFile ne "") {if (!open(LOG, ">$MKS\\localeDev\\$locale\\$logFile")) {&Log("Could not open log file $logFile\nFinished.\n"); die;}}
if (-e "$MKS\\localeDev\\$locale\\locale") {&Log("UI locale directory \"$MKS\\localeDev\\$locale\\locale\" already exists.\nFinished.\n"); die;}

# read UI file(s). This must be done before reading MAP to find version
&readDescriptionsFromUI($listFile, \%UIDescValue);
if (-e "$listFile2") {&readDescriptionsFromUI($listFile2, \%UIDescValue);}

# read the MAP and code file contents into memory structures
&loadMAP($mapFile, \%MapDescInfo, \%MapFileEntryInfo, \%CodeFileEntryValue, "true");

# merge UI values from listing over existing values from the map
for $d (keys %UIDescValue) {
  for $fei (keys %MapFileEntryInfo) {
    if ($fei !~ /\:desc$/ || $MapFileEntryInfo{$fei} ne $d) {next;}
    $fe = $fei; $fe =~ s/\:desc$//;
    $CodeFileEntryValue{$fe} = $UIDescValue{$d};
  }
}

# write the UI to code files
mkdir("$locale\\locale");
for $fe (sort keys %CodeFileEntryValue) {
  $v = $CodeFileEntryValue{$fe};
  if ($v eq "_NOT_FOUND_") {next;}
  if ($nokeys eq "true" && $MapFileEntryInfo{$fe.":desc"} =~ /\.(ak|sc|ck|kb)$/) {$v = "";}
  $fe =~ /^(.*?):(.*?)\s*$/;
  $f = "$MKS\\localeDev\\$locale\\locale\\$1";
  $e = $2;
  $d = $f; $d =~ s/\\[^\\]+$//;
  if ($f ne $lastf) {
    if ($last ne "") {close(OUTF);}
    if (!-e "$d") {`mkdir \"$d\"`;}
    if (!open(OUTF, ">$f")) {&Log("ERROR: Could not open code file \"$f\"\n"); die;}
  }
  $lastf = $f;
  
  if ($f =~ /\.properties$/i) {print OUTF $e."=".$v."\n";}
  elsif ($f =~ /\.dtd$/i) {print OUTF "<!ENTITY ".$e."\t\t\t\t\"".$v."\">\n";}
  else {&Log("ERROR FileEntry=\"".$fe."\": Unknown file type \"".$f."\"\n");}
}
close(OUTF);
