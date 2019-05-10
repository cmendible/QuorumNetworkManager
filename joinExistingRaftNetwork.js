let async = require('async')
let exec = require('child_process').exec
let prompt = require('prompt')
let fs = require('fs')

let whisper = require('./Communication/whisperNetwork.js')
let util = require('./util.js')
let constellation = require('./constellation.js')
let peerHandler = require('./peerHandler.js')
let fundingHandler = require('./fundingHandler.js')
let ports = require('./config.js').ports
let setup = require('./config.js').setup
let service = require('./config.js').service

prompt.start()

function startRaftNode(result, cb){
  let options = {encoding: 'utf8', timeout: 100*1000}
  let ethstats = 'coordinator-'+create_UUID()+':'+service.secret+'@'+service.name
  let cmd = './startRaftNode.sh'
  cmd += ' '+ethstats
  cmd += ' '+service.secret
  cmd += ' '+setup.targetGasLimit
  cmd += ' '+ports.gethNode
  cmd += ' '+ports.gethNodeRPC
  cmd += ' '+ports.gethNodeWS_RPC
  cmd += ' '+ports.raftHttp
  if(result.networkMembership === 'permissionedNodes'){
    cmd += ' permissionedNodes' 
  } else {
    cmd += ' allowAll'
  }
  cmd += ' '+result.communicationNetwork.raftID
  let child = exec(cmd, options)
  child.stdout.on('data', function(data){
	console.log('Arranque del Nodo: '+data)  
    cb(null, result)
  })
  child.stderr.on('data', function(error){
    console.log('ERROR:', error)
    cb(error, null)
  })
}

function handleExistingFiles(result, cb){
  if(result.keepExistingFiles == false){ 
    let seqFunction = async.seq(
      util.ClearDirectories,
      util.CreateDirectories,
      util.GetNewGethAccount,
      util.GenerateEnode,    
      util.DisplayEnode,
      constellation.CreateNewKeys, 
      constellation.CreateConfig
    )
    seqFunction(result, function(err, res){
      if (err) { return console.log('ERROR', err) }
      cb(null, res)
    })
  } else {
    cb(null, result)
  }
}

function handleNetworkConfiguration(result, cb){
  if(result.keepExistingFiles == false){ 
    let seqFunction = async.seq(
      whisper.RequestExistingRaftNetworkMembership,
      whisper.GetGenesisBlockConfig,
      whisper.GetStaticNodesFile
    )
    seqFunction(result, function(err, res){
      if (err) { return console.log('ERROR', err) }
      cb(null, res)
    })
  } else {
    fs.readFile('Blockchain/raftID', function(err, data){
      result.communicationNetwork.raftID = data 
      cb(null, result)
    })
  }
}

function joinRaftNetwork(config, cb){
  console.log('[*] Starting new network...')

  let nodeConfig = {
    localIpAddress: config.localIpAddress,
    remoteIpAddress : config.remoteIpAddress, 
    keepExistingFiles: config.keepExistingFiles,
    folders: ['Blockchain', 'Blockchain/geth', 'Constellation'], 
    constellationKeySetup: [
      {folderName: 'Constellation', fileName: 'node'},
      {folderName: 'Constellation', fileName: 'nodeArch'},
    ],
    constellationConfigSetup: { 
      configName: 'constellation.config', 
      folderName: 'Constellation', 
      localIpAddress : config.localIpAddress, 
      localPort : ports.constellation,
      remoteIpAddress : config.remoteIpAddress, 
      remotePort : ports.constellation,
      publicKeyFileName: 'node.pub', 
      privateKeyFileName: 'node.key', 
      publicArchKeyFileName: 'nodeArch.pub', 
      privateArchKeyFileName: 'nodeArch.key', 
    },
    "web3IPCHost": './Blockchain/geth.ipc',
    "web3RPCProvider": 'http://localhost:'+ports.gethNodeRPC,
    "web3WSRPCProvider": 'ws://localhost:'+ports.gethNodeWS_RPC,
    consensus: 'raft'
  }
	console.log('nodeConfig')
	
  let seqFunction = async.seq(
    handleExistingFiles,
    whisper.JoinCommunicationNetwork,
    handleNetworkConfiguration,
    startRaftNode,
    util.CreateWeb3Connection,
    whisper.AddEnodeResponseHandler,
    peerHandler.ListenForNewEnodes,
    whisper.AddEnodeRequestHandler,
    fundingHandler.MonitorAccountBalances,
    whisper.PublishNodeInformation
  )
	console.log('seqFunction')
  seqFunction(nodeConfig, function(err, res){
    if (err) { return console.log('ERROR', err) }
    console.log('[*] New network started')
	console.log(res)
    cb(err, res)
  })
}

function getRemoteIpAddress(cb){
  if(setup.automatedSetup === true){
    cb(setup.remoteIpAddress)
  } else {
    console.log('In order to join the network, please enter the ip address of the coordinating node')
    prompt.get(['ipAddress'], function (err, network) {
      cb(network.ipAddress)
    })
  } 
}


function handleJoiningRaftNetwork(options, cb){
  config = {}
  config.localIpAddress = options.localIpAddress
  config.keepExistingFiles = options.keepExistingFiles
  console.log('Dentro de handleJoiningRaftNetwork options vale: ' +options)
  getRemoteIpAddress(function(remoteIpAddress){
    config.remoteIpAddress = remoteIpAddress
	console.log('Se va a conectar con la siguiente IP del Coordinator: ' +options)
    joinRaftNetwork(config, function(err, result){
      if (err) { return console.log('ERROR', err) }
      let networks = {
        raftNetwork: Object.assign({}, result),
        communicationNetwork: config.communicationNetwork
      }
	  console.log('---networks---')
	  console.log('networks.raftNetwork: '+networks.raftNetwork)
	  console.log('networks.communicationNetwork: ' +networks.communicationNetwork)
	  console.log('---FIN networks---')
      cb(err, networks)
    })
  })
}

function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

exports.HandleJoiningRaftNetwork = handleJoiningRaftNetwork
