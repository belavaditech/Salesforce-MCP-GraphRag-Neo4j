# Salesforce–Neo4j Integration using MCP & GraphRAG  
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  
## Belavaditech  

## Table of Contents  
- [Project Overview](#project-overview)  
- [Key Technologies](#key-technologies)  
- [Architecture & Methods](#architecture--methods)  
  - Method 1: Manual Cypher RAG  
  - Method 2: Retriever RAG  
  - Method 3: No-RAG  
  - Method 4: GraphRAG Pipeline  
- [Benefits of Each Method](#benefits-of-each-method)  
- [Demo / Screenshots](#demo--screenshots)  
- [Getting Started](#getting-started)  
  - Prerequisites  
  - Setup & Installation  
- [Usage](#usage)  
- [Configuration](#configuration)  
- [Contribution](#contribution)  
- [License](#license)  
- [Contact](#contact)  

---

## Project Overview  
This repository demonstrates an integration between **Salesforce** (CRM platform) and **Neo4j** (graph-database) using the **Model Context Protocol (MCP)**, incorporating the concept of **GraphRAG** (Graph-based Retrieval-Augmented Generation).  
The goal is to enable Salesforce to leverage graph-based insights (via Neo4j) for enhanced customer, case, or relationship analytics — such as multi-hop queries, similarity search and semantic understanding of data relationships.

This project showcases four distinct integration methods, leveraging Apex, LWC, and Named Credentials within Salesforce, and querying Neo4j via MCP servers — staying entirely within the Salesforce and Neo4j ecosystem.

---

## Key Technologies  
- **Salesforce**: Apex, LWC, Named Credentials, Flow automation  
- **Neo4j**: Graph modelling (nodes, relationships, properties), Cypher query language  
- **Model Context Protocol (MCP)**: Standardized protocol connecting AI models to tools and databases  
- **GraphRAG**: Combines vector embeddings + graph context for richer retrieval and insights  

---

## Architecture & Methods  

### Method 1: Manual Cypher RAG  
**Flow:** Salesforce → MCP Gateway → Neo4j (manual Cypher queries)  
**Highlights:** Developer writes Cypher queries manually; best for debugging or full query control.  

### Method 2: Retriever RAG  
**Flow:** Salesforce → Retriever → Gateway → Neo4j  
**Highlights:** Converts natural language to Cypher automatically; faster and more intuitive for users.  

### Method 3: No-RAG Integration  
**Flow:** Salesforce → MCP Gateway → Neo4j (direct structured calls)  
**Highlights:** No retrieval or grounding layer; deterministic and high-performance for data syncs.  

### Method 4: GraphRAG Pipeline  
**Flow:** Salesforce → Grounding → Gateway → GraphRAG Pipeline → Neo4j  
**Highlights:** Combines vector + graph context; provides context-rich insights for knowledge graph use cases.  

---

## Benefits of Each Method  

| Feature / Method | Manual Cypher RAG | Retriever RAG | No-RAG | GraphRAG Pipeline |
|------------------|------------------|----------------|--------|-------------------|
| Query Type | Manual Cypher | Natural Language | Structured | Hybrid |
| Complexity | High | Medium | Low | Medium |
| Accuracy | Developer-driven | Depends on retriever | Exact | Context-rich |
| Use Case | Debugging | Interactive Queries | Sync / CRUD | Insights |
| Performance | Medium | Medium | High | Medium |

---

## Demo / Screenshots  
*(Add demo screenshots here)*  
1. **Method 1:** LWC input → Apex → Named Credential → Neo4j response  
2. **Method 2:** NL prompt → Retriever → Graph visualization  
3. **Method 3:** Case sync → Neo4j update log  
4. **Method 4:** GraphRAG insights → LWC dashboard  

---

## Getting Started  

### Prerequisites  
- Salesforce Developer Org or Sandbox  
- Neo4j database (local or Aura)  
- Node.js for MCP Gateway or Python for MCP Server  
- Basic knowledge of Apex, LWC, Cypher  

### Setup & Installation  
```bash
git clone https://github.com/belavaditech/Salesforce-MCP-GraphRag-Neo4j.git
cd Salesforce-MCP-GraphRag-Neo4j
```

1. Configure Neo4j connection credentials.  
2. Set up MCP server (e.g., `mcp-neo4j-cypher`) with Neo4j details.  
3. Create Named Credential in Salesforce for secure endpoint calls.  
4. Deploy Apex classes and LWC components.  

---

## Usage  
- **Method 1:** Execute manual Cypher queries via LWC interface.  
- **Method 2:** Enter natural language prompts for automated Cypher retrieval.  
- **Method 3:** Sync case data automatically between Salesforce and Neo4j.  
- **Method 4:** Explore GraphRAG insights and summaries directly in Salesforce.  

---

## Configuration  

Create a `.env` file for your environment:  
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
MCP_TRANSPORT=stdio
MCP_PORT=8005
LLM_MODEL=openai:text-embedding-3-small
```

In Salesforce:  
- Set up a **Named Credential** pointing to the MCP Gateway endpoint.  
- Assign permission sets for API calls from Apex.  

---

## Contribution  
Contributions are welcome!  
1. Fork the repo  
2. Create a new branch (`feature/your-feature`)  
3. Commit your changes  
4. Submit a Pull Request  

---

## License  
This project is licensed under the MIT License — see [LICENSE](LICENSE).  

---

## Contact  
**Author:** Ramesh BN  
**Organization:** Belavaditech  
**Email:** [your.email@domain.com](mailto:your.email@domain.com)  

---

**Happy Graphing and Integrating! 🚀**
