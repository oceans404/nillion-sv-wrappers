import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './orgConfig.js';

// update schema id and record id to update with your own values
const SCHEMA_ID = '28a75bb3-690d-4558-b433-5cd07e987a36';
const RECORD_ID = '15a77bd0-0617-4534-a05a-fd9220bbb136';

const recordUpdate = {
  years_in_web3: { $allot: 3 },
  responses: [
    { rating: 3, question_number: 1 },
    { rating: 3, question_number: 2 },
  ],
};

async function main() {
  try {
    const collection = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      SCHEMA_ID
    );
    await collection.init();

    const filterById = {
      _id: RECORD_ID,
    };

    const readOriginalRecord = await collection.readFromNodes(filterById);
    console.log('📚 Read original record:', readOriginalRecord);

    const updatedData = await collection.updateDataToNodes(
      recordUpdate,
      filterById
    );

    console.log(
      '📚 Find record(s) with filter and update nodes with recordUpdate:',
      updatedData.map((n) => n.result.data)
    );

    const readUpdatedRecord = await collection.readFromNodes(filterById);
    console.log('📚 Read updated record:', readUpdatedRecord);

    // await collection.flushData();
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    process.exit(1);
  }
}

main();
