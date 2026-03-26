import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/features/auth/providers/auth_provider.dart';
import 'package:assetlife_mobile/features/auth/screens/otp_screen.dart';
import 'package:assetlife_mobile/features/auth/widgets/auth_scaffold.dart';
import 'package:assetlife_mobile/shared/widgets/app_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mobileController = TextEditingController();
  final _mobileFocusNode = FocusNode();
  bool _sendingOtp = false;
  bool _isMobileFocused = false;

  InputDecoration _inputDecoration({
    required String label,
    String? hint,
    bool highlighted = false,
  }) {
    final accent = Theme.of(context).primaryColor;
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.78),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: highlighted
              ? accent.withValues(alpha: 0.8)
              : Colors.white.withValues(alpha: 0.8),
          width: highlighted ? 1.8 : 1.0,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: highlighted
              ? accent.withValues(alpha: 0.8)
              : Colors.white.withValues(alpha: 0.82),
          width: highlighted ? 1.8 : 1.0,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: highlighted
              ? Theme.of(context).primaryColor
              : Colors.white.withValues(alpha: 0.82),
          width: highlighted ? 1.8 : 1.0,
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _mobileFocusNode.addListener(() {
      if (!mounted) return;
      setState(() {
        _isMobileFocused = _mobileFocusNode.hasFocus;
      });
    });
    // Auto-focus mobile number field on first load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _mobileFocusNode.requestFocus();
      final authProvider = context.read<AuthProvider>();
      if (authProvider.isAuthenticated && mounted) {
        Navigator.pushReplacementNamed(context, AppConstants.dashboardRoute);
      }
    });
  }

  @override
  void dispose() {
    _mobileController.dispose();
    _mobileFocusNode.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final mobile = _mobileController.text.trim();
    if (!RegExp(r'^\d{10,15}$').hasMatch(mobile)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid mobile number')),
      );
      return;
    }

    setState(() {
      _sendingOtp = true;
    });
    final resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));

    try {
      final debugOtp = await context.read<AuthProvider>().sendOtp(mobile);
      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppConstants.otpRoute,
        arguments: OtpScreenArgs(
          mobile: mobile,
          prefilledOtp: debugOtp ?? '123456',
          resendAvailableAtEpochMs: resendAvailableAt.millisecondsSinceEpoch,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _sendingOtp = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final logoHeight = MediaQuery.sizeOf(context).width < 390 ? 168.0 : 192.0;
    final sendOtpLabel = _sendingOtp ? 'Sending OTP...' : 'Send OTP';

    return AuthScaffold(
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Image.asset(
              'assets/icons/app_logo.png',
              height: logoHeight,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
            ),
            const SizedBox(height: 18),
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Roboto',
                  fontWeight: FontWeight.w700,
                ),
                children: [
                  TextSpan(
                    text: 'Welcome to ',
                    style: TextStyle(
                      color: Theme.of(context).textTheme.titleLarge?.color,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  TextSpan(
                    text: 'Asset',
                    style: TextStyle(
                      color: Color(0xFF2C3E50),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  TextSpan(
                    text: 'Life',
                    style: TextStyle(
                      color: Color(0xFF17A2B8),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Manage your assets with ease',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _mobileController,
              focusNode: _mobileFocusNode,
              keyboardType: TextInputType.phone,
              decoration: _inputDecoration(
                label: 'Mobile Number',
                hint: 'Enter mobile number',
                highlighted: _isMobileFocused,
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: sendOtpLabel,
              onPressed: _sendOtp,
              isLoading: _sendingOtp,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "Don't have an account?",
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: Colors.black87),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () {
                    Navigator.pushNamed(context, AppConstants.registerRoute);
                  },
                  child: Text(
                    'Create Account',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).primaryColor,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
