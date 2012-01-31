#!/usr/bin/perl
use File::Copy;
use File::Path qw(make_path remove_tree);

# NOTE: these functions must have globals $MK and $MKS defined before they will work!

# Updates the "minMKVersion" and "xulswordVersion" of each conf file in the dir.
sub updateConfInfo($$$$) {
  my $dir = shift;
  my $mpvfxsm = shift;
  my $xsmv = shift;
  my $thisModOnly = shift;

  my $msg = "";
  
  if ($xsmv eq "" || $xsmv < 2.10) {$xsmv = 2.10;}
  opendir(CONF, "$dir/mods.d");
  @confs = readdir(CONF);
  close(CONF);
  foreach $conf (@confs) {
    if ($conf =~ /^\.+$/ || -d "$dir/mods.d/$conf") {next;}
    if ($thisModOnly ne "" && $conf ne lc($thisModOnly).".conf") {next;}
    
    my %confInfo;
    my $pvxsm;
    open(INC, "<$dir/mods.d/$conf");
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
    open(INC, "<$dir/mods.d/$conf");
    open(TMP, ">$dir/tmp.conf");
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
    rename("$dir/tmp.conf", "$dir/mods.d/$conf");
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
  
  my $keyfile = "$MKS\\moduleDev\\keys.txt";

  # Copy modules to destination, handle indexes properly
  foreach $mod (@{$listptr}) {
    my $modlc = lc($mod);
    my $dir = &getSwordDir($mod);
    if ($dir eq "") {next;}

    chdir($dir); # so that mkfastmod will work!
    if (! -e "$dir\\modules\\$modpath\\$modlc") {&logit("ERROR: Skipping $dir\\modules\\$modpath\\$modlc. Module directory does not exist\n"); next;}
    &logit("    $dir\\modules\\$modpath\\$modlc - COPYING\n");

    if ($includeIndexes eq "true") {
      &logit("    $dir\\modules\\$modpath\\$modlc\\lucene - CREATING SEARCH INDEX\n");
      if (-e "$dir\\modules\\$modpath\\$modlc\\lucene") {`rmdir /Q /S \"$dir\\modules\\$modpath\\$modlc\\lucene\"`;}
      $mykey="";
      open(INF, "<$keyfile") || die "Could not open $keyfile\n";
      while(<INF>) {if ($_ =~ /^(.*):$mod$/) {$mykey = $1;}}
      close(INF);
      if ($mykey ne "") {&setCipher("$dir\\mods.d\\$modlc.conf", $mykey);}
      `\"$MK\\Cpp\\swordMK\\utilities\\bin\\mkfastmod.exe\" $mod >> \"$LOG\"`;
      if ($mykey ne "") {&setCipher("$dir\\mods.d\\$modlc.conf", "");}
    }
    if (!-e "$dest\\mods.d") {`mkdir "$dest\\mods.d"`;}
    `copy \"$dir\\mods.d\\$modlc.conf\" \"$dest\\mods.d\"`;
    `xcopy \"$dir\\modules\\$modpath\\$modlc\" \"$dest\\modules\\$modpath\\$modlc\" /S /Y /I`;
    if ($includeIndexes ne "true" && -e "$dest\\modules\\$modpath\\$modlc\\lucene") {`rmdir /S /Q \"$dest\\modules\\$modpath\\$modlc\\lucene\"`;}
  }
}

sub setCipher($$) {
  my $c = shift;
  my $k = shift;
  
  my $d = "$c.tmp";
  open(TMP, ">$d") || die "Could not open $d\n";
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
  rename ($d, $c);
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
  
  my @paths;
  push (@paths, "$MKS\\moduleDev\\swordmk-mods\\mods.d\\".lc($mod).".conf");
  push (@paths, "$MKS\\moduleDev\\sword-mods\\mods.d\\".lc($mod).".conf");
  for (my $i=0; $i<@paths; $i++) {
    if (-e $paths[$i]) {
      $mdir = $paths[$i];
      $mdir =~ s/\\mods\.d.*?$//;
    }
  }
  if (!$mdir) {
    &logit("ERROR: Skipping $mod. Could not locate conf file, looked:\n");
    for (my $i=0; $i<@paths; $i++) {&logit("    ".$paths[$i]."\n");}
  }
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

# copies a directory to a non existing destination directory
sub copy_dir($$) {
  my $id = shift;
  my $od = shift;

  if (!-e $id || !-d $id) {
    &Log("ERROR copy_dir: Source does not exist or is not a direcory: $id\n");
    return 0;
  }
  if (-e $od) {
    &Log("ERROR copy_dir: Destination already exists: $od\n");
    return 0;
  }

  opendir(DIR, $id) || die "Could not open dir $id\n";
  my @fs = readdir(DIR);
  closedir(DIR);
  make_path($od);

  for(my $i=0; $i < @fs; $i++) {
    if ($fs[$i] =~ /^\.+$/) {next;}
    my $if = "$id/".$fs[$i];
    my $of = "$od/".$fs[$i];
    if (-d $if) {&copy_dir($if, $of);}
    else {copy($if, $of);}
  }
  return 1;
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