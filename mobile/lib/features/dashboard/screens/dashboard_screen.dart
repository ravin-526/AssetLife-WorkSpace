import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/features/assets/providers/asset_provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:assetlife_mobile/features/reminders/providers/reminder_provider.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _fabExpanded = false;

  Future<void> _loadDashboardData() async {
    try {
      await Future.wait([
        context.read<AssetProvider>().fetchAssets(),
        context.read<ReminderProvider>().fetchReminders(),
      ]);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to load dashboard data')),
      );
    }
  }

  String _normalizeStatus(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized == 'active') return 'Active';
    if (normalized == 'inactive') return 'Inactive';
    if (normalized.contains('warranty')) return 'In Warranty';
    if (normalized.contains('expiring')) return 'Expiring Soon';
    if (normalized.contains('expired')) return 'Expired';
    if (normalized == 'lost') return 'Lost';
    if (normalized == 'damaged') return 'Damaged';
    return 'Active';
  }

  DateTime? _parseDate(String raw) {
    final value = raw.trim();
    if (value.isEmpty) {
      return null;
    }
    final parsed = DateTime.tryParse(value);
    return parsed;
  }

  void _runFabAction(_FabActionType action) {
    setState(() {
      _fabExpanded = false;
    });

    switch (action) {
      case _FabActionType.addAsset:
        Navigator.pushNamed(context, AppConstants.assetsRoute);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Manual Add Asset flow coming soon')),
        );
        break;
      case _FabActionType.uploadInvoice:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload Invoice coming soon')),
        );
        break;
      case _FabActionType.scanCode:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('QR / Barcode scan coming soon')),
        );
        break;
      case _FabActionType.addReminder:
        Navigator.pushNamed(context, AppConstants.remindersRoute);
        break;
    }
  }

  Widget _buildFabMenu(BuildContext context) {
    final actions = <_FabMenuItem>[
      const _FabMenuItem(
        type: _FabActionType.addAsset,
        label: 'Add Asset',
        icon: Icons.add_circle_outline,
      ),
      const _FabMenuItem(
        type: _FabActionType.uploadInvoice,
        label: 'Upload Invoice',
        icon: Icons.receipt_long_outlined,
      ),
      const _FabMenuItem(
        type: _FabActionType.scanCode,
        label: 'Scan QR / Barcode',
        icon: Icons.qr_code_scanner_outlined,
      ),
      const _FabMenuItem(
        type: _FabActionType.addReminder,
        label: 'Add Reminder',
        icon: Icons.alarm_add_outlined,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        ...List.generate(actions.length, (index) {
          final item = actions[index];
          final delay = (actions.length - index) * 35;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AnimatedOpacity(
              opacity: _fabExpanded ? 1 : 0,
              duration: Duration(milliseconds: 220 + delay),
              curve: Curves.easeOut,
              child: AnimatedScale(
                scale: _fabExpanded ? 1 : 0.88,
                duration: Duration(milliseconds: 220 + delay),
                curve: Curves.easeOutBack,
                child: IgnorePointer(
                  ignoring: !_fabExpanded,
                  child: _FabActionChip(
                    label: item.label,
                    icon: item.icon,
                    onTap: () => _runFabAction(item.type),
                  ),
                ),
              ),
            ),
          );
        }),
        FloatingActionButton(
          heroTag: 'dashboard-main-fab',
          onPressed: () {
            setState(() {
              _fabExpanded = !_fabExpanded;
            });
          },
          tooltip: _fabExpanded ? 'Close' : 'Quick Add',
          child: AnimatedRotation(
            turns: _fabExpanded ? 0.125 : 0,
            duration: const Duration(milliseconds: 180),
            child: Icon(_fabExpanded ? Icons.close : Icons.add),
          ),
        ),
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadDashboardData();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: const Text('Dashboard'),
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
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Consumer2<AssetProvider, ReminderProvider>(
              builder: (context, assets, reminders, _) {
                if (assets.isLoading || reminders.isLoading) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 56),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                final assetList = assets.assets;
                final reminderList = reminders.reminders;

                final statusCounts = <String, int>{
                  'Active': 0,
                  'In Warranty': 0,
                  'Expiring Soon': 0,
                  'Expired': 0,
                  'Inactive': 0,
                  'Lost': 0,
                  'Damaged': 0,
                };

                for (final asset in assetList) {
                  final status = _normalizeStatus(asset.status);
                  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
                }

                final today = DateTime.now();
                final startOfToday = DateTime(
                  today.year,
                  today.month,
                  today.day,
                );
                final upcomingEnd = startOfToday.add(const Duration(days: 7));

                final totalReminders = reminderList.where((reminder) {
                  return reminder.status.trim().toLowerCase() != 'completed';
                }).length;

                final upcomingReminders = reminderList.where((reminder) {
                  if (reminder.status.trim().toLowerCase() == 'completed') {
                    return false;
                  }
                  final reminderDate = _parseDate(reminder.reminderDate);
                  if (reminderDate == null) {
                    return false;
                  }
                  final day = DateTime(
                    reminderDate.year,
                    reminderDate.month,
                    reminderDate.day,
                  );
                  return day.isAtSameMomentAs(startOfToday) ||
                      (day.isAfter(startOfToday) && day.isBefore(upcomingEnd));
                }).length;

                final assetMetrics = <_DashboardMetric>[
                  _DashboardMetric(
                    title: 'Total Assets',
                    value: assetList.length,
                    icon: Icons.inventory_2_outlined,
                    color: Colors.blueGrey,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Active Assets',
                    value: statusCounts['Active'] ?? 0,
                    icon: Icons.check_circle_outline,
                    color: Colors.green,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'In Warranty',
                    value: statusCounts['In Warranty'] ?? 0,
                    icon: Icons.verified_outlined,
                    color: Colors.lightBlue,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Expiring Soon',
                    value: statusCounts['Expiring Soon'] ?? 0,
                    icon: Icons.warning_amber_outlined,
                    color: Colors.orange,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Expired',
                    value: statusCounts['Expired'] ?? 0,
                    icon: Icons.error_outline,
                    color: Colors.red,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Inactive',
                    value: statusCounts['Inactive'] ?? 0,
                    icon: Icons.pause_circle_outline,
                    color: Colors.grey,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Lost',
                    value: statusCounts['Lost'] ?? 0,
                    icon: Icons.location_off_outlined,
                    color: Colors.deepPurple,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                  _DashboardMetric(
                    title: 'Damaged',
                    value: statusCounts['Damaged'] ?? 0,
                    icon: Icons.build_circle_outlined,
                    color: Colors.pink,
                    onTap: () =>
                        Navigator.pushNamed(context, AppConstants.assetsRoute),
                  ),
                ];

                final reminderMetrics = <_DashboardMetric>[
                  _DashboardMetric(
                    title: 'Total Reminders',
                    value: totalReminders,
                    icon: Icons.notifications_outlined,
                    color: Colors.indigo,
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppConstants.remindersRoute,
                    ),
                  ),
                  _DashboardMetric(
                    title: 'Upcoming Reminders',
                    value: upcomingReminders,
                    icon: Icons.upcoming,
                    color: Colors.teal,
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppConstants.remindersRoute,
                    ),
                  ),
                ];

                // Category distribution (top 6, sorted by count desc)
                final categoryMap = <String, int>{};
                for (final asset in assetList) {
                  final cat = asset.category.trim().isEmpty
                      ? 'Uncategorized'
                      : asset.category.trim();
                  categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
                }
                final assetsByCategory = categoryMap.entries.toList()
                  ..sort((a, b) => b.value.compareTo(a.value));
                final topCategories = assetsByCategory.take(6).toList();

                // Status distribution (non-zero entries)
                final statusEntries = statusCounts.entries
                    .where((e) => e.value > 0)
                    .toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Row 1: first 2 asset metrics
                    _MetricGrid(metrics: assetMetrics.take(2).toList()),
                    const SizedBox(height: 16),

                    // Charts section
                    _CategoryDistributionCard(data: topCategories),
                    const SizedBox(height: 12),
                    _StatusDonutCard(statusEntries: statusEntries),
                    const SizedBox(height: 16),

                    // Remaining 6 asset metrics
                    _MetricGrid(metrics: assetMetrics.skip(2).toList()),
                    const SizedBox(height: 12),
                    _MetricGrid(metrics: reminderMetrics),
                  ],
                );
              },
            ),
          ],
        ),
      ),
      floatingActionButton: _buildFabMenu(context),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}

