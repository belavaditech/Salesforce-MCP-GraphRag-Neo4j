import { LightningElement, track } from 'lwc';
import callMcpTool from '@salesforce/apex/McpGatewayController.callMcpTool';

const MAX_PREVIEW_CHARS = 1200; // 🔹 adjust to your UI width and comfort

export default class GraphragContextVisualizer extends LightningElement {
  @track question = '';
  @track loading = false;
  @track vectorResult = '';
  @track hybridResult = '';
  @track vectorReadable = [];
  @track hybridReadable = {};
  @track hasVector = false;
  @track hasHybrid = false;
  @track showFullVector = false;
  @track showFullHybridText = false;
  @track showFullHybridKG = false;

  handleQuestion(e) {
    this.question = e.target.value;
  }

  async runVector() {
    await this._run('run_vector_query', { question: this.question });
  }

  async runHybrid() {
    await this._run('run_hybrid_query', { question: this.question });
  }

  async _run(toolName, args) {
    this.loading = true;

    try {
      const res = await callMcpTool({
        toolName: toolName,
        argumentsJson: JSON.stringify(args)
      });

      if (toolName === 'run_vector_query') {
        this.vectorResult = JSON.stringify(res, null, 2);
        this.vectorReadable = this._parseVector(res);
        this.hasVector = true;
      } else {
        this.hybridResult = JSON.stringify(res, null, 2);
        this.hybridReadable = this._parseHybrid(res);
        this.hasHybrid = true;
      }
    } catch (err) {
      const errorMsg = 'Error: ' + JSON.stringify(err);
      if (toolName === 'run_vector_query') {
        this.vectorResult = errorMsg;
        this.vectorReadable = [];
        this.hasVector = true;
      } else {
        this.hybridResult = errorMsg;
        this.hybridReadable = {};
        this.hasHybrid = true;
      }
    } finally {
      this.loading = false;
    }
  }

  _parseVector(res) {
    try {
      const textBlock = res?.result?.content?.find(c => c.type === 'text')?.text;
      const parsed = textBlock ? JSON.parse(textBlock) : null;
      if (parsed?.ok && parsed?.result?.length) {
        return parsed.result.map((r, i) => ({
          id: r.id || i,
          rank: i + 1,
          score: r.score ? parseFloat(r.score).toFixed(3) : '',
          text: r.node?.text || ''
        }));
      }
    } catch (e) {
      console.warn('Vector parse failed', e);
    }
    return [];
  }

  _parseHybrid(res) {
    try {
      const text = res?.result?.content?.find(c => c.type === 'text')?.text;
      const parsed = text ? JSON.parse(text) : null;
      if (parsed?.ok) {
        return {
          textchunkcontext: parsed.textchunkcontext || '',
          kgcontext: parsed.kgcontext || ''
        };
      }
    } catch (e) {
      console.warn('Hybrid parse failed', e);
    }
    return {};
  }

  // 🧭 UI helpers to limit display
  get vectorPreview() {
    return this.showFullVector
      ? this.vectorReadable
      : this.vectorReadable.map(v => ({
          ...v,
          text: v.text.length > MAX_PREVIEW_CHARS
            ? v.text.slice(0, MAX_PREVIEW_CHARS) + '...'
            : v.text
        }));
  }

  get hybridTextPreview() {
    const full = this.hybridReadable.textchunkcontext || '';
    return this.showFullHybridText || full.length <= MAX_PREVIEW_CHARS
      ? full
      : full.slice(0, MAX_PREVIEW_CHARS) + '...';
  }

  get hybridKGPreview() {
    const full = this.hybridReadable.kgcontext || '';
    return this.showFullHybridKG || full.length <= MAX_PREVIEW_CHARS
      ? full
      : full.slice(0, MAX_PREVIEW_CHARS) + '...';
  }

  toggleVector() {
    this.showFullVector = !this.showFullVector;
  }
  toggleHybridText() {
    this.showFullHybridText = !this.showFullHybridText;
  }
  toggleHybridKG() {
    this.showFullHybridKG = !this.showFullHybridKG;
  }
}
