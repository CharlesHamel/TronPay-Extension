/**
 * inject tronPay and tronweb to global window
 */
import { EncryptedStream } from 'extension-streams'
import IdGenerator from '../lib/IdGenerator'
import * as MessageTypes from '../messages/MessageTypes'
import TronWeb from 'tronweb'
import utils from '../lib/utils'
import ExtensionHttpProvider from '../lib/ExtensionHttpProvider'
import Message from '../messages/Message'
import * as TabMessageTypes from '../messages/TabsMessageTypes'
import manifest from '../manifest'
/***
 * This is just a helper to manage resolving fake-async
 * requests using browser messaging.
 */
class DanglingResolver {
  constructor (_id, _resolve, _reject) {
    this.id = _id
    this.resolve = _resolve
    this.reject = _reject
  }
}

const tronWeb = new TronWeb(
  new ExtensionHttpProvider('http://placeholder.dev'),
  new ExtensionHttpProvider('http://placeholder.dev')
)

let stream = new WeakMap()
let resolvers = []

const eventQueue = []

tronWeb.eventServer = true
tronWeb.ready = false
tronWeb.isTronPay = true

const _sign = tronWeb.trx.sign.bind(tronWeb)
const _setAddress = tronWeb.setAddress.bind(tronWeb)
const _setEventServer = tronWeb.setEventServer.bind(tronWeb)
const _getEventResult = tronWeb.getEventResult.bind(tronWeb)
const _getEventByTransactionID = tronWeb.getEventByTransactionID.bind(tronWeb)

const _subscribe = () => {
  stream.listenWith(msg => {
    if (!msg || !msg.hasOwnProperty('type')) return false
    for (let i = 0; i < resolvers.length; i++) {
      if (resolvers[i].id === msg.resolver) {
        if (msg.type === 'error') resolvers[i].reject(msg.payload)
        else resolvers[i].resolve(msg.payload)
        resolvers = resolvers.slice(i, 1)
      }
    }
  })
}

const _send = (_type, _payload) => {
  return new Promise((resolve, reject) => {
    let id = IdGenerator.numeric(24)
    let message = new Message(_type, _payload, id)
    resolvers.push(new DanglingResolver(id, resolve, reject))
    stream.send(message, MessageTypes.CONTENT)
  })
}

tronWeb.setPrivateKey = () => console.warn('Setting private key disabled in TronPay')
tronWeb.setAddress = () => console.warn('Setting address disabled in TronPay')
tronWeb.setFullNode = () => console.warn('Setting full node disabled in TronPay')
tronWeb.setSolidityNode = () => console.warn('Setting solidity node disabled in TronPay')
tronWeb.setEventServer = () => console.warn('Setting event server disabled in TronPay')

Object.entries({
  getEventResult: _getEventResult,
  getEventByTransactionID: _getEventByTransactionID
}).forEach(([funcName, func]) => {
  tronWeb[funcName] = (...args) => {
    if (tronWeb.eventServer) return func(...args)
    let promise = false
    let success = false
    let failure = false
    if (!args.length || typeof args[args.length - 1] !== 'function') {
      promise = new Promise((resolve, reject) => {
        success = resolve
        failure = reject
      })
    }

    const callback = !promise && args[args.length - 1]
    eventQueue.push({
      success: success || callback.bind(false),
      failure: failure || callback,
      args,
      func
    })

    if (promise) return promise
  }
})

// custom sign
const customSignFunction = (transaction = false, privateKey = false, callbackFunc = false) => {
  if (utils.isFunction(privateKey)) {
    callbackFunc = privateKey
    privateKey = false
  }
  if (!callbackFunc) {
    return utils.injectPromise(customSignFunction, transaction, privateKey)
  }
  if (privateKey) {
    return _sign(transaction, privateKey, callbackFunc)
  }
  if (!transaction) return callbackFunc('Invalid transaction provided')
  if (!tronWeb.ready) return callbackFunc('User has not unlocked TronPay')
  console.info('request signTransaction: ')
  console.info(transaction)
  _send(MessageTypes.SIGNATURE, {
    transaction,
    input: transaction.__payload__ || transaction.raw_data.contract[0].parameter.value,
    domain: utils.strippedHost()
  }).then(transaction => callbackFunc(null, transaction)).catch(err => {
    callbackFunc(err)
  })
}

