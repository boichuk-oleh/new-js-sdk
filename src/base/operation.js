import xdr from './generated/xdr_generated'
import { Keypair } from './keypair'
import { UnsignedHyper, Hyper } from 'js-xdr'
import { hash } from './hashing'
import { encodeCheck } from './strkey'
import isUndefined from 'lodash/isUndefined'
import { BaseOperation } from './operations/base_operation'
import { ManageSignerBuilder } from './operations/manage_signer_builder'
import { CreateAccountBuilder } from './operations/create_account_builder'
import { ManageKeyValueBuilder } from './operations/manage_key_value_builder'
import { StampBuilder } from './operations/stamp'
import { LicenseBuilder } from './operations/license_operation'
import { ManageAccountRoleBuilder } from './operations/manage_account_role_builder'
import { CreateDataBuilder } from './operations/create_data_builder'
import { UpdateDataBuilder } from './operations/update_data_builder'
import { RemoveDataBuilder } from './operations/remove_data_builder'
import { ManageCreatePollRequestBuilder } from './operations/manage_create_poll_request_builder'
import { ReviewRequestBuilder } from './operations/review_request_builder'
import { BindExternalSystemAccountIdBuilder } from './operations/bind_external_system_account_id_builder'
import { CancelAtomicSwapAskBuilder } from './operations/cancel_atomic_swap_ask_builder'
import { CancelChangeRoleRequestBuilder } from './operations/cancel_change_role_request_builder'
import { CloseSwapBuilder } from './operations/close_swap_builder'
import { CreateAMLRequestBuilder } from './operations/create_aml_request_builder'
import { CreateAtomicSwapAskRequestBuilder } from './operations/create_atomic_swap_ask_request_builder'
import { CreateAtomicSwapBidRequestBuilder } from './operations/create_atomic_swap_bid_request_builder'
import { CreateChangeRoleRequestBuilder } from './operations/create_change_role_request_builder'
import { CreateIssuanceRequestBuilder } from './operations/create_issuance_request_builder'
import { CreateKYCRecoveryRequestBuilder } from './operations/create_kyc_recovery_request_builder'
import { CreateManageLimitsRequestBuilder } from './operations/create_manage_limits_request_builder'
import { CreateManageOfferRequestBuilder } from './operations/create_manage_offer_request_builder'
import { CreatePaymentRequestBuilder } from './operations/create_payment_request_builder'
import { CreateWithdrawRequestBuilder } from './operations/create_withdraw_request_builder'
import { InitiateKYCRecoveryBuilder } from './operations/initiate_kyc_recovery_builder'
import { ManageAssetBuilder } from './operations/manage_asset_builder'
import { ManageLimitsBuilder } from './operations/manage_limits_builder'
import { ManageOfferBuilder } from './operations/manage_offer_builder'
import { ManagePollBuilder } from './operations/manage_poll_builder'
import { ManageSaleBuilder } from './operations/manage_sale_builder'
import { ManageVoteBuilder } from './operations/manage_vote_builder'
import { OpenSwapBuilder } from './operations/open_swap_builder'
import { PaymentBuilder } from './operations/payment_builder'
import { PreIssuanceRequestOpBuilder } from './operations/pre_issuance_request_op_builder'
import { RedemptionRequestBuilder } from './operations/redemption_request_op_builder'
import { RemoveAssetOpBuilder } from './operations/remove_asset_op_builder'
import { RemoveAssetPairOpBuilder } from './operations/remove_asset_pair_op_builder'
import { ManageSignerRoleBuilder } from './operations/manage_signer_role_builder'
import { CreateDeferredPaymentCreationRequestBuilder } from './operations/create_deferred_payment_creation_request'
import { CreateCloseDeferredPaymentRequestBuilder } from './operations/create_close_deferred_payment_request'
import { DataRequestBuilder } from './operations/data_request_builder'

