import '../../core/api/api_client.dart';

class SourceService {
  final ApiClient apiClient;
  SourceService(this.apiClient);

  // For now, return static list matching web app
  List<String> getSources() {
    return [
      'Manual',
      'Email',
      'Upload',
      'QR Scan',
      'Excel',
    ];
  }
}
