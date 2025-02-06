import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './orgConfig.js';

// update schema id and record id to delete with your own values
const SCHEMA_ID = '28a75bb3-690d-4558-b433-5cd07e987a36';
const RECORD_ID = '15a77bd0-0617-4534-a05a-fd9220bbb136';

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

    const deletedData = await collection.deleteDataFromNodes(filterById);

    console.log('📚 Deleted record from all nodes:', deletedData);

    // await collection.flushData();
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    process.exit(1);
  }
}

main();
