#!/usr/bin/perl
#usage EncryptTexts.pl MK MKS MKO useSecurityMod moduleVersion bibleTextEncryptionKey currentKeys.txt chromeCode.h modname1 modname2 ...

$MK = shift;
$MKS = shift;
$MKO = shift;

$usesecm = shift;
$version = shift;
$progkey = shift;
$keyfile = shift;
$codfile = shift;
$encryptedTexts = shift;

$encryptedTexts =~ s/(^\s*|\"|\s*$)//g;
@EncryptedTexts = split(/\s*,\s*/, $encryptedTexts);

open(LOG, ">>$MKS/moduleDev/Out_EncryptTexts.txt") || die "Could not open Log file.";
$print = "\n\n------------------------------------------\n" . `date /T` . `time /T`; &Log;

# Read encryption codes of current texts
open(INF, "<$keyfile");
while(<INF>) {
  $_ =~ /(\S+):(\S+)/;
  $lastkeys{$2}=$1;
}
close(INF);

# If we are using the security module, then read an updated chromCode.h file 
# (generated by MK compiled with "DUMPCODES") and save the keys for each of the texts.
if ($usesecm eq "true") {
  if (!open(INF, "<$codfile")) {$print = "Could not open $codfile.\n"; &Log; &dienow;}
  while(<INF>) {
    $_ =~ /(\S+):$version:(\S+)/;
    $newkeys{$2}=$1;
  }
  close(INF);
  if (!open(OUTF, ">$keyfile")) {$print = "Could not open $keyfile.\n"; &Log; &dienow;}
}

# If the new key is different than the old key, then re-encrpyt the text(s).
if (!chdir("$MKS/moduleDev")) {$print = "Could not cd into \"$MKS/moduleDev\".\n"; &Log; &dienow;}
while($EncryptedTexts[0]) {
  $mod = shift(@EncryptedTexts);
  if ($usesecm ne "true") {$key = $progkey;}
  else {
    if (!$newkeys{$mod}) {$print = "No key for $mod!\n"; &Log; &dienow;}
    $key = $progkey . $newkeys{$mod};
  }
  
  #Encrypt only if we need to...
  if (!$lastkeys{$mod} || $lastkeys{$mod} ne $key) {
    $print = "\n--------------- ENCRYPTING MODULE $mod ---------------\n"; &Log;
    if (!chdir("$mod")) {$print = "Could not cd into \"$mod\".\n"; &Log; &dienow;}
    $osis = $mod . "_mk.xml";
    $conf = lc($mod) . ".conf";
    $vsys = "KJV";
    if (!(-e $osis)) {$print = "Osis file $osis not found."; &Log; &dienow;}
    if (!open(VSYS, "<$conf")) {$print = "Conf file $conf not found."; &Log; &dienow;}
    while (<VSYS>) {if ($_ =~ /Versification\s*=\s*EASTERN/) {$vsys="EASTERN";}}
    close(VSYS);
    
    $mpath = "$MKS\\moduleDev\\modules\\texts\\ztext\\".lc($mod);
    $dpath = "$MKS\\moduleDev";
    $cpath = "$MKS\\moduleDev\\mods.d";
    $bpath = "$MK\\Cpp\\swordMK\\utilities\\bin";
    
    `rmdir /S /Q \"$mpath\"`;
    `mkdir \"$mpath\"`;
    `mkdir \"$cpath\"`;
    
    $type1 = "type \"$dpath\\$mod\\$conf\" \"$MKS\\moduleDev\\conf\\zip.txt\" > \"$cpath\\$conf\"";
    $osis2mod = "\"$bpath\\osis2mod.exe\" \"$mpath\" \"$dpath\\$mod\\$osis\" -N -v $vsys -z -c $key";
    $mkfastmod = "\"$bpath\\mkfastmod.exe\" $mod";
    $type2 = "type \"$dpath\\$mod\\$conf\" \"$MKS\\moduleDev\\conf\\enc.txt\" > \"$cpath\\$conf\"";
    
    $print = $osis2mod; &Log; `$osis2mod`; # rub osis2mod
    if (!chdir("$MKS/moduleDev")) {$print = "Could not cd to \"$MKS/moduleDev\"."; &Log; &dienow;} # go to mod dir for mkfastmod to work
    $print = $type1; &Log; `$type1`; # write zip conf
    `echo CipherKey=$key >> \"$cpath\\$conf\"`; # append cipher key
    $print = $mkfastmod; &Log; `$mkfastmod`;  # now  we're in mod dir and mkfastmod has cipherkey
    `del \"$cpath\\$conf\"`; # just to make sure it's gone (it has cipher key in it!)
    $print = $type2; &Log; `$type2`; # write final conf file (without cipher key in it)
  }
  else {$print = "$mod already encrypted to $key.\n"; &Log;}
  print OUTF "$key:$mod\n";
}
close(OUTF);
close(LOG);

sub Log {
  if ($print !~ /\n$/) {$print = $print."\n";}
  print LOG $print;
  $print = "";
}
sub dienow {close(LOG); die;}
