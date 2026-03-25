import '../../core/api/api_client.dart';
import '../models/asset.dart';

class AssetService {
  final ApiClient apiClient;
  
  AssetService(this.apiClient);
  
  Future<List<Asset>> getAssets() async {
    try {
      final response = await apiClient.get('/api/assets');
      if (response is List) {
        return response.map((json) => Asset.fromJson(json)).toList();
      } else if (response is Map && response['data'] is List) {
        return (response['data'] as List)
            .map((json) => Asset.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
  
  Future<Asset> getAsset(String assetId) async {
    try {
      final response = await apiClient.get('/api/assets/$assetId');
      return Asset.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
  
  Future<Asset> createAsset(Map<String, dynamic> data) async {
    try {
      final response = await apiClient.post('/api/assets', data: data);
      return Asset.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
  
  Future<Asset> updateAsset(String assetId, Map<String, dynamic> data) async {
    try {
      final response = await apiClient.put(
        '/api/assets/$assetId',
        data: data,
      );
      return Asset.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
  
  Future<void> deleteAsset(String assetId) async {
    try {
      await apiClient.delete('/api/assets/$assetId');
    } catch (e) {
      rethrow;
    }
  }
}
