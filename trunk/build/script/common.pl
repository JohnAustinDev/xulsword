use Encode;
use File::Copy;
use File::Path qw(make_path remove_tree);

# copies a directory recursively
sub copy_dir($$$$) {
  my $id = shift;
  my $od = shift;
  my $incl = shift;
  my $skip = shift;

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
    if ($incl && $if !~ /$incl/i) {next;}
    if ($skip && $if =~ /$skip/i) {next;}
    if (-d $if) {
      &copy_dir($if, $of, $incl, $skip);
    }
    else {
      copy($if, $of);
    }
  }
  return 1;
}

sub makeJAR($$) {
  my $jf = shift;
  my $di = shift;
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    $jf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    $di .= "\\*";
    my $cmd = "7za a -tzip \"$jf\" -r \"$di\" -x!.svn";
    #&Log("$cmd\n");
    `$cmd`;
  }
  else {
    &Log("ERROR: Please update common.pl->makeJAR() to include your platform.\n");
  }
}

sub updateJAR($$) {
  my $jf = shift;
  my $di = shift;
  
  if (!-e $jf) {&Log("ERROR: no JAR to update \"$jf\".\n"); return;}
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    $jf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    $di .= "\\*";
    my $cmd = "7za u -tzip \"$jf\" -r \"$di\" -x!.svn";
    #&Log("$cmd\n");
    `$cmd`;
  }
  else {
    &Log("ERROR: Please update common.pl->updateJAR() to include your platform.\n");
  }
}

sub createLocaleExtension($$) {
  my $loc = shift;
  my $di = shift;
  &Log("WARNING: createLocaleExtension not yet implemented.\n");
}

sub getInfoFromConf($\%) {
  my $conf = shift;
  my $ceP = shift;
  open(CONF, "<:encoding(UTF-8)", $conf) || die "Could not open $conf\n";
  while(<CONF>) {
    if ($_ =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {
      if ($ceP->{$1} ne "") {$ceP->{$1} = $ceP->{$1}."<nx>".$2;}
      else {$ceP->{$1} = $2;}
    }
    if ($_ =~ /^\s*\[(.*?)\]\s*$/) {$ceP->{"modname"} = $1;}
  }
  close(CONF);

  # short var names
  my $MODPATH = $ceP->{"DataPath"};
  $MODPATH =~ s/([\/\\][^\/\\]+)\s*$//; # remove any file name at end
  $MODPATH =~ s/[\\\/]\s*$//; # remove ending slash
  $MODPATH =~ s/^[\s\.]*[\\\/]//; # normalize beginning of path
  $ceP->{"DataPath"} = $MODPATH;
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  if ($p =~ /error/i) {$p = "\n$p\n";}
  if ((!$NOCONSOLELOG && $h!=-1) || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
  if ($LOGFILE && $h!=2) {
    open(LOGF, ">>:encoding(UTF-8)", $LOGFILE) || die "Could not open log file \"$LOGFILE\"\n";
    print LOGF $p;
    close(LOGF);
  }
}

1;