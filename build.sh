#!/bin/bash -e

export DRYDOCK_ORG="$1"
export TAG="master"

# reqProc
export REQPROC_REPO_PATH="./IN/reqProc_repo/gitRepo"
export IMAGE_NAME="reqproc"

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
}

set_build_context() {
  sed -i "s/{{%DRYDOCK_ORG%}}/$DRYDOCK_ORG/g" Dockerfile
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
  pushd $REQPROC_REPO_PATH
    check_input
    set_build_context
    build_and_tag_image
    push_images
  popd
}

main
