export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "",
  evaluatorPrivateKey: process.env.EVALUATOR_PRIVATE_KEY ?? "",
  policyRegistryAddress: process.env.POLICY_REGISTRY_ADDRESS ?? "",
  receiptRegistryAddress: process.env.RECEIPT_REGISTRY_ADDRESS ?? "",
};
