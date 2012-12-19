#!/usr/bin/perl

# This script checks that identical UI-MAP file entry names match
# identical UI-MAP descritpion names, regardless of which file they
# will reside in.

open(INF, "<../UI-MAP.txt") || die;

while(<INF>) {
  #xulsword/xsglobal/textcontext.dtd:spellAddToDictionary.label             =  Add to Dictionary"
  if ($_ !~ /^[^\:]+\:(\S+)\s+=\s*(\?|<[^>]*>)*(.*?)\s*$/) {print "Skipping:$_"; next;}
  my $entry = $1;
  my $name = $3;
  
  if (exists($Entries{$entry})) {
    if ($Entries{$entry} eq $name) {print "........... another matching entry\n";}
    else {print "ERROR!!!!!! Same entry, two names: $entry, $name, ".$Entries{$entry}."\n";}
  }
  else {
    $Entries{$entry} = $name;
    print "........... captured $entry, $name\n";
  }
}
