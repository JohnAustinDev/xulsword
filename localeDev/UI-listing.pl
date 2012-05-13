#!/usr/bin/perl
use File::Spec;

if (!@ARGV) {print "usage UI-listing.pl MK MKS locale version alternateLocale firefoxLocale firefoxWins\n"; exit;}

$MK = shift;
$MKS = shift;
$locale = shift;
$version = shift;
$localeALT = shift;
$firefox = shift;
$firefoxWins = shift;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/listing_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}

if ($locale eq "en-US") {&Log("ERROR: Cannot run on en-US.\n"); die;}

$dontsort = 1;

if (-e &UI_File($locale, 1)) {&Log("Listing file \"".&UI_File($locale, 1)."\" already exists.\nFinished.\n"); die;}
if (-e &UI_File($locale, 2)) {&Log("Listing file \"".&UI_File($locale, 2)."\" already exists.\nFinished.\n"); die;}

# if the local locale contains special UI material, handle it
&extractFromLocale("xulsword/splash.png", "text-skin/xulsword");
&extractFromLocale("skin/NT.png", "text-skin/skin");
&extractFromLocale("skin/OT.png", "text-skin/skin"); 

&Log($locinfo);

# read the MAP contents into memory
&readMAP($MAPFILE, \%FileEntryDesc, \%MayBeMissing, \%MayBeEmpty);

# copy the alternate locale UI as a starting point
&read_UI_Files($localeALT, \%UIDescValue);

# now scour the Firefox locale for matching phrases
&read_UI_Files("en-US", \%UIDescValueEN);
for my $d (keys %UIDescValueEN) {
  my $fe = &findFileEntry($UIDescValueEN{$d}, "en-US");
  if ($fe) {
    my $v = &getValue($fe, $locale);
    if (!$v) {&Log("WARNING: \"".$fe."\" was located in en-US, but not in $locale.\n");}
    elsif ($firefoxWins || !exists($UIDescValue{$d}) || !$UIDescValue{$d} || $UIDescValue{$d} eq "_NOT_FOUND_") {
      $UIDescValue{$d} = $v;
      &Log("INFO: Found \"$d\" as \"$v\" (".$UIDescValueEN{$d}.")\n");
    }
  }
}




# print the listing to UI file(s)...
if (!open(OUTF, ">:encoding(UTF-8)", "$LISTFILE1")) {&Log("Could not open output file $LISTFILE1.\nFinished.\n"); die;}

print OUTF $locinfo;

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

if ($File2) {
  if (!open(OUTF, ">:encoding(UTF-8)", "$LISTFILE2")) {&Log("Could not open output file $LISTFILE2.\nFinished.\n"); die;}
  print OUTF $locinfo.$File2;
  close(OUTF);
}

&Log("$outdated\n");
&Log("\nCODE FILES THAT WERE READ:\n");
for $f (sort keys %Readfiles) {&Log($Readfiles{$f}."\n");}
&Log("\nFinished.\n");

################################################################################
################################################################################

sub saveListing(@%%) {
  my $listP = shift;
  my $mapDescInfoP = shift;
  my $MAPFILEEntryInfoP = shift;
  
  foreach (@{$listP}) {
    my $p = "[$_]: ".$MapDescInfo{"$_:value"}."\n";

    # a second file is used for things which UI translators don't need to worry about
    if    ($mapDescInfoP->{"$_:value"} =~ /^\s*$/)   {$File2 = $File2.$p;}
    elsif ($_ =~ /^search-help-window\..*_term$/)    {$File2 = $File2.$p;}
    elsif ($_ =~ /^locale_direction/)                {$File2 = $File2.$p;}
    elsif ($_ =~ /^books\..*_index/)                 {$File2 = $File2.$p;}
    elsif ($_ =~ /print-preview.p\d+/)               {$File2 = $File2.$p;}
    elsif ($_ =~ /\.(ak|sc|ck|kb)$/)                 {$File2 = $File2.$p;}
    elsif ($MAPFILEEntryInfoP->{$mapDescInfoP->{$_.":fileEntry"}.":unused"}   eq "true") {$File2 = $File2.$p;}
    elsif ($MAPFILEEntryInfoP->{$mapDescInfoP->{$_.":fileEntry"}.":optional"} eq "true") {$File2 = $File2.$p;}
    else {print OUTF $p;}
  }
}

sub extractFromLocale($$) {
  my $srcf = shift;
  my $dest = shift;
  
  if (-e "$LOCALECODE/$srcf") {
    print "\n\nFound in locale: \"$srcf\"\n\tExtract and overwrite existing? (Y/N):"; 
    $in = <>; 
    if ($in =~ /^\s*y\s*$/i) {
      if (!-e "$LOCALEDIR/$dest") {make_path("$LOCALEDIR/$dest");}
      cp("LOCALECODE/$srcf", "$LOCALEDIR/$dest/");
    }
  }
}
