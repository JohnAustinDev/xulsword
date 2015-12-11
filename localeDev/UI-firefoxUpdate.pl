#!/usr/bin/perl

#usage: UI-firefoxUpdate.pl language-code Firefox-locale-directory directory-to-update [test-only]

$LANG = shift;
$FFDIR = shift;
$UPDIR = shift;
$TEST = shift;
if (!$LANG || !$FFDIR || !$UPDIR || $UPDIR !~ /^\./) {die;}

$FFDIR =~ s/\/$//;
$UPDIR =~ s/\/$//;

&processDir("$FFDIR/$LANG", "$UPDIR/$LANG");

sub processDir($$) {
  my $ffdir = shift;
  my $updir = shift;

  print "Reading $updir\n";
  
  opendir(DIR, $updir) || die;
  my @files = readdir(DIR);
  closedir(DIR);

  foreach my $file (@files) {
    if ($file =~ /^\.+$/) {next;}
    elsif (-d "$updir/$file") {&processDir("$ffdir/$file", "$updir/$file");}
    elsif ($file =~ /\.(properties|dtd|css)$/) {
      my $cmd = "cp \"$ffdir/$file\" \"$updir/$file\"";
      print $cmd."\n";
      if ($TEST) {print "(test)\n";}
      else {`$cmd`;}
    }
    else {
      print "SKIPPING FILE: $file\n";
    }
  }
}