export class Operation extends BaseOperation {
  /**
     * Create a payment operation.
     * @param {object} opts
     * @param {string} opts.sourceBalanceId - The balance id of source.
     * @param {string} opts.destinationBalanceId - The destination balance ID.
     * @param {boolean} opts.feeFromSource - if true - fee charged from source account, if false - from destination
     * @param {string} opts.amount - The amount to send.
     * @param {string} opts.paymentFee - The payment fee.
     * @param {string} opts.fixedFee - The fixed fee.
     * @param {string} [opts.source] - The source account for the payment. Defaults to the transaction's source account.
     * @returns {xdr.PaymentOp}
     */
  static payment (opts) {
    let attributes = {}
    if (!Operation.isValidAmount(opts.amount)) {
      throw new TypeError('amount argument must be of type String and represent a positive number')
    }
    if (!Keypair.isValidBalanceKey(opts.sourceBalanceId)) {
      throw new TypeError('sourceBalanceId is invalid')
    }
    if (!Keypair.isValidBalanceKey(opts.destinationBalanceId)) {
      throw new TypeError('destinationBalanceId is invalid')
    }
    if (!Operation.isValidSubject(opts.subject)) {
      throw new Error('subject argument must be of type String 0-256 long')
    }

    if (!isUndefined(opts.feeData)) {
      let sourceFee = new xdr.Fee({
        percent: BaseOperation._toUnsignedXDRAmount(opts.feeData.sourceFee.percent),
        fixed: BaseOperation._toUnsignedXDRAmount(opts.feeData.sourceFee.fixed),
        ext: new xdr.FeeExt(xdr.LedgerVersion.emptyVersion())
      })
      let destinationFee = new xdr.Fee({
        percent: BaseOperation._toUnsignedXDRAmount(opts.feeData.destinationFee.percent),
        fixed: BaseOperation._toUnsignedXDRAmount(opts.feeData.destinationFee.fixed),
        ext: new xdr.FeeExt(xdr.LedgerVersion.emptyVersion())
      })
      attributes.feeData = new xdr.PaymentFeeData({
        sourceFee,
        destinationFee,
        sourcePaysForDest: opts.feeData.sourcePaysForDest,
        ext: new xdr.PaymentFeeDataExt(xdr.LedgerVersion.emptyVersion())
      })
    } else {
      throw new Error('feeData argument must be defined')
    }

    if (isUndefined(opts.reference)) {
      opts.reference = ''
    }

    attributes.amount = BaseOperation._toUnsignedXDRAmount(opts.amount)
    attributes.sourceBalanceId = Keypair
      .fromBalanceId(opts.sourceBalanceId)
      .xdrBalanceId()

    let d = xdr.PaymentOpDestination.balance()
    d.set('balance', Keypair
      .fromBalanceId(opts.destinationBalanceId)
      .xdrBalanceId())
    attributes.destination = d

    attributes.subject = opts.subject
    attributes.reference = opts.reference
    attributes.ext = new xdr.PaymentOpExt(xdr.LedgerVersion.emptyVersion())
    let payment = new xdr.PaymentOp(attributes)

    let opAttributes = {}
    opAttributes.body = xdr.OperationBody.payment(payment)
    Operation.setSourceAccount(opAttributes, opts)
    return new xdr.Operation(opAttributes)
  }

