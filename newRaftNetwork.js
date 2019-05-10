let async = require('async')
let exec = require('child_process').exec

let whisper = require('./Communication/whisperNetwork.js')
let util = require('./util.js')
let peerHandler = require('./peerHandler.js')
let fundingHandler = require('./fundingHandler.js')
let ports = require('./config.js').ports
let setup = require('./config.js').setup
let service = require('./config.js').service

function startRaftNode(result, cb) {
  console.log('[*] Starting raft node...')
  let options = { encoding: 'utf8', timeout: 100 * 1000 }
  let ethstats = 'coordinator-' + create_UUID() + ':' + service.secret + '@' + service.name
  let cmd = './startRaftNode.sh'
  cmd += ' ' + ethstats
  cmd += ' ' + service.secret
  cmd += ' ' + setup.targetGasLimit
  cmd += ' ' + ports.gethNode
  cmd += ' ' + ports.gethNodeRPC
  cmd += ' ' + ports.gethNodeWS_RPC
  cmd += ' ' + ports.raftHttp
  if (result.networkMembership === 'permissionedNodes') {
    cmd += ' permissionedNodes'
  } else {
    cmd += ' allowAll'
  }
  let child = exec(cmd, options)
  child.stdout.on('data', function (data) {
    cb(null, result)
  })
  child.stderr.on('data', function (error) {
    console.log('Start raft node ERROR:', error)
    cb(error, null)
  })
}

function startNewRaftNetwork(config, cb) {
  console.log('[*] Starting new node...')

  let nodeConfig = {
    localIpAddress: config.localIpAddress,
    networkMembership: config.networkMembership,
    keepExistingFiles: config.keepExistingFiles,
    folders: ['Blockchain', 'Blockchain/geth', 'Constellation'],
    constellationKeySetup: [
      { folderName: 'Constellation', fileName: 'node' },
      { folderName: 'Constellation', fileName: 'nodeArch' },
    ],
    constellationConfigSetup: {
      configName: 'constellation.config',
      folderName: 'Constellation',
      localIpAddress: config.localIpAddress,
      localPort: ports.constellation,
      remoteIpAddress: null,
      remotePort: ports.constellation,
      publicKeyFileName: 'node.pub',
      privateKeyFileName: 'node.key',
      publicArchKeyFileName: 'nodeArch.pub',
      privateArchKeyFileName: 'nodeArch.key',
    },
    "web3IPCHost": './Blockchain/geth.ipc',
    "web3RPCProvider": 'http://localhost:' + ports.gethNodeRPC,
    "web3WSRPCProvider": 'ws://localhost:' + ports.gethNodeWS_RPC,
    consensus: 'raft'
  }

  let seqFunction = async.seq(
    util.handleExistingFiles,
    util.generateEnode,
    util.displayEnode,
    whisper.StartCommunicationNetwork,
    util.handleNetworkConfiguration,
    startRaftNode,
    util.CreateWeb3Connection,
    whisper.AddEnodeResponseHandler,
    peerHandler.ListenForNewEnodes,
    whisper.AddEtherResponseHandler,
    fundingHandler.MonitorAccountBalances,
    whisper.ExistingRaftNetworkMembership,
    whisper.PublishNodeInformation
  )

  seqFunction(nodeConfig, function (err, res) {
    if (err) { return console.log('ERROR', err) }
    console.log('[*] Done')
    cb(err, res)
  })
}

function handleStartingNewRaftNetwork(options, cb) {
  config = {}
  config.localIpAddress = options.localIpAddress
  config.networkMembership = options.networkMembership
  config.keepExistingFiles = options.keepExistingFiles
  startNewRaftNetwork(config, function (err, result) {
    if (err) { return console.log('ERROR', err) }
    config.raftNetwork = Object.assign({}, result)
    let networks = {
      raftNetwork: config.raftNetwork,
      communicationNetwork: config.communicationNetwork
    }
    cb(err, networks)
  })
}

function create_UUID() {
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

exports.HandleStartingNewRaftNetwork = handleStartingNewRaftNetwork
