// Utility to fetch all Aave v3 Polygon user addresses from the subgraph
// Returns an array of addresses
const { request, gql } = require('graphql-request');

const AAVE_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon';

async function fetchAaveV3PolygonAddresses() {
  const query = gql`
    query getUsers($skip: Int!) {
      users(first: 1000, skip: $skip) {
        id
      }
    }
  `;
  let addresses = [];
  let skip = 0;
  let hasMore = true;
  while (hasMore) {
    const data = await request(AAVE_SUBGRAPH_URL, query, { skip });
    const users = data.users.map(u => u.id);
    addresses.push(...users);
    if (users.length < 1000) {
      hasMore = false;
    } else {
      skip += 1000;
    }
  }
  return addresses;
}

module.exports = { fetchAaveV3PolygonAddresses };
