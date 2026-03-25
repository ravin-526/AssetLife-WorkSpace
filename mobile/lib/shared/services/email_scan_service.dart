import '../../core/api/api_client.dart';
import '../models/email_sync_models.dart';

class EmailScanService {
  final ApiClient apiClient;

  EmailScanService(this.apiClient);

  Future<EmailScanSummary> scanEmails({
    required int days,
    required int maxResults,
  }) async {
    final response = await apiClient.post(
      '/api/email/scan',
      data: {'days': days, 'max_results': maxResults},
    );
    return EmailScanSummary.fromJson(
      Map<String, dynamic>.from(response as Map),
    );
  }
}
