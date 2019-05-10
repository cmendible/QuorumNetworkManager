#!/bin/bash
set -u
set -e

geth --datadir Blockchain init quorum-genesis.json &>> /dev/null

nohup constellation-node constellation.config &> constellation.log &

sleep 5

FLAGS="--datadir Blockchain --targetgaslimit $3 --shh --port $4 --unlock 0 --password passwords.txt --raft --mine --minerthreads=1 --nodiscover"
RPC_API="admin,db,eth,debug,miner,net,shh,txpool,personal,web3,quorum,raft"
HTTP_RPC_ARGS="--rpc --rpcaddr 0.0.0.0 --rpcport $5 --rpcapi $RPC_API --rpccorsdomain '*' --ethstats $1"
WS_RPC_ARGS="--ws --wsaddr 0.0.0.0 --wsport $6 --wsapi $RPC_API --wsorigins=*"
RAFT_ARGS="--raftport $7"

if [ "$8" == "permissionedNodes" ]
  then
  RAFT_ARGS="$RAFT_ARGS --permissioned Blockchain"
fi
if [ "$#" == 9 ]
  then
  RAFT_ARGS="$RAFT_ARGS --raftjoinexisting $9"
fi

ALL_ARGS="$FLAGS $HTTP_RPC_ARGS $WS_RPC_ARGS $RAFT_ARGS"

PRIVATE_CONFIG=constellation.config nohup geth $ALL_ARGS &> gethNode.log &

echo "[*] Node started"
