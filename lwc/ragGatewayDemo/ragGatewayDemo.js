

import { LightningElement, track } from 'lwc';
import getMcpResponse from '@salesforce/apex/RagGatewayController.getMcpResponse';

export default class RagGatewayDemo extends LightningElement {
  @track userInput = '';
  @track selectedMode = 'method1';
  @track response;

  modeOptions = [
    { label: 'Method 1: (RAG) LLM → Cypher → MCP', value: 'method1' },
    { label: 'Method 2: (RAG) MCP Text2Cypher', value: 'method2' },
    { label: 'Method 3: (No-RAG) (Just cypher)', value: 'no-rag' }
  ];

  handleInput(event) {
    this.userInput = event.target.value;
  }

  handleModeChange(event) {
    this.selectedMode = event.detail.value;
  }

  async handleSubmit() {
    try {
      const result = await getMcpResponse({ input: this.userInput, mode: this.selectedMode });
      this.response = JSON.stringify(result, null, 2);
    } catch (error) {
      this.response = 'Error: ' + error.body.message;
    }
  }
}