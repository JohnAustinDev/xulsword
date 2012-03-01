#!/usr/bin/perl
#usage build.pl [build_settings.txt]

$Debug_skip_compile = 1;

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
  elsif ($_ =~ /^#/) {next;}
  elsif ($_ =~ /^Set\s+(\S+)\s*=\s*(.*?)\s*$/i) {
    my $var=$1; my $val=$2;
    if ($var =~ /^\(.*?\.js\)\:/) {$Prefs{$var} = $val;}
    else {$$1 = $2;}
  }
  else {&Log("ERROR: unhandled control file line $line: \"$_\"\n");}
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
&Log("----> Deleting \"$TRUNK/build-files/$Name\"\n");
if (-e "$TRUNK/build-files/$Name") {remove_tree("$TRUNK/build-files/$Name");}
create_path("$TRUNK/build-files/$Name");
$DEVELOPMENT="$TRUNK/build-files/$Name/development";
$INSTALLER="$TRUNK/build-files/$Name/installer";
$FFEXTENSION="$TRUNK/build-files/$Name/extension";
$PORTABLE="$TRUNK/build-files/$Name/portable";
if ("$^O" =~ /MSWin32/i) {$Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;}
else {&Log("ERROR: need to assign Linux application directory\n");}

&writeCompileDeps();

if ($MakeDevelopment =~ /true/i) {
  &Log("\n----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  make_path($DEVELOPMENT);
  &compileLibSword($DEVELOPMENT);
  my @manifest;
  &copyExtensionFiles($DEVELOPMENT, \@manifest, 1);
  &copyXulRunnerFiles($DEVELOPMENT);
  &writeAllPreferences($DEVELOPMENT, \%Prefs, 1);
  &writeApplicationINI($DEVELOPMENT);
  &compileStartup($DEVELOPMENT);
  &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
  &writeManifest(\@manifest, $DEVELOPMENT);
  &processLocales($IncludeLocales, "$DEVELOPMENT/defaults", "$Appdata/$Vendor/$Name/Profiles/*.default/extensions");
  &writeRunScript($Name, $DEVELOPMENT, "dev");
}
if ($MakeFFextension =~ /true/i) {
  &Log("\n----> BUILDING FIREFOX EXTENSION\n");
  make_path($FFEXTENSION);
  &compileLibSword($FFEXTENSION);
  my @manifest;
  &copyExtensionFiles($FFEXTENSION, \@manifest);
  &writeAllPreferences($FFEXTENSION, \%Prefs);
  &writeFFInstallFiles();
  &writeManifest(\@manifest, $FFEXTENSION);
}
if ($MakePortable =~ /true/i) {
  &Log("\n----> BUILDING PORTABLE VERSION\n");
  make_path("$PORTABLE/$Name");
  make_path("$PORTABLE/resources");
  make_path("$PORTABLE/profile");
  &compileLibSword("$PORTABLE/$Name");
  my @manifest;
  &copyExtensionFiles("$PORTABLE/$Name", \@manifest);
  &copyXulRunnerFiles("$PORTABLE/$Name");
  &writeAllPreferences("$PORTABLE/$Name", \%Prefs);
  &writeApplicationINI("$PORTABLE/$Name", 1);
  &compileStartup($PORTABLE);
  &includeModules($IncludeModules, \@ModRepos, "$PORTABLE/resoures", $IncludeSearchIndexes);
  &writeManifest(\@manifest, "$PORTABLE/$Name");
  &processLocales($IncludeLocales, "$PORTABLE/$Name/defaults", "$PORTABLE/profile/extensions");
  open(NIN, ">:encoding(UTF-8)", "$PORTABLE/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
  &createPortableZip($PORTABLE, "OutputDirectory/$Name-Portable-$Version/$Name Portable-$Version.zip");
  &writeRunScript($Name, $PORTABLE, "port");
}
if ($MakeSetup =~ /true/i) {
  if ($Target eq "Windows") {
    if (-e "$XulswordExtras/installer") {
      &Log("\n----> BUILDING SETUP INSTALLER\n");
      make_path($INSTALLER);
      &compileLibSword($INSTALLER);
      my @manifest;
      &copyExtensionFiles($INSTALLER, \@manifest);
      &copyXulRunnerFiles($INSTALLER);
      &writeAllPreferences($INSTALLER, \%Prefs);
      &writeApplicationINI($INSTALLER);
      &compileStartup($INSTALLER);
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/mods.d") {
        &Log("----> Deleting \"$Appdata/$Vendor/$Name/Profiles/resources/mods.d\"\n");
      }
      if (-e "$Appdata/$Vendor/$Name/Profiles/resources/modules") {
        &Log("----> Deleting \"$Appdata/$Vendor/$Name/Profiles/resources/modules\"\n");
      }
      &includeModules($IncludeModules, \@ModRepos, "$Appdata/$Vendor/$Name/Profiles/resources", $IncludeSearchIndexes);
      &writeManifest(\@manifest, $INSTALLER);
      &processLocales($IncludeLocales, "$INSTALLER/defaults", "$Appdata/$Vendor/$Name/Profiles/*.default/extensions");
      if (!-e "$XulswordExtras/installer/autogen") {mkdir "$XulswordExtras/installer/autogen";}
      &writeInstallerAppInfo("$XulswordExtras/installer/autogen/appinfo.iss");
      &writeInstallerLocaleinfo($IncludeLocales, "$XulswordExtras/installer/autogen/localeinfo.iss")
      &writeInstallerModuleUninstall($IncludeModules, $IncludeLocales, "$XulswordExtras/installer/autogen/uninstall.iss", "$Appdata/$Vendor/$Name/Profiles/resources");
      &createSetupInstaller("$INSTALLER/scriptProduction.iss");
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
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Release/appInfo.h") || die;
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
  if (!$CompiledAlready) {
    if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
      if (!$Debug_skip_compile) {
        if (!-e "$TRUNK/Cpp/cluceneMK/lib/Release/libclucene.lib") {
          chdir("$TRUNK/Cpp/cluceneMK/lib");
          `start "cluceneMK" /wait Compile.bat`;
        }
        if (!-e "$TRUNK/Cpp/swordMK/lib/Release/libsword.lib") {
          chdir("$TRUNK/Cpp/swordMK/lib");
          `start "swordMK" /wait Compile.bat`;
        }
        chdir("$TRUNK/Cpp");
        if ($UseSecurityModule =~ /true/i) {
          `start "xulsword" /wait Compile.bat`;
        }
        else {
          `start "xulsword" /wait Compile.bat NOSECURITY`;
        }
        if (!-e "$TRUNK/Cpp/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n");}
        elsif (!-e "$do/xulsword.dll") {
          copy("$TRUNK/Cpp/Release/xulsword.dll", $do);
          $CompiledAlready = 1;
        }
        chdir("$TRUNK/build");
      }
      else {copy("$TRUNK/Cpp/Release/xulsword.dll", $do);}
    }
    else {&Log("ERROR: Please make and call a compile script for your platform.\n");}
  }
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
    if ($fn eq "debug.js" && !$debug) {next;}
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

sub copyExtensionFiles($\@$) {
  my $do = shift;
  my $manifestP = shift;
  my $makeDevelopment = shift;

  &Log("----> Copying Firefox extension files.\n");
  &copy_dir("$TRUNK/xul/extension", $do, "\\.svn", "\\.svn");

  if ($makeDevelopment) {
    push(@{$manifestP}, "content xulsword file:../../../xul/xulsword/");
    push(@{$manifestP}, "locale xulsword en-US file:../../../xul/en-US.xs/en-US-xulsword/xulsword/");
    push(@{$manifestP}, "skin xulsword skin file:../../../xul/skin/");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/xulsword.jar!/");
    push(@{$manifestP}, "locale xulsword en-US jar:chrome/en-US.xs.jar!/xulsword/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");

    &Log("----> Creating JAR files.\n");
    &makeJAR("$do/chrome/xulsword.jar", "$TRUNK/xul/xulsword");
    &makeJAR("$do/chrome/en-US.xs.jar", "$TRUNK/xul/en-US.xs/en-US-xulsword");
    &makeJAR("$do/chrome/skin.jar", "$TRUNK/xul/skin");
  }
  push (@{$manifestP}, "override chrome://global/locale/printPageSetup.dtd chrome://xulsword/locale/printPageSetup.dtd");
  push (@{$manifestP}, "override chrome://global/content/printPageSetup.xul chrome://xulsword/content/xulrunner/global/printPageSetup.xul");
  push (@{$manifestP}, "override chrome://global/content/printPreviewBindings.xml chrome://xulsword/content/xulrunner/global/printPreviewBindings.xml");
  push (@{$manifestP}, "override chrome://global/content/printPreviewProgress.xul chrome://xulsword/content/xulrunner/global/printPreviewProgress.xul");
  push (@{$manifestP}, "override chrome://global/content/printProgress.xul chrome://xulsword/content/xulrunner/global/printProgress.xul");
  push (@{$manifestP}, "override chrome://global/content/bindings/tree.xml chrome://xulsword/content/xulrunner/global/bindings/tree.xml");
  push (@{$manifestP}, "override chrome://mozapps/content/handling/dialog.xul chrome://xulsword/content/xulrunner/mozapps/handling/dialog.xul");
}

sub copyXulRunnerFiles($) {
  my $do = shift;
  &Log("----> Copying xulrunner files.\n");
  copy_dir("$TRUNK/xulrunner", $do, "xulrunner\-stub\.exe", "");
  move("$do/xulrunner.exe", "$do/$Xsprocess");
}

sub writeApplicationINI($$) {
  my $do = shift;
  my $isPortable = shift;

  &Log("----> Writing application.ini.\n");
  @d = localtime(time);
  $BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);
  if ($isPortable) {$BuildID .= "P";}
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "BuildID=$BuildID\n\n";
  print INI "[Gecko]\n";
  print INI "MinVersion=$GeckoMinVersion\n";
  print INI "MaxVersion=$GeckoMaxVersion\n";
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
      #if ($di =~ /\$/) {$di =~ s/\\/\//g; print "HERE-> $di\n"; $di = eval($di);}
      $di =~ s/(\$\w+)/my $e=$1; $e=eval($e)/eg;
      $path = "$di/mods.d/".lc($mod).".conf";
      if (-e $path) {last;}
    }
    if (!-e $path) {&Log("ERROR: could not locate conf for module $mod\n"); next;}
    if (!$Conf{$mod}{"DataPath"}) {&getInfoFromConf($path);}
    if (!$Conf{$mod}{"DataPath"}) {&Log("ERROR: could not read conf file $path\n"); next;}
    my $mpath = $path;
    $mpath =~ s/mods\.d[\\\/][^\\\/]*$//;
    $mpath .= $Conf{$mod}{"DataPath"};
    if (!-e $mpath) {&Log("ERROR: module $mod files not found in $mpath.\n"); next;}
    if ($includeIndexes && !-e "$mpath/lucene") {&Log("ERROR: search index requested but is not available.\n");}
    my $dfilter = ($includeIndexes ? "":"lucene");
    my $confd = "$do/mods.d/".lc($mod).".conf";
    my $modfd = "$do/".$Conf{$mod}{"DataPath"};
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

  if (!$Debug_skip_compile) {
    &Log("----> Compiling startup stub.\n");
    remove_tree("$TRUNK/Cpp/$rd/Release");
    chdir("$TRUNK/Cpp/$rd");
    `start "$rd" /wait Compile.bat`;
    chdir("$TRUNK/build");
  }
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
  if ($modules) {$newInstalls .= ";".join(";", @modules);}

  open(OUTF, ">:encopding(UTF-8)", $of) || die;
  print OUTF "SaveStringToFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\newInstalls.txt'), '$newInstalls', False);\n";
  foreach my $mod (@modules) {
    &getInfoFromConf("$md/mods.d/".lc($mod).".conf");
    print OUTF "DelTree(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\".$Conf{$mod}{"DataPath"}."'), True, True, True);\n";
    print OUTF "DeleteFile(ExpandConstant('{userappdata}\\{#MyPublisher}\\{#MyAppName}\\Profiles\\resources\\mods.d\\".lc($mod).".conf'));\n";
  }
  close(OUTF);
}

sub createSetupInstaller($) {
  my $is = shift;
  my $id = $is;
  
  &Log("----> Creating Windows setup installer.\n");
  
  $is =~ s/[\\\/][^\\\/]+$//;
  if (!-e $is) {&Log("ERROR: installer script $is not found.\n"); return;}
  chdir($id);
  `"%ProgramFiles%\Inno Setup 5\ISCC.exe" "$is" > "$INSTALLER\autogen\setuplog.txt"`;
  chdir("$TRUNK/build");
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
      print SCR "`$Name.exe -console -jsconsole`;\n";
    }
    elsif ($type eq "port") {
      print SCR "`\"$PORTABLE\\$Name.exe\"`;\n";
    }
    elsif ($type eq "setup") {
      &writeWindowsRegistryScript();
      print SCR "`\"$INSTALLER\\$Name.exe\"`;\n";
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

sub createLocaleExtension($$) {
  &Log("WARNING: createLocaleExtension is not yet implemented\n");
}

