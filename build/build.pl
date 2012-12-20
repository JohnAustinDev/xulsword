#!/usr/bin/perl
#usage build.pl [build_settings.txt]

$Debug_debug_prefs = 0;  # 1 = add debug prefs to all builds (not just the development build)

use File::Spec;
$TRUNK = File::Spec->rel2abs( __FILE__ );
$TRUNK =~ s/[\\\/]build[\\\/][^\\\/]+$//;
$TRUNK =~ s/\\/\//g;
$LOGFILE = File::Spec->rel2abs( __FILE__ );
$LOGFILE .= "_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}
require "$TRUNK/build/script/common.pl";

$SETTING = shift;
if (!$SETTING) {$SETTING = "build_settings.txt";}
&readSettings("build_prefs.txt");
&readSettings($SETTING);

if ("$^O" =~ /MSWin32/i) {$EXE = ".exe"; $DLL = ".dll";}
elsif ("$^O" =~ /linux/i) {$EXE = ""; $DLL = ".so";}
else {"ERROR: Please provide file extensions for your platform.\n";}
$Xsprocess = $Executable;
$Xsprocess .= "-srv$EXE";
$Executable .= $EXE;
@ModRepos = ($ModuleRepository1, $ModuleRepository2);

&Log("----> Getting file paths.\n");
if ($OutputDirectory =~ /^\./) {
  $OutputDirectory = File::Spec->rel2abs($OutputDirectory);
}
if (!-e $OutputDirectory) {make_path($OutputDirectory);}
if (!-e "$TRUNK/build-files/$Name") {make_path("$TRUNK/build-files/$Name");}
$DEVELOPMENT="$TRUNK/build-files/$Name/development";
$INSTALLER="$TRUNK/build-files/$Name/installer";
$FFEXTENSION="$TRUNK/build-files/$Name/xulsword\@xulsword.org";
$PORTABLE="$TRUNK/build-files/$Name/portable/$Name";
if ("$^O" =~ /MSWin32/i) {
  $Appdata = `Set APPDATA`; $Appdata =~ s/APPDATA=(.*?)\s*$/$1/i;
  $RESOURCES = "$Appdata/$Vendor/$Name/Profiles/resources";
}
elsif ("$^O" =~ /linux/i) {
  $Appdata = `echo \$HOME`; $Appdata =~ s/^\s*(.*?)\s*$/$1/;
  $RESOURCES = "$Appdata/.".lc($Vendor)."/".lc($Name)."/resources";
}
else {&Log("ERROR: Please add assignment to application directory of your platform\n");}
@d = localtime(time);
$BuildID = sprintf("%02d%02d%02d", ($d[5]%100), ($d[4]+1), $d[3]);

&writeCompileDeps();

# DEVELOPMENT ENVIRONMENT
if ($MakeDevelopment =~ /true/i) {
  &Log("\n----> BUILDING DEVELOPMENT ENVIRONMENT\n");
  if (-e $DEVELOPMENT) {&cleanDir($DEVELOPMENT);}
  else {make_path($DEVELOPMENT);}
  &compileLibSword($DEVELOPMENT);
  my @manifest;
  &copyExtensionFiles($DEVELOPMENT, \@manifest, $IncludeLocales, 1);
  if ("$^O" =~ /MSWin32/i) {&copyXulRunnerFiles($DEVELOPMENT);}
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  &writePreferences($DEVELOPMENT, \%Prefs, 1);
  &writeApplicationINI($DEVELOPMENT);
  &includeModules($IncludeModules, \@ModRepos, $RESOURCES, $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $DEVELOPMENT, 1);
  &writeManifest(\@manifest, $DEVELOPMENT);
  &writeRunScript($Name, $DEVELOPMENT, "dev");
}

