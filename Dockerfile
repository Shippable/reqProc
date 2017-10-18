FROM {{%DRYDOCK_ORG%}}/microbase:{{%TAG%}}

ADD . /home/shippable/reqProc

RUN cd /home/shippable/reqProc && npm install

ENV EXEC_TEMPLATES_PATH /home/shippable/execTemplates
RUN mkdir -p $EXEC_TEMPLATES_PATH && \
    wget https://github.com/Shippable/execTemplates/archive/{{%TAG%}}.tar.gz -O /tmp/execTemplates.tar.gz && \
    tar -xzvf /tmp/execTemplates.tar.gz -C $EXEC_TEMPLATES_PATH --strip-components=1 && \
    rm /tmp/execTemplates.tar.gz

ENV REQ_EXEC_PATH /home/shippable/reqExec
RUN mkdir -p $REQ_EXEC_PATH && \
    wget https://s3.amazonaws.com/shippable-artifacts/reqExec/{{%TAG%}}/reqExec-{{%TAG%}}-{{%ARCHITECTURE%}}-{{%OS%}}.tar.gz -O /tmp/reqExec.tar.gz && \
    tar -xzvf /tmp/reqExec.tar.gz -C $REQ_EXEC_PATH && \
    rm /tmp/reqExec.tar.gz

ENTRYPOINT ["/home/shippable/reqProc/boot.sh"]
