$ErrorActionPreference = "Stop"

$ARCHITECTURE = "$($args[0])"
$OS = "$($args[1])"
$HUB_ORG = "$($args[2])"
$IMAGE_NAME = "$($args[3])"
$TAG = "master"
$HUB_IMAGE = "${HUB_ORG}/${IMAGE_NAME}:${TAG}"

Function check_input() {
  if (-not $ARCHITECTURE) {
    Throw "Missing input parameter ARCHITECTURE"
  }

  if (-not $OS) {
    Throw "Missing input parameter OS"
  }

  if (-not $HUB_ORG) {
    Throw "Missing input parameter HUB_ORG"
  }

  if (-not $IMAGE_NAME) {
    Throw "Missing input parameter HUB_ORG"
  }
}

Function set_build_context() {
  (Get-Content ./image/$ARCHITECTURE/$OS/Dockerfile) -replace '{{%TAG%}}', "$TAG" | Set-Content ./image/$ARCHITECTURE/$OS/Dockerfile
}

Function build_and_tag_image() {
  docker build --no-cache -f ./image/$ARCHITECTURE/$OS/Dockerfile -t "$HUB_IMAGE" .
}

Function push_images() {
  docker push "$HUB_IMAGE"
}

check_input
set_build_context
build_and_tag_image
push_images
