class AppConstants {
  // Android emulator host alias for local machine backend.
  static const String apiBaseUrl = 'http://10.0.2.2:8000';
  static const String tokenKey = 'access_token';
  static const String appName = 'Asset Life';
  static const int otpLength = 6;

  static const String loginRoute = '/login';
  static const String registerRoute = '/register';
  static const String otpRoute = '/otp';
  static const String dashboardRoute = '/dashboard';
  static const String assetsRoute = '/assets';
  static const String remindersRoute = '/reminders';
}
