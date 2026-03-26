import 'package:flutter/material.dart';
import '../../../shared/services/category_service.dart';

class StatusProvider extends ChangeNotifier {
  final StatusService _statusService;
  List<String> _statuses = [];
  bool _isLoading = false;
  String? _error;

  StatusProvider(this._statusService);

  List<String> get statuses => _statuses;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchStatuses() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      _statuses = await _statusService.getStatuses();
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
