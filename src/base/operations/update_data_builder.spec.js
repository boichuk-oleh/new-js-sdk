import { UpdateDataBuilder } from './update_data_builder'
import xdr from '../generated/xdr_generated'
import { Operation } from '../operation'

describe.only('update data in blockchain', () => {
  it('success', () => {
    let source = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ'
    let roleID = '1'
    let dataId = '235'
    let value = '23'
    let signersData = [
      {
        roleID: roleID,
        publicKey: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
        weight: '8',
        identity: '2',
        details: {}
      }
    ]
    let op = UpdateDataBuilder.updateData({
      source,
      dataId,
      value,
      signersData
    })
    let opXdr = op.toXDR('hex')
    let operation = xdr.Operation.fromXDR(Buffer.from(opXdr, 'hex'))
    let obj = Operation.operationToObject(operation)
    expect(obj.type).to.be.equal('updateDatum')
  })
})
