$ErrorActionPreference = "Stop";

# TODO: move this to microbase later
echo "installing chocolatey"
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

echo "Installing python2"
choco install -y python2

echo "Installing vim"
choco install -y vim
refreshenv

echo "Installing openssh"
choco install -y openssh

echo "Installing sshd service"
& 'C:\Program Files\OpenSSH-Win64\install-sshd.ps1'

echo "Starting sshd service"
net start sshd
