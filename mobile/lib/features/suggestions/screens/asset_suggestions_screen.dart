import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/core/constants/app_constants.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/models/email_sync_models.dart';
import 'package:assetlife_mobile/shared/services/suggestion_service.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';

class SuggestionDetailArgs {
  final AssetSuggestion suggestion;

  const SuggestionDetailArgs({required this.suggestion});
}

class AssetSuggestionsScreen extends StatefulWidget {
  const AssetSuggestionsScreen({super.key});

  @override
  State<AssetSuggestionsScreen> createState() => _AssetSuggestionsScreenState();
}

class _AssetSuggestionsScreenState extends State<AssetSuggestionsScreen> {
  late final SuggestionService _service;
  List<AssetSuggestion> _suggestions = <AssetSuggestion>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _service = SuggestionService(context.read<ApiClient>());
    _loadSuggestions();
  }

  Future<void> _loadSuggestions() async {
    try {
      final suggestions = await _service.getSuggestions();
      if (!mounted) return;
      setState(() {
        _suggestions = suggestions;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  String _formatDate(String? value) {
    if (value == null || value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return DateFormat('dd MMM yyyy').format(parsed);
  }

  Future<void> _confirmSuggestion(AssetSuggestion suggestion) async {
    try {
      await _service.confirmSuggestion(suggestion.id);
      if (!mounted) return;
      setState(() {
        _suggestions = _suggestions
            .where((item) => item.id != suggestion.id)
            .toList();
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Asset added successfully')));
      Navigator.pushNamed(context, AppConstants.assetsRoute);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _rejectSuggestion(AssetSuggestion suggestion) async {
    try {
      await _service.rejectSuggestion(suggestion.id);
      if (!mounted) return;
      setState(() {
        _suggestions = _suggestions
            .where((item) => item.id != suggestion.id)
            .toList();
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Suggestion rejected')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _openDetail(AssetSuggestion suggestion) async {
    final result = await Navigator.pushNamed(
      context,
      AppConstants.suggestionDetailRoute,
      arguments: SuggestionDetailArgs(suggestion: suggestion),
    );

    if (!mounted || result is! Map) {
      return;
    }

    final action = result['action']?.toString();
    if (action == 'confirmed' || action == 'rejected') {
      setState(() {
        _suggestions = _suggestions
            .where((item) => item.id != suggestion.id)
            .toList();
      });
    }

    if (action == 'confirmed') {
      Navigator.pushNamed(context, AppConstants.assetsRoute);
    }
  }

  Widget _buildSuggestionCard(AssetSuggestion suggestion) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              suggestion.productName,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text('Vendor: ${suggestion.vendor ?? '-'}'),
            Text('Price: ${suggestion.price?.toStringAsFixed(2) ?? '-'}'),
            Text(
              'Date: ${_formatDate(suggestion.purchaseDate ?? suggestion.emailDate)}',
            ),
            Text(
              'Status: ${suggestion.alreadyAdded ? 'Already Added' : suggestion.status}',
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: () => _openDetail(suggestion),
                  child: const Text('View Details'),
                ),
                ElevatedButton(
                  onPressed: suggestion.alreadyAdded
                      ? null
                      : () => _confirmSuggestion(suggestion),
                  child: const Text('Confirm'),
                ),
                TextButton(
                  onPressed: suggestion.alreadyAdded
                      ? null
                      : () => _rejectSuggestion(suggestion),
                  child: const Text('Reject'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Asset Suggestions'),
        actions: [
          Consumer<ThemeProvider>(
            builder: (context, themeProvider, _) => IconButton(
              icon: Icon(
                themeProvider.isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
              ),
              onPressed: themeProvider.toggle,
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadSuggestions,
              child: _suggestions.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 120),
                        Center(child: Text('No suggestions found')),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      itemCount: _suggestions.length,
                      itemBuilder: (context, index) {
                        return _buildSuggestionCard(_suggestions[index]);
                      },
                    ),
            ),
    );
  }
}
