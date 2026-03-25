import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ThemeProvider extends ChangeNotifier {
  static const _storage = FlutterSecureStorage();
  static const _key = 'theme_mode';

  ThemeMode _themeMode = ThemeMode.light;

  ThemeMode get themeMode => _themeMode;
  bool get isDark => _themeMode == ThemeMode.dark;

  Future<void> init() async {
    try {
      final val = await _storage.read(key: _key);
      _themeMode = val == 'dark' ? ThemeMode.dark : ThemeMode.light;
      notifyListeners();
    } catch (_) {
      // Default to light on read failure.
    }
  }

  Future<void> toggle() async {
    _themeMode = isDark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
    try {
      await _storage.write(key: _key, value: isDark ? 'dark' : 'light');
    } catch (_) {
      // Best-effort persistence.
    }
  }
}
