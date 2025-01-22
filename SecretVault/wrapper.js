import { createJWT, ES256KSigner } from 'did-jwt';
import { Buffer } from 'buffer';
import { NilQLWrapper } from '../nilQl/wrapper.js';

/**
 * SecretVaultWrapper manages distributed data storage across multiple nodes.
 * It handles node authentication, data distribution, and uses NilQLWrapper
 * for field-level encryption. Provides CRUD operations with built-in
 * security and error handling.
 *
 * @example
 * const vault = new SecretVaultWrapper(nodes, credentials, schemaId);
 * await vault.init();
 * await vault.writeToNodes(data, ['sensitiveField']);
 */
export class SecretVaultWrapper {
  constructor(nodes, credentials, schemaId = null) {
    this.nodes = nodes;
    this.credentials = credentials;
    this.schemaId = schemaId;
    this.tokenExpirySeconds = 3600; // 1 hour tokens
    this.nilqlWrapper = null;
  }

  /**
   * Updates the schema ID for the SecretVaultWrapper
   * @param {string} schemaId - The new schema ID
   */
  setSchemaId(schemaId) {
    this.schemaId = schemaId;
  }

  /**
   * Generates a JWT token for node authentication
   * @param {string} nodeDid - The DID of the node to generate token for
   * @returns {Promise<string>} JWT token
   */
  async generateNodeToken(nodeDid) {
    const signer = ES256KSigner(Buffer.from(this.credentials.secretKey, 'hex'));
    const payload = {
      iss: this.credentials.orgDid,
      aud: nodeDid,
      exp: Math.floor(Date.now() / 1000) + this.tokenExpirySeconds,
    };
    return await createJWT(payload, {
      issuer: this.credentials.orgDid,
      signer,
    });
  }

  /**
   * Initializes the SecretVaultWrapper by generating tokens for all nodes
   * and setting up the NilQLWrapper
   * @returns {Promise<NilQLWrapper>} Initialized NilQLWrapper instance
   */
  async init() {
    const nodeConfigs = await Promise.all(
      this.nodes.map(async (node) => ({
        url: node.url,
        jwt: await this.generateNodeToken(node.did),
      }))
    );

    this.nilqlWrapper = new NilQLWrapper({ nodes: nodeConfigs });
    await this.nilqlWrapper.init();
    return this.nilqlWrapper;
  }

