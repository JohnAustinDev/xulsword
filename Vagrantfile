# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  config.vm.box = "ubuntu/focal64"
  
# Uncomment the following line to build 32 bit Linux instead of 64 bit
#  config.vm.box = "ubuntu/focal64"

  config.vm.provision :shell, :path => "init.sh", privileged: false
  
  # Set forward_x11 to true for the VM to display GUIs through host
  config.ssh.forward_x11 = true
  
  config.vm.provider "virtualbox" do |vb|
    # Set the RAM for your Vagrant VM
    vb.memory = 4000
  end
    
end


