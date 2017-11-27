FROM microsoft/windowsservercore:10.0.14393.1884

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

RUN mkdir $Env:USERPROFILE/shippable/reqproc
WORKDIR  C:/Users/ContainerAdministrator/shippable/reqproc
ADD . .
RUN .\image\x86_64\WindowsServer_2016\install_util.ps1
RUN .\image\x86_64\WindowsServer_2016\install_node.ps1
RUN npm install

# TODO: add exec templates later
RUN mkdir $Env:USERPROFILE/shippable/reqexec
WORKDIR C:/Users/ContainerAdministrator/shippable/reqexec
COPY ./windows/reqexec/bin/main.exe .

WORKDIR C:/Users/ContainerAdministrator/shippable/reqproc
CMD C:\Users\ContainerAdministrator\shippable\reqproc\boot.ps1

