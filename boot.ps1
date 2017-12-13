#!/bin/bash -e

New-Item -ItemType Directory -Force -Path .\logs

# IMAGE_REQEXEC_DIR is the directory path on image.
if (-not ($env:IMAGE_REQEXEC_DIR)) {
  Write-Error "IMAGE_REQEXEC_DIR env is missing"
  exit 1
}

# REQEXEC_DIR is the directory path on host.
if (-not ($env:REQEXEC_DIR)) {
  Write-Error "REQEXEC_DIR env is missing"
  exit 1
}

Copy-Item $env:IMAGE_REQEXEC_DIR\* -Recurse -Destination $env:REQEXEC_DIR

node app.js
