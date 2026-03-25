import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/features/assets/screens/assets_screen.dart';
import 'package:assetlife_mobile/features/auth/screens/login_screen.dart';
import 'package:assetlife_mobile/features/auth/screens/otp_screen.dart';
import 'package:assetlife_mobile/features/auth/screens/register_screen.dart';
import 'package:assetlife_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:assetlife_mobile/features/email/screens/email_integration_screen.dart';
import 'package:assetlife_mobile/features/email/screens/email_scan_screen.dart';
import 'package:assetlife_mobile/features/reminders/screens/reminders_screen.dart';
import 'package:assetlife_mobile/features/suggestions/screens/asset_suggestions_screen.dart';
import 'package:assetlife_mobile/features/suggestions/screens/suggestion_attachment_preview_screen.dart';
import 'package:assetlife_mobile/features/suggestions/screens/suggestion_detail_screen.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/core/routing/app_navigator.dart';
import 'package:assetlife_mobile/core/theme/app_theme.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/features/assets/providers/asset_provider.dart';
import 'package:assetlife_mobile/features/auth/providers/auth_provider.dart';
import 'package:assetlife_mobile/features/reminders/providers/reminder_provider.dart';
import 'package:assetlife_mobile/shared/services/asset_service.dart';
import 'package:assetlife_mobile/shared/services/auth_service.dart';
import 'package:assetlife_mobile/shared/services/reminder_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final apiClient = ApiClient(onUnauthorized: AppNavigator.toLogin);
  final authService = AuthService(apiClient);
  final assetService = AssetService(apiClient);
  final reminderService = ReminderService(apiClient);
  final authProvider = AuthProvider(authService);
  await authProvider.checkAuthStatus();
  final themeProvider = ThemeProvider();
  await themeProvider.init();

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        Provider<AuthService>.value(value: authService),
        Provider<AssetService>.value(value: assetService),
        Provider<ReminderService>.value(value: reminderService),
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<ThemeProvider>.value(value: themeProvider),
        ChangeNotifierProvider<AssetProvider>(
          create: (_) => AssetProvider(assetService),
        ),
        ChangeNotifierProvider<ReminderProvider>(
          create: (_) => ReminderProvider(reminderService),
        ),
      ],
      child: const AssetLifeApp(),
    ),
  );
}

class AssetLifeApp extends StatefulWidget {
  const AssetLifeApp({super.key});

  @override
  State<AssetLifeApp> createState() => _AssetLifeAppState();
}

class _AssetLifeAppState extends State<AssetLifeApp> {
  late final AppLinks _appLinks;
  StreamSubscription<Uri?>? _deepLinkSub;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  Future<void> _initDeepLinks() async {
    _appLinks = AppLinks();

    try {
      final initialUri = await _appLinks.getInitialAppLink();
      _handleDeepLink(initialUri);
    } catch (_) {
      // Ignore malformed initial links.
    }

    _deepLinkSub = _appLinks.uriLinkStream.listen(
      _handleDeepLink,
      onError: (_) {
        // Ignore stream parsing errors.
      },
    );
  }

  void _handleDeepLink(Uri? uri) {
    if (uri == null) {
      return;
    }
    if (uri.scheme != 'assetlife' || uri.host != 'oauth-callback') {
      return;
    }

    final navigator = AppNavigator.navigatorKey.currentState;
    if (navigator == null) {
      return;
    }
    navigator.pushNamed(AppConstants.emailIntegrationRoute);
  }

  @override
  void dispose() {
    _deepLinkSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: AppNavigator.navigatorKey,
      debugShowCheckedModeBanner: false,
      title: AppConstants.appName,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: context.watch<ThemeProvider>().themeMode,
      initialRoute: AppConstants.loginRoute,
      routes: {
        AppConstants.loginRoute: (context) => const LoginScreen(),
        AppConstants.registerRoute: (context) => const RegisterScreen(),
        AppConstants.otpRoute: (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          if (args is OtpScreenArgs) {
            return OtpScreen(args: args);
          }
          if (args is String) {
            return OtpScreen(args: OtpScreenArgs(mobile: args));
          }
          return const OtpScreen(args: OtpScreenArgs(mobile: ''));
        },
        AppConstants.dashboardRoute: (context) =>
            const _AuthGuard(child: DashboardScreen()),
        AppConstants.assetsRoute: (context) =>
            const _AuthGuard(child: AssetsScreen()),
        AppConstants.remindersRoute: (context) =>
            const _AuthGuard(child: RemindersScreen()),
        AppConstants.emailIntegrationRoute: (context) =>
            const _AuthGuard(child: EmailIntegrationScreen()),
        AppConstants.emailScanRoute: (context) =>
            const _AuthGuard(child: EmailScanScreen()),
        AppConstants.suggestionsRoute: (context) =>
            const _AuthGuard(child: AssetSuggestionsScreen()),
        AppConstants.suggestionDetailRoute: (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          if (args is SuggestionDetailArgs) {
            return _AuthGuard(child: SuggestionDetailScreen(args: args));
          }
          return const _AuthGuard(child: AssetSuggestionsScreen());
        },
        AppConstants.suggestionAttachmentPreviewRoute: (context) {
          final args = ModalRoute.of(context)?.settings.arguments;
          if (args is SuggestionAttachmentPreviewArgs) {
            return _AuthGuard(
              child: SuggestionAttachmentPreviewScreen(args: args),
            );
          }
          return const _AuthGuard(child: AssetSuggestionsScreen());
        },
      },
    );
  }
}

class _AuthGuard extends StatelessWidget {
  final Widget child;

  const _AuthGuard({required this.child});

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context.select<AuthProvider, bool>(
      (provider) => provider.isAuthenticated,
    );
    if (isAuthenticated) {
      return child;
    }
    return const LoginScreen();
  }
}
