import 'package:flutter/material.dart';
import '../../../shared/models/user.dart';
import '../../../shared/services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;

  User? _user;
  bool _isLoading = false;
  String? _error;
  bool _isAuthenticated = false;

  AuthProvider(this._authService);

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _isAuthenticated;

  Future<String?> sendOtp(String mobile) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      return await _authService.sendOtp(mobile);
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> registerIndividual({
    required String name,
    required String mobile,
    required String email,
    required String dob,
    required String pan,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      return await _authService.registerIndividual(
        name: name,
        mobile: mobile,
        email: email,
        dob: dob,
        pan: pan,
      );
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyOtp({required String mobile, required String otp}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _authService.verifyOtp(mobile: mobile, otp: otp);
      await _authService.apiClient.saveToken(response.accessToken);
      _user = response.user;
      _isAuthenticated = true;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> checkAuthStatus() async {
    try {
      final token = await _authService.apiClient.getToken();
      _isAuthenticated = token != null && token.isNotEmpty;
      if (_isAuthenticated) {
        _user = await _authService.getProfile();
      }
    } catch (_) {
      _isAuthenticated = false;
      _user = null;
    }
    notifyListeners();
    return _isAuthenticated;
  }

  Future<void> logout() async {
    await _authService.logout();
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
