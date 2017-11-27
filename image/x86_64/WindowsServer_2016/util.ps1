# TODO: move this to microbase. needed to debug

echo "installing chocolatey"
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

echo "Installing python2"
choco install -y python2

echo "Installing vim"
choco install -y vim
refreshenv

# echo "installing node dependencies"
# npm install --global --production windows-build-tools
# npm install

echo "creating reqexec directory"
mkdir $Env:USERPROFILE/shippable/reqexec
