import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

class ApiClient {
  late Dio _dio;
  static const _secureStorage = FlutterSecureStorage();
  final VoidCallback? onUnauthorized;
  
  ApiClient({this.onUnauthorized}) {
    _initializeDio();
  }
  
  void _initializeDio() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        contentType: 'application/json',
        responseType: ResponseType.json,
      ),
    );
    
    // Add interceptors
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onResponse: _onResponse,
        onError: _onError,
      ),
    );
  }
  
  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Add auth token to headers
    final token = await _secureStorage.read(key: AppConstants.tokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    if (kDebugMode) {
      debugPrint('[API] ${options.method} ${options.baseUrl}${options.path}');
      debugPrint('[API] payload: ${options.data}');
    }
    return handler.next(options);
  }

  void _onResponse(Response response, ResponseInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('[API] response (${response.statusCode}) ${response.requestOptions.path}');
      debugPrint('[API] body: ${response.data}');
    }
    handler.next(response);
  }
  
  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Handle 401 - Unauthorized
    if (err.response?.statusCode == 401) {
      await _secureStorage.delete(key: AppConstants.tokenKey);
      onUnauthorized?.call();
    }
    if (kDebugMode) {
      debugPrint('[API] error (${err.response?.statusCode}) ${err.requestOptions.path}');
      debugPrint('[API] error body: ${err.response?.data}');
    }
    return handler.next(err);
  }
  
  // Generic GET request
  Future<dynamic> get(String endpoint) async {
    try {
      final response = await _dio.get(endpoint);
      return response.data;
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }
  
  // Generic POST request
  Future<dynamic> post(String endpoint, {dynamic data}) async {
    try {
      final response = await _dio.post(endpoint, data: data);
      return response.data;
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }
  
  // Generic PUT request
  Future<dynamic> put(String endpoint, {dynamic data}) async {
    try {
      final response = await _dio.put(endpoint, data: data);
      return response.data;
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }
  
  // Generic DELETE request
  Future<dynamic> delete(String endpoint) async {
    try {
      final response = await _dio.delete(endpoint);
      return response.data;
    } on DioException catch (e) {
      _handleDioError(e);
    }
  }
  
  void _handleDioError(DioException error) {
    if (error.response != null) {
      final dynamic responseData = error.response?.data;
      String message = 'An error occurred';
      if (responseData is Map<String, dynamic>) {
        final detail = responseData['detail'];
        final backendMessage = responseData['message'];
        if (detail is String && detail.isNotEmpty) {
          message = detail;
        } else if (backendMessage is String && backendMessage.isNotEmpty) {
          message = backendMessage;
        }
      } else if (responseData is String && responseData.isNotEmpty) {
        message = responseData;
      }

      throw ApiException(
        message: message,
        statusCode: error.response?.statusCode,
      );
    } else if (error.type == DioExceptionType.connectionTimeout) {
      throw ApiException(message: 'Connection timeout');
    } else if (error.type == DioExceptionType.receiveTimeout) {
      throw ApiException(message: 'Request timeout');
    } else {
      throw ApiException(message: 'No internet connection');
    }
  }
  
  // Store token securely
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: AppConstants.tokenKey, value: token);
  }
  
  // Clear token
  Future<void> clearToken() async {
    await _secureStorage.delete(key: AppConstants.tokenKey);
  }
  
  // Get token
  Future<String?> getToken() async {
    return await _secureStorage.read(key: AppConstants.tokenKey);
  }
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  
  ApiException({required this.message, this.statusCode});
  
  @override
  String toString() => 'ApiException: $message${statusCode != null ? ' (Status: $statusCode)' : ''}';
}