  /**
   * Makes an HTTP request to a node's endpoint
   * @param {string} nodeUrl - URL of the node
   * @param {string} endpoint - API endpoint
   * @param {string} token - JWT token for authentication
   * @param {object} payload - Request payload
   * @returns {Promise<object>} Response data
   */
  async makeRequest(nodeUrl, endpoint, token, payload, method = 'POST') {
    const response = await fetch(`${nodeUrl}/api/v1/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: method === 'GET' ? null : JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }

    return await response.json();
  }

  /**
   * Transforms data by encrypting specified fields across all nodes
   * @param {object|array} data - Data to transform
   * @param {array} fieldsToEncrypt - Fields to encrypt
   * @returns {Promise<array>} Array of transformed data for each node
   */
  async transformDataToEncryptFields(data, fieldsToEncrypt = []) {
    const nodesLength = this.nodes.length;

    if (!fieldsToEncrypt?.length) return Array(nodesLength).fill(data);

    const fields = Array.isArray(fieldsToEncrypt)
      ? fieldsToEncrypt
      : [fieldsToEncrypt];
    const dataArray = Array.isArray(data) ? data : [data];

    const valuesToEncrypt = new Set();
    dataArray.forEach((item) => {
      fields.forEach((field) => {
        if (field in item) {
          valuesToEncrypt.add(item[field]);
        }
      });
    });

    const encryptionResults = new Map();
    for (const value of valuesToEncrypt) {
      const shares = await this.nilqlWrapper.encrypt(value);
      encryptionResults.set(value, shares);
    }

    const result = Array(nodesLength)
      .fill()
      .map(() => []);

    dataArray.forEach((item) => {
      for (let shareIndex = 0; shareIndex < nodesLength; shareIndex++) {
        const transformedItem = { ...item };
        fields.forEach((field) => {
          if (field in item) {
            const shares = encryptionResults.get(item[field]);
            transformedItem[field] = shares[shareIndex];
          }
        });
        result[shareIndex].push(transformedItem);
      }
    });

    return result;
  }

  /**
   * Flushes (clears) data from all nodes for the current schema
   * @returns {Promise<array>} Array of flush results from each node
   */
  async flushData() {
    const results = [];
    for (const node of this.nodes) {
      const jwt = await this.generateNodeToken(node.did);
      const payload = { schema: this.schemaId };
      const result = await this.makeRequest(
        node.url,
        'data/flush',
        jwt,
        payload
      );
      results.push({ node: node.url, result });
    }
    return results;
  }

  /**
   * Lists schemas from all nodes in the org
   * @returns {Promise<array>} Array of schema results from each node
   */
  async listSchemas() {
    const results = [];
    for (const node of this.nodes) {
      const jwt = await this.generateNodeToken(node.did);
      const result = await this.makeRequest(
        node.url,
        'schemas',
        jwt,
        {},
        'GET'
      );
      results.push({ node: node.url, result });
    }
    return results.map((result) => result.result.data);
  }

  /**
   * Writes data to all nodes, with optional field encryption
   * @param {object|array} data - Data to write
   * @param {array} fieldsToEncrypt - Fields to encrypt before writing
   * @returns {Promise<array>} Array of write results from each node
   */
  async writeToNodes(data, fieldsToEncrypt = []) {
    const transformedData = await this.transformDataToEncryptFields(
      data,
      fieldsToEncrypt
    );
    const results = [];

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      try {
        const jwt = await this.generateNodeToken(node.did);
        const payload = {
          schema: this.schemaId,
          data: transformedData[i],
        };
        const result = await this.makeRequest(
          node.url,
          'data/create',
          jwt,
          payload
        );
        results.push({ node: node.url, result });
      } catch (error) {
        console.error(`❌ Failed to write to ${node.url}:`, error.message);
        results.push({ node: node.url, error: error.message });
      }
    }

    return results;
  }

  /**
   * Reads data from all nodes with optional decryption of specified fields
   * @param {object} filter - Filter criteria for reading data
   * @param {array} fieldsToDecrypt - Fields to decrypt after reading
   * @returns {Promise<array>} Array of decrypted records
   */
  async readFromNodes(filter = {}, fieldsToDecrypt = []) {
    const resultsFromAllNodes = [];

    for (const node of this.nodes) {
      try {
        const jwt = await this.generateNodeToken(node.did);
        const payload = { schema: this.schemaId, filter };
        const result = await this.makeRequest(
          node.url,
          'data/read',
          jwt,
          payload
        );
        const recordCount = result.data?.length || 0;
        resultsFromAllNodes.push({ node: node.url, data: result.data });
      } catch (error) {
        console.error(`❌ Failed to read from ${node.url}:`, error.message);
        resultsFromAllNodes.push({ node: node.url, error: error.message });
      }
    }

    if (!fieldsToDecrypt?.length) {
      return resultsFromAllNodes[0].data;
    }

    const recordGroups = resultsFromAllNodes[0].data.map((_, recordIndex) => {
      const shares = resultsFromAllNodes.map(
        (nodeResult) => nodeResult.data[recordIndex]
      );
      return { shares, recordIndex };
    });

    const decryptedRecords = await Promise.all(
      recordGroups.map(async ({ shares, recordIndex }) => {
        const record = { ...shares[0] };

        for (const field of fieldsToDecrypt) {
          if (field in record) {
            const fieldShares = shares.map((share) => share[field]);
            const decryptedValue = await this.nilqlWrapper.decrypt(fieldShares);
            record[field] = Number(decryptedValue);
          }
        }
        return record;
      })
    );

    return decryptedRecords;
  }
}
