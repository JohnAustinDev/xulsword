#!/usr/bin/perl

# NOTE: these functions must have globals $MK and $MKS defined before they will work!

# Updates the "minMKVersion" and "xulswordVersion" of each conf file in the dir.
sub updateConfInfo($$$$) {
  my $dir = shift;
  my $mpvfxsm = shift;
  my $xsmv = shift;
  my $thisModOnly = shift;

  my $msg = "";
  
  if ($xsmv eq "" || $xsmv < 2.10) {$xsmv = 2.10;}
  opendir(CONF, "$MKS/moduleDev/$dir/mods.d");
  @confs = readdir(CONF);
  close(CONF);
  foreach $conf (@confs) {
    if ($conf =~ /^\.+$/ || -d "$MKS/moduleDev/$dir/mods.d/$conf") {next;}
    if ($thisModOnly ne "" && $conf ne lc($thisModOnly).".conf") {next;}
    
    my %confInfo;
    my $pvxsm;
    open(INC, "<$MKS/moduleDev/$dir/mods.d/$conf");
    while(<INC>) {
      if ($_ =~ /^\s*([^=]+)\s*=\s*(.*?)\s*$/) {$confInfo{$1} = $2;}
    }
    close(INC);
    if ($confInfo{"Versification"} eq "Synodal" && $confInfo{"MinimumVersion"} =~ /(\d+)\.(\d+)\.(\d+)/) {
      if ($1>1 || ($1==1 && $2>6) || ($1==1 && $2==6 && $3>1)) {$pvxsm = 2.21;}
      else {$pvxsm = 2.13;}
    }
    elsif ($confInfo{"Versification"} && $confInfo{"Versification"} ne "EASTERN") {$pvxsm = 2.13;}
    else {$pvxsm = 2.7;}

    # if passed $mpvfxsm is greater than pvxsm, then use it, otherwise ignore it
    if (!$mpvfxsm) {$mpvfxsm = $pvxsm;}
    else {
      $mpvfxsm =~ /(\d+)\.(\d+)\.(\d+)/;
      my $v0p=$1;
      my $v1p=$2;
      my $v2p=$3;
      $pvxsm =~ /(\d+)\.(\d+)\.(\d+)/;
      my $v0=$1;
      my $v1=$2;
      my $v2=$3;
      if ($v0>$v0p || ($v0==$v0p && $v1>$v1p) || ($v0==$v0p && $v1==$v1p && $v2>$v2p)) {$mpvfxsm = $pvxsm;}
    }
    
    $hasXSMversion = "false";
    $hasMinProgversionForXSM = "false";
    open(INC, "<$MKS/moduleDev/$dir/mods.d/$conf");
    open(TMP, ">$MKS/moduleDev/$dir/tmp.conf");
    while(<INC>) {
      if ($_ =~ s/^\s*(xulswordVersion\s*=\s*).*$/$1$xsmv/) {$hasXSMversion = "true";}
      if ($_ =~ s/^\s*(minMKVersion\s*=\s*).*$/$1$mpvfxsm/) {$hasMinProgversionForXSM = "true"};
      print TMP $_;
    }
    if ($hasXSMversion eq "false") {print TMP "\nxulswordVersion=$xsmv\n";}
    if ($hasMinProgversionForXSM eq "false") {print TMP "minMKVersion=$mpvfxsm\n";}
    close(TMP);
    close(INC);    
    unlink(INC);
    rename("$MKS/moduleDev/$dir/tmp.conf", "$MKS/moduleDev/$dir/mods.d/$conf");
    $msg = $msg."    $dir\\$conf: xulswordVersion=$xsmv, minMKVersion=$mpvfxsm\n";
  }
  if ($msg eq "") {&logit("ERROR: Did not update any conf file in $dir\n")}
  else {&logit("$msg");}
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

    chdir("$MKS\\moduleDev\\$dir"); # so that mkfastmod will work!
    if (! -e "$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc") {&logit("ERROR: Skipping $MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc. Module directory does not exist\n"); next;}
    &logit("    $dir\\modules\\$modpath\\$modlc - COPYING\n");

    if ($includeIndexes eq "true") {
      &logit("    $dir\\modules\\$modpath\\$modlc\\lucene - CREATING SEARCH INDEX\n");
      if (-e "$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc\\lucene") {`rmdir /Q /S \"$MKS\\moduleDev\\$dir\\modules\\$modpath\\$modlc\\lucene\"`;}
      $mykey="";
      if ($dir eq "swordmk-mods") {
        open(INF, "<$keyfile") || die "Could not open $keyfile\n";
        while(<INF>) {if ($_ =~ /^(.*):$mod$/) {$mykey = $1;}}
        close(INF);
      }
      if ($mykey ne "") {&setCipher("$MKS\\moduleDev\\$dir\\mods.d\\$modlc.conf", $mykey, $dir);}
      `\"$MK\\Cpp\\swordMK\\utilities\\bin\\mkfastmod.exe\" $mod >> \"$LOG\"`;
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

sub updateAppinfo($\@) {
  my $appinfo = shift;
  my $changesP = shift;
  `copy /Y \"$MKS\\build\\Appinfo.bat\" \"$MKS\\build\\Appinfo.bat.save\"`;
  open(INF, "<$MKS\\build\\Appinfo.bat.save") || die "Could not open $MKS\\build\\Appinfo.bat.save\n";
  open(OUTF, ">$MKS\\build\\Appinfo.bat") || die "Could not open $MKS\\build\\Appinfo.bat\n";
  while(<INF>) {
    for ($i=0; $i<@{$changesP}; $i++) {
      if (@{$changesP}[$i] !~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {die "Bad Appinfo data\n";}
      my $var = $1;
      my $val = $2;
      if ($_ =~ s/^\s*(Set|set|SET)\s+($var)\s*=.*$/$1 $2=$val/) {last;}
    }
    print OUTF $_;
  }
  close(INF);
  close(OUTF);
}

sub getSwordDir($) {
  my $mod = shift;
  my $mdir = "";
  if (-e "$MKS\\moduleDev\\swordmk-mods\\mods.d\\$mod.conf") {$mdir = "swordmk-mods";}
  elsif (-e "$MKS\\moduleDev\\sword-mods\\mods.d\\$mod.conf") {$mdir = "sword-mods";}
  else {&logit("ERROR: Skipping $mod. Could not locate conf file in swordmk-mods or sword-mods.");}
  return $mdir;
}

sub getPathOfType($) {
  my $t = shift;
  my $p = "texts\\ztext";
  if ($t eq "commentary")    {$p = "comments\\zcom";}
  elsif ($t eq "genbook")    {$p = "genbook\\rawgenbook";}
  elsif ($t eq "dictionary") {$p = "lexdict\\rawld";}
  elsif ($t eq "devotional") {$p = "lexdict\\rawld\\devotionals";}
  return $p;
}

sub logit($) {
  my $p = shift;
  
  print $p;
  if ($LOG eq "") {$LOG = "$MKS\\moduleDev\\module_log.txt";}
  open(LOGF, ">>$LOG") || die "Could not open log file $LOG\n";
  print LOGF $p;
  close(LOGF);
}

1;