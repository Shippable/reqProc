$ErrorActionPreference = "Stop"
docker ps -a | Measure-Object -line |  %{ $_.Lines }
