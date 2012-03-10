#!/usr/bin/perl
#usage build.pl [build_settings.txt]

$Debug_debug_prefs = 0;  # add debug prefs to all builds (not just the development build)

use File::Spec;
$TRUNK = File::Spec->rel2abs( __FILE__ );
$TRUNK =~ s/[\\\/]build[\\\/][^\\\/]+$//;
$TRUNK =~ s/\\/\//g;
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
  elsif ($_ =~ /^(\:\:|rem|\#)/i) {next;}
  elsif ($_ =~ /^Set\s+(\S+)\s*=\s*(.*?)\s*$/i) {
    my $var=$1; my $val=$2;
    if ($var =~ /^\(.*?\.js\)\:/) {$Prefs{$var} = $val;}
    else {$$1 = $2;}
  }
  else {&Log("WARNING: unhandled control file line $line: \"$_\"\n");}
}
close(SETF);
$Xsprocess = $Executable;
$Xsprocess =~ s/\.exe$/-srv.exe/i;
@ModRepos = ($ModuleRepository1, $ModuleRepository2);

&Log("----> Getting file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if (!-e $OutputDirectory) {make_path($OutputDirectory);}
if (!-e "$TRUNK/build-files/$Name") {make_path("$TRUNK/build-files/$Name");}
$DEVELOPMENT="$TRUNK/build-files/$Name/development";
$INSTALLER="$TRUNK/build-files/$Name/installer";
$FFEXTENSION="$TRUNK/build-files/$Name/extension";
$PORTABLE="$TRUNK/build-files/$Name/portable/$Name";
if ("$^O" =~ /MSWin32/i) {$Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;}
else {&Log("ERROR: need to assign Linux application directory\n");}

&writeCompileDeps();

if ($MakeDevelopment =~ /true/i) {
  &Log("\n----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  if (-e $DEVELOPMENT) {remove_tree($DEVELOPMENT);}
  make_path($DEVELOPMENT);
  &compileLibSword($DEVELOPMENT);
  my @manifest;
  &copyExtensionFiles($DEVELOPMENT, \@manifest, 1);
  &copyXulRunnerFiles($DEVELOPMENT);
  &writeAllPreferences($DEVELOPMENT, \%Prefs, 1);
  &writeApplicationINI($DEVELOPMENT);
  &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
  &writeManifest(\@manifest, $DEVELOPMENT);
  &processLocales($IncludeLocales, "$DEVELOPMENT/defaults", "$Appdata/$Vendor/$Name/Profiles/*.default/extensions");
  &writeRunScript($Name, $DEVELOPMENT, "dev");
}
if ($MakeFFextension =~ /true/i) {
  &Log("\n----> BUILDING FIREFOX EXTENSION\n");
  if (-e $FFEXTENSION) {remove_tree($FFEXTENSION);}
  make_path($FFEXTENSION);
  &compileLibSword($FFEXTENSION);
  my @manifest;
  push(@manifest, "overlay chrome://browser/content/browser.xul chrome://xulsword/content/extension-overlay.xul");
  &copyExtensionFiles($FFEXTENSION, \@manifest, 0, 1);
  &writeAllPreferences($FFEXTENSION, \%Prefs);
  &writeManifest(\@manifest, $FFEXTENSION);
  &packageFFExtension($FFEXTENSION, "$OutputDirectory/$Name-Extension-$Version/$Name Extension-$Version.xpi");
}
if ($MakePortable =~ /true/i) {
  &Log("\n----> BUILDING PORTABLE VERSION\n");
  if (-e $PORTABLE) {remove_tree($PORTABLE);}
  make_path("$PORTABLE/$Name");
  make_path("$PORTABLE/resources");
  make_path("$PORTABLE/profile");
  &compileLibSword("$PORTABLE/$Name");
  my @manifest;
  &copyExtensionFiles("$PORTABLE/$Name", \@manifest);
  &copyXulRunnerFiles("$PORTABLE/$Name");
  &writeAllPreferences("$PORTABLE/$Name", \%Prefs);
  &writeApplicationINI("$PORTABLE/$Name", "P");
  &compileStartup($PORTABLE);
  &includeModules($IncludeModules, \@ModRepos, "$PORTABLE/resources", $IncludeSearchIndexes);
  &writeManifest(\@manifest, "$PORTABLE/$Name");
  &processLocales($IncludeLocales, "$PORTABLE/$Name/defaults", "$PORTABLE/profile/extensions");
  open(NIN, ">:encoding(UTF-8)", "$PORTABLE/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
  &packagePortable($PORTABLE, "$OutputDirectory/$Name-Portable-$Version/$Name Portable-$Version.zip");
  &writeRunScript($Name, $PORTABLE, "port");
}
if ($MakeSetup =~ /true/i) {
  if ($Target eq "Windows") {
    if (-e "$XulswordExtras/installer") {
      &Log("\n----> BUILDING SETUP INSTALLER\n");
      if (-e $INSTALLER) {remove_tree($INSTALLER);}
      make_path($INSTALLER);
      &compileLibSword($INSTALLER);
      my @manifest;
      &copyExtensionFiles($INSTALLER, \@manifest);
      &copyXulRunnerFiles($INSTALLER);
      &writeAllPreferences($INSTALLER, \%Prefs);
      &writeApplicationINI($INSTALLER);
      &compileStartup($INSTALLER);
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/mods.d") {
        &Log("----> Deleting ...resources/mods.d\n");
        remove_tree("$Appdata/$Vendor/$Name/Profiles/resources/mods.d");
      }
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/modules") {
        &Log("----> Deleting ...resources/modules\n");
        remove_tree("$Appdata/$Vendor/$Name/Profiles/resources/modules");
      }
      &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
      &writeManifest(\@manifest, $INSTALLER);
      &processLocales($IncludeLocales, "$INSTALLER/defaults", "$Appdata/$Vendor/$Name/Profiles/*.default/extensions");
      if (!-e "$XulswordExtras/installer/autogen") {mkdir "$XulswordExtras/installer/autogen";}
      &writeInstallerAppInfo("$XulswordExtras/installer/autogen/appinfo.iss");
      &writeInstallerLocaleinfo($IncludeLocales, "$XulswordExtras/installer/autogen/localeinfo.iss")
      &writeInstallerModuleUninstall($IncludeModules, $IncludeLocales, "$XulswordExtras/installer/autogen/uninstall.iss", "$Appdata/$Vendor/$Name/Profiles/resources");
      &packageSetupInstaller("$XulswordExtras/installer/scriptProduction.iss");
      &writeRunScript($Name, $PORTABLE, "setup");
    }
    else {&Log("ERROR: the Inno Setup 5 installer script is missing.\n");}
  }
  else {&Log("ERROR: the installer has not yet been implemented for your platform.\n");}
}

&Log("FINISHED BUILDING\n");
print "Press enter to close...\n";
$p = <>;

################################################################################
################################################################################
sub writeCompileDeps() {
  &Log("----> Writing application info for C++ compiler.\n");
  if (!-e "$TRUNK/Cpp/Release") {mkdir "$TRUNK/Cpp/Release";}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/appInfo.h") || die;
  print INFO "#define PATH_TO_PROGRAM L\"%s\\\\$Executable\"\n";
  print INFO "#define PORTABLE_DIR L\".\\\\$Name\"\n";
  print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
  print INFO "#define PROC_NAME L\"$Xsprocess\"\n";
  close(INFO);

  &Log("----> Writing path info for C++ compiler.\n");
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Versions.bat") || die;
    print INFO "Set clucene=$CluceneSource\n";
    print INFO "Set sword=$SwordSource\n";
    print INFO "Set microsoftsdk=$MicrosoftSDK\n";
    print INFO "Set Name=$Name\n";
    close(INFO);
  }
  else {&Log("ERROR: you need to pass path information to the compile script of your platform.\n");}
}

sub compileLibSword($) {
  my $do = shift;
  &Log("----> Compiling libsword binary.\n");
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    if (!$CompiledAlready) {
      if (!-e "$TRUNK/Cpp/cluceneMK/lib/Release/libclucene.lib") {
        chdir("$TRUNK/Cpp/cluceneMK/lib");
        `call Compile.bat`;
      }
      if (!-e "$TRUNK/Cpp/swordMK/lib/Release/libsword.lib") {
        chdir("$TRUNK/Cpp/swordMK/lib");
        `call Compile.bat`;
      }
      chdir("$TRUNK/Cpp");
      if ($UseSecurityModule =~ /true/i) {
        `call Compile.bat`;
      }
      else {
        `start "xulsword" /wait Compile.bat NOSECURITY`;
      }
      if (!-e "$TRUNK/Cpp/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n"); die;}

      copy("$TRUNK/Cpp/Release/xulsword.dll", $do);
      $CompiledAlready = 1;

      chdir("$TRUNK/build");
    }
    else {copy("$TRUNK/Cpp/Release/xulsword.dll", $do);}
  }
  else {&Log("ERROR: Please make and call a compile script for your platform.\n");}
}

