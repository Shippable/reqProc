FROM microsoft/windowsservercore:10.0.14393.1884

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

ENV IMAGE_REQPROC_DIR C:/Users/ContainerAdministrator/Shippable/reqProc
RUN mkdir $Env:IMAGE_REQPROC_DIR
WORKDIR  C:/Users/ContainerAdministrator/Shippable/reqProc
ADD . .
RUN .\image\x86_64\WindowsServer_2016\install_util.ps1
RUN .\image\x86_64\WindowsServer_2016\install_node.ps1
RUN npm install

# TODO: add exec templates
ENV IMAGE_EXEC_TEMPLATES_DIR C:/Users/ContainerAdministrator/Shippable/execTemplates
RUN mkdir $Env:IMAGE_EXEC_TEMPLATES_DIR
WORKDIR C:/Users/ContainerAdministrator/Shippable/reqExec

ENV IMAGE_REQEXEC_DIR C:/Users/ContainerAdministrator/Shippable/reqExec
RUN Invoke-WebRequest https://s3.amazonaws.com/shippable-artifacts/reqExec/{{%TAG%}}/reqExec-{{%TAG%}}-x86_64-WindowsServer_2016.zip -OutFile reqExecBin.zip
RUN Expand-Archive  .\reqExecBin.zip -DestinationPath $env:IMAGE_REQEXEC_DIR/x86_64/WindowsServer_2016/ -Force; Remove-Item .\reqExecBin.zip

WORKDIR C:/Users/ContainerAdministrator/Shippable/reqProc
CMD C:\Users\ContainerAdministrator\Shippable\reqProc\boot.ps1

