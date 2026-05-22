/**
 * VenueFi (individual venue) contract configuration.
 *
 * ABI imported directly from Hardhat compiled artifact — single source of truth.
 * Address is dynamic (created via VenueFactory.createVenue), so not exported here.
 */

import VenueFiArtifact from "../../../../blockchain/artifacts/contracts/VenueFi.sol/VenueFi.json";

export const venueFiAbi = VenueFiArtifact.abi;
