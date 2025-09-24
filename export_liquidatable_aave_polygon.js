const axios = require("axios");
const { ethers } = require("ethers");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// ========== Config ==========
const MIN_DEBT_USD = 2000;
const MAX_HEALTH_FACTOR = 1.02;
const OUTPUT_CSV = "liquidatable_addresses_polygon.csv";

// ========== DeBank API ===========
const DEBANK_API = "https://openapi.debank.com/v1/user/protocol_list";
const PROTOCOL_ID = "aave_v3_polygon";

// Load DeBank API key from environment variable
const DEBANK_API_KEY = process.env.DEBANK_API_KEY;
if (!DEBANK_API_KEY) {
  console.warn("Warning: DEBANK_API_KEY environment variable not set. API requests may fail.");
}

const { fetchAaveV3PolygonAddresses } = require('./aave_subgraph');

async function fetchAavePolygonUsers() {
  // Fetch addresses from Aave v3 Polygon subgraph
  const addresses = await fetchAaveV3PolygonAddresses();
  let users = [];
  for (const addr of addresses) {
    try {
      const resp = await axios.get(DEBANK_API, {
        params: {
          id: addr,
        },
        headers: DEBANK_API_KEY ? { 'Authorization': `Bearer ${DEBANK_API_KEY}` } : {},
      });
      const protocols = resp.data || [];
      const aave = protocols.find((p) => p.id === PROTOCOL_ID);
      if (aave && aave.portfolio_item_list) {
        for (const item of aave.portfolio_item_list) {
          if (item.detail && item.detail.borrow_list) {
            for (const borrow of item.detail.borrow_list) {
              users.push({
                id: addr,
                totalBorrowsUSD: borrow.usd_value,
                healthFactor: borrow.health_rate || 0,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching for ${addr}:`, err.message);
    }
  }
  return users;
}

async function main() {
  console.log("Fetching all Aave v3 Polygon borrowers from DeBank...");
  const users = await fetchAavePolygonUsers();
  console.log(`Total users fetched: ${users.length}`);

  const filtered = users.filter((u) => {
    const borrowUsd = Number(u.totalBorrowsUSD);
    const hf = Number(u.healthFactor);
    return borrowUsd >= MIN_DEBT_USD && hf <= MAX_HEALTH_FACTOR && hf > 0;
  });

  console.log(`Found ${filtered.length} liquidatable candidates.`);

  const formatted = filtered.map((u) => ({
    address: ethers.utils.getAddress(u.id),
    borrowUsd: u.totalBorrowsUSD,
    healthFactor: u.healthFactor,
  }));

  const csvWriter = createCsvWriter({
    path: OUTPUT_CSV,
    header: [
      { id: "address", title: "Address" },
      { id: "borrowUsd", title: "Borrow_USD" },
      { id: "healthFactor", title: "Health_Factor" },
    ],
  });

  await csvWriter.writeRecords(formatted);
  console.log(`✅ CSV written to ${OUTPUT_CSV}`);
}

main().catch((err) => console.error("Error:", err));
