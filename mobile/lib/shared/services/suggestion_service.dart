import '../../core/api/api_client.dart';
import '../models/email_sync_models.dart';

class SuggestionService {
  final ApiClient apiClient;

  SuggestionService(this.apiClient);

  Future<List<AssetSuggestion>> getSuggestions() async {
    final response = await apiClient.get('/api/assets/suggestions');
    if (response is List) {
      return response
          .whereType<Map>()
          .map(
            (item) => AssetSuggestion.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    }
    if (response is Map && response['data'] is List) {
      return (response['data'] as List)
          .whereType<Map>()
          .map(
            (item) => AssetSuggestion.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    }
    return <AssetSuggestion>[];
  }

  Future<SuggestionEmailDetails> getSuggestionEmailDetails(
    String suggestionId,
  ) async {
    final response = await apiClient.get(
      '/api/assets/suggestions/$suggestionId/email',
    );
    return SuggestionEmailDetails.fromJson(
      Map<String, dynamic>.from(response as Map),
    );
  }

  Future<void> confirmSuggestion(String suggestionId) async {
    await apiClient.post(
      '/api/assets/suggestions/$suggestionId/confirm',
      data: {},
    );
  }

  Future<void> rejectSuggestion(String suggestionId) async {
    await apiClient.post('/api/assets/suggestions/$suggestionId/reject');
  }

  Future<List<int>> fetchSuggestionAttachmentBytes(String suggestionId) async {
    return apiClient.getBytes(
      '/api/assets/suggestions/$suggestionId/attachment',
    );
  }
}
