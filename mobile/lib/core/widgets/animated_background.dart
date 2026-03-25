import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class AnimatedBackground extends StatefulWidget {
  const AnimatedBackground({super.key});

  @override
  State<AnimatedBackground> createState() => _AnimatedBackgroundState();
}

class _AnimatedBackgroundState extends State<AnimatedBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  static const List<_ShapeConfig> _shapes = [
    _ShapeConfig(
      size: 180,
      leftFactor: 0.04,
      topFactor: 0.12,
      xAmplitude: 20,
      yAmplitude: 18,
      speed: 0.95,
      opacity: 0.14,
      color: Color(0xFF7DD3FC),
      blur: 42,
      phase: 0.15,
    ),
    _ShapeConfig(
      size: 130,
      leftFactor: 0.16,
      topFactor: 0.70,
      xAmplitude: 24,
      yAmplitude: 20,
      speed: 1.2,
      opacity: 0.12,
      color: Color(0xFF4FD1C5),
      blur: 30,
      phase: 1.1,
    ),
    _ShapeConfig(
      size: 210,
      leftFactor: 0.68,
      topFactor: 0.08,
      xAmplitude: 18,
      yAmplitude: 24,
      speed: 0.8,
      opacity: 0.10,
      color: Color(0xFF38BDF8),
      blur: 50,
      phase: 2.3,
    ),
    _ShapeConfig(
      size: 150,
      leftFactor: 0.78,
      topFactor: 0.62,
      xAmplitude: 16,
      yAmplitude: 16,
      speed: 1.35,
      opacity: 0.13,
      color: Color(0xFF60A5FA),
      blur: 34,
      phase: 0.55,
    ),
    _ShapeConfig(
      size: 95,
      leftFactor: 0.44,
      topFactor: 0.22,
      xAmplitude: 14,
      yAmplitude: 17,
      speed: 1.05,
      opacity: 0.12,
      color: Color(0xFF67E8F9),
      blur: 24,
      phase: 1.8,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 26),
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
          final drift = math.sin(t * 2 * math.pi);
          final sweep = math.cos((t * 2 * math.pi) + 0.7);

          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-1 + (0.18 * drift), -1 + (0.1 * sweep)),
                end: Alignment(1 + (0.12 * sweep), 1 + (0.15 * drift)),
                colors: const [
                  Color(0xFFE6F7FB),
                  Color(0xFFF0F9FF),
                  Color(0xFFFFFFFF),
                ],
              ),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Positioned.fill(
                  child: IgnorePointer(
                    child: Opacity(
                      opacity: 0.10,
                      child: SvgPicture.asset(
                        'assets/images/login-bg.svg',
                        fit: BoxFit.contain,
                        alignment: Alignment.center,
                      ),
                    ),
                  ),
                ),
                for (final shape in _shapes) _FloatingShape(t: t, shape: shape),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FloatingShape extends StatelessWidget {
  final double t;
  final _ShapeConfig shape;

  const _FloatingShape({required this.t, required this.shape});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = constraints.maxHeight;

        final baseLeft = width * shape.leftFactor;
        final baseTop = height * shape.topFactor;

        final angle = (t * 2 * math.pi * shape.speed) + shape.phase;
        final dx = math.sin(angle) * shape.xAmplitude;
        final dy = math.cos(angle * 1.1) * shape.yAmplitude;

        return Positioned(
          left: baseLeft + dx,
          top: baseTop + dy,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: Container(
                width: shape.size,
                height: shape.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: shape.color.withValues(alpha: shape.opacity),
                  boxShadow: [
                    BoxShadow(
                      color: shape.color.withValues(
                        alpha: shape.opacity * 0.75,
                      ),
                      blurRadius: shape.blur,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ShapeConfig {
  final double size;
  final double leftFactor;
  final double topFactor;
  final double xAmplitude;
  final double yAmplitude;
  final double speed;
  final double opacity;
  final Color color;
  final double blur;
  final double phase;

  const _ShapeConfig({
    required this.size,
    required this.leftFactor,
    required this.topFactor,
    required this.xAmplitude,
    required this.yAmplitude,
    required this.speed,
    required this.opacity,
    required this.color,
    required this.blur,
    required this.phase,
  });
}
