#!/usr/bin/perl
#usage filter-ppr.pl file.ppr

$ppr = shift;
if ($ppr eq "") {print "Enter ppr file name:"; $ppr = <>;}
$ppr =~ s/\s*$//g;
if ($ppr !~ /\.ppr$/) {$ppr = "$ppr.ppr";}

print "\nFiltering:$ppr\n---------------------\n";

if (!open(INF, "<$ppr")) {
  print "Could not open $ppr\nPress Enter to quit.";
  $p = <>;
  die;
}

open(OUTF, ">tmp.ppr");
$skipdir = "none";
while (<INF>) {
  if ($_ =~ /^[Project tree]/) {$projectTree = "true"; next;}
  elsif ($_ =~ /^[.*?]/) {$projectTree = "false"; next;}
  if ($projectTree ne "true") {next;}
  if ($_ =~ /$skipdir\t+/) {next;}
  
  # Skip listed directories names
  if ($_ =~ /^(\s*)[-+](swordmk-mods|sword-mods|TranslationUtils|zipmods|Original Backups|libxml*|GoBibleCreator|Release|autogen|\.svn|bin|tmp|compare|xulrunner-.*|clucene-core.*)$/) {$skipdir = $1; next;}

  # Skip listed root directories
  elsif ($_ =~ /^(\t\t)[-+](build-out|portable|xulrunner)$/) {$skipdir = $1; next;}
  else {$skipdir = "none";}

  # Skip listed files and file types
  if ($_ =~ /^\s*[^-+]*(filter-ppr\.pl|Thumbs\.db|.+\.(ppr|lnk|ods|png|gif|jpg|tif|pdf|zip|.zz|exe|jar|xsm|xsb|ttf|cfs|idx))\s*$/i) {next;}
  
  print OUTF $_;
}
close(INF);
close(OUTF);
unlink($ppr);
`move tmp.ppr "$ppr"`;

print "Filtering complete! Press Enter to exit.\n";
$p = <>;
