#!/usr/bin/perl
use Encode;

# This script reads all xul, xml, html, and js files recursively and parses 
# out scripts calls to properties bundles.

# Then it reads the UI-MAP.txt file and creates a new one which assumes
# that all files will only include entities from a single 
# .dtd file having the name of the file's containing directory.

$INDIR = "../../xul";
$OUTFILE = "OUT_codeProperties2MAP.txt";

# skip weird code bits that happen to look like entities
$SKIP = "";

open(LOGF, ">encoding(UTF-8)", $OUTFILE) || die;

my %Properties, %Files;
&getPropertiesFromDir($INDIR, \%Properties, \%Files);

print LOGF "\n\n----- Listing of Properties\n";
foreach my $ps (sort keys %Properties) {print LOGF $ps." = ".$Properties{$ps}."\n";}

print LOGF "\n\n----- Listing of Files\n";
foreach my $fs (sort keys %Files) {print LOGF $fs." = ".$Files{$fs}."\n";}

exit;

print LOGF "\n\n----- Creating new UI-MAP.txt file\n";
open(INF, "<:encoding(UTF-8)", "../UI-MAP.txt") || die;
open(OUTF, ">:encoding(UTF-8)", "UI-MAP.txt") || die;
while(<INF>) {
  #xulsword/xulsword.dtd:main.title                                         =  main-window.title
  if ($_ =~ /^([^\:]+)\:(\S+)\s*=(.*)$/) {
    my $f = $1;
    my $p = $2;
    my $n = $3;
    
    if ($f =~ /\.properties$/) {
      my $new = "";
      
      if (!exists($Entities{$p}) || !$Properties{$p}) {
        print "WARNING: Entity in UI-MAP.txt was not found in code: \"&$p;\"\n";
      }
      else {
        my @lines = split(/ /, $Properties{$p});
        foreach my $line (@lines) {
          my $space = "";
          my $sc = 73 - length("$line:$p");
          while($sc--) {$space .= " ";}
          
          $new .= "$line:$p$space=$n\n";
        }
        
        print LOGF "Replacing:\n$_";
        print LOGF "WITH:\n$new\n";
        $_ = $new;
      }
    }
    
  }
  
  if (!exists($MAPLINES{$_})) { # don't include duplicate lines
    print OUTF $_;
    $MAPLINES{$_}++;
  }
  
}
close(INF);
close(OUTF);
close(LOGF);


########################################################################

sub getPropertiesFromDir($\%\%) {
  my $ind = shift;
  my $pP = shift;
  my $fP = shift;
  
  opendir(IND, $ind) || die;
  my @files = readdir(IND);
  closedir(IND);
  
  foreach my $file (@files) {
    
    if (!-d "$ind/$file") {
      if ($file !~ /\.(xul|xml|html|htm|js)$/i) {
        #print LOGF "Skipping file: \"$ind/$file\"\n"; 
        next;
      }
      &getPropertiesFromFile("$ind/$file", $pP, $fP);
    }
    
    else {
      if ($file =~ /^\.+$/) {next;}
      if ($file =~ /^\.svn$/) {next;}
      &getPropertiesFromDir("$ind/$file", $pP, $fP);
    }
    
  }
}

sub getPropertiesFromFile($\%\%) {
  my $inf = shift;
  my $pP = shift;
  my $fP = shift;
  
  open(INF, "<:encoding(UTF-8)", $inf) || die "Could not open \"$inf\"\n";
  my $line = 0;
  while(<INF>) {
    $line++;
    
    #(GetStringFromName|formatStringFromName|getFormattedString|getString)
    $_ =~ s/\.(getFormattedString|getString)\((.*?)\)/&handleProperty($2,$inf, $pP, $fP);/eg;
    if ($_ =~ /\.(getFormattedString|getString)\((.*?)\)/) {print "ERROR!!!!!! Missed property \"$2\" on Line $line of $inf\n";}
  }
  close(INF);
  
}

sub handleProperty($$\%\%) {
  my $p = shift;
  my $f = shift;
  my $pP = shift;
  my $fP = shift;
  
  if ($SKIP =~ /\Q$p/) {print LOGF "Skipping property: \"$p\" in file \"$f\"\n"; return "";}
  
  my $fn = $f;
  $fn =~ s/^\Q$INDIR//;
  
  # allow one .property file in each directory which contains ALL properties for
  # files in that directory (but NOT its subdirectories, as they will have 
  # their own files)
  #if ($fn !~ s/([^\/]+)\/([^\/]+)$/$1\/$1\.properties/) {print "ERROR!!!!!! Could not create .property file from \"$fn\"\n";}
  #$fn =~ s/^\/content\//xulsword\//;
  #$fn =~ s/^(xulsword\/)content(\.properties)$/$1xulsword$2/;
  
  if (!exists($pP->{$p}) || $pP->{$p} !~ /\Q$fn/) {
    $pP->{$p} .= "$fn ";
  }
  
  if (!exists($fP->{$fn}) || $fP->{$fn} !~ /\Q$e/) {
    $fP->{$fn} .= "<$p> ";
  }
  
  return "";
}
