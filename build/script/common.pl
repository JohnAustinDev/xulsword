use Encode;
use File::Copy;
use File::Path qw(make_path remove_tree);

# copies a directory recursively
sub copy_dir($$$$) {
  my $id = shift;
  my $od = shift;
  my $skf = shift;
  my $skd = shift;
  
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
    if (-d $if) {
      if ($skd && $if =~ /$skd/) {next;}
      &copy_dir($if, $of, $skf, $skd);
    }
    else {
      if ($skf && $if =~ /$skf/) {next;}
      copy($if, $of);
    }
  }
  return 1;
}

sub writePrefs($\%){
  my $f = shift;
  my $pP = shift;
  
  my $fn = $f;
  $fn =~ s/^.*?([^\\\/]+)$/$1/;
  open(PREF, ">:encoding(UTF-8)", "$f") || die "Can't open $f";
  foreach my $p (sort keys %{$pP}) {
    if (!$pP->{$p}) {next;}
    if ($pP->{$p} !~ s/^\($fn\)\://) {next;}
    my $q = '"';
    if ($pP->{$p} =~ s/^.*?(true|false).*?$/my $b=$1; $b=lc($b);/ie) {$q = "";}
    if ($p =~ /^HiddenTexts/) {$pP->{$p} =~ s/,/\;/; $pP->{$p} =~ s/\s+//; $pP->{$p}.=";"}
    print PREF "pref(\"$p\", $q".$pP->{$p}."$q);\n";
  }
  close(PREF);
}

sub makeJAR($$) {
  my $jf = shift;
  my $di = shift;
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    $jf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    $di .= "\\*";
    my $cmd = "7za a -tzip \"$jf\" -r \"$di\" -x!.svn";
    &Log($cmd);
    `$cmd`;
  }
  else {
    &Log("ERROR: Please update common.pl->makeJAR() to include your platform.\n");
  }
}

sub updateJAR($$) {
  my $jf = shift;
  my $di = shift;
  
  if (!-e $jf) {&Log("ERROR: no JAR to update \"$jf\".\n"); return;}
  if ("$^O" =~ /MSWin32/i && $Target eq "Windows") {
    $jf =~ s/[\/]/\\/g;
    $di =~ s/[\/]/\\/g;
    $di .= "\\*";
    my $cmd = "7za u -tzip \"$jf\" -r \"$di\" -x!.svn";
    &Log($cmd);
    `$cmd`;
  }
  else {
    &Log("ERROR: Please update common.pl->updateJAR() to include your platform.\n");
  }
}

sub createLocaleExtension($$) {
  my $loc = shift;
  my $di = shift;
  &Log("WARNING: createLocaleExtension not yet implemented.\n");
}

sub getInfoFromConf($) {
  my $conf = shift;
  my %ConfEntry, $MOD;
  open(CONF, "<:encoding(UTF-8)", $conf) || die "Could not open $conf\n";
  while(<CONF>) {
    if ($_ =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/) {
      if ($ConfEntry{$1} ne "") {$ConfEntry{$1} = $ConfEntry{$1}."<nx>".$2;}
      else {$ConfEntry{$1} = $2;}
    }
    if ($_ =~ /^\s*\[(.*?)\]\s*$/) {$MOD = $1}
  }
  close(CONF);

  # short var names
  my $MODPATH = $ConfEntry{"DataPath"};
  $MODPATH =~ s/([\/\\][^\/\\]+)\s*$//; # remove any file name at end
  $MODPATH =~ s/[\\\/]\s*$//; # remove ending slash
  $MODPATH =~ s/^[\s\.]*[\\\/]//; # normalize beginning of path
  $ConfEntry{"DataPath"} = $MODPATH;
  undef(%Conf{$MOD});
  foreach my $k (keys %ConfEntry) {$Conf{$MOD}{$k} = $ConfEntry{$k};}
}

sub Log($$) {
  my $p = shift; # log message
  my $h = shift; # -1 = hide from console, 1 = show in console, 2 = only console
  if ((!$NOCONSOLELOG && $h!=-1) || $h>=1 || $p =~ /error/i) {print encode("utf8", "$p");}
  if ($LOGFILE && $h!=2) {
    open(LOGF, ">>:encoding(UTF-8)", $LOGFILE) || die "Could not open log file \"$LOGFILE\"\n";
    print LOGF $p;
    close(LOGF);
  }
}

1;