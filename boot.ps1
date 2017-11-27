#!/bin/bash -e

New-Item -ItemType Directory -Force -Path .\logs
node app.js
