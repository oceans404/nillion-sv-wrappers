var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.js
var index_exports = {};
__export(index_exports, {
  NilQLWrapper: () => NilQLWrapper,
  SecretVaultWrapper: () => SecretVaultWrapper
});
module.exports = __toCommonJS(index_exports);

// nilQl/wrapper.js
var import_nilql = require("@nillion/nilql");
var KeyType = {
  CLUSTER: "cluster",
  SECRET: "secret"
};
var NilQLWrapper = class {
  constructor(cluster, operation = "store", secretKey = null, keyType = KeyType.CLUSTER) {
    this.cluster = cluster;
    this.secretKey = secretKey;
    this.operation = {
      [operation]: true
    };
    this.keyType = keyType;
  }
  /**
   * Initializes the NilQLWrapper by generating and storing a secret key
   * for the cluster. This must be called before any encryption/decryption operations.
   * @returns {Promise<void>}
   */
  async init() {
    if (this.secretKey === null && this.keyType === KeyType.SECRET) {
      this.secretKey = await import_nilql.nilql.SecretKey.generate(
        this.cluster,
        this.operation
      );
    }
    if (this.keyType === KeyType.CLUSTER) {
      this.secretKey = await import_nilql.nilql.ClusterKey.generate(
        this.cluster,
        this.operation
      );
    }
  }
  /**
   * Encrypts data using the initialized secret key
   * @param {any} data - The data to encrypt
   * @throws {Error} If NilQLWrapper hasn't been initialized
   * @returns {Promise<Array>} Array of encrypted shares
   */
  async encrypt(data) {
    if (!this.secretKey) {
      throw new Error("NilQLWrapper not initialized. Call init() first.");
    }
    const shares = await import_nilql.nilql.encrypt(this.secretKey, data);
    return shares;
  }
  /**
   * Decrypts data using the initialized secret key and provided shares
   * @param {Array} shares - Array of encrypted shares to decrypt
   * @throws {Error} If NilQLWrapper hasn't been initialized
   * @returns {Promise<any>} The decrypted data
   */
  async decrypt(shares) {
    if (!this.secretKey) {
      throw new Error("NilQLWrapper not initialized. Call init() first.");
    }
    const decryptedData = await import_nilql.nilql.decrypt(this.secretKey, shares);
    return decryptedData;
  }
  /**
   * Recursively encrypts all values marked with $allot in the given data object
   * and prepares it for secure processing.
   *
   * - Traverses the entire object structure, handling nested objects at any depth.
   * - Encrypts values associated with the $allot key using nilql.encrypt().
   * - Preserves non-$allot values and maintains the original object structure.
   * - Calls nilql.allot() on the fully processed data before returning.
   *
   * @param {object} data - The input object containing fields marked with $allot for encryption.
   * @throws {Error} If NilQLWrapper has not been initialized with a secret key.
   * @returns {Promise<object>} The processed object with encrypted $allot values.
   */
  async prepareAndAllot(data) {
    if (!this.secretKey) {
      throw new Error("NilQLWrapper not initialized. Call init() first.");
    }
    const encryptDeep = async (obj) => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }
      const encrypted = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null) {
          if ("$allot" in value) {
            encrypted[key] = {
              $allot: await import_nilql.nilql.encrypt(this.secretKey, value.$allot)
            };
          } else {
            encrypted[key] = await encryptDeep(value);
          }
        } else {
          encrypted[key] = value;
        }
      }
      return encrypted;
    };
    const encryptedData = await encryptDeep(data);
    return import_nilql.nilql.allot(encryptedData);
  }
  /**
   * Recombines encrypted shares back into original data structure
   * @param {Array} shares - Array of shares from prepareAndAllot
   * @throws {Error} If NilQLWrapper hasn't been initialized
   * @returns {Promise<object>} Original data structure with decrypted values
   */
  async unify(shares) {
    if (!this.secretKey) {
      throw new Error("NilQLWrapper not initialized. Call init() first.");
    }
    const unifiedResult = await import_nilql.nilql.unify(this.secretKey, shares);
    return unifiedResult;
  }
};

