#!/usr/bin/perl
#usage EncryptTexts.pl MK MKS MKO useSecurityMod moduleVersion bibleTextEncryptionKey chromeCode.h modname1 modname2 ...

$MK = shift;
$MKS = shift;
$MKO = shift;

$usesecm = shift;
$version = shift;
$progkey = shift;
$codfile = shift;
$encryptedTexts = shift;
$log = "$MKS\\moduleDev\\module_log.txt";

require "$MK/build/script/shared.pl";

$encryptedTexts =~ s/(^\s*|\"|\s*$)//g;
@EncryptedTexts = split(/\s*,\s*/, $encryptedTexts);

&logit("\n\n------------------------------------------\nEncryptTexts.pl\n" . `date /T` . `time /T`);

if ($usesecm ne "true") {&logit("Cannot encrpyt texts without security module enabled."); die;}

# If the new key is different than the old key, then re-encrpyt the text(s).
while($EncryptedTexts[0]) {
  $mod = shift(@EncryptedTexts);
  $modlc = lc($mod);
   
  $tdir = &getSwordDir($modlc);
  if (!$tdir) {$tdir = "swordmk-mods";}
  
  # Read encryption codes of current texts
  $keyfile = "$MKS\\moduleDev\\".$tdir."\\keys.txt";
  open(INF, "<$keyfile");
  while(<INF>) {
    $_ =~ /(\S+):(\S+)/;
    $lastkeys{$2}=$1;
  }
  close(INF);
  
  # Read an updated chromCode.h file (generated by MK compiled with "DUMPCODES")
  # and save the keys for each of the texts.
  if (!open(INF, "<$codfile")) {&logit("Could not open $codfile.\n"); die;}
  while(<INF>) {
    $_ =~ /(\S+):$version:(\S+)/;
    $newkeys{$2}=$1;
  }
  close(INF);
  if (!open(KEYF, ">$keyfile")) {&logit("Could not open $keyfile.\n"); die;}
      
  if (!$newkeys{$mod}) {&logit("No key for $mod!\n"); die;}
  $key = $progkey . $newkeys{$mod};
  
  #Encrypt only if we need to...
  if (!$lastkeys{$mod} || $lastkeys{$mod} ne $key) {
    # get osis2mod version
    my $o2mv;
    my $outf = "$MK\\Cpp\\swordMK\\utilities\\bin\\osis2mod.out"; 
    `\"$MK\\Cpp\\swordMK\\utilities\\bin\\osis2mod.exe\" 2> \"$outf\"`;
    open(OUTF, "<$outf") || die "Could not open $outf\n";
    while(<OUTF>) {
      if ($_ =~ (/\$REV:\s*(\d+)\s*\$/i)) {
        $o2mv = $1; 
        last;
      }
    }
    close(OUTF);
    unlink($outf);
    
    &logit("\n--------------- ENCRYPTING MODULE $mod ---------------\n");
    $vsys = "KJV";
    $osis = "$MKS\\moduleDev\\".$tdir."\\$mod\\$mod.xml";
    $conf = "$MKS\\moduleDev\\".$tdir."\\mods.d\\$modlc.conf";
    $mdir = "$MKS\\moduleDev\\".$tdir."\\modules\\texts\\ztext\\$modlc";
    if (!open(VSYS, "<$conf")) {&logit("Conf file $conf not found."); die;}
    my %confInfo;
    while (<VSYS>) {
      if ($_ =~ /^\s*([^=]+)\s*=\s*(.*?)\s*$/) {$confInfo{$1} = $2;}
    }
    close(VSYS);
    if ($confInfo{"Versification"}) {$vsys = $confInfo{"Versification"};}
    if (!exists($confInfo{"CipherKey"}) || $vsys ne "KJV" || !exists($confInfo{"xulswordVersion"})) {
      if (!open(VSYS, ">>$conf")) {&logit("Conf file $conf could not write."); die;}
      print VSYS "\n";
      if (!exists($confInfo{"CipherKey"})) {print VSYS "CipherKey=\n";}
      if ($vsys ne "KJV") {
        my $msv = "1.6.1";
        if ($o2mv > 2478) {$msv = "1.6.2";}
        if (!exists($confInfo{"MinimumVersion"})) {print VSYS "MinimumVersion=$msv\n";}
        elsif ($confInfo{"MinimumVersion"} ne $msv) {&logit("ERROR: Conflicting MinimumVersion in $conf"); die;}
      }
      if (!exists($confInfo{"xulswordVersion"})) {
        print VSYS "xulswordVersion=".(exists($confInfo{"Version"}) ? $confInfo{"Version"}:"3.0")."\n";
      }
      close(VSYS);
    }

    # clean old module out
    if (-e $mdir) {`rmdir /Q /S \"$mdir\" >> \"$log\"`;}
    `mkdir \"$mdir\"`;
    
    # make encrypted module
    `\"$MK\\Cpp\\swordMK\\utilities\\bin\\osis2mod.exe\" \"$mdir\" \"$osis\" -N -v $vsys -z -c $key >> \"$log\"`;
  }
  else {&logit("$mod already encrypted to $key.\n");}
  print KEYF "$key:$mod\n";
  close(KEYF);
}

sub logit($) {
  my $l = shift;
  open(LOGF, ">>$log") || die "Could not open log file $log\n";
  print LOGF $l;
  close(LOGF);
}