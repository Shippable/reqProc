FROM microsoft/windowsservercore:10.0.14393.1884

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

RUN mkdir $Env:USERPROFILE/Shippable/reqProc
WORKDIR  C:/Users/ContainerAdministrator/Shippable/reqProc
ADD . .
RUN .\image\x86_64\WindowsServer_2016\install_util.ps1
RUN .\image\x86_64\WindowsServer_2016\install_node.ps1
RUN npm install

# TODO: add exec templates later
RUN mkdir $Env:USERPROFILE/Shippable/reqExec
WORKDIR C:/Users/ContainerAdministrator/Shippable/reqExec
# TODO: should fetch reqexec binaries and copy to correct path once pipeline is in place
COPY ./windows/reqExec/bin/main.exe .

WORKDIR C:/Users/ContainerAdministrator/Shippable/reqProc
CMD C:\Users\ContainerAdministrator\Shippable\reqProc\boot.ps1

