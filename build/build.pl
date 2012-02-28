#!/usr/bin/perl

# Portable version differences: Append "P" to BuildID. Different executable.

#usage build.pl [build_settings.txt]

use File::Spec;
$TRUNK = File::Spec->rel2abs( __FILE__ );
$TRUNK =~ s/[\\\/]build[\\\/][^\\\/]+$//;
require "$TRUNK/build/script/common.pl";

&Log("----> Reading control file.\n");
$SETTING = shift;
if (!$SETTING) {$SETTING = "build_settings.txt";}
if (!-e $SETTING) {&Log("Build control file \"$SETTING\" not found.\n"); exit;}
open(SETF, "<:encoding(UTF-8)", $SETTING) || die;
$line = 0;
while(<SETF>) {
  $line++;
  if ($_ =~ /^\s*$/) {next;}
  elsif ($_ =~ /^#/) {next;}
  elsif ($_ =~ /^Set\s+(\S+)\s*=\s*(.*?)\s*$/i) {
    my $var=$1; my $val=$2;
    if ($var =~ s/^Pref//) {$Prefs{$var} = $val;}
    else {$$1 = $2;}
  }
  else {&Log("ERROR: unhandled control file line $line: \"$_\"\n");}
}
close(SETF);
$Xsprocess = $Executable;
$Xsprocess =~ s/\.exe$/-srv.exe/i;

&Log("----> Checking file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if ($ModuleRepository =~ /^\./) {
  $ModuleRepository = File::Spec->rel2abs($ModuleRepository);
}
if (!-e $OutputDirectory) {
  print "Create output directory \"$OutputDirectory\"?: [y/n]\n";
  my $ans = <>;
  if ($ans !~ /^y$/i) {exit;}
  make_path($OutputDirectory);
}
if (!-e $ModuleRepository) {
  &Log("WARNING: module repository does not exist: \"$ModuleRepository\"\n");
}

&Log("----> Copying files.\n");
if (-e "$TRUNK/$Name") {remove_tree("$TRUNK/$Name");}
mkdir("$TRUNK/$Name");
$EXTENSION = "$TRUNK/$Name/extension";
&copy_dir("$TRUNK/xul/xulrunnerDevAndProd/xulrunner", $EXTENSION, "\\.svn", "\\.svn");
$XULRUNNER = "$TRUNK/$Name/xulrunner";
&copy_dir("$TRUNK/xulrunner", $XULRUNNER);

&Log("----> Writing preferences.\n");
open(PREF, ">:encoding(UTF-8)", "$EXTENSION/defaults/pref/prefs.js") || die;
print PREF "pref(\"toolkit.defaultChromeURI\", \"chrome://xulsword/content/$StartWindow\");\n";
close(PREF);

open(PREF, ">:encoding(UTF-8)", "$EXTENSION/defaults/pref/language.js") || die;
print PREF "pref(\"general.useragent.locale\", \"$DefaultLanguage\");\n";
close(PREF);

open(PREF, ">:encoding(UTF-8)", "$EXTENSION/defaults/pref/buildprefs.js") || die;
foreach $p (sort keys %Prefs) {
  if (!$Prefs{$p}) {next;}
  my $q = '"';
  if ($Prefs{$p} =~ s/^.*?(true|false).*?$/my $b=$1; $b=lc($b);/ie) {$q = "";}
  if ($p =~ /^HiddenTexts/) {$Prefs{$p} =~ s/,/\;/; $Prefs{$p} =~ s/\s+//; $Prefs{$p}.=";"}
  print PREF "pref(\"xulsword.$p\", $q".$Prefs{$p}."$q);\n";
}
close(PREF);

&Log("----> Writing application.ini.\n");
@d = localtime(time);
$BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);
open(INI, ">:encoding(UTF-8)", "$XULRUNNER/application.ini") || die;
print INI "[App]\n";
print INI "Vendor=$Vendor\n";
print INI "Name=$Name\n";
print INI "Version=$Version\n";
print INI "BuildID=$BuildID\n\n";
print INI "[Gecko]\n";
print INI "MinVersion=$GeckoMinVersion\n";
print INI "MaxVersion=$GeckoMaxVersion\n";
close(INI);

if ("$^O" =~ /MSWin32/i) {$Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;}
else {$Appdata = "";} # Need Linux
if (-e "$XulswordExtras/installer" && $Target eq "Windows") {
  &Log("----> Writing installer script.\n");
  if (!-e "$XulswordExtras/installer/autogen") {mkdir "$XulswordExtras/installer/autogen";}
  open (ISS, ">:encoding(UTF-8)", "$XulswordExtras/installer/autogen/appinfo.iss") || die;
  print ISS "#define MyAppName \"$Name\"\n";
  print ISS "#define MyAppExeName \"$Executable\"\n";
  print ISS "#define MyPublisher \"$Vendor\"\n";
  print ISS "#define MyDecimalVersion \"$Version\"\n";
  print ISS "#define MyVersion \"$Version\"\n";
  print ISS "#define securitymod \"$UseSecurityModule\"\n";
  print ISS "#define HebrewFont \"$IncludeHebrewFont\"\n";
  print ISS "#define MK \"$TRUNK\"\n";
  print ISS "#define MKS \"$XulswordExtras\"\n";
  print ISS "#define MKO \"$OutputDirectory\"\n";
  print ISS "#define APPDATA \"$Appdata\"\n";
  close(ISS);
}

&Log("----> Writing application info for C++ compiler.\n");
if (!-e "$TRUNK/Cpp/Release") {mkdir "$TRUNK/Cpp/Release";}
open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Release/appInfo.h") || die;
print INFO "#define PATH_TO_PROGRAM L\"%s\\\\$Executable\"\n";
print INFO "#define PORTABLE_DIR L\".\\\\$Name\"\n";
print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
print INFO "#define PROC_NAME L\"$Xsprocess\"\n";
close(INFO);

if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
  &Log("----> Writing Windows registry script.\n");
  if (!-e "$TRUNK/build/autogen") {mkdir "$TRUNK/build/autogen";}
  open (REG, ">:encoding(UTF-8)", "$TRUNK/build/autogen/setRegistry.reg") || die;
  my $id = "$OutputDirectory/toCDROM/Install/setup"; $id =~ s/[\\\/]/\\\\/g;
  my $rd = "$TRUNK/xulrunner"; $rd =~ s/[\\\/]/\\\\/g;
  my $ad = "$OutputDirectory/audio"; $ad =~ s/[\\\/]/\\\\/g;
  print REG "Windows Registry Editor Version 5.00\n";
  print REG "[HKEY_LOCAL_MACHINE\\SOFTWARE\\$Vendor\\$Name]\n";
  print REG "\"InstallDrive\"=\"$id\"\n";
  print REG "\"RunDir\"=\"$rd\"\n";
  print REG "\"AudioDir\"=\"$ad\"\n";
  print REG "\"Version\"=\"$Version\"\n";
  close(REG);
}
