export default {
  networks: [
    {
      id: 1,
      name: 'MainNet',
      transcanUrl: 'http://api.tronscan.org',
      fullNodeUrl: 'https://mainnet.tronpay.me',
      solidityUrl: 'https://mainnet.tronpay.me',
      eventGridUrl: 'https://mainnet.tronpay.me',
      AccountDetailUrl: 'https://tronscan.org/#/address',
      HistoryDetailUrl: 'https://tronscan.org/#/transaction',
      type: 'MainNet'
    },
    {
      id: 2,
      name: 'TestNet',
      transcanUrl: 'http://testapi.tronscan.org',
      fullNodeUrl: 'https://api.shasta.trongrid.io',
      solidityUrl: 'https://api.shasta.trongrid.io',
      eventGridUrl: 'https://api.shasta.trongrid.io',
      AccountDetailUrl: 'https://explorer.shasta.trongrid.io/address',
      HistoryDetailUrl: 'https://explorer.shasta.trongrid.io/transaction',
      type: 'TestNet'
    },
    {
      id: 3,
      name: 'PrivateNet',
      transcanUrl: '',
      fullNodeUrl: 'http://127.0.0.1:8090',
      solidityUrl: 'http://127.0.0.1:8091',
      eventGridUrl: 'http://127.0.0.1:8092',
      AccountDetailUrl: 'http://127.0.0.1/address',
      HistoryDetailUrl: 'http://127.0.0.1/transaction',
      type: 'PrivateNet'
    }
  ]
}
