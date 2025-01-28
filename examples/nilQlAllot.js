import { NilQLWrapper } from 'nillion-sv-wrappers';

/**
 * This is a standalone example of using NilQLWrapper to encrypt and decrypt data.
 * It is useful for testing and understanding the basic functionality of NilQLWrapper.
 */
async function main() {
  // Example data to encrypt
  const secretData = {
    years_in_web3: { $allot: 4 },
    responses: [
      { rating: 5, question_number: 1 },
      { rating: 3, question_number: 2 },
    ],
    _created: '2025-01-25T01:49:58.316Z',
    _updated: '2025-01-25T01:49:58.316Z',
  };

  // The cluster config just needs an array of nodes for NilQLWrapper
  // - When using NilQLWrapper alone: nodes can be empty objects or contain any fields
  // - When using with SecretVaultWrapper: nodes must contain url and did fields
  const cluster = {
    nodes: [{}, {}, {}],
  };

  try {
    // Initialize wrapper with cluster config
    const encryptionWrapper = new NilQLWrapper(cluster);
    await encryptionWrapper.init();

    const allotted = await encryptionWrapper.prepareAndAllot(secretData);
    console.log('📚 Allot:', allotted);

    const unified = await encryptionWrapper.unify(allotted);
    console.log('📚 Unify:', unified);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main().catch(console.error);
