"""
───────────────────────────────────────────────────────────────
MCP Neo4j GraphRAG Pipeline Server
───────────────────────────────────────────────────────────────
This server integrates Neo4j, OpenAI, and the neo4j-graphrag library
into a unified MCP service that allows:

  • Building Knowledge Graphs from PDFs (via SimpleKGPipeline)
  • Running Vector-only, Hybrid (Vector + Cypher), and GraphRAG queries
  • Performing schema creation and health checks via FastMCP tools

Fully aligned with the structure in the Neo4j GraphRAG example
(end-to-end-lupus.ipynb) with Salesforce/AgentForce integration in mind.
"""

# =============================================================
# Imports
# =============================================================
import os
import json
import traceback
from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.tools.tool import ToolResult, TextContent
from neo4j import GraphDatabase

# Neo4j GraphRAG imports
from neo4j_graphrag.generation import GraphRAG
from neo4j_graphrag.llm import OpenAILLM
from neo4j_graphrag.embeddings.openai import OpenAIEmbeddings
from neo4j_graphrag.retrievers.text2cypher import Text2CypherRetriever
from neo4j_graphrag.retrievers import VectorRetriever, VectorCypherRetriever
from neo4j_graphrag.experimental.pipeline.kg_builder import SimpleKGPipeline
from neo4j_graphrag.experimental.components.text_splitters.fixed_size_splitter import FixedSizeSplitter
from neo4j_graphrag.indexes import create_vector_index
from neo4j_graphrag.generation import RagTemplate

