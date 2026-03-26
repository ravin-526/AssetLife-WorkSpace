import '../../core/api/api_client.dart';

class CategoryService {
  final ApiClient apiClient;

  CategoryService(this.apiClient);

  Future<List<Map<String, dynamic>>> getCategories() async {
    try {
      final response = await apiClient.get('/api/categories');
      if (response is List) {
        return List<Map<String, dynamic>>.from(response);
      } else if (response is Map && response['data'] is List) {
        return List<Map<String, dynamic>>.from(response['data']);
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
}

class StatusService {
  final ApiClient apiClient;

  StatusService(this.apiClient);

  Future<List<String>> getStatuses() async {
    try {
      final response = await apiClient.get('/api/statuses');
      if (response is List) {
        return response.map<String>((item) => item['name'] as String).toList();
      } else if (response is Map && response['data'] is List) {
        return (response['data'] as List).map<String>((item) => item['name'] as String).toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
}