  /**
   * Set Fees to the ledger
   * @param {object} opts
   * @param {string} opts.destination - Destination account ID to create an account for.
   * @param {Object} [opts.fee] - Amount in XLM the account should be funded for.
   * @param {string} opts.fee.feeType - feeType
   * @param {string} opts.fee.feeAmount - fee amount
   * @param {string} opts.fee.accountRole - id of account role
   * @param {bool} [opts.isDelete] - isDelete - true for remove fee
   * @param {string} [opts.source] - The source account for the payment. Defaults to the transaction's source account.
   * @returns {xdr.SetFeesOp}
   */
  static setFees (opts) {
    let attributes = {
      ext: new xdr.SetFeesOpExt(xdr.LedgerVersion.emptyVersion())
    }

    if (!isUndefined(opts.fee)) {
      if (!Operation.isValidAmount(opts.fee.fixedFee, true)) {
        throw new TypeError(
          'fixedFee argument must be of type String and represent a non-negative number'
        )
      }
      if (!Operation.isValidAmount(opts.fee.percentFee, true, 100)) {
        throw new TypeError(
          'percentFee argument must be of type String and represent a non-negative number less than 100'
        )
      }
      if (isUndefined(opts.fee.feeType)) {
        throw new TypeError('feeType must be defined')
      }
      if (!(opts.fee.feeType instanceof xdr.FeeType)) {
        throw new TypeError('feeType must be xdr.FeeType')
      }
      if (!Operation.isValidAsset(opts.fee.asset)) {
        throw new TypeError('Asset is invalid')
      }
      if (isUndefined(opts.fee.period)) {
        opts.fee.period = '0' // <<clear
      }
      if (isUndefined(opts.fee.subtype)) {
        opts.fee.subtype = '0'
      }
      if (isUndefined(opts.fee.lowerBound)) {
        opts.fee.lowerBound = '0'
      }
      if (isUndefined(opts.fee.upperBound)) {
        opts.fee.upperBound = BaseOperation.MAX_INT64_AMOUNT
      }

      let feeData = {
        fixedFee: Operation._toXDRAmount(opts.fee.fixedFee),
        percentFee: Operation._toXDRAmount(opts.fee.percentFee),
        feeType: opts.fee.feeType,
        asset: opts.fee.asset,
        subtype: Hyper.fromString(opts.fee.subtype),
        lowerBound: Operation._toXDRAmount(opts.fee.lowerBound),
        upperBound: Operation._toXDRAmount(opts.fee.upperBound),
        ext: new xdr.FeeEntryExt(xdr.LedgerVersion.emptyVersion())
      }
      let data = `type:${opts.fee.feeType.value}asset:${opts.fee.asset}subtype:${opts.fee.subtype.toString()}`
      if (opts.fee.accountId) {
        if (!Keypair.isValidPublicKey(opts.fee.accountId)) {
          throw new TypeError('accountId is invalid')
        } else {
          feeData.accountId = Keypair
            .fromAccountId(opts.fee.accountId)
            .xdrAccountId()
          data += `accountID:${opts.fee.accountId}`
        }
      }
      if (opts.fee.accountRole) {
        feeData.accountRole = UnsignedHyper.fromString(opts.fee.accountRole)
        data += `accountRole:${opts.fee.accountRole}`
      }
      feeData.hash = hash(data)
      attributes.fee = new xdr.FeeEntry(feeData)
    }

    if (isUndefined(opts.isDelete)) {
      attributes.isDelete = false
    } else {
      attributes.isDelete = opts.isDelete
    }

    let setfees = new xdr.SetFeesOp(attributes)
    let opAttributes = {}
    opAttributes.body = xdr.OperationBody.setFee(setfees)
    Operation.setSourceAccount(opAttributes, opts)
    return new xdr.Operation(opAttributes)
  }

  /**
     * Returns an XDR ManageBalanceOp. A "manage account" operations creates|deletes balance for account.
     * @param {object} opts
     * @param {string} opts.destination - Account to create account for.
     * @param {string} opts.asset - Asset to manage asset for.
     * @param {xdr.ManageBalanceAction} – Delete or create
     * @returns {xdr.ManageBalanceOp}
     */
  static manageBalance (opts) {
    let attributes = {
      ext: new xdr.ManageBalanceOpExt(xdr.LedgerVersion.emptyVersion())
    }

    if (!Keypair.isValidPublicKey(opts.destination)) {
      throw new Error('account is invalid')
    }
    if (!(opts.action instanceof xdr.ManageBalanceAction)) {
      throw new TypeError('action argument should be value of xdr.ManageBalanceAction enum')
    }
    if (!Operation.isValidAsset(opts.asset)) {
      throw new TypeError('asset is invalid')
    }

    attributes.destination = Keypair
      .fromAccountId(opts.destination)
      .xdrAccountId()
    attributes.action = opts.action
    attributes.asset = opts.asset

    let manageBalanceOp = new xdr.ManageBalanceOp(attributes)

    let opAttributes = {}
    opAttributes.body = xdr.OperationBody.manageBalance(manageBalanceOp)
    Operation.setSourceAccount(opAttributes, opts)
    return new xdr.Operation(opAttributes)
  }

