class AppConstants {
  // Local network backend URL for physical Android device testing.
  static const String apiBaseUrl = 'http://192.168.0.6:8000';
  static const String tokenKey = 'access_token';
  static const String appName = 'Asset Life';
  static const int otpLength = 6;

  static const String loginRoute = '/login';
  static const String registerRoute = '/register';
  static const String otpRoute = '/otp';
  static const String dashboardRoute = '/dashboard';
  static const String assetsRoute = '/assets';
  static const String remindersRoute = '/reminders';
  static const String emailIntegrationRoute = '/email-integration';
  static const String emailScanRoute = '/email-scan';
  static const String suggestionsRoute = '/suggestions';
  static const String suggestionDetailRoute = '/suggestion-detail';
  static const String suggestionAttachmentPreviewRoute =
      '/suggestion-attachment-preview';
}
