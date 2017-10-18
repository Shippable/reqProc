#!/bin/bash -e

export DRYDOCK_ORG="$1"
export ARCHITECTURE="$2"
export OS="$3"

# reqExec image
export IMAGE_NAME="reqexec"
export TAG="master"

# ECR location
export ECR_ORG="374168611083.dkr.ecr.us-east-1.amazonaws.com"
export ECR_IMAGE="$ECR_ORG/$IMAGE_NAME:$TAG"

# Drydock location
export HUB_ORG="drydock"
export HUB_IMAGE="$HUB_ORG/$IMAGE_NAME:$TAG"

check_input() {
  if [ -z "$DRYDOCK_ORG" ]; then
    echo "Missing input parameter DRYDOCK_ORG"
    exit 1
  fi

  if [ -z "$ARCHITECTURE" ]; then
    echo "Missing input parameter ARCHITECTURE"
    exit 1
  fi

  if [ -z "$OS" ]; then
    echo "Missing input parameter OS"
    exit 1
  fi
}

set_build_context() {
  sed -i "s/{{%DRYDOCK_ORG%}}/$DRYDOCK_ORG/g" Dockerfile
  sed -i "s/{{%ARCHITECTURE%}}/$ARCHITECTURE/g" Dockerfile
  sed -i "s/{{%OS%}}/$OS/g" Dockerfile
  sed -i "s/{{%TAG%}}/$TAG/g" Dockerfile
}

build_and_tag_image() {
  docker build -t "$HUB_IMAGE" .
  docker tag "$HUB_IMAGE" "$ECR_IMAGE"
}

push_images() {
  docker push "$HUB_IMAGE"
  # TODO: Uncomment this whenever the ECR repository is created.
  # docker push "$ECR_IMAGE"
}

main() {
  check_input
  set_build_context
  build_and_tag_image
  push_images
}

main
