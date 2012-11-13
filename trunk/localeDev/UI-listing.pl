#!/usr/bin/perl
use File::Spec;

if (!@ARGV) {print "usage UI-listing.pl MK MKS locale alternateLocale version firefoxDirName\n"; exit;}

$MK = shift;
$MKS = shift;
$LOCALE = shift;
$LOCALE_ALT = shift;
$VERSION = shift;
$firefoxDirName = shift;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/listing_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}

&Log($LOCINFO);

# read the MAP contents into memory
&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%MapLine);

# read the default UI
&read_UI_Files("en-US", \%UIDescValueEN);

# read existing locale files
if ($LOCALE eq "en-US") {&Log("ERROR: Cannot run on en-US.\n"); die;}
&read_UI_Files($LOCALE, \%UIDescValue);
&saveLocaleCode($LOCALE, "xulsword/splash.png", "text-skin/xulsword");
&saveLocaleCode($LOCALE, "skin/NT.png", "text-skin/skin");
&saveLocaleCode($LOCALE, "skin/OT.png", "text-skin/skin"); 

# read the alternate locale UI to use if a translation not found
&read_UI_Files($LOCALE_ALT, \%UIDescValueALT);

# now scour the firefox locale, translating all matching phrases
for my $d (keys %UIDescValueEN) {
  if (exists($UIDescValue{$d}) && $UIDescValue{$d} ne "" && $UIDescValue{$d} ne "_NOT_FOUND_") {next;}
  my $v = $UIDescValueEN{$d};
  if (&isSecondary($v, $d, \%MayBeMissing, \%MayBeEmpty)) {next;} # Don't try to translate secondary elements
  my $tv = &translateValue($v, "en-US", $LOCALE_FF, "$MKSDEV/$firefoxDirName");
  if ($tv) {
    $UIDescValue{$d} = $tv;
    $MapLine{$d} += 100000; # Move translated phrases to end of file
    &Log("INFO: Translated \"$v\" to \"$tv\" ($d)\n");
  }
  else {
    &Log("INFO: Couldn't translate \"$v\" ($d)\n");
    if (exists($UIDescValueALT{$d})) {
      $UIDescValue{$d}= $UIDescValueALT{$d};
      &Log("INFO: Using alternate locale instead of translation: \"".$UIDescValueALT{$d}."\" ($d)\n");
    }
  }
}

# correlate UI descriptions to MAP entries
&correlateUItoMAP(\%UIDescValue, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty, \%CodeFileEntryValues, \%MatchedDescriptions);

# write the UI files
# file1
my $listfile1 = &UI_File($LOCALE, 1);
if (!open(OUTF, ">:encoding(UTF-8)", $listfile1)) {&Log("ERROR: Could not open output file $listfile1.\n"); die;}
print OUTF $LOCINFO;
my $f2 = "";
foreach my $d (sort {$MapLine{$a} <=> $MapLine{$b}} keys %UIDescValue) {
  my $v = $UIDescValue{$d};
  my $p = "[$d]: $v\n";
  
  # put secondary UI stuff in the second UI file
  if (&isSecondary($v, $d, \%MayBeMissing, \%MayBeEmpty)) {$f2 .= $p;}
  else {print OUTF $p;}
}
close(OUTF);

# file2
if ($f2) {
  my $listfile2 = &UI_File($LOCALE, 2);
  if (!open(OUTF, ">:encoding(UTF-8)", $listfile2)) {&Log("ERROR: Could not open output file $listfile2.\n"); die;}
  print OUTF $f2;
  close(OUTF);
}

&Log("\nFinished.\n");