// SecretVault/wrapper.js
var import_did_jwt = require("did-jwt");
var import_buffer = require("buffer");
var import_uuid = require("uuid");
var SecretVaultWrapper = class {
  constructor(nodes, credentials, schemaId = null, operation = "store", tokenExpirySeconds = 3600) {
    this.nodes = nodes;
    this.nodesJwt = null;
    this.credentials = credentials;
    this.schemaId = schemaId;
    this.operation = operation;
    this.tokenExpirySeconds = tokenExpirySeconds;
    this.nilqlWrapper = null;
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
        jwt: await this.generateNodeToken(node.did)
      }))
    );
    this.nodesJwt = nodeConfigs;
    this.nilqlWrapper = new NilQLWrapper({ nodes: this.nodes }, this.operation);
    await this.nilqlWrapper.init();
    return this.nilqlWrapper;
  }
  /**
   * Updates the schema ID for the SecretVaultWrapper
   * @param {string} schemaId - The new schema ID
   */
  setSchemaId(schemaId, operation = this.operation) {
    this.schemaId = schemaId;
    this.operation = operation;
  }
  /**
   * Generates a JWT token for node authentication
   * @param {string} nodeDid - The DID of the node to generate token for
   * @returns {Promise<string>} JWT token
   */
  async generateNodeToken(nodeDid) {
    const signer = (0, import_did_jwt.ES256KSigner)(import_buffer.Buffer.from(this.credentials.secretKey, "hex"));
    const payload = {
      iss: this.credentials.orgDid,
      aud: nodeDid,
      exp: Math.floor(Date.now() / 1e3) + this.tokenExpirySeconds
    };
    return await (0, import_did_jwt.createJWT)(payload, {
      issuer: this.credentials.orgDid,
      signer
    });
  }
  /**
   * Generates tokens for all nodes and returns an array of objects containing node and token
   * @returns {Promise<Array<{ node: string, token: string }>>} Array of nodes with their corresponding tokens
   */
  async generateTokensForAllNodes() {
    const tokens = await Promise.all(
      this.nodes.map(async (node) => {
        const token = await this.generateNodeToken(node.did);
        return { node: node.url, token };
      })
    );
    return tokens;
  }
  /**
   * Makes an HTTP request to a node's endpoint
   * @param {string} nodeUrl - URL of the node
   * @param {string} endpoint - API endpoint
   * @param {string} token - JWT token for authentication
   * @param {object} payload - Request payload
   * @returns {Promise<object>} Response data
   */
  async makeRequest(nodeUrl, endpoint, token, payload, method = "POST") {
    const response = await fetch(`${nodeUrl}/api/v1/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: method === "GET" ? null : JSON.stringify(payload)
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
  async allotData(data) {
    const encryptedRecords = [];
    for (const item of data) {
      const encryptedItem = await this.nilqlWrapper.prepareAndAllot(item);
      encryptedRecords.push(encryptedItem);
    }
    return encryptedRecords;
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
        "data/flush",
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
  async getSchemas() {
    const results = [];
    for (const node of this.nodes) {
      const jwt = await this.generateNodeToken(node.did);
      const result = await this.makeRequest(
        node.url,
        "schemas",
        jwt,
        {},
        "GET"
      );
      results.push({ node: node.url, result });
    }
    return results.map((result) => result.result.data);
  }
  /**
   * Creates a new schema on all nodes
   * @param {object} schema - The schema to create
   * @param {string} schemaName - The name of the schema
   * @param {string} schemaId - Optional: The ID of the schema
   * @returns {Promise<array>} Array of creation results from each node
   */
  async createSchema(schema, schemaName, schemaId = null) {
    if (!schemaId) {
      schemaId = (0, import_uuid.v4)();
    }
    const schemaPayload = {
      _id: schemaId,
      name: schemaName,
      keys: ["_id"],
      schema
    };
    const results = [];
    for (const node of this.nodes) {
      const jwt = await this.generateNodeToken(node.did);
      const result = await this.makeRequest(
        node.url,
        "schemas",
        jwt,
        schemaPayload
      );
      results.push({ node: node.url, result });
    }
    return results;
  }
  /**
   * Deletes a schema from all nodes
   * @param {string} schemaId - The ID of the schema to delete
   * @returns {Promise<array>} Array of deletion results from each node
   */
  async deleteSchema(schemaId) {
    const results = [];
    for (const node of this.nodes) {
      const jwt = await this.generateNodeToken(node.did);
      const result = await this.makeRequest(
        node.url,
        `schemas`,
        jwt,
        {
          id: schemaId
        },
        "DELETE"
      );
      results.push({ node: node.url, result });
    }
    return results;
  }
  /**
   * Writes data to all nodes, with optional field encryption
   * @param {array} data - Data to write
   * @returns {Promise<array>} Array of write results from each node
   */
  async writeToNodes(data) {
    const idData = data.map((record) => {
      if (!record._id) {
        return { ...record, _id: (0, import_uuid.v4)() };
      }
      return record;
    });
    const transformedData = await this.allotData(idData);
    const results = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      try {
        const nodeData = transformedData.map((encryptedShares) => {
          if (encryptedShares.length !== this.nodes.length) {
            return encryptedShares[0];
          }
          return encryptedShares[i];
        });
        const jwt = await this.generateNodeToken(node.did);
        const payload = {
          schema: this.schemaId,
          data: nodeData
        };
        const result = await this.makeRequest(
          node.url,
          "data/create",
          jwt,
          payload
        );
        results.push({ node: node.url, result });
      } catch (error) {
        console.error(`\u274C Failed to write to ${node.url}:`, error.message);
        results.push({ node: node.url, error: error.message });
      }
    }
    return results;
  }
  /**
   * Reads data from all nodes with optional decryption of specified fields
   * @param {object} filter - Filter criteria for reading data
   * @returns {Promise<array>} Array of decrypted records
   */
  async readFromNodes(filter = {}) {
    const resultsFromAllNodes = [];
    for (const node of this.nodes) {
      try {
        const jwt = await this.generateNodeToken(node.did);
        const payload = { schema: this.schemaId, filter };
        const result = await this.makeRequest(
          node.url,
          "data/read",
          jwt,
          payload
        );
        resultsFromAllNodes.push({ node: node.url, data: result.data });
      } catch (error) {
        console.error(`\u274C Failed to read from ${node.url}:`, error.message);
        resultsFromAllNodes.push({ node: node.url, error: error.message });
      }
    }
    const recordGroups = resultsFromAllNodes.reduce((acc, nodeResult) => {
      nodeResult.data.forEach((record) => {
        const existingGroup = acc.find(
          (group) => group.shares.some((share) => share._id === record._id)
        );
        if (existingGroup) {
          existingGroup.shares.push(record);
        } else {
          acc.push({ shares: [record], recordIndex: record._id });
        }
      });
      return acc;
    }, []);
    const recombinedRecords = await Promise.all(
      recordGroups.map(async (record) => {
        const recombined = await this.nilqlWrapper.unify(record.shares);
        return recombined;
      })
    );
    return recombinedRecords;
  }
  /**
   * Updates data on all nodes, with optional field encryption
   * @param {array} recordUpdate - Data to update
   * @param {object} filter - Filter criteria for which records to update
   * @returns {Promise<array>} Array of update results from each node
   */
  async updateDataToNodes(recordUpdate, filter = {}) {
    const results = [];
    const transformedData = await this.allotData([recordUpdate]);
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      try {
        const [nodeData] = transformedData.map((encryptedShares) => {
          if (encryptedShares.length !== this.nodes.length) {
            return encryptedShares[0];
          }
          return encryptedShares[i];
        });
        const jwt = await this.generateNodeToken(node.did);
        const payload = {
          schema: this.schemaId,
          update: {
            $set: nodeData
          },
          filter
        };
        const result = await this.makeRequest(
          node.url,
          "data/update",
          jwt,
          payload
        );
        results.push({ node: node.url, result });
      } catch (error) {
        console.error(`\u274C Failed to write to ${node.url}:`, error.message);
        results.push({ node: node.url, error: error.message });
      }
    }
    return results;
  }
  /**
   * Deletes data from all nodes based on the provided filter
   * @param {object} filter - Filter criteria for which records to delete
   * @returns {Promise<array>} Array of deletion results from each node
   */
  async deleteDataFromNodes(filter = {}) {
    const results = [];
    for (const node of this.nodes) {
      try {
        const jwt = await this.generateNodeToken(node.did);
        const payload = { schema: this.schemaId, filter };
        const result = await this.makeRequest(
          node.url,
          "data/delete",
          jwt,
          payload
        );
        results.push({ node: node.url, result });
      } catch (error) {
        console.error(`\u274C Failed to delete from ${node.url}:`, error.message);
        results.push({ node: node.url, error: error.message });
      }
    }
    return results;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NilQLWrapper,
  SecretVaultWrapper
});
