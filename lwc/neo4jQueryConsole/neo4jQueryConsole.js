import { LightningElement, track } from 'lwc';
import callMcpTool from '@salesforce/apex/McpGatewayController.callMcpTool';

const MODE_MAP = {
  'Vector (semantic)': 'run_vector_query',
  'Hybrid (vector+cypher)': 'run_hybrid_query'
};

export default class Neo4jQueryConsole extends LightningElement {
  @track mode = 'Vector (semantic)';
  @track question = '';
  @track loading = false;
  @track output = null;

  get modeOptions() {
    return Object.keys(MODE_MAP).map(k => ({ label: k, value: k }));
  }

  handleModeChange(e) {
    this.mode = e.target.value;
  }

  handleQuestion(e) {
    this.question = e.target.value;
  }

  async runQuery() {
    this.loading = true;
    this.output = null;
    try {
      const toolName = MODE_MAP[this.mode];
      let args = {};
      if (toolName === 'read_neo4j_cypher') {
        args.query = this.question;
      } else if (toolName === 'text2cypher') {
        args.query = this.question;
      } else {
        args.question = this.question;
        args.mode = this.mode === 'Vector (semantic)' ? 'vector' : (this.mode === 'Hybrid (vector+cypher)' ? 'hybrid' : 'auto');
      }
      const res = await callMcpTool({ toolName: toolName, argumentsJson: JSON.stringify(args) });
      this.output = JSON.stringify(res, null, 2);
    } catch (err) {
      this.output = 'Error: ' + JSON.stringify(err);
    } finally {
      this.loading = false;
    }
  }
}
