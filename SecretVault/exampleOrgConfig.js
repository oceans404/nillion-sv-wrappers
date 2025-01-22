import dotenv from 'dotenv';
dotenv.config();

export const orgConfig = {
  orgCredentials: {
    secretKey: process.env.NILLION_ORG_SECRET_KEY,
    orgDid: process.env.NILLION_ORG_DID,
  },
  nodes: [
    {
      url: 'https://nildb-a50d.nillion.network',
      did: 'did:nil:testnet:nillion15lcjxgafgvs40rypvqu73gfvx6pkx7ugdja50d',
    },
    {
      url: 'https://nildb-dvml.nillion.network',
      did: 'did:nil:testnet:nillion1dfh44cs4h2zek5vhzxkfvd9w28s5q5cdepdvml',
    },
    {
      url: 'https://nildb-guue.nillion.network',
      did: 'did:nil:testnet:nillion19t0gefm7pr6xjkq2sj40f0rs7wznldgfg4guue',
    },
  ],
};
