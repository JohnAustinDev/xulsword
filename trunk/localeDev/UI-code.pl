#!/usr/bin/perl
use File::Spec;
$NOCONSOLELOG = 1;

if (!@ARGV) {print "usage: UI-code.pl MK MKS locale\n"; exit;}

$MK = shift;
$MKS = shift;
$locale = shift;

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
&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%MapLine);

# correlate UI descriptions to MAP entries
&correlateUItoMAP(\%UIDescValue, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%CodeFileEntryValues, \%IsShortcutKey, \%MatchedDescriptions);

# write code files
for my $fe2 (sort keys %CodeFileEntryValues) {
  $fe2 =~ /^(.+?)\:(.+)\s*$/;
  my $f = "$LOCALECODE/$1";
  my $e = $2;
  my $v = $CodeFileEntryValues{$fe2};
  if ($ignoreShortCutKeys && $IsShortcutKey{$fe2}) {$FilteredShortcuts = 1; $v = "";}

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
if ($FilteredShortcuts) {&Log("WARNING: All access and command keys have been filtered out (Ignore_shortCut_keys=true).\n");}

&Log("Finished.\n");
