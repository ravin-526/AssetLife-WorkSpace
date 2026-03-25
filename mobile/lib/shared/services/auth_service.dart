import '../../core/api/api_client.dart';
import '../models/user.dart';
import 'package:flutter/foundation.dart';

class AuthService {
  final ApiClient apiClient;

  AuthService(this.apiClient);

  String? _extractDebugOtp(dynamic response) {
    if (response is! Map<String, dynamic>) {
      return null;
    }
    return response['debug_otp']?.toString() ??
        response['dev_otp']?.toString() ??
        response['otp']?.toString();
  }

  Future<String?> sendOtp(String mobile) async {
    final response = await apiClient.post(
      '/individual/send-otp',
      data: {'mobile': mobile},
    );
    if (kDebugMode) {
      debugPrint('[AUTH] sendOtp response: $response');
    }
    return _extractDebugOtp(response);
  }

  Future<String?> registerIndividual({
    required String name,
    required String mobile,
    required String email,
    required String dob,
    required String pan,
  }) async {
    final response = await apiClient.post(
      '/individual/register',
      data: {
        'name': name,
        'mobile': mobile,
        'email': email,
        'dob': dob,
        'pan': pan,
      },
    );
    if (kDebugMode) {
      debugPrint('[AUTH] register response: $response');
    }
    return _extractDebugOtp(response);
  }

  Future<AuthResponse> verifyOtp({
    required String mobile,
    required String otp,
  }) async {
    final response = await apiClient.post(
      '/individual/verify-otp',
      data: {'mobile': mobile, 'otp': otp},
    );
    if (kDebugMode) {
      debugPrint('[AUTH] verifyOtp response: $response');
    }
    return AuthResponse.fromJson(response as Map<String, dynamic>);
  }

  Future<User> getProfile() async {
    final response = await apiClient.get('/individual/profile');
    return User.fromJson(response as Map<String, dynamic>);
  }

  Future<void> logout() async {
    await apiClient.clearToken();
  }
}
