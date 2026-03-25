import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class WebLikeBackground extends StatefulWidget {
  const WebLikeBackground({super.key});

  @override
  State<WebLikeBackground> createState() => _WebLikeBackgroundState();
}

class _WebLikeBackgroundState extends State<WebLikeBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  static final Animatable<double> _floatX = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0, end: 7), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 7, end: 15), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 15, end: 7), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 7, end: 0), weight: 25),
  ]);

  static final Animatable<double> _floatY = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0, end: -10), weight: 25),
    TweenSequenceItem(tween: Tween(begin: -10, end: -20), weight: 25),
    TweenSequenceItem(tween: Tween(begin: -20, end: -10), weight: 25),
    TweenSequenceItem(tween: Tween(begin: -10, end: 0), weight: 25),
  ]);

  static final Animatable<double> _floatRotate = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0, end: 1.5), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 1.5, end: 3), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 3, end: 1.5), weight: 25),
    TweenSequenceItem(tween: Tween(begin: 1.5, end: 0), weight: 25),
  ]);

  static const List<_BgAsset> _assets = [
    _BgAsset(
      path: 'assets/background/icon-car.svg',
      size: 110,
      topFactor: 0.06,
      leftFactor: -0.03,
      motionType: _MotionType.diagonal,
      durationSeconds: 10,
      delaySeconds: 0,
      opacity: 0.18,
    ),
    _BgAsset(
      path: 'assets/background/icon-laptop.svg',
      size: 100,
      topFactor: 0.66,
      leftFactor: -0.04,
      motionType: _MotionType.vertical,
      durationSeconds: 12,
      delaySeconds: 0.5,
      opacity: 0.15,
    ),
    _BgAsset(
      path: 'assets/background/icon-phone.svg',
      size: 88,
      bottomFactor: 0.03,
      leftFactor: 0.02,
      baseRotationDegrees: -8,
      motionType: _MotionType.rotateDrift,
      durationSeconds: 9,
      delaySeconds: 1,
      opacity: 0.20,
    ),
    _BgAsset(
      path: 'assets/background/icon-document.svg',
      size: 96,
      topFactor: 0.24,
      leftFactor: -0.05,
      motionType: _MotionType.diagonal,
      durationSeconds: 11,
      delaySeconds: 0.3,
      opacity: 0.14,
    ),
    _BgAsset(
      path: 'assets/background/icon-barcode.svg',
      size: 96,
      bottomFactor: 0.15,
      rightFactor: -0.03,
      motionType: _MotionType.vertical,
      durationSeconds: 8,
      delaySeconds: 1.5,
      opacity: 0.16,
    ),
    _BgAsset(
      path: 'assets/background/icon-warranty.svg',
      size: 100,
      topFactor: 0.07,
      rightFactor: -0.03,
      motionType: _MotionType.diagonal,
      durationSeconds: 13,
      delaySeconds: 0.8,
      opacity: 0.14,
    ),
    _BgAsset(
      path: 'assets/background/icon-tv.svg',
      size: 108,
      topFactor: 0.62,
      rightFactor: -0.04,
      motionType: _MotionType.vertical,
      durationSeconds: 14,
      delaySeconds: 0.2,
      opacity: 0.16,
    ),
    _BgAsset(
      path: 'assets/background/icon-fridge.svg',
      size: 100,
      bottomFactor: 0.03,
      rightFactor: 0.01,
      motionType: _MotionType.rotateDrift,
      durationSeconds: 15,
      delaySeconds: 1.2,
      opacity: 0.18,
    ),
    _BgAsset(
      path: 'assets/background/icon-qrcode.svg',
      size: 88,
      topFactor: 0.78,
      rightFactor: 0.03,
      motionType: _MotionType.rotateDrift,
      durationSeconds: 7,
      delaySeconds: 2,
      opacity: 0.14,
    ),
    _BgAsset(
      path: 'assets/background/icon-washing.svg',
      size: 100,
      bottomFactor: 0.18,
      leftFactor: 0.02,
      motionType: _MotionType.diagonal,
      durationSeconds: 12.5,
      delaySeconds: 0.7,
      opacity: 0.16,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 60),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final t = _controller.value;

          return Stack(
            fit: StackFit.expand,
            children: [
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFE6F7FB),
                      Color(0xFFF0F9FF),
                      Color(0xFFFFFFFF),
                    ],
                  ),
                ),
              ),
              for (final asset in _assets) _AnimatedBgAsset(asset: asset, t: t),
            ],
          );
        },
      ),
    );
  }
}

class _AnimatedBgAsset extends StatelessWidget {
  final _BgAsset asset;
  final double t;

  const _AnimatedBgAsset({required this.asset, required this.t});

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.sizeOf(context);
    final width = screenSize.width;
    final height = screenSize.height;

    final scale = width < 420
        ? 0.72
        : width < 900
        ? 0.85
        : 1.0;
    final assetSize = asset.size * scale;

    final timeSeconds = t * 60;
    final localProgress =
        ((timeSeconds + asset.delaySeconds) % asset.durationSeconds) /
        asset.durationSeconds;

    final baseDx = _WebLikeBackgroundState._floatX.transform(localProgress);
    final baseDy = _WebLikeBackgroundState._floatY.transform(localProgress);
    final baseDr = _WebLikeBackgroundState._floatRotate.transform(
      localProgress,
    );

    double dx;
    double dy;
    double dr;
    switch (asset.motionType) {
      case _MotionType.vertical:
        dx = baseDx * 0.45;
        dy = baseDy;
        dr = baseDr * 0.3;
        break;
      case _MotionType.diagonal:
        dx = baseDx;
        dy = baseDy * 0.75;
        dr = baseDr * 0.4;
        break;
      case _MotionType.rotateDrift:
        dx = baseDx * 0.65;
        dy = baseDy * 0.65;
        dr = baseDr;
        break;
    }

    final child = IgnorePointer(
      child: RepaintBoundary(
        child: Opacity(
          opacity: asset.opacity,
          child: Transform.rotate(
            angle: (asset.baseRotationDegrees + dr) * (math.pi / 180),
            child: SvgPicture.asset(
              asset.path,
              width: assetSize,
              height: assetSize,
            ),
          ),
        ),
      ),
    );

    return Positioned(
      top: asset.topFactor != null ? (height * asset.topFactor!) + dy : null,
      bottom: asset.bottomFactor != null
          ? (height * asset.bottomFactor!) - dy
          : null,
      left: asset.leftFactor != null ? (width * asset.leftFactor!) + dx : null,
      right: asset.rightFactor != null
          ? (width * asset.rightFactor!) - dx
          : null,
      child: child,
    );
  }
}

class _BgAsset {
  final String path;
  final double size;
  final double? topFactor;
  final double? rightFactor;
  final double? bottomFactor;
  final double? leftFactor;
  final _MotionType motionType;
  final double opacity;
  final double baseRotationDegrees;
  final double durationSeconds;
  final double delaySeconds;

  const _BgAsset({
    required this.path,
    required this.size,
    this.topFactor,
    this.rightFactor,
    this.bottomFactor,
    this.leftFactor,
    required this.motionType,
    required this.opacity,
    this.baseRotationDegrees = 0,
    required this.durationSeconds,
    required this.delaySeconds,
  });
}

enum _MotionType { vertical, diagonal, rotateDrift }
