/**
 * VenueFactory contract configuration.
 *
 * ABI imported directly from Hardhat compiled artifact — single source of truth.
 */

import VenueFactoryArtifact from "../../../../blockchain/artifacts/contracts/VenueFactory.sol/VenueFactory.json";
import { venueFactoryAddress } from "./addresses";

export const venueFactoryAbi = VenueFactoryArtifact.abi;

export { venueFactoryAddress };
