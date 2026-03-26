import 'package:flutter/material.dart';
import '../../../shared/services/category_service.dart';

class CategoryProvider extends ChangeNotifier {
  final CategoryService _categoryService;
  List<Map<String, dynamic>> _categories = [];
  bool _isLoading = false;
  String? _error;

  CategoryProvider(this._categoryService);

  List<Map<String, dynamic>> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchCategories() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      _categories = await _categoryService.getCategories();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
