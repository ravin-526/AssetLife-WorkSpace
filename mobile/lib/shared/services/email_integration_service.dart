import '../../core/api/api_client.dart';
import '../models/email_sync_models.dart';

class EmailIntegrationService {
  final ApiClient apiClient;

  EmailIntegrationService(this.apiClient);

  Future<GmailConnectionStatus> getStatus() async {
    final response = await apiClient.get('/api/integrations/gmail/status');
    return GmailConnectionStatus.fromJson(
      Map<String, dynamic>.from(response as Map),
    );
  }

  Future<GmailConnectResponse> connect({
    String? email,
    String source = 'mobile',
  }) async {
    final payload = <String, dynamic>{};
    final trimmed = email?.trim() ?? '';
    if (trimmed.isNotEmpty) {
      payload['email'] = trimmed;
    }
    payload['source'] = source;

    final response = await apiClient.post(
      '/api/integrations/gmail/connect',
      data: payload,
    );
    return GmailConnectResponse.fromJson(
      Map<String, dynamic>.from(response as Map),
    );
  }

  Future<void> disconnect() async {
    await apiClient.post('/api/integrations/gmail/disconnect');
  }
}
