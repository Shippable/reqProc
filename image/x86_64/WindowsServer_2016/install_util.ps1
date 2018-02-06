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

# TODO: save the contents in a file and copy the file directly
# while building drydock/w16 like https://github.com/dry-dock/u16/blob/master/install.sh#L22
echo "Writing $global:HOME\.ssh\config file"
$ssh_dir = Join-Path "$global:HOME" ".ssh"
$ssh_config_file_path = Join-Path "$ssh_dir" "config"
$ssh_config_content = @'
Host *
    StrictHostKeyChecking no
'@
mkdir $ssh_dir
[IO.File]::WriteAllLines($ssh_config_file_path, $ssh_config_content)
