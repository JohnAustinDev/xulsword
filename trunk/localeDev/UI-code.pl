#!/usr/bin/perl
#usage: UI-code.pl MK MKS locale
use Encode;
use File::Copy;
use File::Path;

if (!@ARGV) {die;}
$MK = shift;
$MKS = shift;
$locale = shift;

require "$MK/localeDev/script/UI-common.pl";
$logFile = "code_log.txt";
if (!open(LOG, ">$MKS/localeDev/$locale/$logFile")) {&Log("Could not open log file $logFile\nFinished.\n"); die;}
if (-e "$MKS/localeDev/$locale/locale") {rmtree(["$MKS/localeDev/$locale/locale"]);}

&Log($locinfo);

# read UI file(s). This must be done before reading MAP to find version
&readDescriptionsFromUI($listFile, \%UIDescValue);
if (-e "$listFile2") {&readDescriptionsFromUI($listFile2, \%UIDescValue);}

# read the MAP and code file contents into memory structures
&loadMAP($mapFile, \%MapDescInfo, \%MapFileEntryInfo, \%CodeFileEntryValue, "true");

# remove code file entries that are optional, so that they do not propogate
for $mfe (keys %MapFileEntryInfo) {
  if ($mfe !~ /^(.*?)\:optional/ || $MapFileEntryInfo{$mfe} ne "true") {next;}
#print "HERE IS ONE: ".$1."=".$CodeFileEntryValue{$1}."\n";
  $CodeFileEntryValue{$1} = "_NOT_FOUND_";  
}

# merge UI values from listing over existing values from the map
for $d (keys %UIDescValue) {
  for $fei (keys %MapFileEntryInfo) {
    if ($fei !~ /\:desc$/ || $MapFileEntryInfo{$fei} ne $d) {next;}
    $fe = $fei; $fe =~ s/\:desc$//;
    $CodeFileEntryValue{$fe} = $UIDescValue{$d};
  }
}

# write the UI to code files
mkdir("$locale/locale");
for $fe (sort keys %CodeFileEntryValue) {
  $v = $CodeFileEntryValue{$fe};
  if ($v eq "_NOT_FOUND_") {next;}
  if ($ignoreShortCutKeys eq "true" && $MapFileEntryInfo{$fe.":desc"} =~ /\.(ak|sc|ck|kb)$/) {$v = "";}
  $fe =~ /^(.*?):(.*?)\s*$/;
  $f = "$MKS/localeDev/$locale/locale/$1";
  $e = $2;
  $d = $f; $d =~ s/\/[^\/]+$//;
  if ($f ne $lastf) {
    if ($last ne "") {close(OUTF);}
    if (!-e "$d") {`mkdir \"$d\"`;}
    if (!open(OUTF, ">$f")) {&Log("ERROR: Could not open code file \"$f\"\n"); die;}
  }
  $lastf = $f;
  
  if ($v =~ /^\s*$/ && $e !~ /(commandkey|keybinding|accesskey|AccKey|\.sh|\.sc)/i) {&Log("WARNING $fe: Value is empty.\n");}
  if ($f =~ /\.properties$/i) {print OUTF $e."=".$v."\n";}
  elsif ($f =~ /\.dtd$/i) {print OUTF "<!ENTITY ".$e."\t\t\t\t\"".$v."\">\n";}
  else {&Log("ERROR FileEntry=\"".$fe."\": Unknown file type \"".$f."\"\n");}
}
close(OUTF);