tronWeb.trx.sign = customSignFunction
tronWeb.trx.signTransaction = customSignFunction

tronWeb.on('addressChanged', () => {
  console.info('tronPay current account: ', tronWeb.defaultAddress.base58)
})

export class TronPay {
  constructor () {
    this.ready = false
    this.tronWeb = false
    this.version = manifest.version
  }
  /**
   * call unlock tronPay
   */
  async unLock () {
    console.warn('not support yet')
  }
}

const tronPay = new TronPay()
tronPay.tronWeb = tronWeb

export default class Content {
  constructor () {
    // Injecting an encrypted stream into the web application
    stream = new EncryptedStream(MessageTypes.INJECTED, IdGenerator.text(64))
    stream.listenWith((msg) => this.contentListener(msg))
    // Syncing the streams between the extension and the web application
    stream.sync(MessageTypes.CONTENT, stream.key)

    if (window.tronPay !== undefined) {
      return console.warn('Failed to inject TronPay, The global namespace is exists')
    }
    window.tronPay = tronPay
    window.tronWeb = tronWeb
    _subscribe()
  }
  contentListener (msg) {
    if (!msg) return
    // Always including the domain for every request.
    msg.domain = utils.strippedHost()
    let nonSyncMessage = Message.fromJson(msg)
    switch (msg.type) {
      case MessageTypes.INIT_TRONWEB:
        this.initTronWeb(nonSyncMessage)
        break
      case MessageTypes.SET_NODE:
        this.setNode(nonSyncMessage)
        break
      case MessageTypes.SET_ADDRESS:
        this.setAddress(nonSyncMessage)
        break
      case TabMessageTypes.LOCK_STAUS:
        this.setlockStatus(nonSyncMessage)
        break
      case TabMessageTypes.ADDRESS_CHANGED:
        this.setAddress(nonSyncMessage)
        break
      case TabMessageTypes.NETWORK_CHANGED:
        this.setNetWork(nonSyncMessage)
        break
    }
  }
  initTronWeb (message) {
    console.log('tronPay init tronWeb')
    const payload = message.payload
    tronWeb.fullNode.setURL(payload.node.fullNode)
    tronWeb.solidityNode.setURL(payload.node.solidityNode)
    _setEventServer(payload.node.eventServer)
    if (payload.address) {
      _setAddress(payload.address)
      tronWeb.ready = true
      tronPay.ready = true
    }
    eventQueue.forEach(({ resolve, reject, args, func }, index) => {
      func(...args)
        .then(resolve)
        .catch(reject)
        .then(() => (
          console.log(`Event request #${index + 1} completed`)
        ))
    })
  }
  setNode (message) {
    const payload = message.payload
    tronWeb.fullNode.setUrl(payload.fullNode)
    tronWeb.solidityNode.setURL(payload.solidityNode)
    _setEventServer(payload.eventServer)
  }
  setAddress (message) {
    const payload = message.payload
    _setAddress(payload.address)
    tronWeb.ready = true
    tronPay.ready = true
  }
  setNetWork (message) {
    const payload = message.payload
    tronWeb.fullNode.setURL(payload.network.fullNodeUrl)
    tronWeb.solidityNode.setURL(payload.network.solidityUrl)
    _setEventServer(payload.network.eventGridUrl)
    console.info('tronWeb network changed: ')
    console.info(payload.network)
  }
  setlockStatus (message) {
    const payload = message.payload
    if (payload.unlocked) {
      console.info('tronPay is unlocked')
    } else {
      tronWeb.ready = false
      tronPay.ready = false
      console.info('tronPay is locked')
    }
  }
}
// eslint-disable-next-line
new Content()
