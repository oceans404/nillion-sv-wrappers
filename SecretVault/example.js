import { SecretVaultWrapper } from './wrapper.js';
import { orgConfig } from './exampleOrgConfig.js';
import { v4 as uuidv4 } from 'uuid';

const collectionConfig = {
  // Uncomment this to test SecretVaultWrapper on a schema with no encrypted fields
  //   schemaId: 'aac89fb9-ebac-401b-a1bb-7f08088e124d', // expects no encrypted fields
  //   encryptedFields: [], // no encrypted fields

  // Uncomment this to test SecretVaultWrapper on a schema with encrypted fields
  schemaId: '53f9e1de-e0a3-46ab-86c6-3fd380ad8877', // expects years_in_web3 encrypted (string)
  encryptedFields: ['years_in_web3'],
};

const web3ExperienceSurveyData = [
  {
    _id: uuidv4(),
    years_in_web3: 10,
    responses: [
      { rating: 5, question_number: 1 },
      { rating: 3, question_number: 2 },
    ],
  },
  {
    _id: uuidv4(),
    years_in_web3: 4,
    responses: [
      { rating: 5, question_number: 1 },
      { rating: 3, question_number: 2 },
    ],
  },
];

async function main() {
  try {
    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      collectionConfig.schemaId
    );
    await collection.init();

    const schemas = await collection.listSchemas();
    console.log('📚 Schemas:', schemas);

    const dataWritten = await collection.writeToNodes(
      web3ExperienceSurveyData,
      collectionConfig.encryptedFields
    );
    console.log(
      `💾 ${web3ExperienceSurveyData.length} data records written to ${
        orgConfig.nodes.length
      } nodes with ${
        collectionConfig.encryptedFields.length
      } encrypted fields ${
        collectionConfig.encryptedFields.length
          ? ': ' + collectionConfig.encryptedFields.join(', ')
          : ''
      }`
    );
    const newIds = [
      ...new Set(dataWritten.map((item) => item.result.data.created).flat()),
    ];
    console.log('created ids:', newIds);

    const dataRead = await collection.readFromNodes(
      {},
      collectionConfig.encryptedFields
    );
    console.log('📚 Data read from nodes:', dataRead);

    // const result = await collection.flushData();
    // console.log('🧹 Data flushed from nodes:', result);
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    process.exit(1);
  }
}

main();
