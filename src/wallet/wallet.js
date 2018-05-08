import { Keypair, hash } from '../base'
import sjcl from 'sjcl'
import * as crypto from './crypto'
import { isNil, isNumber, isString } from 'lodash'

const SIGNATURE_VALID_SEC = 60

/**
 * Manages user's key pair.
 *
 * @class
 */
export class Wallet {
  /**
   * Create a new instance from user's key pair.
   *
   * @constructor
   *
   * @param {string} email User's email.
   * @param {Keypair|string} keypair User's key pair or a secret seed.
   * @param {string} accountId User's account ID.
   * @param {string} [walletId] Wallet ID.
   */
  constructor (email, keypair, accountId, walletId) {
    if (isNil(email)) {
      throw new Error('Email is required.')
    }

    if (isNil(keypair)) {
      throw new Error('No keypair provided.')
    } else if (isString(keypair)) {
      if (!Keypair.isValidSecretKey(keypair)) {
        throw new Error('Invalid secret seed.')
      }
      keypair = Keypair.fromSecret(keypair)
    } else if (!(keypair instanceof Keypair)) {
      throw new Error('Invalid keypair. Expected a Keypair instance or a string seed.')
    }

    if (!Keypair.isValidPublicKey(accountId)) {
      throw new Error('Invalid account ID.')
    }

    if (walletId && !isString(walletId)) {
      throw new Error('Hex encoded wallet ID expected.')
    }

    this._email = email
    this._keypair = keypair
    this._accountId = accountId
    this._id = walletId
    this._clockDiff = 0
  }

  /**
   * Generate a new wallet.
   *
   * @param {string} email User's email.
   * @return {Wallet} The new wallet.
   */
  static generate (email) {
    let keypair = Keypair.random()

    return new Wallet(
      email,
      keypair,
      keypair.accountId()
    )
  }

  /**
   * Decrypt a wallet obtained from a wallet server.
   *
   * @param {object} keychainData Encrypted wallet seed.
   * @param {object} kdfParams Scrypt params used for encryption.
   * @param {string} salt Salt used for encryption.
   * @param {string} email User's email.
   * @param {string} password User's password.
   */
  static fromEncrypted (keychainData, kdfParams, salt, email, password) {
    let rawMasterKey = crypto.calculateMasterKey(
      salt,
      email,
      password,
      kdfParams
    )
    let rawWalletId = crypto.deriveWalletId(rawMasterKey)
    let rawWalletKey = crypto.deriveWalletKey(rawMasterKey)
    let decryptedKeychain = JSON.parse(
      crypto.decryptData(keychainData, rawWalletKey)
    )

    return new Wallet(
      email,
      Keypair.fromSecret(decryptedKeychain.seed),
      decryptedKeychain.accountId,
      sjcl.codec.hex.fromBits(rawWalletId)
    )
  }

  /**
   * Restore recovery wallet from a recovery seed.
   *
   * @param {object} kdfParams Scrypt params.
   * @param {string} salt Salt used for encryption.
   * @param {string} email User's email.
   * @param {string} recoverySeed User's recovery seed.
   */
  static fromRecoverySeed (kdfParams, salt, email, recoverySeed) {
    let recoveryKeypair = Keypair.fromSecret(recoverySeed)
    let walletId = Wallet.deriveId(email, recoverySeed, kdfParams, salt)

    return new Wallet(
      email,
      recoveryKeypair,
      recoveryKeypair.accountId(),
      walletId
    )
  }

  /**
   * Derive the wallet ID.
   *
   * @param {string} email
   * @param {string} password
   * @param {object} kdfParams
   * @param {string} salt
   *
   * @return {string} Wallet ID.
   */
  static deriveId (email, password, kdfParams, salt) {
    let masterKey = crypto.calculateMasterKey(salt, email, password, kdfParams)
    let walletId = crypto.deriveWalletId(masterKey)

    return sjcl.codec.hex.fromBits(walletId)
  }

  /**
   * Wallet ID.
   */
  get id () {
    if (!this._id) {
      throw new Error('This wallet has no wallet ID yet.')
    }

    return this._id
  }

  /**
   * Account ID.
   */
  get accountId () {
    return this._accountId
  }

  /**
   * Email used for login.
   */
  get email () {
    return this._email
  }

  /**
   * Secret seed.
   */
  get secretSeed () {
    return this._keypair.secret()
  }

  /**
   * Get signing keypair.
   */
  get keypair () {
    return this._keypair
  }

  /**
   * Make an axios.js config that authorizes request to the given resource.
   *
   * @param {string} uri Relative request URI.
   * @return {Object} Axios.js request config.
   */
  signRequest (uri) {
    if (!uri) {
      throw new Error('URI required.')
    }

    let validUntil = Math
      .floor(this._getTimestamp() + SIGNATURE_VALID_SEC)
      .toString()
    let signatureBase = `{ uri: '${uri}', valid_untill: '${validUntil.toString()}'}`
    console.log(signatureBase)
    let data = hash(signatureBase)
    let signature = this._keypair.signDecorated(data)

    return {
      headers: {
        'X-AuthValidUnTillTimestamp': validUntil.toString(),
        'X-AuthPublicKey': this._keypair.accountId(),
        'X-AuthSignature': signature.toXDR('base64')
      }
    }
  }

  /**
   * Encrypt wallet to securely store it.
   *
   * @param {object} kdfParams Scrypt params.
   * @param {string} password User's password.
   * @return {object} Encrypted keychain and metadata.
   */
  encrypt (kdfParams, password) {
    if (isNil(kdfParams)) {
      throw new Error('KDF params required')
    }
    if (!isString(password) || password.length === 0) {
      throw new TypeError('Password must be a non-empty string')
    }

    let salt = crypto.randomBytes(16).toString('base64')
    let masterKey = crypto.calculateMasterKey(
      salt,
      this.email,
      password,
      kdfParams
    )

    // Decrypt keychain
    let walletKey = crypto.deriveWalletKey(masterKey)
    let rawKeychainData = {
      accountId: this.accountId,
      seed: this._keypair.secret()
    }
    let keychainData = crypto.encryptData(
      JSON.stringify(rawKeychainData),
      walletKey
    )

    // Derive wallet ID
    let rawWalletId = crypto.deriveWalletId(masterKey)
    this._id = sjcl.codec.hex.fromBits(rawWalletId)

    return {
      id: this._id,
      accountId: this.accountId,
      email: this.email,
      salt,
      keychainData
    }
  }

  /**
   * Generate wallet recovery data.
   *
   * @param {object} kdfParams Scrypt params.
   * @param {Keypair} recoveryKeypair Recovery keypair.
   */
  encryptRecoveryData (kdfParams, recoveryKeypair) {
    let recoveryWallet = new Wallet(
      this.email,
      this._keypair,
      recoveryKeypair.accountId()
    )

    return recoveryWallet.encrypt(kdfParams, recoveryKeypair.secret())
  }

  /**
   * Synchronize time with backend.
   *
   * @param {Number} timestamp UNIX timestamp in seconds. Use it to sync time with the back-end.
   */
  synchronizeTime (timestamp) {
    if (isNil(timestamp) || !isNumber(timestamp)) {
      throw new TypeError('Invalid timestamp. A UNIX timestamp in seconds expected.')
    }
    let now = Date.now() / 1000
    this._clockDiff = now - timestamp
  }

  _getTimestamp () {
    return Math.floor(new Date().getTime() / 1000) - this._clockDiff
  }
}
