# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

#  config.vm.box = "ubuntu/xenial32"
  
  config.vm.box = "ubuntu/xenial64"

  config.vm.provision :shell, :path => "build.sh", privileged: false
  
  # Set forward_x11 to true for the VM to display GUIs through host
  config.ssh.forward_x11 = true
  
end
