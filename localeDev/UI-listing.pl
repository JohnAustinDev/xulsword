#!/usr/bin/perl
use File::Spec;

if (!@ARGV) {print "usage UI-listing.pl MK MKS locale version alternateLocale firefoxLocale sourcingFromFirefox3(true|false)\n"; exit;}

$MK = shift;
$MKS = shift;
$locale = shift;
$version = shift;
$localeALT = shift;
$firefox = shift;
$sourceFF3 = shift;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/listing_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}

$dontsort = "true";

if (-e $LISTFILE1)  {&Log("Listing file \"$LISTFILE1\" already exists.\nFinished.\n"); die;}
if (-e $LISTFILE2) {&Log("Listing file \"$LISTFILE2\" already exists.\nFinished.\n"); die;}

# if the local locale contains special UI material, handle it
&extractFromLocale("xulsword/splash.png", "text-skin/xulsword");
&extractFromLocale("skin/NT.png", "text-skin/skin");
&extractFromLocale("skin/OT.png", "text-skin/skin"); 

# read Firefox 2 to Firefox 3 map if needed
if ($sourceFF3 eq "true") {
  if (!open(FF2, "<:encoding(UTF-8)", "$FF2TO3MAP")) {&Log("Could not open Firefox 2 to 3 MAP file \"$FF2TO3MAP\"\nFinished.\n"); die;}
  $line = 0;
  while(<FF2>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    if ($_ !~ /^([^=]+?)\s*\=\s*(.*?)\s*$/) {&Log("ERROR $FF2TO3MAP line $line: Could not parse FF2 to FF3 MAP entry \"$_\"\n"); next;}
    my $pff2 = $1;
    my $pff3 = $2;
    
    $pff2 =~ s/\\/\//g;
    $pff3 =~ s/\\/\//g;
    
    $FF2_to_FF3{$pff2} = $pff3;
  }
  close(FF2);
}

&Log($locinfo);

# read the MAP and code file contents into memory structures
&loadMAP($MAPFILE, \%MapFileEntryInfo, \%MapDescInfo, \%CodeFileEntryValue);

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
