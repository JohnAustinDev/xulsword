use Encode;
use File::Copy;
use File::Path qw(make_path remove_tree);

# copies a directory recursively
sub copy_dir($$$$) {
  my $id = shift;
  my $od = shift;
  my $skf = shift;
  my $skd = shift;
  
  if (!-e $id || !-d $id) {
    &Log("ERROR copy_dir: Source does not exist or is not a direcory: $id\n");
    return 0;
  }

  opendir(DIR, $id) || die "Could not open dir $id\n";
  my @fs = readdir(DIR);
  closedir(DIR);
  if (!-e $od) {make_path($od);}

  for(my $i=0; $i < @fs; $i++) {
    if ($fs[$i] =~ /^\.+$/) {next;}
    my $if = "$id/".$fs[$i];
    my $of = "$od/".$fs[$i];
    if (-d $if) {
      if ($skd && $if =~ /$skd/) {next;}
      &copy_dir($if, $of, $skf, $skd);
    }
    else {
      if ($skf && $if =~ /$skf/) {next;}
      copy($if, $of);
    }
  }
  return 1;
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  if ((!$NOCONSOLELOG && $h!=-1) || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
  if ($LOGFILE && $h!=2) {
    open(LOGF, ">>:encoding(UTF-8)", $LOGFILE) || die "Could not open log file \"$LOGFILE\"\n";
    print LOGF $p;
    close(LOGF);
  }
}

1;