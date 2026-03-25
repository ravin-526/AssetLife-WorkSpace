import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/features/reminders/providers/reminder_provider.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';
import 'package:assetlife_mobile/shared/widgets/app_widgets.dart';

class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load(context);
    });
  }

  Future<void> _load(BuildContext context) async {
    await context.read<ReminderProvider>().fetchReminders();
  }

  String _formatDate(String rawDate) {
    final parsed = DateTime.tryParse(rawDate);
    if (parsed == null) {
      return rawDate;
    }
    return DateFormat('dd MMM yyyy').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Reminders'),
        actions: [
          Consumer<ThemeProvider>(
            builder: (context, themeProvider, _) => IconButton(
              icon: Icon(
                themeProvider.isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
              ),
              tooltip: themeProvider.isDark ? 'Light mode' : 'Dark mode',
              onPressed: themeProvider.toggle,
            ),
          ),
        ],
      ),
      body: Consumer<ReminderProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.reminders.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.reminders.isEmpty) {
            return const EmptyState(
              title: 'No Reminders Found',
              message: 'Reminders will appear here after creation',
              icon: Icons.notifications_outlined,
            );
          }

          return RefreshIndicator(
            onRefresh: () => _load(context),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.reminders.length,
              itemBuilder: (context, index) {
                final reminder = provider.reminders[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          reminder.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Reminder Date: ${_formatDate(reminder.reminderDate)}',
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Type: ${reminder.type == 'asset' ? 'Asset' : 'Custom'}',
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Add Reminder will be implemented in next phase'),
            ),
          );
        },
        child: const Icon(Icons.add_alert_outlined),
      ),
    );
  }
}