sub writeAllPreferences($\%$) {
  my $do = shift;
  my $pP = shift;
  my $debug = shift;

  &Log("----> Writing preferences.\n");

  foreach my $p (sort keys %{$pP}) {
    if (!$pP->{$p}) {next;}
    my $pref = $p;
    if ($pref !~ s/^\((.*?)\)\://) {&Log("ERROR: malformed pref entry \"$pref\"\n"); next;}
    my $fn = $1;
    if (!$Debug_debug_prefs && $fn eq "debug.js" && !$debug) {next;}
    my $pfile = "$do/defaults/pref/$fn";
    my $mode = ($prefFiles{$pfile} ? ">>":">").":encoding(UTF-8)";
    open(PREF, $mode, $pfile) || die "Could not open pref file \"$pfile\"\n";
    my $q = '"';
    if ($pP->{$p} =~ s/^.*?(true|false).*?$/my $b=$1; $b=lc($b);/ie) {$q = "";}
    if ($pref =~ /^HiddenTexts/) {$pP->{$p} =~ s/,/\;/; $pP->{$p} =~ s/\s+//; $pP->{$p}.=";"}
    print PREF "pref(\"$pref\", $q".$pP->{$p}."$q);\n";
    close(PREF);
    $prefFiles{$pfile}++;
  }
}

sub copyExtensionFiles($\@$$) {
  my $do = shift;
  my $manifestP = shift;
  my $makeDevelopment = shift;
  my $isFFextension = shift;

  &Log("----> Copying Firefox extension files.\n");
  my $skip = "(\\.svn".($isFFextension ? "":"|install.rdf").")";
  &copy_dir("$TRUNK/xul/extension", $do, "", $skip);
  
  if (opendir(COMP, "$do/components")) {
    my @comps = readdir(COMP);
    close(COMP);
    foreach my $comp (@comps) {
      if ($comp =~ /\.manifest$/i) {
        push(@{$manifestP}, "manifest components/$comp");
      }
    }
  }

  if ($makeDevelopment) {
    push(@{$manifestP}, "content xulsword file:../../../xul/content/");
    push(@{$manifestP}, "locale xulsword en-US file:../../../xul/locale/en-US/");
    push(@{$manifestP}, "skin xulsword skin file:../../../xul/skin/");
    push(@{$manifestP}, "content xsglobal file:../../../xul/content/global/");
    push(@{$manifestP}, "locale xsglobal en-US file:../../../xul/locale/en-US/global/");
    push(@{$manifestP}, "skin xsglobal skin file:../../../xul/skin/global/");
    push(@{$manifestP}, "content xsmozapps file:../../../xul/content/mozapps/");
    push(@{$manifestP}, "locale xsmozapps en-US file:../../../xul/locale/en-US/mozapps/");
    push(@{$manifestP}, "skin xsmozapps skin file:../../../xul/skin/mozapps/");
    push(@{$manifestP}, "locale branding en-US file:../../../xul/locale/branding/");
    push(@{$manifestP}, "content branding file:../../../xul/content/branding/");
    push(@{$manifestP}, "overlay chrome://xulsword/content/xulsword.xul chrome://xulsword/content/debug-overlay.xul");
    &copy_dir("$TRUNK/xul/distribution", "$do/distribution");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/content.jar!/");
    push(@{$manifestP}, "locale xulsword en-US jar:chrome/en-US.jar!/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");
    push(@{$manifestP}, "content xsglobal jar:chrome/content.jar!/global/");
    push(@{$manifestP}, "locale xsglobal en-US jar:chrome/en-US.jar!/global/");
    push(@{$manifestP}, "skin xsglobal skin jar:chrome/skin.jar!/global/");
    push(@{$manifestP}, "content xsmozapps jar:chrome/content.jar!/mozapps/");
    push(@{$manifestP}, "locale xsmozapps en-US jar:chrome/en-US.jar!/mozapps/");
    push(@{$manifestP}, "skin xsmozapps skin jar:chrome/skin.jar!/mozapps/");
    push(@{$manifestP}, "locale branding en-US jar:chrome/en-US.jar!/branding/");
    push(@{$manifestP}, "content branding jar:chrome/content.jar!/branding/");

    &Log("----> Creating JAR files.\n");
    &makeJAR("$do/chrome/content.jar", "$TRUNK/xul/content");
    &makeJAR("$do/chrome/en-US.jar", "$TRUNK/xul/locale/en-US");
    &makeJAR("$do/chrome/skin.jar", "$TRUNK/xul/skin");
  }

}

sub copyXulRunnerFiles($) {
  my $do = shift;
  &Log("----> Copying xulrunner files.\n");
  copy_dir("$TRUNK/xulrunner", $do, "", "xulrunner\-stub\.exe");
  move("$do/xulrunner.exe", "$do/$Xsprocess");
}

sub writeApplicationINI($$) {
  my $do = shift;
  my $buildTypeID = shift;

  &Log("----> Writing application.ini.\n");
  @d = localtime(time);
  $BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);
  $BuildID .= $buildTypeID;
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "ID=xulsword\@xulsword.org\n";
  print INI "BuildID=$BuildID\n\n";
  print INI "[Gecko]\n";
  print INI "MinVersion=$GeckoMinVersion\n";
  print INI "MaxVersion=$GeckoMaxVersion\n\n";
  print INI "[XRE]\n";
  print INI "EnableExtensionManager=1\n";
  close(INI);
}

sub includeModules($\@$$) {
  my @modules = split(/\s*,\s*/, shift);
  my $repsP = shift;
  my $do = shift;
  my $includeIndexes = shift;
  
  $includeIndexes = ($includeIndexes=~/true/i ? 1:0);

  my $path;
  foreach my $mod (@modules) {
    foreach my $di (@{$repsP}) {
      $di =~ s/(\$\w+)/my $e=$1; $e=eval($e)/eg;
      $path = "$di/mods.d/".lc($mod).".conf";
      if (-e $path) {last;}
    }
    if (!-e $path) {&Log("ERROR: could not locate conf for module $mod\n"); next;}
    undef(%conf);
    &getInfoFromConf($path, \%conf);
    if (!$conf{"DataPath"}) {&Log("ERROR: could not read conf file $path\n"); next;}
    my $mpath = $path;
    $mpath =~ s/mods\.d[\\\/][^\\\/]*$//;
    $mpath .= $conf{"DataPath"};
    if (!-e $mpath) {&Log("ERROR: module $mod files not found in $mpath.\n"); next;}
    if ($includeIndexes && !-e "$mpath/lucene") {&Log("ERROR: search index requested but is not available.\n");}
    my $dfilter = ($includeIndexes ? "":"lucene");
    my $confmd = "$do/mods.d";
    if (!-e $confmd) {make_path($confmd);}
    my $confd = "$confmd/".lc($mod).".conf";
    my $modfd = "$do/".$conf{"DataPath"};
    if (-e $confd) {unlink($confd);}
    if ($modfd =~ /modules/ && -e $modfd) {remove_tree($modfd);}
    copy_dir($mpath, $modfd, "", $dfilter);
    copy($path, $confd);
  }
}

sub writeManifest(\@$) {
  my $maP = shift;
  my $od = shift;
  
  open(MAN, ">>:encoding(UTF-8)", "$od/chrome.manifest") || die "Could not open chrome manifest \"$od/chrome.manifest\"\n";
  opendir(CHROME, "$od/chrome") || die "Could not open chrome directory \"$od/chrome\"\n";
  @files = readdir(CHROME);
  closedir(CHROME);
  foreach my $file (@files) {
    if ($file =~ /\.manifest/) {print MAN "manifest chrome/$file\n";}
  }
  foreach my $e (@{$maP}) {print MAN "$e\n";}
  close(MAN);
}


sub compileStartup($) {
  my $do = shift;
  my $rd;
  if ($do eq $PORTABLE)  {$rd = "runPortable";}
  else {$rd = "runMK";}

  &Log("----> Compiling startup stub.\n");
  remove_tree("$TRUNK/Cpp/$rd/Release");
  chdir("$TRUNK/Cpp/$rd");
  `call Compile.bat`;
  chdir("$TRUNK/build");

  copy("$TRUNK/Cpp/$rd/Release/$rd.exe", "$do/$Executable");
}

sub writeInstallerAppInfo($) {
  my $of = shift;
  &Log("----> Writing installer application info script.\n");
  open (ISS, ">:encoding(UTF-8)", $of) || die;
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

sub writeInstallerLocaleinfo($$) {
  my @locales = split(/\s*,\s*/, shift);
  my $of = shift;
  &Log("----> Writing installer locale script.\n");
  open(OUTF, ">:encoding(UTF-8)", $of) || die;
  # this script use to write =false for all possible locales (needed??)
  foreach my $locale (@locales) {
    my $pl = $locale; $pl =~ s/-//g; # iss defines can't use "-"
    print OUTF "#define $pl \"true\"\n";
  }
  close(OUTF);
}

sub writeInstallerModuleUninstall($$$$) {
  my @modules = split(/\s*,\s*/, shift);
  my @locales = split(/\s*,\s*/, shift);
  my $of = shift;
  my $md = shift;
  &Log("----> Writing installer uninstall script.\n");
  my $newInstalls = "NewLocales;"; # don't list any locales- language menu should not open after setup install
  $newInstalls .= "NewModules";
  if (@modules) {$newInstalls .= ";".join(";", @modules);}

  open(OUTF, ">:encoding(UTF-8)", $of) || die;
  print OUTF "SaveStringToFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\newInstalls.txt'), '$newInstalls', False);\n";
  foreach my $mod (@modules) {
    undef(%conf);
    &getInfoFromConf("$md/mods.d/".lc($mod).".conf", \%conf);
    print OUTF "DelTree(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\".$conf{"DataPath"}."'), True, True, True);\n";
    print OUTF "DeleteFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\mods.d\\".lc($mod).".conf'));\n";
  }
  close(OUTF);
}

sub writeRunScript($$$) {
  my $name = shift;
  my $rd = shift;
  my $type = shift;

  &Log("----> Writing run script.\n");

  my $s = "./run_$name-$type.pl";

  if ($Target eq "Windows") {
    open(SCR, ">:encoding(UTF-8)", $s) || die;
    print SCR "#!/usr/bin/perl\n";
    if ($type eq "dev") {
      print SCR "chdir(\"".$DEVELOPMENT."\");\n";
      print SCR "`start /wait $Name-srv.exe --app application.ini -jsconsole -console`;\n";
    }
    elsif ($type eq "port") {
      print SCR "chdir(\"".$PORTABLE."\");\n";
      print SCR "`$Name.exe`;\n";
    }
    elsif ($type eq "setup") {
      &writeWindowsRegistryScript();
      print SCR "`\"$INSTALLER/$Name.exe\"`;\n";
    }
    close(SCR);
  }
  else {&Log("ERROR: no run scripts yet for your platform\n");}
}

sub writeWindowsRegistryScript() {
  &Log("----> Writing Windows registry script.\n");
  if (!-e "$TRUNK/build/autogen") {mkdir "$TRUNK/build/autogen";}
  open (REG, ">:encoding(UTF-8)", "$TRUNK/build/autogen/setRegistry.reg") || die;
  my $id = "$OutputDirectory/toCDROM/Install/setup"; $id =~ s/[\\\/]/\\\\/g;
  my $rd = "$INSTALLER"; $rd =~ s/[\\\/]/\\\\/g;
  my $ad = "$OutputDirectory/audio"; $ad =~ s/[\\\/]/\\\\/g;
  print REG "Windows Registry Editor Version 5.00\n";
  print REG "[HKEY_LOCAL_MACHINE\\SOFTWARE\\$Vendor\\$Name]\n";
  print REG "\"InstallDrive\"=\"$id\"\n";
  print REG "\"RunDir\"=\"$rd\"\n";
  print REG "\"AudioDir\"=\"$ad\"\n";
  print REG "\"Version\"=\"$Version\"\n";
}

sub processLocales($$$) {
  my @locales = split(/\s*,\s*/, shift);
  my $rdf = shift;
  my $extdir = shift;
  
  &Log("----> Creating Locale extensions.\n");
  foreach my $loc (@locales) {
    if ($loc eq "en-US") {next;}
    &createLocaleExtension($loc, $extdir);
    copy("$XulswordExtras/localeDev/$loc/$loc.rdf", $rdf);
  }
}

sub packageSetupInstaller($) {
  my $is = shift;

  &Log("----> Creating Windows setup installer.\n");

  my $id = $is;
  $id =~ s/[\\\/][^\\\/]+$//;
  if (!-e $is) {&Log("ERROR: installer script $is not found.\n"); return;}

  my $resdir = "$OutputDirectory/$Name-Setup-$Version";
  if (!-e $resdir) {make_path($resdir);}

  chdir($id);
  `"%ProgramFiles%/Inno Setup 5/ISCC.exe" "$is" > "$resdir/file_log.txt"`;
  chdir("$TRUNK/build");
}

sub packagePortable($$) {
  my $id = shift;
  my $of = shift;
  my $od = $of;
  $od =~ s/[\\\/][^\\\/]+$//;
  if (!-e $od) {make_path($od);}
  if ($Target eq "Windows") {
    &Log("----> Making portable package.\n");
    unlink($of);
    `7za a -tzip "$of" -r "$id\*" > "$OutputDirectory/$Name-Portable-$Version/file_log.txt"`;
  }
  else {&Log("ERROR: packagePortable not yet implemented on this platform.\n");}
}

sub packageFFExtension($$) {
  my $id = shift;
  my $of = shift;
  &Log("----> Making extension xpt package.\n");
  my $od = $of;
  $od =~ s/[\\\/][^\\\/]+$//;
  if (!-e $od) {make_path($od);}
  
  unlink($of);
  `7za a -tzip "$of" -r "$id/*" > "$OutputDirectory/$Name-Extension-$Version/file_log.txt"`;
}


sub createLocaleExtension($$) {
  &Log("WARNING: createLocaleExtension is not yet implemented\n");
}

