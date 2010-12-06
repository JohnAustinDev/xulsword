#!/usr/bin/perl

# NOTE: these functions must have globals $MK and $MKS defined before they will work!

# Updates the "minMKVersion" and "xulswordVersion" of each conf file in the dir.
# If "minMKVersion" already exists then it is not changed (because it is specific
# to each module). But "xulswordVersion" is always updated (because it depends on
# other elements in the xulSword module).
sub updateConfInfo($$$) {
  my $dir = shift;
  my $mpvfxsm = shift;
  my $xsmv = shift;
  
  if ($xsmv eq "" || $xsmv < 2.10) {$xsmv = 2.10;}
  opendir(CONF, "$MKS/moduleDev/$dir/mods.d");
  @confs = readdir(CONF);
  close(CONF);
  foreach $conf (@confs) {
    open(TMP, ">$MKS/moduleDev/$dir/tmp.conf");
    open(INC, "<$MKS/moduleDev/$dir/mods.d/$conf");
    $hasXSMversion = "false";
    $hasMinProgversionForXSM = "false";
    my $versification = "";
    while(<INC>) {
      if ($_ =~ /^\s*Versification\s*=\s*(.*)\s*$/) {$versification = $1;}
      if ($versification ne "" && $versification ne "EASTERN") {
        if ($mpvfxsm eq "" || $mpvfxsm < 2.13) {$mpvfxsm = 2.13;}
      }
      else {
        if ($mpvfxsm eq "" || $mpvfxsm < 2.7) {$mpvfxsm = 2.7;}
      }
      if ($_ =~ s/^\s*(xulswordVersion\s*=\s*).*$/$1$xsmv/) {$hasXSMversion = "true";}
      if ($_ =~ /^\s*(minMKVersion\s*=\s*).*$/) {$hasMinProgversionForXSM = "true"};
      print TMP $_;
    }
    close(INC);
    if ($hasXSMversion eq "false") {print TMP "\nxulswordVersion=$xsmv\n";}
    if ($hasMinProgversionForXSM eq "false") {print TMP "minMKVersion=$mpvfxsm\n";}
    close(TMP);
    unlink(INC);
    rename("$MKS/moduleDev/$dir/tmp.conf", "$MKS/moduleDev/$dir/mods.d/$conf");
  }
}

sub copyModulesTo($@$$) {
  my $modpath = shift;
  my $listptr = shift;
  my $includeIndexes = shift;
  my $dest = shift;
  
  my $keyfile = "$MKS\\moduleDev\\swordmk-mods\\keys.txt";

  # Copy modules to destination, handle indexes properly
  foreach $mod (@{$listptr}) {
    my $modlc = lc($mod);
    my $dir = &getSwordDir($modlc);
    if ($dir eq "") {next;}
    my $log = "$MKS\\moduleDev\\$dir\\module_log.txt";

    chdir("$MKS\\moduleDev\\$dir"); # so that mkfastmod will work!

    if ($includeIndexes eq "true") {
      print "Creating search index in $modpath for $mod...\n";
      &logit("Creating search index in $modpath for $mod...\n", $log);
      if (-e "$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc\\lucene") {`rmdir /Q /S \"$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc\\lucene\"`;}
      $mykey="";
      if ($dir eq "swordmk-mods") {
        open(INF, "<$keyfile") || die "Could not open $keyfile\n";
        while(<INF>) {if ($_ =~ /^(.*):$mod$/) {$mykey = $1;}}
        close(INF);
      }
      if ($mykey ne "") {&setCipher("$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf", $mykey, $dir);}
      `\"$MK\\Cpp\\swordMK\\utilities\\bin\\mkfastmod.exe\" $mod >> \"$log\"`;
      if ($mykey ne "") {&setCipher("$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf", "", $dir);}
    }
    if (!-e "$dest\\mods.d") {`mkdir "$dest\\mods.d"`;}
    `copy \"$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf\" \"$dest\\mods.d\"`;
    `xcopy \"$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc\" \"$dest\\modules\\$modpath\\$modlc\" /S /Y /I`;
    if ($includeIndexes ne "true" && -e "$dest\\modules\\$modpath\\$modlc\\lucene") {`rmdir /S /Q \"$dest\\modules\\$modpath\\$modlc\\lucene\"`;}
  }
}

sub setCipher($$$) {
  my $c = shift;
  my $k = shift;
  my $d = shift;
  
  open(TMP, ">$MKS\\moduleDev\\$d\\tmp.xml") || die "Could not open $MKS\\moduleDev\\$d\\tmp.xml\n";
  open(CONF, "<$c") || die "Could not open $c\n";
  $haskey = "false";
  while(<CONF>) {
    if ($_ =~ s/^\s*CipherKey\s*=.*$/CipherKey=$k/) {$haskey = "true";}
    print TMP $_;
  }
  if ($haskey eq "false") {print TMP "CipherKey=$k\n";}
  close(CONF);
  close(TMP);
  unlink($c);
  rename ("$MKS\\moduleDev\\$d\\tmp.xml", $c);
}

sub getSwordDir($) {
  my $mod = shift;
  my $mdir = "";
  if (-e "$MKS\\moduleDev\\swordmk-mods\\mods.d\\$mod.conf") {$mdir = "swordmk-mods";}
  elsif (-e "$MKS\\moduleDev\\sword-mods\\mods.d\\$mod.conf") {$mdir = "sword-mods";}
  else {&logit("Could not locate module $mod for copying.", $log);}
  return $mdir;
}

sub logit($$) {
  my $l = shift;
  my $lf = shift;
  
  open(LOGF, ">>$lf") || die "Could not open log file $lf\n";
  print LOGF $l;
  close(LOGF);
}

1;