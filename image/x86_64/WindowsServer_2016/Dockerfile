FROM microsoft/windowsservercore:10.0.14393.1884

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

ENV IMAGE_REQPROC_DIR C:/Users/ContainerAdministrator/Shippable/reqProc
RUN mkdir $Env:IMAGE_REQPROC_DIR
WORKDIR  C:/Users/ContainerAdministrator/Shippable/reqProc
ADD . .
RUN .\image\x86_64\WindowsServer_2016\install_util.ps1
RUN .\image\x86_64\WindowsServer_2016\install_node.ps1
RUN npm install

# execTemplates
ENV IMAGE_EXEC_TEMPLATES_DIR C:/Users/ContainerAdministrator/Shippable/execTemplates
RUN mkdir $Env:IMAGE_EXEC_TEMPLATES_DIR; \
    Invoke-WebRequest https://github.com/Shippable/execTemplates/archive/master.zip -OutFile $env:TEMP\execTemplates.zip; \
    Expand-Archive $env:TEMP\execTemplates.zip -DestinationPath $env:IMAGE_EXEC_TEMPLATES_DIR; \
    Remove-Item $env:TEMP\execTemplates.zip;

# reqExec
WORKDIR C:/Users/ContainerAdministrator/Shippable/reqExec
ENV IMAGE_REQEXEC_DIR C:/Users/ContainerAdministrator/Shippable/reqExec
RUN Invoke-WebRequest https://s3.amazonaws.com/shippable-artifacts/reqExec/master/reqExec-master-x86_64-WindowsServer_2016.zip -OutFile reqExecBin.zip
RUN Expand-Archive  .\reqExecBin.zip -DestinationPath $env:IMAGE_REQEXEC_DIR/x86_64/WindowsServer_2016/ -Force; Remove-Item .\reqExecBin.zip

# Docker client binary
RUN Invoke-WebRequest https://download.docker.com/win/static/stable/x86_64/docker-17.06.2-ce.zip -OutFile docker-17.06.2-ce.zip; \
    mkdir c:\docker; \
    Expand-Archive  .\docker-17.06.2-ce.zip -DestinationPath $env:TEMP/docker/ -Force; \
    Move-Item $env:TEMP\docker\docker\docker.exe c:\docker\docker.exe; \
    $env:PATH = '{0};c:\docker' -f $env:PATH ; \
    [Environment]::SetEnvironmentVariable('PATH', $env:PATH, [EnvironmentVariableTarget]::Machine); \
    Remove-Item .\docker-17.06.2-ce.zip; \
    Remove-Item -recur -force $env:TEMP\docker;

WORKDIR C:/Users/ContainerAdministrator/Shippable/reqProc
CMD C:\Users\ContainerAdministrator\Shippable\reqProc\boot.ps1