#!/bin/bash -e

#TODO: move this to microbase later
echo "downloading node zip"
$env:NODE_VERSION = "4.8.5"

Invoke-WebRequest $('https://nodejs.org/dist/v{0}/node-v{0}-win-x64.zip' -f $env:NODE_VERSION) -OutFile 'node.zip' -UseBasicParsing ;
echo "extracting node archive"

$sum = Expand-Archive node.zip -DestinationPath C:\ ;
  Rename-Item -Path $('C:\node-v{0}-win-x64' -f $env:NODE_VERSION) -NewName 'C:\nodejs'

echo "updating path variable for node"
$Env:NPM_CONFIG_LOGLEVEL="info"
New-Item $($env:APPDATA + '\npm') ;
  $env:PATH = 'C:\nodejs;{0}\npm;{1}' -f $env:APPDATA, $env:PATH ;
  [Environment]::SetEnvironmentVariable('PATH', $env:PATH, [EnvironmentVariableTarget]::Machine)

echo "installing node dependencies using npm"
# needed to build disk-usage package for during npm install
npm install --global --production windows-build-tools@1.3.2

echo "checking node version"
node -v
