const SUPPORTED_BROKERS = new Set([
  "IC Markets",
  "Pepperstone",
  "Exness",
  "XM",
  "FP Markets",
  "FTMO",
  "HFM (HotForex)",
  "Tickmill",
  "Vantage",
  "EightCap",
  "ThinkMarkets",
  "Axiory",
  "RoboForex",
  "Admirals",
  "FxPro",
  "AvaTrade",
  "Deriv",
  "OctaFX",
  "FBS",
  "FXTM",
  "LiteFinance",
  "BlackBull Markets",
  "Axi",
  "Global Prime",
  "Fusion Markets",
  "GO Markets",
  "Equiti",
  "FXCM",
  "Swissquote",
  "OANDA",
  "Alpari",
  "InstaForex",
  "NAGA",
  "Trading 212",
  "Weltrade",
  "ACY Securities",
  "Moneta Markets",
  "Just Markets",
]);

export function isSupportedFundingBroker(brokerName: string): boolean {
  return [...SUPPORTED_BROKERS].some(
    (broker) => broker.toLowerCase() === brokerName.trim().toLowerCase(),
  );
}

export function normalizeTradingServer(server: string): string {
  return server.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeBrokerName(brokerName: string): string {
  return brokerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function brokerNamesMatch(submittedBroker: string, verifiedBroker: string): boolean {
  const submitted = normalizeBrokerName(submittedBroker);
  const verified = normalizeBrokerName(verifiedBroker);
  return Boolean(submitted && verified && (submitted.includes(verified) || verified.includes(submitted)));
}