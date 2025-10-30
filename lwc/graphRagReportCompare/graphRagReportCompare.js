import { LightningElement, track } from 'lwc';
import callMcpTool from '@salesforce/apex/McpGatewayController.callMcpTool';

export default class GraphRagReportCompare extends LightningElement {
  @track toolName = 'run_vector_query';
  @track argumentsJson = '{"question":"Summarize communication challenges between patients and clinicians"}';
  @track loading = false;
  @track error = null;
  @track textResult = null;
  @track parsedResults = []; // 🆕 Human-readable vector entries
  @track tableData = [];
  @track columns = [];
  @track rawJson = '';

  handleToolChange(e) {
    this.toolName = e.target.value;
  }

  handleArgsChange(e) {
    this.argumentsJson = e.target.value;
  }

  async callMcp() {
    this.loading = true;
    this.error = null;
    this.textResult = null;
    this.parsedResults = [];
    this.tableData = [];
    this.columns = [];
    this.rawJson = '';

    try {
      const result = await callMcpTool({
        toolName: this.toolName,
        argumentsJson: this.argumentsJson
      });

      // 🔹 Save full JSON for debugging
      this.rawJson = JSON.stringify(result, null, 2);

      // 🔹 Extract text output
      let textOutput = '';
      if (result?.result?.content) {
        const textBlock = result.result.content.find(c => c.type === 'text');
        if (textBlock) textOutput = textBlock.text;
      } else if (result?.content && typeof result.content[0]?.text === 'string') {
        textOutput = result.content[0].text;
      }
      this.textResult = textOutput;

      // 🧠 Try parsing readable structure from text output
      if (textOutput) {
        try {
          const parsed = JSON.parse(textOutput);
          if (parsed.ok && parsed.result) {
            this.parsedResults = parsed.result.map((r, i) => ({
              id: r.id || i,
              rank: i + 1,
              score: r.score ? r.score.toFixed(3) : '',
              text: r.node?.text || JSON.stringify(r)
            }));
          }
        } catch (e) {
          // not JSON, display raw text
          this.parsedResults = [];
        }
      }

      // 🔹 Detect structured table data
      const structured =
        result?.result?.structuredContent?.rows ||
        result?.result?.structuredContent?.graphData ||
        result?.result?.graphData ||
        result?.graphData ||
        result?.rows;

      if (Array.isArray(structured) && structured.length) {
        const keys = Object.keys(structured[0]);
        this.columns = keys.map(k => ({ label: k, fieldName: k, type: 'text' }));
        this.tableData = structured.map((r, i) => ({ id: i, ...r }));
      }
    } catch (err) {
      this.error = err?.body?.message || err.message || JSON.stringify(err);
    } finally {
      this.loading = false;
    }
  }
}
