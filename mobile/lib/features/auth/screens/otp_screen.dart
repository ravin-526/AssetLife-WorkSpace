import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/features/auth/providers/auth_provider.dart';
import 'package:assetlife_mobile/features/auth/widgets/auth_scaffold.dart';
import 'package:assetlife_mobile/shared/widgets/app_widgets.dart';

class OtpScreenArgs {
  final String mobile;
  final String? prefilledOtp;
  final int? resendAvailableAtEpochMs;

  const OtpScreenArgs({
    required this.mobile,
    this.prefilledOtp,
    this.resendAvailableAtEpochMs,
  });
}

class OtpScreen extends StatefulWidget {
  final OtpScreenArgs args;

  const OtpScreen({super.key, required this.args});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;
  Timer? _cooldownTimer;
  int _resendCooldown = 0;
  bool _resending = false;

  String get _otpValue =>
      _controllers.map((controller) => controller.text).join();

  InputDecoration _otpInputDecoration(BuildContext context, bool isFocused) {
    final accent = Theme.of(context).primaryColor;
    return InputDecoration(
      counterText: '',
      contentPadding: const EdgeInsets.symmetric(vertical: 14),
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: accent.withValues(alpha: 0.72),
          width: 1.7,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: accent.withValues(alpha: 0.72),
          width: 1.7,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: isFocused ? accent : accent.withValues(alpha: 0.9),
          width: isFocused ? 2.3 : 1.9,
        ),
      ),
    );
  }

  int _remainingFromEpochMs(int epochMs) {
    final deltaMs = epochMs - DateTime.now().millisecondsSinceEpoch;
    if (deltaMs <= 0) {
      return 0;
    }
    return (deltaMs / 1000).ceil();
  }

  void _startCooldown([int seconds = 30]) {
    _cooldownTimer?.cancel();
    setState(() {
      _resendCooldown = seconds;
    });
    if (seconds <= 0) {
      return;
    }
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendCooldown <= 1) {
        setState(() {
          _resendCooldown = 0;
        });
        timer.cancel();
        return;
      }
      setState(() {
        _resendCooldown -= 1;
      });
    });
  }

  void _syncCooldownFromArgs() {
    final epoch = widget.args.resendAvailableAtEpochMs;
    if (epoch == null) {
      return;
    }
    final remaining = _remainingFromEpochMs(epoch);
    if (remaining > 0) {
      _startCooldown(remaining);
    }
  }

  Future<void> _resendOtp() async {
    if (_resending || _resendCooldown > 0) {
      return;
    }
    setState(() {
      _resending = true;
    });

    try {
      final debugOtp = await context.read<AuthProvider>().sendOtp(
        widget.args.mobile,
      );
      if (!mounted) return;
      if ((debugOtp ?? '').isNotEmpty) {
        final seed = debugOtp!.replaceAll(RegExp(r'\D'), '');
        if (seed.length >= AppConstants.otpLength) {
          for (int i = 0; i < AppConstants.otpLength; i++) {
            _controllers[i].text = seed[i];
          }
        }
      } else {
        for (final controller in _controllers) {
          controller.clear();
        }
      }
      _startCooldown(30);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('OTP sent successfully')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _resending = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      AppConstants.otpLength,
      (_) => TextEditingController(),
    );
    _focusNodes = List.generate(AppConstants.otpLength, (_) => FocusNode());

    final seed = (widget.args.prefilledOtp ?? '').replaceAll(RegExp(r'\D'), '');
    if (seed.length >= AppConstants.otpLength) {
      for (int i = 0; i < AppConstants.otpLength; i++) {
        _controllers[i].text = seed[i];
      }
    }
    _syncCooldownFromArgs();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_controllers.first.text.isEmpty) {
        _focusNodes.first.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _onOtpChanged(int index, String value) {
    final numeric = value.replaceAll(RegExp(r'\D'), '');
    if (numeric.isEmpty) {
      _controllers[index].clear();
      if (index > 0) {
        _focusNodes[index - 1].requestFocus();
      }
      return;
    }

    _controllers[index].text = numeric[0];
    _controllers[index].selection = const TextSelection.collapsed(offset: 1);

    if (index < AppConstants.otpLength - 1) {
      _focusNodes[index + 1].requestFocus();
    } else {
      _focusNodes[index].unfocus();
    }
  }

  Future<void> _verifyOtp(BuildContext context) async {
    final otp = _otpValue.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('OTP must be 6 digits')));
      return;
    }

    try {
      await context.read<AuthProvider>().verifyOtp(
        mobile: widget.args.mobile,
        otp: otp,
      );
      if (!context.mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppConstants.dashboardRoute,
        (route) => false,
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final logoHeight = MediaQuery.sizeOf(context).width < 390 ? 168.0 : 192.0;
    final canResend = !_resending && _resendCooldown == 0;

    return AuthScaffold(
      alignTop: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back),
              tooltip: 'Back',
            ),
          ),
          const SizedBox(height: 6),
          Image.asset(
            'assets/icons/app_logo.png',
            height: logoHeight,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
          ),
          const SizedBox(height: 12),
          Text(
            'Verify OTP',
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'We sent an OTP to ${widget.args.mobile}',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(AppConstants.otpLength, (index) {
              return Padding(
                padding: EdgeInsets.only(
                  right: index == AppConstants.otpLength - 1 ? 0 : 10,
                ),
                child: SizedBox(
                  width: 46,
                  height: 56,
                  child: ListenableBuilder(
                    listenable: _focusNodes[index],
                    builder: (context, _) {
                      return TextField(
                        controller: _controllers[index],
                        focusNode: _focusNodes[index],
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        maxLength: 1,
                        decoration: _otpInputDecoration(
                          context,
                          _focusNodes[index].hasFocus,
                        ),
                        onChanged: (value) => _onOtpChanged(index, value),
                      );
                    },
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 16),
          Consumer<AuthProvider>(
            builder: (context, auth, _) {
              return PrimaryButton(
                label: auth.isLoading ? 'Verifying...' : 'Verify OTP',
                onPressed: () => _verifyOtp(context),
                isLoading: auth.isLoading,
              );
            },
          ),
          const SizedBox(height: 14),
          Text(
            _resendCooldown > 0
                ? 'Resend OTP in ${_resendCooldown}s'
                : 'Didn\'t receive the OTP?',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: canResend ? _resendOtp : null,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.black87,
              side: BorderSide(color: Theme.of(context).primaryColor),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(_resending ? 'Resending...' : 'Resend OTP'),
          ),
          const SizedBox(height: 12),
          if ((widget.args.prefilledOtp ?? '').isNotEmpty)
            Text(
              'Dev OTP prefilled for testing',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
        ],
      ),
    );
  }
}
