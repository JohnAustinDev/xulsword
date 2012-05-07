use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

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
      &copy_file($if, $of);
    }
  }
  return 1;
}

sub copy_file($$) {
  my $if = shift;
  my $of = shift;
  if ("$^O" =~ /MSWin32/i) {cp($if, $of);}
  elsif ("$^O" =~ /linux/i) {
    my $cmd = "cp -p ".&escfile($if)." ".&escfile($of);
    `$cmd`;
  }
}

sub cleanDir($) {
  my $id = shift;
  if (!-e $id || !-d $id) {return;}
  if (!opendir(CDIR, $id)) {
    &Log("WARNING: cleanDir: Could not open \"$id\".\n");
    return;
  }
  my @files = readdir(CDIR);
  closedir(CDIR);
  foreach my $f (@files) {
    if ($f =~ /^\.+/) {next;}
    $f = "$id/$f";
    if (-d $f) {remove_tree($f);}
    else {unlink($f);}
  }
}

sub makeZIP($$$$) {
  my $zf = shift;
  my $di = shift;
  my $updateExisting = shift;
  my $logfile = shift;
  
  my $cmd = "";
  my $cwd = "";
  my $zd = $zf;
  $zd =~ s/[\/\\][^\/\\]+$//;
  if (!-e $zd) {make_path($zd);}
  if ("$^O" =~ /MSWin32/i) {
    $zf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    my $a = ($updateExisting ? "u":"a");
    $cmd = "7za $a -tzip ".&escfile($zf)." -r ".&escfile($di)." -x!.svn";
    if ($logfile) {
      my $lf = $zf;
      $lf =~ s/[^\/\\]+$/$logfile/;
      $cmd .= " > $lf";
    }
    #&Log("$cmd\n");
    `$cmd`;
  }
  elsif ("$^O" =~ /linux/i) {
    $cwd = `echo $PWD`; $cwd =~ s/\s*$//;
    chdir($di);
    $di .= "/*";
    my $a = ($updateExisting ? "-u ":"");
    $cmd = "zip -r ".$a.&escfile($zf)." * -x \\*.svn";  
  }
  else {
    &Log("ERROR: Please update common.pl->makeZIP() to include your platform.\n");
  }
  
  if ($cmd && $logfile) {
    my $lf = $zf;
    $lf =~ s/[^\/\\]+$/$logfile/;
    $cmd .= " > $lf";
  }
  #&Log("$cmd\n");
  if ($cmd) {`$cmd`;}
  if ($cwd) {chdir($cwd);}
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

sub escfile($) {
  my $n = shift;
  
  if ("$^O" =~ /MSWin32/i) {$n = "\"".$n."\"";}
  elsif ("$^O" =~ /linux/i) {$n =~ s/([ \(\)])/\\$1/g;}
  else {&Log("Please add file escape function for your platform.\n");}
  return $n;
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
