#!/usr/bin/perl
use File::Spec;

if (!@ARGV) {print "usage: UI-code.pl MK MKS locale\n"; exit;}

$MK = shift;
$MKS = shift;
$locale = shift;

$NOCONSOLELOG = 1;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/code_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}

if (!-e $LOCALEDIR) {&Log("ERROR: Locale \"$LOCALEDIR\" was not found"); die;}
if (-e $LOCALECODE) {remove_tree($LOCALECODE);}

&Log($locinfo);

# read UI file(s). This must be done before reading MAP to find version
&read_UI_File($LISTFILE1, \%UIDescValue);
if (-e "$LISTFILE2") {&read_UI_File($LISTFILE2, \%UIDescValue);}

# read the MAP and code file contents into memory structures
&loadMAP($MAPFILE, \%MapFileEntryInfo, \%MapDescInfo, \%CodeFileEntryValue, "true");

# remove code file entries that are optional, so that they do not propogate
for my $mfe (keys %MapFileEntryInfo) {
  if ($mfe !~ /^(.*?)\:optional/ || $MapFileEntryInfo{$mfe} ne "true") {next;}
  $CodeFileEntryValue{$1} = "_NOT_FOUND_";  
}

# merge UI values from listing over existing values from the map
for my $d (keys %UIDescValue) {
  my $found = 0;
  for my $fei (keys %MapFileEntryInfo) {
    if ($fei !~ /\:desc$/ || $MapFileEntryInfo{$fei} ne $d) {next;}
    $found = 1;
    my $fe = $fei; $fe =~ s/\:desc$//;
    $CodeFileEntryValue{$fe} = $UIDescValue{$d};
  }
  if (!$found) {
    my $fe = &matchDescToMapFileEntry($MAPFILE, $d, $locale);
    if ($fe) {$CodeFileEntryValue{$fe} = $UIDescValue{$d}}
  }
}

# write the UI to code files
for my $fe (sort keys %CodeFileEntryValue) {
  $v = $CodeFileEntryValue{$fe};
  if ($v eq "_NOT_FOUND_") {next;}
  if ($ignoreShortCutKeys eq "true" && $MapFileEntryInfo{$fe.":desc"} =~ /\.(ak|sc|ck|kb)$/) {$v = "";}
  $fe =~ /^(.*?):(.*?)\s*$/;
  $f = $1;
  $e = $2;
  if ($f !~ /^xulsword\//) {$f = "xs".$f;}
  $f = "$LOCALECODE/$f";
  $d = $f; $d =~ s/\/[^\/]+$//;
  if ($f ne $lastf) {
    if ($last ne "") {close(OUTF);}
    if (!-e "$d") {make_path($d);}
    if (!open(OUTF, ">:encoding(UTF-8)", "$f")) {&Log("ERROR: Could not open code file \"$f\"\n"); die;}
  }
  $lastf = $f;
  
  if ($v =~ /^\s*$/ && $e !~ /(commandkey|keybinding|accesskey|AccKey|\.sh|\.sc)/i) {&Log("WARNING $fe: Value is empty.\n");}
  if ($f =~ /\.properties$/i) {print OUTF $e."=".$v."\n";}
  elsif ($f =~ /\.dtd$/i) {print OUTF "<!ENTITY ".$e." \"".$v."\">\n";}
  else {&Log("ERROR FileEntry=\"".$fe."\": Unknown file type \"".$f."\"\n");}
}
close(OUTF);
