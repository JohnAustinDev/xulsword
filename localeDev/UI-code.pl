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

# read UI file(s).
&read_UI_Files($locale, \%UIDescValue);

# read the MAP contents into memory
&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty);

# create code file data
for my $d (sort keys %UIDescValue) {
  for my $fe (keys %FileEntryDesc) {
    my $fed = quotemeta($FileEntryDesc{$fe});
    if ($fed =~ s/\\\*/(.*)/) {$IsWild{$fe}++;}
    if ($d =~ /^$fed$/) {
      my $w = $1;
      my $fe2 = $fe;
      if (exists($IsWild{$fe})) {
        $fe2 =~ s/\*/$w/;
      }
      $MatchedDescriptions{$d}++;
      if ($fe2 !~ /^(.+?)\:(.+)\s*$/) {&Log("ERROR: Malformed file:entry \"$fe2\"\n"); next;}
      $CodeFileEntryValues{$fe2} = $UIDescValue{$d};
      if (exists($IsWild{$fe})) {next;}
      if ($UIDescValue{$d} =~ /^\s*$/ && !exists($MayBeEmpty{$FileEntryDesc{$fe}})) {&Log("WARNING $fe2: Value is empty.\n");}
      $FileEntryDesc{$fe} = "<uSEd>";
    }
  }
}

# handle MAP file-entries which need to exist, but which are not used by the UI (and so are not in the UI files)
for my $fe (keys %FileEntryDesc) {
  if ($FileEntryDesc{$fe} =~ /^"(.*)"$/) {
    $CodeFileEntryValues{$fe} = $1;
    $FileEntryDesc{$fe} = "<uSEd>";
  }
}

# write code files
for my $fe2 (sort keys %CodeFileEntryValues) {
  $fe2 =~ /^(.+?)\:(.+)\s*$/;
  my $f = "$LOCALECODE/$1";
  my $e = $2;
  my $v = $CodeFileEntryValues{$fe2};

  my $dir = $f;
  $dir =~ s/\/[^\/]+$//;
  if (!-e $dir) {make_path($dir);}
      
  if ($f ne $openfile) {
    if ($openfile) {close(OUTF);}
    if (!open(OUTF, ">>:encoding(UTF-8)", $f)) {&Log("ERROR: Could not open code file \"$f\"\n"); die;}
  }
  $openfile = $f;

  if ($f =~ /\.properties$/i) {print OUTF $e."=".$v."\n";}
  elsif ($f =~ /\.dtd$/i) {print OUTF "<!ENTITY ".$e." \"".$v."\">\n";}
  else {&Log("ERROR FileEntry=\"".$fe2."\": Unknown file type \"".$f."\"\n");}
}
close(OUTF);
  
# report any UI listing phrases which were not used
for my $d (sort keys %UIDescValue) {
  if (!exists($MatchedDescriptions{$d})) {
    &Log("ERROR: Description \"$d = ".$UIDescValue{$d}."\" was not found in the MAP.\n");
  }
}

# report any MAP file entries which were not matched
for my $fe (keys %FileEntryDesc) {
  if (exists($MayBeMissing{$FileEntryDesc{$fe}})) {next;}
  if (exists($IsWild{$fe})) {next;}
  if ($FileEntryDesc{$fe} ne "<uSEd>") {
    &Log("ERROR: MAP file entry was not matched: \"$fe = ".$FileEntryDesc{$fe}."\".\n");
  }
}

&Log("Finished.\n");
