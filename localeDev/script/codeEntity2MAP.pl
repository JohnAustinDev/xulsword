#!/usr/bin/perl
use Encode;

# This script reads all xul and xml files recursively and parses 
# out entities for analysis.

# Then it reads the UI-MAP.txt file and creates a new one which assumes
# that all .xul and .xml files will only include entities from a single 
# .dtd file having the name of the file's containing directory.

$INDIR = "../../xul";
$OUTFILE = "OUT_codeEntity2MAP.txt";

# skip weird code bits that happen to look like entities
$SKIP = "&\"); &#8211; &hidden=%3%&ordinal=%6%\";";

open(LOGF, ">encoding(UTF-8)", $OUTFILE) || die;

my %Entities, %Files;
&getEntitiesFromDir($INDIR, \%Entities, \%Files);

print LOGF "\n\n----- Listing of Entities\n";
foreach my $es (sort keys %Entities) {print LOGF $es." = ".$Entities{$es}."\n";}

print LOGF "\n\n----- Listing of Files\n";
foreach my $fs (sort keys %Files) {print LOGF $fs." = ".$Files{$fs}."\n";}

print LOGF "\n\n----- Creating new UI-MAP.txt file\n";
open(INF, "<:encoding(UTF-8)", "../UI-MAP.txt") || die;
open(OUTF, ">:encoding(UTF-8)", "UI-MAP.txt") || die;
while(<INF>) {
  #xulsword/xulsword.dtd:main.title                                         =  main-window.title
  if ($_ =~ /^([^\:]+)\:(\S+)\s*=(.*)$/) {
    my $f = $1;
    my $e = $2;
    my $n = $3;
    
    if ($f =~ /\.dtd$/) {
      my $new = "";
      
      if (!exists($Entities{"&$e;"}) || !$Entities{"&$e;"}) {
        print "WARNING: Entity in UI-MAP.txt was not found in code: \"&$e;\"\n";
      }
      else {
        my @lines = split(/ /, $Entities{"&$e;"});
        foreach my $line (@lines) {
          my $space = "";
          my $sc = 73 - length("$line:$e");
          while($sc--) {$space .= " ";}
          
          $new .= "$line:$e$space=$n\n";
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

sub getEntitiesFromDir($\%\%) {
  my $ind = shift;
  my $eP = shift;
  my $fP = shift;
  
  opendir(IND, $ind) || die;
  my @files = readdir(IND);
  closedir(IND);
  
  foreach my $file (@files) {
    
    if (!-d "$ind/$file") {
      if ($file !~ /\.(xul|xml)$/i) {
        #print LOGF "Skipping file: \"$ind/$file\"\n"; 
        next;
      }
      &getEntitiesFromFile("$ind/$file", $eP, $fP);
    }
    
    else {
      if ($file =~ /^\.+$/) {next;}
      if ($file =~ /^\.svn$/) {next;}
      &getEntitiesFromDir("$ind/$file", $eP, $fP);
    }
    
  }
}

sub getEntitiesFromFile($\%\%) {
  my $inf = shift;
  my $eP = shift;
  my $fP = shift;
  
  open(INF, "<:encoding(UTF-8)", $inf) || die "Could not open \"$inf\"\n";
  my $line = 0;
  while(<INF>) {
    $line++;
    
    $_ =~ s/(\&[^\;\s]+\;)/&handleEntity($1,$inf, $eP, $fP);/eg;
    if ($_ =~ /(\&[^\;\s]+\;)/) {print "ERROR!!!!!! Missed entity \"$1\" on Line $line of $inf\n";}
  }
  close(INF);
  
}

sub handleEntity($$\%\%) {
  my $e = shift;
  my $f = shift;
  my $eP = shift;
  my $fP = shift;
  
  if ($SKIP =~ /\Q$e/) {print LOGF "Skipping entity: \"$e\" in file \"$f\"\n"; return "";}
  
  my $fn = $f;
  $fn =~ s/^\Q$INDIR//;
  
  # allow one .dtd file in each directory which contains ALL entities for
  # files in that directory (but NOT its subdirectories, as they will have 
  # their own files)
  if ($fn !~ s/([^\/]+)\/([^\/]+)$/$1\/$1\.dtd/) {print "ERROR!!!!!! Could not create dtd file from \"$fn\"\n";}
  $fn =~ s/^\/content\//xulsword\//;
  $fn =~ s/^(xulsword\/)content(\.dtd)$/$1xulsword$2/;
  
  if (!exists($eP->{$e}) || $eP->{$e} !~ /\Q$fn/) {
    $eP->{$e} .= "$fn ";
  }
  
  if (!exists($fP->{$fn}) || $fP->{$fn} !~ /\Q$e/) {
    $fP->{$fn} .= "$e ";
  }
  
  return "";
}