# =============================================================
# Environment Setup
# =============================================================
load_dotenv()
NEO4J_URI = os.getenv("NEO4J_URL", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASSWORD", "password")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PDF_DIR = os.getenv("PDF_DIR", "truncated-pdfs")

# =============================================================
# Initialize Neo4j + LLM + Embeddings
# =============================================================
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
llm = OpenAILLM(model_name="gpt-4o-mini", model_params={"temperature": 0}, api_key=OPENAI_API_KEY)
embedder = OpenAIEmbeddings(api_key=OPENAI_API_KEY, model="text-embedding-3-small")

# =============================================================
# Text2CypherRetriever & GraphRAG setup
# =============================================================
retriever = Text2CypherRetriever(driver=driver, llm=llm, neo4j_database=os.getenv("NEO4J_DATABASE", "neo4j"))
rag = GraphRAG(retriever=retriever, llm=llm)

# =============================================================
# Node Labels / Relationship Types / Prompt Template
# =============================================================
node_labels = ["Document", "Chunk", "Entity", "Supplier", "Component", "Product"]
rel_types = [
    "HAS_CHUNK", "HAS_ENTITY", "CAN_SUPPLY", "USED_IN",
    "SUPPLIES", "MENTIONS", "REFERS_TO", "LINKS_TO"
]

prompt_template = '''
You are a domain researcher extracting entities and relationships
from the input text to build a property graph.

Return JSON as:
{
  "nodes": [{"id": "0", "label": "EntityType", "properties": {"name": "EntityName"}}],
  "relationships": [{"type": "RELATIONSHIP", "start_node_id": "0", "end_node_id": "1",
                     "properties": {"details": "Relationship details"}}]
}

Use only provided text and allowed schema types.
'''

# =============================================================
# Simple Knowledge Graph Builder Pipeline
# =============================================================
kg_builder_pdf = SimpleKGPipeline(
    llm=llm,
    driver=driver,
    text_splitter=FixedSizeSplitter(chunk_size=500, chunk_overlap=100),
    embedder=embedder,
    entities=node_labels,
    relations=rel_types,
    prompt_template=prompt_template,
    from_pdf=True
)

# =============================================================
# Initialize FastMCP Server
# =============================================================
mcp = FastMCP(name="neo4j-graphrag-server", stateless_http=True)

# =============================================================
#  MCP TOOLS
# =============================================================

@mcp.tool(name="build_graph_schema")
def build_graph_schema():
    """Create constraints and indexes in Neo4j for KG."""
    try:
        cmds = [
            "CREATE CONSTRAINT doc_id IF NOT EXISTS FOR (d:Document) REQUIRE d.doc_id IS UNIQUE",
            "CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE",
            "CREATE INDEX chunk_embed IF NOT EXISTS FOR (c:Chunk) ON (c.embedding)"
        ]
        with driver.session() as session:
            for c in cmds:
                session.run(c)
        return {"ok": True, "message": "Schema created successfully"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# =============================================================
# Build KG from PDFs (async)
# =============================================================
import asyncio

@mcp.tool(name="build_kg_from_pdfs")
async def build_kg_from_pdfs(paths: list = None):
    """Build knowledge graph from PDFs in /truncated-pdfs."""
    try:
        if not paths:
            paths = [os.path.join(PDF_DIR, f) for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
        if not paths:
            return {"ok": False, "error": f"No PDFs found in {PDF_DIR}"}

        for path in paths:
            print(f"📘 Processing PDF: {path}")
            await kg_builder_pdf.run_async(file_path=path)
        return {"ok": True, "message": f"Processed {len(paths)} PDFs"}
    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}

# =============================================================
# Vector & Hybrid (Vector + Cypher) Search
# =============================================================
create_vector_index(driver, name="text_embeddings", label="Chunk",
                    embedding_property="embedding", dimensions=1536, similarity_fn="cosine")

vector_retriever = VectorRetriever(driver, index_name="text_embeddings",
                                   embedder=embedder, return_properties=["text"])

vc_retriever = VectorCypherRetriever(
    driver,
    index_name="text_embeddings",
    embedder=embedder,
    retrieval_query="""
WITH node AS chunk
MATCH (chunk)<-[:FROM_CHUNK]-()-[relList:!FROM_CHUNK]-{1,2}()
UNWIND relList AS rel
WITH collect(DISTINCT chunk) AS chunks, collect(DISTINCT rel) AS rels
RETURN '=== text ===\\n' + apoc.text.join([c in chunks | c.text], '\\n---\\n')
  + '\\n\\n=== kg_rels ===\\n'
  + apoc.text.join([r in rels | startNode(r).name + ' - ' + type(r)
    + '(' + coalesce(r.details,'') + ')' + ' -> ' + endNode(r).name], '\\n---\\n') AS info
"""
)

@mcp.tool(name="run_vector_query")
def run_vector_query(question: str, top_k: int = 5, mode: str = "Vector" ):
    """Perform semantic vector search on KG."""
    try:
        results = vector_retriever.get_search_results(query_text=question, top_k=top_k)
        data = [r.data() for r in results.records]
        return {"ok": True, "query": question, "result": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@mcp.tool(name="run_hybrid_query")
def run_hybrid_query(question: str, top_k: int = 3, mode: str = "Hybrid"):
    """Run hybrid search (Vector + Cypher traversal)."""
    try:
        res = vc_retriever.get_search_results(query_text=question, top_k=top_k)
        info = res.records[0]['info']
        split = info.find('\n\n=== kg_rels ===\n')
        return {"ok": True, "textchunkcontext": info[:split], "kgcontext": info[split:]}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# =============================================================
# GraphRAG Queries (Vector + Hybrid with LLM reasoning)
# =============================================================
rag_template = RagTemplate(
    template="""Answer the Question using only this Context.
# Question:
{query_text}

# Context:
{context}

# Answer:
""",
    expected_inputs=['query_text', 'context']
)

v_rag = GraphRAG(llm=llm, retriever=vector_retriever, prompt_template=rag_template)
vc_rag = GraphRAG(llm=llm, retriever=vc_retriever, prompt_template=rag_template)

@mcp.tool(name="run_graphrag_search_both")
def run_graphrag_search_both(question: str, top_k: int = 5):
    """Run both Vector-only and Vector+Cypher RAG searches and return responses."""
    try:
        v_resp = v_rag.search(question, retriever_config={'top_k': top_k}).answer
        vc_resp = vc_rag.search(question, retriever_config={'top_k': top_k}).answer
        return {"ok": True, "vectorresponse": v_resp, "vectorcypherresponse": vc_resp}
    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}

@mcp.tool(name="run_graphrag_search_vector_withcontext")
def run_graphrag_search_vector_withcontext(question: str, top_k: int = 5):
    """Run graphrag search with context for (Vector + Cypher) query."""
    try:


        # Below we visualize the context we get back when submitting a search prompt.
        # vc_res = vc_retriever.get_search_results(query_text = "How is precision medicine applied to Lupus?", top_k=3)

        vectorresponse = v_rag.search(question, retriever_config={'top_k':3}, return_context=True).answer
        print(f"Vector Response: \n{vectorresponse}")
        print("\n===========================\n")


        return json.dumps({
            "ok": True,
            "vectorresponse": vectorresponse,
        })

    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}


@mcp.tool(name="run_graphrag_search_hybrid_withcontext")
def run_graphrag_search_hybrid_withcontext(question: str, top_k: int = 5):
    """Run graphrag search with context for (Vector + Cypher) query."""
    try:


        # Below we visualize the context we get back when submitting a search prompt.
        # vc_res = vc_retriever.get_search_results(query_text = "How is precision medicine applied to Lupus?", top_k=3)

        vectorcypherresponse = vc_rag.search(question, retriever_config={'top_k':3}, return_context=True).answer

        print(f"Vector + Cypher Response: \n{vectorcypherresponse}")


        return json.dumps({
            "ok": True,
            "vectorcypherresponse": vectorcypherresponse
        })

    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}



# =============================================================
# Text2Cypher & Cypher Execution Tools
# =============================================================
@mcp.tool(name="text2cypher")
def text2cypher_tool(query: str, mode: str = "Text2Cypher" ):
    """Generate and execute Cypher query from text using Text2CypherRetriever."""
    try:
        result = retriever.search(query_text=query)
        cypher_query = getattr(result, "cypher", None)
        with driver.session() as s:
            data = [r.data() for r in s.run(cypher_query)]
        return {"ok": True, "cypher": cypher_query, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e),  "trace": traceback.format_exc()}

@mcp.tool(name="read_neo4j_cypher")
def read_neo4j_cypher(query: str):
    """Execute a raw Cypher query (read-only)."""
    try:
        with driver.session(default_access_mode="READ") as s:
            rows = [r.data() for r in s.run(query)]
        return {"ok": True, "rows": rows}
    except Exception as e:
        return {"ok": False, "error": str(e),  "trace": traceback.format_exc()}

# =============================================================
# Health Check
# =============================================================
@mcp.tool(name="health")
def health_check():
    """Basic service & Neo4j health validation."""
    try:
        with driver.session(default_access_mode="READ") as s:
            ok = s.run("RETURN 1 AS ok").single()["ok"] == 1
        return {"ok": ok}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# =============================================================
# Server Start
# =============================================================
if __name__ == "__main__":
    print("🚀 Starting MCP GraphRAG Server at http://localhost:8005/mcp")
    mcp.run(transport="http", port=8005)
