const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  buffer: require.resolve("buffer"),
};
// Privy pulls in jose; its default export map points at the Node build (needs util/zlib).
// Resolve jose with the browser condition, as Privy's Expo setup guide recommends.
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Privy's web SDK imports Stripe's crypto onramp, which wants @stripe/stripe-js as a peer. We never open the onramp.
  if (moduleName === "@stripe/stripe-js") return { type: "empty" };
  const ctx = moduleName === "jose" || moduleName.startsWith("jose/")
    ? { ...context, unstable_conditionNames: ["browser"] }
    : context;
  return resolve ? resolve(ctx, moduleName, platform) : ctx.resolveRequest(ctx, moduleName, platform);
};
module.exports = config;
