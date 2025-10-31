public with sharing class GatewayController {
  @AuraEnabled(cacheable=false)
  public static Object getMcpResponse(String input, String mode) {
    Http http = new Http();
    HttpRequest req = new HttpRequest();

    String baseUrl = 'callout:RagNeo4jGateway'; // Replace with actual host
    
    String endpoint = baseUrl + '/' + mode; // mode = method1, method2, no-rag

    req.setEndpoint(endpoint);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');

    Map<String, Object> payload = new Map<String, Object>{ 'naturalLanguage' => input };
    req.setBody(JSON.serialize(payload));

    HttpResponse res = http.send(req);
    if (res.getStatusCode() == 200) {
      return JSON.deserializeUntyped(res.getBody());
    } else {
      throw new AuraHandledException('Gateway error: ' + res.getStatus());
    }
  }
}