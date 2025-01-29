import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './orgConfig.js';

const SCHEMA_ID = '77010f94-9c42-4bef-b96d-c639d0081626';

// $allot signals that the value will be encrypted to one $share per node before writing to the collection
const web3ExperienceSurveyData = [
  {
    years_in_web3: { $allot: 4 },
    responses: [
      { rating: 5, question_number: 1 },
      { rating: 3, question_number: 2 },
    ],
  },
  {
    years_in_web3: { $allot: 1 },
    responses: [
      { rating: 2, question_number: 1 },
      { rating: 4, question_number: 2 },
    ],
  },
];

async function main() {
  try {
    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      SCHEMA_ID
    );
    await collection.init();

    const dataWritten = await collection.writeToNodes(web3ExperienceSurveyData);

    const newIds = [
      ...new Set(dataWritten.map((item) => item.result.data.created).flat()),
    ];
    console.log('created ids:', newIds);

    const dataRead = await collection.readFromNodes({});
    console.log(
      '📚 Read new records:',
      dataRead.slice(0, web3ExperienceSurveyData.length)
    );
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    process.exit(1);
  }
}

main();
