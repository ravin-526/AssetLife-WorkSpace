import 'package:flutter/material.dart';
import 'package:assetlife_mobile/core/widgets/web_like_background.dart';

class AuthScaffold extends StatelessWidget {
  final Widget child;
  final bool alignTop;

  const AuthScaffold({super.key, required this.child, this.alignTop = false});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: WebLikeBackground()),
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.white.withValues(alpha: 0.28),
                      Colors.white.withValues(alpha: 0.20),
                      Colors.white.withValues(alpha: 0.28),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: alignTop
                ? Align(
                    alignment: Alignment.topCenter,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 18,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: child,
                      ),
                    ),
                  )
                : Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 18,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: child,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
