import { LightningElement, track } from 'lwc';
import callMcpTool from '@salesforce/apex/McpGatewayController.callMcpTool';

export default class GraphSchemaManager extends LightningElement {
  @track loading = false;
  @track result = null;

  async callTool(toolName, argsObj) {
    this.loading = true;
    try {
      const argsJson = argsObj ? JSON.stringify(argsObj) : '';
      const res = await callMcpTool({ toolName: toolName, argumentsJson: argsJson });
      this.result = JSON.stringify(res, null, 2);
    } catch (err) {
      this.result = 'Error: ' + JSON.stringify(err);
    } finally {
      this.loading = false;
    }
  }

  handleBuildSchema() {
    this.callTool('build_graph_schema', {});
  }

  handleBuildKG() {
    // Example paths - server expects files in its PDF directory; omit args for default discovery
    this.callTool('build_kg_from_pdfs', { paths: [] });
  }

  handleSetupAll() {
    // call sequentially or call a composite tool if server has one
    this.callTool('setup_graphrag_environment', {});
  }
}
