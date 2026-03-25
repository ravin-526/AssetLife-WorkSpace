import 'package:flutter/material.dart';
import '../../../shared/models/asset.dart';
import '../../../shared/services/asset_service.dart';

class AssetProvider extends ChangeNotifier {
  final AssetService _assetService;
  
  List<Asset> _assets = [];
  bool _isLoading = false;
  String? _error;
  
  AssetProvider(this._assetService);
  
  // Getters
  List<Asset> get assets => _assets;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Get Assets
  Future<void> fetchAssets() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      _assets = await _assetService.getAssets();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Get Single Asset
  Future<Asset> getAsset(String assetId) async {
    return await _assetService.getAsset(assetId);
  }
  
  // Create Asset
  Future<Asset> createAsset(Map<String, dynamic> data) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final asset = await _assetService.createAsset(data);
      _assets.add(asset);
      return asset;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Update Asset
  Future<Asset> updateAsset(String assetId, Map<String, dynamic> data) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final asset = await _assetService.updateAsset(assetId, data);
      final index = _assets.indexWhere((a) => a.id == assetId);
      if (index != -1) {
        _assets[index] = asset;
      }
      return asset;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Delete Asset
  Future<void> deleteAsset(String assetId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      await _assetService.deleteAsset(assetId);
      _assets.removeWhere((a) => a.id == assetId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Get assets by status
  List<Asset> getAssetsByStatus(String status) {
    return _assets.where((asset) => asset.status == status).toList();
  }
  
  // Get total assets count
  int getTotalAssets() => _assets.length;
  
  // Get active assets count
  int getActiveAssetsCount() {
    return _assets.where((asset) => asset.status == 'Active' && !asset.isInactive).length;
  }
}
