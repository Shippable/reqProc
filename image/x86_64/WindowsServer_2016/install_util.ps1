#!/bin/bash -e

# TODO: move this to microbase later 
echo "installing chocolatey"
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

echo "Installing python2"
choco install -y python2

echo "Installing vim"
choco install -y vim
refreshenv

