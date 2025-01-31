import { nilql } from '@nillion/nilql';

// Define an enum for key types
const KeyType = {
  CLUSTER: 'cluster',
  SECRET: 'secret',
};

/**
 * NilQLWrapper provides encryption and decryption of data using Nillion's technology.
 * It generates and manages secret keys, splits data into shares when encrypting,
 * and recombines shares when decrypting.
 *
 * @example
 * const wrapper = new NilQLWrapper(cluster);
 * await wrapper.init();
 * const shares = await wrapper.encrypt(sensitiveData);
 */
export class NilQLWrapper {
  constructor(
    cluster,
    operation = 'store',
    secretKey = null, // option to pass in your own secret key
    keyType = KeyType.CLUSTER
  ) {
    this.cluster = cluster;
    this.secretKey = secretKey;
    this.operation = {
      [operation]: true,
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
      this.secretKey = await nilql.SecretKey.generate(
        this.cluster,
        this.operation
      );
    }
    if (this.keyType === KeyType.CLUSTER) {
      this.secretKey = await nilql.ClusterKey.generate(
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
      throw new Error('NilQLWrapper not initialized. Call init() first.');
    }
    const shares = await nilql.encrypt(this.secretKey, data);
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
      throw new Error('NilQLWrapper not initialized. Call init() first.');
    }
    const decryptedData = await nilql.decrypt(this.secretKey, shares);
    return decryptedData;
  }

  /**
   * Prepares data with $allot markers and splits into encrypted shares
   * @param {object} data - Object with fields marked for encryption using $allot
   * @throws {Error} If NilQLWrapper hasn't been initialized
   * @returns {Promise<Array>} Array of encrypted shares for each node in cluster
   */
  async prepareAndAllot(data) {
    if (!this.secretKey) {
      throw new Error('NilQLWrapper not initialized. Call init() first.');
    }
    const encrypted = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && '$allot' in value) {
        encrypted[key] = {
          $allot: await nilql.encrypt(this.secretKey, value.$allot),
        };
      } else {
        encrypted[key] = value;
      }
    }

    return nilql.allot(encrypted);
  }

  /**
   * Recombines encrypted shares back into original data structure
   * @param {Array} shares - Array of shares from prepareAndAllot
   * @throws {Error} If NilQLWrapper hasn't been initialized
   * @returns {Promise<object>} Original data structure with decrypted values
   */
  async unify(shares) {
    if (!this.secretKey) {
      throw new Error('NilQLWrapper not initialized. Call init() first.');
    }
    const unifiedResult = await nilql.unify(this.secretKey, shares);
    return unifiedResult;
  }
}
