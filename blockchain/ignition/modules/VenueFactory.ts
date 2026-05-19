import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VenueFactoryModule = buildModule("VenueFactoryModule", (m) => {
  const venueFactory = m.contract("VenueFactory");

  return { venueFactory };
});

export default VenueFactoryModule;
