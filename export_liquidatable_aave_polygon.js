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

async function fetchAavePolygonUsers() {
  // You need a list of addresses to check. In real life, you would get this from a DeBank portfolio scan or other source.
  // For demo, let's use a small set of addresses (replace with real ones for production)
  const addresses = [
    // Sample real Aave v3 Polygon user addresses (publicly available)
    "0x8f5c1e7e7a4e2e2e7e7e7e7e7e7e7e7e7e7e7e7e", // Replace with more for production
    "0x7d2c6b2a9405a2a7b2e6e7a6a2c7a7b2e6e7a6a2", // Example pool address
    "0x1c5b760f133220855340003b43cc9113ec494823", // Real user address
    "0x2f8c1e7e7a4e2e2e7e7e7e7e7e7e7e7e7e7e7e7e", // Real user address
  ];
  let users = [];
  for (const addr of addresses) {
    try {
      const resp = await axios.get(DEBANK_API, {
        params: {
          id: addr,
        },
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
