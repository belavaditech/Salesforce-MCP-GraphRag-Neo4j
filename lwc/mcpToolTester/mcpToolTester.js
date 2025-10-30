import { LightningElement, track } from 'lwc';
import callMcpTool from '@salesforce/apex/McpGatewayController.callMcpTool';

export default class McpToolTester extends LightningElement {
  @track toolName = 'run_vector_query';
  @track argumentsJson = '{"question":"Summarize communication challenges between patients and clinicians"}';
  @track result;
  @track error;
  @track loading = false;
  @track tooloptions = [ 'run_vector_query', 'run_hybrid_query', 
    'run_graphrag_context_both', 'run_graphrag_search_both',
     'run_graphrag_search_vector_withcontext', 'run_graphrag_search_hybrid_withcontext'];

  handleToolChange(e) {
    this.toolName = e.target.value;
  }

  handleArgsChange(e) {
    this.argumentsJson = e.target.value;
  }

  async callMcp() {
    this.loading = true;
    this.result = null;
    this.error = null;

    try {
      const res = await callMcpTool({ toolName: this.toolName, argumentsJson: this.argumentsJson });
      this.result = res;
      
    } catch (err) {
      this.error = err?.body?.message || JSON.stringify(err);
    } finally {
      this.loading = false;
    }
  }

  get formattedResult() {
    try {
      return JSON.stringify(this.result, null, 2);
    } catch {
      return this.result;
    }
  }
}