# FIREFOX EXTENSION
if ($MakeFFextension =~ /true/i) {
  &Log("\n----> BUILDING FIREFOX EXTENSION\n");
  if (-e $FFEXTENSION) {&cleanDir($FFEXTENSION);}
  else {make_path($FFEXTENSION);}
  &compileLibSword($FFEXTENSION, 1);
  my @manifest;
  push(@manifest, "overlay chrome://browser/content/browser.xul chrome://xulsword/content/startup/extension-overlay.xul");
  &copyExtensionFiles($FFEXTENSION, \@manifest, $IncludeLocales, 0, 1);
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "";
  $Prefs{"(prefs.js):xulsword.DontShowExceptionDialog"} = "true";
  $Prefs{"(language.js):general.useragent.locale"} = ""; # default takes precendence after each startup in Firefox!
  &writePreferences($FFEXTENSION, \%Prefs);
  &includeModules($IncludeModules, \@ModRepos, "$FFEXTENSION/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $FFEXTENSION, 1);
  &writeManifest(\@manifest, $FFEXTENSION);
  &writeInstallManifest($FFEXTENSION);
  &packageFFExtension("$FFEXTENSION/*", "$OutputDirectory/$Name-Extension-$Version");
}

# PORTABLE VERSION
if ($MakePortable =~ /true/i) {
  &Log("\n----> BUILDING PORTABLE VERSION\n");
  if ("$^O" !~ /MSWin32/i) {&Log("ERROR: Portable has not been implemented for your platform yet.\n"); die;}
  if (-e $PORTABLE) {&cleanDir($PORTABLE);}
  else {make_path("$PORTABLE");}
  make_path("$PORTABLE/$Name");
  make_path("$PORTABLE/resources");
  make_path("$PORTABLE/profile");
  &compileLibSword("$PORTABLE/$Name", 1);
  my @manifest;
  &copyExtensionFiles("$PORTABLE/$Name", \@manifest, $IncludeLocales);
  &copyXulRunnerFiles("$PORTABLE/$Name");
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  &writePreferences("$PORTABLE/$Name", \%Prefs);
  &writeApplicationINI("$PORTABLE/$Name", "P");
  &compileStartup($PORTABLE);
  &includeModules($IncludeModules, \@ModRepos, "$PORTABLE/resources", $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, "$PORTABLE/$Name", 0);
  &writeManifest(\@manifest, "$PORTABLE/$Name");
  open(NIN, ">:encoding(UTF-8)", "$PORTABLE/resources/newInstalls.txt") || die;
  print NIN "NewLocales;en-US\n"; # this opens language menu on first run
  close(NIN);
  &packagePortable("$PORTABLE/*", "$OutputDirectory/$Name-Portable-$Version");
  &writeRunScript($Name, $PORTABLE, "port");
}

# WINDOWS INSTALLER VERSION
if ($MakeSetup =~ /true/i) {
  &Log("\n----> BUILDING PROGRAM INSTALLER\n");
  if (-e $INSTALLER) {&cleanDir($INSTALLER);}
  else {make_path($INSTALLER);}
  &compileLibSword($INSTALLER);
  my @manifest;
  &copyExtensionFiles($INSTALLER, \@manifest, $IncludeLocales);
  &copyXulRunnerFiles($INSTALLER);
  $Prefs{"(prefs.js):toolkit.defaultChromeURI"} = "chrome://xulsword/content/startup/splash.xul";
  &writePreferences($INSTALLER, \%Prefs);
  &writeApplicationINI($INSTALLER);
  &compileStartup($INSTALLER);
  if (-e "$RESOURCES/mods.d") {
    &Log("----> Deleting ...resources/mods.d\n");
    remove_tree("$RESOURCES/mods.d");
  }
  if (-e "$RESOURCES/modules") {
    &Log("----> Deleting ...resources/modules\n");
    remove_tree("$RESOURCES/modules");
  }
  &includeModules($IncludeModules, \@ModRepos, $RESOURCES, $IncludeSearchIndexes);
  &processLocales($IncludeLocales, \@manifest, $INSTALLER, 0);
  &writeManifest(\@manifest, $INSTALLER);
  &writeRunScript($Name, $INSTALLER, "install");

  if ("$^O" =~ /MSWin32/i) {
    if (!-e "$XulswordExtras/installer/autogen") {make_path("$XulswordExtras/installer/autogen");}
    &writeInstallerAppInfo("$XulswordExtras/installer/autogen/appinfo.iss");
    &writeInstallerLocaleinfo($IncludeLocales, "$XulswordExtras/installer/autogen/localeinfo.iss")
    &writeInstallerModuleUninstall($IncludeModules, $IncludeLocales, "$XulswordExtras/installer/autogen/uninstall.iss", $RESOURCES);
    &packageWindowsSetup("$XulswordExtras/installer/scriptProduction.iss");
  }
  else {&Log("ERROR: Please add an installer creator script for your platform.\n");}
}

&Log("FINISHED BUILDING\n");
print "Press enter to close...\n";
$p = <>;

################################################################################
################################################################################

sub writeCompileDeps() {
  if ($UseSecurityModule =~ /true/i) {
    if (!-e $KeyGenPath) {
      &Log("ERROR: You cannot use the security module without supplying a key generator. (UseSecurityModule=true, KeyGenPath=???)\n");
      die;
    }
  }
  
  &Log("----> Writing application info for C++ compiler.\n");
  if (!-e "$TRUNK/Cpp/Release") {mkdir "$TRUNK/Cpp/Release";}
  open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/src/include/appInfo.h") || die;
  print INFO "#define PATH_TO_PROGRAM L\"%s\\\\$Executable\"\n";
  print INFO "#define PORTABLE_DIR L\".\\\\$Name\"\n";
  print INFO "#define KEYADDRESS L\"Software\\\\$Vendor\\\\$Name\"\n";
  print INFO "#define PROC_NAME L\"$Xsprocess\"\n";
  if ($UseSecurityModule =~ /true/i) {
    print INFO "#ifdef _XULSECURITY_\n";
    print INFO "#  include \"$KeyGenPath\"\n";
    print INFO "#endif\n";
  }
  close(INFO);
  
  &Log("----> Writing path info for C++ compiler.\n");
  if ("$^O" =~ /MSWin32/i) {
    if (!-e $SwordSource) {&Log("ERROR: No SWORD source code.\n"); die;}
    if (!-e $CluceneSource) {&Log("ERROR: No Clucene source code.\n"); die;}
    if (!-e $MicrosoftSDK) {&Log("ERROR: No Microsoft SDK.\n"); die;}
    open(INFO, ">:encoding(UTF-8)", "$TRUNK/Cpp/Versions.bat") || die;
    print INFO "Set clucene=$CluceneSource\n";
    print INFO "Set sword=$SwordSource\n";
    print INFO "Set microsoftsdk=$MicrosoftSDK\n";
    print INFO "Set Name=$Name\n";
    close(INFO);
  }
  elsif ("$^O" =~ /linux/i) {
  
  }
  else {&Log("ERROR: Please add pre-compile script for your platform.\n");}
}

sub compileLibSword($) {
  my $do = shift;
  my $useStaticLib = shift;
  &Log("----> Compiling libsword binary.\n");
  if ("$^O" =~ /MSWin32/i) {
    if (!$CompiledAlready) {
      if (!-e "$TRUNK/Cpp/cluceneMK/lib/Release/libclucene.lib") {
        chdir("$TRUNK/Cpp/cluceneMK/lib");
        `call Compile.bat >> $LOGFILE`;
      }
      if (!-e "$TRUNK/Cpp/swordMK/lib/Release/libsword.lib") {
        chdir("$TRUNK/Cpp/swordMK/lib");
        `call Compile.bat >> $LOGFILE`;
      }
      chdir("$TRUNK/Cpp");
      if ($UseSecurityModule =~ /true/i) {
        `call Compile.bat >> $LOGFILE`;
      }
      else {
        `call Compile.bat NOSECURITY >> $LOGFILE`;
      }
      if (!-e "$TRUNK/Cpp/Release/xulsword.dll") {&Log("ERROR: libsword did not compile.\n"); die;}
    }
    &copy_file("$TRUNK/Cpp/Release/xulsword.dll", $do);
  }
  elsif ("$^O" =~ /linux/i) {
    if (!$CompiledAlready) {
      chdir("$TRUNK/Cpp");
      if (!-e "$TRUNK/Cpp/Makefile.in") {
        `./autogen.sh >> $LOGFILE 2>&1`;
        `./configure >> $LOGFILE 2>&1`;
      }
      `make clean >> $LOGFILE 2>&1`;
      `make >> $LOGFILE 2>&1`;
      `./staticlib.sh >> $LOGFILE 2>&1`;
      if (!-e "$TRUNK/Cpp/.libs/libxulsword.so") {&Log("ERROR: libxulsword did not compile.\n"); die;}
    }
    if (!$useStaticLib) {&copy_file("$TRUNK/Cpp/.libs/libxulsword.so", $do);}
    else {
      &copy_file("$TRUNK/Cpp/.libs/libxulswordstatic.so", $do);
      mv("$do/libxulswordstatic.so", "$do/libxulsword.so");
    }
  }
  else {&Log("ERROR: Please add a compile script for your platform.\n");}
  
  $CompiledAlready = 1;
  chdir("$TRUNK/build");
}

sub writePreferences($\%$) {
  my $do = shift;
  my $pP = shift;
  my $debug = shift;

  &Log("----> Writing preferences.\n");
  
  $pP->{"(prefs.js):xulsword.Vendor"} = $Vendor;
  $pP->{"(prefs.js):xulsword.Name"} = $Name;
  $pP->{"(prefs.js):xulsword.Version"} = $Version;
  $pP->{"(prefs.js):xulsword.BuildID"} = $BuildID;
  
  foreach my $p (sort keys %{$pP}) {
    if (!$pP->{$p}) {next;}
    my $pref = $p;
    if ($pref !~ s/^\((.*?)\)\://) {&Log("ERROR: malformed pref entry \"$pref\"\n"); next;}
    my $fn = $1;
    if (!$Debug_debug_prefs && $fn eq "debug.js" && !$debug) {next;}
    my $pfile = "$do/defaults/preferences/$fn";
    my $mode = ($prefFiles{$pfile} ? ">>":">").":encoding(UTF-8)";
    open(PREF, $mode, $pfile) || die "Could not open pref file \"$pfile\"\n";
    my $q = '"';
    if ($pP->{$p} =~ s/^.*?(true|false).*?$/my $b=$1; $b=lc($b);/ie) {$q = "";}
    if ($pP->{$p} =~ /^""$/) {$q = "";} # let Set pref="" pass as is
    if ($pref =~ /^HiddenTexts/) {$pP->{$p} =~ s/,/\;/; $pP->{$p} =~ s/\s+//; $pP->{$p}.=";"}
    print PREF "pref(\"$pref\", $q".$pP->{$p}."$q);\n";
    close(PREF);
    $prefFiles{$pfile}++;
  }
}

sub copyExtensionFiles($\@$$$) {
  my $do = shift;
  my $manifestP = shift;
  my @locales = split(/\s*,\s*/, shift);
  my $makeDevelopment = shift;
  my $isFFextension = shift;

  &Log("----> Copying Firefox extension files.\n");
  my $skip = "(\\.svn".($isFFextension ? "|main-window.ico\$":"").")";
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
    push(@{$manifestP}, "skin xulsword skin file:../../../xul/skin/");
    push(@{$manifestP}, "content branding file:../../../xul/content/branding/");
    push(@{$manifestP}, "locale branding en-US file:../../../xul/locale/branding/");
    push(@{$manifestP}, "overlay chrome://xulsword/content/xulsword.xul chrome://xulsword/content/test/debug-overlay.xul");
    push(@{$manifestP}, "skin xsplatform skin file:../../../xul/skin/common/linux/ os=Linux");
    push(@{$manifestP}, "skin xsplatform skin file:../../../xul/skin/common/windows/ os=WINNT");
    &copy_dir("$TRUNK/xul/distribution", "$do/distribution", "", "\\.svn");
  }
  else {
    push(@{$manifestP}, "content xulsword jar:chrome/content.jar!/");
    push(@{$manifestP}, "skin xulsword skin jar:chrome/skin.jar!/");
    if (!$isFFextension) {
      push(@{$manifestP}, "content branding jar:chrome/content.jar!/branding/");
      push(@{$manifestP}, "locale branding en-US jar:chrome/en-US.jar!/branding/");
    }
    push(@{$manifestP}, "skin xsplatform skin jar:chrome/skin.jar!/common/linux/ os=Linux");
    push(@{$manifestP}, "skin xsplatform skin jar:chrome/skin.jar!/common/windows/ os=WINNT");

    &Log("----> Creating content and skin JAR files.\n");
    &makeZIP("$do/chrome/content.jar", "$TRUNK/xul/content/*");
    &makeZIP("$do/chrome/skin.jar", "$TRUNK/xul/skin/*");

    for my $loc (@locales) {
      my $ldir = "$XulswordExtras/localeDev/$loc";
      if ($loc eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}
      if (!-e "$ldir/locale-skin") {next;}
      &Log("----> Including $loc locale-skin in skin.jar.\n");
      &makeZIP("$do/chrome/skin.jar", "$ldir/locale-skin/*", 1);
    }
  }

}

sub copyXulRunnerFiles($) {
  my $do = shift;
  &Log("----> Copying xulrunner files.\n");
  # skip undeeded stuff: 2+1.9+1.9+0.6+0.4+0.36+0.25+0.12+0.1++0.1 ~ 8MB
  my $skip = "(";
  $skip .= "xulrunner\-stub\$EXE|";
  $skip .= "dictionaries|";
  $skip .= "D3DCompiler_43$DLL|";
  $skip .= "d3dx9_43$DLL|";
  $skip .= "js$EXE|";
  $skip .= "libGLESv2$DLL|";
  $skip .= "nssckbi$DLL|";
  $skip .= "freebl3$DLL|";
  $skip .= "updater$EXE|";
  $skip .= "crashreporter$EXE|";
  $skip .= "nssdbm3$DLL|";
  $skip .= "libEGL$DLL|";
  $skip .= "xpcshell$EXE|";
  $skip .= "IA2Marshal$DLL";
  $skip .= ")";
   
  if (!-e $XULRunner) {&Log("ERROR: No xulrunner directory: \"$XULRunner\".\n"); die;}
  &copy_dir($XULRunner, $do, "", $skip);
  if ("$^O" =~ /MSWin32/i) {mv("$do/xulrunner.exe", "$do/$Xsprocess");}
  elsif ("$^O" =~ /linux/i) {mv("$do/xulrunner-bin", "$do/$Xsprocess");}
  else {&Log("ERROR: Please provide xulrunner executable name for this platform.\n");}
}

sub writeApplicationINI($$) {
  my $do = shift;
  my $buildTypeID = shift;

  &Log("----> Writing application.ini.\n");
  open(INI, ">:encoding(UTF-8)", "$do/application.ini") || die;
  print INI "[App]\n";
  print INI "Vendor=$Vendor\n";
  print INI "Name=$Name\n";
  print INI "Version=$Version\n";
  print INI "ID=xulsword\@xulsword.org\n";
  print INI "BuildID=$BuildID".$buildTypeID."\n\n";
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
  
  &Log("----> Copying SWORD modules.\n");
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
    &copy_dir($mpath, $modfd, "", $dfilter);
    &copy_file($path, $confd);
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

sub writeInstallManifest($) {
  my $od = shift;
  
  &Log("----> Writing Install Manifest\n");
  my $platform;
  if ("$^O" =~ /MSWin32/i) {$platform = "WINNT_x86-msvc";}
  elsif ("$^O" =~ /linux/i) {
    $platform = "Linux_x86";
    if (`uname -m` eq "x86_64\n") {$platform .= "_64";}
    $platform .= "-gcc3";
  }
  else {&Log("ERROR: Please add Firefox Extension platform identifier for your platform.\n");}
  open(INM, ">:encoding(UTF-8)", "$od/install.rdf") || die "Could not open \"$od/install.rdf\".\n";
print INM "<?xml version=\"1.0\"?>\n";
print INM "\n";
print INM "<RDF xmlns=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"\n";
print INM "     xmlns:em=\"http://www.mozilla.org/2004/em-rdf#\">\n";
print INM "\n";
print INM "  <Description about=\"urn:mozilla:install-manifest\">\n";
print INM "    <em:id>xulsword\@xulsword.org</em:id>\n";
print INM "    <em:version>$Version</em:version>\n";
print INM "    <em:type>2</em:type>\n";
print INM "\n";
print INM "    <!-- Firefox -->\n";
print INM "    <em:targetApplication>\n";
print INM "      <Description>\n";
print INM "        <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>\n";
print INM "        <em:minVersion>$GeckoMinVersion</em:minVersion>\n";
print INM "        <em:maxVersion>$GeckoMaxVersion</em:maxVersion>\n";
print INM "      </Description>\n";
print INM "    </em:targetApplication>\n";
print INM "\n";
print INM "    <!-- Front End MetaData -->\n";
print INM "    <em:name>xulsword</em:name>\n";
print INM "    <em:description>A Bible reading and study tool.</em:description>\n";
print INM "    <em:homepageURL>http://code.google.com/p/xulsword</em:homepageURL>\n";
print INM "    <em:iconURL>chrome://xulsword/skin/icon.png</em:iconURL>\n";
print INM "    <em:unpack>true</em:unpack>\n";
print INM "    <em:targetPlatform>$platform</em:targetPlatform>\n";
print INM "  </Description>\n";
print INM "</RDF>\n";
  close(INM);
}

sub compileStartup($) {
  my $do = shift;
  my $rd;
  if ($do eq $PORTABLE)  {$rd = "runPortable";}
  else {$rd = "runMK";}

  &Log("----> Compiling startup stub.\n");
  remove_tree("$TRUNK/Cpp/$rd/Release");
  chdir("$TRUNK/Cpp/$rd");
  `call Compile.bat >> $LOGFILE`;
  chdir("$TRUNK/build");

  &copy_file("$TRUNK/Cpp/$rd/Release/$rd$EXE", "$do/$Executable");
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

  my $s = "$TRUNK/build/run_$name-$type.pl";
  open(SCR, ">:encoding(UTF-8)", $s) || die;
  print SCR "#!/usr/bin/perl\n";
    
  if ("$^O" =~ /MSWin32/i) {
    if ($type eq "dev") {
      print SCR "chdir(\"".$DEVELOPMENT."\");\n";
      print SCR "`start /wait $Name-srv$EXE --app application.ini -jsconsole -console`;\n";
    }
    elsif ($type eq "port") {
      print SCR "chdir(\"".$PORTABLE."\");\n";
      print SCR "`$Name$EXE`;\n";
    }
    elsif ($type eq "install") {
      &writeWindowsRegistryScript();
      print SCR "`\"$INSTALLER/$Name$EXE\"`;\n";
    }
  }
  elsif ("$^O" =~ /linux/i) {
    if ($type eq "dev") {
      print SCR "`firefox --app $DEVELOPMENT/application.ini -jsconsole`;\n";
    }
    elsif ($type eq "port") {
      &Log("NOTE: Portable run script not implemented for linux.\n");
    }
    elsif ($type eq "install") {
      &Log("NOTE: Installer run script not implemented for linux.\n");
    }  
  }
  else {&Log("ERROR: Please add run scripts for your platform.\n");}
  close(SCR);
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

sub processLocales($\@$$) {
  my @locales = split(/\s*,\s*/, shift);
  my $manifestP = shift;
  my $od = shift;
  my $no_xul_overrides = shift;
  
  &Log("----> Processing requested locales.\n");
  foreach my $loc (@locales) {

  my $ldir = "$XulswordExtras/localeDev/$loc";
  if ($loc eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}
  
    # create locale jar file
    if (!$haveLocale{$loc}) {
      &createLocale($loc);
      $haveLocale{$loc} = 1;
    }
    &copy_file("$TRUNK/build-files/locales/$loc.jar", "$od/chrome");
    &copy_file("$ldir/$loc.rdf", "$od/defaults/");
    
    # write locale manifest info
    push(@{$manifestP}, "\nlocale xulsword $loc jar:chrome/$loc.jar!/xulsword/");

    if (-e "$ldir/text-skin/skin") {
      push(@{$manifestP}, "skin localeskin $loc jar:chrome/$loc.jar!/skin/");
    }
  }
  
  # Do not override anything if this is a FireFox extension, as this may 
  # break FireFox if its version is different that from which the override 
  # files were taken.
  if (!$no_xul_overrides) {
    push(@{$manifestP}, "override chrome://global/locale/textcontext.dtd chrome://xulsword/locale/override/ff17/textcontext.dtd");
    push(@{$manifestP}, "override chrome://global/locale/tree.dtd chrome://xulsword/locale/override/ff17/tree.dtd");
  }

  push(@{$manifestP}, "\n# xulswordVersion=3.0\n");
  push(@{$manifestP}, "# minMKVersion=3.0\n"); # locales no longer have security codes and aren't backward compatible
}

sub createLocale($) {
  my $locale = shift;

  &Log("----> Creating locale $locale\n");
  
  my $ldir = "$XulswordExtras/localeDev/$locale";
  if ($locale eq "en-US") {$ldir = "$TRUNK/localeDev/en-US";}
  
  # recreate xulsword locale from UI source and report if the log file changes
  mv("$ldir/code_log.txt", "$ldir/code_log-bak.txt");
  
  system("$TRUNK/localeDev/UI-code.pl", $TRUNK, $XulswordExtras, $locale);
  
  if (compare("$ldir/code_log.txt", "$ldir/code_log-bak.txt") != 0) {
    &Log("WARNING: $locale LOG FILE HAS CHANGED. PLEASE CHECK IT: \"$ldir/code_log.txt\".\n");
  }
  unlink("$ldir/code_log-bak.txt");
  
  # make locale jar file
  if (-e "$TRUNK/build-files/locales/$locale.jar") {unlink("$TRUNK/build-files/locales/$locale.jar");}
  &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$ldir/locale/*");
  if (-e "$ldir/text-skin") {
    &makeZIP("$TRUNK/build-files/locales/$locale.jar", "$ldir/text-skin/*", 1);
  }
  
}

sub packageWindowsSetup($) {
  my $is = shift;

  &Log("----> Creating Windows setup installer.\n");

  my $id = $is;
  $id =~ s/[\\\/][^\\\/]+$//;
  if (!-e $is) {&Log("ERROR: installer script $is not found.\n"); return;}

  my $resdir = "$OutputDirectory/$Name-Install-$Version";
  if (!-e $resdir) {make_path($resdir);}

  if (!chdir($id)) {&Log("ERROR: Could not cd into \"$id\".\n"); die;}
  my $isp = `echo %ProgramFiles%/Inno Setup 5/ISCC.exe`;
  chomp($isp);
  
  if (!-e $isp) {
    &Log("ERROR: Inno Setup 5 (Unicode) is not installed.\n");
    die;
  }
  `"%ProgramFiles%/Inno Setup 5/ISCC.exe" "$is" > "$resdir/file_log.txt"`;
  chdir("$TRUNK/build");
}

sub packagePortable($$) {
  my $id = shift;
  my $od = shift;

  &cleanDir($od);
  $of = "$od/$Name Portable-$Version.zip";
  
  &Log("----> Making portable zip package.\n");
  if (-e $of) {unlink($of);}
  &makeZIP($of, $id, 0, "file_log.txt");
}

sub packageFFExtension($$) {
  my $id = shift;
  my $od = shift;
  
  my $type = "";
  if ("$^O" =~ /MSWin32/i) {$type = "win";}
  elsif ("$^O" =~ /linux/i) {$type = "linux";}
  else {&Log("ERROR: Please add extension type for your platform.\n");}
  
  &cleanDir($od);
  $of = "$od/$Name"."_Firefox".($type ? "($type)":"")."-$Version.xpi";
  
  &Log("----> Making extension xpt package.\n");
  if (-e $of) {unlink($of);}
  &makeZIP($of, $id, 0, "file_log.txt");
}
