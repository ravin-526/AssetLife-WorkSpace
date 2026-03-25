import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/features/assets/providers/asset_provider.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';
import 'package:assetlife_mobile/shared/widgets/app_widgets.dart';

class AssetsScreen extends StatefulWidget {
  const AssetsScreen({super.key});

  @override
  State<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends State<AssetsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load(context);
    });
  }

  Future<void> _load(BuildContext context) async {
    await context.read<AssetProvider>().fetchAssets();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Assets'),
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
      body: Consumer<AssetProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.assets.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.assets.isEmpty) {
            return const EmptyState(
              title: 'No Assets Found',
              message: 'Assets will appear here after creation',
              icon: Icons.inventory_2_outlined,
            );
          }

          return RefreshIndicator(
            onRefresh: () => _load(context),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.assets.length,
              itemBuilder: (context, index) {
                final asset = provider.assets[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          asset.name,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Category: ${asset.category.isEmpty ? '-' : asset.category}',
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Text('Status: '),
                            StatusBadge(
                              status: asset.status.isEmpty
                                  ? 'Active'
                                  : asset.status,
                            ),
                          ],
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
              content: Text('Add Asset will be implemented in next phase'),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
