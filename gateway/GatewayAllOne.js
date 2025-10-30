// Gateway3App.js
// Extended Gateway for Salesforce–MCP–Neo4j integration
// Supports:
//  - Method 1: LLM→Cypher→MCP (existing)
//  - Method 2: MCP text2cypher (existing)
//  - /sync/sf → from SalesforceDataSync.cls
//  - /mcp → passthrough for Apex McpGatewayController
//  - /schema/build, /kg/build → for LWC schema management
//  - Unified JSON response structure

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { OpenAI } = require('openai');

const app = express();
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- MCP client setup ----------
async function createMcpClient() {
  const transport = new StreamableHTTPClientTransport('http://localhost:8005/mcp/');
  const client = new Client({ name: 'Neo4j Gateway', version: '2.0.0' });
  await client.connect(transport);
  console.log('✅ Connected to MCP Neo4j Cypher');
  return client;
}
let mcpClientPromise = createMcpClient();

// ---------- Utility: LLM to Cypher ----------
async function translateToCypher(question) {
  const prompt = `
You are an assistant that converts natural language questions into Cypher queries for Neo4j.
Database contains nodes: Supplier, Component, Product, Case; relationships: CAN_SUPPLY, USED_IN, SUPPLIES.
Return ONLY the Cypher query, no markdown.

Question: "${question}"
Cypher:
`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  });
  let query = response.choices[0].message.content.trim();
  return query.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
}

// ---------- Utility: LLM grounded reasoning ----------
async function groundedAnswer(originalQuestion, graphData, cypher) {
  const context = `Grounding data: ${JSON.stringify(graphData).slice(0, 10000)}`;
  const prompt = `
You are an expert product design analyst.
Using the following grounding data from Neo4j, answer the question below.
Be concise and show cost, risk, and time tradeoffs.

Cypher: ${cypher}
Grounding: ${context}

Question: ${originalQuestion}`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });
  return response.choices[0].message.content.trim();
}

// ---------- Helper for consistent responses ----------
function sendJson(res, ok, payload, err) {
  if (ok) res.json({ ok, ...payload });
  else {
	  console.log(err);
	  res.status(500).json({ ok: false, error: err?.message || err });
	  
  }
}

// ---------- Routes ----------

// Health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'Gateway', mcp: true }));

// 1️⃣ Method 1: LWC → Gateway → LLM→Cypher→MCP
app.post('/method1', async (req, res) => {
  try {
    const { naturalLanguage } = req.body;
    const cypherQuery = await translateToCypher(naturalLanguage);
    const client = await mcpClientPromise;
    const result = await client.callTool({ name: 'read_neo4j_cypher', arguments: { query: cypherQuery } });
    const grounded = await groundedAnswer(naturalLanguage, result.content?.json || result.content?.text || result, cypherQuery);
    sendJson(res, true, { mode: 'method1', cypher: cypherQuery, groundedAnswer: grounded });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 2️⃣ Method 2: LWC → Gateway → MCP text2cypher
app.post('/method2', async (req, res) => {
  try {
    const { naturalLanguage } = req.body;
    const client = await mcpClientPromise;
    const toolResult = await client.callTool({ name: 'text2cypher', arguments: { query: naturalLanguage } });

    let cypherQuery, graphData;
    const contentBlock = toolResult.content?.[0];
    if (contentBlock?.type === 'text' && contentBlock.text) {
      const parsed = JSON.parse(contentBlock.text);
      cypherQuery = parsed.cypher || parsed.cypherQuery;
      graphData = parsed.graphData || parsed.rows || parsed.records || "";
    }
    const grounded = await groundedAnswer(naturalLanguage, graphData, cypherQuery);
    sendJson(res, true, { mode: 'method2', cypher: cypherQuery, groundedAnswer: grounded });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 3️⃣ No-RAG fallback (for comparison)
app.post('/no-rag', async (req, res) => {
  try {
    const { naturalLanguage } = req.body;
    const client = await mcpClientPromise;
    const cypherQuery = await translateToCypher(naturalLanguage);
    const result = await client.callTool({ name: 'read_neo4j_cypher', arguments: { query: cypherQuery } });
    sendJson(res, true, { mode: 'no-rag', cypher: cypherQuery, result: result.content?.text || result.content?.json || result });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 4️⃣ Salesforce → Neo4j sync
app.post('/sync/sf', async (req, res) => {
  try {
    const data = req.body;
    const client = await mcpClientPromise;
    const result = await client.callTool({ name: 'upsert_salesforce', arguments: data });
    sendJson(res, true, { ok: true, message: 'Salesforce data synced', result: result.content?.json || result.content?.text });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 5️⃣ MCP passthrough (used by Apex McpGatewayController)
app.post('/mcp', async (req, res) => {
  try {
    const { name, arguments: args } = req.body.params || {};
    const client = await mcpClientPromise;
    const result = await client.callTool({ name: name, arguments: args || {} });
    sendJson(res, true, { ok: true, tool: name, result: result.content?.json || result.content?.text });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 6️⃣ Build schema (LWC trigger)
app.post('/schema/build', async (req, res) => {
  try {
    const client = await mcpClientPromise;
    const result = await client.callTool({ name: 'build_graph_schema', arguments: {} });
    sendJson(res, true, { result: result.content?.json || result.content?.text });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// 7️⃣ Build KG (LWC trigger)
app.post('/kg/build', async (req, res) => {
  try {
    const client = await mcpClientPromise;
    const result = await client.callTool({ name: 'build_kg_from_pdfs', arguments: {} });
    sendJson(res, true, { result: result.content?.json || result.content?.text });
  } catch (err) {
    sendJson(res, false, null, err);
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 9005;
app.listen(PORT, () => console.log(`🚀 Gateway running on http://localhost:${PORT}`));
