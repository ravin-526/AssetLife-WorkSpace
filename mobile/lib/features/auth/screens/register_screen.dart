import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/features/auth/providers/auth_provider.dart';
import 'package:assetlife_mobile/features/auth/screens/otp_screen.dart';
import 'package:assetlife_mobile/features/auth/widgets/auth_scaffold.dart';
import 'package:assetlife_mobile/shared/widgets/app_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _emailController = TextEditingController();
  final _nameFocusNode = FocusNode();
  final _mobileFocusNode = FocusNode();
  final _emailFocusNode = FocusNode();
  bool _registering = false;
  String? _activeField = 'name';

  InputDecoration _inputDecoration({
    required String label,
    Widget? suffixIcon,
    bool highlighted = false,
  }) {
    final accent = Theme.of(context).primaryColor;
    return InputDecoration(
      labelText: label,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.78),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: highlighted
              ? accent.withValues(alpha: 0.8)
              : Colors.white.withValues(alpha: 0.82),
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
    _nameFocusNode.addListener(
      () => _onFieldFocusChange('name', _nameFocusNode),
    );
    _mobileFocusNode.addListener(
      () => _onFieldFocusChange('mobile', _mobileFocusNode),
    );
    _emailFocusNode.addListener(
      () => _onFieldFocusChange('email', _emailFocusNode),
    );
  }

  void _onFieldFocusChange(String field, FocusNode node) {
    if (!mounted) return;
    if (node.hasFocus) {
      setState(() {
        _activeField = field;
      });
      return;
    }

    if (!_nameFocusNode.hasFocus &&
        !_mobileFocusNode.hasFocus &&
        !_emailFocusNode.hasFocus) {
      setState(() {
        _activeField = null;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    _emailController.dispose();
    _nameFocusNode.dispose();
    _mobileFocusNode.dispose();
    _emailFocusNode.dispose();
    super.dispose();
  }

  String? _validateInput() {
    final name = _nameController.text.trim();
    final mobile = _mobileController.text.trim();
    final email = _emailController.text.trim();

    if (name.isEmpty) {
      return 'Full name is required';
    }
    if (!RegExp(r'^\d{10,15}$').hasMatch(mobile)) {
      return 'Please enter a valid mobile number';
    }
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  }

  Future<void> _register() async {
    final error = _validateInput();
    if (error != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error)));
      return;
    }

    setState(() {
      _registering = true;
    });
    final resendAvailableAt = DateTime.now().add(const Duration(seconds: 30));

    try {
      final authProvider = context.read<AuthProvider>();
      final mobile = _mobileController.text.trim();
      final debugOtp = await authProvider.registerIndividual(
        name: _nameController.text.trim(),
        mobile: mobile,
        email: _emailController.text.trim().toLowerCase(),
        dob: '1970-01-01',
        pan: 'AAAAA0000A',
      );

      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppConstants.otpRoute,
        arguments: OtpScreenArgs(
          mobile: mobile,
          prefilledOtp: debugOtp,
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
          _registering = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final logoHeight = MediaQuery.sizeOf(context).width < 390 ? 168.0 : 192.0;
    final buttonLabel = _registering ? 'Sending OTP...' : 'Register';

    return AuthScaffold(
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
          Text(
            'Individual Registration',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _nameController,
            focusNode: _nameFocusNode,
            textCapitalization: TextCapitalization.words,
            decoration: _inputDecoration(
              label: 'Full Name',
              highlighted: _activeField == 'name',
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _mobileController,
            focusNode: _mobileFocusNode,
            keyboardType: TextInputType.phone,
            decoration: _inputDecoration(
              label: 'Mobile Number',
              highlighted: _activeField == 'mobile',
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _emailController,
            focusNode: _emailFocusNode,
            keyboardType: TextInputType.emailAddress,
            decoration: _inputDecoration(
              label: 'Email',
              highlighted: _activeField == 'email',
            ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: buttonLabel,
            onPressed: _register,
            isLoading: _registering,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Already have an account?',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: Colors.black87),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () {
                  Navigator.pushReplacementNamed(
                    context,
                    AppConstants.loginRoute,
                  );
                },
                child: Text(
                  'Login',
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
    );
  }
}
