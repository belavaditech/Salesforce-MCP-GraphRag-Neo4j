public with sharing class McpGatewayController {
    @AuraEnabled
    public static Object callMcpTool(String toolName, String argumentsJson) {
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:RagNeo4jMCP/mcp');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json,text/event-stream');

        // ✅ Safe argument handling
        Map<String, Object> args;
        if (String.isBlank(argumentsJson)) {
            args = new Map<String, Object>();
        } else {
            try {
                args = (Map<String, Object>) JSON.deserializeUntyped(argumentsJson);
            } catch (Exception e) {
                args = new Map<String, Object>{ 'raw' => argumentsJson };
            }
        }

        // ✅ Construct JSON-RPC payload
        Map<String, Object> payload = new Map<String, Object>{
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/call',
            'params' => new Map<String, Object>{
                'name' => toolName,
                'arguments' => args
            }
        };

        String body = JSON.serialize(payload);
        req.setBody(body);
        req.setTimeout(180000); // 3 minutes max allowed in Salesforce

        HttpResponse res = http.send(req);

        Integer status = res.getStatusCode();
        String rawBody = res.getBody();
        System.debug('🔍 MCP Raw Response: ' + rawBody);

        if (status >= 200 && status < 300) {
            try {
                // ✅ Handle Server-Sent Event formatting
                if (rawBody.startsWith('event:')) {
                    // Extract the JSON after 'data: '
                    Integer idx = rawBody.indexOf('data: ');
                    if (idx > -1) {
                        rawBody = rawBody.substring(idx + 6);
                    }
                }

                // ✅ Trim extra whitespace or line breaks
                rawBody = rawBody.trim();

                // ✅ Parse the actual JSON object
                return JSON.deserializeUntyped(rawBody);
            } catch (Exception e) {
                return new Map<String, Object>{
                    'error' => true,
                    'message' => 'Parse error: ' + e.getMessage(),
                    'raw' => rawBody
                };
            }
        } else {
            return new Map<String, Object>{
                'error' => true,
                'status' => status,
                'body' => rawBody
            };
        }
    }
}