FROM drydock/microbase:{{%TAG%}}

# Prefix all image ENVs with IMAGE_ so there are no confusions.
ENV IMAGE_REQPROC_DIR /root/reqProc
ADD . $IMAGE_REQPROC_DIR
RUN cd $IMAGE_REQPROC_DIR && npm install

ENV IMAGE_EXEC_TEMPLATES_DIR /root/execTemplates
RUN mkdir -p $IMAGE_EXEC_TEMPLATES_DIR && \
    wget https://github.com/Shippable/execTemplates/archive/{{%TAG%}}.tar.gz -O /tmp/execTemplates.tar.gz && \
    tar -xzvf /tmp/execTemplates.tar.gz -C $IMAGE_EXEC_TEMPLATES_DIR --strip-components=1 && \
    rm /tmp/execTemplates.tar.gz

# With our current design, we need to pull all reqExec binaries.
# TODO: Pull all binaries that reqExec has here once we start pushing them to S3.
ENV IMAGE_REQEXEC_DIR /root/reqExec
RUN mkdir -p $IMAGE_REQEXEC_DIR/x86_64/Ubuntu_16.04 && \
    wget https://s3.amazonaws.com/shippable-artifacts/reqExec/{{%TAG%}}/reqExec-{{%TAG%}}-x86_64-Ubuntu_16.04.tar.gz -O /tmp/reqExec.tar.gz && \
    tar -xzvf /tmp/reqExec.tar.gz -C $IMAGE_REQEXEC_DIR/x86_64/Ubuntu_16.04 && \
    rm /tmp/reqExec.tar.gz

# Bundle docker binary as we cannot use the one on host in Linux.
RUN wget https://download.docker.com/linux/static/stable/x86_64/docker-17.09.0-ce.tgz -O /tmp/docker.tar.gz && \
    tar -xzvf /tmp/docker.tar.gz -C /tmp && \
    mv /tmp/docker/* /usr/bin && \
    rm -r /tmp/docker.tar.gz /tmp/docker

ENTRYPOINT $IMAGE_REQPROC_DIR/boot.sh
