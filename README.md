# nillion-sv-wrappers

Wrapper classes for simplifying usage of Nillion's Secret Vault and the nilQL encryption and decryption library.

## Installation

```bash
npm install nillion-sv-wrappers
```

## Features

### NilQLWrapper: Lightweight wrapper for encryption and decryption using nilQL:

- Encrypts data into shares for distributed storage
- Recombines shares during decryption to recover original data
- Can work independently from SecretVaultWrapper for basic encryption/decryption operations
- No node configuration required when used standalone

### SecretVaultWrapper: wrapper for Secret Vault API operations:

#### Authentication

- Handles JWT creation and management per node
- Manages node authentication automatically

#### Data Operations

1. Write: Upload data to the specified schema collection (/api/v1/data/create)

   - Writes data to multiple nodes
   - Encrypts specified fields before distribution
   - Distributes encrypted shares across nodes

2. Read: Retrieve data from the specified schema collection that matches the provided filter (/api/v1/data/read)

   - Retrieves data from all nodes
   - Recombines encrypted shares from nodes to decrypts specified fields automatically
   - Returns decrypted record

3. Flush: Remove all documents in a schema collection (/api/v1/data/flush)

   - Removes all data across nodes from a schema collection

4. List the organization's schemas (/api/v1/schemas)

## Usage

### Standalone NilQLWrapper Example

Run examples

```
node SecretVault/example.js
```

### SecretVaultWrapper Example

Copy the .env.example to create a .env file that uses the example org

```
cp .env.example .env
```

Run example to encrypt and upload data to all nodes, then read data from nodes.

```
node SecretVault/example.js
```

Basic setup

```
const secretVaultCollection = new SecretVaultWrapper(
    orgConfig.nodes,
    orgConfig.orgCredentials,
    collectionConfig.schemaId
);
await secretVaultCollection.init();

const dataWritten = await secretVaultCollection.writeToNodes(
    [{
        _id: uuidv4(),
        years_in_web3: 4,
        responses: [
            { rating: 5, question_number: 1 },
            { rating: 3, question_number: 2 },
        ],
    },],
    ['years_in_web3] // field to encrypt
);
```
