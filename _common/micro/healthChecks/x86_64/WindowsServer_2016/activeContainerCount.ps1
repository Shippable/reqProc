$ErrorActionPreference = "Stop"
docker ps | Measure-Object -line |  %{ $_.Lines }