class _MetricCard extends StatelessWidget {
  final _DashboardMetric metric;

  const _MetricCard({required this.metric});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: metric.onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 5, color: metric.color),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.max,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          metric.value.toString(),
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Icon(metric.icon, size: 20, color: metric.color),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      metric.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final List<_DashboardMetric> metrics;

  const _MetricGrid({required this.metrics});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: metrics.map((metric) {
            return SizedBox(
              width: itemWidth,
              height: 90,
              child: _MetricCard(metric: metric),
            );
          }).toList(),
        );
      },
    );
  }
}

class _DashboardMetric {
  final String title;
  final int value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _DashboardMetric({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Category distribution: horizontal bar chart (matches web renderDistributionBars)
// ─────────────────────────────────────────────────────────────────────────────

class _CategoryDistributionCard extends StatelessWidget {
  final List<MapEntry<String, int>> data;

  const _CategoryDistributionCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final barColor = Theme.of(context).primaryColor;
    final maxCount = data.isEmpty
        ? 1
        : data.map((e) => e.value).reduce((a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Distribution by Category',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 14),
            if (data.isEmpty)
              Text(
                'No data available.',
                style: Theme.of(context).textTheme.bodySmall,
              )
            else
              ...data.map((entry) {
                final fraction = maxCount > 0 ? entry.value / maxCount : 0.0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              entry.key,
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Theme.of(
                                      context,
                                    ).textTheme.bodyMedium?.color,
                                  ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            entry.value.toString(),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: fraction,
                          backgroundColor: Colors.grey.withValues(alpha: 0.15),
                          valueColor: AlwaysStoppedAnimation<Color>(barColor),
                          minHeight: 8,
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status distribution: donut chart (matches web renderStatusDonut)
// ─────────────────────────────────────────────────────────────────────────────

class _StatusDonutCard extends StatelessWidget {
  final List<MapEntry<String, int>> statusEntries;

  const _StatusDonutCard({required this.statusEntries});

  // Matches STATUS_DONUT_GRADIENTS start colors from web Dashboard.tsx
  static const _statusColors = <String, Color>{
    'Active': Color(0xFF22c55e),
    'In Warranty': Color(0xFF17a2b8),
    'Expiring Soon': Color(0xFFf59e0b),
    'Expired': Color(0xFFef4444),
    'Inactive': Color(0xFF6b7280),
    'Lost': Color(0xFF8b5cf6),
    'Damaged': Color(0xFFec4899),
  };

  @override
  Widget build(BuildContext context) {
    final sections = statusEntries.map((e) {
      final color = _statusColors[e.key] ?? Colors.blueGrey;
      return PieChartSectionData(
        value: e.value.toDouble(),
        color: color,
        title: '',
        radius: 50,
      );
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Distribution by Status',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (statusEntries.isEmpty)
              Text(
                'No data available.',
                style: Theme.of(context).textTheme.bodySmall,
              )
            else
              Column(
                children: [
                  SizedBox(
                    height: 200,
                    child: PieChart(
                      PieChartData(
                        sections: sections,
                        centerSpaceRadius: 50,
                        sectionsSpace: 2,
                        pieTouchData: PieTouchData(enabled: false),
                      ),
                      duration: const Duration(milliseconds: 600),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    children: statusEntries.map((e) {
                      final color = _statusColors[e.key] ?? Colors.blueGrey;
                      return Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: color,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            e.key,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

enum _FabActionType { addAsset, uploadInvoice, scanCode, addReminder }

class _FabMenuItem {
  final _FabActionType type;
  final String label;
  final IconData icon;

  const _FabMenuItem({
    required this.type,
    required this.label,
    required this.icon,
  });
}

class _FabActionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _FabActionChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(24),
      elevation: 4,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: Theme.of(context).primaryColor),
              const SizedBox(width: 8),
              Text(label, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