  /**
     * Returns an XDR ManageAssetPairOp. A "manage asset pair" operations creates|updates asset pair.
     * @param {object} opts
     * @param {string} opts.base - base asset
     * @param {string} opts.quote - quote asset
     * @param {number|string} opts.policies - asset pair policies
     * @param {number|string} opts.physicalPriceCorrection - correction of physical price in percents. If physical price is set and restriction by physical price set, mininal price for offer for this pair will be physicalPrice * physicalPriceCorrection
     * @param {number|string} opts.maxPriceStep - max price step in percent. User is allowed to set offer with price < (1 - maxPriceStep)*currentPrice and > (1 + maxPriceStep)*currentPrice
     * @param {number|string} opts.physicalPrice - physical price
     * @param {xdr.ManageAssetPairAction} – Create or update
     * @returns {xdr.ManageBalanceOp}
     */
  static manageAssetPair (opts) {
    let attributes = {
      ext: new xdr.ManageAssetPairOpExt(xdr.LedgerVersion.emptyVersion())
    }
    if (!Operation.isValidAsset(opts.base)) {
      throw new TypeError('base is invalid')
    }

    if (!Operation.isValidAsset(opts.quote)) {
      throw new TypeError('quote is invalid')
    }

    if (!(opts.action instanceof xdr.ManageAssetPairAction)) {
      throw new TypeError(
        'action argument should be value of xdr.ManageAssetPairAction enum'
      )
    }

    if (isUndefined(opts.policies)) {
      throw new TypeError('policies are not defined')
    }

    if (!Operation.isValidAmount(opts.physicalPriceCorrection, true)) {
      throw new TypeError(
        'physicalPriceCorrection argument must be of type String and represent a positive number or zero'
      )
    }

    if (!Operation.isValidAmount(opts.maxPriceStep, true)) {
      throw new TypeError(
        'maxPriceStep argument must be of type String and represent a positive number or zero'
      )
    }

    if (!Operation.isValidAmount(opts.physicalPrice, true)) {
      throw new TypeError(
        'physicalPrice argument must be of type String and represent a positive number or zero'
      )
    }

    attributes.base = opts.base
    attributes.quote = opts.quote
    attributes.policies = opts.policies
    attributes.action = opts.action
    attributes.physicalPriceCorrection = Operation
      ._toXDRAmount(opts.physicalPriceCorrection)
    // won't be updated
    attributes.physicalPrice = Operation._toXDRAmount(opts.physicalPrice)
    attributes.maxPriceStep = Operation._toXDRAmount(opts.maxPriceStep)

    let manageAssetPairOp = new xdr.ManageAssetPairOp(attributes)

    let opAttributes = {}
    opAttributes.body = xdr.OperationBody.manageAssetPair(manageAssetPairOp)
    Operation.setSourceAccount(opAttributes, opts)
    return new xdr.Operation(opAttributes)
  }

