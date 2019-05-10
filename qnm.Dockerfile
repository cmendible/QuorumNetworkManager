FROM cmendibl3/quorum:2.0.2

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y build-essential libssl-dev git nodejs dos2unix

RUN mkdir QuorumNetworkManager
COPY . QuorumNetworkManager/
WORKDIR  /QuorumNetworkManager/
RUN npm install
RUN dos2unix *.sh 
RUN chmod +x *.sh 
ENTRYPOINT ["/bin/bash", "-i", "-c"]