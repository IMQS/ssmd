#################################################################
# Setup node build environment
FROM ubuntu:18.04 AS node

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -

RUN apt-get update \
    && apt-get install -y nodejs gcc g++ make

RUN rm -rf /var/lib/apt/lists/*

#################################################################
# Copy in source

COPY / /deploy/
WORKDIR /deploy
RUN npm install

ENTRYPOINT ["node", "/deploy/ssmd.js"]
