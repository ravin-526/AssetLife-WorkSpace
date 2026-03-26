import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/features/auth/providers/auth_provider.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final currentRoute = ModalRoute.of(context)?.settings.name;

    Widget drawerItem({
      required IconData icon,
      required String label,
      required String route,
      VoidCallback? onTap,
    }) {
      final isSelected = currentRoute == route;
      return ListTile(
        dense: true,
        leading: Icon(icon),
        title: Text(label),
        selected: isSelected,
        selectedColor: Theme.of(context).primaryColor,
        onTap: () {
          Navigator.pop(context);
          if (onTap != null) {
            onTap();
            return;
          }
          if (!isSelected) {
            Navigator.pushNamed(context, route);
          }
        },
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final headerBg = isDark ? const Color(0xFFF3F4F6) : Colors.white;
    final headerText = isDark ? const Color(0xFF111827) : Colors.black87;

    return Drawer(
      child: Column(
        children: [
          Container(
            height: 74,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: headerBg,
              border: Border(
                bottom: BorderSide(
                  color: Theme.of(context).dividerColor.withValues(alpha: 0.55),
                ),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/icons/app_logo.png',
                  height: 32,
                  width: 32,
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 10),
                RichText(
                  text: TextSpan(
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Roboto',
                    ),
                    children: [
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
              ],
            ),
          ),
          drawerItem(
            icon: Icons.dashboard_outlined,
            label: 'Dashboard',
            route: AppConstants.dashboardRoute,
          ),
          drawerItem(
            icon: Icons.inventory_2_outlined,
            label: 'Assets',
            route: AppConstants.assetsRoute,
          ),
          drawerItem(
            icon: Icons.notifications_outlined,
            label: 'Reminders',
            route: AppConstants.remindersRoute,
          ),
          drawerItem(
            icon: Icons.email_outlined,
            label: 'Email Sync',
            route: AppConstants.emailIntegrationRoute,
          ),
          drawerItem(
            icon: Icons.mark_email_read_outlined,
            label: 'Email Scan',
            route: AppConstants.emailScanRoute,
          ),
          drawerItem(
            icon: Icons.visibility_outlined,
            label: 'Suggestions',
            route: AppConstants.suggestionsRoute,
          ),
          drawerItem(
            icon: Icons.person_outline,
            label: 'Profile',
            route: AppConstants.dashboardRoute,
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Profile screen coming soon')),
              );
            },
          ),
          drawerItem(
            icon: Icons.settings_outlined,
            label: 'Settings',
            route: AppConstants.dashboardRoute,
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Settings screen coming soon')),
              );
            },
          ),
          const Spacer(),
          const Divider(height: 1),
          ListTile(
            dense: true,
            leading: const Icon(Icons.logout),
            title: const Text('Logout'),
            onTap: () async {
              final navigator = Navigator.of(context);
              final auth = context.read<AuthProvider>();
              Navigator.pop(context);
              await auth.logout();
              navigator.pushNamedAndRemoveUntil(
                AppConstants.loginRoute,
                (route) => false,
              );
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
