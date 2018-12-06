# ReqProc - Shippable build node agent

[![Run Status](https://api.shippable.com/projects/59e0d19c8a3e960700ade4ba/badge?branch=master)]()

`reqProc` is the Shippable agent that needs to run on the node for the node to
accept and execute builds. `reqProc` always runs as a Docker container and is responsible for following:

- periodically pinging Shippable API with health checks
- listening for and accepting new builds
- validating and unpacking build data and secrets
- generating build steps
- updating the build status

It is one of the three components that are installed on the host when users [initialize](http://docs.shippable.com/platform/runtime/nodes/#byon-nodes) the host to act as a build node on Shippable. The other two components that are
installed upon node initialization are [reqKick](https://github.com/shippable/reqkick)
and [reqExec](https://github.com/shippable/reqExec).

## Development

For each supported architecture and OS, a different Docker image is built. All
the Dockerfiles are present in `image/` folder in the project root.

Any merged change in the project triggers Shippable assembly lines to
re-package all necessary requirements and dependencies and push the updated
Docker images with `master` tag.

Once all the jobs are completed, the images can be tested by initializing nodes
manually in the test environment or running automated tests using [bvt](https://github.com/shippable/bvt).

Supported platforms:

| ARCHITECTURE   | OS                  |
| ------------   | --                  |
| x86_64         | Ubuntu_16.04        |
| x86_64         | macOS_10.12         |
| aarch64        | Ubuntu_16.04        |
| x86_64         | WindowsServer_2016  |


## Releases

`reqProc` images for each supported platform are updated with every Shippable
release. The list of all Shippable releases can be found [here](https://github.com/Shippable/admiral/releases).
