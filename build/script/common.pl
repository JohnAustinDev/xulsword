use Encode;
use File::Copy "cp", "mv";
use File::Path qw(make_path remove_tree);
use File::Compare;

# read settings files
sub readSettingsFiles(\%$) {
  my $prefsP = shift;
  my $saveFiles = shift;
  
  my $f = $SETTING;
  
  if (!$f || -d $f) {$f = "$TRUNK/build/build_settings.txt";}
  &readSettings("$TRUNK/build/build_prefs.txt", $prefsP, $saveFiles);
  &readSettings($f, $prefsP, $saveFiles);
  if ("$^O" !~ /MSWin32/i) {
	$MicrosoftSDK = "";
	$MicrosoftVS = "";
	$XULRunner = ("$^O" =~ /darwin/i ? "../XUL.framework":"../xulrunner");
  }
  if ($UseSecurityModule ne "true") {$KeyGenPath = "";}
  
  # Normalize paths, and check that required paths exist.
  @PathNames = ("CluceneSource", "SwordSource", "ModuleRepository1", "ModuleRepository2", "XulswordExtras", "XULRunner", "MicrosoftSDK", "MicrosoftVS", "FirstRunXSM", "KeyGenPath");
  foreach my $path (@PathNames) {
  	if ($$path =~ /^\./) {$$path = File::Spec->rel2abs($$path, "$TRUNK/build");}
  	if ($path !~ /^ModuleRepository/ && $$path && !-e $$path) {
  		&Log("ERROR: $path, file \"$$path\" does not exist.");
  		die;
  	}
  }
}

sub readSettings($\%$) {
  my $f = shift;
  my $prefsP = shift;
  my $saveFiles = shift;
  
  if (!-e $f) {&Log("Build control file \"$f\" not found.\n"); exit;}
  &Log("----> Reading control file: \"$f\".\n");
  open(SETF, "<:encoding(UTF-8)", $f) || die;
  $line = 0;
  while(<SETF>) {
    $line++;
    if ($_ =~ /^\s*$/) {next;}
    elsif ($_ =~ /^(\:\:|rem|\#)/i) {next;}
    elsif ($_ =~ /^Set\s+(.*?)\s*=\s*(.*?)\s*$/i) {
      my $var=$1; my $val=$2;
      if ($var =~ /^\(.*?\.js\)\:/) {$prefsP->{$var} = $val;}
      elsif ($saveFiles) {$$1 = $2;}
    }
    else {&Log("WARNING: unhandled control file line $line: \"$_\"\n");}
  }
  close(SETF);
}

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
  elsif ("$^O" =~ /(linux|darwin)/i) {
    my $cmd = "cp -p ".&escfile($if)." ".&escfile($of);
    `$cmd`;
  }
}

# removes all contents of the specified directory without removing the directory itself
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

# zips $di (may be directory or file) into file $zf
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
  }
  elsif ("$^O" =~ /(linux|darwin)/i) {
    $cwd = `echo $PWD`; $cwd =~ s/\s*$//;
    my $dip = $di;
    $dip =~ s/\/([^\/]*)$//;
    $d = $1;
    if (!$d || $d =~ /^\s*\*\s*$/) {$d = "*";}
    chdir($dip);
    # linux zip default adds and updates
    $cmd = "zip -r ".&escfile($zf)." ".$d." -x '*/.svn/*'";  
  }
  else {
    &Log("ERROR: Please update common.pl->makeZIP() to include your platform.\n");
  }
  
  if ($cmd && $logfile) {
    my $lf = $zf;
    $lf =~ s/[^\/\\]+$/$logfile/;
    $cmd .= " > \"$lf\"";
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
  elsif ("$^O" =~ /(linux|darwin)/i) {$n =~ s/([ \(\)])/\\$1/g;}
  else {&Log("Please add file escape function for your platform.\n");}
  return $n;
}

sub get_SVN_rev() {
  # Get our current revision number
  my $rev;
  if ("$^O" =~ /MSWin32/i) {
    $rev = "SubWCRev \"".__FILE__."\" 2>&1";
    $rev = `$rev`;
    if ($rev && $rev =~ /^Updated to revision\s*(\d+)\s*$/mi) {$rev = $1;}
    else {$rev = "";} 
  }
  else {
    $rev = "svn info ".__FILE__." 2>&1";
    $rev = `$rev`;
    if ($rev && $rev =~ /^Revision:\s*(\d+)\s*$/mi) {$rev = $1;}
    else {$rev = "";}
  }
  
  return $rev;
}

sub get_GIT_rev() {
  # Get our current fake "revision" number, which is just the number of commits in master Git branch.
  # The following allows matching this back to a real git commit:
  # ~/.gitconfig: [alias]\n\t show-rev-number = !sh -c 'git rev-list --reverse HEAD | awk NR==$0'
  my $rev;
  if ("$^O" =~ /MSWin32/i) {
    `git rev-list HEAD > list.txt`;
    $rev = `Find /V /C "" < list.txt`;
    `del list.txt`; 
  }
  else {
    my $d = (-e "/vagrant/" ? "/vagrant":"$TRUNK");
    $rev = `git --git-dir "$d/.git" rev-list HEAD | wc -l 2>&1`;
  }
  
  return $rev;
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  if ($p =~ /error/i) {$p = "\n$p\n";}
  if ((!$NOCONSOLELOG && $h!=-1) || !$LOGFILE || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
  if ($LOGFILE && $h!=2) {
    open(LOGF, ">>:encoding(UTF-8)", $LOGFILE) || die "Could not open log file \"$LOGFILE\"\n";
    print LOGF $p;
    close(LOGF);
  }
}

1;
