#!/usr/bin/perl
# Usage: localeCodes2.7.pl MK MKS MKO
# This routine encodes the two CRC values of the locale's manifest and jar files.
# The encoded value is stored in a text file which is read and checked by xulsword.dll,
# In this way, the CRC's associated with this locale are recovered, and the integrity check passes.

$MK = shift;
$MKS = shift;
$MKO = shift;

open (NFLE, "<Release\\chromeCode.h") || die "Could not open chromeCode.h.\n";
while (<NFLE>) {
  if ($_ =~ /CRC:(\S+)\s+(.*)\.locale\.manifest/) {$localeManifestCRC{$2} = $1;}
  if ($_ =~ /CRC:(\S+)\s+(.*)\.jar/) {$jarManifest{$2} = $1;}
}
close (NFLE);

foreach $locale (sort keys %localeManifestCRC) {
  if ($localeManifestCRC{$locale} eq "") {next;}
  if ($jarManifest{$locale} eq "") {next;}
  open (OUTF1, ">$MKS\\localeDev\\locales\\$locale.1.txt");
  open (OUTF2, ">$MK\\xulrunner\\chrome\\$locale.1.txt");
  
  for ($i=0; $i<8; $i++) {
    $cm = substr($localeManifestCRC{$locale}, $i, 1);
    $cj = substr($jarManifest{$locale}, $i, 1);
    print OUTF1 "$cm$cj";
    print OUTF2 "$cm$cj";
  }
  
  close (OUTF1);
  close (OUTF2);
}
