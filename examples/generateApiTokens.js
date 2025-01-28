import { SecretVaultWrapper } from '../SecretVault/wrapper.js';
import { orgConfig } from './orgConfig.js';

async function main() {
  try {
    const org = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials,
      null, // schemaId
      3600 // optional: set the API token expiry time in seconds
    );
    await org.init();

    // generate api tokens for all nodes in the org config
    const apiTokens = await org.generateTokensForAllNodes();
    console.log('🪙 API Tokens:', apiTokens);
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    process.exit(1);
  }
}

main();
