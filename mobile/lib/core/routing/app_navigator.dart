import 'package:flutter/material.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';

class AppNavigator {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  static void toLogin() {
    final context = navigatorKey.currentContext;
    if (context == null) {
      return;
    }

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppConstants.loginRoute,
      (route) => false,
    );
  }
}