  /**
     * Converts the XDR Operation object to the opts object used to create the XDR
     * operation.
     * @param {xdr.Operation} operation - An XDR Operation.
     * @return {Operation}
     */
  static operationToObject (operation) {
    function accountIdtoAddress (accountId) {
      return encodeCheck('accountId', accountId.ed25519())
    }

    let result = {}
    if (operation.sourceAccount()) {
      result.source = accountIdtoAddress(operation.sourceAccount())
    }

    let attrs = operation.body().value()
    result.type = operation.body().switch().name
    switch (operation.body().switch()) {
      case xdr.OperationType.createAccount():
        CreateAccountBuilder.createAccountToObject(result, attrs)
        break
      case xdr.OperationType.manageSigner():
        ManageSignerBuilder.manageSignerToObject(result, attrs)
        break
      case xdr.OperationType.manageKeyValue():
        ManageKeyValueBuilder.manageKeyValueOpToObject(result, attrs)
        break
      case xdr.OperationType.stamp():
        StampBuilder.stampToObject(result, attrs)
        break
      case xdr.OperationType.license():
        LicenseBuilder.licenseToObject(result, attrs)
        break
      case xdr.OperationType.manageAccountRole():
        ManageAccountRoleBuilder.manageAccountRoleToObject(result, attrs)
        break
      case xdr.OperationType.createDatum():
        CreateDataBuilder.createDataToObject(result, attrs)
        break
      case xdr.OperationType.updateDatum():
        UpdateDataBuilder.updateDataToObject(result, attrs)
        break
      case xdr.OperationType.removeDatum():
        RemoveDataBuilder.removeDataToObject(result, attrs)
        break
      case xdr.OperationType.manageCreatePollRequest():
        ManageCreatePollRequestBuilder.manageCreatePollRequestToObject(result, attrs)
        break
      case xdr.OperationType.reviewRequest():
        ReviewRequestBuilder.reviewRequestToObject(result, attrs)
        break
      case xdr.OperationType.bindExternalSystemAccountId():
        BindExternalSystemAccountIdBuilder.bindExternalSystemAccountIdToObject(result, attrs)
        break
      case xdr.OperationType.cancelAtomicSwapAsk():
        CancelAtomicSwapAskBuilder.cancelAtomicSwapAskToObject(result, attrs)
        break
      case xdr.OperationType.cancelChangeRoleRequest():
        CancelChangeRoleRequestBuilder.cancelChangeRoleRequestToObject(result, attrs)
        break
      case xdr.OperationType.closeSwap():
        CloseSwapBuilder.closeSwapToObject(result, attrs)
        break
      case xdr.OperationType.createAmlAlert():
        CreateAMLRequestBuilder.createAmlAlertToObject(result, attrs)
        break
      case xdr.OperationType.createAtomicSwapAskRequest():
        CreateAtomicSwapAskRequestBuilder.createAtomicSwapAskRequestToObject(result, attrs)
        break
      case xdr.OperationType.createAtomicSwapBidRequest():
        CreateAtomicSwapBidRequestBuilder.createAtomicSwapBidRequestToObject(result, attrs)
        break
      case xdr.OperationType.createChangeRoleRequest():
        CreateChangeRoleRequestBuilder.createChangeRoleRequestOpToObject(result, attrs)
        break
      case xdr.OperationType.createIssuanceRequest():
        CreateIssuanceRequestBuilder.createIssuanceRequestOpToObject(result, attrs)
        break
      case xdr.OperationType.createKycRecoveryRequest():
        CreateKYCRecoveryRequestBuilder.createKYCRecoveryRequestOpToObject(result, attrs)
        break
      case xdr.OperationType.createManageLimitsRequest():
        CreateManageLimitsRequestBuilder.createManageLimitsRequestToObject(result, attrs)
        break
      case xdr.OperationType.createManageOfferRequest():
        CreateManageOfferRequestBuilder.createManageOfferRequestToObject(result, attrs)
        break
      case xdr.OperationType.createPaymentRequest():
        CreatePaymentRequestBuilder.createPaymentRequestToObject(result, attrs)
        break
      case xdr.OperationType.createWithdrawalRequest():
        CreateWithdrawRequestBuilder.createWithdrawalRequestOpToObject(result, attrs)
        break
      case xdr.OperationType.initiateKycRecovery():
        InitiateKYCRecoveryBuilder.initiateKYCRecoveryToObject(result, attrs)
        break
      case xdr.OperationType.manageAsset():
        ManageAssetBuilder.manageAssetToObject(result, attrs)
        break
      case xdr.OperationType.manageLimit():
        ManageLimitsBuilder.manageLimitsOpToObject(result, attrs)
        break
      case xdr.OperationType.manageOffer():
        ManageOfferBuilder.manageOfferOpToObject(result, attrs)
        break
      case xdr.OperationType.managePoll():
        ManagePollBuilder.managePollToObject(result, attrs)
        break
      case xdr.OperationType.manageSale():
        ManageSaleBuilder.manageSaleToObject(result, attrs)
        break
      case xdr.OperationType.manageVote():
        ManageVoteBuilder.manageVoteToObject(result, attrs)
        break
      case xdr.OperationType.openSwap():
        OpenSwapBuilder.openSwapToObject(result, attrs)
        break
      case xdr.OperationType.payment():
        PaymentBuilder.paymentToObject(result, attrs)
        break
      case xdr.OperationType.createPreissuanceRequest():
        PreIssuanceRequestOpBuilder.preIssuanceRequestOpToObject(result, attrs)
        break
      case xdr.OperationType.createRedemptionRequest():
        RedemptionRequestBuilder.redemptionRequestToObject(result, attrs)
        break
      case xdr.OperationType.removeAsset():
        RemoveAssetOpBuilder.removeAssetOpToObject(result, attrs)
        break
      case xdr.OperationType.removeAssetPair():
        RemoveAssetPairOpBuilder.removeAssetPairOpToObject(result, attrs)
        break
      case xdr.OperationType.manageSignerRole():
        ManageSignerRoleBuilder.manageSignerRoleToObject(result, attrs)
        break
      case xdr.OperationType.createDeferredPaymentCreationRequest():
        CreateDeferredPaymentCreationRequestBuilder
          .createDeferredPaymentCreationRequestToObject(result, attrs)
        break
      case xdr.OperationType.cancelDeferredPaymentCreationRequest():
        CreateDeferredPaymentCreationRequestBuilder
          .cancelDeferredPaymentCreationRequestToObject(result, attrs)
        break
      case xdr.OperationType.createCloseDeferredPaymentRequest():
        CreateCloseDeferredPaymentRequestBuilder
          .createCloseDeferredPaymentRequestToObject(result, attrs)
        break
      case xdr.OperationType.cancelCloseDeferredPaymentRequest():
        CreateCloseDeferredPaymentRequestBuilder
          .cancelCloseDeferredPaymentRequestToObject(result, attrs)
        break
      case xdr.OperationType.createSaleRequest():
        break
      case xdr.OperationType.createDataCreationRequest():
        DataRequestBuilder.createDataCreationRequestToObject(result, attrs)
        break
      case xdr.OperationType.cancelDataCreationRequest():
        DataRequestBuilder.cancelDataCreationRequestToObject(result, attrs)
        break
      case xdr.OperationType.createDataUpdateRequest():
        DataRequestBuilder.createDataUpdateRequestToObject(result, attrs)
        break
      case xdr.OperationType.cancelDataUpdateRequest():
        DataRequestBuilder.cancelDataUpdateRequestToObject(result, attrs)
        break
      case xdr.OperationType.createDataRemoveRequest():
        DataRequestBuilder.createDataRemoveRequestToObject(result, attrs)
        break
      case xdr.OperationType.cancelDataRemoveRequest():
        DataRequestBuilder.cancelDataRemoveRequestToObject(result, attrs)
        break
      case xdr.OperationType.manageAssetPair():
        // TODO
        break
      case xdr.OperationType.manageBalance():
        // TODO
        break
      default:
        throw new Error('Unknown operation ' + operation.body().switch().name)
    }
    return result
  }
}
